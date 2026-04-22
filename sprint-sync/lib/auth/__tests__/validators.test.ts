/**
 * Unit tests for all Validator functions.
 * 
 * Tests boundary values, representative valid inputs, and representative invalid inputs
 * for each validator function in lib/auth/validators.ts.
 * 
 * **Validates: Requirements 1.3, 1.4, 1.5, 2.4, 5.3, 5.5, 6.4, 6.5, 7.3, 9.7**
 */

import { describe, it, expect } from 'vitest'
import {
  validateEmail,
  validatePassword,
  validateDisplayName,
  validateAvatarFile,
  validatePasswordsMatch,
  sanitiseDisplayName,
} from '../validators'
import { createMockFile } from './test-utils'

// ---------------------------------------------------------------------------
// validateEmail - Unit Tests
// ---------------------------------------------------------------------------

describe('validateEmail - Unit Tests', () => {
  describe('valid emails', () => {
    it('should accept standard email format', () => {
      expect(validateEmail('user@example.com')).toEqual({ valid: true })
    })

    it('should accept email with subdomain', () => {
      expect(validateEmail('user@mail.example.com')).toEqual({ valid: true })
    })

    it('should accept email with plus sign', () => {
      expect(validateEmail('user+tag@example.com')).toEqual({ valid: true })
    })

    it('should accept email with dots in local part', () => {
      expect(validateEmail('first.last@example.com')).toEqual({ valid: true })
    })

    it('should accept email with hyphen in domain', () => {
      expect(validateEmail('user@my-domain.com')).toEqual({ valid: true })
    })

    it('should accept email with numbers', () => {
      expect(validateEmail('user123@example456.com')).toEqual({ valid: true })
    })

    it('should accept email with underscore', () => {
      expect(validateEmail('user_name@example.com')).toEqual({ valid: true })
    })
  })

  describe('invalid emails', () => {
    it('should reject empty string', () => {
      const result = validateEmail('')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Email is required.')
    })

    it('should reject whitespace-only string', () => {
      const result = validateEmail('   ')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Email is required.')
    })

    it('should reject email without @ symbol', () => {
      const result = validateEmail('userexample.com')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Please enter a valid email address.')
    })

    it('should reject email without domain', () => {
      const result = validateEmail('user@')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Please enter a valid email address.')
    })

    it('should reject email without local part', () => {
      const result = validateEmail('@example.com')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Please enter a valid email address.')
    })

    it('should reject email without TLD', () => {
      const result = validateEmail('user@domain')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Please enter a valid email address.')
    })

    it('should reject email with spaces', () => {
      const result = validateEmail('user name@example.com')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Please enter a valid email address.')
    })

    it('should reject email with multiple @ symbols', () => {
      const result = validateEmail('user@@example.com')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Please enter a valid email address.')
    })
  })
})

// ---------------------------------------------------------------------------
// validatePassword - Unit Tests
// ---------------------------------------------------------------------------

