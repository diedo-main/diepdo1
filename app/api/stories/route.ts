import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { mapDbToStory, removeVietnameseTones } from '@/lib/stories'

export const dynamic = 'force-dynamic'

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
    const rawQuery = searchParams.get('q') || ''
    const normalizedQuery = removeVietnameseTones(rawQuery)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const status = searchParams.get('status') // optional: 'full' | 'partial' | 'external' | 'missing'

    const from = (page - 1) * limit
    const to = from + limit - 1

    // 4. Stage 1: Fast ID retrieval & pagination using GIN Trigram index on search_text
    let baseQuery = supabase
      .from('rss_episodes')
      .select('id', { count: 'exact' })

    if (normalizedQuery) {
      baseQuery = baseQuery.ilike('search_text', `%${normalizedQuery}%`)
    }

    if (status && ['full', 'partial', 'external', 'missing'].includes(status)) {
      baseQuery = baseQuery.eq('content_status', status)
    }

    const {
      data: idRows,
      count,
      error: searchErr,
    } = await baseQuery
      .order('pub_date', { ascending: false })
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

    // 5. Stage 2: Fetch rich summary cards from v_stories
    // Note: confession_text is intentionally NOT selected here to conserve bandwidth
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

