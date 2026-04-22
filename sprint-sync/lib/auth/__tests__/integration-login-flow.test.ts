/**
 * Integration Test: Login Flow
 *
 * Verifies the end-to-end login path through the Route Handler:
 *   - POST /api/auth/login with valid credentials returns 200 and establishes a session
 *   - POST /api/auth/login with invalid credentials returns 401 with the generic message
 *     "Invalid email or password" (never indicates which field is wrong — prevents enumeration)
 *   - Returns 400 on validation failure (empty fields)
 *
 * Uses mocked Supabase clients — no real network calls are made.
 *
 * Validates: Requirements 2.1, 2.2, 2.4, 2.5, 9.2, 9.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock Supabase server client BEFORE importing the route handler so that the
// module-level `createServerClient` call inside service.ts is intercepted.
// ---------------------------------------------------------------------------
vi.mock('../../supabase/server', () => ({
  createServerClient: vi.fn(),
}))

import { POST } from '../../../app/api/auth/login/route'
import * as supabaseServer from '../../supabase/server'

const mockCreateServerClient = vi.mocked(supabaseServer.createServerClient)

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_EMAIL = 'alice@example.com'
const VALID_PASSWORD = 'SecurePass1'
const MOCK_USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

// ---------------------------------------------------------------------------
// Mock client builders
// ---------------------------------------------------------------------------

/**
 * Builds a mock Supabase client that simulates a successful login:
 * - auth.signInWithPassword resolves with a user + session
 */
function buildSuccessClient(overrides?: { userId?: string; email?: string }) {
  const userId = overrides?.userId ?? MOCK_USER_ID
  const email = overrides?.email ?? VALID_EMAIL

  return {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
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
  }
}

/**
 * Builds a mock Supabase client that simulates invalid credentials:
 * - auth.signInWithPassword resolves with an error (wrong password / unknown email)
 */
function buildInvalidCredentialsClient() {
  return {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials', status: 400 },
      }),
    },
  }
}

/**
 * Builds a mock Supabase client that simulates a Supabase service error
 * (e.g., network failure, unexpected server error).
 */
function buildServiceErrorClient() {
  return {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Service unavailable', status: 503 },
      }),
    },
  }
}

// ---------------------------------------------------------------------------
// Request helper
// ---------------------------------------------------------------------------

function makeLoginRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Integration: Login Flow — POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // Happy path — 200
  // -------------------------------------------------------------------------

  describe('successful login (200)', () => {
    it('returns 200 with user id and email on valid credentials', async () => {
      const client = buildSuccessClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeLoginRequest({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
      })

      const response = await POST(request as any)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data).toBeDefined()
      expect(body.data.id).toBe(MOCK_USER_ID)
      expect(body.data.email).toBe(VALID_EMAIL)
    })

    it('does NOT expose session tokens or secrets in the response body', async () => {
      const client = buildSuccessClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeLoginRequest({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
      })

      const response = await POST(request as any)
      const body = await response.json()

      // Requirement 9.3: session secrets must never appear in the response body
      expect(body.data).not.toHaveProperty('session')
      expect(body.data).not.toHaveProperty('access_token')
      expect(body.data).not.toHaveProperty('refresh_token')
      expect(body).not.toHaveProperty('session')
    })

    it('calls Supabase auth.signInWithPassword with the correct email and password', async () => {
      const client = buildSuccessClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeLoginRequest({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
      })

      await POST(request as any)

      expect(client.auth.signInWithPassword).toHaveBeenCalledOnce()
      const callArgs = client.auth.signInWithPassword.mock.calls[0][0]
      expect(callArgs.email).toBe(VALID_EMAIL)
      expect(callArgs.password).toBe(VALID_PASSWORD)
    })

    it('returns the correct user id when a different user logs in', async () => {
      const OTHER_USER_ID = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff'
      const OTHER_EMAIL = 'bob@example.com'
      const client = buildSuccessClient({ userId: OTHER_USER_ID, email: OTHER_EMAIL })
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeLoginRequest({
        email: OTHER_EMAIL,
        password: VALID_PASSWORD,
      })

      const response = await POST(request as any)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data.id).toBe(OTHER_USER_ID)
      expect(body.data.email).toBe(OTHER_EMAIL)
    })
  })

  // -------------------------------------------------------------------------
  // Invalid credentials — 401
  // -------------------------------------------------------------------------

  describe('invalid credentials (401)', () => {
    it('returns 401 when credentials are wrong', async () => {
      const client = buildInvalidCredentialsClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeLoginRequest({
        email: VALID_EMAIL,
        password: 'WrongPassword1',
      })

      const response = await POST(request as any)
      const body = await response.json()

      expect(response.status).toBe(401)
      expect(body.error).toBeDefined()
    })

    it('returns the generic message "Invalid email or password" — never reveals which field is wrong', async () => {
      const client = buildInvalidCredentialsClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeLoginRequest({
        email: VALID_EMAIL,
        password: 'WrongPassword1',
      })

      const response = await POST(request as any)
      const body = await response.json()

      // Requirement 2.5: the message must be the exact generic phrase — never
      // something like "Email not found" or "Wrong password" that reveals which
      // field is incorrect.
      expect(body.error.message).toBe('Invalid email or password')
      // Must not be a field-specific message (e.g. "Email not found", "Wrong password")
      expect(body.error.message).not.toMatch(/not found/i)
      expect(body.error.message).not.toMatch(/does not exist/i)
      expect(body.error.message).not.toMatch(/wrong password/i)
      expect(body.error.message).not.toMatch(/incorrect password/i)
    })

    it('returns INVALID_CREDENTIALS error code on 401', async () => {
      const client = buildInvalidCredentialsClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeLoginRequest({
        email: 'unknown@example.com',
        password: VALID_PASSWORD,
      })

      const response = await POST(request as any)
      const body = await response.json()

      expect(response.status).toBe(401)
      expect(body.error.code).toBe('INVALID_CREDENTIALS')
    })

    it('returns the same generic 401 response regardless of whether the email exists', async () => {
      // Simulate wrong password for existing user
      const clientWrongPassword = buildInvalidCredentialsClient()
      mockCreateServerClient.mockReturnValue(clientWrongPassword as any)

      const requestWrongPassword = makeLoginRequest({
        email: VALID_EMAIL,
        password: 'WrongPassword1',
      })
      const responseWrongPassword = await POST(requestWrongPassword as any)
      const bodyWrongPassword = await responseWrongPassword.json()

      // Simulate unknown email
      const clientUnknownEmail = buildInvalidCredentialsClient()
      mockCreateServerClient.mockReturnValue(clientUnknownEmail as any)

      const requestUnknownEmail = makeLoginRequest({
        email: 'nobody@example.com',
        password: VALID_PASSWORD,
      })
      const responseUnknownEmail = await POST(requestUnknownEmail as any)
      const bodyUnknownEmail = await responseUnknownEmail.json()

      // Both must return the same status and message — prevents enumeration
      expect(responseWrongPassword.status).toBe(401)
      expect(responseUnknownEmail.status).toBe(401)
      expect(bodyWrongPassword.error.message).toBe(bodyUnknownEmail.error.message)
      expect(bodyWrongPassword.error.code).toBe(bodyUnknownEmail.error.code)
    })
  })

  // -------------------------------------------------------------------------
  // Validation failures — 400
  // -------------------------------------------------------------------------

  describe('validation failures (400)', () => {
    it('returns 400 when email is missing', async () => {
      const client = buildSuccessClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeLoginRequest({ password: VALID_PASSWORD })

      const response = await POST(request as any)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBeDefined()
    })

    it('returns 400 when password is missing', async () => {
      const client = buildSuccessClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeLoginRequest({ email: VALID_EMAIL })

      const response = await POST(request as any)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBeDefined()
    })

    it('returns 400 when both fields are missing', async () => {
      const client = buildSuccessClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeLoginRequest({})

      const response = await POST(request as any)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBeDefined()
    })

    it('returns 400 when email is an empty string', async () => {
      const client = buildSuccessClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeLoginRequest({ email: '', password: VALID_PASSWORD })

      const response = await POST(request as any)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBeDefined()
    })

    it('returns 400 when password is an empty string', async () => {
      const client = buildSuccessClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeLoginRequest({ email: VALID_EMAIL, password: '' })

      const response = await POST(request as any)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBeDefined()
    })

    it('does not call Supabase when required fields are missing', async () => {
      const client = buildSuccessClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeLoginRequest({ email: VALID_EMAIL })

      await POST(request as any)

      // auth.signInWithPassword must never be called when validation fails
      expect(client.auth.signInWithPassword).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Malformed request body — 500
  // -------------------------------------------------------------------------

  describe('malformed request body', () => {
    it('returns 500 when the request body is not valid JSON', async () => {
      const client = buildSuccessClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = new Request('http://localhost/api/auth/login', {
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