describe('validatePassword - Unit Tests', () => {
  describe('valid passwords', () => {
    it('should accept password with exactly 8 characters (boundary)', () => {
      expect(validatePassword('Abcdef12')).toEqual({ valid: true })
    })

    it('should accept password with 9 characters', () => {
      expect(validatePassword('Abcdef123')).toEqual({ valid: true })
    })

    it('should accept password with 20 characters', () => {
      expect(validatePassword('Abcdefgh12345678901')).toEqual({ valid: true })
    })

    it('should accept password with special characters', () => {
      expect(validatePassword('Abcdef12!@#$')).toEqual({ valid: true })
    })

    it('should accept password with multiple uppercase letters', () => {
      expect(validatePassword('ABCdef12')).toEqual({ valid: true })
    })

    it('should accept password with multiple lowercase letters', () => {
      expect(validatePassword('Abcdefg1')).toEqual({ valid: true })
    })

    it('should accept password with multiple digits', () => {
      expect(validatePassword('Abcdef123456')).toEqual({ valid: true })
    })
  })

  describe('invalid passwords', () => {
    it('should reject empty string', () => {
      const result = validatePassword('')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Password is required.')
    })

    it('should reject password with 7 characters (boundary)', () => {
      const result = validatePassword('Abcde12')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Password must be at least 8 characters long.')
    })

    it('should reject password with 1 character', () => {
      const result = validatePassword('A')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Password must be at least 8 characters long.')
    })

    it('should reject password without uppercase letter', () => {
      const result = validatePassword('abcdef12')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Password must contain at least one uppercase letter.')
    })

    it('should reject password without lowercase letter', () => {
      const result = validatePassword('ABCDEF12')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Password must contain at least one lowercase letter.')
    })

    it('should reject password without digit', () => {
      const result = validatePassword('Abcdefgh')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Password must contain at least one digit.')
    })

    it('should reject password with only lowercase and digits', () => {
      const result = validatePassword('abcdef12')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Password must contain at least one uppercase letter.')
    })

    it('should reject password with only uppercase and digits', () => {
      const result = validatePassword('ABCDEF12')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Password must contain at least one lowercase letter.')
    })

    it('should reject password with only letters', () => {
      const result = validatePassword('Abcdefgh')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Password must contain at least one digit.')
    })
  })
})

// ---------------------------------------------------------------------------
// validateDisplayName - Unit Tests
// ---------------------------------------------------------------------------

describe('validateDisplayName - Unit Tests', () => {
  describe('valid display names', () => {
    it('should accept display name with 1 character (boundary)', () => {
      expect(validateDisplayName('A')).toEqual({ valid: true })
    })

    it('should accept display name with 2 characters', () => {
      expect(validateDisplayName('AB')).toEqual({ valid: true })
    })

    it('should accept display name with 25 characters', () => {
      expect(validateDisplayName('A'.repeat(25))).toEqual({ valid: true })
    })

    it('should accept display name with exactly 50 characters (boundary)', () => {
      expect(validateDisplayName('A'.repeat(50))).toEqual({ valid: true })
    })

    it('should accept display name with spaces', () => {
      expect(validateDisplayName('John Doe')).toEqual({ valid: true })
    })

    it('should accept display name with special characters', () => {
      expect(validateDisplayName('John O\'Brien')).toEqual({ valid: true })
    })

    it('should accept display name with numbers', () => {
      expect(validateDisplayName('User123')).toEqual({ valid: true })
    })

    it('should accept display name with unicode characters', () => {
      expect(validateDisplayName('José García')).toEqual({ valid: true })
    })

    it('should accept display name with emojis', () => {
      expect(validateDisplayName('John 👋')).toEqual({ valid: true })
    })
  })

  describe('invalid display names', () => {
    it('should reject empty string', () => {
      const result = validateDisplayName('')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Display name is required.')
    })

    it('should reject whitespace-only string', () => {
      const result = validateDisplayName('   ')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Display name is required.')
    })

    it('should reject display name with 51 characters (boundary)', () => {
      const result = validateDisplayName('A'.repeat(51))
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Display name must be at most 50 characters.')
    })

    it('should reject display name with 52 characters', () => {
      const result = validateDisplayName('A'.repeat(52))
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Display name must be at most 50 characters.')
    })

    it('should reject display name with 100 characters', () => {
      const result = validateDisplayName('A'.repeat(100))
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Display name must be at most 50 characters.')
    })
  })
})

// ---------------------------------------------------------------------------
// validateAvatarFile - Unit Tests
// ---------------------------------------------------------------------------

