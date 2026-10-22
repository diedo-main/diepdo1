import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { sanitizeHtml } from '@/lib/notes-format'
import { NoteRecord } from '@/types'

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
 * GET: Fetch all notes for a story belonging to the authenticated Owner.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Thiếu mã định danh câu chuyện.' }, { status: 400 })
    }

    const supabase = await createClient()

    // 1. Check authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Yêu cầu đăng nhập tài khoản Owner để xem ghi chú.' },
        { status: 401 }
      )
    }

    // 2. Check owner permission
    const { data: isOwner } = await supabase.rpc('is_owner')
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Tài khoản không có quyền truy cập kho lưu trữ cá nhân.' },
        { status: 403 }
      )
    }

    // 3. Resolve UUID
    const episodeId = await resolveEpisodeUuid(supabase, id)
    if (!episodeId) {
      return NextResponse.json({ error: 'Không tìm thấy câu chuyện tương ứng.' }, { status: 404 })
    }

    // 4. Query notes ordered by created_at ASC
    const { data: notes, error: notesErr } = await supabase
      .from('notes')
      .select('id, episode_id, user_id, title, content, created_at, updated_at')
      .eq('episode_id', episodeId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (notesErr) {
      return NextResponse.json(
        { error: `Lỗi khi tải ghi chú: ${notesErr.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ notes: (notes || []) as NoteRecord[] })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST: Create a new note for a story with idempotency support.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Thiếu mã định danh câu chuyện.' }, { status: 400 })
    }

    const body = await request.json()
    const rawContent = typeof body.content === 'string' ? body.content : ''
    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'Bài học'

    const cleanContent = sanitizeHtml(rawContent)

    const supabase = await createClient()

    // 1. Check authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Yêu cầu đăng nhập tài khoản Owner để tạo ghi chú.' },
        { status: 401 }
      )
    }

    // 2. Check owner permission
    const { data: isOwner } = await supabase.rpc('is_owner')
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Tài khoản không có quyền truy cập kho lưu trữ cá nhân.' },
        { status: 403 }
      )
    }

    // 3. Resolve UUID
    const episodeId = await resolveEpisodeUuid(supabase, id)
    if (!episodeId) {
      return NextResponse.json({ error: 'Không tìm thấy câu chuyện tương ứng.' }, { status: 404 })
    }

    // 4. Insert note into database
    const { data: newNote, error: insertErr } = await supabase
      .from('notes')
      .insert({
        episode_id: episodeId,
        user_id: user.id,
        title,
        content: cleanContent,
      })
      .select('id, episode_id, user_id, title, content, created_at, updated_at')
      .single()

    if (insertErr || !newNote) {
      return NextResponse.json(
        { error: `Lỗi khi tạo ghi chú: ${insertErr?.message || 'Không thể lưu bản ghi'}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      note: newNote as NoteRecord,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

