/**
 * Integration Tests: Review Submission Flow (Tasks 9.3, 9.4)
 *
 * Tests the full POST /api/teams/[teamId]/sprints/[sprintId]/reviews Route Handler:
 *   9.3 — Review submission → sprint_reviews upserted, sprint status → 'completed'
 *   9.4 — Review upsert → submit twice, exactly one record with latest data
 *
 * Mocks the Supabase server client to isolate Route Handler logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { Sprint, SprintReview } from '@/types/sprint'

// ---------------------------------------------------------------------------
// Mock Supabase server client
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_USER = { id: 'user-1', email: 'test@example.com' }
const TEAM_ID = 'team-abc-123'
const SPRINT_ID = 'sprint-xyz-456'

const VALID_REVIEW_BODY = {
  increment_notes: 'Delivered login flow and dashboard UI',
  stakeholder_feedback: 'Stakeholders approved the demo',
  accepted_stories_count: 5,
}

function createReviewRequest(
  teamId: string,
  sprintId: string,
  body: Record<string, unknown>
): NextRequest {
  return new NextRequest(
    new URL(
      `http://localhost:3000/api/teams/${teamId}/sprints/${sprintId}/reviews`
    ),
    {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

const ACTIVE_SPRINT: Sprint = {
  id: SPRINT_ID,
  team_id: TEAM_ID,
  sprint_number: 1,
  goal: 'Ship the dashboard',
  status: 'active',
  start_date: '2024-06-01',
  end_date: '2024-06-14',
  created_at: '2024-06-01T00:00:00Z',
}

const COMPLETED_SPRINT: Sprint = {
  ...ACTIVE_SPRINT,
  status: 'completed',
}

function buildReviewMockSupabase(options: {
  user?: typeof VALID_USER | null
  authError?: { message: string } | null
  membership?: { user_id: string } | null
  /** Sprint returned by getSprintById (team-scoped lookup) */
  sprintForLookup?: Sprint | null
  /** RPC error (null = success) */
  rpcError?: { message: string; code?: string; details?: string } | null
  /** Sprint returned after RPC completion */
  sprintAfterRpc?: Sprint | null
  /** Review returned after RPC completion */
  reviewAfterRpc?: SprintReview | null
}) {
  const {
    user = VALID_USER,
    authError = null,
    membership = { user_id: VALID_USER.id },
    sprintForLookup = ACTIVE_SPRINT,
    rpcError = null,
    sprintAfterRpc = COMPLETED_SPRINT,
    reviewAfterRpc = null,
  } = options

  const mockGetUser = vi.fn().mockResolvedValue({
    data: { user },
    error: authError,
  })

  // Track from() calls to distinguish between different table queries
  let fromCallIndex = 0

  const mockRpc = vi.fn().mockResolvedValue({
    data: null,
    error: rpcError,
  })

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === 'team_members') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: membership,
                error: null,
              }),
            }),
          }),
        }),
      }
    }

    if (table === 'sprints') {
      fromCallIndex++
      if (fromCallIndex === 1) {
        // First sprints call: getSprintById lookup (team-scoped)
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: sprintForLookup,
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      // Second sprints call: fetch updated sprint after RPC
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: sprintAfterRpc,
              error: null,
            }),
          }),
        }),
      }
    }

    if (table === 'sprint_reviews') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: reviewAfterRpc,
              error: null,
            }),
          }),
        }),
      }
    }

    return {}
  })

  return {
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
    _mocks: { mockRpc, mockFrom },
  }
}

// ---------------------------------------------------------------------------
// 9.3 — Review submission flow
// ---------------------------------------------------------------------------

