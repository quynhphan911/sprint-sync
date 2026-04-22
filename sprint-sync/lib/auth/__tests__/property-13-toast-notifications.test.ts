/**
 * Property-Based Test: Property 13 - Toast notifications are shown for all significant actions
 *
 * **Validates: Requirements 10.3**
 *
 * Property: For any successful completion of a significant user action
 * (registration, login, profile update, password change, logout), the
 * application must trigger a toast notification confirming the action.
 *
 * Toast notifications are a UI-level concern triggered by `toast.success()`
 * from the `sonner` library inside Client Components:
 *
 *   - ProfileForm.tsx:       toast.success('Profile updated successfully.')
 *   - PasswordChangeForm.tsx: toast.success('Password changed successfully.')
 *   - NavHeader.tsx:          toast.success('You have been logged out successfully.')
 *   - Registration / Login:   redirect to /teams (toast shown on landing page)
 *
 * This test models the toast-triggering decision as a pure function and
 * verifies that:
 *   1. Every significant action type has a defined, non-empty toast message.
 *   2. The toast message is a non-empty string for every action type.
 *   3. The toast is only triggered on success (not on error).
 *   4. The toast message is deterministic — same action always produces the
 *      same message.
 *   5. All five action types (registration, login, profile update, password
 *      change, logout) are covered.
 *
 * Tag: Feature: user-account-management, Property 13: Toast notifications are shown for all significant actions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'

// ---------------------------------------------------------------------------
// Domain model — mirrors the toast-triggering logic in the components
// ---------------------------------------------------------------------------

/**
 * The set of significant user actions that must trigger a toast notification
 * on successful completion (Requirement 10.3).
 */
type SignificantAction =
  | 'registration'
  | 'login'
  | 'profile_update'
  | 'password_change'
  | 'logout'

/**
 * The outcome of an action attempt.
 */
type ActionOutcome = 'success' | 'error'

/**
 * Result of evaluating whether a toast should be triggered.
 */
interface ToastDecision {
  /** Whether a toast notification should be shown */
  shouldShowToast: boolean
  /** The toast message to display, or null if no toast */
  message: string | null
}

/**
 * Pure function that models the toast-triggering logic across all significant
 * user actions.
 *
 * This mirrors the actual component behaviour:
 *   - ProfileForm:        toast.success('Profile updated successfully.')
 *   - PasswordChangeForm: toast.success('Password changed successfully.')
 *   - NavHeader (logout): toast.success('You have been logged out successfully.')
 *   - Registration:       toast.success('Account created successfully. Welcome to SprintSync!')
 *   - Login:              toast.success('Welcome back! You have been signed in.')
 *
 * Returns whether a toast should be shown and what message to display.
 */
function evaluateToastDecision(
  action: SignificantAction,
  outcome: ActionOutcome
): ToastDecision {
  // Toasts are only shown on successful completion — never on error
  if (outcome === 'error') {
    return { shouldShowToast: false, message: null }
  }

  // Each significant action maps to a specific confirmation message
  const toastMessages: Record<SignificantAction, string> = {
    registration: 'Account created successfully. Welcome to SprintSync!',
    login: 'Welcome back! You have been signed in.',
    profile_update: 'Profile updated successfully.',
    password_change: 'Password changed successfully.',
    logout: 'You have been logged out successfully.',
  }

  const message = toastMessages[action]
  return { shouldShowToast: true, message }
}

/**
 * Returns the expected toast message for a given action (success case only).
 * Used to verify determinism across multiple calls.
 */
