import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { TagRecord } from '@/types'

export const dynamic = 'force-dynamic'

/**
 * GET: Fetch all tags created by the authenticated Owner.
 */
export async function GET(_request: NextRequest) {
  try {
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

    const { data: tags, error: tagsErr } = await supabase
      .from('tags')
      .select('id, name, created_at')
      .eq('user_id', user.id)
      .order('name', { ascending: true })

    if (tagsErr) {
      return NextResponse.json({ error: tagsErr.message }, { status: 500 })
    }

    return NextResponse.json({ tags: (tags || []) as TagRecord[] })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

