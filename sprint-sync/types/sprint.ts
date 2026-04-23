/**
 * Shared TypeScript types for Sprint and Sprint Review entities.
 *
 * Validates: Requirements 1.1, 1.2, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2
 */

/**
 * The lifecycle status of a sprint.
 * A sprint starts as 'active' and transitions to 'completed' when a review is submitted.
 */
export type SprintStatus = 'active' | 'completed'

/**
 * A sprint record stored in the `sprints` table.
 * Each sprint belongs to a team and has a unique sprint_number within that team.
 *
 * Validates: Requirements 1.1, 1.2, 1.5, 2.1, 3.1
 */
export interface Sprint {
  id: string
  team_id: string
  sprint_number: number
  goal: string
  status: SprintStatus
  start_date: string // ISO date string (YYYY-MM-DD)
  end_date: string // ISO date string (YYYY-MM-DD)
  created_at: string
}

/**
 * A sprint review record stored in the `sprint_reviews` table.
 * Each sprint has at most one review (enforced by UNIQUE constraint on sprint_id).
 *
 * Validates: Requirements 3.2, 4.1, 4.5
 */
export interface SprintReview {
  id: string
  sprint_id: string
  increment_notes: string
  stakeholder_feedback: string | null
  accepted_stories_count: number
  created_at: string
}

/**
 * Structured error returned by Sprint_Service operations.
 * The optional `field` property enables inline field-level error display
 * in forms, associated via `aria-describedby` for accessibility.
 *
 * Validates: Requirements 2.2, 2.3, 2.4, 2.5, 4.3, 4.4, 5.1, 5.2
 */
export interface SprintError {
  code: SprintErrorCode
  message: string
  field?:
    | 'goal'
    | 'start_date'
    | 'end_date'
    | 'sprint_number'
    | 'increment_notes'
    | 'accepted_stories_count'
}

/**
 * Discriminated union of all possible sprint-related error codes.
 * Used to map server-side errors to user-facing messages without leaking
 * sensitive information.
 *
 * Validates: Requirements 2.2, 2.3, 2.4, 2.5, 4.3, 4.4, 5.1, 5.2
 */
export type SprintErrorCode =
  | 'GOAL_REQUIRED'
  | 'START_DATE_REQUIRED'
  | 'END_DATE_REQUIRED'
  | 'END_DATE_NOT_AFTER_START'
  | 'SPRINT_NUMBER_INVALID'
  | 'SPRINT_NUMBER_DUPLICATE'
  | 'ACTIVE_SPRINT_EXISTS'
  | 'SPRINT_NOT_FOUND'
  | 'SPRINT_NOT_ACTIVE'
  | 'INVALID_STATUS_TRANSITION'
  | 'INCREMENT_NOTES_REQUIRED'
  | 'ACCEPTED_STORIES_INVALID'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'UNKNOWN'

/**
 * Input payload for creating a new sprint.
 *
 * Validates: Requirements 2.1
 */
export type CreateSprintData = {
  goal: string
  start_date: string
  end_date: string
  sprint_number: number
}

/**
 * Input payload for upserting a sprint review.
 *
 * Validates: Requirements 4.1
 */
export type UpsertReviewData = {
  increment_notes: string
  stakeholder_feedback: string | null
  accepted_stories_count: number
}

/**
 * Result type returned by Sprint_Service sprint creation.
 * On success, carries the created Sprint; on failure, carries a SprintError.
 *
 * Validates: Requirements 2.1, 2.5
 */
export type SprintResult = { sprint: Sprint } | { error: SprintError }

/**
 * Result type returned by Sprint_Service review submission.
 * On success, carries the upserted SprintReview and the updated Sprint;
 * on failure, carries a SprintError.
 *
 * Validates: Requirements 4.1, 4.2
 */
export type ReviewResult = { review: SprintReview; sprint: Sprint } | { error: SprintError }
