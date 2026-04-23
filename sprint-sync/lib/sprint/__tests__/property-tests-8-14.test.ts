/**
 * Property-Based Tests: Properties 8–14 for Sprint Dashboard & Review Management
 *
 * Uses fast-check with a minimum of 100 iterations per property.
 *
 * Properties covered:
 *   8.  Active sprint uniqueness invariant
 *   9.  Cross-team sprint access returns null
 *   10. Review submission round-trip preserves all provided fields
 *   11. Review submission transitions sprint status to completed
 *   12. Accepted stories count must be a non-negative integer
 *   13. Review upsert is idempotent
 *   14. Only active-to-completed status transition is permitted
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import type {
  Sprint,
  SprintReview,
  CreateSprintData,
  UpsertReviewData,
} from '@/types/sprint'
import { validateAcceptedStoriesCount } from '@/lib/sprint/validators'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PBT_CONFIG: fc.Parameters<unknown> = { numRuns: 100 }

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generate a random UUID-like string. */
const arbUuid = (): fc.Arbitrary<string> => fc.uuid()

/** Generate a valid ISO date string (YYYY-MM-DD) within a reasonable range. */
const arbISODate = (): fc.Arbitrary<string> =>
  fc
    .date({
      min: new Date('2000-01-01T00:00:00Z'),
      max: new Date('2099-12-31T00:00:00Z'),
    })
    .map((d) => d.toISOString().slice(0, 10))

/** Generate valid CreateSprintData. */
const arbCreateSprintData = (): fc.Arbitrary<CreateSprintData> =>
  fc
    .record({
      goal: fc
        .string({ minLength: 1, maxLength: 200 })
        .filter((s) => s.trim().length > 0),
      sprint_number: fc.integer({ min: 1, max: 10000 }),
      startOffset: fc.integer({ min: 0, max: 3650 }),
      duration: fc.integer({ min: 1, max: 90 }),
    })
    .map(({ goal, sprint_number, startOffset, duration }) => {
      const base = new Date('2020-01-01T00:00:00Z')
      const start = new Date(base.getTime() + startOffset * 86400000)
      const end = new Date(start.getTime() + duration * 86400000)
      return {
        goal,
        sprint_number,
        start_date: start.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
      }
    })

/** Generate valid UpsertReviewData. */
const arbUpsertReviewData = (): fc.Arbitrary<UpsertReviewData> =>
  fc.record({
    increment_notes: fc
      .string({ minLength: 1, maxLength: 500 })
      .filter((s) => s.trim().length > 0),
    stakeholder_feedback: fc.option(
      fc
        .string({ minLength: 1, maxLength: 500 })
        .filter((s) => s.trim().length > 0),
      { nil: null }
    ),
    accepted_stories_count: fc.integer({ min: 0, max: 1000 }),
  })

// ---------------------------------------------------------------------------
// Mock the Supabase server client module
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Property 8: Active sprint uniqueness invariant
// ---------------------------------------------------------------------------

describe('Feature: sprint-dashboard-review, Property 8: Active sprint uniqueness invariant', () => {
  /**
   * **Validates: Requirements 2.5**
   *
   * For any team that already has an active sprint, any call to createSprint
   * for that team must return a SprintError with code 'ACTIVE_SPRINT_EXISTS'.
   */
  it('should return ACTIVE_SPRINT_EXISTS when Supabase returns sprints_one_active_per_team conflict', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    await fc.assert(
      fc.asyncProperty(arbCreateSprintData(), async (data) => {
        const teamId = 'team-active-conflict'

        // Mock Supabase insert to return a conflict error for the partial unique index
        const mockSingle = vi.fn().mockResolvedValue({
          data: null,
          error: {
            message:
              'duplicate key value violates unique constraint "sprints_one_active_per_team"',
            code: '23505',
            details: 'sprints_one_active_per_team',
          },
        })
        const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
        const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
        const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert })

        vi.mocked(createServerClient).mockResolvedValue({
          from: mockFrom,
        } as never)

        const { createSprint } = await import('@/lib/sprint/service')
        const result = await createSprint(teamId, data)

        // Assert: result is an error with code ACTIVE_SPRINT_EXISTS
        expect('error' in result).toBe(true)
        if ('error' in result) {
          expect(result.error.code).toBe('ACTIVE_SPRINT_EXISTS')
        }
      }),
      PBT_CONFIG
    )
  })
})

// ---------------------------------------------------------------------------
// Property 9: Cross-team sprint access returns null
// ---------------------------------------------------------------------------

