import { NextRequest, NextResponse } from 'next/server'
import { loginWithEmail } from '@/lib/auth/service'

/**
 * POST /api/auth/login
 *
 * Route Handler for email/password login. Accepts email and password in the
 * request body, validates that both fields are non-empty, delegates to
 * Auth_Service for credential verification, and establishes a session via
 * Supabase SSR cookies.
 *
 * Request body: { email: string; password: string }
 *
 * Responses:
 *   200 — { data: { id: string; email: string } }
 *   400 — { error: { code, message } }  (validation failure — empty fields)
 *   401 — { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }
 *   500 — { error: { code: 'UNKNOWN', message } }
 *
 * The session is established via Supabase SSR cookies automatically — it is
 * never returned in the response body to avoid exposing session secrets.
 *
 * The 401 error message is always generic ("Invalid email or password") and
 * never indicates which field is incorrect, preventing user enumeration.
 *
 * Validates: Requirements 2.1, 2.2, 2.4, 2.5, 9.2, 9.3
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    // Validate that both required fields are present and non-empty before
    // calling the service. Returns 400 for missing/empty fields.
    if (!email || !password) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Email and password are required.',
          },
        },
        { status: 400 }
      )
    }

    // Delegate to Auth_Service — handles Supabase Auth credential verification
    // and session cookie setup via @supabase/ssr.
    const result = await loginWithEmail(email, password)

    if ('error' in result) {
      // Map AuthErrorCode to the appropriate HTTP status code.
      // INVALID_CREDENTIALS always returns 401 with a generic message to
      // prevent user enumeration (Requirement 2.5).
      let statusCode: number
      switch (result.error.code) {
        case 'INVALID_CREDENTIALS':
          return NextResponse.json(
            {
              error: {
                code: 'INVALID_CREDENTIALS',
                message: 'Invalid email or password',
              },
            },
            { status: 401 }
          )
        case 'INVALID_EMAIL':
          statusCode = 400
          break
        default:
          statusCode = 500
      }

      return NextResponse.json({ error: result.error }, { status: statusCode })
    }

    // Success — return only the safe user identity; never expose the session
    // object or any auth tokens in the response body (Requirement 9.3).
    // The Supabase SSR client has already written the session cookies.
    return NextResponse.json(
      {
        data: {
          id: result.user.id,
          email: result.user.email,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Login error:', error)
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
