/**
 * Integration Test: Google SSO Callback Flow
 *
 * Verifies the end-to-end Google SSO callback path through the Route Handler:
 *   GET /auth/callback
 *
 * Scenarios covered:
 *   1. New user — profile is created using Google-provided display name and avatar URL
 *   2. Existing user — no duplicate profiles record is created (count remains 1)
 *   3. OAuth error — redirects to /auth with error message
 *   4. No code / no error — redirects to /auth
 *   5. Code exchange failure — redirects to /auth with error message
 *   6. Display name fallback — uses email local part when Google metadata has no name
 *
 * Uses mocked Supabase clients — no real network calls are made.
 *
 * Validates: Requirements 3.2, 3.3, 3.4, 3.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mock Supabase server client BEFORE importing the route handler so that the
// module-level `createServerClient` call inside the callback route is
// intercepted.
// ---------------------------------------------------------------------------
vi.mock('../../supabase/server', () => ({
  createServerClient: vi.fn(),
}))

import { GET } from '../../../app/auth/callback/route'
import * as supabaseServer from '../../supabase/server'

const mockCreateServerClient = vi.mocked(supabaseServer.createServerClient)

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOCK_USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const MOCK_EMAIL = 'alice@example.com'
const MOCK_FULL_NAME = 'Alice Smith'
const MOCK_AVATAR_URL = 'https://lh3.googleusercontent.com/a/alice-avatar'
const MOCK_CODE = 'mock-oauth-code-12345'
const BASE_URL = 'http://localhost:3000'

// ---------------------------------------------------------------------------
// Mock client builders
// ---------------------------------------------------------------------------

/**
 * Builds a mock Supabase client for a NEW user SSO callback:
 * - auth.exchangeCodeForSession resolves with a user + session
 * - profiles.select returns no existing profile (PGRST116 = no rows found)
 * - profiles.insert resolves without error
 */
function buildNewUserClient(overrides?: {
  userId?: string
  email?: string
  fullName?: string
  avatarUrl?: string | null
}) {
  const userId = overrides?.userId ?? MOCK_USER_ID
  const email = overrides?.email ?? MOCK_EMAIL
  const fullName = overrides?.fullName ?? MOCK_FULL_NAME
  const avatarUrl = overrides?.avatarUrl !== undefined ? overrides.avatarUrl : MOCK_AVATAR_URL

  const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null })
  const mockSingle = vi.fn().mockResolvedValue({
    data: null,
    error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
  })

  const client = {
    auth: {
      exchangeCodeForSession: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: userId,
            email,
            aud: 'authenticated',
            role: 'authenticated',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            app_metadata: { provider: 'google' },
            user_metadata: {
              full_name: fullName,
              avatar_url: avatarUrl,
            },
          },
          session: {
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token',
            expires_in: 3600,
            token_type: 'bearer',
          },
        },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: mockSingle,
        }),
      }),
      insert: mockInsert,
    }),
    _mockInsert: mockInsert,
    _mockSingle: mockSingle,
  }

  return client
}

/**
 * Builds a mock Supabase client for an EXISTING user SSO callback:
 * - auth.exchangeCodeForSession resolves with a user + session
 * - profiles.select returns an existing profile (no error)
 * - profiles.insert should NOT be called
 */
function buildExistingUserClient(overrides?: {
  userId?: string
  email?: string
}) {
  const userId = overrides?.userId ?? MOCK_USER_ID
  const email = overrides?.email ?? MOCK_EMAIL

  const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null })
  const mockSingle = vi.fn().mockResolvedValue({
    data: { id: userId },
    error: null,
  })

  const client = {
    auth: {
      exchangeCodeForSession: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: userId,
            email,
            aud: 'authenticated',
            role: 'authenticated',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            app_metadata: { provider: 'google' },
            user_metadata: {
              full_name: MOCK_FULL_NAME,
              avatar_url: MOCK_AVATAR_URL,
            },
          },
          session: {
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token',
            expires_in: 3600,
            token_type: 'bearer',
          },
        },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: mockSingle,
        }),
      }),
      insert: mockInsert,
    }),
    _mockInsert: mockInsert,
    _mockSingle: mockSingle,
  }

  return client
}

/**
 * Builds a mock Supabase client that simulates a code exchange failure.
 */
function buildCodeExchangeFailureClient() {
  return {
    auth: {
      exchangeCodeForSession: vi.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid or expired code', status: 400 },
      }),
    },
    from: vi.fn(),
  }
}

// ---------------------------------------------------------------------------
// Request helper
// ---------------------------------------------------------------------------

/**
 * Creates a NextRequest for the /auth/callback route with the given query params.
 */
