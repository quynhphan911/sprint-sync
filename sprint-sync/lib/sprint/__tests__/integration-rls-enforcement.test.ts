/**
 * Integration Tests: RLS Enforcement (Tasks 9.5, 9.6)
 *
 * Tests that the Sprint_Service and Route Handlers enforce team-scoped access:
 *   9.5 — RLS on sprints: read/write for a team the user doesn't belong to → denied
 *   9.6 — RLS on sprint_reviews: read/write for another team's sprints → denied
 *
 * These tests mock the Supabase server client to simulate RLS behavior
 * (returning empty results or errors for unauthorized access).
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
// Constants
// ---------------------------------------------------------------------------

const VALID_USER = { id: 'user-1', email: 'test@example.com' }
const OWN_TEAM_ID = 'team-own-123'
const OTHER_TEAM_ID = 'team-other-456'
const SPRINT_ID = 'sprint-xyz-789'

// ---------------------------------------------------------------------------
// 9.5 — RLS enforcement on sprints
// ---------------------------------------------------------------------------

describe('Integration: RLS enforcement on sprints (9.5)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('should return 403 when user tries to create a sprint for a team they do not belong to', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: VALID_USER },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'team_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null, // Not a member
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        return {}
      }),
    }

    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as never)

    const { POST } = await import(
      '@/app/api/teams/[teamId]/sprints/route'
    )

    const request = new NextRequest(
      new URL(`http://localhost:3000/api/teams/${OTHER_TEAM_ID}/sprints`),
      {
        method: 'POST',
        body: JSON.stringify({
          goal: 'Unauthorized sprint',
          start_date: '2024-06-01',
          end_date: '2024-06-14',
          sprint_number: 1,
        }),
        headers: { 'Content-Type': 'application/json' },
      }
    )

    const response = await POST(request, {
      params: Promise.resolve({ teamId: OTHER_TEAM_ID }),
    })

    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error.code).toBe('FORBIDDEN')
  })

  it('should return empty array when getSprintsForTeam is called for a team with no accessible sprints (RLS filtering)', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [], // RLS filters out all rows
              error: null,
            }),
          }),
        }),
      }),
    }

    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as never)

    const { getSprintsForTeam } = await import('@/lib/sprint/service')
    const result = await getSprintsForTeam(OTHER_TEAM_ID)

    expect(result).toEqual([])
  })

  it('should return null when getSprintById is called for a sprint not belonging to the team', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null, // RLS denies access
                error: null,
              }),
            }),
          }),
        }),
      }),
    }

    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as never)

    const { getSprintById } = await import('@/lib/sprint/service')
    const result = await getSprintById(SPRINT_ID, OTHER_TEAM_ID)

    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 9.6 — RLS enforcement on sprint_reviews
// ---------------------------------------------------------------------------

describe('Integration: RLS enforcement on sprint_reviews (9.6)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('should return 403 when user tries to submit a review for another team\'s sprint', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: VALID_USER },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'team_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null, // Not a member of this team
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        return {}
      }),
    }

    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as never)

    const { POST } = await import(
      '@/app/api/teams/[teamId]/sprints/[sprintId]/reviews/route'
    )

    const request = new NextRequest(
      new URL(
        `http://localhost:3000/api/teams/${OTHER_TEAM_ID}/sprints/${SPRINT_ID}/reviews`
      ),
      {
        method: 'POST',
        body: JSON.stringify({
          increment_notes: 'Unauthorized review',
          stakeholder_feedback: null,
          accepted_stories_count: 3,
        }),
        headers: { 'Content-Type': 'application/json' },
      }
    )

    const response = await POST(request, {
      params: Promise.resolve({
        teamId: OTHER_TEAM_ID,
        sprintId: SPRINT_ID,
      }),
    })

    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error.code).toBe('FORBIDDEN')
  })

  it('should return null when getSprintReview is called for a sprint with no accessible review (RLS filtering)', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null, // RLS filters out the review
              error: null,
            }),
          }),
        }),
      }),
    }

    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as never)

    const { getSprintReview } = await import('@/lib/sprint/service')
    const result = await getSprintReview(SPRINT_ID)

    expect(result).toBeNull()
  })

  it('should return 404 when review route handler finds sprint does not belong to team', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    let sprintsFromCallIndex = 0

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: VALID_USER },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'team_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { user_id: VALID_USER.id }, // User IS a member
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        if (table === 'sprints') {
          // getSprintById returns null — sprint doesn't belong to this team
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        return {}
      }),
    }

    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as never)

    const { POST } = await import(
      '@/app/api/teams/[teamId]/sprints/[sprintId]/reviews/route'
    )

    const request = new NextRequest(
      new URL(
        `http://localhost:3000/api/teams/${OTHER_TEAM_ID}/sprints/${SPRINT_ID}/reviews`
      ),
      {
        method: 'POST',
        body: JSON.stringify({
          increment_notes: 'Cross-team review attempt',
          stakeholder_feedback: null,
          accepted_stories_count: 2,
        }),
        headers: { 'Content-Type': 'application/json' },
      }
    )

    const response = await POST(request, {
      params: Promise.resolve({
        teamId: OTHER_TEAM_ID,
        sprintId: SPRINT_ID,
      }),
    })

    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.error.code).toBe('SPRINT_NOT_FOUND')
  })
})
