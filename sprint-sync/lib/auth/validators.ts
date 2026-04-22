/**
 * Validator — pure validation and sanitisation functions for authentication
 * and profile data. No side effects, no I/O.
 *
 * Validates: Requirements 1.3, 1.4, 1.5, 2.4, 5.3, 5.5, 6.4, 6.5, 7.3, 7.7, 9.7
 */

import type { ValidationResult } from '../../types/auth'

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

/**
 * Validates an email address.
 *
 * Rules:
 * - Must be a non-empty string.
 * - Must contain exactly one `@` character.
 * - Must have a non-empty local part (before `@`) and a domain part (after `@`)
 *   that contains at least one `.` with characters on both sides.
 *
 * Validates: Requirements 1.3, 2.4, 7.3
 */
export function validateEmail(value: string): ValidationResult {
  if (!value || value.trim().length === 0) {
    return { valid: false, message: 'Email is required.' }
  }

  // RFC-5321-inspired lightweight check: local@domain.tld
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(value.trim())) {
    return { valid: false, message: 'Please enter a valid email address.' }
  }

  return { valid: true }
}

// ---------------------------------------------------------------------------
// Password
// ---------------------------------------------------------------------------

/**
 * Validates a password.
 *
 * Rules:
 * - Minimum 8 characters.
 * - At least one uppercase letter (A–Z).
 * - At least one lowercase letter (a–z).
 * - At least one digit (0–9).
 *
 * Validates: Requirements 1.4, 6.4, 7.7
 */
export function validatePassword(value: string): ValidationResult {
  if (!value || value.length === 0) {
    return { valid: false, message: 'Password is required.' }
  }

  if (value.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long.' }
  }

  if (!/[A-Z]/.test(value)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter.' }
  }

  if (!/[a-z]/.test(value)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter.' }
  }

  if (!/[0-9]/.test(value)) {
    return { valid: false, message: 'Password must contain at least one digit.' }
  }

  return { valid: true }
}

// ---------------------------------------------------------------------------
// Display name
// ---------------------------------------------------------------------------

/**
 * Validates a display name.
 *
 * Rules:
 * - Must be a non-empty string (after trimming).
 * - Must be at most 50 characters.
 *
 * Validates: Requirements 1.5, 5.3
 */
export function validateDisplayName(value: string): ValidationResult {
  if (!value || value.trim().length === 0) {
    return { valid: false, message: 'Display name is required.' }
  }

  if (value.length > 50) {
    return { valid: false, message: 'Display name must be at most 50 characters.' }
  }

  return { valid: true }
}

// ---------------------------------------------------------------------------
// Avatar file
// ---------------------------------------------------------------------------

const ALLOWED_AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB

/**
 * Validates an avatar file before upload.
 *
 * Rules:
 * - MIME type must be `image/jpeg`, `image/png`, or `image/webp`.
 * - File size must not exceed 2 MB (2 × 1024 × 1024 bytes).
 *
 * Validates: Requirements 5.5
 */
export function validateAvatarFile(file: File): ValidationResult {
  if (!ALLOWED_AVATAR_MIME_TYPES.has(file.type)) {
    return {
      valid: false,
      message: 'Avatar must be a JPEG, PNG, or WebP image.',
    }
  }

  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    return {
      valid: false,
      message: 'Avatar image must not exceed 2 MB.',
    }
  }

  return { valid: true }
}

// ---------------------------------------------------------------------------
// Passwords match
// ---------------------------------------------------------------------------

/**
 * Validates that a password and its confirmation value are identical.
 *
 * Rules:
 * - `password` and `confirm` must be exactly equal (strict string equality).
 *
 * Validates: Requirements 6.5, 7.7
 */
export function validatePasswordsMatch(password: string, confirm: string): ValidationResult {
  if (password !== confirm) {
    return { valid: false, message: 'Passwords do not match.' }
  }

  return { valid: true }
}

// ---------------------------------------------------------------------------
// Sanitise display name
// ---------------------------------------------------------------------------

/**
 * Strips all HTML markup from a display name string, returning plain text only.
 *
 * Any `<tag>`, `</tag>`, or `<tag ... />` sequence — including attributes — is
 * removed. The result will contain no `<` or `>` characters.
 *
 * Implemented without external dependencies using a regex.
 *
 * Validates: Requirements 9.7
 */
export function sanitiseDisplayName(value: string): string {
  // Remove everything between (and including) < and > to strip all HTML tags
  // and their attributes. The `g` flag ensures all occurrences are replaced.
  return value.replace(/<[^>]*>/g, '')
}
