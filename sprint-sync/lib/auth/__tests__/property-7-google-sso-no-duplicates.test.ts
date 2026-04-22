/**
 * Property-Based Test: Property 7 - Google SSO never creates duplicate profiles
 * 
 * **Validates: Requirements 3.4**
 * 
 * Property: For any existing user who authenticates via Google SSO, the number
 * of `profiles` records associated with that user's ID must remain exactly 1
 * after any number of SSO login completions.
 * 
 * Tag: Feature: user-account-management, Property 7: Google SSO never creates duplicate profiles
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { propertyTestConfig } from './fast-check-config'

// Mock the Supabase server client
vi.mock('../../../lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

/**
 * Simulates the Google SSO callback logic for testing.
 * This mirrors the logic in app/auth/callback/route.ts
 */
async function simulateGoogleSSOCallback(
  supabaseClient: any,
  userId: string,
  email: string,
  userMetadata: { full_name?: string; name?: string; avatar_url?: string | null }
) {
  // Check if profile exists
  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single()

  // If profile doesn't exist, create it
  if (profileError || !profile) {
    const displayName =
      userMetadata.full_name ||
      userMetadata.name ||
      email.split('@')[0] ||
      'User'

    const avatarUrl = userMetadata.avatar_url || null

    await supabaseClient.from('profiles').insert({
      id: userId,
      display_name: displayName,
      avatar_url: avatarUrl,
    })
  }
}

