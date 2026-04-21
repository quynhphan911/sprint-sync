'use client'

import { useState, useTransition, useRef } from 'react'
import { inviteUserAction } from '@/app/teams/[teamId]/settings/actions'

interface InviteMemberFormProps {
  teamId: string
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Controlled form for inviting a user to a team by email address.
 *
 * - Client-side validation: non-empty, valid email format; field-level error on violation.
 * - Calls the `inviteUserAction` Server Action on submit.
 * - On success: displays an inline toast notification confirming the invitation.
 * - On error: displays the descriptive error message returned by the service.
 *
 * Validates: Requirements 9.1, 9.3, 9.4, 9.5, 9.6, 9.7
 */
export function InviteMemberForm({ teamId }: InviteMemberFormProps) {
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(message: string) {
    setToast(message)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 4000)
  }

  function validate(value: string): string | null {
    if (value.trim().length === 0) return 'Email address is required.'
    if (!EMAIL_REGEX.test(value.trim())) return 'Please enter a valid email address.'
    return null
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setEmail(value)
    // Clear field error as the user types
    if (fieldError) setFieldError(validate(value))
  }

  function handleBlur() {
    setFieldError(validate(email))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const error = validate(email)
    if (error) {
      setFieldError(error)
      return
    }

    setFieldError(null)
    setSubmitError(null)

    startTransition(async () => {
      const result = await inviteUserAction(teamId, email.trim())

      if ('error' in result) {
        setSubmitError(result.error.message)
        return
      }

      // Success
      setEmail('')
      showToast(`Invitation sent to ${email.trim()}.`)
    })
  }

  const inputId = 'invite-email-input'
  const errorId = 'invite-email-error'

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">Invite a Member</h2>
      <p className="mt-1 text-sm text-foreground/60">
        Enter the email address of the person you want to invite to this team.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
        <div>
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-foreground"
          >
            Email address
          </label>
          <div className="mt-1.5">
            <input
              id={inputId}
              type="email"
              value={email}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isPending}
              aria-describedby={fieldError ? errorId : undefined}
              aria-invalid={fieldError ? 'true' : 'false'}
              placeholder="colleague@example.com"
              className={`w-full rounded-md border px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
                fieldError
                  ? 'border-destructive bg-destructive/5 focus:ring-destructive/40'
                  : 'border-input bg-background focus:border-ring'
              }`}
            />
          </div>

          {fieldError && (
            <p id={errorId} role="alert" className="mt-1 text-xs text-destructive">
              {fieldError}
            </p>
          )}
        </div>

        {submitError && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? 'Sending invitation…' : 'Send invitation'}
        </button>
      </form>

      {/* Inline toast notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4 shrink-0"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
              clipRule="evenodd"
            />
          </svg>
          {toast}
        </div>
      )}
    </div>
  )
}
