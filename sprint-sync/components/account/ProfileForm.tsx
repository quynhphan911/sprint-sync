'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { validateDisplayName } from '@/lib/auth/validators'
import type { Profile } from '@/types/auth'

interface ProfileFormProps {
  profile: Profile
  userId: string
}

/**
 * ProfileForm — Client Component for editing the user's display name.
 *
 * Pre-populates the display_name field with the current profile value.
 * Performs client-side validation via validateDisplayName before submitting.
 * On success, shows a toast notification confirming the change.
 * On error, displays a descriptive error message and retains the entered data.
 * While a request is in progress, the submit button is disabled and shows a
 * loading indicator.
 *
 * Validates: Requirements 5.2, 5.3, 5.6, 5.7, 10.4
 */
export function ProfileForm({ profile, userId }: ProfileFormProps) {
  const [displayName, setDisplayName] = useState(profile.display_name)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const displayNameInputId = 'profile-display-name'
  const displayNameErrorId = 'profile-display-name-error'

  function handleDisplayNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setDisplayName(value)
    // Clear errors as the user types
    if (fieldError) setFieldError(null)
    if (formError) setFormError(null)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    // Client-side validation before submission (Requirement 5.3)
    const validation = validateDisplayName(displayName)
    if (!validation.valid) {
      setFieldError(validation.message)
      return
    }

    setFieldError(null)
    setFormError(null)

    startTransition(async () => {
      try {
        const response = await fetch('/api/account/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, display_name: displayName }),
        })
        const result = await response.json()

        if (!response.ok) {
          if (result.error?.field === 'display_name') {
            setFieldError(result.error.message)
          } else {
            setFormError(result.error?.message ?? 'Something went wrong. Please try again.')
          }
          return
        }

        // Success — show toast notification (Requirement 5.6)
        toast.success('Profile updated successfully.')
      } catch {
        // Unexpected network / runtime error — retain entered data (Requirement 5.7)
        setFormError('Something went wrong. Please try again.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Display name field */}
      <div>
        <label
          htmlFor={displayNameInputId}
          className="block text-sm font-medium text-foreground"
        >
          Display name
        </label>
        <div className="mt-1.5">
          <input
            id={displayNameInputId}
            type="text"
            value={displayName}
            onChange={handleDisplayNameChange}
            disabled={isPending}
            aria-describedby={fieldError ? displayNameErrorId : undefined}
            aria-invalid={fieldError ? 'true' : 'false'}
            placeholder="Your display name"
            autoComplete="name"
            maxLength={50}
            className={`w-full rounded-md border px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
              fieldError
                ? 'border-destructive bg-destructive/5 focus:ring-destructive/40'
                : 'border-input bg-background focus:border-ring'
            }`}
          />
        </div>
        {fieldError && (
          <p id={displayNameErrorId} role="alert" className="mt-1 text-xs text-destructive">
            {fieldError}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {displayName.length}/50 characters
        </p>
      </div>

      {/* Form-level error (service / network errors) */}
      {formError && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </p>
      )}

      {/* Submit button with loading state (Requirement 10.4) */}
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  )
}