describe('Feature: sprint-dashboard-review, Property 9: Cross-team sprint access returns null', () => {
  /**
   * **Validates: Requirements 3.5**
   *
   * For any sprintId/teamId pair where the sprint belongs to a different team,
   * getSprintById must return null.
   */
  it('should return null when Supabase returns no rows for cross-team access', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    await fc.assert(
      fc.asyncProperty(arbUuid(), arbUuid(), async (sprintId, teamId) => {
        // Mock Supabase select to return no rows (simulating RLS filtering)
        const mockMaybeSingle = vi.fn().mockResolvedValue({
          data: null,
          error: null,
        })
        const mockEqTeam = vi.fn().mockReturnValue({
          maybeSingle: mockMaybeSingle,
        })
        const mockEqId = vi.fn().mockReturnValue({ eq: mockEqTeam })
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEqId })
        const mockFrom = vi.fn().mockReturnValue({ select: mockSelect })

        vi.mocked(createServerClient).mockResolvedValue({
          from: mockFrom,
        } as never)

        const { getSprintById } = await import('@/lib/sprint/service')
        const result = await getSprintById(sprintId, teamId)

        // Assert: result is null
        expect(result).toBeNull()
      }),
      PBT_CONFIG
    )
  })
})

// ---------------------------------------------------------------------------
// Property 10: Review submission round-trip preserves all provided fields
// ---------------------------------------------------------------------------

describe('Feature: sprint-dashboard-review, Property 10: Review submission round-trip preserves all provided fields', () => {
  /**
   * **Validates: Requirements 4.1**
   *
   * For any valid UpsertReviewData submitted for an active sprint, a successful
   * completeSprintWithReview call must persist a SprintReview record whose
   * fields exactly match the provided values.
   */
  it('should preserve all review fields on round-trip through completeSprintWithReview', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    await fc.assert(
      fc.asyncProperty(
        arbUuid(),
        arbUpsertReviewData(),
        async (sprintId, reviewData) => {
          const reviewId = 'review-generated-id'
          const teamId = 'team-review-roundtrip'

          // The Sprint record returned after completion
          const completedSprint: Sprint = {
            id: sprintId,
            team_id: teamId,
            sprint_number: 1,
            goal: 'Test goal',
            status: 'completed',
            start_date: '2024-01-01',
            end_date: '2024-01-14',
            created_at: new Date().toISOString(),
          }

          // The SprintReview record returned after upsert
          const savedReview: SprintReview = {
            id: reviewId,
            sprint_id: sprintId,
            increment_notes: reviewData.increment_notes,
            stakeholder_feedback: reviewData.stakeholder_feedback,
            accepted_stories_count: reviewData.accepted_stories_count,
            created_at: new Date().toISOString(),
          }

          // Mock Supabase RPC to succeed
          const mockRpc = vi.fn().mockResolvedValue({
            data: null,
            error: null,
          })

          // Mock subsequent sprint fetch
          const mockSprintSingle = vi.fn().mockResolvedValue({
            data: completedSprint,
            error: null,
          })

          // Mock subsequent review fetch
          const mockReviewSingle = vi.fn().mockResolvedValue({
            data: savedReview,
            error: null,
          })

          let fromCallCount = 0
          const mockFrom = vi.fn().mockImplementation(() => {
            fromCallCount++
            if (fromCallCount === 1) {
              // First from() call: fetch updated sprint
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: mockSprintSingle,
                  }),
                }),
              }
            }
            // Second from() call: fetch upserted review
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: mockReviewSingle,
                }),
              }),
            }
          })

          vi.mocked(createServerClient).mockResolvedValue({
            rpc: mockRpc,
            from: mockFrom,
          } as never)

          const { completeSprintWithReview } = await import(
            '@/lib/sprint/service'
          )
          const result = await completeSprintWithReview(sprintId, reviewData)

          // Assert: result is a success with matching review fields
          expect('review' in result).toBe(true)
          if ('review' in result) {
            expect(result.review.increment_notes).toBe(
              reviewData.increment_notes
            )
            expect(result.review.stakeholder_feedback).toBe(
              reviewData.stakeholder_feedback
            )
            expect(result.review.accepted_stories_count).toBe(
              reviewData.accepted_stories_count
            )
            expect(result.review.sprint_id).toBe(sprintId)
          }
        }
      ),
      PBT_CONFIG
    )
  })
})

// ---------------------------------------------------------------------------
// Property 11: Review submission transitions sprint status to completed
// ---------------------------------------------------------------------------

