import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { changePassword } from '@/lib/auth/service'
import { validatePassword, validatePasswordsMatch } from '@/lib/auth/validators'

/**
 * PATCH /api/account/password
 *
 * Route Handler for changing the authenticated user's password. Accepts
 * `current_password`, `new_password`, and `confirm_new_password` in the
 * request body.
 *
 * Authentication: Required — returns 401 if no valid session exists.
 *
 * Request body: { current_password: string; new_password: string; confirm_new_password: string }
 *
 * Responses:
 *   200 — { data: { message: string } }
 *   400 — { error: { code, message, field? } }  (validation failure)
 *   401 — { error: { code: 'UNAUTHORIZED', message } }  (not authenticated or wrong current password)
 *   500 — { error: { code: 'UNKNOWN', message } }
 *
 * Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6, 9.4
 */
export async function PATCH(request: NextRequest) {
  try {
    // Verify the user is authenticated via Supabase SSR session
    const supabase = createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required.',
          },
        },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { current_password, new_password, confirm_new_password } = body

    // Validate current_password is non-empty
    if (!current_password || String(current_password).trim().length === 0) {
      return NextResponse.json(
        {
          error: {
            code: 'WEAK_PASSWORD',
            message: 'Current password is required.',
            field: 'current_password',
          },
        },
        { status: 400 }
      )
    }

    // Validate new_password meets password criteria
    const passwordValidation = validatePassword(new_password ?? '')
    if (!passwordValidation.valid) {
      return NextResponse.json(
        {
          error: {
            code: 'WEAK_PASSWORD',
            message: passwordValidation.message,
            field: 'new_password',
          },
        },
        { status: 400 }
      )
    }

    // Validate confirm_new_password matches new_password
    const matchValidation = validatePasswordsMatch(new_password ?? '', confirm_new_password ?? '')
    if (!matchValidation.valid) {
      return NextResponse.json(
        {
          error: {
            code: 'PASSWORD_MISMATCH',
            message: matchValidation.message,
            field: 'confirm_new_password',
          },
        },
        { status: 400 }
      )
    }

    // Delegate to Auth_Service for re-authentication and password update
    const result = await changePassword(user.id, current_password, new_password)

    if (result && 'error' in result) {
      // Wrong current password — return 401 with generic message to prevent enumeration
      if (result.error.code === 'WRONG_CURRENT_PASSWORD') {
        return NextResponse.json(
          {
            error: {
              code: 'WRONG_CURRENT_PASSWORD',
              message: 'Invalid email or password.',
            },
          },
          { status: 401 }
        )
      }

      // Other service errors (e.g. UNAUTHORIZED, UNKNOWN)
      const statusCode = result.error.code === 'UNAUTHORIZED' ? 401 : 500
      return NextResponse.json({ error: result.error }, { status: statusCode })
    }

    return NextResponse.json(
      { data: { message: 'Password changed successfully.' } },
      { status: 200 }
    )
  } catch (error) {
    console.error('Password change error:', error)
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
