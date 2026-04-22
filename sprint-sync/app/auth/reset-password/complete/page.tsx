'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  validatePassword,
  validatePasswordsMatch,
} from '@/lib/auth/validators'
import type { AuthError } from '@/types/auth'

/**
 * Password Reset Completion Page
 *
 * Allows users to set a new password after clicking the reset link from their email.
 * The session is established by the /auth/confirm callback handler before redirecting here.
 * On successful password reset, redirects to /teams.
 *
 * Validates: Requirements 7.5, 7.6, 7.7, 7.8, 7.9, 10.1, 10.4
 */
export default function ResetPasswordCompletePage() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [newPasswordError, setNewPasswordError] = useState<string | null>(null)
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const newPasswordInputId = 'new-password'
  const confirmPasswordInputId = 'confirm-new-password'
  const newPasswordErrorId = 'new-password-error'
  const confirmPasswordErrorId = 'confirm-password-error'

  function handleNewPasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setNewPassword(value)
    // Clear errors as user types
    if (newPasswordError) setNewPasswordError(null)
    if (submitError) setSubmitError(null)
  }

  function handleConfirmPasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setConfirmNewPassword(value)
    // Clear errors as user types
    if (confirmPasswordError) setConfirmPasswordError(null)
    if (submitError) setSubmitError(null)
  }

  function handleNewPasswordBlur() {
    const validation = validatePassword(newPassword)
    if (!validation.valid) {
      setNewPasswordError(validation.message)
    }
  }

  function handleConfirmPasswordBlur() {
    // Only validate match if new password is valid
    if (newPassword && confirmNewPassword) {
      const matchValidation = validatePasswordsMatch(newPassword, confirmNewPassword)
      if (!matchValidation.valid) {
        setConfirmPasswordError(matchValidation.message)
      }
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    // Client-side validation before submission
    const passwordValidation = validatePassword(newPassword)
    const matchValidation = validatePasswordsMatch(newPassword, confirmNewPassword)

    let hasError = false

    if (!passwordValidation.valid) {
      setNewPasswordError(passwordValidation.message)
      hasError = true
    }

    if (!matchValidation.valid) {
      setConfirmPasswordError(matchValidation.message)
      hasError = true
    }

    if (hasError) {
      return
    }

    // Clear all errors
    setNewPasswordError(null)
    setConfirmPasswordError(null)
    setSubmitError(null)

    startTransition(async () => {
      try {
        const response = await fetch('/api/auth/reset-password/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newPassword }),
        })

        const result = await response.json()

        if (!response.ok || 'error' in result) {
          const error = result.error as AuthError

          // Handle expired/invalid reset link
          if (error.code === 'RESET_LINK_EXPIRED') {
            setSubmitError(error.message)
            return
          }

          // Map error to appropriate field
          if (error.field === 'new_password') {
            setNewPasswordError(error.message)
          } else {
            setSubmitError(error.message)
          }

          // Clear password fields on error (security best practice)
          setNewPassword('')
          setConfirmNewPassword('')
          return
        }

        // Success — redirect to teams page
        router.push('/teams')
        router.refresh()
      } catch (err) {
        setSubmitError('Something went wrong. Please try again.')
        setNewPassword('')
        setConfirmNewPassword('')
      }
    })
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg border bg-card p-8 shadow-sm">
          {/* Header */}
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold text-foreground">Set new password</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter your new password below. Make sure it&apos;s strong and secure.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* New password field */}
            <div>
              <label
                htmlFor={newPasswordInputId}
                className="block text-sm font-medium text-foreground"
              >
                New password
              </label>
              <div className="mt-1.5">
                <input
                  id={newPasswordInputId}
                  type="password"
                  value={newPassword}
                  onChange={handleNewPasswordChange}
                  onBlur={handleNewPasswordBlur}
                  disabled={isPending}
                  aria-describedby={newPasswordError ? newPasswordErrorId : undefined}
                  aria-invalid={newPasswordError ? 'true' : 'false'}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className={`w-full rounded-md border px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
                    newPasswordError
                      ? 'border-destructive bg-destructive/5 focus:ring-destructive/40'
                      : 'border-input bg-background focus:border-ring'
                  }`}
                />
              </div>
              {newPasswordError && (
                <p id={newPasswordErrorId} role="alert" className="mt-1 text-xs text-destructive">
                  {newPasswordError}
                </p>
              )}
              {!newPasswordError && (
                <p className="mt-1 text-xs text-muted-foreground">
                  At least 8 characters with uppercase, lowercase, and a digit.
                </p>
              )}
            </div>

            {/* Confirm new password field */}
            <div>
              <label
                htmlFor={confirmPasswordInputId}
                className="block text-sm font-medium text-foreground"
              >
                Confirm new password
              </label>
              <div className="mt-1.5">
                <input
                  id={confirmPasswordInputId}
                  type="password"
                  value={confirmNewPassword}
                  onChange={handleConfirmPasswordChange}
                  onBlur={handleConfirmPasswordBlur}
                  disabled={isPending}
                  aria-describedby={confirmPasswordError ? confirmPasswordErrorId : undefined}
                  aria-invalid={confirmPasswordError ? 'true' : 'false'}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className={`w-full rounded-md border px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
                    confirmPasswordError
                      ? 'border-destructive bg-destructive/5 focus:ring-destructive/40'
                      : 'border-input bg-background focus:border-ring'
                  }`}
                />
              </div>
              {confirmPasswordError && (
                <p
                  id={confirmPasswordErrorId}
                  role="alert"
                  className="mt-1 text-xs text-destructive"
                >
                  {confirmPasswordError}
                </p>
              )}
            </div>

            {/* Submit error */}
            {submitError && (
              <div className="rounded-md bg-destructive/10 px-3 py-2">
                <p role="alert" className="text-sm text-destructive">
                  {submitError}
                </p>
                {submitError.includes('expired') && (
                  <Link
                    href="/auth/reset-password"
                    className="mt-2 inline-block text-sm text-primary hover:underline"
                  >
                    Request a new reset link
                  </Link>
                )}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? 'Resetting password…' : 'Reset password'}
            </button>
          </form>

          {/* Back to login link */}
          <div className="mt-4 text-center">
            <Link href="/auth" className="text-sm text-primary hover:underline">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
