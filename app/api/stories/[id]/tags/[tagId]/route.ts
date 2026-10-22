import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string; tagId: string }>
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
 * DELETE: Remove tag link from a story.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id, tagId } = await params

    if (!id || !tagId) {
      return NextResponse.json({ error: 'Mã thẻ không hợp lệ.' }, { status: 400 })
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

    let numericTagId = parseInt(tagId, 10)
    if (isNaN(numericTagId)) {
      const decodedName = decodeURIComponent(tagId).trim()
      const { data: tagRow } = await supabase
        .from('tags')
        .select('id')
        .eq('name', decodedName)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!tagRow) {
        return NextResponse.json({ success: true, message: 'Thẻ không tồn tại.' })
      }
      numericTagId = tagRow.id
    }

    const { error: deleteErr } = await supabase
      .from('story_tags')
      .delete()
      .eq('episode_id', episodeId)
      .eq('tag_id', numericTagId)
      .eq('user_id', user.id)

    if (deleteErr) {
      return NextResponse.json(
        { error: `Lỗi khi gỡ thẻ: ${deleteErr.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      deletedTagId: numericTagId,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

