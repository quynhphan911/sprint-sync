/**
 * Test utilities for authentication tests.
 * Provides mock factories and helpers for unit and property-based tests.
 */

import type { AuthResult, Profile } from '../../../types/auth'

// ---------------------------------------------------------------------------
// Mock Factories
// ---------------------------------------------------------------------------

/**
 * Creates a mock successful AuthResult for testing.
 */
export function createMockAuthResult(overrides?: {
  userId?: string
  email?: string
}): AuthResult {
  return {
    user: {
      id: overrides?.userId || 'test-user-id',
      email: overrides?.email || 'test@example.com',
    },
    session: {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: overrides?.userId || 'test-user-id',
        email: overrides?.email || 'test@example.com',
        aud: 'authenticated',
        role: 'authenticated',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        app_metadata: {},
        user_metadata: {},
      },
    },
  }
}

/**
 * Creates a mock Profile for testing.
 */
export function createMockProfile(overrides?: {
  id?: string
  displayName?: string
  avatarUrl?: string | null
}): Profile {
  return {
    id: overrides?.id || 'test-user-id',
    display_name: overrides?.displayName || 'Test User',
    avatar_url: overrides?.avatarUrl !== undefined ? overrides.avatarUrl : null,
    created_at: new Date().toISOString(),
  }
}

/**
 * Creates a mock File object for avatar upload testing.
 */
export function createMockFile(
  name: string,
  size: number,
  type: string,
  content?: string
): File {
  const blob = new Blob([content || 'mock file content'], { type })
  // Create a File object with the specified properties
  const file = new File([blob], name, { type })
  
  // Override the size property (File size is normally read-only)
  Object.defineProperty(file, 'size', {
    value: size,
    writable: false,
  })
  
  return file
}

// ---------------------------------------------------------------------------
// Assertion Helpers
// ---------------------------------------------------------------------------

/**
 * Asserts that a value is an AuthError result.
 */
export function isAuthError(result: unknown): result is { error: { code: string; message: string } } {
  return (
    typeof result === 'object' &&
    result !== null &&
    'error' in result &&
    typeof (result as any).error === 'object' &&
    'code' in (result as any).error &&
    'message' in (result as any).error
  )
}

/**
 * Asserts that a value is a successful AuthResult.
 */
export function isAuthSuccess(result: unknown): result is AuthResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    'user' in result &&
    'session' in result
  )
}
