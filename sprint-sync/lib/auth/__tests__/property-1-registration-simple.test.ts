/**
 * Simple verification test for Property 1 test setup
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerWithEmail } from '../service'
import { sanitiseDisplayName } from '../validators'

// Mock the Supabase server client
vi.mock('../../supabase/server', () => ({
  createServerClient: vi.fn(),
}))

describe('Property 1 Test Setup Verification', () => {
  let mockSupabaseClient: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockSupabaseClient = {
      auth: {
        signUp: vi.fn(),
      },
      from: vi.fn(),
    }

    const { createServerClient } = require('../../supabase/server')
    createServerClient.mockReturnValue(mockSupabaseClient)
  })

  it('should verify mocking works for a single registration', async () => {
    const email = 'test@example.com'
    const password = 'Password123'
    const displayName = 'Test User'
    const mockUserId = 'test-user-id'

    mockSupabaseClient.auth.signUp.mockResolvedValue({
      data: {
        user: { id: mockUserId, email },
        session: { access_token: 'token' },
      },
      error: null,
    })

    const mockProfileInsert = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    })

    mockSupabaseClient.from.mockReturnValue({
      insert: mockProfileInsert,
    })

    const result = await registerWithEmail(email, password, displayName)

    expect('user' in result).toBe(true)
    expect(mockProfileInsert).toHaveBeenCalledWith({
      id: mockUserId,
      display_name: sanitiseDisplayName(displayName),
      avatar_url: null,
    })
  })
})
