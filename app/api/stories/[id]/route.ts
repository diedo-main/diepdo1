import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { mapDbToStory } from '@/lib/stories'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

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
        {
          error: 'Yêu cầu đăng nhập tài khoản Owner để xem chi tiết.',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      )
    }

    // 2. Verify owner status
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

    // 3. Query story details from v_stories (supports UUID id or Buzzsprout guid)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

    let query = supabase.from('v_stories').select('*')
    if (isUuid) {
      query = query.eq('id', id)
    } else {
      query = query.eq('guid', id)
    }

    const { data: storyRow, error: storyErr } = await query.single()

    if (storyErr || !storyRow) {
      return NextResponse.json(
        { error: 'Không tìm thấy câu chuyện yêu cầu.' },
        { status: 404 }
      )
    }

    const story = mapDbToStory(storyRow)

    return NextResponse.json({ story })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

