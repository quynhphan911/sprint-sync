import { NextRequest, NextResponse } from 'next/server'
import { completePasswordReset } from '@/lib/auth/service'

/**
 * POST /api/auth/reset-password/complete
 *
 * Route Handler for password reset completion. Accepts a new password in the
 * request body and updates the user's credentials via Supabase Auth.
 *
 * The user must have a valid session established by the password reset flow
 * (via the /auth/confirm callback handler). If the session is invalid or expired,
 * returns an error.
 *
 * On success, the user's password is updated and they remain authenticated.
 * The client should redirect to /teams.
 *
 * Validates: Requirements 7.6, 7.7, 7.8, 7.9
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { newPassword } = body

    // Validate required field
    if (!newPassword) {
      return NextResponse.json(
        {
          error: {
            code: 'WEAK_PASSWORD',
            message: 'Password is required.',
            field: 'new_password',
          },
        },
        { status: 400 }
      )
    }

    // Call Auth_Service to complete password reset
    const result = await completePasswordReset(newPassword)

    if (result && 'error' in result) {
      // Map error codes to appropriate HTTP status codes
      let statusCode = 500

      switch (result.error.code) {
        case 'WEAK_PASSWORD':
          statusCode = 400
          break
        case 'RESET_LINK_EXPIRED':
          statusCode = 401
          break
        case 'UNAUTHORIZED':
          statusCode = 401
          break
        default:
          statusCode = 500
      }

      return NextResponse.json({ error: result.error }, { status: statusCode })
    }

    // Success — password has been reset
    return NextResponse.json(
      {
        message: 'Password has been reset successfully.',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Password reset completion error:', error)
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