function makeCallbackRequest(params: Record<string, string>): NextRequest {
  const url = new URL(`${BASE_URL}/auth/callback`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new NextRequest(url.toString())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Integration: Google SSO Callback — GET /auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // New user — profile creation
  // -------------------------------------------------------------------------

  describe('new user — profile creation (Requirement 3.3)', () => {
    it('creates a profiles record for a new user using Google display name and avatar URL', async () => {
      const client = buildNewUserClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeCallbackRequest({ code: MOCK_CODE })
      await GET(request)

      // profiles table must be queried to check existence
      expect(client.from).toHaveBeenCalledWith('profiles')

      // insert must be called exactly once for the new user
      expect(client._mockInsert).toHaveBeenCalledOnce()
      const insertArg = client._mockInsert.mock.calls[0][0]
      expect(insertArg.id).toBe(MOCK_USER_ID)
      expect(insertArg.display_name).toBe(MOCK_FULL_NAME)
      expect(insertArg.avatar_url).toBe(MOCK_AVATAR_URL)
    })

    it('uses full_name from Google metadata as the display name', async () => {
      const client = buildNewUserClient({ fullName: 'Bob Johnson' })
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeCallbackRequest({ code: MOCK_CODE })
      await GET(request)

      const insertArg = client._mockInsert.mock.calls[0][0]
      expect(insertArg.display_name).toBe('Bob Johnson')
    })

    it('falls back to name metadata when full_name is absent', async () => {
      const userId = MOCK_USER_ID
      const email = MOCK_EMAIL

      // Build a client where user_metadata has `name` but not `full_name`
      const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null })
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      })

      const client = {
        auth: {
          exchangeCodeForSession: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: userId,
                email,
                aud: 'authenticated',
                role: 'authenticated',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                app_metadata: { provider: 'google' },
                user_metadata: {
                  // No full_name — only name
                  name: 'Charlie Brown',
                  avatar_url: MOCK_AVATAR_URL,
                },
              },
              session: { access_token: 'tok', refresh_token: 'ref', expires_in: 3600, token_type: 'bearer' },
            },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockSingle }) }),
          insert: mockInsert,
        }),
        _mockInsert: mockInsert,
      }

      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeCallbackRequest({ code: MOCK_CODE })
      await GET(request)

      expect(mockInsert).toHaveBeenCalledOnce()
      const insertArg = mockInsert.mock.calls[0][0]
      expect(insertArg.display_name).toBe('Charlie Brown')
    })

    it('falls back to email local part when no name metadata is present', async () => {
      const userId = MOCK_USER_ID
      const email = 'dave@example.com'

      const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null })
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      })

      const client = {
        auth: {
          exchangeCodeForSession: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: userId,
                email,
                aud: 'authenticated',
                role: 'authenticated',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                app_metadata: { provider: 'google' },
                user_metadata: {
                  // No name fields at all
                  avatar_url: null,
                },
              },
              session: { access_token: 'tok', refresh_token: 'ref', expires_in: 3600, token_type: 'bearer' },
            },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockSingle }) }),
          insert: mockInsert,
        }),
        _mockInsert: mockInsert,
      }

      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeCallbackRequest({ code: MOCK_CODE })
      await GET(request)

      expect(mockInsert).toHaveBeenCalledOnce()
      const insertArg = mockInsert.mock.calls[0][0]
      expect(insertArg.display_name).toBe('dave')
    })

    it('stores null avatar_url when Google provides no avatar', async () => {
      const client = buildNewUserClient({ avatarUrl: null })
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeCallbackRequest({ code: MOCK_CODE })
      await GET(request)

      const insertArg = client._mockInsert.mock.calls[0][0]
      expect(insertArg.avatar_url).toBeNull()
    })

    it('redirects to /teams after successful new-user SSO', async () => {
      const client = buildNewUserClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeCallbackRequest({ code: MOCK_CODE })
      const response = await GET(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe(`${BASE_URL}/teams`)
    })
  })

  // -------------------------------------------------------------------------
  // Existing user — no duplicate profile
  // -------------------------------------------------------------------------

  describe('existing user — no duplicate profile (Requirement 3.4)', () => {
    it('does NOT create a profiles record when the user already has one', async () => {
      const client = buildExistingUserClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeCallbackRequest({ code: MOCK_CODE })
      await GET(request)

      // profiles table must be queried to check existence
      expect(client.from).toHaveBeenCalledWith('profiles')

      // insert must NOT be called — profile already exists
      expect(client._mockInsert).not.toHaveBeenCalled()
    })

    it('profiles count remains 1 after a second SSO login by the same user', async () => {
      // First login: new user — profile is created
      const newUserClient = buildNewUserClient()
      mockCreateServerClient.mockReturnValue(newUserClient as any)

      const firstRequest = makeCallbackRequest({ code: MOCK_CODE })
      await GET(firstRequest)

      expect(newUserClient._mockInsert).toHaveBeenCalledOnce()

      // Second login: existing user — profile already exists
      const existingUserClient = buildExistingUserClient()
      mockCreateServerClient.mockReturnValue(existingUserClient as any)

      const secondRequest = makeCallbackRequest({ code: 'mock-oauth-code-second' })
      await GET(secondRequest)

      // insert must NOT be called on the second login
      expect(existingUserClient._mockInsert).not.toHaveBeenCalled()

      // Total insert calls across both logins = 1 (first login only)
      const totalInserts =
        newUserClient._mockInsert.mock.calls.length +
        existingUserClient._mockInsert.mock.calls.length
      expect(totalInserts).toBe(1)
    })

    it('redirects to /teams after successful existing-user SSO', async () => {
      const client = buildExistingUserClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeCallbackRequest({ code: MOCK_CODE })
      const response = await GET(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe(`${BASE_URL}/teams`)
    })

    it('checks the profiles table by the correct user ID', async () => {
      const OTHER_USER_ID = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff'
      const client = buildExistingUserClient({ userId: OTHER_USER_ID })
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeCallbackRequest({ code: MOCK_CODE })
      await GET(request)

      // The .eq() call must use the correct user ID
      const fromResult = client.from.mock.results[0].value
      const eqSpy = fromResult.select.mock.results[0].value.eq
      expect(eqSpy).toHaveBeenCalledWith('id', OTHER_USER_ID)
    })
  })

  // -------------------------------------------------------------------------
  // OAuth error handling
  // -------------------------------------------------------------------------

  describe('OAuth error handling (Requirement 3.6)', () => {
    it('redirects to /auth with error message when OAuth returns an error', async () => {
      // No Supabase client needed — error is handled before code exchange
      const client = buildNewUserClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeCallbackRequest({
        error: 'access_denied',
        error_description: 'User cancelled the sign-in',
      })

      const response = await GET(request)

      expect(response.status).toBe(307)
      const location = response.headers.get('location')!
      expect(location).toContain('/auth')
      expect(location).toContain('error=')
      expect(decodeURIComponent(location)).toContain('User cancelled the sign-in')
    })

    it('uses a generic error message when error_description is absent', async () => {
      const client = buildNewUserClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeCallbackRequest({ error: 'server_error' })

      const response = await GET(request)

      expect(response.status).toBe(307)
      const location = response.headers.get('location')!
      expect(location).toContain('/auth')
      expect(location).toContain('error=')
      expect(decodeURIComponent(location)).toContain('Authentication failed')
    })

    it('does not call Supabase when an OAuth error is present', async () => {
      const client = buildNewUserClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeCallbackRequest({
        error: 'access_denied',
        error_description: 'User cancelled',
      })

      await GET(request)

      // createServerClient should not be called — error short-circuits before code exchange
      expect(mockCreateServerClient).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Code exchange failure
  // -------------------------------------------------------------------------

  describe('code exchange failure', () => {
    it('redirects to /auth with error message when code exchange fails', async () => {
      const client = buildCodeExchangeFailureClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeCallbackRequest({ code: 'invalid-or-expired-code' })
      const response = await GET(request)

      expect(response.status).toBe(307)
      const location = response.headers.get('location')!
      expect(location).toContain('/auth')
      expect(location).toContain('error=')
      expect(decodeURIComponent(location)).toContain('Failed to complete sign-in')
    })

    it('does not attempt profile lookup when code exchange fails', async () => {
      const client = buildCodeExchangeFailureClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeCallbackRequest({ code: 'invalid-or-expired-code' })
      await GET(request)

      // profiles table must not be queried when exchange fails
      expect(client.from).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // No code and no error
  // -------------------------------------------------------------------------

  describe('no code and no error', () => {
    it('redirects to /auth when neither code nor error is present', async () => {
      const client = buildNewUserClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeCallbackRequest({})
      const response = await GET(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe(`${BASE_URL}/auth`)
    })
  })

  // -------------------------------------------------------------------------
  // Custom redirect parameter
  // -------------------------------------------------------------------------

  describe('custom redirect parameter', () => {
    it('redirects to the custom redirect path after successful SSO', async () => {
      const client = buildExistingUserClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeCallbackRequest({ code: MOCK_CODE, redirect: '/account/profile' })
      const response = await GET(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe(`${BASE_URL}/account/profile`)
    })
  })
})
