/**
 * Shared TypeScript types for authentication and user profile entities.
 *
 * Validates: Requirements 1.2, 1.3, 1.4, 1.5, 2.4, 5.3, 5.5, 6.4, 6.5, 7.3, 7.7, 9.4, 9.5
 */

/**
 * A user's public profile record stored in the `profiles` table.
 * Extends the Supabase Auth identity with display name and avatar.
 *
 * Validates: Requirements 1.2, 2.1
 */
export interface Profile {
  id: string
  display_name: string
  avatar_url: string | null
  created_at: string
}

/**
 * A fully-hydrated user combining Supabase Auth identity with their profile
 * and the authentication provider used.
 *
 * Validates: Requirements 1.2, 3.1
 */
export interface UserWithProfile {
  id: string
  email: string
  profile: Profile
  provider: 'email' | 'google'
}

/**
 * Discriminated union of all possible authentication error codes.
 * Used to map server-side errors to user-facing messages without leaking
 * sensitive information (e.g. credential failures always use INVALID_CREDENTIALS).
 *
 * Validates: Requirements 1.3, 1.4, 5.5, 6.4, 7.3, 9.4, 9.5
 */
export type AuthErrorCode =
  | 'EMAIL_ALREADY_EXISTS'
  | 'INVALID_CREDENTIALS'
  | 'WEAK_PASSWORD'
  | 'INVALID_EMAIL'
  | 'DISPLAY_NAME_INVALID'
  | 'WRONG_CURRENT_PASSWORD'
  | 'PASSWORD_MISMATCH'
  | 'AVATAR_TOO_LARGE'
  | 'AVATAR_INVALID_FORMAT'
  | 'RESET_LINK_EXPIRED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'UNKNOWN'

/**
 * Structured error returned by Auth_Service operations.
 * The optional `field` property enables inline field-level error display
 * in forms, associated via `aria-describedby` for accessibility.
 *
 * Validates: Requirements 1.3, 1.4, 6.4, 7.3
 */
export interface AuthError {
  code: AuthErrorCode
  message: string
  field?:
    | 'email'
    | 'password'
    | 'display_name'
    | 'current_password'
    | 'new_password'
    | 'confirm_new_password'
}

/**
 * Result type returned by Validator functions.
 * A discriminated union that carries an error message only on failure,
 * keeping the success path lightweight.
 *
 * Validates: Requirements 1.3, 1.4, 1.5, 2.4, 5.3, 6.4, 7.3
 */
export type ValidationResult = { valid: true } | { valid: false; message: string }

/**
 * Partial update payload for a user's profile.
 * All fields are optional — only provided fields are written to the database.
 *
 * Validates: Requirements 2.1, 2.4, 5.3
 */
export type ProfileUpdateData = {
  display_name?: string
  avatar_url?: string
}

/**
 * Result type returned by Auth_Service registration and login operations.
 * On success, carries the authenticated user and session; on failure, carries
 * a structured AuthError.
 *
 * Validates: Requirements 1.2, 1.5
 */
export type AuthResult =
  | { user: { id: string; email: string }; session: unknown }
  | { error: AuthError }
