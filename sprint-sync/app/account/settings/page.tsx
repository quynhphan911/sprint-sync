import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { PasswordChangeForm } from '@/components/account/PasswordChangeForm'
import { DeleteAccountDialog } from '@/components/account/DeleteAccountDialog'

/**
 * Account_Settings_Page — Server Component wrapper.
 *
 * Fetches the authenticated user's metadata server-side to determine the auth
 * provider (email vs Google SSO). Passes provider, email, and userId down to
 * the PasswordChangeForm and DeleteAccountDialog client components.
 *
 * - PasswordChangeForm is hidden for Google-only users (Requirement 6.8).
 * - DeleteAccountDialog is always shown in the Danger Zone (Requirement 8.1).
 *
 * The page performs its own session guard (belt-and-suspenders) in case it is
 * ever rendered outside the (protected) layout.
 *
 * Validates: Requirements 6.1, 6.8, 8.1
 */
export default async function AccountSettingsPage() {
  const supabase = createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  // Determine the auth provider from the user's identities.
  // Supabase stores identity records in user.identities; a Google-authenticated
  // user will have an identity with provider === 'google'.
  const provider: 'email' | 'google' =
    user.identities?.some((identity) => identity.provider === 'google') ? 'google' : 'email'

  const userEmail = user.email ?? ''
  const userId = user.id

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Account Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your security settings and account preferences.
          </p>
        </div>

        <div className="space-y-6">
          {/* Security section — password change (hidden for Google SSO users) */}
          {provider !== 'google' && (
            <section aria-labelledby="security-heading">
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-200 px-6 py-4">
                  <h2
                    id="security-heading"
                    className="text-base font-medium text-gray-900"
                  >
                    Security
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Update your password to keep your account secure.
                  </p>
                </div>
                <div className="px-6 py-6">
                  <PasswordChangeForm userId={userId} />
                </div>
              </div>
            </section>
          )}

          {/* Danger Zone section — account deletion */}
          <section aria-labelledby="danger-zone-heading">
            <div className="rounded-xl border border-red-200 bg-white shadow-sm">
              <div className="border-b border-red-200 bg-red-50 px-6 py-4">
                <h2
                  id="danger-zone-heading"
                  className="text-base font-medium text-red-700"
                >
                  Danger Zone
                </h2>
                <p className="mt-1 text-sm text-red-600">
                  These actions are permanent and cannot be undone.
                </p>
              </div>
              <div className="px-6 py-6">
                <DeleteAccountDialog userId={userId} userEmail={userEmail} />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
