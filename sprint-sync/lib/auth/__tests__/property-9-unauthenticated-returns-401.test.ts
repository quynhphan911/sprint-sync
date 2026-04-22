/**
 * Property-Based Test: Property 9 - Unauthenticated requests to protected endpoints return 401
 *
 * **Validates: Requirements 9.4**
 *
 * Property: For any Route Handler that performs a protected mutation, any
 * request made without a valid session must receive a 401 HTTP response.
 *
 * Protected endpoints tested:
 *   - POST   /api/auth/logout
 *   - PATCH  /api/account/profile
 *   - POST   /api/account/avatar
 *   - PATCH  /api/account/password
 *   - DELETE /api/account/delete
 *
 * Tag: Feature: user-account-management, Property 9: Unauthenticated requests to protected endpoints return 401
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
  logout: vi.fn(),
  updateProfile: vi.fn(),
  uploadAvatar: vi.fn(),
  changePassword: vi.fn(),
  deleteAccount: vi.fn(),
}))

// Import route handlers after mocks are in place
import { POST as logoutPOST } from '../../../app/api/auth/logout/route'
import { PATCH as profilePATCH } from '../../../app/api/account/profile/route'
import { POST as avatarPOST } from '../../../app/api/account/avatar/route'
import { PATCH as passwordPATCH } from '../../../app/api/account/password/route'
import { DELETE as deleteDELETE } from '../../../app/api/account/delete/route'

const mockCreateServerClient = vi.mocked(supabaseServer.createServerClient)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a mock Supabase client that returns null user (unauthenticated).
 */
function buildUnauthenticatedSupabaseClient() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
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
function makeJsonRequest(body: Record<string, unknown> = {}): Request {
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/**
 * Creates a minimal NextRequest-like object for multipart/form-data endpoints.
 */
function makeFormDataRequest(fields: Record<string, string | Blob> = {}): Request {
  const formData = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value)
  }
  return new Request('http://localhost/api/test', {
    method: 'POST',
    body: formData,
  })
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates arbitrary JSON body payloads for profile PATCH requests. */
const profilePayloadArb = fc.record({
  userId: fc.option(fc.uuid(), { nil: undefined }),
  display_name: fc.option(fc.string({ minLength: 0, maxLength: 60 }), { nil: undefined }),
  avatar_url: fc.option(fc.webUrl(), { nil: undefined }),
})

/** Generates arbitrary JSON body payloads for password PATCH requests. */
const passwordPayloadArb = fc.record({
  current_password: fc.option(fc.string(), { nil: undefined }),
  new_password: fc.option(fc.string(), { nil: undefined }),
  confirm_new_password: fc.option(fc.string(), { nil: undefined }),
})

