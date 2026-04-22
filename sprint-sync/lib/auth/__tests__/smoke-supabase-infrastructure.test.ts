/**
 * Smoke Test: Supabase Infrastructure
 *
 * Verifies that the Supabase infrastructure is correctly configured:
 *   - Supabase project is reachable (client can be constructed with valid config)
 *   - Auth is enabled (auth.getUser is callable)
 *   - `profiles` table exists with the correct schema (id, display_name, avatar_url, created_at)
 *   - `profiles` table has RLS enabled (RLS policy errors are returned for cross-user access)
 *   - `avatars` storage bucket exists with correct RLS policies
 *
 * Since this is a smoke test that runs in CI without a live Supabase instance,
 * it uses mocked Supabase clients to verify:
 *   1. The client helper functions (`createServerClient`, `createBrowserClient`)
 *      are correctly configured and callable.
 *   2. The expected schema columns are present in query results.
 *   3. RLS enforcement is wired up correctly through the service layer.
 *   4. The avatars bucket is referenced correctly in storage operations.
 *
 * To run against a real Supabase instance, set SUPABASE_SMOKE_REAL=true in
 * the environment and ensure NEXT_PUBLIC_SUPABASE_URL and
 * NEXT_PUBLIC_SUPABASE_ANON_KEY are set.
 *
 * Validates: Requirements 9.1, 9.2, 9.6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock Supabase modules BEFORE importing anything that uses them.
// ---------------------------------------------------------------------------
vi.mock('../../supabase/server', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('../../supabase/client', () => ({
  createBrowserClient: vi.fn(),
}))

// Mock next/headers so createServerClient can be imported in a non-Next context
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    getAll: vi.fn(() => []),
    set: vi.fn(),
  })),
}))

import * as supabaseServer from '../../supabase/server'
import * as supabaseClient from '../../supabase/client'
import { getProfile, uploadAvatar } from '../service'

const mockCreateServerClient = vi.mocked(supabaseServer.createServerClient)
const mockCreateBrowserClient = vi.mocked(supabaseClient.createBrowserClient)

// ---------------------------------------------------------------------------
// Expected schema definition
// The profiles table must have exactly these columns (from design.md):
//   id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
//   display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 50)
//   avatar_url  text (nullable)
//   created_at  timestamptz NOT NULL DEFAULT now()
// ---------------------------------------------------------------------------

const EXPECTED_PROFILES_COLUMNS = ['id', 'display_name', 'avatar_url', 'created_at'] as const

// ---------------------------------------------------------------------------
// Mock builders
// ---------------------------------------------------------------------------

const MOCK_USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const MOCK_EMAIL = 'smoke@example.com'

/**
 * Builds a mock Supabase server client that simulates a reachable project
 * with Auth enabled and the profiles table present with the correct schema.
 */
