import { NextRequest, NextResponse } from 'next/server'
import { requestPasswordReset } from '@/lib/auth/service'

/**
 * POST /api/auth/reset-password
 *
 * Route Handler for password reset requests. Accepts an email address in the
 * request body and triggers Supabase Auth to send a password reset email.
 *
 * Always returns success to prevent email enumeration, regardless of whether
 * the email address is associated with an existing account.
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    // Validate required field
    if (!email) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_EMAIL',
            message: 'Email is required.',
            field: 'email',
          },
        },
        { status: 400 }
      )
    }

    // Call Auth_Service to request password reset
    const result = await requestPasswordReset(email)

    if (result && 'error' in result) {
      // Only validation errors are returned (email format)
      const statusCode = result.error.code === 'INVALID_EMAIL' ? 400 : 500

      return NextResponse.json({ error: result.error }, { status: statusCode })
    }

    // Always return success (Requirement 7.4)
    // This prevents email enumeration by not revealing whether the email exists
    return NextResponse.json(
      {
        message: 'If an account exists with this email, a reset link has been sent.',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Password reset request error:', error)
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
