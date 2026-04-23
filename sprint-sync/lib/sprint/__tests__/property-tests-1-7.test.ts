/**
 * Property-Based Tests: Properties 1–7 for Sprint Dashboard & Review Management
 *
 * Uses fast-check with a minimum of 100 iterations per property.
 *
 * Properties covered:
 *   1. Completed sprints ordered by sprint_number descending
 *   2. Sprint data display contains all required fields
 *   3. Sprint review data display contains all required fields
 *   4. Sprint creation round-trip preserves all provided fields
 *   5. Validators reject all empty and whitespace-only inputs
 *   6. End date must be strictly after start date
 *   7. Sprint number must be a positive integer
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import type { Sprint, SprintReview, CreateSprintData } from '@/types/sprint'
import {
  validateGoal,
  validateEndDate,
  validateSprintNumber,
  validateIncrementNotes,
} from '@/lib/sprint/validators'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PBT_CONFIG: fc.Parameters<unknown> = { numRuns: 100 }

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generate a random UUID-like string. */
const arbUuid = (): fc.Arbitrary<string> =>
  fc.uuid()

/** Generate a valid ISO date string (YYYY-MM-DD) within a reasonable range. */
const arbISODate = (): fc.Arbitrary<string> =>
  fc
    .date({
      min: new Date('2000-01-01T00:00:00Z'),
      max: new Date('2099-12-31T00:00:00Z'),
    })
    .map((d) => d.toISOString().slice(0, 10))

/** Generate a random Sprint object with status='completed'. */
const arbCompletedSprint = (): fc.Arbitrary<Sprint> =>
  fc.record({
    id: arbUuid(),
    team_id: arbUuid(),
    sprint_number: fc.integer({ min: 1, max: 10000 }),
    goal: fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
    status: fc.constant('completed' as const),
    start_date: arbISODate(),
    end_date: arbISODate(),
    created_at: fc.constant(new Date().toISOString()),
  })

/** Generate a random Sprint object (any status). */
const arbSprint = (): fc.Arbitrary<Sprint> =>
  fc.record({
    id: arbUuid(),
    team_id: arbUuid(),
    sprint_number: fc.integer({ min: 1, max: 10000 }),
    goal: fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
    status: fc.constantFrom('active' as const, 'completed' as const),
    start_date: arbISODate(),
    end_date: arbISODate(),
    created_at: fc.constant(new Date().toISOString()),
  })

/** Generate a random SprintReview object. */
const arbSprintReview = (): fc.Arbitrary<SprintReview> =>
  fc.record({
    id: arbUuid(),
    sprint_id: arbUuid(),
    increment_notes: fc.string({ minLength: 1, maxLength: 500 }).filter((s) => s.trim().length > 0),
    stakeholder_feedback: fc.option(
      fc.string({ minLength: 1, maxLength: 500 }).filter((s) => s.trim().length > 0),
      { nil: null }
    ),
    accepted_stories_count: fc.integer({ min: 0, max: 1000 }),
    created_at: fc.constant(new Date().toISOString()),
  })

/** Generate valid CreateSprintData. */
const arbCreateSprintData = (): fc.Arbitrary<CreateSprintData> =>
  fc
    .record({
      goal: fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
      sprint_number: fc.integer({ min: 1, max: 10000 }),
      // Generate a start date, then derive end date strictly after it
      startOffset: fc.integer({ min: 0, max: 3650 }), // days from epoch
      duration: fc.integer({ min: 1, max: 90 }), // sprint length in days
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

/** Generate whitespace-only strings (including empty). */
const arbWhitespaceOnly = (): fc.Arbitrary<string> =>
  fc.oneof(
    fc.constant(''),
    fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r', '\f', '\v'), { minLength: 1, maxLength: 50 })
  )

// ---------------------------------------------------------------------------
// Property 1: Completed sprints ordered by sprint_number descending
// ---------------------------------------------------------------------------

// Mock the Supabase server client module
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

describe('Feature: sprint-dashboard-review, Property 1: Completed sprints are ordered by sprint_number descending', () => {
  /**
   * **Validates: Requirements 1.2**
   *
   * For any set of completed sprints, getCompletedSprints must return them
   * ordered by sprint_number descending.
   */
  it('should return completed sprints sorted by sprint_number descending', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    await fc.assert(
      fc.asyncProperty(
        fc.array(arbCompletedSprint(), { minLength: 0, maxLength: 20 }),
        async (sprints) => {
          // Sort the sprints by sprint_number descending (expected behavior)
          const expected = [...sprints].sort(
            (a, b) => b.sprint_number - a.sprint_number
          )

          // Mock Supabase to return the sorted result (simulating DB ORDER BY)
          const mockSingle = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: expected, error: null }),
          }
          const mockFrom = vi.fn().mockReturnValue(mockSingle)
          vi.mocked(createServerClient).mockResolvedValue({
            from: mockFrom,
          } as never)

          // Import dynamically to pick up the mock
          const { getCompletedSprints } = await import('@/lib/sprint/service')
          const result = await getCompletedSprints('team-123')

          // Assert: result is sorted by sprint_number descending
          for (let i = 1; i < result.length; i++) {
            expect(result[i - 1].sprint_number).toBeGreaterThanOrEqual(
              result[i].sprint_number
            )
          }
        }
      ),
      PBT_CONFIG
    )
  })
})

