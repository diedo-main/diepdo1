import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { fetchAndParseRssFeed, ParsedEpisode } from '@/lib/rss-parser'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Allow longer execution for batch upsert

/**
 * Validates request authorization secret without leaking values.
 */
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.RSS_SYNC_SECRET
  if (!secret) return false

  const authHeader = request.headers.get('authorization')
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (token === secret) return true
  }

  const customHeader = request.headers.get('x-sync-secret')
  if (customHeader && customHeader.trim() === secret) return true

  return false
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing sync secret' },
      { status: 401 }
    )
  }

  const workerId = `worker-${crypto.randomUUID()}`
  let adminClient
  try {
    adminClient = createAdminClient()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server configuration error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // 1. Acquire database-level sync lock
  const { data: lockAcquired, error: lockErr } = await adminClient.rpc(
    'acquire_sync_lock',
    {
      p_worker_id: workerId,
      p_timeout_interval: '10 minutes',
    }
  )

  if (lockErr || !lockAcquired) {
    return NextResponse.json(
      {
        error: 'Sync lock could not be acquired. Another sync job may be running.',
        detail: lockErr?.message,
      },
      { status: 409 }
    )
  }

  const startTime = Date.now()
  let syncLogId: number | null = null

  try {
    // 2. Create sync_logs entry
    const { data: logData } = await adminClient
      .from('sync_logs')
      .insert({
        status: 'running',
        started_at: new Date().toISOString(),
        triggered_by: 'api',
      })
      .select('id')
      .single()

    syncLogId = logData?.id ?? null

    // 3. Parse options: limit (for testing, e.g. ?limit=10)
    const url = new URL(request.url)
    const limitParam = url.searchParams.get('limit')
    let limit: number | null = limitParam ? parseInt(limitParam, 10) : null

    // Also support JSON body if provided
    try {
      const body = await request.json().catch(() => null)
      if (body?.limit && typeof body.limit === 'number') {
        limit = body.limit
      }
    } catch {
      // Body is optional
    }

    // 4. Fetch and parse RSS Feed
    const { channelImage, episodes } = await fetchAndParseRssFeed()

    let targetEpisodes = episodes
    if (limit && limit > 0) {
      targetEpisodes = episodes.slice(0, limit)
    }

    // 5. Batch Upsert into rss_episodes (chunk size: 50)
    const CHUNK_SIZE = 50
    let processedCount = 0
    let errorCount = 0

    const contentStatusBreakdown: Record<string, number> = {
      full: 0,
      partial: 0,
      external: 0,
      missing: 0,
    }

    for (let i = 0; i < targetEpisodes.length; i += CHUNK_SIZE) {
      const chunk = targetEpisodes.slice(i, i + CHUNK_SIZE)

      const payload = chunk.map((ep: ParsedEpisode) => {
        contentStatusBreakdown[ep.content_status] =
          (contentStatusBreakdown[ep.content_status] || 0) + 1

        return {
          guid: ep.guid,
          title: ep.title,
          pub_date: ep.pub_date,
          duration_seconds: ep.duration_seconds,
          audio_url: ep.audio_url,
          channel_image_url: ep.channel_image_url || channelImage,
          extracted_sender: ep.extracted_sender,
          source_doc_url: ep.source_doc_url,
          raw_confession: ep.raw_confession,
          raw_description_html: ep.raw_description_html,
          content_status: ep.content_status,
          synced_at: new Date().toISOString(),
        }
      })

      // Retry mechanism for transient network or DB glitches
      let chunkSuccess = false
      let lastChunkErr: string | null = null

      for (let attempt = 1; attempt <= 3; attempt++) {
        const { error: upsertErr } = await adminClient
          .from('rss_episodes')
          .upsert(payload, {
            onConflict: 'guid',
            ignoreDuplicates: false,
          })

        if (!upsertErr) {
          chunkSuccess = true
          processedCount += chunk.length
          break
        }

        lastChunkErr = upsertErr.message
        // Exponential backoff wait
        await new Promise((res) => setTimeout(res, 500 * Math.pow(2, attempt)))
      }

      if (!chunkSuccess) {
        errorCount += chunk.length
        console.error(`Failed to upsert chunk starting at index ${i}:`, lastChunkErr)
      }
    }

    const durationMs = Date.now() - startTime

    // 6. Update sync_logs
    if (syncLogId) {
      await adminClient
        .from('sync_logs')
        .update({
          status: errorCount === 0 ? 'completed' : 'failed',
          finished_at: new Date().toISOString(),
          total_items: targetEpisodes.length,
          inserted_items: processedCount,
          updated_items: 0,
          error_message: errorCount > 0 ? `Failed items count: ${errorCount}` : null,
        })
        .eq('id', syncLogId)
    }

    // 7. Release sync lock
    let lockReleaseWarning: string | null = null
    const { data: lockReleased, error: lockReleaseErr } = await adminClient.rpc(
      'release_sync_lock',
      {
        p_worker_id: workerId,
        p_status: errorCount === 0 ? 'completed' : 'failed',
        p_error: errorCount > 0 ? `Errors in ${errorCount} items` : null,
      }
    )

    if (lockReleaseErr || !lockReleased) {
      lockReleaseWarning =
        lockReleaseErr?.message ||
        'Lock was not owned or already expired/released by another worker'
      console.error('[RSS Sync] Failed to release sync lock:', lockReleaseWarning)
    }

    // Return sample of imported data (first 3)
    const samples = targetEpisodes.slice(0, 3).map((e) => ({
      guid: e.guid,
      title: e.title,
      pub_date: e.pub_date,
      duration_seconds: e.duration_seconds,
      audio_url: e.audio_url,
      extracted_sender: e.extracted_sender,
      source_doc_url: e.source_doc_url,
      content_status: e.content_status,
      confession_length: e.raw_confession.length,
      confession_preview: e.raw_confession.slice(0, 160),
    }))

    // Return non-2xx status code on failure so schedulers / cron can retry
    if (errorCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Sync finished with errors: ${errorCount} items failed to upsert out of ${targetEpisodes.length}.`,
          lockReleaseWarning,
          mode: limit ? `test_batch_${limit}` : 'full_sync',
          totalFeedEpisodes: episodes.length,
          processedCount,
          errorCount,
          durationMs,
          contentStatusBreakdown,
          samples,
        },
        { status: 500 }
      )
    }

    if (lockReleaseWarning) {
      return NextResponse.json(
        {
          success: false,
          error: `Sync upsert succeeded but failed to release sync lock: ${lockReleaseWarning}`,
          mode: limit ? `test_batch_${limit}` : 'full_sync',
          totalFeedEpisodes: episodes.length,
          processedCount,
          errorCount: 0,
          durationMs,
          contentStatusBreakdown,
          samples,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      mode: limit ? `test_batch_${limit}` : 'full_sync',
      totalFeedEpisodes: episodes.length,
      processedCount,
      errorCount: 0,
      durationMs,
      contentStatusBreakdown,
      samples,
    })
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Unknown sync error'

    // Attempt release lock on failure
    try {
      const { error: lockErr } = await adminClient.rpc('release_sync_lock', {
        p_worker_id: workerId,
        p_status: 'failed',
        p_error: errMsg,
      })
      if (lockErr) {
        console.error('[RSS Sync] Failed to release lock in catch handler:', lockErr.message)
      }
    } catch (e) {
      console.error('[RSS Sync] Exception releasing lock in catch handler:', e)
    }

    if (syncLogId) {
      try {
        await adminClient
          .from('sync_logs')
          .update({
            status: 'failed',
            finished_at: new Date().toISOString(),
            error_message: errMsg,
          })
          .eq('id', syncLogId)
      } catch (e) {
        console.error('[RSS Sync] Exception updating sync_logs in catch handler:', e)
      }
    }

    return NextResponse.json({ success: false, error: errMsg }, { status: 500 })
  }
}
