import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

async function resolveEpisodeUuid(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string
): Promise<string | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  if (isUuid) return id

  const { data } = await supabase
    .from('rss_episodes')
    .select('id')
    .eq('guid', id)
    .single()
  return data?.id || null
}

/**
 * GET: Fetch tags linked to a story for the authenticated Owner.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Thiếu mã định danh câu chuyện.' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Yêu cầu đăng nhập tài khoản Owner.' },
        { status: 401 }
      )
    }

    const { data: isOwner } = await supabase.rpc('is_owner')
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Tài khoản không có quyền truy cập.' },
        { status: 403 }
      )
    }

    const episodeId = await resolveEpisodeUuid(supabase, id)
    if (!episodeId) {
      return NextResponse.json({ error: 'Không tìm thấy câu chuyện.' }, { status: 404 })
    }

    // 1. Fetch linked tag_ids from story_tags
    const { data: storyTags, error: storyTagsErr } = await supabase
      .from('story_tags')
      .select('tag_id')
      .eq('episode_id', episodeId)
      .eq('user_id', user.id)

    if (storyTagsErr) {
      return NextResponse.json({ error: storyTagsErr.message }, { status: 500 })
    }

    if (!storyTags || storyTags.length === 0) {
      return NextResponse.json({ tags: [] })
    }

    // 2. Fetch tag records from tags table
    const tagIds = storyTags.map((st) => st.tag_id)
    const { data: tags, error: tagsErr } = await supabase
      .from('tags')
      .select('id, name')
      .in('id', tagIds)
      .eq('user_id', user.id)
      .order('name', { ascending: true })

    if (tagsErr) {
      return NextResponse.json({ error: tagsErr.message }, { status: 500 })
    }

    return NextResponse.json({ tags: tags || [] })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST: Add tag to story. Creates tag if new, then creates link in story_tags.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Thiếu mã định danh câu chuyện.' }, { status: 400 })
    }

    const body = await request.json()
    const rawTagName = typeof body.name === 'string' ? body.name.trim() : ''

    if (!rawTagName) {
      return NextResponse.json({ error: 'Tên thẻ không được để trống.' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Yêu cầu đăng nhập tài khoản Owner.' },
        { status: 401 }
      )
    }

    const { data: isOwner } = await supabase.rpc('is_owner')
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Tài khoản không có quyền truy cập.' },
        { status: 403 }
      )
    }

    const episodeId = await resolveEpisodeUuid(supabase, id)
    if (!episodeId) {
      return NextResponse.json({ error: 'Không tìm thấy câu chuyện.' }, { status: 404 })
    }

    // 1. Find or create tag in tags table
    let tagId: number | null = null
    const { data: existingTag } = await supabase
      .from('tags')
      .select('id, name')
      .eq('name', rawTagName)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingTag) {
      tagId = existingTag.id
    } else {
      const { data: newTag, error: tagCreateErr } = await supabase
        .from('tags')
        .insert({ name: rawTagName, user_id: user.id })
        .select('id, name')
        .single()

      if (tagCreateErr || !newTag) {
        return NextResponse.json(
          { error: `Không thể tạo thẻ mới: ${tagCreateErr?.message}` },
          { status: 500 }
        )
      }
      tagId = newTag.id
    }

    // 2. Link in story_tags
    const { error: linkErr } = await supabase
      .from('story_tags')
      .upsert({
        episode_id: episodeId,
        tag_id: tagId,
        user_id: user.id,
      })

    if (linkErr) {
      return NextResponse.json(
        { error: `Không thể gắn thẻ vào câu chuyện: ${linkErr.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      tag: { id: tagId, name: rawTagName },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

