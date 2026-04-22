'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { validateEmail } from '@/lib/auth/validators'
import type { AuthError } from '@/types/auth'

/**
 * Password Reset Request Page
 *
 * Allows users to request a password reset link by entering their email address.
 * Always displays a confirmation message after submission, regardless of whether
 * the email exists in the system, to prevent email enumeration.
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 10.1, 10.4
 */
export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isPending, startTransition] = useTransition()

  const emailInputId = 'reset-email'
  const emailErrorId = 'reset-email-error'

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setEmail(value)
    // Clear errors as user types
    if (emailError) setEmailError(null)
    if (submitError) setSubmitError(null)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    // Client-side validation before submission
    const emailValidation = validateEmail(email)

    if (!emailValidation.valid) {
      setEmailError(emailValidation.message)
      return
    }

    // Clear all errors
    setEmailError(null)
    setSubmitError(null)

    startTransition(async () => {
      try {
        const response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })

        const result = await response.json()

        if (!response.ok || 'error' in result) {
          const error = result.error as AuthError

          if (error.field === 'email') {
            setEmailError(error.message)
          } else {
            setSubmitError(error.message)
          }
          return
        }

        // Always show confirmation message (Requirement 7.4)
        setIsSubmitted(true)
      } catch (err) {
        setSubmitError('Something went wrong. Please try again.')
      }
    })
  }

  // Confirmation message view
  if (isSubmitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          <div className="rounded-lg border bg-card p-8 shadow-sm">
            {/* Success icon */}
            <div className="mb-4 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <svg
                  className="h-6 w-6 text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
            </div>

            {/* Header */}
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-semibold text-foreground">Check your email</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                If an account exists with <strong>{email}</strong>, you will receive a
                password reset link shortly.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Please check your inbox and follow the instructions to reset your password.
              </p>
            </div>

            {/* Back to login link */}
            <div className="text-center">
              <Link
                href="/auth"
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Back to sign in
              </Link>
            </div>
          </div>

          {/* Footer note */}
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Didn&apos;t receive an email? Check your spam folder or try again.
          </p>
        </div>
      </main>
    )
  }

  // Request form view
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg border bg-card p-8 shadow-sm">
          {/* Header */}
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold text-foreground">Reset your password</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter your email address and we&apos;ll send you a link to reset your password.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Email field */}
            <div>
              <label
                htmlFor={emailInputId}
                className="block text-sm font-medium text-foreground"
              >
                Email
              </label>
              <div className="mt-1.5">
                <input
                  id={emailInputId}
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  disabled={isPending}
                  aria-describedby={emailError ? emailErrorId : undefined}
                  aria-invalid={emailError ? 'true' : 'false'}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className={`w-full rounded-md border px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
                    emailError
                      ? 'border-destructive bg-destructive/5 focus:ring-destructive/40'
                      : 'border-input bg-background focus:border-ring'
                  }`}
                />
              </div>
              {emailError && (
                <p id={emailErrorId} role="alert" className="mt-1 text-xs text-destructive">
                  {emailError}
                </p>
              )}
            </div>

            {/* Submit error */}
            {submitError && (
              <p
                role="alert"
                className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {submitError}
              </p>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? 'Sending…' : 'Send reset link'}
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
