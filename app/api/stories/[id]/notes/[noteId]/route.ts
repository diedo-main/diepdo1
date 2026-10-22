import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { sanitizeHtml } from '@/lib/notes-format'
import { NoteRecord } from '@/types'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string; noteId: string }>
}

/**
 * PUT: Update an existing note by noteId.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, noteId } = await params
    const numericNoteId = parseInt(noteId, 10)

    if (!id || isNaN(numericNoteId)) {
      return NextResponse.json({ error: 'Mã ghi chú không hợp lệ.' }, { status: 400 })
    }

    const body = await request.json()
    const rawContent = typeof body.content === 'string' ? body.content : undefined
    const rawTitle = typeof body.title === 'string' ? body.title.trim() : undefined

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (rawContent !== undefined) {
      updatePayload.content = sanitizeHtml(rawContent)
    }

    if (rawTitle !== undefined) {
      updatePayload.title = rawTitle || 'Bài học'
    }

    const supabase = await createClient()

    // 1. Check authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Yêu cầu đăng nhập tài khoản Owner để sửa ghi chú.' },
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

    // 3. Update note respecting user_id and noteId
    const { data: updatedNote, error: updateErr } = await supabase
      .from('notes')
      .update(updatePayload)
      .eq('id', numericNoteId)
      .eq('user_id', user.id)
      .select('id, episode_id, user_id, title, content, created_at, updated_at')
      .single()

    if (updateErr || !updatedNote) {
      return NextResponse.json(
        { error: `Lỗi khi cập nhật ghi chú: ${updateErr?.message || 'Bản ghi không tồn tại'}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      note: updatedNote as NoteRecord,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * DELETE: Delete a note by noteId.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id, noteId } = await params
    const numericNoteId = parseInt(noteId, 10)

    if (!id || isNaN(numericNoteId)) {
      return NextResponse.json({ error: 'Mã ghi chú không hợp lệ.' }, { status: 400 })
    }

    const supabase = await createClient()

    // 1. Check authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Yêu cầu đăng nhập tài khoản Owner để xóa ghi chú.' },
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

    // 3. Delete note
    const { error: deleteErr } = await supabase
      .from('notes')
      .delete()
      .eq('id', numericNoteId)
      .eq('user_id', user.id)

    if (deleteErr) {
      return NextResponse.json(
        { error: `Lỗi khi xóa ghi chú: ${deleteErr.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      deletedId: numericNoteId,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