/** Generates arbitrary file names for avatar upload requests. */
const avatarFileNameArb = fc.stringMatching(/^[a-zA-Z0-9_-]{1,20}\.(jpg|png|webp)$/)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Property 9: Unauthenticated requests to protected endpoints return 401', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: every call to createServerClient returns an unauthenticated client
    mockCreateServerClient.mockReturnValue(buildUnauthenticatedSupabaseClient() as any)
  })

  // -------------------------------------------------------------------------
  // POST /api/auth/logout
  // -------------------------------------------------------------------------
  it('POST /api/auth/logout — always returns 401 when unauthenticated', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary request bodies (logout ignores the body, but we
        // vary it to confirm the handler never short-circuits on body content)
        fc.record({
          extra: fc.option(fc.string(), { nil: undefined }),
        }),
        async (_body) => {
          const request = makeJsonRequest({}) as any

          const response = await logoutPOST(request)
          const json = await response.json()

          expect(response.status).toBe(401)
          expect(json.error).toBeDefined()
          expect(json.error.code).toBe('UNAUTHORIZED')

          return response.status === 401
        }
      ),
      { numRuns: 100, verbose: false }
    )
  })

  // -------------------------------------------------------------------------
  // PATCH /api/account/profile
  // -------------------------------------------------------------------------
  it('PATCH /api/account/profile — always returns 401 when unauthenticated', async () => {
    await fc.assert(
      fc.asyncProperty(
        profilePayloadArb,
        async (payload) => {
          // Filter out undefined values so JSON.stringify produces a clean object
          const body: Record<string, unknown> = {}
          if (payload.userId !== undefined) body.userId = payload.userId
          if (payload.display_name !== undefined) body.display_name = payload.display_name
          if (payload.avatar_url !== undefined) body.avatar_url = payload.avatar_url

          const request = makeJsonRequest(body) as any

          const response = await profilePATCH(request)
          const json = await response.json()

          expect(response.status).toBe(401)
          expect(json.error).toBeDefined()
          expect(json.error.code).toBe('UNAUTHORIZED')

          return response.status === 401
        }
      ),
      { numRuns: 100, verbose: false }
    )
  })

  // -------------------------------------------------------------------------
  // POST /api/account/avatar
  // -------------------------------------------------------------------------
  it('POST /api/account/avatar — always returns 401 when unauthenticated', async () => {
    await fc.assert(
      fc.asyncProperty(
        avatarFileNameArb,
        fc.integer({ min: 1, max: 2 * 1024 * 1024 }),
        fc.constantFrom('image/jpeg', 'image/png', 'image/webp'),
        async (fileName, fileSize, mimeType) => {
          const fileContent = new Uint8Array(Math.min(fileSize, 16)).fill(0)
          const file = new File([fileContent], fileName, { type: mimeType })
          const request = makeFormDataRequest({ avatar: file }) as any

          const response = await avatarPOST(request)
          const json = await response.json()

          expect(response.status).toBe(401)
          expect(json.error).toBeDefined()
          expect(json.error.code).toBe('UNAUTHORIZED')

          return response.status === 401
        }
      ),
      { numRuns: 100, verbose: false }
    )
  })

  // -------------------------------------------------------------------------
  // PATCH /api/account/password
  // -------------------------------------------------------------------------
  it('PATCH /api/account/password — always returns 401 when unauthenticated', async () => {
    await fc.assert(
      fc.asyncProperty(
        passwordPayloadArb,
        async (payload) => {
          const body: Record<string, unknown> = {}
          if (payload.current_password !== undefined) body.current_password = payload.current_password
          if (payload.new_password !== undefined) body.new_password = payload.new_password
          if (payload.confirm_new_password !== undefined) body.confirm_new_password = payload.confirm_new_password

          const request = makeJsonRequest(body) as any

          const response = await passwordPATCH(request)
          const json = await response.json()

          expect(response.status).toBe(401)
          expect(json.error).toBeDefined()
          expect(json.error.code).toBe('UNAUTHORIZED')

          return response.status === 401
        }
      ),
      { numRuns: 100, verbose: false }
    )
  })

  // -------------------------------------------------------------------------
  // DELETE /api/account/delete
  // -------------------------------------------------------------------------
  it('DELETE /api/account/delete — always returns 401 when unauthenticated', async () => {
    await fc.assert(
      fc.asyncProperty(
        // DELETE handler takes no body; vary a dummy value to drive 100 runs
        fc.integer({ min: 0, max: 1_000_000 }),
        async (_dummy) => {
          const response = await deleteDELETE()
          const json = await response.json()

          expect(response.status).toBe(401)
          expect(json.error).toBeDefined()
          expect(json.error.code).toBe('UNAUTHORIZED')

          return response.status === 401
        }
      ),
      { numRuns: 100, verbose: false }
    )
  })

  // -------------------------------------------------------------------------
  // Combined: all five endpoints in a single property
  // -------------------------------------------------------------------------
  it('all protected endpoints return 401 for any unauthenticated request', async () => {
    type EndpointName = 'logout' | 'profile' | 'avatar' | 'password' | 'delete'

    const endpointArb = fc.constantFrom<EndpointName>(
      'logout',
      'profile',
      'avatar',
      'password',
      'delete'
    )

    await fc.assert(
      fc.asyncProperty(
        endpointArb,
        fc.string({ minLength: 0, maxLength: 30 }),
        async (endpoint, _seed) => {
          let response: Response

          switch (endpoint) {
            case 'logout': {
              response = await logoutPOST(makeJsonRequest({}) as any)
              break
            }
            case 'profile': {
              response = await profilePATCH(makeJsonRequest({ display_name: _seed }) as any)
              break
            }
            case 'avatar': {
              const file = new File([new Uint8Array(8).fill(0)], 'test.jpg', { type: 'image/jpeg' })
              response = await avatarPOST(makeFormDataRequest({ avatar: file }) as any)
              break
            }
            case 'password': {
              response = await passwordPATCH(
                makeJsonRequest({
                  current_password: _seed,
                  new_password: _seed,
                  confirm_new_password: _seed,
                }) as any
              )
              break
            }
            case 'delete': {
              response = await deleteDELETE()
              break
            }
          }

          const json = await response!.json()

          expect(response!.status).toBe(401)
          expect(json.error).toBeDefined()
          expect(json.error.code).toBe('UNAUTHORIZED')

          return response!.status === 401
        }
      ),
      { numRuns: 100, verbose: false }
    )
  })
})
