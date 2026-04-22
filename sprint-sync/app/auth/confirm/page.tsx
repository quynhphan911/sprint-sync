import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

/**
 * Auth Confirm Page — Server Component
 *
 * Handles the Supabase auth callback URL after a password reset email link
 * is clicked. Exchanges the auth code for a session and redirects based on
 * the flow type:
 * - Password reset flow (type=recovery): Redirects to password reset completion form
 * - Regular auth flow: Redirects to /teams
 *
 * This page is rendered at /auth/confirm and is called by Supabase after the
 * user clicks the password reset link in their email.
 *
 * Validates: Requirements 7.5, 7.6, 7.8, 7.9
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const code = typeof params.code === 'string' ? params.code : null
  const error = typeof params.error === 'string' ? params.error : null
  const errorDescription =
    typeof params.error_description === 'string' ? params.error_description : null
  const type = typeof params.type === 'string' ? params.type : null

  // Handle errors from Supabase (expired link, invalid token, etc.)
  if (error) {
    const errorMessage = errorDescription || 'Authentication failed'
    redirect(`/auth/reset-password?error=${encodeURIComponent(errorMessage)}`)
  }

  // Exchange code for session
  if (code) {
    const supabase = createServerClient()
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      // If the code exchange fails, redirect to reset password page with error
      redirect(
        `/auth/reset-password?error=${encodeURIComponent('Password reset link has expired or is invalid. Please request a new one.')}`
      )
    }

    // Check if this is a password reset flow
    if (type === 'recovery') {
      // Redirect to password reset completion form
      // The session is now established, so the completion form can update the password
      redirect('/auth/reset-password/complete')
    }

    // For regular auth flows (e.g., email confirmation), redirect to teams
    redirect('/teams')
  }

  // No code or error — redirect to auth page
  redirect('/auth')
}
