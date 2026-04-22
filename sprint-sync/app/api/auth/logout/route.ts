import { NextRequest, NextResponse } from 'next/server'
import { logout } from '@/lib/auth/service'
import { createServerClient } from '@/lib/supabase/server'

/**
 * POST /api/auth/logout
 *
 * Route Handler for user logout. Verifies that the caller has an active
 * session before invalidating it. Returns 401 if the request is
 * unauthenticated.
 *
 * Request body: (none required)
 *
 * Responses:
 *   200 — { data: { message: string } }
 *   401 — { error: { code: 'UNAUTHORIZED', message: string } }
 *   500 — { error: { code: 'UNKNOWN', message: string } }
 *
 * Session cookies are cleared by the Supabase SSR client inside `logout()`.
 * No session data is ever returned in the response body (Requirement 9.3).
 *
 * Validates: Requirements 4.5, 4.6, 9.2, 9.3, 9.4
 */
export async function POST(_request: NextRequest) {
  try {
    // Verify the caller is authenticated before performing any mutation.
    // Uses the Supabase server client so the session is read from SSR cookies.
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'You must be logged in to log out.',
          },
        },
        { status: 401 }
      )
    }

    // Delegate to Auth_Service — invalidates the Supabase Auth session and
    // clears all session cookies via @supabase/ssr.
    await logout()

    return NextResponse.json(
      {
        data: {
          message: 'Logged out successfully.',
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      {
        error: {
          code: 'UNKNOWN',
          message: 'An unexpected error occurred. Please try again.',
        },
      },
      { status: 500 }
    )
  }
}
