/**
 * Example test file demonstrating unit and property-based testing patterns.
 * 
 * This file shows how to:
 * - Write unit tests for specific examples
 * - Write property-based tests for universal properties
 * - Use custom arbitraries from fast-check-config
 * - Use test utilities
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { validateEmail, validatePassword } from '../validators'
import { propertyTestConfig, validEmail, invalidEmail, validPassword, invalidPassword } from './fast-check-config'

// ---------------------------------------------------------------------------
// Unit Tests - Test specific examples
// ---------------------------------------------------------------------------

describe('Email Validation - Unit Tests', () => {
  it('should accept valid email addresses', () => {
    expect(validateEmail('user@example.com')).toEqual({ valid: true })
    expect(validateEmail('test.user@domain.co.uk')).toEqual({ valid: true })
    expect(validateEmail('name+tag@company.org')).toEqual({ valid: true })
  })

  it('should reject empty email', () => {
    const result = validateEmail('')
    expect(result.valid).toBe(false)
    expect(result.message).toBe('Email is required.')
  })

  it('should reject email without @', () => {
    const result = validateEmail('notanemail')
    expect(result.valid).toBe(false)
    expect(result.message).toBe('Please enter a valid email address.')
  })

  it('should reject email without domain', () => {
    const result = validateEmail('user@')
    expect(result.valid).toBe(false)
    expect(result.message).toBe('Please enter a valid email address.')
  })
})

// ---------------------------------------------------------------------------
// Property-Based Tests - Test universal properties
// ---------------------------------------------------------------------------

describe('Email Validation - Property Tests', () => {
  it('should accept all valid email formats', () => {
    fc.assert(
      fc.property(validEmail(), (email) => {
        const result = validateEmail(email)
        return result.valid === true
      }),
      propertyTestConfig
    )
  })

  it('should reject all invalid email formats', () => {
    fc.assert(
      fc.property(invalidEmail(), (email) => {
        const result = validateEmail(email)
        return result.valid === false && result.message.length > 0
      }),
      propertyTestConfig
    )
  })
})

describe('Password Validation - Property Tests', () => {
  it('should accept all conforming passwords', () => {
    fc.assert(
      fc.property(validPassword(), (password) => {
        const result = validatePassword(password)
        return result.valid === true
      }),
      propertyTestConfig
    )
  })

  it('should reject all non-conforming passwords', () => {
    fc.assert(
      fc.property(invalidPassword(), (password) => {
        const result = validatePassword(password)
        return result.valid === false && result.message.length > 0
      }),
      propertyTestConfig
    )
  })
})
