/**
 * Sprint_Service — server-side sprint and review data access layer.
 *
 * All functions are server-side only and use the Supabase server client.
 * Enforces team scoping on every query — a user can only access sprints
 * belonging to their own team (further enforced by RLS policies).
 *
 * Validates: Requirements 1.1, 1.2, 1.7, 2.1, 2.5, 3.1, 3.2, 3.5, 3.6,
 * 4.1, 4.2, 4.5, 5.1, 5.2, 6.1, 6.2, 6.4
 */

import { createServerClient } from '../supabase/server'
import {
  validateGoal,
  validateStartDate,
  validateEndDate,
  validateSprintNumber,
  validateIncrementNotes,
  validateAcceptedStoriesCount,
} from './validators'
import type {
  Sprint,
  SprintReview,
  SprintError,
  SprintErrorCode,
  CreateSprintData,
  UpsertReviewData,
  SprintResult,
  ReviewResult,
} from '../../types/sprint'

// ---------------------------------------------------------------------------
// Dashboard queries
// ---------------------------------------------------------------------------

/**
 * Fetch all sprints for a team, ordered by sprint_number descending.
 *
 * Validates: Requirements 1.1, 1.2, 1.7
 */
export async function getSprintsForTeam(teamId: string): Promise<Sprint[]> {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('sprints')
    .select('*')
    .eq('team_id', teamId)
    .order('sprint_number', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch sprints: ${error.message}`)
  }

  return (data ?? []) as Sprint[]
}

/**
 * Fetch the single active sprint for a team, or return null if none exists.
 *
 * Validates: Requirements 1.1
 */
export async function getActiveSprint(teamId: string): Promise<Sprint | null> {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('sprints')
    .select('*')
    .eq('team_id', teamId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch active sprint: ${error.message}`)
  }

  return (data as Sprint) ?? null
}

/**
 * Fetch all completed sprints for a team, ordered by sprint_number descending.
 *
 * Validates: Requirements 1.2
 */
export async function getCompletedSprints(teamId: string): Promise<Sprint[]> {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('sprints')
    .select('*')
    .eq('team_id', teamId)
    .eq('status', 'completed')
    .order('sprint_number', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch completed sprints: ${error.message}`)
  }

  return (data ?? []) as Sprint[]
}

// ---------------------------------------------------------------------------
// Sprint detail
// ---------------------------------------------------------------------------

/**
 * Fetch a sprint by id, scoped to the given team. Returns null if the sprint
 * does not exist or does not belong to the specified team.
 *
 * Validates: Requirements 3.1, 3.5
 */
export async function getSprintById(
  sprintId: string,
  teamId: string
): Promise<Sprint | null> {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('sprints')
    .select('*')
    .eq('id', sprintId)
    .eq('team_id', teamId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch sprint: ${error.message}`)
  }

  return (data as Sprint) ?? null
}

/**
 * Fetch the sprint review for a given sprint, or return null if no review
 * has been submitted yet.
 *
 * Validates: Requirements 3.2
 */
