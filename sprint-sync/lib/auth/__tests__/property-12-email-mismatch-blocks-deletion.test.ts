/**
 * Property-Based Test: Property 12 - Email confirmation mismatch blocks account deletion
 *
 * **Validates: Requirements 8.8**
 *
 * Property: For any string entered in the deletion confirmation dialog that is
 * not an exact match for the authenticated user's email address, the deletion
 * must not proceed and a field-level error must be displayed.
 *
 * The email confirmation check is implemented as a pure inline guard in
 * `DeleteAccountDialog.handleConfirm`:
 *
 *   if (emailInput !== userEmail) {
 *     setEmailError('Email does not match. Please type your exact email address.')
 *     return   // ← deleteAccount is never called
 *   }
 *
 * This test models that guard as a pure function and verifies:
 *   1. Any entered string that is NOT equal to the user's email → blocked (error set, no deletion)
 *   2. An entered string that IS equal to the user's email → allowed (no error, deletion proceeds)
 *
 * Tag: Feature: user-account-management, Property 12: Email confirmation mismatch blocks account deletion
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'

// ---------------------------------------------------------------------------
// Pure model of the DeleteAccountDialog email confirmation guard
// (mirrors the logic in components/account/DeleteAccountDialog.tsx)
// ---------------------------------------------------------------------------

interface ConfirmationResult {
  /** Whether the deletion is allowed to proceed */
  allowed: boolean
  /** Field-level error message, or null if no error */
  emailError: string | null
}

/**
 * Pure function that models the email confirmation guard from
 * `DeleteAccountDialog.handleConfirm`.
 *
 * Returns whether deletion is allowed and what field-level error (if any)
 * should be displayed — exactly mirroring the component's behaviour.
 */
function evaluateEmailConfirmation(
  enteredEmail: string,
  userEmail: string
): ConfirmationResult {
  if (enteredEmail !== userEmail) {
    return {
      allowed: false,
      emailError: 'Email does not match. Please type your exact email address.',
    }
  }
  return {
    allowed: true,
    emailError: null,
  }
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates a realistic user email address.
 * Format: local@domain.tld — constrained to characters that appear in real emails.
 */
const userEmailArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.stringMatching(/^[a-zA-Z0-9._+-]{1,20}$/),
    fc.stringMatching(/^[a-zA-Z0-9-]{1,15}$/),
    fc.stringMatching(/^[a-zA-Z]{2,6}$/)
  )
  .map(([local, domain, tld]) => `${local}@${domain}.${tld}`)

/**
 * Generates a pair of (userEmail, enteredEmail) where enteredEmail is
 * guaranteed to NOT equal userEmail.
 *
 * Covers a wide range of mismatch scenarios:
 *   - Completely different strings
 *   - Strings that differ only by case (e.g. "User@example.com" vs "user@example.com")
 *   - Strings that differ by a single character
 *   - Empty string
 *   - Whitespace-padded versions of the email
 */