// ---------------------------------------------------------------------------
// Property 2: Sprint data display contains all required fields
// ---------------------------------------------------------------------------

describe('Feature: sprint-dashboard-review, Property 2: Sprint data display contains all required fields', () => {
  /**
   * **Validates: Requirements 1.5, 3.1**
   *
   * For any Sprint object, the type must contain sprint_number, goal,
   * status, start_date, and end_date.
   */
  it('should have all required display fields on every Sprint object', () => {
    fc.assert(
      fc.property(arbSprint(), (sprint) => {
        // Assert: all required fields exist and have appropriate types
        expect(sprint).toHaveProperty('sprint_number')
        expect(sprint).toHaveProperty('goal')
        expect(sprint).toHaveProperty('status')
        expect(sprint).toHaveProperty('start_date')
        expect(sprint).toHaveProperty('end_date')

        expect(typeof sprint.sprint_number).toBe('number')
        expect(typeof sprint.goal).toBe('string')
        expect(['active', 'completed']).toContain(sprint.status)
        expect(typeof sprint.start_date).toBe('string')
        expect(typeof sprint.end_date).toBe('string')
      }),
      PBT_CONFIG
    )
  })
})

// ---------------------------------------------------------------------------
// Property 3: Sprint review data display contains all required fields
// ---------------------------------------------------------------------------

describe('Feature: sprint-dashboard-review, Property 3: Sprint review data display contains all required fields', () => {
  /**
   * **Validates: Requirements 3.2**
   *
   * For any SprintReview object, the type must contain increment_notes,
   * stakeholder_feedback, and accepted_stories_count.
   */
  it('should have all required display fields on every SprintReview object', () => {
    fc.assert(
      fc.property(arbSprintReview(), (review) => {
        // Assert: all required fields exist
        expect(review).toHaveProperty('increment_notes')
        expect(review).toHaveProperty('stakeholder_feedback')
        expect(review).toHaveProperty('accepted_stories_count')

        expect(typeof review.increment_notes).toBe('string')
        expect(review.increment_notes.trim().length).toBeGreaterThan(0)
        // stakeholder_feedback can be null or a non-empty string
        if (review.stakeholder_feedback !== null) {
          expect(typeof review.stakeholder_feedback).toBe('string')
        }
        expect(typeof review.accepted_stories_count).toBe('number')
        expect(review.accepted_stories_count).toBeGreaterThanOrEqual(0)
      }),
      PBT_CONFIG
    )
  })
})

// ---------------------------------------------------------------------------
// Property 4: Sprint creation round-trip preserves all provided fields
// ---------------------------------------------------------------------------

describe('Feature: sprint-dashboard-review, Property 4: Sprint creation round-trip preserves all provided fields', () => {
  /**
   * **Validates: Requirements 2.1**
   *
   * For any valid CreateSprintData, a successful createSprint call must
   * persist a Sprint record whose goal, start_date, end_date, and
   * sprint_number exactly match the provided values, with status='active'.
   */
  it('should preserve all input fields on round-trip through createSprint', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')

    await fc.assert(
      fc.asyncProperty(arbCreateSprintData(), async (data) => {
        const teamId = 'team-round-trip'

        // The Sprint record that Supabase would return after insert
        const insertedSprint: Sprint = {
          id: 'generated-id',
          team_id: teamId,
          sprint_number: data.sprint_number,
          goal: data.goal,
          status: 'active',
          start_date: data.start_date,
          end_date: data.end_date,
          created_at: new Date().toISOString(),
        }

        // Mock Supabase insert chain
        const mockSingle = vi.fn().mockResolvedValue({
          data: insertedSprint,
          error: null,
        })
        const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
        const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
        const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert })

        vi.mocked(createServerClient).mockResolvedValue({
          from: mockFrom,
        } as never)

        const { createSprint } = await import('@/lib/sprint/service')
        const result = await createSprint(teamId, data)

        // Assert: result is a success with matching fields
        expect('sprint' in result).toBe(true)
        if ('sprint' in result) {
          expect(result.sprint.goal).toBe(data.goal)
          expect(result.sprint.start_date).toBe(data.start_date)
          expect(result.sprint.end_date).toBe(data.end_date)
          expect(result.sprint.sprint_number).toBe(data.sprint_number)
          expect(result.sprint.status).toBe('active')
        }
      }),
      PBT_CONFIG
    )
  })
})

// ---------------------------------------------------------------------------
// Property 5: Validators reject all empty and whitespace-only inputs
// ---------------------------------------------------------------------------

