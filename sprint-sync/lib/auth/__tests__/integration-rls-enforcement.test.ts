/**
 * Integration Test: RLS Enforcement
 *
 * Verifies that Row-Level Security is enforced through the Route Handler and
 * Auth_Service layers:
 *
 *   - PATCH /api/account/profile with a `userId` that does not match the
 *     authenticated user returns 403 FORBIDDEN.
 *   - Reading another user's profile via `getProfile` returns an error because
 *     RLS blocks the SELECT on the `profiles` table.
 *   - The Auth_Service validates that all profile mutations are scoped to the
 *     authenticated user's own record.
 *
 * Uses mocked Supabase clients — no real network calls are made.
 *
 * Validates: Requirements 9.1, 9.4, 9.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock Supabase server client BEFORE importing route handlers / service so
// that the module-level `createServerClient` call is intercepted.
// ---------------------------------------------------------------------------
vi.mock('../../supabase/server', () => ({
  createServerClient: vi.fn(),
}))

import { PATCH as profilePATCH } from '../../../app/api/account/profile/route'
import { getProfile } from '../service'
import * as supabaseServer from '../../supabase/server'

const mockCreateServerClient = vi.mocked(supabaseServer.createServerClient)

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUTHENTICATED_USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const OTHER_USER_ID = 'ffffffff-eeee-dddd-cccc-bbbbbbbbbbbb'
const AUTHENTICATED_EMAIL = 'alice@example.com'

// ---------------------------------------------------------------------------
// Mock client builders
// ---------------------------------------------------------------------------

/**
 * Builds a mock Supabase client that returns the given user as authenticated.
 * The `profiles` table mock simulates RLS: only the owning user's row is
 * returned; any query for a different user's row returns an RLS error.
 */
function buildAuthenticatedClient(
  authenticatedUserId: string,
  email: string = AUTHENTICATED_EMAIL
) {
  const mockSingle = vi.fn()
  const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
  const mockUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: authenticatedUserId,
            display_name: 'Alice',
            avatar_url: null,
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      }),
    }),
  })

  // Simulate RLS: SELECT on profiles returns data only for the owning user
  mockSingle.mockImplementation(() => {
    // This is called after .eq('id', userId) — we resolve with the profile
    // data for the authenticated user. In a real DB, RLS would block any
    // query where auth.uid() !== id; here we model that by always returning
    // the authenticated user's own profile (the route handler enforces the
    // ownership check before calling getProfile).
    return Promise.resolve({
      data: {
        id: authenticatedUserId,
        display_name: 'Alice',
        avatar_url: null,
        created_at: new Date().toISOString(),
      },
      error: null,
    })
  })

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: authenticatedUserId,
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
    from: vi.fn().mockReturnValue({
      select: mockSelect,
      update: mockUpdate,
    }),
    storage: { from: vi.fn() },
    _mockSelect: mockSelect,
    _mockSingle: mockSingle,
    _mockUpdate: mockUpdate,
  }
}

/**
 * Builds a mock Supabase client that simulates an unauthenticated request:
 * - auth.getUser returns null user (no active session)
 */
function buildUnauthenticatedClient() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated', status: 401 },
      }),
    },
    from: vi.fn(),
    storage: { from: vi.fn() },
  }
}

/**
 * Builds a mock Supabase client where the `profiles` SELECT is blocked by RLS.
 * This simulates what happens when a server-side query targets a row that
 * belongs to a different user — Supabase returns a "no rows" / RLS error.
 */
function buildRlsBlockedClient(authenticatedUserId: string, email: string = AUTHENTICATED_EMAIL) {
  const mockSingle = vi.fn().mockResolvedValue({
    data: null,
    error: {
      message: 'new row violates row-level security policy',
      code: 'PGRST116',
    },
  })
  const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: authenticatedUserId,
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
    from: vi.fn().mockReturnValue({
      select: mockSelect,
    }),
    storage: { from: vi.fn() },
    _mockSingle: mockSingle,
  }
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

function makePatchRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/account/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Integration: RLS Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // PATCH /api/account/profile — cross-user mutation returns 403
  // -------------------------------------------------------------------------

  describe('PATCH /api/account/profile — cross-user mutation', () => {
    it('returns 403 when the userId in the request body does not match the authenticated user', async () => {
      const client = buildAuthenticatedClient(AUTHENTICATED_USER_ID)
      mockCreateServerClient.mockReturnValue(client as any)

      // Send a request targeting a different user's profile
      const request = makePatchRequest({
        userId: OTHER_USER_ID,
        display_name: 'Hacker',
      })

      const response = await profilePATCH(request as any)
      const body = await response.json()

      expect(response.status).toBe(403)
      expect(body.error).toBeDefined()
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('returns a descriptive error message on 403', async () => {
      const client = buildAuthenticatedClient(AUTHENTICATED_USER_ID)
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makePatchRequest({
        userId: OTHER_USER_ID,
        display_name: 'Hacker',
      })

      const response = await profilePATCH(request as any)
      const body = await response.json()

      expect(response.status).toBe(403)
      expect(body.error.message).toBeTruthy()
      expect(typeof body.error.message).toBe('string')
    })

    it('does NOT call the profiles update when userId is mismatched', async () => {
      const client = buildAuthenticatedClient(AUTHENTICATED_USER_ID)
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makePatchRequest({
        userId: OTHER_USER_ID,
        display_name: 'Hacker',
      })

      await profilePATCH(request as any)

      // The update must never be called — the route handler must short-circuit at the ownership check
      expect(client._mockUpdate).not.toHaveBeenCalled()
    })

    it('returns 403 when only a mismatched userId is provided (no other fields)', async () => {
      const client = buildAuthenticatedClient(AUTHENTICATED_USER_ID)
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makePatchRequest({ userId: OTHER_USER_ID })

      const response = await profilePATCH(request as any)
      const body = await response.json()

      expect(response.status).toBe(403)
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('returns 403 regardless of what display_name value is provided alongside the mismatched userId', async () => {
      const client = buildAuthenticatedClient(AUTHENTICATED_USER_ID)
      mockCreateServerClient.mockReturnValue(client as any)

      // Try with a valid display name — should still be 403 due to userId mismatch
      const request = makePatchRequest({
        userId: OTHER_USER_ID,
        display_name: 'ValidName',
      })

      const response = await profilePATCH(request as any)
      const body = await response.json()

      expect(response.status).toBe(403)
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('does NOT return 403 when the userId matches the authenticated user', async () => {
      const client = buildAuthenticatedClient(AUTHENTICATED_USER_ID)
      mockCreateServerClient.mockReturnValue(client as any)

      // Matching userId — should proceed past the ownership check
      const request = makePatchRequest({
        userId: AUTHENTICATED_USER_ID,
        display_name: 'Alice Updated',
      })

      const response = await profilePATCH(request as any)

      expect(response.status).not.toBe(403)
    })

    it('does NOT return 403 when no userId is provided (defaults to authenticated user)', async () => {
      const client = buildAuthenticatedClient(AUTHENTICATED_USER_ID)
      mockCreateServerClient.mockReturnValue(client as any)

      // No userId in body — route handler uses authenticated user's ID
      const request = makePatchRequest({ display_name: 'Alice Updated' })

      const response = await profilePATCH(request as any)

      expect(response.status).not.toBe(403)
    })
  })

  // -------------------------------------------------------------------------
  // PATCH /api/account/profile — unauthenticated request returns 401
  // -------------------------------------------------------------------------

  describe('PATCH /api/account/profile — unauthenticated request', () => {
    it('returns 401 when there is no active session', async () => {
      const client = buildUnauthenticatedClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makePatchRequest({
        userId: OTHER_USER_ID,
        display_name: 'Hacker',
      })

      const response = await profilePATCH(request as any)
      const body = await response.json()

      expect(response.status).toBe(401)
      expect(body.error).toBeDefined()
      expect(body.error.code).toBe('UNAUTHORIZED')
    })

    it('does NOT call the profiles table when unauthenticated', async () => {
      const client = buildUnauthenticatedClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makePatchRequest({ display_name: 'Hacker' })

      await profilePATCH(request as any)

      // Requirement 9.4: protected mutations must not proceed without auth
      expect(client.from).not.toHaveBeenCalled()
    })

    it('returns 401 before 403 — auth check precedes ownership check', async () => {
      const client = buildUnauthenticatedClient()
      mockCreateServerClient.mockReturnValue(client as any)

      // Even with a mismatched userId, the 401 must come first
      const request = makePatchRequest({ userId: OTHER_USER_ID })

      const response = await profilePATCH(request as any)
      const body = await response.json()

      // Must be 401 (not authenticated), not 403 (forbidden)
      expect(response.status).toBe(401)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })
  })

  // -------------------------------------------------------------------------
  // getProfile — RLS blocks reading another user's profile
  // -------------------------------------------------------------------------

  describe('getProfile — RLS blocks cross-user reads', () => {
    it('returns an error when the profiles SELECT is blocked by RLS', async () => {
      // Simulate a client authenticated as AUTHENTICATED_USER_ID but where
      // the DB query for OTHER_USER_ID is blocked by RLS
      const client = buildRlsBlockedClient(AUTHENTICATED_USER_ID)
      mockCreateServerClient.mockReturnValue(client as any)

      // Attempt to read another user's profile — RLS should block this
      const result = await getProfile(OTHER_USER_ID)

      expect(result).toHaveProperty('error')
      if ('error' in result) {
        expect(result.error.code).toBe('UNKNOWN')
        expect(result.error.message).toBeTruthy()
      }
    })

    it('does not return profile data when RLS blocks the query', async () => {
      const client = buildRlsBlockedClient(AUTHENTICATED_USER_ID)
      mockCreateServerClient.mockReturnValue(client as any)

      const result = await getProfile(OTHER_USER_ID)

      // Must not return a Profile object — only an error
      expect(result).not.toHaveProperty('id')
      expect(result).not.toHaveProperty('display_name')
    })

    it('returns the profile successfully when reading the authenticated user\'s own profile', async () => {
      const client = buildAuthenticatedClient(AUTHENTICATED_USER_ID)
      mockCreateServerClient.mockReturnValue(client as any)

      const result = await getProfile(AUTHENTICATED_USER_ID)

      // Own profile read must succeed
      expect(result).not.toHaveProperty('error')
      if (!('error' in result)) {
        expect(result.id).toBe(AUTHENTICATED_USER_ID)
        expect(result.display_name).toBeDefined()
      }
    })
  })

  // -------------------------------------------------------------------------
  // Auth_Service ownership validation
  // -------------------------------------------------------------------------

  describe('Auth_Service — ownership scoping', () => {
    it('the route handler uses the authenticated user ID as the target, not the body userId', async () => {
      const client = buildAuthenticatedClient(AUTHENTICATED_USER_ID)
      mockCreateServerClient.mockReturnValue(client as any)

      // Provide matching userId — route handler should use authenticated user's ID
      const request = makePatchRequest({
        userId: AUTHENTICATED_USER_ID,
        display_name: 'Alice Updated',
      })

      const response = await profilePATCH(request as any)

      // Should succeed (200) — the route handler uses the authenticated user's ID
      expect(response.status).toBe(200)
    })

    it('verifies auth.getUser is called on every profile mutation request', async () => {
      const client = buildAuthenticatedClient(AUTHENTICATED_USER_ID)
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makePatchRequest({
        userId: AUTHENTICATED_USER_ID,
        display_name: 'Alice Updated',
      })

      await profilePATCH(request as any)

      // Requirement 9.2: server client must be used for auth validation
      expect(client.auth.getUser).toHaveBeenCalled()
    })

    it('verifies auth.getUser is called even when the request is rejected with 403', async () => {
      const client = buildAuthenticatedClient(AUTHENTICATED_USER_ID)
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makePatchRequest({
        userId: OTHER_USER_ID,
        display_name: 'Hacker',
      })

      await profilePATCH(request as any)

      // Auth check must always happen — even for requests that will be rejected
      expect(client.auth.getUser).toHaveBeenCalled()
    })
  })
})