describe('Feature: sprint-dashboard-review, Property 11: Review submission transitions sprint status to completed', () => {
  /**
   * **Validates: Requirements 4.2**
   *
   * For any active sprint, after a successful completeSprintWithReview call,
   * the sprint's status must be 'completed'.
   */
  it('should return sprint with status completed after successful review submission', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    await fc.assert(
      fc.asyncProperty(
        arbUuid(),
        arbUpsertReviewData(),
        async (sprintId, reviewData) => {
          const teamId = 'team-status-transition'

          // The Sprint record returned after completion — status is 'completed'
          const completedSprint: Sprint = {
            id: sprintId,
            team_id: teamId,
            sprint_number: 1,
            goal: 'Sprint goal',
            status: 'completed',
            start_date: '2024-01-01',
            end_date: '2024-01-14',
            created_at: new Date().toISOString(),
          }

          const savedReview: SprintReview = {
            id: 'review-id',
            sprint_id: sprintId,
            increment_notes: reviewData.increment_notes,
            stakeholder_feedback: reviewData.stakeholder_feedback,
            accepted_stories_count: reviewData.accepted_stories_count,
            created_at: new Date().toISOString(),
          }

          // Mock Supabase RPC to succeed
          const mockRpc = vi.fn().mockResolvedValue({
            data: null,
            error: null,
          })

          let fromCallCount = 0
          const mockFrom = vi.fn().mockImplementation(() => {
            fromCallCount++
            if (fromCallCount === 1) {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi
                      .fn()
                      .mockResolvedValue({
                        data: completedSprint,
                        error: null,
                      }),
                  }),
                }),
              }
            }
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi
                    .fn()
                    .mockResolvedValue({
                      data: savedReview,
                      error: null,
                    }),
                }),
              }),
            }
          })

          vi.mocked(createServerClient).mockResolvedValue({
            rpc: mockRpc,
            from: mockFrom,
          } as never)

          const { completeSprintWithReview } = await import(
            '@/lib/sprint/service'
          )
          const result = await completeSprintWithReview(sprintId, reviewData)

          // Assert: returned sprint has status 'completed'
          expect('sprint' in result).toBe(true)
          if ('sprint' in result) {
            expect(result.sprint.status).toBe('completed')
          }
        }
      ),
      PBT_CONFIG
    )
  })
})

// ---------------------------------------------------------------------------
// Property 12: Accepted stories count must be a non-negative integer
// ---------------------------------------------------------------------------

describe('Feature: sprint-dashboard-review, Property 12: Accepted stories count must be a non-negative integer', () => {
  /**
   * **Validates: Requirements 4.4**
   *
   * For any value that is negative or not an integer, validateAcceptedStoriesCount
   * must return valid: false. For any non-negative integer (including 0),
   * validateAcceptedStoriesCount must return valid: true.
   */

  /** Generate invalid accepted stories counts: negatives, floats, NaN. */
  const arbInvalidStoriesCount = (): fc.Arbitrary<number> =>
    fc.oneof(
      fc.integer({ min: -10000, max: -1 }),
      fc
        .double({ min: 0.01, max: 10000, noNaN: true })
        .filter((n) => !Number.isInteger(n)),
      fc.constant(NaN),
      fc.constant(Infinity),
      fc.constant(-Infinity)
    )

  /** Generate valid accepted stories counts: non-negative integers. */
  const arbValidStoriesCount = (): fc.Arbitrary<number> =>
    fc.integer({ min: 0, max: 100000 })

  it('rejects negative integers, floats, NaN, and Infinity', () => {
    fc.assert(
      fc.property(arbInvalidStoriesCount(), (value) => {
        const result = validateAcceptedStoriesCount(value)
        expect(result.valid).toBe(false)
      }),
      PBT_CONFIG
    )
  })

  it('accepts all non-negative integers including zero', () => {
    fc.assert(
      fc.property(arbValidStoriesCount(), (value) => {
        const result = validateAcceptedStoriesCount(value)
        expect(result.valid).toBe(true)
      }),
      PBT_CONFIG
    )
  })
})

// ---------------------------------------------------------------------------
// Property 13: Review upsert is idempotent
// ---------------------------------------------------------------------------

