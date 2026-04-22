/**
 * Property-Based Test: Property 6 - Avatar file validation correctly classifies files
 * 
 * **Validates: Requirements 5.5**
 * 
 * Property: For any file that exceeds 2 MB in size or whose MIME type is not
 * `image/jpeg`, `image/png`, or `image/webp`, `validateAvatarFile` must return
 * `valid: false`. For any file that is at most 2 MB in size and whose MIME type
 * is one of those three types, `validateAvatarFile` must return `valid: true`.
 * 
 * Tag: Feature: user-account-management, Property 6: Avatar file validation correctly classifies files
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { validateAvatarFile } from '../validators'
import {
  propertyTestConfig,
  validAvatarFileConfig,
  invalidAvatarFileConfig,
} from './fast-check-config'
import { createMockFile } from './test-utils'

describe('Property 6: Avatar file validation correctly classifies files', () => {
  it('should accept all valid avatar files (≤2MB, correct MIME type)', () => {
    fc.assert(
      fc.property(validAvatarFileConfig(), (config) => {
        // Arrange: Create a mock file with valid configuration
        const file = createMockFile(
          'avatar.jpg',
          config.size,
          config.type,
          'mock avatar content'
        )

        // Act: Validate the file
        const result = validateAvatarFile(file)

        // Assert: Must return valid: true
        expect(result.valid).toBe(true)

        // Property holds: all valid files are accepted
        return result.valid === true
      }),
      propertyTestConfig
    )
  })

  it('should reject all invalid avatar files (>2MB or wrong MIME type)', () => {
    fc.assert(
      fc.property(invalidAvatarFileConfig(), (config) => {
        // Arrange: Create a mock file with invalid configuration
        const file = createMockFile(
          'avatar.jpg',
          config.size,
          config.type,
          'mock avatar content'
        )

        // Act: Validate the file
        const result = validateAvatarFile(file)

        // Assert: Must return valid: false
        expect(result.valid).toBe(false)

        // Assert: Must have a non-empty message
        if (!result.valid) {
          expect(result.message).toBeTruthy()
          expect(result.message.length).toBeGreaterThan(0)
        }

        // Property holds: all invalid files are rejected with a message
        return !result.valid && result.message.length > 0
      }),
      propertyTestConfig
    )
  })

  it('should correctly classify files at the 2MB boundary', () => {
    const TWO_MB = 2 * 1024 * 1024

    // Test exactly 2MB (should be valid)
    const validFile = createMockFile(
      'avatar.jpg',
      TWO_MB,
      'image/jpeg',
      'mock content'
    )
    const validResult = validateAvatarFile(validFile)
    expect(validResult.valid).toBe(true)

    // Test 2MB + 1 byte (should be invalid)
    const invalidFile = createMockFile(
      'avatar.jpg',
      TWO_MB + 1,
      'image/jpeg',
      'mock content'
    )
    const invalidResult = validateAvatarFile(invalidFile)
    expect(invalidResult.valid).toBe(false)
    if (!invalidResult.valid) {
      expect(invalidResult.message).toContain('2 MB')
    }
  })

  it('should correctly classify all three valid MIME types', () => {
    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp']
    const size = 1024 * 1024 // 1 MB

    validMimeTypes.forEach((mimeType) => {
      const file = createMockFile('avatar.jpg', size, mimeType, 'mock content')
      const result = validateAvatarFile(file)
      expect(result.valid).toBe(true)
    })
  })

  it('should reject all invalid MIME types', () => {
    const invalidMimeTypes = [
      'image/gif',
      'image/svg+xml',
      'application/pdf',
      'text/plain',
      'image/bmp',
      'video/mp4',
    ]
    const size = 1024 * 1024 // 1 MB

    invalidMimeTypes.forEach((mimeType) => {
      const file = createMockFile('avatar.jpg', size, mimeType, 'mock content')
      const result = validateAvatarFile(file)
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.message).toBeTruthy()
        expect(result.message.length).toBeGreaterThan(0)
      }
    })
  })

  it('should validate files independently of size and type violations', () => {
    fc.assert(
      fc.property(
        fc.record({
          size: fc.integer({ min: 1, max: 10 * 1024 * 1024 }),
          type: fc.constantFrom(
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
            'image/svg+xml',
            'application/pdf'
          ),
        }),
        (config) => {
          // Arrange: Create a file with arbitrary size and type
          const file = createMockFile(
            'avatar.jpg',
            config.size,
            config.type,
            'mock content'
          )

          // Act: Validate the file
          const result = validateAvatarFile(file)

          // Determine expected validity
          const TWO_MB = 2 * 1024 * 1024
          const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp']
          const sizeValid = config.size <= TWO_MB
          const typeValid = validMimeTypes.includes(config.type)
          const expectedValid = sizeValid && typeValid

          // Assert: Result matches expected validity
          expect(result.valid).toBe(expectedValid)

          // If invalid, must have a message
          if (!result.valid) {
            expect(result.message).toBeTruthy()
            expect(result.message.length).toBeGreaterThan(0)
          }

          // Property holds: validation correctly classifies based on both criteria
          return result.valid === expectedValid
        }
      ),
      propertyTestConfig
    )
  })
})
