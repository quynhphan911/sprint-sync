import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * GET /auth/callback
 *
 * Handles the OAuth callback from Supabase Auth after Google SSO.
 * Exchanges the authorization code for a session and redirects to the
 * appropriate page (either the originally requested URL or /teams).
 *
 * This route is called by Supabase after the user completes the Google
 * OAuth consent flow.
 *
 * Validates: Requirements 3.2, 3.3, 3.4, 3.5
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')

  // Handle OAuth errors (user cancelled, etc.)
  if (error) {
    const errorMessage = errorDescription || 'Authentication failed'
    return NextResponse.redirect(
      `${requestUrl.origin}/auth?error=${encodeURIComponent(errorMessage)}`
    )
  }

  // Exchange code for session
  if (code) {
    const supabase = createServerClient()
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      return NextResponse.redirect(
        `${requestUrl.origin}/auth?error=${encodeURIComponent('Failed to complete sign-in. Please try again.')}`
      )
    }

    // Check if this is a new user (profile doesn't exist yet)
    if (data.user) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .single()

      // If profile doesn't exist, create it using Google user metadata
      if (profileError || !profile) {
        const displayName =
          data.user.user_metadata?.full_name ||
          data.user.user_metadata?.name ||
          data.user.email?.split('@')[0] ||
          'User'

        const avatarUrl = data.user.user_metadata?.avatar_url || null

        await supabase.from('profiles').insert({
          id: data.user.id,
          display_name: displayName,
          avatar_url: avatarUrl,
        })
      }
    }

    // Redirect to the originally requested page or /teams
    const redirectTo = requestUrl.searchParams.get('redirect') || '/teams'
    return NextResponse.redirect(`${requestUrl.origin}${redirectTo}`)
  }

  // No code or error — redirect to auth page
  return NextResponse.redirect(`${requestUrl.origin}/auth`)
}
