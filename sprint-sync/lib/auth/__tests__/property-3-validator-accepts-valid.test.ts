/**
 * Property-Based Test: Property 3 - Validator accepts all conforming inputs
 * 
 * **Validates: Requirements 1.3, 1.4, 1.5**
 * 
 * Property: For any email string in valid format, any password string of at
 * least 8 characters containing at least one uppercase letter, one lowercase
 * letter, and one digit, and any display name string of 1–50 characters, the
 * corresponding Validator function must return `valid: true`. This rule applies
 * uniformly across all call contexts (registration, login, profile update,
 * password change, password reset).
 * 
 * Tag: Feature: user-account-management, Property 3: Validator accepts all conforming inputs
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
  validEmail,
  validPassword,
  validDisplayName,
} from './fast-check-config'

describe('Property 3: Validator accepts all conforming inputs', () => {
  it('should accept all valid email addresses', () => {
    fc.assert(
      fc.property(validEmail(), (email) => {
        // Act: Validate the valid email
        const result = validateEmail(email)

        // Assert: Must return valid: true
        expect(result.valid).toBe(true)

        // Property holds: all valid emails are accepted
        return result.valid === true
      }),
      propertyTestConfig
    )
  })

  it('should accept all valid passwords', () => {
    fc.assert(
      fc.property(validPassword(), (password) => {
        // Act: Validate the valid password
        const result = validatePassword(password)

        // Assert: Must return valid: true
        expect(result.valid).toBe(true)

        // Property holds: all valid passwords are accepted
        return result.valid === true
      }),
      propertyTestConfig
    )
  })

  it('should accept all valid display names', () => {
    fc.assert(
      fc.property(validDisplayName(), (displayName) => {
        // Act: Validate the valid display name
        const result = validateDisplayName(displayName)

        // Assert: Must return valid: true
        expect(result.valid).toBe(true)

        // Property holds: all valid display names are accepted
        return result.valid === true
      }),
      propertyTestConfig
    )
  })

  it('should accept valid inputs uniformly across all validation contexts', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          validEmail().map(v => ({ type: 'email' as const, value: v })),
          validPassword().map(v => ({ type: 'password' as const, value: v })),
          validDisplayName().map(v => ({ type: 'displayName' as const, value: v }))
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

          // Assert: All valid inputs must be accepted
          expect(result.valid).toBe(true)

          // Property holds: uniform acceptance behavior across all validators
          return result.valid === true
        }
      ),
      propertyTestConfig
    )
  })

  it('should accept all combinations of valid email, password, and display name', () => {
    fc.assert(
      fc.property(
        validEmail(),
        validPassword(),
        validDisplayName(),
        (email, password, displayName) => {
          // Act: Validate all three inputs
          const emailResult = validateEmail(email)
          const passwordResult = validatePassword(password)
          const displayNameResult = validateDisplayName(displayName)

          // Assert: All must return valid: true
          expect(emailResult.valid).toBe(true)
          expect(passwordResult.valid).toBe(true)
          expect(displayNameResult.valid).toBe(true)

          // Property holds: all valid combinations are accepted
          return (
            emailResult.valid === true &&
            passwordResult.valid === true &&
            displayNameResult.valid === true
          )
        }
      ),
      propertyTestConfig
    )
  })
})