describe('Integration: Review submission flow (9.3)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('should upsert review and transition sprint status to completed', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    const savedReview: SprintReview = {
      id: 'review-new-id',
      sprint_id: SPRINT_ID,
      increment_notes: VALID_REVIEW_BODY.increment_notes,
      stakeholder_feedback: VALID_REVIEW_BODY.stakeholder_feedback,
      accepted_stories_count: VALID_REVIEW_BODY.accepted_stories_count,
      created_at: new Date().toISOString(),
    }

    const mockSupabase = buildReviewMockSupabase({
      sprintAfterRpc: COMPLETED_SPRINT,
      reviewAfterRpc: savedReview,
    })

    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as never)

    const { POST } = await import(
      '@/app/api/teams/[teamId]/sprints/[sprintId]/reviews/route'
    )

    const request = createReviewRequest(TEAM_ID, SPRINT_ID, VALID_REVIEW_BODY)
    const response = await POST(request, {
      params: Promise.resolve({ teamId: TEAM_ID, sprintId: SPRINT_ID }),
    })

    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data).toBeDefined()
    expect(json.data.sprint.status).toBe('completed')
    expect(json.data.review.increment_notes).toBe(
      VALID_REVIEW_BODY.increment_notes
    )
    expect(json.data.review.stakeholder_feedback).toBe(
      VALID_REVIEW_BODY.stakeholder_feedback
    )
    expect(json.data.review.accepted_stories_count).toBe(
      VALID_REVIEW_BODY.accepted_stories_count
    )

    // Verify RPC was called with correct arguments
    expect(mockSupabase._mocks.mockRpc).toHaveBeenCalledWith(
      'complete_sprint_with_review',
      {
        p_sprint_id: SPRINT_ID,
        p_increment_notes: VALID_REVIEW_BODY.increment_notes,
        p_stakeholder_feedback: VALID_REVIEW_BODY.stakeholder_feedback,
        p_accepted_stories_count: VALID_REVIEW_BODY.accepted_stories_count,
      }
    )
  })

  it('should return 401 when user is not authenticated', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    const mockSupabase = buildReviewMockSupabase({
      user: null,
      authError: { message: 'No session' },
    })

    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as never)

    const { POST } = await import(
      '@/app/api/teams/[teamId]/sprints/[sprintId]/reviews/route'
    )

    const request = createReviewRequest(TEAM_ID, SPRINT_ID, VALID_REVIEW_BODY)
    const response = await POST(request, {
      params: Promise.resolve({ teamId: TEAM_ID, sprintId: SPRINT_ID }),
    })

    expect(response.status).toBe(401)
  })

  it('should return 403 when user is not a team member', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    const mockSupabase = buildReviewMockSupabase({ membership: null })
    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as never)

    const { POST } = await import(
      '@/app/api/teams/[teamId]/sprints/[sprintId]/reviews/route'
    )

    const request = createReviewRequest(TEAM_ID, SPRINT_ID, VALID_REVIEW_BODY)
    const response = await POST(request, {
      params: Promise.resolve({ teamId: TEAM_ID, sprintId: SPRINT_ID }),
    })

    expect(response.status).toBe(403)
  })

  it('should return 404 when sprint does not belong to team', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    const mockSupabase = buildReviewMockSupabase({ sprintForLookup: null })
    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as never)

    const { POST } = await import(
      '@/app/api/teams/[teamId]/sprints/[sprintId]/reviews/route'
    )

    const request = createReviewRequest(TEAM_ID, SPRINT_ID, VALID_REVIEW_BODY)
    const response = await POST(request, {
      params: Promise.resolve({ teamId: TEAM_ID, sprintId: SPRINT_ID }),
    })

    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.error.code).toBe('SPRINT_NOT_FOUND')
  })

  it('should return 400 when sprint is not active (SPRINT_NOT_ACTIVE)', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    const mockSupabase = buildReviewMockSupabase({
      rpcError: {
        message: 'SPRINT_NOT_ACTIVE',
        code: 'P0001',
        details: 'Sprint is not active',
      },
    })

    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as never)

    const { POST } = await import(
      '@/app/api/teams/[teamId]/sprints/[sprintId]/reviews/route'
    )

    const request = createReviewRequest(TEAM_ID, SPRINT_ID, VALID_REVIEW_BODY)
    const response = await POST(request, {
      params: Promise.resolve({ teamId: TEAM_ID, sprintId: SPRINT_ID }),
    })

    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error.code).toBe('SPRINT_NOT_ACTIVE')
  })
})

