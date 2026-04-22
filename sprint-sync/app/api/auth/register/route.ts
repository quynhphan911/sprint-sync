import { NextRequest, NextResponse } from 'next/server'
import { registerWithEmail } from '@/lib/auth/service'

/**
 * POST /api/auth/register
 *
 * Route Handler for user registration. Accepts email, password, and displayName
 * in the request body, validates inputs, creates a Supabase Auth user and
 * profiles record, and establishes a session via Supabase SSR cookies.
 *
 * Request body: { email: string; password: string; displayName: string }
 *
 * Responses:
 *   201 — { data: { id: string; email: string } }
 *   400 — { error: { code, message, field? } }  (validation failure)
 *   409 — { error: { code: 'EMAIL_ALREADY_EXISTS', message, field? } }
 *   500 — { error: { code: 'UNKNOWN', message } }
 *
 * The session is established via Supabase SSR cookies automatically — it is
 * never returned in the response body to avoid exposing session secrets.
 *
 * Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 9.2, 9.3
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[register] Starting registration...')
    const body = await request.json()
    console.log('[register] Body parsed:', { email: body.email, displayName: body.displayName })
    const { email, password, displayName } = body

    // Validate that all required fields are present before calling the service.
    // The service performs deeper validation (format, strength, length), but
    // this guard ensures we return a clear 400 for completely missing fields.
    if (!email || !password || !displayName) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_EMAIL',
            message: 'Email, password, and display name are required.',
          },
        },
        { status: 400 }
      )
    }

    // Delegate to Auth_Service — handles validation, Supabase Auth user
    // creation, profiles record insertion, and session cookie setup.
    console.log('[register] Calling registerWithEmail...')
    const result = await registerWithEmail(email, password, displayName)
    console.log('[register] registerWithEmail returned:', 'error' in result ? 'error' : 'success')

    if ('error' in result) {
      // Map AuthErrorCode to the appropriate HTTP status code.
      let statusCode: number
      switch (result.error.code) {
        case 'EMAIL_ALREADY_EXISTS':
          statusCode = 409
          break
        case 'INVALID_EMAIL':
        case 'WEAK_PASSWORD':
        case 'DISPLAY_NAME_INVALID':
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
      { status: 201 }
    )
  } catch (error) {
    console.error('Registration error:', error)
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
