import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({
        authenticated: false,
        user: null,
        isOwner: false,
      })
    }

    // Check if the current user is the registered owner
    const { data: isOwner } = await supabase.rpc('is_owner')

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
      },
      isOwner: Boolean(isOwner),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { authenticated: false, user: null, isOwner: false, error: message },
      { status: 500 }
    )
  }
}

