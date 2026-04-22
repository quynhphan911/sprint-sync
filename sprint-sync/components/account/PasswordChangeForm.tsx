'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { validatePassword, validatePasswordsMatch } from '@/lib/auth/validators'
import { changePassword } from '@/lib/auth/service'

interface PasswordChangeFormProps {
  userId: string
}

/**
 * PasswordChangeForm — Client Component for changing the user's password.
 *
 * Renders three fields: current_password, new_password, confirm_new_password.
 * Performs client-side validation before submitting:
 *   - new_password is validated via validatePassword (min 8 chars, uppercase,
 *     lowercase, digit) — Requirement 6.4
 *   - confirm_new_password is validated via validatePasswordsMatch — Requirement 6.5
 *
 * On success: shows a toast notification and clears all fields — Requirement 6.6
 * On error: displays a descriptive error message and clears ALL password fields
 *   — Requirement 6.7
 * While a request is in progress, the submit button is disabled and shows a
 * loading indicator — Requirement 10.4
 *
 * This component is only rendered for email/password users; the parent
 * Account_Settings_Page hides it for Google-only users — Requirement 6.8
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 10.4
 */
export function PasswordChangeForm({ userId }: PasswordChangeFormProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')

  const [currentPasswordError, setCurrentPasswordError] = useState<string | null>(null)
  const [newPasswordError, setNewPasswordError] = useState<string | null>(null)
  const [confirmNewPasswordError, setConfirmNewPasswordError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const [isPending, startTransition] = useTransition()

  // Input IDs for accessibility
  const currentPasswordId = 'password-change-current'
  const newPasswordId = 'password-change-new'
  const confirmNewPasswordId = 'password-change-confirm'
  const currentPasswordErrorId = 'password-change-current-error'
  const newPasswordErrorId = 'password-change-new-error'
  const confirmNewPasswordErrorId = 'password-change-confirm-error'

  function clearAllFields() {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmNewPassword('')
  }

  function clearAllErrors() {
    setCurrentPasswordError(null)
    setNewPasswordError(null)
    setConfirmNewPasswordError(null)
    setFormError(null)
  }

  function handleCurrentPasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCurrentPassword(e.target.value)
    if (currentPasswordError) setCurrentPasswordError(null)
    if (formError) setFormError(null)
  }

  function handleNewPasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    setNewPassword(e.target.value)
    if (newPasswordError) setNewPasswordError(null)
    if (formError) setFormError(null)
  }

  function handleConfirmNewPasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    setConfirmNewPassword(e.target.value)
    if (confirmNewPasswordError) setConfirmNewPasswordError(null)
    if (formError) setFormError(null)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    clearAllErrors()

    // Client-side validation
    let hasError = false

    if (!currentPassword) {
      setCurrentPasswordError('Current password is required.')
      hasError = true
    }

    const newPasswordValidation = validatePassword(newPassword)
    if (!newPasswordValidation.valid) {
      setNewPasswordError(newPasswordValidation.message)
      hasError = true
    }

    const confirmValidation = validatePasswordsMatch(newPassword, confirmNewPassword)
    if (!confirmValidation.valid) {
      setConfirmNewPasswordError(confirmValidation.message)
      hasError = true
    }

    if (hasError) return

    startTransition(async () => {
      try {
        const result = await changePassword(userId, currentPassword, newPassword)

        if (result && 'error' in result) {
          // Clear all password fields on any service error (Requirement 6.7)
          clearAllFields()

          // Map field-level errors (Requirement 6.3)
          if (result.error.field === 'current_password') {
            setCurrentPasswordError(result.error.message)
          } else if (result.error.field === 'new_password') {
            setNewPasswordError(result.error.message)
          } else {
            setFormError(result.error.message)
          }
          return
        }

        // Success — show toast and clear all fields (Requirement 6.6)
        clearAllFields()
        toast.success('Password changed successfully.')
      } catch {
        // Unexpected network / runtime error — clear all fields (Requirement 6.7)
        clearAllFields()
        setFormError('Something went wrong. Please try again.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Current password field */}
      <div>
        <label
          htmlFor={currentPasswordId}
          className="block text-sm font-medium text-foreground"
        >
          Current password
        </label>
        <div className="mt-1.5">
          <input
            id={currentPasswordId}
            type="password"
            value={currentPassword}
            onChange={handleCurrentPasswordChange}
            disabled={isPending}
            aria-describedby={currentPasswordError ? currentPasswordErrorId : undefined}
            aria-invalid={currentPasswordError ? 'true' : 'false'}
            autoComplete="current-password"
            className={`w-full rounded-md border px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
              currentPasswordError
                ? 'border-destructive bg-destructive/5 focus:ring-destructive/40'
                : 'border-input bg-background focus:border-ring'
            }`}
          />
        </div>
        {currentPasswordError && (
          <p id={currentPasswordErrorId} role="alert" className="mt-1 text-xs text-destructive">
            {currentPasswordError}
          </p>
        )}
      </div>

      {/* New password field */}
      <div>
        <label
          htmlFor={newPasswordId}
          className="block text-sm font-medium text-foreground"
        >
          New password
        </label>
        <div className="mt-1.5">
          <input
            id={newPasswordId}
            type="password"
            value={newPassword}
            onChange={handleNewPasswordChange}
            disabled={isPending}
            aria-describedby={newPasswordError ? newPasswordErrorId : undefined}
            aria-invalid={newPasswordError ? 'true' : 'false'}
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
        <p className="mt-1 text-xs text-muted-foreground">
          Min. 8 characters with uppercase, lowercase, and a digit.
        </p>
      </div>

      {/* Confirm new password field */}
      <div>
        <label
          htmlFor={confirmNewPasswordId}
          className="block text-sm font-medium text-foreground"
        >
          Confirm new password
        </label>
        <div className="mt-1.5">
          <input
            id={confirmNewPasswordId}
            type="password"
            value={confirmNewPassword}
            onChange={handleConfirmNewPasswordChange}
            disabled={isPending}
            aria-describedby={confirmNewPasswordError ? confirmNewPasswordErrorId : undefined}
            aria-invalid={confirmNewPasswordError ? 'true' : 'false'}
            autoComplete="new-password"
            className={`w-full rounded-md border px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
              confirmNewPasswordError
                ? 'border-destructive bg-destructive/5 focus:ring-destructive/40'
                : 'border-input bg-background focus:border-ring'
            }`}
          />
        </div>
        {confirmNewPasswordError && (
          <p id={confirmNewPasswordErrorId} role="alert" className="mt-1 text-xs text-destructive">
            {confirmNewPasswordError}
          </p>
        )}
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
        {isPending ? 'Changing password…' : 'Change password'}
      </button>
    </form>
  )
}