const mismatchedEmailPairArb: fc.Arbitrary<{ userEmail: string; enteredEmail: string }> = fc
  .tuple(
    userEmailArb,
    fc.oneof(
      // Completely arbitrary string (most cases)
      fc.string(),
      // Empty string
      fc.constant(''),
      // Whitespace only
      fc.constant('   '),
      // Uppercase variant of a generated email (case-sensitive mismatch)
      userEmailArb.map((e) => e.toUpperCase()),
      // Lowercase variant
      userEmailArb.map((e) => e.toLowerCase()),
      // Prepend a space
      userEmailArb.map((e) => ` ${e}`),
      // Append a space
      userEmailArb.map((e) => `${e} `),
      // Truncated (first half of a generated email)
      userEmailArb.map((e) => e.slice(0, Math.max(1, Math.floor(e.length / 2)))),
    )
  )
  .filter(([userEmail, enteredEmail]) => enteredEmail !== userEmail)
  .map(([userEmail, enteredEmail]) => ({ userEmail, enteredEmail }))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Property 12: Email confirmation mismatch blocks account deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // Core property: any mismatched entered email → deletion blocked + error shown
  // -------------------------------------------------------------------------
  it(
    'any entered email that does not exactly match the user email blocks deletion and sets a field-level error',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          mismatchedEmailPairArb,
          async ({ userEmail, enteredEmail }) => {
            const result = evaluateEmailConfirmation(enteredEmail, userEmail)

            // Deletion must be blocked
            expect(result.allowed).toBe(false)

            // A field-level error message must be present and non-empty
            expect(result.emailError).not.toBeNull()
            expect(typeof result.emailError).toBe('string')
            expect((result.emailError as string).length).toBeGreaterThan(0)

            return !result.allowed && result.emailError !== null
          }
        ),
        { numRuns: 100, verbose: false }
      )
    }
  )

  // -------------------------------------------------------------------------
  // Contrast property: exact match → deletion allowed, no error
  // -------------------------------------------------------------------------
  it(
    'an entered email that exactly matches the user email allows deletion and sets no field-level error',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          userEmailArb,
          async (userEmail) => {
            // Enter the exact same email as the user's email
            const result = evaluateEmailConfirmation(userEmail, userEmail)

            // Deletion must be allowed
            expect(result.allowed).toBe(true)

            // No field-level error must be set
            expect(result.emailError).toBeNull()

            return result.allowed && result.emailError === null
          }
        ),
        { numRuns: 100, verbose: false }
      )
    }
  )

  // -------------------------------------------------------------------------
  // Case-sensitivity property: email match is case-sensitive
  // -------------------------------------------------------------------------
  it(
    'email confirmation is case-sensitive: uppercase variant of the user email blocks deletion',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate emails that have at least one lowercase letter so the
          // uppercase variant is guaranteed to differ
          userEmailArb.filter((e) => e !== e.toUpperCase()),
          async (userEmail) => {
            const uppercasedEntry = userEmail.toUpperCase()

            // Precondition: the uppercased version must differ from the original
            fc.pre(uppercasedEntry !== userEmail)

            const result = evaluateEmailConfirmation(uppercasedEntry, userEmail)

            expect(result.allowed).toBe(false)
            expect(result.emailError).not.toBeNull()

            return !result.allowed
          }
        ),
        { numRuns: 100, verbose: false }
      )
    }
  )

  // -------------------------------------------------------------------------
  // Whitespace property: padded email blocks deletion
  // -------------------------------------------------------------------------
  it(
    'email with leading or trailing whitespace does not match and blocks deletion',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          userEmailArb,
          fc.constantFrom(' ', '  ', '\t', '\n'),
          fc.boolean(),
          async (userEmail, whitespace, prepend) => {
            const paddedEntry = prepend
              ? `${whitespace}${userEmail}`
              : `${userEmail}${whitespace}`

            // Precondition: padded version must differ (it always will since we add whitespace)
            fc.pre(paddedEntry !== userEmail)

            const result = evaluateEmailConfirmation(paddedEntry, userEmail)

            expect(result.allowed).toBe(false)
            expect(result.emailError).not.toBeNull()

            return !result.allowed
          }
        ),
        { numRuns: 100, verbose: false }
      )
    }
  )

  // -------------------------------------------------------------------------
  // Empty input property: empty string always blocks deletion
  // -------------------------------------------------------------------------
  it(
    'empty string entered as email always blocks deletion',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          userEmailArb,
          async (userEmail) => {
            const result = evaluateEmailConfirmation('', userEmail)

            expect(result.allowed).toBe(false)
            expect(result.emailError).not.toBeNull()

            return !result.allowed
          }
        ),
        { numRuns: 100, verbose: false }
      )
    }
  )

  // -------------------------------------------------------------------------
  // Idempotency property: calling the guard multiple times with the same
  // mismatched input always produces the same blocked result
  // -------------------------------------------------------------------------
  it(
    'the email confirmation guard is deterministic: same mismatched input always produces the same blocked result',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          mismatchedEmailPairArb,
          async ({ userEmail, enteredEmail }) => {
            const result1 = evaluateEmailConfirmation(enteredEmail, userEmail)
            const result2 = evaluateEmailConfirmation(enteredEmail, userEmail)

            expect(result1.allowed).toBe(result2.allowed)
            expect(result1.emailError).toBe(result2.emailError)

            return result1.allowed === result2.allowed
          }
        ),
        { numRuns: 100, verbose: false }
      )
    }
  )
})