describe('validateAvatarFile - Unit Tests', () => {
  describe('valid avatar files', () => {
    it('should accept JPEG file with 1 byte (boundary)', () => {
      const file = createMockFile('avatar.jpg', 1, 'image/jpeg')
      expect(validateAvatarFile(file)).toEqual({ valid: true })
    })

    it('should accept PNG file with 1 MB', () => {
      const file = createMockFile('avatar.png', 1024 * 1024, 'image/png')
      expect(validateAvatarFile(file)).toEqual({ valid: true })
    })

    it('should accept WebP file with exactly 2 MB (boundary)', () => {
      const file = createMockFile('avatar.webp', 2 * 1024 * 1024, 'image/webp')
      expect(validateAvatarFile(file)).toEqual({ valid: true })
    })

    it('should accept JPEG file with 1.5 MB', () => {
      const file = createMockFile('avatar.jpg', 1.5 * 1024 * 1024, 'image/jpeg')
      expect(validateAvatarFile(file)).toEqual({ valid: true })
    })

    it('should accept PNG file with 500 KB', () => {
      const file = createMockFile('avatar.png', 500 * 1024, 'image/png')
      expect(validateAvatarFile(file)).toEqual({ valid: true })
    })
  })

  describe('invalid avatar files - size', () => {
    it('should reject file with 2 MB + 1 byte (boundary)', () => {
      const file = createMockFile('avatar.jpg', 2 * 1024 * 1024 + 1, 'image/jpeg')
      const result = validateAvatarFile(file)
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Avatar image must not exceed 2 MB.')
    })

    it('should reject file with 3 MB', () => {
      const file = createMockFile('avatar.png', 3 * 1024 * 1024, 'image/png')
      const result = validateAvatarFile(file)
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Avatar image must not exceed 2 MB.')
    })

    it('should reject file with 10 MB', () => {
      const file = createMockFile('avatar.webp', 10 * 1024 * 1024, 'image/webp')
      const result = validateAvatarFile(file)
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Avatar image must not exceed 2 MB.')
    })
  })

  describe('invalid avatar files - type', () => {
    it('should reject GIF file', () => {
      const file = createMockFile('avatar.gif', 1024 * 1024, 'image/gif')
      const result = validateAvatarFile(file)
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Avatar must be a JPEG, PNG, or WebP image.')
    })

    it('should reject SVG file', () => {
      const file = createMockFile('avatar.svg', 1024 * 1024, 'image/svg+xml')
      const result = validateAvatarFile(file)
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Avatar must be a JPEG, PNG, or WebP image.')
    })

    it('should reject PDF file', () => {
      const file = createMockFile('document.pdf', 1024 * 1024, 'application/pdf')
      const result = validateAvatarFile(file)
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Avatar must be a JPEG, PNG, or WebP image.')
    })

    it('should reject text file', () => {
      const file = createMockFile('file.txt', 1024, 'text/plain')
      const result = validateAvatarFile(file)
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Avatar must be a JPEG, PNG, or WebP image.')
    })

    it('should reject BMP file', () => {
      const file = createMockFile('avatar.bmp', 1024 * 1024, 'image/bmp')
      const result = validateAvatarFile(file)
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Avatar must be a JPEG, PNG, or WebP image.')
    })
  })

  describe('invalid avatar files - both size and type', () => {
    it('should reject oversized GIF file', () => {
      const file = createMockFile('avatar.gif', 3 * 1024 * 1024, 'image/gif')
      const result = validateAvatarFile(file)
      expect(result.valid).toBe(false)
      // Type check happens first in the validator
      expect(result.message).toBe('Avatar must be a JPEG, PNG, or WebP image.')
    })
  })
})

// ---------------------------------------------------------------------------
// validatePasswordsMatch - Unit Tests
// ---------------------------------------------------------------------------

