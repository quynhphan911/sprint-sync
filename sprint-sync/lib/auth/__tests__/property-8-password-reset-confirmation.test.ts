/**
 * Property-Based Test: Property 8 - Password reset confirmation is always shown
 *
 * **Validates: Requirements 7.4**
 *
 * Property: For any email string submitted to the password reset request form —
 * whether or not it corresponds to an existing account — the application must
 * display the confirmation message instructing the user to check their email.
 *
 * This is verified by asserting that `requestPasswordReset` always resolves
 * without throwing for any email string (valid or invalid format), because the
 * confirmation message must always be shown regardless of whether the email
 * exists in the system.
 *
 * Tag: Feature: user-account-management, Property 8: Password reset confirmation is always shown
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { requestPasswordReset } from '../service'
import { propertyTestConfig } from './fast-check-config'
import * as supabaseServer from '../../supabase/server'

// Mock the Supabase server client
vi.mock('../../supabase/server', () => ({
  createServerClient: vi.fn(),
}))

const mockCreateServerClient = vi.mocked(supabaseServer.createServerClient)

describe('Property 8: Password reset confirmation is always shown', () => {
  let mockSupabaseClient: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Create a fresh mock Supabase client for each test
    mockSupabaseClient = {
      auth: {
        resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
      },
    }

    mockCreateServerClient.mockReturnValue(mockSupabaseClient)
  })

  it('should always resolve without throwing for any valid email string', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary valid-format email strings
        fc.emailAddress(),
        async (email) => {
          // Act: call requestPasswordReset — must never throw/reject
          let threw = false
          try {
            await requestPasswordReset(email)
          } catch {
            threw = true
          }

          // Assert: the function resolved (confirmation message would be shown)
          expect(threw).toBe(false)

          // Property holds: no exception was thrown
          return !threw
        }
      ),
      propertyTestConfig
    )
  })

  it('should always resolve without throwing for arbitrary email strings (valid and invalid formats)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary strings — includes invalid email formats
        fc.string(),
        async (email) => {
          // Act: call requestPasswordReset — must never throw/reject
          let threw = false
          try {
            await requestPasswordReset(email)
          } catch {
            threw = true
          }

          // Assert: the function resolved (confirmation message would always be shown)
          expect(threw).toBe(false)

          // Property holds: no exception was thrown for any input
          return !threw
        }
      ),
      propertyTestConfig
    )
  })

  it('should always resolve for non-existent account emails (Supabase returns no error)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        async (email) => {
          // Arrange: Supabase always resolves successfully regardless of whether
          // the email corresponds to an existing account (this is the real
          // Supabase behaviour — it never reveals whether an email exists)
          mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({
            data: {},
            error: null,
          })

          // Act
          let threw = false
          try {
            await requestPasswordReset(email)
          } catch {
            threw = true
          }

          // Assert: resolved — confirmation message would be shown
          expect(threw).toBe(false)

          // Assert: Supabase resetPasswordForEmail was called with the email
          // (for valid emails — the service validates before calling Supabase)
          // The key property is that the caller always gets a resolved promise.
          return !threw
        }
      ),
      propertyTestConfig
    )
  })

  it('should always resolve even when Supabase resetPasswordForEmail returns an error', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        async (email) => {
          // Arrange: Supabase returns an error (e.g. rate limit, network issue)
          // The service intentionally ignores this error to prevent email enumeration
          mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({
            data: null,
            error: { message: 'Rate limit exceeded', status: 429 },
          })

          // Act
          let threw = false
          try {
            await requestPasswordReset(email)
          } catch {
            threw = true
          }

          // Assert: still resolves — the confirmation message must always be shown
          // regardless of internal Supabase errors
          expect(threw).toBe(false)

          return !threw
        }
      ),
      propertyTestConfig
    )
  })
})
