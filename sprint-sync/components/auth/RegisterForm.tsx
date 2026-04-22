'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  validateEmail,
  validatePassword,
  validateDisplayName,
} from '@/lib/auth/validators'
import type { AuthError } from '@/types/auth'

interface RegisterFormProps {
  redirectTo?: string
}

/**
 * Register_Form — Client Component for user registration.
 *
 * Provides fields for email, password, and display_name with client-side
 * validation using the validators from lib/auth/validators.ts. Displays
 * loading states during submission and field-level error messages on
 * validation failures or server errors.
 *
 * On successful registration, redirects to the provided redirectTo URL
 * (defaults to /teams).
 *
 * Validates: Requirements 1.1, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 10.1, 10.4
 */
export function RegisterForm({ redirectTo = '/teams' }: RegisterFormProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [displayNameError, setDisplayNameError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const emailInputId = 'register-email'
  const passwordInputId = 'register-password'
  const displayNameInputId = 'register-display-name'
  const emailErrorId = 'register-email-error'
  const passwordErrorId = 'register-password-error'
  const displayNameErrorId = 'register-display-name-error'

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setEmail(value)
    // Clear error as user types
    if (emailError) setEmailError(null)
  }

  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setPassword(value)
    // Clear error as user types
    if (passwordError) setPasswordError(null)
  }

  function handleDisplayNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setDisplayName(value)
    // Clear error as user types
    if (displayNameError) setDisplayNameError(null)
  }

  function handleEmailBlur() {
    const validation = validateEmail(email)
    if (!validation.valid) {
      setEmailError(validation.message)
    }
  }

  function handlePasswordBlur() {
    const validation = validatePassword(password)
    if (!validation.valid) {
      setPasswordError(validation.message)
    }
  }

  function handleDisplayNameBlur() {
    const validation = validateDisplayName(displayName)
    if (!validation.valid) {
      setDisplayNameError(validation.message)
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    // Client-side validation before submission
    const emailValidation = validateEmail(email)
    const passwordValidation = validatePassword(password)
    const displayNameValidation = validateDisplayName(displayName)

    let hasError = false

    if (!emailValidation.valid) {
      setEmailError(emailValidation.message)
      hasError = true
    }

    if (!passwordValidation.valid) {
      setPasswordError(passwordValidation.message)
      hasError = true
    }

    if (!displayNameValidation.valid) {
      setDisplayNameError(displayNameValidation.message)
      hasError = true
    }

    if (hasError) {
      return
    }

    // Clear all errors
    setEmailError(null)
    setPasswordError(null)
    setDisplayNameError(null)
    setSubmitError(null)

    startTransition(async () => {
      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, displayName }),
        })

        const result = await response.json()

        if (!response.ok || 'error' in result) {
          const error = result.error as AuthError

          // Map error to appropriate field
          if (error.field === 'email') {
            setEmailError(error.message)
          } else if (error.field === 'password') {
            setPasswordError(error.message)
          } else if (error.field === 'display_name') {
            setDisplayNameError(error.message)
          } else {
            setSubmitError(error.message)
          }

          // Clear password field on error (security best practice)
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
            onBlur={handleEmailBlur}
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
            onBlur={handlePasswordBlur}
            disabled={isPending}
            aria-describedby={passwordError ? passwordErrorId : undefined}
            aria-invalid={passwordError ? 'true' : 'false'}
            placeholder="••••••••"
            autoComplete="new-password"
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
        {!passwordError && (
          <p className="mt-1 text-xs text-muted-foreground">
            At least 8 characters with uppercase, lowercase, and a digit.
          </p>
        )}
      </div>

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
            onBlur={handleDisplayNameBlur}
            disabled={isPending}
            aria-describedby={displayNameError ? displayNameErrorId : undefined}
            aria-invalid={displayNameError ? 'true' : 'false'}
            placeholder="Your name"
            autoComplete="name"
            className={`w-full rounded-md border px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
              displayNameError
                ? 'border-destructive bg-destructive/5 focus:ring-destructive/40'
                : 'border-input bg-background focus:border-ring'
            }`}
          />
        </div>
        {displayNameError && (
          <p
            id={displayNameErrorId}
            role="alert"
            className="mt-1 text-xs text-destructive"
          >
            {displayNameError}
          </p>
        )}
        <div className="mt-1 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            How your team will see you.
          </p>
          <span
            className={`text-xs tabular-nums ${
              displayName.length > 50
                ? 'text-destructive'
                : 'text-muted-foreground'
            }`}
            aria-live="polite"
          >
            {displayName.length}/50
          </span>
        </div>
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
        {isPending ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  )
}