describe('validatePasswordsMatch - Unit Tests', () => {
  describe('matching passwords', () => {
    it('should accept identical passwords', () => {
      expect(validatePasswordsMatch('Password123', 'Password123')).toEqual({ valid: true })
    })

    it('should accept identical empty strings', () => {
      expect(validatePasswordsMatch('', '')).toEqual({ valid: true })
    })

    it('should accept identical single character', () => {
      expect(validatePasswordsMatch('A', 'A')).toEqual({ valid: true })
    })

    it('should accept identical long passwords', () => {
      const password = 'A'.repeat(100)
      expect(validatePasswordsMatch(password, password)).toEqual({ valid: true })
    })

    it('should accept identical passwords with special characters', () => {
      expect(validatePasswordsMatch('P@ssw0rd!', 'P@ssw0rd!')).toEqual({ valid: true })
    })
  })

  describe('non-matching passwords', () => {
    it('should reject different passwords', () => {
      const result = validatePasswordsMatch('Password123', 'Password456')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Passwords do not match.')
    })

    it('should reject passwords differing by case', () => {
      const result = validatePasswordsMatch('Password123', 'password123')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Passwords do not match.')
    })

    it('should reject passwords differing by trailing space', () => {
      const result = validatePasswordsMatch('Password123', 'Password123 ')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Passwords do not match.')
    })

    it('should reject passwords differing by leading space', () => {
      const result = validatePasswordsMatch('Password123', ' Password123')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Passwords do not match.')
    })

    it('should reject empty vs non-empty', () => {
      const result = validatePasswordsMatch('', 'Password123')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Passwords do not match.')
    })

    it('should reject non-empty vs empty', () => {
      const result = validatePasswordsMatch('Password123', '')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Passwords do not match.')
    })

    it('should reject passwords differing by one character', () => {
      const result = validatePasswordsMatch('Password123', 'Password124')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Passwords do not match.')
    })
  })
})

// ---------------------------------------------------------------------------
// sanitiseDisplayName - Unit Tests
// ---------------------------------------------------------------------------

describe('sanitiseDisplayName - Unit Tests', () => {
  describe('plain text (no sanitisation needed)', () => {
    it('should return plain text unchanged', () => {
      expect(sanitiseDisplayName('John Doe')).toBe('John Doe')
    })

    it('should return text with numbers unchanged', () => {
      expect(sanitiseDisplayName('User123')).toBe('User123')
    })

    it('should return text with special characters unchanged', () => {
      expect(sanitiseDisplayName('John O\'Brien')).toBe('John O\'Brien')
    })

    it('should return empty string unchanged', () => {
      expect(sanitiseDisplayName('')).toBe('')
    })

    it('should return text with unicode unchanged', () => {
      expect(sanitiseDisplayName('José García')).toBe('José García')
    })
  })

  describe('HTML markup removal', () => {
    it('should remove simple HTML tags', () => {
      expect(sanitiseDisplayName('<b>Bold Name</b>')).toBe('Bold Name')
    })

    it('should remove script tags', () => {
      expect(sanitiseDisplayName('<script>alert("xss")</script>')).toBe('alert("xss")')
    })

    it('should remove self-closing tags', () => {
      expect(sanitiseDisplayName('Name<br/>WithTag')).toBe('NameWithTag')
    })

    it('should remove tags with attributes', () => {
      expect(sanitiseDisplayName('<img src="x" onerror="alert(1)">')).toBe('')
    })

    it('should remove div tags', () => {
      expect(sanitiseDisplayName('<div>Content</div>')).toBe('Content')
    })

    it('should remove span tags', () => {
      expect(sanitiseDisplayName('Text<span>test</span>')).toBe('Texttest')
    })

    it('should remove multiple tags', () => {
      expect(sanitiseDisplayName('<p><strong>Bold</strong> text</p>')).toBe('Bold text')
    })

    it('should remove nested tags', () => {
      expect(sanitiseDisplayName('<div><span><b>Nested</b></span></div>')).toBe('Nested')
    })

    it('should remove tags with complex attributes', () => {
      expect(sanitiseDisplayName('<a href="http://evil.com" onclick="alert(1)">Link</a>')).toBe('Link')
    })

    it('should remove incomplete tags', () => {
      expect(sanitiseDisplayName('Text<incomplete')).toBe('Text<incomplete')
    })

    it('should handle mixed content', () => {
      expect(sanitiseDisplayName('Hello <b>World</b>!')).toBe('Hello World!')
    })

    it('should remove all angle brackets from tags', () => {
      const result = sanitiseDisplayName('<script>alert("xss")</script>')
      expect(result).not.toContain('<')
      expect(result).not.toContain('>')
    })

    it('should handle multiple separate tags', () => {
      expect(sanitiseDisplayName('<b>Bold</b> and <i>Italic</i>')).toBe('Bold and Italic')
    })
  })
})