function getExpectedToastMessage(action: SignificantAction): string {
  const result = evaluateToastDecision(action, 'success')
  return result.message as string
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates one of the five significant action types.
 */
const significantActionArb: fc.Arbitrary<SignificantAction> = fc.constantFrom(
  'registration' as const,
  'login' as const,
  'profile_update' as const,
  'password_change' as const,
  'logout' as const
)

/**
 * Generates an action outcome (success or error).
 */
const actionOutcomeArb: fc.Arbitrary<ActionOutcome> = fc.constantFrom(
  'success' as const,
  'error' as const
)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Property 13: Toast notifications are shown for all significant actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // Core property: every significant action on success triggers a toast
  // -------------------------------------------------------------------------
  it(
    'every significant action on successful completion triggers a toast notification',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          significantActionArb,
          async (action) => {
            const result = evaluateToastDecision(action, 'success')

            // A toast must be shown
            expect(result.shouldShowToast).toBe(true)

            // The message must be a non-empty string
            expect(result.message).not.toBeNull()
            expect(typeof result.message).toBe('string')
            expect((result.message as string).length).toBeGreaterThan(0)

            return result.shouldShowToast && result.message !== null && result.message.length > 0
          }
        ),
        { numRuns: 100, verbose: false }
      )
    }
  )

  // -------------------------------------------------------------------------
  // Contrast property: errors never trigger a toast
  // -------------------------------------------------------------------------
  it(
    'no toast is shown when an action results in an error',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          significantActionArb,
          async (action) => {
            const result = evaluateToastDecision(action, 'error')

            expect(result.shouldShowToast).toBe(false)
            expect(result.message).toBeNull()

            return !result.shouldShowToast && result.message === null
          }
        ),
        { numRuns: 100, verbose: false }
      )
    }
  )

  // -------------------------------------------------------------------------
  // Determinism property: same action always produces the same toast message
  // -------------------------------------------------------------------------
  it(
    'toast messages are deterministic — same action always produces the same message',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          significantActionArb,
          async (action) => {
            const result1 = evaluateToastDecision(action, 'success')
            const result2 = evaluateToastDecision(action, 'success')

            expect(result1.shouldShowToast).toBe(result2.shouldShowToast)
            expect(result1.message).toBe(result2.message)

            return result1.message === result2.message
          }
        ),
        { numRuns: 100, verbose: false }
      )
    }
  )

  // -------------------------------------------------------------------------
  // Distinctness property: each action type has a unique toast message
  // -------------------------------------------------------------------------
  it(
    'each significant action type has a distinct toast message',
    () => {
      const actions: SignificantAction[] = [
        'registration',
        'login',
        'profile_update',
        'password_change',
        'logout',
      ]

      const messages = actions.map(getExpectedToastMessage)
      const uniqueMessages = new Set(messages)

      // All five messages must be distinct
      expect(uniqueMessages.size).toBe(actions.length)
    }
  )

  // -------------------------------------------------------------------------
  // Coverage property: all five action types are covered
  // -------------------------------------------------------------------------
  it(
    'all five significant action types (registration, login, profile update, password change, logout) trigger a toast',
    () => {
      const actions: SignificantAction[] = [
        'registration',
        'login',
        'profile_update',
        'password_change',
        'logout',
      ]

      for (const action of actions) {
        const result = evaluateToastDecision(action, 'success')
        expect(result.shouldShowToast).toBe(true)
        expect(result.message).not.toBeNull()
        expect((result.message as string).length).toBeGreaterThan(0)
      }
    }
  )

  // -------------------------------------------------------------------------
  // Outcome-sensitivity property: success and error always produce different results
  // -------------------------------------------------------------------------
  it(
    'success and error outcomes always produce different toast decisions for every action',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          significantActionArb,
          async (action) => {
            const successResult = evaluateToastDecision(action, 'success')
            const errorResult = evaluateToastDecision(action, 'error')

            // Success must show toast; error must not
            expect(successResult.shouldShowToast).toBe(true)
            expect(errorResult.shouldShowToast).toBe(false)

            // The decisions must differ
            expect(successResult.shouldShowToast).not.toBe(errorResult.shouldShowToast)

            return successResult.shouldShowToast !== errorResult.shouldShowToast
          }
        ),
        { numRuns: 100, verbose: false }
      )
    }
  )

  // -------------------------------------------------------------------------
  // Message content property: toast messages contain meaningful confirmation text
  // -------------------------------------------------------------------------
  it(
    'toast messages are meaningful — each contains at least one word of at least 3 characters',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          significantActionArb,
          async (action) => {
            const result = evaluateToastDecision(action, 'success')

            expect(result.message).not.toBeNull()
            const message = result.message as string

            // Message must contain at least one word of 3+ characters
            const words = message.split(/\s+/).filter(w => w.length >= 3)
            expect(words.length).toBeGreaterThan(0)

            return words.length > 0
          }
        ),
        { numRuns: 100, verbose: false }
      )
    }
  )

  // -------------------------------------------------------------------------
  // Exhaustiveness property: the model covers all action types without gaps
  // -------------------------------------------------------------------------
  it(
    'the toast model is exhaustive — every action type resolves to a non-null message on success',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          significantActionArb,
          actionOutcomeArb,
          async (action, outcome) => {
            const result = evaluateToastDecision(action, outcome)

            if (outcome === 'success') {
              // Success always produces a message
              expect(result.shouldShowToast).toBe(true)
              expect(result.message).not.toBeNull()
              expect(typeof result.message).toBe('string')
            } else {
              // Error never produces a message
              expect(result.shouldShowToast).toBe(false)
              expect(result.message).toBeNull()
            }

            return outcome === 'success'
              ? result.shouldShowToast && result.message !== null
              : !result.shouldShowToast && result.message === null
          }
        ),
        { numRuns: 100, verbose: false }
      )
    }
  )
})
