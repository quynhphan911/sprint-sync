'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { validateEmail, validatePassword } from '@/lib/auth/validators'
import type { AuthError } from '@/types/auth'

interface LoginFormProps {
  redirectTo?: string
}

/**
 * Login_Form — Client Component for user authentication.
 *
 * Provides fields for email and password with client-side validation using
 * the validators from lib/auth/validators.ts. Displays loading states during
 * submission and field-level error messages on validation failures or server
 * errors.
 *
 * Unlike RegisterForm, this component retains the email value on error but
 * always clears the password field for security.
 *
 * On successful login, redirects to the provided redirectTo URL (defaults to /teams).
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 10.1, 10.4
 */
export function LoginForm({ redirectTo = '/teams' }: LoginFormProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const emailInputId = 'login-email'
  const passwordInputId = 'login-password'
  const emailErrorId = 'login-email-error'
  const passwordErrorId = 'login-password-error'

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setEmail(value)
    // Clear error as user types
    if (emailError) setEmailError(null)
    if (submitError) setSubmitError(null)
  }

  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setPassword(value)
    // Clear error as user types
    if (passwordError) setPasswordError(null)
    if (submitError) setSubmitError(null)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    // Client-side validation before submission
    const emailValidation = validateEmail(email)
    const passwordValidation = validatePassword(password)

    let hasError = false

    if (!emailValidation.valid) {
      setEmailError(emailValidation.message)
      hasError = true
    }

    if (!passwordValidation.valid) {
      setPasswordError(passwordValidation.message)
      hasError = true
    }

    if (hasError) {
      return
    }

    // Clear all errors
    setEmailError(null)
    setPasswordError(null)
    setSubmitError(null)

    startTransition(async () => {
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })

        const result = await response.json()

        if (!response.ok || 'error' in result) {
          const error = result.error as AuthError

          // For credential failures, display generic error message
          // to prevent user enumeration (Requirement 2.5)
          if (error.code === 'INVALID_CREDENTIALS') {
            setSubmitError('Invalid email or password')
          } else if (error.field === 'email') {
            setEmailError(error.message)
          } else if (error.field === 'password') {
            setPasswordError(error.message)
          } else {
            setSubmitError(error.message)
          }

          // Clear password field on error (security best practice)
          // but retain email (Requirement 2.6)
          setPassword('')
          return
        }

        // Success — redirect to target page
        router.push(redirectTo)
        router.refresh()
      } catch (err) {
        setSubmitError('Something went wrong. Please try again.')
        setPassword('')
      }
    })
  }

  return (
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

      {/* Password field */}
      <div>
        <label
          htmlFor={passwordInputId}
          className="block text-sm font-medium text-foreground"
        >
          Password
        </label>
        <div className="mt-1.5">
          <input
            id={passwordInputId}
            type="password"
            value={password}
            onChange={handlePasswordChange}
            disabled={isPending}
            aria-describedby={passwordError ? passwordErrorId : undefined}
            aria-invalid={passwordError ? 'true' : 'false'}
            placeholder="••••••••"
            autoComplete="current-password"
            className={`w-full rounded-md border px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
              passwordError
                ? 'border-destructive bg-destructive/5 focus:ring-destructive/40'
                : 'border-input bg-background focus:border-ring'
            }`}
          />
        </div>
        {passwordError && (
          <p id={passwordErrorId} role="alert" className="mt-1 text-xs text-destructive">
            {passwordError}
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
        {isPending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
