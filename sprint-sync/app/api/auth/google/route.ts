import { NextRequest, NextResponse } from 'next/server'
import { initiateGoogleSSO } from '@/lib/auth/service'

/**
 * POST /api/auth/google
 *
 * Initiates the Google OAuth flow via Supabase Auth.
 * Returns the OAuth redirect URL on success, or an AuthError on failure.
 *
 * Validates: Requirements 3.1, 3.2, 3.6
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { redirectTo } = body

    const result = await initiateGoogleSSO()

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ url: result.url }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'UNKNOWN',
          message: 'Failed to initiate Google sign-in. Please try again.',
        },
      },
      { status: 500 }
    )
  }
}
