import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { uploadAvatar } from '@/lib/auth/service'
import { validateAvatarFile } from '@/lib/auth/validators'

/**
 * POST /api/account/avatar
 *
 * Route Handler for uploading the authenticated user's avatar image.
 * Accepts a multipart/form-data request with an `avatar` file field.
 *
 * Authentication: Required — returns 401 if no valid session exists.
 *
 * Request body: multipart/form-data with field `avatar` (File)
 *
 * Responses:
 *   200 — { data: { avatar_url: string } }
 *   400 — { error: { code, message } }  (missing file or validation failure)
 *   401 — { error: { code: 'UNAUTHORIZED', message } }  (not authenticated)
 *   500 — { error: { code: 'UNKNOWN', message } }
 *
 * Validates: Requirements 9.2, 9.4, 5.4, 5.5
 */
export async function POST(request: NextRequest) {
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

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('avatar')

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        {
          error: {
            code: 'AVATAR_INVALID_FORMAT',
            message: 'No avatar file provided.',
          },
        },
        { status: 400 }
      )
    }

    // Validate the file before uploading
    const validation = validateAvatarFile(file)
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: {
            code: file.size > 2 * 1024 * 1024 ? 'AVATAR_TOO_LARGE' : 'AVATAR_INVALID_FORMAT',
            message: validation.message,
          },
        },
        { status: 400 }
      )
    }

    // Delegate to Auth_Service for upload and profile update
    const result = await uploadAvatar(user.id, file)

    if (typeof result === 'object' && 'error' in result) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ data: { avatar_url: result } }, { status: 200 })
  } catch (error) {
    console.error('Avatar upload error:', error)
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