// ---------------------------------------------------------------------------
// 9.4 — Review upsert (submit twice, one record with latest data)
// ---------------------------------------------------------------------------

describe('Integration: Review upsert — submit twice, latest data wins (9.4)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('should call RPC twice and return the latest review data on second submission', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    const firstReviewBody = {
      increment_notes: 'First submission notes',
      stakeholder_feedback: 'First feedback',
      accepted_stories_count: 3,
    }

    const secondReviewBody = {
      increment_notes: 'Updated submission notes',
      stakeholder_feedback: 'Updated feedback',
      accepted_stories_count: 7,
    }

    // Track RPC calls across both submissions
    const sharedRpc = vi.fn().mockResolvedValue({ data: null, error: null })

    // --- First submission ---
    const firstReview: SprintReview = {
      id: 'review-id',
      sprint_id: SPRINT_ID,
      ...firstReviewBody,
      created_at: new Date().toISOString(),
    }

    let firstFromIndex = 0
    const firstMockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'team_members') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { user_id: VALID_USER.id },
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'sprints') {
        firstFromIndex++
        if (firstFromIndex === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: ACTIVE_SPRINT,
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: COMPLETED_SPRINT,
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'sprint_reviews') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: firstReview,
                error: null,
              }),
            }),
          }),
        }
      }
      return {}
    })

    vi.mocked(createServerClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: VALID_USER },
          error: null,
        }),
      },
      from: firstMockFrom,
      rpc: sharedRpc,
    } as never)

    const { POST } = await import(
      '@/app/api/teams/[teamId]/sprints/[sprintId]/reviews/route'
    )

    const firstRequest = createReviewRequest(TEAM_ID, SPRINT_ID, firstReviewBody)
    const firstResponse = await POST(firstRequest, {
      params: Promise.resolve({ teamId: TEAM_ID, sprintId: SPRINT_ID }),
    })

    expect(firstResponse.status).toBe(200)
    expect(sharedRpc).toHaveBeenCalledTimes(1)

    // --- Second submission (upsert) ---
    const secondReview: SprintReview = {
      id: 'review-id', // Same ID — upserted, not duplicated
      sprint_id: SPRINT_ID,
      ...secondReviewBody,
      created_at: new Date().toISOString(),
    }

    let secondFromIndex = 0
    const secondMockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'team_members') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { user_id: VALID_USER.id },
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'sprints') {
        secondFromIndex++
        if (secondFromIndex === 1) {
          // getSprintById — sprint is now completed but still belongs to team
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: COMPLETED_SPRINT,
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: COMPLETED_SPRINT,
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'sprint_reviews') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: secondReview,
                error: null,
              }),
            }),
          }),
        }
      }
      return {}
    })

    vi.mocked(createServerClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: VALID_USER },
          error: null,
        }),
      },
      from: secondMockFrom,
      rpc: sharedRpc,
    } as never)

    const secondRequest = createReviewRequest(TEAM_ID, SPRINT_ID, secondReviewBody)
    const secondResponse = await POST(secondRequest, {
      params: Promise.resolve({ teamId: TEAM_ID, sprintId: SPRINT_ID }),
    })

    const secondJson = await secondResponse.json()

    expect(secondResponse.status).toBe(200)
    expect(sharedRpc).toHaveBeenCalledTimes(2)

    // The second response should contain the latest review data
    expect(secondJson.data.review.id).toBe('review-id')
    expect(secondJson.data.review.increment_notes).toBe(
      secondReviewBody.increment_notes
    )
    expect(secondJson.data.review.accepted_stories_count).toBe(
      secondReviewBody.accepted_stories_count
    )
  })
})
