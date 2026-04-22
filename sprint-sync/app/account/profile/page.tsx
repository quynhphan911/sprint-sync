import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth/service'
import { ProfileForm } from '@/components/account/ProfileForm'
import { AvatarUpload } from '@/components/account/AvatarUpload'

/**
 * Profile_Page — Server Component wrapper.
 *
 * Fetches the authenticated user's profile server-side and passes it down to
 * the ProfileForm and AvatarUpload client components. The page lives under the
 * (protected) layout which already validates the session; the redirect here is
 * a belt-and-suspenders guard in case this page is ever rendered outside that
 * layout.
 *
 * Validates: Requirements 5.1, 5.8
 */
export default async function ProfilePage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  const profileResult = await getProfile(user.id)

  // If the profile fetch fails, fall back to a minimal object so the page
  // still renders rather than crashing — the form will show empty fields.
  const profile =
    'error' in profileResult
      ? { id: user.id, display_name: '', avatar_url: null, created_at: '' }
      : profileResult

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">My Profile</h1>
          <p className="mt-1 text-sm text-gray-500">
            Update your display name and profile picture.
          </p>
        </div>

        {/* Profile card */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* Avatar section */}
          <div className="border-b border-gray-200 px-6 py-6">
            <h2 className="mb-4 text-sm font-medium text-gray-700">Profile picture</h2>
            <AvatarUpload
              userId={user.id}
              currentAvatarUrl={profile.avatar_url}
              displayName={profile.display_name}
            />
          </div>

          {/* Profile form section */}
          <div className="px-6 py-6">
            <h2 className="mb-4 text-sm font-medium text-gray-700">Display name</h2>
            <ProfileForm profile={profile} userId={user.id} />
          </div>
        </div>
      </div>
    </div>
  )
}
