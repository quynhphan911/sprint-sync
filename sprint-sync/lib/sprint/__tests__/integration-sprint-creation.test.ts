/**
 * Integration Tests: Sprint Creation Flow (Tasks 9.1, 9.2)
 *
 * Tests the full POST /api/teams/[teamId]/sprints Route Handler flow:
 *   9.1 — Sprint creation with valid data → sprint record with status='active'
 *   9.2 — Active sprint conflict → 409 response, no new record
 *
 * Mocks the Supabase server client to isolate Route Handler logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mock Supabase server client
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createSprintRequest(
  teamId: string,
  body: Record<string, unknown>
): NextRequest {
  return new NextRequest(
    new URL(`http://localhost:3000/api/teams/${teamId}/sprints`),
    {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

const VALID_USER = { id: 'user-1', email: 'test@example.com' }
const TEAM_ID = 'team-abc-123'

const VALID_SPRINT_BODY = {
  goal: 'Ship the dashboard feature',
  start_date: '2024-06-01',
  end_date: '2024-06-14',
  sprint_number: 1,
}

/**
 * Build a mock Supabase client with configurable behavior for auth, membership,
 * and sprint insert.
 */
function buildMockSupabase(options: {
  user?: typeof VALID_USER | null
  authError?: { message: string } | null
  membership?: { user_id: string } | null
  membershipError?: { message: string } | null
  insertData?: Record<string, unknown> | null
  insertError?: { message: string; code?: string; details?: string } | null
}) {
  const {
    user = VALID_USER,
    authError = null,
    membership = { user_id: VALID_USER.id },
    membershipError = null,
    insertData = null,
    insertError = null,
  } = options

  // Auth mock
  const mockGetUser = vi.fn().mockResolvedValue({
    data: { user },
    error: authError,
  })

  // team_members query mock
  const mockMaybeSingle = vi.fn().mockResolvedValue({
    data: membership,
    error: membershipError,
  })
  const mockMemberEqUserId = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
  const mockMemberEqTeamId = vi.fn().mockReturnValue({ eq: mockMemberEqUserId })
  const mockMemberSelect = vi.fn().mockReturnValue({ eq: mockMemberEqTeamId })

  // sprints insert mock
  const mockInsertSingle = vi.fn().mockResolvedValue({
    data: insertData,
    error: insertError,
  })
  const mockInsertSelect = vi.fn().mockReturnValue({ single: mockInsertSingle })
  const mockInsert = vi.fn().mockReturnValue({ select: mockInsertSelect })

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === 'team_members') {
      return { select: mockMemberSelect }
    }
    if (table === 'sprints') {
      return { insert: mockInsert }
    }
    return {}
  })

  return {
    auth: { getUser: mockGetUser },
    from: mockFrom,
    _mocks: {
      mockGetUser,
      mockFrom,
      mockInsert,
      mockInsertSingle,
    },
  }
}

// ---------------------------------------------------------------------------
// 9.1 — Sprint creation flow
// ---------------------------------------------------------------------------

describe('Integration: Sprint creation flow (9.1)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('should create a sprint with correct fields and status=active on valid POST', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    const createdSprint = {
      id: 'sprint-new-id',
      team_id: TEAM_ID,
      sprint_number: VALID_SPRINT_BODY.sprint_number,
      goal: VALID_SPRINT_BODY.goal,
      status: 'active',
      start_date: VALID_SPRINT_BODY.start_date,
      end_date: VALID_SPRINT_BODY.end_date,
      created_at: new Date().toISOString(),
    }

    const mockSupabase = buildMockSupabase({
      insertData: createdSprint,
      insertError: null,
    })

    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as never)

    const { POST } = await import(
      '@/app/api/teams/[teamId]/sprints/route'
    )

    const request = createSprintRequest(TEAM_ID, VALID_SPRINT_BODY)
    const response = await POST(request, {
      params: Promise.resolve({ teamId: TEAM_ID }),
    })

    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data).toBeDefined()
    expect(json.data.status).toBe('active')
    expect(json.data.goal).toBe(VALID_SPRINT_BODY.goal)
    expect(json.data.sprint_number).toBe(VALID_SPRINT_BODY.sprint_number)
    expect(json.data.start_date).toBe(VALID_SPRINT_BODY.start_date)
    expect(json.data.end_date).toBe(VALID_SPRINT_BODY.end_date)
    expect(json.data.team_id).toBe(TEAM_ID)
  })

  it('should return 401 when user is not authenticated', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    const mockSupabase = buildMockSupabase({
      user: null,
      authError: { message: 'No session' },
    })

    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as never)

    const { POST } = await import(
      '@/app/api/teams/[teamId]/sprints/route'
    )

    const request = createSprintRequest(TEAM_ID, VALID_SPRINT_BODY)
    const response = await POST(request, {
      params: Promise.resolve({ teamId: TEAM_ID }),
    })

    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('should return 403 when user is not a team member', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    const mockSupabase = buildMockSupabase({
      membership: null,
    })

    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as never)

    const { POST } = await import(
      '@/app/api/teams/[teamId]/sprints/route'
    )

    const request = createSprintRequest(TEAM_ID, VALID_SPRINT_BODY)
    const response = await POST(request, {
      params: Promise.resolve({ teamId: TEAM_ID }),
    })

    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error.code).toBe('FORBIDDEN')
  })

  it('should return 400 when goal is empty', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    const mockSupabase = buildMockSupabase({})
    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as never)

    const { POST } = await import(
      '@/app/api/teams/[teamId]/sprints/route'
    )

    const request = createSprintRequest(TEAM_ID, {
      ...VALID_SPRINT_BODY,
      goal: '',
    })
    const response = await POST(request, {
      params: Promise.resolve({ teamId: TEAM_ID }),
    })

    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error.code).toBe('GOAL_REQUIRED')
  })
})

// ---------------------------------------------------------------------------
// 9.2 — Active sprint conflict
// ---------------------------------------------------------------------------

describe('Integration: Active sprint conflict (9.2)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('should return 409 when team already has an active sprint', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    const mockSupabase = buildMockSupabase({
      insertData: null,
      insertError: {
        message:
          'duplicate key value violates unique constraint "sprints_one_active_per_team"',
        code: '23505',
        details: 'sprints_one_active_per_team',
      },
    })

    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as never)

    const { POST } = await import(
      '@/app/api/teams/[teamId]/sprints/route'
    )

    const request = createSprintRequest(TEAM_ID, VALID_SPRINT_BODY)
    const response = await POST(request, {
      params: Promise.resolve({ teamId: TEAM_ID }),
    })

    const json = await response.json()

    expect(response.status).toBe(409)
    expect(json.error.code).toBe('ACTIVE_SPRINT_EXISTS')
    expect(json.error.message).toContain('already has an active sprint')
  })

  it('should return 409 when sprint_number is a duplicate', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    const mockSupabase = buildMockSupabase({
      insertData: null,
      insertError: {
        message:
          'duplicate key value violates unique constraint "sprints_team_id_sprint_number_key"',
        code: '23505',
        details: 'sprints_team_id_sprint_number_key',
      },
    })

    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as never)

    const { POST } = await import(
      '@/app/api/teams/[teamId]/sprints/route'
    )

    const request = createSprintRequest(TEAM_ID, VALID_SPRINT_BODY)
    const response = await POST(request, {
      params: Promise.resolve({ teamId: TEAM_ID }),
    })

    const json = await response.json()

    expect(response.status).toBe(409)
    expect(json.error.code).toBe('SPRINT_NUMBER_DUPLICATE')
  })
})
