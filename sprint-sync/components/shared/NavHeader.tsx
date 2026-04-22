'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { LogOut } from 'lucide-react'
import { logout } from '@/lib/auth/service'
import type { Profile } from '@/types/auth'

/**
 * NavHeader — Client Component.
 *
 * Displays the authenticated user's avatar and display name in the top
 * navigation bar, and provides a logout button that calls the Auth_Service
 * logout action, shows a toast notification, then redirects to /auth.
 *
 * Validates: Requirements 4.5, 4.6, 4.7, 10.3
 */

interface NavHeaderProps {
  user: { id: string; email: string }
  profile: Profile
}

/**
 * Derive up-to-two-character initials from a display name.
 * Falls back to the first character of the email if display name is empty.
 */
function getInitials(displayName: string, email: string): string {
  const name = displayName.trim() || email
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.charAt(0).toUpperCase()
}

export function NavHeader({ user, profile }: NavHeaderProps) {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  async function handleLogout() {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await logout()
      toast.success('You have been logged out successfully.')
      router.push('/auth')
      router.refresh()
    } catch {
      toast.error('Logout failed. Please try again.')
      setIsLoggingOut(false)
    }
  }

  const initials = getInitials(profile.display_name, user.email)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <span className="text-base font-semibold tracking-tight text-gray-900">SprintSync</span>

        {/* User info + logout */}
        <div className="flex items-center gap-3">
          {/* Avatar */}
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt={profile.display_name}
              className="h-8 w-8 rounded-full object-cover ring-1 ring-gray-200"
            />
          ) : (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200"
              aria-hidden="true"
            >
              {initials}
            </div>
          )}

          {/* Display name — hidden on very small screens */}
          <span className="hidden text-sm font-medium text-gray-700 sm:block">
            {profile.display_name}
          </span>

          {/* Logout button */}
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            aria-label="Log out"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{isLoggingOut ? 'Logging out…' : 'Log out'}</span>
          </button>
        </div>
      </div>
    </header>
  )
}