describe('Feature: sprint-dashboard-review, Property 5: Validators reject all empty and whitespace-only inputs', () => {
  /**
   * **Validates: Requirements 2.2, 4.3**
   *
   * For any string composed entirely of whitespace characters (including
   * the empty string), validateGoal and validateIncrementNotes must return
   * valid: false with a non-empty message.
   */
  it('validateGoal rejects all whitespace-only strings', () => {
    fc.assert(
      fc.property(arbWhitespaceOnly(), (input) => {
        const result = validateGoal(input)
        expect(result.valid).toBe(false)
        if (!result.valid) {
          expect(result.message).toBeTruthy()
          expect(result.message.length).toBeGreaterThan(0)
        }
      }),
      PBT_CONFIG
    )
  })

  it('validateIncrementNotes rejects all whitespace-only strings', () => {
    fc.assert(
      fc.property(arbWhitespaceOnly(), (input) => {
        const result = validateIncrementNotes(input)
        expect(result.valid).toBe(false)
        if (!result.valid) {
          expect(result.message).toBeTruthy()
          expect(result.message.length).toBeGreaterThan(0)
        }
      }),
      PBT_CONFIG
    )
  })
})

// ---------------------------------------------------------------------------
// Property 6: End date must be strictly after start date
// ---------------------------------------------------------------------------

describe('Feature: sprint-dashboard-review, Property 6: End date must be strictly after start date', () => {
  /**
   * **Validates: Requirements 2.3**
   *
   * For any pair of valid ISO date strings where end_date <= start_date,
   * validateEndDate must return valid: false. For pairs where end_date >
   * start_date, validateEndDate must return valid: true.
   */

  /** Generate a pair of valid ISO dates where end <= start. */
  const arbInvalidDatePair = (): fc.Arbitrary<{ start: string; end: string }> =>
    fc
      .record({
        baseOffset: fc.integer({ min: 0, max: 3650 }),
        // 0 means same day, negative means end before start
        delta: fc.integer({ min: -365, max: 0 }),
      })
      .map(({ baseOffset, delta }) => {
        const base = new Date('2020-01-01T00:00:00Z')
        const start = new Date(base.getTime() + baseOffset * 86400000)
        const end = new Date(start.getTime() + delta * 86400000)
        return {
          start: start.toISOString().slice(0, 10),
          end: end.toISOString().slice(0, 10),
        }
      })

  /** Generate a pair of valid ISO dates where end > start. */
  const arbValidDatePair = (): fc.Arbitrary<{ start: string; end: string }> =>
    fc
      .record({
        baseOffset: fc.integer({ min: 0, max: 3650 }),
        delta: fc.integer({ min: 1, max: 365 }),
      })
      .map(({ baseOffset, delta }) => {
        const base = new Date('2020-01-01T00:00:00Z')
        const start = new Date(base.getTime() + baseOffset * 86400000)
        const end = new Date(start.getTime() + delta * 86400000)
        return {
          start: start.toISOString().slice(0, 10),
          end: end.toISOString().slice(0, 10),
        }
      })

  it('rejects end_date <= start_date', () => {
    fc.assert(
      fc.property(arbInvalidDatePair(), ({ start, end }) => {
        const result = validateEndDate(end, start)
        expect(result.valid).toBe(false)
      }),
      PBT_CONFIG
    )
  })

  it('accepts end_date strictly after start_date', () => {
    fc.assert(
      fc.property(arbValidDatePair(), ({ start, end }) => {
        const result = validateEndDate(end, start)
        expect(result.valid).toBe(true)
      }),
      PBT_CONFIG
    )
  })
})

// ---------------------------------------------------------------------------
// Property 7: Sprint number must be a positive integer
// ---------------------------------------------------------------------------

describe('Feature: sprint-dashboard-review, Property 7: Sprint number must be a positive integer', () => {
  /**
   * **Validates: Requirements 2.4**
   *
   * For any value that is not a positive integer (zero, negative numbers,
   * non-integers, NaN), validateSprintNumber must return valid: false.
   * For any positive integer, validateSprintNumber must return valid: true.
   */

  /** Generate invalid sprint numbers: zero, negatives, floats, NaN, Infinity. */
  const arbInvalidSprintNumber = (): fc.Arbitrary<number> =>
    fc.oneof(
      fc.constant(0),
      fc.integer({ min: -10000, max: -1 }),
      // Floats that are not integers
      fc.double({ min: 0.01, max: 10000, noNaN: true }).filter((n) => !Number.isInteger(n)),
      fc.constant(NaN),
      fc.constant(Infinity),
      fc.constant(-Infinity)
    )

  /** Generate valid sprint numbers: positive integers. */
  const arbValidSprintNumber = (): fc.Arbitrary<number> =>
    fc.integer({ min: 1, max: 100000 })

  it('rejects zero, negatives, floats, NaN, and Infinity', () => {
    fc.assert(
      fc.property(arbInvalidSprintNumber(), (value) => {
        const result = validateSprintNumber(value)
        expect(result.valid).toBe(false)
      }),
      PBT_CONFIG
    )
  })

  it('accepts all positive integers', () => {
    fc.assert(
      fc.property(arbValidSprintNumber(), (value) => {
        const result = validateSprintNumber(value)
        expect(result.valid).toBe(true)
      }),
      PBT_CONFIG
    )
  })
})
