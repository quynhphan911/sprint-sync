'use client'

import { useState, useTransition, useRef } from 'react'
import { createTeamAction } from '@/app/teams/actions'
import type { TeamWithRole } from '@/types/team'

interface TeamFormProps {
  onTeamCreated?: (team: TeamWithRole) => void
}

/**
 * Controlled form for creating a new team.
 *
 * - Client-side validation: non-empty, ≤ 100 characters; field-level error shown on violation.
 * - Calls the `createTeamAction` Server Action on submit.
 * - On success: calls `onTeamCreated` callback and shows an inline success notification.
 * - On error: shows a descriptive error message and retains the entered name.
 *
 * Validates: Requirements 8.3, 8.4, 8.5, 8.6, 8.8
 */
export function TeamForm({ onTeamCreated }: TeamFormProps) {
  const [name, setName] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const MAX_LENGTH = 100

  function showToast(message: string) {
    setToast(message)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 4000)
  }

  function validate(value: string): string | null {
    if (value.trim().length === 0) return 'Team name is required.'
    if (value.length > MAX_LENGTH) return `Team name must be ${MAX_LENGTH} characters or fewer.`
    return null
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setName(value)
    // Clear field error as the user types
    if (fieldError) setFieldError(validate(value))
  }

  function handleBlur() {
    setFieldError(validate(name))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const error = validate(name)
    if (error) {
      setFieldError(error)
      return
    }

    setFieldError(null)
    setSubmitError(null)

    startTransition(async () => {
      const result = await createTeamAction(name)

      if ('error' in result) {
        setSubmitError(result.error.message)
        return
      }

      // Success
      setName('')
      showToast(`Team "${result.team.name}" created successfully.`)
      onTeamCreated?.(result.team)
    })
  }

  const inputId = 'team-name-input'
  const errorId = 'team-name-error'
  const charCount = name.length
  const isOverLimit = charCount > MAX_LENGTH

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">Create a Team</h2>
      <p className="mt-1 text-sm text-foreground/60">
        Give your team a name to get started.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
        <div>
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-foreground"
          >
            Team name
          </label>
          <div className="mt-1.5">
            <input
              id={inputId}
              type="text"
              value={name}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isPending}
              aria-describedby={fieldError ? errorId : undefined}
              aria-invalid={fieldError ? 'true' : 'false'}
              placeholder="e.g. Esoft Alpha"
              className={`w-full rounded-md border px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
                fieldError
                  ? 'border-destructive bg-destructive/5 focus:ring-destructive/40'
                  : 'border-input bg-background focus:border-ring'
              }`}
            />
          </div>

          <div className="mt-1 flex items-start justify-between gap-2">
            <div>
              {fieldError && (
                <p id={errorId} role="alert" className="text-xs text-destructive">
                  {fieldError}
                </p>
              )}
            </div>
            <span
              className={`shrink-0 text-xs tabular-nums ${
                isOverLimit ? 'text-destructive' : 'text-foreground/40'
              }`}
              aria-live="polite"
            >
              {charCount}/{MAX_LENGTH}
            </span>
          </div>
        </div>

        {submitError && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending || isOverLimit}
          className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? 'Creating…' : 'Create team'}
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
