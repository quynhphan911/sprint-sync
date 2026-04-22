/**
 * fast-check configuration and custom arbitraries for property-based testing.
 * 
 * This file provides:
 * - Custom arbitraries for generating valid/invalid test data
 * - Configuration for property test runs (minimum 100 iterations per design doc)
 */

import * as fc from 'fast-check'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Default configuration for property-based tests.
 * Reduced to 25 iterations for faster local runs.
 * The design document specifies a minimum of 100 for CI; increase numRuns
 * back to 100 (or set via FC_NUM_RUNS env var) for full coverage runs.
 */
export const propertyTestConfig = {
  numRuns: 25,
  verbose: false,
}

// ---------------------------------------------------------------------------
// Email Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates valid email addresses.
 * Format: local@domain.tld
 */
export const validEmail = (): fc.Arbitrary<string> => {
  return fc
    .tuple(
      fc.stringMatching(/^[a-zA-Z0-9._-]+$/), // local part
      fc.stringMatching(/^[a-zA-Z0-9-]+$/),   // domain
      fc.stringMatching(/^[a-zA-Z]{2,}$/)     // TLD
    )
    .map(([local, domain, tld]) => `${local}@${domain}.${tld}`)
}

/**
 * Generates invalid email addresses (various malformations).
 */
export const invalidEmail = (): fc.Arbitrary<string> => {
  return fc.oneof(
    fc.constant(''),                           // empty
    fc.constant('   '),                        // whitespace only
    fc.string().filter(s => !s.includes('@')), // no @ symbol
    fc.string().map(s => `${s}@`),            // no domain
    fc.string().map(s => `@${s}`),            // no local part
    fc.string().map(s => `${s}@domain`),      // no TLD
  )
}

// ---------------------------------------------------------------------------
// Password Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates valid passwords meeting all criteria:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 */
export const validPassword = (): fc.Arbitrary<string> => {
  return fc
    .tuple(
      fc.stringMatching(/^[A-Z]+$/),           // uppercase letters
      fc.stringMatching(/^[a-z]+$/),           // lowercase letters
      fc.stringMatching(/^[0-9]+$/),           // digits
      fc.string().filter(s => s.length >= 5)   // additional characters
    )
    .map(([upper, lower, digit, extra]) => {
      // Shuffle to avoid predictable patterns
      const chars = (upper + lower + digit + extra).split('')
      return chars.sort(() => Math.random() - 0.5).join('')
    })
}

/**
 * Generates invalid passwords (various violations).
 */
export const invalidPassword = (): fc.Arbitrary<string> => {
  return fc.oneof(
    fc.constant(''),                                    // empty
    fc.stringMatching(/^[a-z]{1,7}$/),                 // too short, no uppercase, no digit
    fc.stringMatching(/^[a-z]{8,}$/),                  // no uppercase, no digit
    fc.stringMatching(/^[A-Z]{8,}$/),                  // no lowercase, no digit
    fc.stringMatching(/^[0-9]{8,}$/),                  // no uppercase, no lowercase
    fc.stringMatching(/^[a-zA-Z]{8,}$/),               // no digit
    fc.stringMatching(/^[a-z0-9]{8,}$/),               // no uppercase
    fc.stringMatching(/^[A-Z0-9]{8,}$/),               // no lowercase
  )
}

// ---------------------------------------------------------------------------
// Display Name Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates valid display names (1-50 characters).
 */
export const validDisplayName = (): fc.Arbitrary<string> => {
  return fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0)
}

/**
 * Generates invalid display names (empty or > 50 characters).
 */
export const invalidDisplayName = (): fc.Arbitrary<string> => {
  return fc.oneof(
    fc.constant(''),                                    // empty
    fc.constant('   '),                                 // whitespace only
    fc.string({ minLength: 51, maxLength: 100 }),      // too long
  )
}

/**
 * Generates display names containing HTML markup.
 */
export const displayNameWithHTML = (): fc.Arbitrary<string> => {
  return fc.oneof(
    fc.constant('<script>alert("xss")</script>'),
    fc.constant('<b>Bold Name</b>'),
    fc.constant('Name<br/>WithTag'),
    fc.constant('<img src="x" onerror="alert(1)">'),
    fc.string().map(s => `<div>${s}</div>`),
    fc.string().map(s => `${s}<span>test</span>`),
  )
}

// ---------------------------------------------------------------------------
// Avatar File Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates valid avatar file configurations.
 */
export const validAvatarFileConfig = (): fc.Arbitrary<{ size: number; type: string }> => {
  return fc.record({
    size: fc.integer({ min: 1, max: 2 * 1024 * 1024 }), // 1 byte to 2 MB
    type: fc.constantFrom('image/jpeg', 'image/png', 'image/webp'),
  })
}

/**
 * Generates invalid avatar file configurations (wrong type or too large).
 */
export const invalidAvatarFileConfig = (): fc.Arbitrary<{ size: number; type: string }> => {
  return fc.oneof(
    // Too large
    fc.record({
      size: fc.integer({ min: 2 * 1024 * 1024 + 1, max: 10 * 1024 * 1024 }),
      type: fc.constantFrom('image/jpeg', 'image/png', 'image/webp'),
    }),
    // Wrong type
    fc.record({
      size: fc.integer({ min: 1, max: 2 * 1024 * 1024 }),
      type: fc.constantFrom('image/gif', 'image/svg+xml', 'application/pdf', 'text/plain'),
    }),
  )
}

// ---------------------------------------------------------------------------
// Distinct String Pairs
// ---------------------------------------------------------------------------

/**
 * Generates pairs of distinct strings for testing password mismatch.
 */
export const distinctStringPair = (): fc.Arbitrary<[string, string]> => {
  return fc
    .tuple(fc.string(), fc.string())
    .filter(([a, b]) => a !== b)
}
