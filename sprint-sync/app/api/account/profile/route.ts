import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { updateProfile } from '@/lib/auth/service'
import { validateDisplayName } from '@/lib/auth/validators'

/**
 * PATCH /api/account/profile
 *
 * Route Handler for updating the authenticated user's profile. Accepts an
 * optional `userId`, `display_name`, and `avatar_url` in the request body.
 *
 * Authentication: Required — returns 401 if no valid session exists.
 * Ownership: The `userId` in the request body (if provided) must match the
 *   authenticated user's ID — returns 403 if there is a mismatch.
 *
 * Request body: { userId?: string; display_name?: string; avatar_url?: string }
 *
 * Responses:
 *   200 — { data: Profile }
 *   400 — { error: { code, message, field? } }  (validation failure)
 *   401 — { error: { code: 'UNAUTHORIZED', message } }  (not authenticated)
 *   403 — { error: { code: 'FORBIDDEN', message } }  (userId mismatch)
 *   500 — { error: { code: 'UNKNOWN', message } }
 *
 * Validates: Requirements 9.2, 9.4, 9.5, 5.2, 5.3
 */
export async function PATCH(request: NextRequest) {
  try {
    // Verify the user is authenticated via Supabase SSR session
    const supabase = createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

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
    const { userId, display_name, avatar_url } = body

    // Validate ownership: if userId is provided, it must match the authenticated user
    if (userId !== undefined && userId !== user.id) {
      return NextResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'You are not authorised to update this profile.',
          },
        },
        { status: 403 }
      )
    }

    // Use the authenticated user's ID as the target (userId is optional)
    const targetUserId = user.id

    // Validate display_name if provided
    if (display_name !== undefined) {
      const validation = validateDisplayName(display_name)
      if (!validation.valid) {
        return NextResponse.json(
          {
            error: {
              code: 'DISPLAY_NAME_INVALID',
              message: validation.message,
              field: 'display_name',
            },
          },
          { status: 400 }
        )
      }
    }

    // Build the update payload — only include fields that were provided
    const updateData: { display_name?: string; avatar_url?: string } = {}
    if (display_name !== undefined) {
      updateData.display_name = display_name
    }
    if (avatar_url !== undefined) {
      updateData.avatar_url = avatar_url
    }

    // Delegate to Auth_Service for the actual profile update
    const result = await updateProfile(targetUserId, updateData)

    if ('error' in result) {
      const statusCode = result.error.code === 'DISPLAY_NAME_INVALID' ? 400 : 500
      return NextResponse.json({ error: result.error }, { status: statusCode })
    }

    return NextResponse.json({ data: result }, { status: 200 })
  } catch (error) {
    console.error('Profile update error:', error)
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
