/**
 * Integration Tests: Cross-Team Access & Dashboard Scoping (Tasks 9.7, 9.8)
 *
 *   9.7 — Cross-team 404: getSprintById returns null for another team's sprint
 *   9.8 — Dashboard data scoping: getSprintsForTeam only returns sprints for the specified teamId
 *
 * Mocks the Supabase server client to isolate Sprint_Service logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Sprint } from '@/types/sprint'

// ---------------------------------------------------------------------------
// Mock Supabase server client
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEAM_A_ID = 'team-a-111'
const TEAM_B_ID = 'team-b-222'

const TEAM_A_SPRINTS: Sprint[] = [
  {
    id: 'sprint-a1',
    team_id: TEAM_A_ID,
    sprint_number: 2,
    goal: 'Team A Sprint 2',
    status: 'completed',
    start_date: '2024-06-15',
    end_date: '2024-06-28',
    created_at: '2024-06-15T00:00:00Z',
  },
  {
    id: 'sprint-a2',
    team_id: TEAM_A_ID,
    sprint_number: 1,
    goal: 'Team A Sprint 1',
    status: 'active',
    start_date: '2024-06-01',
    end_date: '2024-06-14',
    created_at: '2024-06-01T00:00:00Z',
  },
]

const TEAM_B_SPRINTS: Sprint[] = [
  {
    id: 'sprint-b1',
    team_id: TEAM_B_ID,
    sprint_number: 1,
    goal: 'Team B Sprint 1',
    status: 'active',
    start_date: '2024-07-01',
    end_date: '2024-07-14',
    created_at: '2024-07-01T00:00:00Z',
  },
]

// ---------------------------------------------------------------------------
// 9.7 — Cross-team 404
// ---------------------------------------------------------------------------

describe('Integration: Cross-team 404 (9.7)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('should return null when getSprintById is called with a sprintId belonging to another team', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    // sprint-b1 belongs to TEAM_B, but we query with TEAM_A
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null, // No match because team_id filter excludes it
                error: null,
              }),
            }),
          }),
        }),
      }),
    }

    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as never)

    const { getSprintById } = await import('@/lib/sprint/service')
    const result = await getSprintById('sprint-b1', TEAM_A_ID)

    expect(result).toBeNull()
  })

  it('should return null for a non-existent sprintId', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
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
      }),
    }

    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as never)

    const { getSprintById } = await import('@/lib/sprint/service')
    const result = await getSprintById('non-existent-sprint', TEAM_A_ID)

    expect(result).toBeNull()
  })

  it('should return the sprint when sprintId belongs to the correct team', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: TEAM_A_SPRINTS[0],
                error: null,
              }),
            }),
          }),
        }),
      }),
    }

    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as never)

    const { getSprintById } = await import('@/lib/sprint/service')
    const result = await getSprintById('sprint-a1', TEAM_A_ID)

    expect(result).not.toBeNull()
    expect(result!.id).toBe('sprint-a1')
    expect(result!.team_id).toBe(TEAM_A_ID)
  })
})

// ---------------------------------------------------------------------------
// 9.8 — Dashboard data scoping
// ---------------------------------------------------------------------------

describe('Integration: Dashboard data scoping (9.8)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('should only return sprints for the specified teamId', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    // Mock returns only Team A's sprints when queried with Team A's ID
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: TEAM_A_SPRINTS,
              error: null,
            }),
          }),
        }),
      }),
    }

    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as never)

    const { getSprintsForTeam } = await import('@/lib/sprint/service')
    const result = await getSprintsForTeam(TEAM_A_ID)

    expect(result).toHaveLength(2)
    result.forEach((sprint) => {
      expect(sprint.team_id).toBe(TEAM_A_ID)
    })
  })

  it('should return empty array when team has no sprints', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      }),
    }

    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as never)

    const { getSprintsForTeam } = await import('@/lib/sprint/service')
    const result = await getSprintsForTeam('team-empty-999')

    expect(result).toEqual([])
  })

  it('should not include sprints from other teams in the result', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    // When querying Team B, only Team B sprints are returned
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: TEAM_B_SPRINTS,
              error: null,
            }),
          }),
        }),
      }),
    }

    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as never)

    const { getSprintsForTeam } = await import('@/lib/sprint/service')
    const result = await getSprintsForTeam(TEAM_B_ID)

    expect(result).toHaveLength(1)
    expect(result[0].team_id).toBe(TEAM_B_ID)

    // Verify no Team A sprints leaked in
    const teamAIds = TEAM_A_SPRINTS.map((s) => s.id)
    result.forEach((sprint) => {
      expect(teamAIds).not.toContain(sprint.id)
    })
  })

  it('should pass the correct teamId to the Supabase eq filter', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    const mockEq = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({
        data: TEAM_A_SPRINTS,
        error: null,
      }),
    })

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: mockEq,
        }),
      }),
    }

    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as never)

    const { getSprintsForTeam } = await import('@/lib/sprint/service')
    await getSprintsForTeam(TEAM_A_ID)

    // Verify the eq filter was called with 'team_id' and the correct teamId
    expect(mockEq).toHaveBeenCalledWith('team_id', TEAM_A_ID)
  })
})