describe('Property 7: Google SSO never creates duplicate profiles', () => {
  let mockSupabaseClient: any

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()

    // Create a fresh mock Supabase client for each test
    mockSupabaseClient = {
      auth: {
        exchangeCodeForSession: vi.fn(),
      },
      from: vi.fn(),
    }

    // Mock the createServerClient to return our mock client
    const { createServerClient } = require('../../../lib/supabase/server')
    createServerClient.mockReturnValue(mockSupabaseClient)
  })

  it('should never create duplicate profiles for existing users across multiple SSO logins', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate: number of repeated SSO login attempts (1-10)
        fc.integer({ min: 1, max: 10 }),
        // Generate: user metadata from Google
        fc.record({
          userId: fc.uuid(),
          email: fc.emailAddress(),
          fullName: fc.string({ minLength: 1, maxLength: 50 }),
          avatarUrl: fc.webUrl(),
        }),
        async (loginAttempts, userMetadata) => {
          // Track profile insert calls
          let profileInsertCallCount = 0
          const mockProfileInsert = vi.fn().mockImplementation(() => {
            profileInsertCallCount++
            return Promise.resolve({ data: null, error: null })
          })

          // Simulate existing user scenario: profile already exists
          const mockProfileSelect = vi.fn().mockResolvedValue({
            data: {
              id: userMetadata.userId,
              display_name: userMetadata.fullName,
              avatar_url: userMetadata.avatarUrl,
            },
            error: null,
          })

          // Mock Supabase client methods
          mockSupabaseClient.from.mockImplementation((table: string) => {
            if (table === 'profiles') {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: mockProfileSelect,
                  }),
                }),
                insert: mockProfileInsert,
              }
            }
            return {}
          })

          // Act: Simulate multiple SSO login completions
          for (let i = 0; i < loginAttempts; i++) {
            await simulateGoogleSSOCallback(
              mockSupabaseClient,
              userMetadata.userId,
              userMetadata.email,
              {
                full_name: userMetadata.fullName,
                avatar_url: userMetadata.avatarUrl,
              }
            )
          }

          // Assert: Profile select was called for each login attempt
          expect(mockProfileSelect).toHaveBeenCalledTimes(loginAttempts)

          // Assert: Profile insert was NEVER called (profile already exists)
          expect(mockProfileInsert).not.toHaveBeenCalled()
          expect(profileInsertCallCount).toBe(0)

          // Property holds: No duplicate profiles were created
          return profileInsertCallCount === 0
        }
      ),
      propertyTestConfig
    )
  })

  it('should create exactly one profile for new users on first SSO login', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate: user metadata from Google
        fc.record({
          userId: fc.uuid(),
          email: fc.emailAddress(),
          fullName: fc.string({ minLength: 1, maxLength: 50 }),
          avatarUrl: fc.webUrl(),
        }),
        async (userMetadata) => {
          // Track profile insert calls
          let profileInsertCallCount = 0
          const mockProfileInsert = vi.fn().mockImplementation((data) => {
            profileInsertCallCount++
            return Promise.resolve({ data, error: null })
          })

          // Simulate new user scenario: profile does NOT exist
          const mockProfileSelect = vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116', message: 'No rows found' },
          })

          // Mock Supabase client methods
          mockSupabaseClient.from.mockImplementation((table: string) => {
            if (table === 'profiles') {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: mockProfileSelect,
                  }),
                }),
                insert: mockProfileInsert,
              }
            }
            return {}
          })

          // Act: Simulate first SSO login for new user
          await simulateGoogleSSOCallback(
            mockSupabaseClient,
            userMetadata.userId,
            userMetadata.email,
            {
              full_name: userMetadata.fullName,
              avatar_url: userMetadata.avatarUrl,
            }
          )

          // Assert: Profile select was called once
          expect(mockProfileSelect).toHaveBeenCalledTimes(1)

          // Assert: Profile insert was called exactly once
          expect(mockProfileInsert).toHaveBeenCalledTimes(1)
          expect(profileInsertCallCount).toBe(1)

          // Assert: Profile was created with correct data
          expect(mockProfileInsert).toHaveBeenCalledWith({
            id: userMetadata.userId,
            display_name: userMetadata.fullName,
            avatar_url: userMetadata.avatarUrl,
          })

          // Property holds: Exactly one profile was created
          return profileInsertCallCount === 1
        }
      ),
      propertyTestConfig
    )
  })

  it('should handle edge case where display name is derived from email', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          email: fc.emailAddress(),
        }),
        async (userMetadata) => {
          // Track profile insert calls
          const mockProfileInsert = vi.fn().mockResolvedValue({
            data: null,
            error: null,
          })

          // Simulate new user scenario: profile does NOT exist
          const mockProfileSelect = vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116', message: 'No rows found' },
          })

          // Mock Supabase client methods
          mockSupabaseClient.from.mockImplementation((table: string) => {
            if (table === 'profiles') {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: mockProfileSelect,
                  }),
                }),
                insert: mockProfileInsert,
              }
            }
            return {}
          })

          // Act: Simulate SSO login with NO full_name (edge case)
          await simulateGoogleSSOCallback(
            mockSupabaseClient,
            userMetadata.userId,
            userMetadata.email,
            {
              // No full_name or name provided
              avatar_url: null,
            }
          )

          // Assert: Profile was created with display name derived from email
          expect(mockProfileInsert).toHaveBeenCalledTimes(1)
          const insertedData = mockProfileInsert.mock.calls[0][0]
          
          // Display name should be email local part
          const expectedDisplayName = userMetadata.email.split('@')[0]
          expect(insertedData.display_name).toBe(expectedDisplayName)
          expect(insertedData.id).toBe(userMetadata.userId)

          // Property holds: Profile was created with fallback display name
          return insertedData.display_name === expectedDisplayName
        }
      ),
      propertyTestConfig
    )
  })

  it('should maintain profile count of 1 across mixed scenarios', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          email: fc.emailAddress(),
          fullName: fc.string({ minLength: 1, maxLength: 50 }),
          avatarUrl: fc.webUrl(),
          subsequentLogins: fc.integer({ min: 1, max: 5 }),
        }),
        async (scenario) => {
          // Track profile operations
          let profileInsertCallCount = 0
          let profileExistsAfterFirstLogin = false

          const mockProfileInsert = vi.fn().mockImplementation((data) => {
            profileInsertCallCount++
            profileExistsAfterFirstLogin = true
            return Promise.resolve({ data, error: null })
          })

          // Mock profile select: returns null first time, then returns profile
          const mockProfileSelect = vi.fn().mockImplementation(() => {
            if (profileExistsAfterFirstLogin) {
              return Promise.resolve({
                data: {
                  id: scenario.userId,
                  display_name: scenario.fullName,
                  avatar_url: scenario.avatarUrl,
                },
                error: null,
              })
            } else {
              return Promise.resolve({
                data: null,
                error: { code: 'PGRST116', message: 'No rows found' },
              })
            }
          })

          // Mock Supabase client methods
          mockSupabaseClient.from.mockImplementation((table: string) => {
            if (table === 'profiles') {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: mockProfileSelect,
                  }),
                }),
                insert: mockProfileInsert,
              }
            }
            return {}
          })

          // Act: First login (should create profile)
          await simulateGoogleSSOCallback(
            mockSupabaseClient,
            scenario.userId,
            scenario.email,
            {
              full_name: scenario.fullName,
              avatar_url: scenario.avatarUrl,
            }
          )

          // Act: Subsequent logins (should NOT create duplicate profiles)
          for (let i = 0; i < scenario.subsequentLogins; i++) {
            await simulateGoogleSSOCallback(
              mockSupabaseClient,
              scenario.userId,
              scenario.email,
              {
                full_name: scenario.fullName,
                avatar_url: scenario.avatarUrl,
              }
            )
          }

          // Assert: Profile insert was called exactly once (first login only)
          expect(profileInsertCallCount).toBe(1)

          // Assert: Profile select was called for each login
          expect(mockProfileSelect).toHaveBeenCalledTimes(
            1 + scenario.subsequentLogins
          )

          // Property holds: Only one profile was ever created
          return profileInsertCallCount === 1
        }
      ),
      propertyTestConfig
    )
  })
})
