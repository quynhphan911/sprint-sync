/**
 * Setup verification test.
 * Ensures Vitest and fast-check are properly configured.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { propertyTestConfig } from './fast-check-config'

describe('Test Setup Verification', () => {
  it('should run basic unit tests', () => {
    expect(true).toBe(true)
  })

  it('should run property-based tests with fast-check', () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        return n + 0 === n
      }),
      propertyTestConfig
    )
  })

  it('should have access to test utilities', async () => {
    const { createMockProfile } = await import('./test-utils')
    const profile = createMockProfile()
    
    expect(profile).toHaveProperty('id')
    expect(profile).toHaveProperty('display_name')
    expect(profile).toHaveProperty('avatar_url')
    expect(profile).toHaveProperty('created_at')
  })
})