export async function getSprintReview(
  sprintId: string
): Promise<SprintReview | null> {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('sprint_reviews')
    .select('*')
    .eq('sprint_id', sprintId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch sprint review: ${error.message}`)
  }

  return (data as SprintReview) ?? null
}

// ---------------------------------------------------------------------------
// Sprint creation
// ---------------------------------------------------------------------------

/**
 * Create a new sprint for a team. Validates inputs, inserts the sprint record
 * with status 'active', and maps database errors to SprintError codes.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 */
export async function createSprint(
  teamId: string,
  data: CreateSprintData
): Promise<SprintResult> {
  // Validate inputs
  const goalResult = validateGoal(data.goal)
  if (!goalResult.valid) {
    return {
      error: {
        code: 'GOAL_REQUIRED',
        message: goalResult.message,
        field: 'goal',
      },
    }
  }

  const startDateResult = validateStartDate(data.start_date)
  if (!startDateResult.valid) {
    return {
      error: {
        code: 'START_DATE_REQUIRED',
        message: startDateResult.message,
        field: 'start_date',
      },
    }
  }

  const endDateResult = validateEndDate(data.end_date, data.start_date)
  if (!endDateResult.valid) {
    return {
      error: {
        code: 'END_DATE_NOT_AFTER_START',
        message: endDateResult.message,
        field: 'end_date',
      },
    }
  }

  const sprintNumberResult = validateSprintNumber(data.sprint_number)
  if (!sprintNumberResult.valid) {
    return {
      error: {
        code: 'SPRINT_NUMBER_INVALID',
        message: sprintNumberResult.message,
        field: 'sprint_number',
      },
    }
  }

  const supabase = await createServerClient()

  const { data: sprint, error } = await supabase
    .from('sprints')
    .insert({
      team_id: teamId,
      sprint_number: data.sprint_number,
      goal: data.goal,
      status: 'active' as const,
      start_date: data.start_date,
      end_date: data.end_date,
    })
    .select('*')
    .single()

  if (error) {
    return { error: mapInsertError(error) }
  }

  return { sprint: sprint as Sprint }
}

/**
 * Map a Supabase insert error to a SprintError.
 *
 * - Unique constraint on (team_id, sprint_number) → SPRINT_NUMBER_DUPLICATE
 * - Partial unique index sprints_one_active_per_team → ACTIVE_SPRINT_EXISTS
 * - Everything else → UNKNOWN
 */
function mapInsertError(error: { message: string; code?: string; details?: string }): SprintError {
  const msg = error.message ?? ''
  const details = error.details ?? ''

  // Unique constraint on (team_id, sprint_number)
  if (
    msg.includes('sprints_team_id_sprint_number_key') ||
    details.includes('sprints_team_id_sprint_number_key')
  ) {
    return {
      code: 'SPRINT_NUMBER_DUPLICATE',
      message: 'A sprint with this number already exists for the team.',
      field: 'sprint_number',
    }
  }

  // Partial unique index: only one active sprint per team
  if (
    msg.includes('sprints_one_active_per_team') ||
    details.includes('sprints_one_active_per_team')
  ) {
    return {
      code: 'ACTIVE_SPRINT_EXISTS',
      message:
        'Your team already has an active sprint. Complete it before creating a new one.',
    }
  }

  return {
    code: 'UNKNOWN',
    message: 'Something went wrong. Please try again.',
  }
}

// ---------------------------------------------------------------------------
// Sprint completion with review
// ---------------------------------------------------------------------------

/**
 * Complete a sprint by submitting a review. Calls the `complete_sprint_with_review`
 * RPC function which atomically upserts the review and transitions the sprint
 * status from 'active' to 'completed'.
 *
 * On success, fetches and returns the updated sprint and review.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2
 */
export async function completeSprintWithReview(
  sprintId: string,
  reviewData: UpsertReviewData
): Promise<ReviewResult> {
  // Validate review inputs
  const notesResult = validateIncrementNotes(reviewData.increment_notes)
  if (!notesResult.valid) {
    return {
      error: {
        code: 'INCREMENT_NOTES_REQUIRED',
        message: notesResult.message,
        field: 'increment_notes',
      },
    }
  }

  const storiesResult = validateAcceptedStoriesCount(
    reviewData.accepted_stories_count
  )
  if (!storiesResult.valid) {
    return {
      error: {
        code: 'ACCEPTED_STORIES_INVALID',
        message: storiesResult.message,
        field: 'accepted_stories_count',
      },
    }
  }

  const supabase = await createServerClient()

  // Call the RPC function for atomic sprint completion + review upsert
  const { error: rpcError } = await supabase.rpc('complete_sprint_with_review', {
    p_sprint_id: sprintId,
    p_increment_notes: reviewData.increment_notes,
    p_stakeholder_feedback: reviewData.stakeholder_feedback,
    p_accepted_stories_count: reviewData.accepted_stories_count,
  })

  if (rpcError) {
    return { error: mapRpcError(rpcError) }
  }

  // Fetch the updated sprint
  const { data: sprint, error: sprintError } = await supabase
    .from('sprints')
    .select('*')
    .eq('id', sprintId)
    .single()

  if (sprintError || !sprint) {
    return {
      error: {
        code: 'UNKNOWN',
        message: 'Review saved but failed to fetch updated sprint.',
      },
    }
  }

  // Fetch the upserted review
  const { data: review, error: reviewError } = await supabase
    .from('sprint_reviews')
    .select('*')
    .eq('sprint_id', sprintId)
    .single()

  if (reviewError || !review) {
    return {
      error: {
        code: 'UNKNOWN',
        message: 'Review saved but failed to fetch review record.',
      },
    }
  }

  return {
    sprint: sprint as Sprint,
    review: review as SprintReview,
  }
}

/**
 * Map an RPC error from `complete_sprint_with_review` to a SprintError.
 *
 * The RPC function raises 'SPRINT_NOT_ACTIVE' when the sprint is not in
 * active status.
 */
function mapRpcError(error: { message: string; code?: string; details?: string }): SprintError {
  const msg = error.message ?? ''

  if (msg.includes('SPRINT_NOT_ACTIVE')) {
    return {
      code: 'SPRINT_NOT_ACTIVE',
      message: 'This sprint is not active and cannot be completed.',
    }
  }

  return {
    code: 'UNKNOWN',
    message: 'Something went wrong. Please try again.',
  }
}
