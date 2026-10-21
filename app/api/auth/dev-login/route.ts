import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Generates an authenticated session for the registered Owner
 * using Supabase magiclink verification server-side.
 */
export async function POST() {
  try {
    const admin = createAdminClient()

    // 1. Get the registered owner user_id from app_owner
    const { data: ownerRow, error: ownerErr } = await admin
      .from('app_owner')
      .select('user_id')
      .eq('id', 1)
      .single()

    if (ownerErr || !ownerRow?.user_id) {
      return NextResponse.json(
        { error: 'Chưa có Owner nào được đăng ký trong bảng app_owner.' },
        { status: 400 }
      )
    }

    // 2. Lookup owner email
    const { data: userData, error: userErr } = await admin.auth.admin.getUserById(
      ownerRow.user_id
    )

    if (userErr || !userData?.user?.email) {
      return NextResponse.json(
        { error: 'Không tìm thấy tài khoản Owner tương ứng.' },
        { status: 404 }
      )
    }

    const ownerEmail = userData.user.email

    // 3. Generate magic link token for owner
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: ownerEmail,
    })

    if (linkErr || !linkData?.properties?.hashed_token) {
      return NextResponse.json(
        { error: 'Không thể tạo phiên đăng nhập Owner.' },
        { status: 500 }
      )
    }

    // 4. Verify OTP using SSR server client to establish session cookies
    const supabase = await createClient()
    const { data: sessionData, error: verifyErr } = await supabase.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'magiclink',
    })

    if (verifyErr || !sessionData?.user) {
      return NextResponse.json(
        { error: verifyErr ? verifyErr.message : 'Xác thực phiên thất bại.' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Đăng nhập tài khoản Owner thành công.',
      user: {
        id: sessionData.user.id,
        email: sessionData.user.email,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

