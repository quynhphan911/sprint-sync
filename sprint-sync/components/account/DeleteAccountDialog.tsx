'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface DeleteAccountDialogProps {
  userId: string
  userEmail: string
}

/**
 * DeleteAccountDialog — Client Component for the account deletion danger zone.
 *
 * Renders a destructive trigger button that opens a confirmation dialog.
 * The dialog requires the user to type their exact email address before
 * deletion is permitted:
 *   - If the entered email does not match, a field-level error is shown and
 *     deletion is blocked — Requirement 8.8
 *   - If the entered email matches, `deleteAccount(userId)` is called —
 *     Requirement 8.3
 *   - On success, the session is invalidated and the user is redirected to
 *     `/auth` — Requirement 8.6
 *   - On service error, a descriptive error message is shown and deletion
 *     does not proceed — Requirement 8.7
 *
 * The confirm button is disabled while a deletion request is in progress to
 * prevent duplicate submissions — Requirement 10.4
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.6, 8.7, 8.8, 10.4
 */
export function DeleteAccountDialog({ userId, userEmail }: DeleteAccountDialogProps) {
  const router = useRouter()

  const [isOpen, setIsOpen] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const emailInputRef = useRef<HTMLInputElement>(null)

  // Accessibility: focus the email input when the dialog opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        emailInputRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Close dialog on Escape key
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isPending) {
        handleClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isPending])

  function handleOpen() {
    setIsOpen(true)
  }

  function handleClose() {
    if (isPending) return
    setIsOpen(false)
    setEmailInput('')
    setEmailError(null)
    setFormError(null)
  }

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEmailInput(e.target.value)
    if (emailError) setEmailError(null)
    if (formError) setFormError(null)
  }

  function handleConfirm() {
    setEmailError(null)
    setFormError(null)

    // Validate email match — Requirement 8.8
    if (emailInput !== userEmail) {
      setEmailError('Email does not match. Please type your exact email address.')
      return
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/account/delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        })
        const result = await response.json()

        if (!response.ok) {
          setFormError(result.error?.message || 'Failed to delete account. Please try again.')
          return
        }

        // Success — redirect to /auth — Requirement 8.6
        router.push('/auth')
      } catch {
        // Unexpected network / runtime error — Requirement 8.7
        setFormError('Something went wrong. Please try again.')
      }
    })
  }

  const dialogId = 'delete-account-dialog'
  const dialogTitleId = 'delete-account-dialog-title'
  const dialogDescId = 'delete-account-dialog-desc'
  const emailInputId = 'delete-account-email-input'
  const emailErrorId = 'delete-account-email-error'

  return (
    <>
      {/* Danger zone content with trigger button — Requirement 8.1 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">Delete account</p>
          <p className="mt-0.5 text-sm text-gray-500">
            Permanently remove your account and all associated data. This action cannot be undone.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex shrink-0 items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          aria-haspopup="dialog"
          aria-controls={dialogId}
        >
          Delete account
        </button>
      </div>

      {/* Modal overlay — Requirement 8.2 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="presentation"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            aria-hidden="true"
            onClick={!isPending ? handleClose : undefined}
          />

          {/* Dialog panel */}
          <div
            id={dialogId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            aria-describedby={dialogDescId}
            className="relative z-10 w-full max-w-md rounded-xl bg-white shadow-xl"
          >
            {/* Dialog header */}
            <div className="border-b border-gray-200 px-6 py-4">
              <h2
                id={dialogTitleId}
                className="text-base font-semibold text-gray-900"
              >
                Delete your account
              </h2>
            </div>

            {/* Dialog body */}
            <div className="space-y-4 px-6 py-5">
              <p id={dialogDescId} className="text-sm text-gray-600">
                This action is <strong>permanent and cannot be undone</strong>. Your account,
                profile, and all personal data will be removed from SprintSync.
              </p>

              <p className="text-sm text-gray-600">
                To confirm, type your email address{' '}
                <span className="font-medium text-gray-900">{userEmail}</span> below:
              </p>

              {/* Email confirmation input */}
              <div>
                <label
                  htmlFor={emailInputId}
                  className="block text-sm font-medium text-gray-700"
                >
                  Your email address
                </label>
                <div className="mt-1.5">
                  <input
                    ref={emailInputRef}
                    id={emailInputId}
                    type="email"
                    value={emailInput}
                    onChange={handleEmailChange}
                    disabled={isPending}
                    placeholder={userEmail}
                    autoComplete="off"
                    aria-describedby={emailError ? emailErrorId : undefined}
                    aria-invalid={emailError ? 'true' : 'false'}
                    className={`w-full rounded-md border px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                      emailError
                        ? 'border-red-400 bg-red-50 focus:ring-red-400/40'
                        : 'border-gray-300 bg-white focus:border-gray-400 focus:ring-gray-300/40'
                    }`}
                  />
                </div>
                {/* Field-level error — Requirement 8.8 */}
                {emailError && (
                  <p
                    id={emailErrorId}
                    role="alert"
                    className="mt-1 text-xs text-red-600"
                  >
                    {emailError}
                  </p>
                )}
              </div>

              {/* Form-level / service error — Requirement 8.7 */}
              {formError && (
                <p
                  role="alert"
                  className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  {formError}
                </p>
              )}
            </div>

            {/* Dialog footer */}
            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={isPending}
                className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              {/* Confirm button — disabled during deletion (Requirement 10.4) */}
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className="inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? 'Deleting account…' : 'Delete my account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
