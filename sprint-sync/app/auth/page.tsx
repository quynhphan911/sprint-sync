'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { LoginForm } from '@/components/auth/LoginForm'
import { GoogleSSOButton } from '@/components/auth/GoogleSSOButton'

/**
 * Auth_Page — Authentication page with toggle between login and registration.
 *
 * Validates: Requirements 1.1, 2.1, 2.7, 2.8, 3.1, 10.1, 10.5
 */

function AuthContent() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/teams'
  const oauthError = searchParams.get('error')

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg border bg-card p-8 shadow-sm">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold text-foreground">
              {mode === 'login' ? 'Sign in to SprintSync' : 'Create your account'}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === 'login'
                ? 'Welcome back! Enter your credentials to continue.'
                : 'Join your team and start collaborating.'}
            </p>
          </div>

          {oauthError && (
            <div
              role="alert"
              className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {oauthError}
            </div>
          )}

          <div className="mb-6 flex gap-2 rounded-md bg-muted p-1">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 rounded px-3 py-2 text-sm font-medium transition-colors ${
                mode === 'login'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 rounded px-3 py-2 text-sm font-medium transition-colors ${
                mode === 'register'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Register
            </button>
          </div>

          {mode === 'login' ? (
            <LoginForm redirectTo={redirectTo} />
          ) : (
            <RegisterForm redirectTo={redirectTo} />
          )}

          {process.env.NEXT_PUBLIC_GOOGLE_SSO_ENABLED === 'true' && (
            <>
              <div className="my-6 flex items-center gap-4">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">OR</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <GoogleSSOButton redirectTo={redirectTo} />
            </>
          )}

          {mode === 'login' && (
            <div className="mt-4 text-center">
              <a
                href="/auth/reset-password"
                className="text-sm text-primary hover:underline"
              >
                Forgot password?
              </a>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          By continuing, you agree to SprintSync&apos;s terms of service and privacy policy.
        </p>
      </div>
    </main>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-muted-foreground">Loading...</div>
      </main>
    }>
      <AuthContent />
    </Suspense>
  )
}
