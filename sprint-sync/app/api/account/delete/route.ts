import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { deleteAccount } from '@/lib/auth/service'

/**
 * DELETE /api/account/delete
 *
 * Route Handler for permanently deleting the authenticated user's account.
 * Cascades to remove the profiles record and nullify author_id / assignee_id
 * on retro_cards and action_items respectively.
 *
 * Authentication: Required — returns 401 if no valid session exists.
 *
 * Responses:
 *   200 — { data: { message: string } }
 *   401 — { error: { code: 'UNAUTHORIZED', message } }  (not authenticated)
 *   500 — { error: { code: 'UNKNOWN', message } }
 *
 * Validates: Requirements 8.3, 8.4, 8.5, 8.6, 8.7, 9.4
 */
export async function DELETE() {
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

    // Delegate to Auth_Service for account deletion
    const result = await deleteAccount(user.id)

    if (result && 'error' in result) {
      const statusCode = result.error.code === 'UNAUTHORIZED' ? 401 : 500
      return NextResponse.json({ error: result.error }, { status: statusCode })
    }

    return NextResponse.json(
      { data: { message: 'Account deleted successfully.' } },
      { status: 200 }
    )
  } catch (error) {
    console.error('Account deletion error:', error)
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
