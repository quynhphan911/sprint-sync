/**
 * Property-Based Test: Property 4 - Passwords-match validation is commutative in failure
 * 
 * **Validates: Requirements 6.5, 7.7**
 * 
 * Property: For any two distinct strings `a` and `b`, `validatePasswordsMatch(a, b)`
 * and `validatePasswordsMatch(b, a)` must both return `valid: false` — order does
 * not affect the failure outcome.
 * 
 * Tag: Feature: user-account-management, Property 4: Passwords-match validation is commutative in failure
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { validatePasswordsMatch } from '../validators'
import { propertyTestConfig, distinctStringPair } from './fast-check-config'

describe('Property 4: Passwords-match validation is commutative in failure', () => {
  it('should reject distinct password pairs in both orders (a,b) and (b,a)', () => {
    fc.assert(
      fc.property(distinctStringPair(), ([a, b]) => {
        // Act: Validate in both orders
        const resultAB = validatePasswordsMatch(a, b)
        const resultBA = validatePasswordsMatch(b, a)

        // Assert: Both must return valid: false
        expect(resultAB.valid).toBe(false)
        expect(resultBA.valid).toBe(false)

        // Assert: Both must have non-empty messages
        if (!resultAB.valid) {
          expect(resultAB.message).toBeTruthy()
          expect(resultAB.message.length).toBeGreaterThan(0)
        }
        if (!resultBA.valid) {
          expect(resultBA.message).toBeTruthy()
          expect(resultBA.message.length).toBeGreaterThan(0)
        }

        // Property holds: commutativity in failure - order doesn't matter
        return !resultAB.valid && !resultBA.valid
      }),
      propertyTestConfig
    )
  })

  it('should return consistent failure messages for both orderings', () => {
    fc.assert(
      fc.property(distinctStringPair(), ([a, b]) => {
        // Act: Validate in both orders
        const resultAB = validatePasswordsMatch(a, b)
        const resultBA = validatePasswordsMatch(b, a)

        // Assert: Both must fail
        expect(resultAB.valid).toBe(false)
        expect(resultBA.valid).toBe(false)

        // Assert: Messages should be identical (commutativity extends to error messages)
        if (!resultAB.valid && !resultBA.valid) {
          expect(resultAB.message).toBe(resultBA.message)
        }

        // Property holds: consistent error messaging regardless of order
        return (
          !resultAB.valid &&
          !resultBA.valid &&
          resultAB.message === resultBA.message
        )
      }),
      propertyTestConfig
    )
  })

  it('should verify commutativity across a wide range of distinct string pairs', () => {
    fc.assert(
      fc.property(
        fc.tuple(fc.string(), fc.string()).filter(([a, b]) => a !== b),
        ([password, confirm]) => {
          // Act: Validate in both orders
          const result1 = validatePasswordsMatch(password, confirm)
          const result2 = validatePasswordsMatch(confirm, password)

          // Assert: Both orderings must produce the same validity outcome
          expect(result1.valid).toBe(result2.valid)

          // Assert: For distinct strings, both must be invalid
          expect(result1.valid).toBe(false)
          expect(result2.valid).toBe(false)

          // Property holds: commutativity in failure for all distinct pairs
          return result1.valid === result2.valid && !result1.valid
        }
      ),
      propertyTestConfig
    )
  })
})