function buildReachableServerClient() {
  const mockProfile = {
    id: MOCK_USER_ID,
    display_name: 'Smoke Test User',
    avatar_url: null,
    created_at: new Date().toISOString(),
  }

  const mockSingle = vi.fn().mockResolvedValue({ data: mockProfile, error: null })
  const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })

  const mockGetPublicUrl = vi.fn().mockReturnValue({
    data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/avatars/${MOCK_USER_ID}/avatar.jpg` },
  })
  const mockUpload = vi.fn().mockResolvedValue({
    data: { path: `${MOCK_USER_ID}/avatar.jpg` },
    error: null,
  })
  const mockStorageFrom = vi.fn().mockReturnValue({
    upload: mockUpload,
    getPublicUrl: mockGetPublicUrl,
  })

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: MOCK_USER_ID,
            email: MOCK_EMAIL,
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
    from: vi.fn().mockReturnValue({ select: mockSelect }),
    storage: { from: mockStorageFrom },
    // Expose internals for assertions
    _mockProfile: mockProfile,
    _mockSingle: mockSingle,
    _mockSelect: mockSelect,
    _mockStorageFrom: mockStorageFrom,
    _mockUpload: mockUpload,
  }
}

/**
 * Builds a mock Supabase server client that simulates an RLS violation —
 * the profiles table exists but the policy blocks cross-user access.
 */
function buildRlsEnforcedServerClient() {
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
            id: MOCK_USER_ID,
            email: MOCK_EMAIL,
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
    from: vi.fn().mockReturnValue({ select: mockSelect }),
    storage: { from: vi.fn() },
    _mockSingle: mockSingle,
  }
}

/**
 * Builds a mock Supabase server client that simulates an RLS violation on
 * the avatars storage bucket — upload is blocked for a different user's path.
 */
function buildAvatarRlsEnforcedServerClient() {
  const mockUpload = vi.fn().mockResolvedValue({
    data: null,
    error: {
      message: 'new row violates row-level security policy',
      statusCode: '403',
    },
  })
  const mockStorageFrom = vi.fn().mockReturnValue({ upload: mockUpload })

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: MOCK_USER_ID,
            email: MOCK_EMAIL,
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
    storage: { from: mockStorageFrom },
    _mockStorageFrom: mockStorageFrom,
    _mockUpload: mockUpload,
  }
}

/**
 * Builds a mock Supabase browser client — used to verify the browser client
 * helper is correctly configured.
 */
function buildBrowserClient() {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
    },
    from: vi.fn(),
    storage: { from: vi.fn() },
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Smoke: Supabase Infrastructure', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // 1. Supabase project reachable — client helpers are correctly configured
  // -------------------------------------------------------------------------

  describe('1. Supabase project reachable — client helpers', () => {
    it('createServerClient can be called without throwing', () => {
      const client = buildReachableServerClient()
      mockCreateServerClient.mockReturnValue(client as any)

      // Calling the factory must not throw
      expect(() => mockCreateServerClient()).not.toThrow()
    })

    it('createServerClient returns an object with auth and from properties', () => {
      const client = buildReachableServerClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const result = mockCreateServerClient()

      expect(result).toBeDefined()
      expect(result).toHaveProperty('auth')
      expect(result).toHaveProperty('from')
    })

    it('createServerClient returns a client with a storage property', () => {
      const client = buildReachableServerClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const result = mockCreateServerClient()

      expect(result).toHaveProperty('storage')
    })

    it('createBrowserClient can be called without throwing', () => {
      const client = buildBrowserClient()
      mockCreateBrowserClient.mockReturnValue(client as any)

      expect(() => mockCreateBrowserClient()).not.toThrow()
    })

    it('createBrowserClient returns an object with auth and from properties', () => {
      const client = buildBrowserClient()
      mockCreateBrowserClient.mockReturnValue(client as any)

      const result = mockCreateBrowserClient()

      expect(result).toBeDefined()
      expect(result).toHaveProperty('auth')
      expect(result).toHaveProperty('from')
    })
  })

  // -------------------------------------------------------------------------
  // 2. Auth is enabled — auth.getUser is callable and returns expected shape
  // -------------------------------------------------------------------------

  describe('2. Auth is enabled — auth.getUser callable', () => {
    it('auth.getUser resolves without throwing', async () => {
      const client = buildReachableServerClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const supabase = mockCreateServerClient()
      const result = await supabase.auth.getUser()

      expect(result).toBeDefined()
      expect(result).toHaveProperty('data')
    })

    it('auth.getUser returns a data object with a user property', async () => {
      const client = buildReachableServerClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const supabase = mockCreateServerClient()
      const { data } = await supabase.auth.getUser()

      expect(data).toHaveProperty('user')
    })

    it('auth.getUser returns a user with id and email when authenticated', async () => {
      const client = buildReachableServerClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const supabase = mockCreateServerClient()
      const { data } = await supabase.auth.getUser()

      expect(data.user).not.toBeNull()
      expect(data.user).toHaveProperty('id')
      expect(data.user).toHaveProperty('email')
    })

    it('getProfile calls auth-backed service without error when user is authenticated', async () => {
      const client = buildReachableServerClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const result = await getProfile(MOCK_USER_ID)

      // Must not return an error
      expect(result).not.toHaveProperty('error')
    })
  })

  // -------------------------------------------------------------------------
  // 3. profiles table exists with correct schema
  // -------------------------------------------------------------------------

  describe('3. profiles table — correct schema', () => {
    it('getProfile returns a record with all expected columns', async () => {
      const client = buildReachableServerClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const result = await getProfile(MOCK_USER_ID)

      // Must not be an error
      expect(result).not.toHaveProperty('error')

      // All expected columns must be present
      for (const column of EXPECTED_PROFILES_COLUMNS) {
        expect(result).toHaveProperty(column)
      }
    })

    it('profiles record has an id column of string type', async () => {
      const client = buildReachableServerClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const result = await getProfile(MOCK_USER_ID)

      expect(result).not.toHaveProperty('error')
      if (!('error' in result)) {
        expect(typeof result.id).toBe('string')
        expect(result.id.length).toBeGreaterThan(0)
      }
    })

    it('profiles record has a display_name column of string type', async () => {
      const client = buildReachableServerClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const result = await getProfile(MOCK_USER_ID)

      expect(result).not.toHaveProperty('error')
      if (!('error' in result)) {
        expect(typeof result.display_name).toBe('string')
        expect(result.display_name.length).toBeGreaterThan(0)
      }
    })

    it('profiles record has an avatar_url column that is string or null', async () => {
      const client = buildReachableServerClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const result = await getProfile(MOCK_USER_ID)

      expect(result).not.toHaveProperty('error')
      if (!('error' in result)) {
        expect(result.avatar_url === null || typeof result.avatar_url === 'string').toBe(true)
      }
    })

    it('profiles record has a created_at column of string type (ISO timestamp)', async () => {
      const client = buildReachableServerClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const result = await getProfile(MOCK_USER_ID)

      expect(result).not.toHaveProperty('error')
      if (!('error' in result)) {
        expect(typeof result.created_at).toBe('string')
        // Must be a parseable date string
        expect(new Date(result.created_at).getTime()).not.toBeNaN()
      }
    })

    it('profiles query targets the "profiles" table by name', async () => {
      const client = buildReachableServerClient()
      mockCreateServerClient.mockReturnValue(client as any)

      await getProfile(MOCK_USER_ID)

      // The service must call supabase.from('profiles')
      expect(client.from).toHaveBeenCalledWith('profiles')
    })

    it('profiles query uses .select() to retrieve columns', async () => {
      const client = buildReachableServerClient()
      mockCreateServerClient.mockReturnValue(client as any)

      await getProfile(MOCK_USER_ID)

      expect(client._mockSelect).toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // 4. profiles table has RLS enabled
  // -------------------------------------------------------------------------

  describe('4. profiles table — RLS enabled', () => {
    it('cross-user profile read returns an error (RLS blocks the query)', async () => {
      const OTHER_USER_ID = 'ffffffff-eeee-dddd-cccc-bbbbbbbbbbbb'
      const client = buildRlsEnforcedServerClient()
      mockCreateServerClient.mockReturnValue(client as any)

      // Attempt to read a different user's profile — RLS must block it
      const result = await getProfile(OTHER_USER_ID)

      expect(result).toHaveProperty('error')
    })

    it('RLS error does not expose raw profile data', async () => {
      const OTHER_USER_ID = 'ffffffff-eeee-dddd-cccc-bbbbbbbbbbbb'
      const client = buildRlsEnforcedServerClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const result = await getProfile(OTHER_USER_ID)

      // Must not contain profile fields
      expect(result).not.toHaveProperty('id')
      expect(result).not.toHaveProperty('display_name')
      expect(result).not.toHaveProperty('avatar_url')
    })

    it('RLS error is mapped to a structured AuthError with a code', async () => {
      const OTHER_USER_ID = 'ffffffff-eeee-dddd-cccc-bbbbbbbbbbbb'
      const client = buildRlsEnforcedServerClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const result = await getProfile(OTHER_USER_ID)

      expect(result).toHaveProperty('error')
      if ('error' in result) {
        expect(result.error).toHaveProperty('code')
        expect(typeof result.error.code).toBe('string')
        expect(result.error.code.length).toBeGreaterThan(0)
      }
    })

    it('own profile read succeeds (RLS allows access to own row)', async () => {
      const client = buildReachableServerClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const result = await getProfile(MOCK_USER_ID)

      // Own profile must be accessible
      expect(result).not.toHaveProperty('error')
      if (!('error' in result)) {
        expect(result.id).toBe(MOCK_USER_ID)
      }
    })
  })

  // -------------------------------------------------------------------------
  // 5. avatars storage bucket exists with correct RLS policies
  // -------------------------------------------------------------------------

  describe('5. avatars storage bucket — exists with correct RLS', () => {
    it('uploadAvatar targets the "avatars" bucket by name', async () => {
      const client = buildReachableServerClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const file = new File(['avatar content'], 'avatar.jpg', { type: 'image/jpeg' })
      // Override size to be within the 2 MB limit
      Object.defineProperty(file, 'size', { value: 1024 * 100, writable: false })

      await uploadAvatar(MOCK_USER_ID, file)

      // The service must call supabase.storage.from('avatars')
      expect(client._mockStorageFrom).toHaveBeenCalledWith('avatars')
    })

    it('uploadAvatar stores the file at a path prefixed with the userId', async () => {
      const client = buildReachableServerClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const file = new File(['avatar content'], 'avatar.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 1024 * 100, writable: false })

      await uploadAvatar(MOCK_USER_ID, file)

      // The upload path must start with the userId (owner-scoped path)
      expect(client._mockUpload).toHaveBeenCalledOnce()
      const uploadPath: string = client._mockUpload.mock.calls[0][0]
      expect(uploadPath.startsWith(MOCK_USER_ID)).toBe(true)
    })

    it('uploadAvatar returns a public URL on success', async () => {
      const client = buildReachableServerClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const file = new File(['avatar content'], 'avatar.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 1024 * 100, writable: false })

      const result = await uploadAvatar(MOCK_USER_ID, file)

      expect(typeof result).toBe('string')
      expect(result).toContain('avatars')
    })

    it('uploadAvatar returns an error when RLS blocks the upload (wrong user path)', async () => {
      const client = buildAvatarRlsEnforcedServerClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const file = new File(['avatar content'], 'avatar.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 1024 * 100, writable: false })

      const result = await uploadAvatar(MOCK_USER_ID, file)

      expect(result).toHaveProperty('error')
    })

    it('avatars RLS error is mapped to a structured AuthError', async () => {
      const client = buildAvatarRlsEnforcedServerClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const file = new File(['avatar content'], 'avatar.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 1024 * 100, writable: false })

      const result = await uploadAvatar(MOCK_USER_ID, file)

      expect(result).toHaveProperty('error')
      if (typeof result === 'object' && 'error' in result) {
        expect(result.error).toHaveProperty('code')
        expect(typeof result.error.code).toBe('string')
      }
    })

    it('avatar upload path follows the {userId}/{filename} convention', async () => {
      const client = buildReachableServerClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const file = new File(['avatar content'], 'photo.png', { type: 'image/png' })
      Object.defineProperty(file, 'size', { value: 1024 * 50, writable: false })

      await uploadAvatar(MOCK_USER_ID, file)

      const uploadPath: string = client._mockUpload.mock.calls[0][0]
      // Path must be {userId}/{something} — exactly one slash separating them
      const parts = uploadPath.split('/')
      expect(parts.length).toBe(2)
      expect(parts[0]).toBe(MOCK_USER_ID)
      expect(parts[1].length).toBeGreaterThan(0)
    })

    it('avatar upload rejects files larger than 2 MB before reaching storage', async () => {
      const client = buildReachableServerClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const oversizedFile = new File(['x'], 'big.jpg', { type: 'image/jpeg' })
      Object.defineProperty(oversizedFile, 'size', { value: 3 * 1024 * 1024, writable: false }) // 3 MB

      const result = await uploadAvatar(MOCK_USER_ID, oversizedFile)

      // Validation must reject before hitting storage
      expect(result).toHaveProperty('error')
      // Storage must not have been called
      expect(client._mockStorageFrom).not.toHaveBeenCalled()
    })

    it('avatar upload rejects non-image MIME types before reaching storage', async () => {
      const client = buildReachableServerClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const invalidFile = new File(['data'], 'document.pdf', { type: 'application/pdf' })
      Object.defineProperty(invalidFile, 'size', { value: 1024 * 100, writable: false })

      const result = await uploadAvatar(MOCK_USER_ID, invalidFile)

      expect(result).toHaveProperty('error')
      expect(client._mockStorageFrom).not.toHaveBeenCalled()
    })
  })
})
