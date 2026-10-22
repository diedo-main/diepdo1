import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { mapDbToStory, removeVietnameseTones } from '@/lib/stories'

export const dynamic = 'force-dynamic'

const ALLOWED_SORT_FIELDS = [
  'pub_date',
  'title',
  'extracted_sender',
  'duration_seconds',
  'content_status',
  'source',
  'id',
  'guid',
]

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 1. Check authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        {
          error: 'Yêu cầu đăng nhập tài khoản Owner để truy cập kho lưu trữ.',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      )
    }

    // 2. Verify owner status via RLS-defined RPC
    const { data: isOwner } = await supabase.rpc('is_owner')
    if (!isOwner) {
      return NextResponse.json(
        {
          error: 'Tài khoản không có quyền truy cập kho lưu trữ cá nhân này.',
          code: 'FORBIDDEN',
        },
        { status: 403 }
      )
    }

    // 3. Parse query parameters
    const { searchParams } = new URL(request.url)
    const rawQuery = (searchParams.get('q') || '').trim()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const from = (page - 1) * limit
    const to = from + limit - 1

    // Whitelisted sort parameters
    const rawSortBy = (searchParams.get('sortBy') || 'pub_date').toLowerCase()
    const sortBy = ALLOWED_SORT_FIELDS.includes(rawSortBy) ? rawSortBy : 'pub_date'
    const sortOrder = searchParams.get('sortOrder')?.toLowerCase() === 'asc' ? 'asc' : 'desc'

    // Filter parameters
    const statusParam = searchParams.get('status')
    const status =
      statusParam && ['full', 'partial', 'external', 'missing'].includes(statusParam)
        ? statusParam
        : null
    const tag = searchParams.get('tag') || null
    const hasNotesParam = searchParams.get('hasNotes')
    const hasNotes =
      hasNotesParam === 'true' ? true : hasNotesParam === 'false' ? false : null

    // 4. Primary: Attempt RPC search_archive_stories_v05
    const { data: rpcRows, error: rpcErr } = await supabase.rpc(
      'search_archive_stories_v05',
      {
        p_query: rawQuery,
        p_status: status,
        p_tag: tag,
        p_has_notes: hasNotes,
        p_sort_by: sortBy,
        p_sort_order: sortOrder,
        p_limit: limit,
        p_offset: from,
      }
    )

    if (!rpcErr && rpcRows && Array.isArray(rpcRows)) {
      const total = rpcRows.length > 0 ? Number(rpcRows[0].total_count) : 0
      const stories = rpcRows.map((r: any) =>
        mapDbToStory({
          ...r,
          notes_count: Number(r.notes_count || 0),
          has_notes: Boolean(r.has_notes),
        })
      )

      return NextResponse.json({
        stories,
        total,
        page,
        limit,
        hasMore: from + stories.length < total,
      })
    }

    // 5. Fallback: Query Builder if RPC is not yet deployed in database
    const normalizedQuery = removeVietnameseTones(rawQuery)

    let baseQuery = supabase.from('rss_episodes').select('id', { count: 'exact' })

    if (normalizedQuery) {
      baseQuery = baseQuery.ilike('search_text', `%${normalizedQuery}%`)
    }

    if (status) {
      baseQuery = baseQuery.eq('content_status', status)
    }

    const sortColumn =
      sortBy === 'id' ? 'guid' : sortBy === 'source' ? 'source_doc_url' : sortBy
    const {
      data: idRows,
      count,
      error: searchErr,
    } = await baseQuery
      .order(sortColumn, { ascending: sortOrder === 'asc' })
      .range(from, to)

    if (searchErr) {
      return NextResponse.json(
        { error: `Lỗi truy vấn tìm kiếm: ${searchErr.message}` },
        { status: 500 }
      )
    }

    const total = count || 0
    if (!idRows || idRows.length === 0) {
      return NextResponse.json({
        stories: [],
        total,
        page,
        limit,
        hasMore: false,
      })
    }

    const ids = idRows.map((r) => r.id)

    // Stage 2: Fetch rich summary cards from v_stories
    const { data: storyRows, error: storiesErr } = await supabase
      .from('v_stories')
      .select(
        'id, guid, pub_date, duration_seconds, audio_url, source_doc_url, extracted_sender, content_status, title, image_url, excerpt, tags'
      )
      .in('id', ids)

    if (storiesErr) {
      return NextResponse.json(
        { error: `Lỗi truy vấn chi tiết danh sách: ${storiesErr.message}` },
        { status: 500 }
      )
    }

    // Preserve exact sort order from stage 1
    const storyMap = new Map((storyRows || []).map((s) => [s.id, s]))
    const orderedStories = ids
      .map((id) => storyMap.get(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .map(mapDbToStory)

    return NextResponse.json({
      stories: orderedStories,
      total,
      page,
      limit,
      hasMore: from + orderedStories.length < total,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
