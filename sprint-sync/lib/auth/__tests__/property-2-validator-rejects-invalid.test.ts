/**
 * Property-Based Test: Property 2 - Validator rejects all invalid inputs
 * 
 * **Validates: Requirements 1.3, 1.4, 1.5, 2.4, 5.3, 6.4, 7.3**
 * 
 * Property: For any input value that violates a validation rule — including
 * empty email, malformed email (no `@`, no domain), password shorter than 8
 * characters, password missing an uppercase letter, password missing a lowercase
 * letter, password missing a digit, display name that is empty, or display name
 * exceeding 50 characters — the corresponding Validator function must return
 * `valid: false` with a non-empty message. This rule applies uniformly across
 * all call contexts (registration, login, profile update, password change,
 * password reset).
 * 
 * Tag: Feature: user-account-management, Property 2: Validator rejects all invalid inputs
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  validateEmail,
  validatePassword,
  validateDisplayName,
} from '../validators'
import {
  propertyTestConfig,
  invalidEmail,
  invalidPassword,
  invalidDisplayName,
} from './fast-check-config'

describe('Property 2: Validator rejects all invalid inputs', () => {
  it('should reject all invalid email addresses with a non-empty message', () => {
    fc.assert(
      fc.property(invalidEmail(), (email) => {
        // Act: Validate the invalid email
        const result = validateEmail(email)

        // Assert: Must return valid: false
        expect(result.valid).toBe(false)

        // Assert: Must have a non-empty message
        if (!result.valid) {
          expect(result.message).toBeTruthy()
          expect(result.message.length).toBeGreaterThan(0)
        }

        // Property holds: all invalid emails are rejected with a message
        return !result.valid && result.message.length > 0
      }),
      propertyTestConfig
    )
  })

  it('should reject all invalid passwords with a non-empty message', () => {
    fc.assert(
      fc.property(invalidPassword(), (password) => {
        // Act: Validate the invalid password
        const result = validatePassword(password)

        // Assert: Must return valid: false
        expect(result.valid).toBe(false)

        // Assert: Must have a non-empty message
        if (!result.valid) {
          expect(result.message).toBeTruthy()
          expect(result.message.length).toBeGreaterThan(0)
        }

        // Property holds: all invalid passwords are rejected with a message
        return !result.valid && result.message.length > 0
      }),
      propertyTestConfig
    )
  })

  it('should reject all invalid display names with a non-empty message', () => {
    fc.assert(
      fc.property(invalidDisplayName(), (displayName) => {
        // Act: Validate the invalid display name
        const result = validateDisplayName(displayName)

        // Assert: Must return valid: false
        expect(result.valid).toBe(false)

        // Assert: Must have a non-empty message
        if (!result.valid) {
          expect(result.message).toBeTruthy()
          expect(result.message.length).toBeGreaterThan(0)
        }

        // Property holds: all invalid display names are rejected with a message
        return !result.valid && result.message.length > 0
      }),
      propertyTestConfig
    )
  })

  it('should reject invalid inputs uniformly across all validation contexts', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          invalidEmail().map(v => ({ type: 'email' as const, value: v })),
          invalidPassword().map(v => ({ type: 'password' as const, value: v })),
          invalidDisplayName().map(v => ({ type: 'displayName' as const, value: v }))
        ),
        (input) => {
          // Act: Validate based on input type
          let result
          switch (input.type) {
            case 'email':
              result = validateEmail(input.value)
              break
            case 'password':
              result = validatePassword(input.value)
              break
            case 'displayName':
              result = validateDisplayName(input.value)
              break
          }

          // Assert: All invalid inputs must be rejected
          expect(result.valid).toBe(false)

          // Assert: All must have non-empty messages
          if (!result.valid) {
            expect(result.message).toBeTruthy()
            expect(result.message.length).toBeGreaterThan(0)
          }

          // Property holds: uniform rejection behavior across all validators
          return !result.valid && result.message.length > 0
        }
      ),
      propertyTestConfig
    )
  })
})
