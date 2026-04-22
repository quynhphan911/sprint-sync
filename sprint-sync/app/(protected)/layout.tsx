import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth/service'
import { NavHeader } from '@/components/shared/NavHeader'

/**
 * Protected layout — Server Component.
 *
 * Validates the user's session server-side on every render. If no valid
 * session exists the user is redirected to /auth. Fetches the user's profile
 * and passes it to NavHeader so the header can display the avatar and display
 * name without an additional client-side fetch.
 *
 * Validates: Requirements 4.1, 4.2, 4.4, 4.7
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerClient()

  // Validate session server-side — getUser() verifies the JWT with Supabase
  // Auth rather than trusting the cookie value alone.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  // Fetch the user's profile for the navigation header.
  // On error (e.g. profile not yet created) fall back to a minimal object so
  // the layout still renders rather than crashing.
  const profileResult = await getProfile(user.id)
  const profile =
    'error' in profileResult
      ? { id: user.id, display_name: user.email ?? 'User', avatar_url: null, created_at: '' }
      : profileResult

  return (
    <div className="min-h-screen bg-gray-50">
      <NavHeader user={{ id: user.id, email: user.email ?? '' }} profile={profile} />
      <main>{children}</main>
    </div>
  )
}
