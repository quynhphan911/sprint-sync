/**
 * Property-Based Test: Property 1 - Valid registration creates a profile
 * 
 * **Validates: Requirements 1.2**
 * 
 * Property: For any valid combination of email, password, and display name,
 * a successful registration call must result in a `profiles` record existing
 * for the new user with the exact display name provided.
 * 
 * Tag: Feature: user-account-management, Property 1: Valid registration creates a profile
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { registerWithEmail } from '../service'
import {
  propertyTestConfig,
  validEmail,
  validPassword,
  validDisplayName,
} from './fast-check-config'
import { sanitiseDisplayName } from '../validators'

// Mock the Supabase server client
vi.mock('../../supabase/server', () => ({
  createServerClient: vi.fn(),
}))

describe('Property 1: Valid registration creates a profile', () => {
  let mockSupabaseClient: any

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()

    // Create a fresh mock Supabase client for each test
    mockSupabaseClient = {
      auth: {
        signUp: vi.fn(),
      },
      from: vi.fn(),
    }

    // Mock the createServerClient to return our mock client
    const { createServerClient } = require('../../supabase/server')
    createServerClient.mockReturnValue(mockSupabaseClient)
  })

  it('should create a profile record with correct display name for any valid registration', async () => {
    await fc.assert(
      fc.asyncProperty(
        validEmail(),
        validPassword(),
        validDisplayName(),
        async (email, password, displayName) => {
          // Arrange: Mock successful Supabase Auth user creation
          const mockUserId = `user-${Math.random().toString(36).substring(7)}`
          const mockSession = {
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token',
            expires_in: 3600,
            token_type: 'bearer',
            user: {
              id: mockUserId,
              email,
              aud: 'authenticated',
              role: 'authenticated',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              app_metadata: {},
              user_metadata: {},
            },
          }

          mockSupabaseClient.auth.signUp.mockResolvedValue({
            data: {
              user: { id: mockUserId, email },
              session: mockSession,
            },
            error: null,
          })

          // Mock the profiles table insert
          const mockProfileInsert = vi.fn().mockResolvedValue({
            data: null,
            error: null,
          })

          mockSupabaseClient.from.mockReturnValue({
            insert: mockProfileInsert,
          })

          // Act: Call registerWithEmail
          const result = await registerWithEmail(email, password, displayName)

          // Assert: Registration succeeded
          expect('user' in result).toBe(true)
          if ('user' in result) {
            expect(result.user.id).toBe(mockUserId)
            expect(result.user.email).toBe(email)
          }

          // Assert: Supabase Auth signUp was called with correct parameters
          expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
            email,
            password,
            options: {
              data: {
                display_name: sanitiseDisplayName(displayName),
              },
            },
          })

          // Assert: profiles table insert was called
          expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles')
          expect(mockProfileInsert).toHaveBeenCalledWith({
            id: mockUserId,
            display_name: sanitiseDisplayName(displayName),
            avatar_url: null,
          })

          // Property holds: profile record was created with exact sanitised display name
          const insertCall = mockProfileInsert.mock.calls[0][0]
          return insertCall.display_name === sanitiseDisplayName(displayName)
        }
      ),
      propertyTestConfig
    )
  })
})
