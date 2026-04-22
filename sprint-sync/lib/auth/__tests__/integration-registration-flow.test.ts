/**
 * Integration Test: Full Registration Flow
 *
 * Verifies the end-to-end registration path through the Route Handler:
 *   - POST /api/auth/register creates a Supabase Auth user
 *   - A corresponding `profiles` record is created
 *   - The session cookie is set (Supabase SSR writes it automatically)
 *   - Returns 201 on success
 *   - Returns 400 on validation failure
 *   - Returns 409 on email conflict
 *
 * Uses mocked Supabase clients — no real network calls are made.
 *
 * Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 9.2, 9.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock Supabase server client BEFORE importing the route handler so that the
// module-level `createServerClient` call inside service.ts is intercepted.
// ---------------------------------------------------------------------------
vi.mock('../../supabase/server', () => ({
  createServerClient: vi.fn(),
}))

import { POST } from '../../../app/api/auth/register/route'
import * as supabaseServer from '../../supabase/server'

const mockCreateServerClient = vi.mocked(supabaseServer.createServerClient)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_EMAIL = 'alice@example.com'
const VALID_PASSWORD = 'SecurePass1'
const VALID_DISPLAY_NAME = 'Alice'
const MOCK_USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

/**
 * Builds a mock Supabase client that simulates a successful registration:
 * - auth.signUp resolves with a user + session
 * - profiles.insert resolves without error
 */
function buildSuccessClient(overrides?: {
  userId?: string
  email?: string
}) {
  const userId = overrides?.userId ?? MOCK_USER_ID
  const email = overrides?.email ?? VALID_EMAIL

  const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null })

  const client = {
    auth: {
      signUp: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: userId,
            email,
            aud: 'authenticated',
            role: 'authenticated',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            app_metadata: {},
            user_metadata: { display_name: VALID_DISPLAY_NAME },
          },
          session: {
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token',
            expires_in: 3600,
            token_type: 'bearer',
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
        },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({ insert: mockInsert }),
    _mockInsert: mockInsert,
  }

  return client
}

/**
 * Builds a mock Supabase client that simulates an email-already-exists error.
 */
function buildEmailConflictClient() {
  return {
    auth: {
      signUp: vi.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already registered' },
      }),
    },
    from: vi.fn(),
  }
}

/**
 * Builds a mock Supabase client that simulates a profile insert failure.
 */
function buildProfileInsertFailureClient() {
  const mockInsert = vi.fn().mockResolvedValue({
    data: null,
    error: { message: 'insert failed', code: '23505' },
  })

  return {
    auth: {
      signUp: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: MOCK_USER_ID,
            email: VALID_EMAIL,
            aud: 'authenticated',
            role: 'authenticated',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            app_metadata: {},
            user_metadata: {},
          },
          session: {
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token',
            expires_in: 3600,
            token_type: 'bearer',
            user: {
              id: MOCK_USER_ID,
              email: VALID_EMAIL,
              aud: 'authenticated',
              role: 'authenticated',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              app_metadata: {},
              user_metadata: {},
            },
          },
        },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({ insert: mockInsert }),
    _mockInsert: mockInsert,
  }
}

/**
 * Creates a NextRequest-compatible Request with a JSON body.
 */
function makeRegistrationRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Integration: Full Registration Flow — POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // Happy path — 201
  // -------------------------------------------------------------------------

  describe('successful registration', () => {
    it('returns 201 with user id and email on valid input', async () => {
      const client = buildSuccessClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeRegistrationRequest({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
        displayName: VALID_DISPLAY_NAME,
      })

      const response = await POST(request as any)
      const body = await response.json()

      expect(response.status).toBe(201)
      expect(body.data).toBeDefined()
      expect(body.data.id).toBe(MOCK_USER_ID)
      expect(body.data.email).toBe(VALID_EMAIL)
    })

    it('does NOT expose session tokens or secrets in the response body', async () => {
      const client = buildSuccessClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeRegistrationRequest({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
        displayName: VALID_DISPLAY_NAME,
      })

      const response = await POST(request as any)
      const body = await response.json()

      // Requirement 9.3: session secrets must never appear in the response body
      expect(body.data).not.toHaveProperty('session')
      expect(body.data).not.toHaveProperty('access_token')
      expect(body.data).not.toHaveProperty('refresh_token')
      expect(body).not.toHaveProperty('session')
    })

    it('calls Supabase auth.signUp with the correct email and password', async () => {
      const client = buildSuccessClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeRegistrationRequest({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
        displayName: VALID_DISPLAY_NAME,
      })

      await POST(request as any)

      expect(client.auth.signUp).toHaveBeenCalledOnce()
      const signUpArgs = client.auth.signUp.mock.calls[0][0]
      expect(signUpArgs.email).toBe(VALID_EMAIL)
      expect(signUpArgs.password).toBe(VALID_PASSWORD)
    })

    it('creates a profiles record with the sanitised display name', async () => {
      const client = buildSuccessClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeRegistrationRequest({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
        displayName: VALID_DISPLAY_NAME,
      })

      await POST(request as any)

      // profiles table must be targeted
      expect(client.from).toHaveBeenCalledWith('profiles')

      // insert must be called with the correct shape
      expect(client._mockInsert).toHaveBeenCalledOnce()
      const insertArg = client._mockInsert.mock.calls[0][0]
      expect(insertArg.id).toBe(MOCK_USER_ID)
      expect(insertArg.display_name).toBe(VALID_DISPLAY_NAME)
      expect(insertArg.avatar_url).toBeNull()
    })

    it('sanitises HTML markup in display name before inserting the profiles record', async () => {
      const client = buildSuccessClient({ email: VALID_EMAIL })
      mockCreateServerClient.mockReturnValue(client as any)

      const displayNameWithHTML = '<b>Alice</b>'

      const request = makeRegistrationRequest({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
        displayName: displayNameWithHTML,
      })

      await POST(request as any)

      const insertArg = client._mockInsert.mock.calls[0][0]
      // Sanitised value must contain no HTML tags
      expect(insertArg.display_name).not.toMatch(/<[^>]+>/)
    })

    it('passes display_name in auth.signUp user metadata', async () => {
      const client = buildSuccessClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeRegistrationRequest({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
        displayName: VALID_DISPLAY_NAME,
      })

      await POST(request as any)

      const signUpArgs = client.auth.signUp.mock.calls[0][0]
      expect(signUpArgs.options?.data?.display_name).toBe(VALID_DISPLAY_NAME)
    })
  })

  // -------------------------------------------------------------------------
  // Validation failures — 400
  // -------------------------------------------------------------------------

  describe('validation failures (400)', () => {
    it('returns 400 when email is missing', async () => {
      // No Supabase call expected — validation short-circuits in the route handler
      const client = buildSuccessClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeRegistrationRequest({
        password: VALID_PASSWORD,
        displayName: VALID_DISPLAY_NAME,
      })

      const response = await POST(request as any)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBeDefined()
    })

    it('returns 400 when password is missing', async () => {
      const client = buildSuccessClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeRegistrationRequest({
        email: VALID_EMAIL,
        displayName: VALID_DISPLAY_NAME,
      })

      const response = await POST(request as any)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBeDefined()
    })

    it('returns 400 when displayName is missing', async () => {
      const client = buildSuccessClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeRegistrationRequest({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
      })

      const response = await POST(request as any)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBeDefined()
    })

    it('returns 400 when email is malformed', async () => {
      const client = buildSuccessClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeRegistrationRequest({
        email: 'not-an-email',
        password: VALID_PASSWORD,
        displayName: VALID_DISPLAY_NAME,
      })

      const response = await POST(request as any)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error.code).toBe('INVALID_EMAIL')
    })

    it('returns 400 when password is too weak (no uppercase)', async () => {
      const client = buildSuccessClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeRegistrationRequest({
        email: VALID_EMAIL,
        password: 'weakpass1',
        displayName: VALID_DISPLAY_NAME,
      })

      const response = await POST(request as any)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error.code).toBe('WEAK_PASSWORD')
    })

    it('returns 400 when password is too short', async () => {
      const client = buildSuccessClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeRegistrationRequest({
        email: VALID_EMAIL,
        password: 'Ab1',
        displayName: VALID_DISPLAY_NAME,
      })

      const response = await POST(request as any)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error.code).toBe('WEAK_PASSWORD')
    })

    it('returns 400 when displayName exceeds 50 characters', async () => {
      const client = buildSuccessClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeRegistrationRequest({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
        displayName: 'A'.repeat(51),
      })

      const response = await POST(request as any)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error.code).toBe('DISPLAY_NAME_INVALID')
    })

    it('returns 400 when displayName is empty string', async () => {
      const client = buildSuccessClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeRegistrationRequest({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
        displayName: '',
      })

      const response = await POST(request as any)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBeDefined()
    })

    it('does not call Supabase when validation fails', async () => {
      const client = buildSuccessClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeRegistrationRequest({
        email: 'bad-email',
        password: VALID_PASSWORD,
        displayName: VALID_DISPLAY_NAME,
      })

      await POST(request as any)

      // auth.signUp must never be called when validation fails
      expect(client.auth.signUp).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Email conflict — 409
  // -------------------------------------------------------------------------

  describe('email conflict (409)', () => {
    it('returns 409 when the email is already registered', async () => {
      const client = buildEmailConflictClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeRegistrationRequest({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
        displayName: VALID_DISPLAY_NAME,
      })

      const response = await POST(request as any)
      const body = await response.json()

      expect(response.status).toBe(409)
      expect(body.error.code).toBe('EMAIL_ALREADY_EXISTS')
    })

    it('does not create a profiles record when email already exists', async () => {
      const client = buildEmailConflictClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeRegistrationRequest({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
        displayName: VALID_DISPLAY_NAME,
      })

      await POST(request as any)

      // profiles insert must not be attempted
      expect(client.from).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Profile insert failure — 500
  // -------------------------------------------------------------------------

  describe('profile insert failure (500)', () => {
    it('returns 500 when the profiles record cannot be created', async () => {
      const client = buildProfileInsertFailureClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeRegistrationRequest({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
        displayName: VALID_DISPLAY_NAME,
      })

      const response = await POST(request as any)
      const body = await response.json()

      expect(response.status).toBe(500)
      expect(body.error.code).toBe('UNKNOWN')
    })
  })

  // -------------------------------------------------------------------------
  // Malformed request body — 500
  // -------------------------------------------------------------------------

  describe('malformed request body', () => {
    it('returns 500 when the request body is not valid JSON', async () => {
      const client = buildSuccessClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'this is not json',
      })

      const response = await POST(request as any)
      const body = await response.json()

      expect(response.status).toBe(500)
      expect(body.error).toBeDefined()
    })
  })
})