describe('Feature: sprint-dashboard-review, Property 13: Review upsert is idempotent', () => {
  /**
   * **Validates: Requirements 4.5**
   *
   * For any sprint, calling completeSprintWithReview multiple times must
   * result in the RPC being called with correct arguments each time.
   * The ON CONFLICT upsert is handled by the DB function, so we verify
   * the RPC is called correctly.
   */
  it('should call RPC with correct arguments on repeated calls', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    await fc.assert(
      fc.asyncProperty(
        arbUuid(),
        arbUpsertReviewData(),
        arbUpsertReviewData(),
        async (sprintId, reviewData1, reviewData2) => {
          const teamId = 'team-idempotent'

          const completedSprint: Sprint = {
            id: sprintId,
            team_id: teamId,
            sprint_number: 1,
            goal: 'Sprint goal',
            status: 'completed',
            start_date: '2024-01-01',
            end_date: '2024-01-14',
            created_at: new Date().toISOString(),
          }

          const makeReview = (data: UpsertReviewData): SprintReview => ({
            id: 'review-id',
            sprint_id: sprintId,
            increment_notes: data.increment_notes,
            stakeholder_feedback: data.stakeholder_feedback,
            accepted_stories_count: data.accepted_stories_count,
            created_at: new Date().toISOString(),
          })

          // Track RPC calls
          const mockRpc = vi.fn().mockResolvedValue({
            data: null,
            error: null,
          })

          const createMockFrom = (reviewData: UpsertReviewData) => {
            let callCount = 0
            return vi.fn().mockImplementation(() => {
              callCount++
              if (callCount === 1) {
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({
                        data: completedSprint,
                        error: null,
                      }),
                    }),
                  }),
                }
              }
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: makeReview(reviewData),
                      error: null,
                    }),
                  }),
                }),
              }
            })
          }

          // First call
          vi.mocked(createServerClient).mockResolvedValue({
            rpc: mockRpc,
            from: createMockFrom(reviewData1),
          } as never)

          const { completeSprintWithReview } = await import(
            '@/lib/sprint/service'
          )
          await completeSprintWithReview(sprintId, reviewData1)

          // Second call
          vi.mocked(createServerClient).mockResolvedValue({
            rpc: mockRpc,
            from: createMockFrom(reviewData2),
          } as never)

          await completeSprintWithReview(sprintId, reviewData2)

          // Assert: RPC was called twice with correct arguments
          expect(mockRpc).toHaveBeenCalledTimes(2)

          expect(mockRpc).toHaveBeenNthCalledWith(
            1,
            'complete_sprint_with_review',
            {
              p_sprint_id: sprintId,
              p_increment_notes: reviewData1.increment_notes,
              p_stakeholder_feedback: reviewData1.stakeholder_feedback,
              p_accepted_stories_count: reviewData1.accepted_stories_count,
            }
          )

          expect(mockRpc).toHaveBeenNthCalledWith(
            2,
            'complete_sprint_with_review',
            {
              p_sprint_id: sprintId,
              p_increment_notes: reviewData2.increment_notes,
              p_stakeholder_feedback: reviewData2.stakeholder_feedback,
              p_accepted_stories_count: reviewData2.accepted_stories_count,
            }
          )
        }
      ),
      PBT_CONFIG
    )
  })
})

// ---------------------------------------------------------------------------
// Property 14: Only active-to-completed status transition is permitted
// ---------------------------------------------------------------------------

describe('Feature: sprint-dashboard-review, Property 14: Only active-to-completed status transition is permitted', () => {
  /**
   * **Validates: Requirements 5.1, 5.2**
   *
   * For any completed sprint, any attempt to call completeSprintWithReview
   * must return an error with code 'SPRINT_NOT_ACTIVE'.
   */
  it('should return SPRINT_NOT_ACTIVE when RPC returns SPRINT_NOT_ACTIVE error', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    await fc.assert(
      fc.asyncProperty(
        arbUuid(),
        arbUpsertReviewData(),
        async (sprintId, reviewData) => {
          // Mock Supabase RPC to return SPRINT_NOT_ACTIVE error
          const mockRpc = vi.fn().mockResolvedValue({
            data: null,
            error: {
              message: 'SPRINT_NOT_ACTIVE',
              code: 'P0001',
              details: 'Sprint is not active',
            },
          })

          vi.mocked(createServerClient).mockResolvedValue({
            rpc: mockRpc,
            from: vi.fn(),
          } as never)

          const { completeSprintWithReview } = await import(
            '@/lib/sprint/service'
          )
          const result = await completeSprintWithReview(sprintId, reviewData)

          // Assert: result is an error with code SPRINT_NOT_ACTIVE
          expect('error' in result).toBe(true)
          if ('error' in result) {
            expect(result.error.code).toBe('SPRINT_NOT_ACTIVE')
          }
        }
      ),
      PBT_CONFIG
    )
  })
})
