/**
 * Property-Based Test: Property 10 - Cross-user profile mutations are rejected with 403
 *
 * **Validates: Requirements 9.5**
 *
 * Property: For any profile mutation request where the target `profiles` record
 * ID does not match the authenticated user's ID, the Auth_Service must reject
 * the request and return a 403 response.
 *
 * Protected endpoints tested:
 *   - PATCH /api/account/profile — requires auth (401); validates ownership (403 if mismatch)
 *
 * Tag: Feature: user-account-management, Property 10: Cross-user profile mutations are rejected with 403
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import * as supabaseServer from '../../supabase/server'

// Mock the Supabase server client — must be declared before importing route handlers
vi.mock('../../supabase/server', () => ({
  createServerClient: vi.fn(),
}))

// Mock the Auth_Service so route handlers don't attempt real Supabase calls
vi.mock('../service', () => ({
  updateProfile: vi.fn(),
  uploadAvatar: vi.fn(),
}))

// Import route handlers after mocks are in place
import { PATCH as profilePATCH } from '../../../app/api/account/profile/route'

const mockCreateServerClient = vi.mocked(supabaseServer.createServerClient)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a mock Supabase client that returns the given user as authenticated.
 */
function buildAuthenticatedSupabaseClient(userId: string, email = 'user@example.com') {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: userId,
            email,
            aud: 'authenticated',
            role: 'authenticated',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            app_metadata: {},
            user_metadata: {},
          },
        },
        error: null,
      }),
    },
    from: vi.fn(),
    storage: { from: vi.fn() },
  }
}

/**
 * Creates a minimal NextRequest-like object for JSON body endpoints.
 */
function makeJsonRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/account/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates a pair of distinct UUIDs: [authenticatedUserId, targetUserId].
 * The filter ensures they are never equal, so every generated pair represents
 * a genuine cross-user mutation attempt.
 */
const distinctUuidPairArb = fc
  .tuple(fc.uuid(), fc.uuid())
  .filter(([a, b]) => a !== b)

/**
 * Generates optional profile mutation fields to vary the request body while
 * keeping the mismatched userId as the constant cross-user signal.
 */
const profileMutationFieldsArb = fc.record({
  display_name: fc.option(
    fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
    { nil: undefined }
  ),
  avatar_url: fc.option(fc.webUrl(), { nil: undefined }),
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Property 10: Cross-user profile mutations are rejected with 403', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // Core property: any mismatched userId in the request body returns 403
  // -------------------------------------------------------------------------
  it(
    'PATCH /api/account/profile — always returns 403 when userId in body does not match authenticated user',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          distinctUuidPairArb,
          profileMutationFieldsArb,
          async ([authenticatedUserId, targetUserId], fields) => {
            // Set up the mock to return the authenticated user
            mockCreateServerClient.mockReturnValue(
              buildAuthenticatedSupabaseClient(authenticatedUserId) as any
            )

            // Build request body with the mismatched targetUserId
            const body: Record<string, unknown> = { userId: targetUserId }
            if (fields.display_name !== undefined) body.display_name = fields.display_name
            if (fields.avatar_url !== undefined) body.avatar_url = fields.avatar_url

            const request = makeJsonRequest(body) as any
            const response = await profilePATCH(request)
            const json = await response.json()

            expect(response.status).toBe(403)
            expect(json.error).toBeDefined()
            expect(json.error.code).toBe('FORBIDDEN')

            return response.status === 403
          }
        ),
        { numRuns: 100, verbose: false }
      )
    }
  )

  // -------------------------------------------------------------------------
  // Variant: only userId in body (no other fields) — still rejected with 403
  // -------------------------------------------------------------------------
  it(
    'PATCH /api/account/profile — returns 403 with only mismatched userId and no other fields',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          distinctUuidPairArb,
          async ([authenticatedUserId, targetUserId]) => {
            mockCreateServerClient.mockReturnValue(
              buildAuthenticatedSupabaseClient(authenticatedUserId) as any
            )

            const request = makeJsonRequest({ userId: targetUserId }) as any
            const response = await profilePATCH(request)
            const json = await response.json()

            expect(response.status).toBe(403)
            expect(json.error).toBeDefined()
            expect(json.error.code).toBe('FORBIDDEN')
            expect(json.error.message).toBeTruthy()

            return response.status === 403
          }
        ),
        { numRuns: 100, verbose: false }
      )
    }
  )

  // -------------------------------------------------------------------------
  // Contrast: matching userId is NOT rejected with 403
  // (ensures the 403 is specifically triggered by the mismatch, not always)
  // -------------------------------------------------------------------------
  it(
    'PATCH /api/account/profile — does NOT return 403 when userId matches authenticated user',
    async () => {
      const { updateProfile } = await import('../service')
      const mockUpdateProfile = vi.mocked(updateProfile)

      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          async (userId, displayName) => {
            // Mock updateProfile to return a successful profile
            mockUpdateProfile.mockResolvedValue({
              id: userId,
              display_name: displayName,
              avatar_url: null,
              created_at: new Date().toISOString(),
            })

            mockCreateServerClient.mockReturnValue(
              buildAuthenticatedSupabaseClient(userId) as any
            )

            // Send request with matching userId — should NOT be 403
            const request = makeJsonRequest({
              userId,
              display_name: displayName,
            }) as any

            const response = await profilePATCH(request)

            expect(response.status).not.toBe(403)

            return response.status !== 403
          }
        ),
        { numRuns: 100, verbose: false }
      )
    }
  )
})
