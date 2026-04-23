import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { completeSprintWithReview, getSprintById } from '@/lib/sprint/service'
import type { SprintError } from '@/types/sprint'

/**
 * POST /api/teams/[teamId]/sprints/[sprintId]/reviews
 *
 * Route Handler for submitting a Sprint Review. Atomically upserts the review
 * and transitions the sprint status from 'active' to 'completed'.
 *
 * Authentication: Required — returns 401 if no valid session exists.
 * Authorization: The authenticated user must be a member of `teamId` — returns 403 if not.
 * Scoping: The `sprintId` must belong to `teamId` — returns 404 if not.
 *
 * Request body: { increment_notes: string; stakeholder_feedback: string | null; accepted_stories_count: number }
 *
 * Responses:
 *   200 — { data: { review: SprintReview, sprint: Sprint } }
 *   400 — { error: SprintError }  (validation failure or business rule violation)
 *   401 — { error: { code: 'UNAUTHORIZED', message } }
 *   403 — { error: { code: 'FORBIDDEN', message } }
 *   404 — { error: { code: 'SPRINT_NOT_FOUND', message } }
 *   500 — { error: { code: 'UNKNOWN', message } }
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 6.1, 6.2
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; sprintId: string }> }
) {
  try {
    const { teamId, sprintId } = await params

    // 1. Authenticate request
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required.',
          },
        },
        { status: 401 }
      )
    }

    // 2. Verify user is a member of the team
    const { data: membership, error: membershipError } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (membershipError || !membership) {
      return NextResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'You are not a member of this team.',
          },
        },
        { status: 403 }
      )
    }

    // 3. Verify sprintId belongs to teamId
    const sprint = await getSprintById(sprintId, teamId)

    if (!sprint) {
      return NextResponse.json(
        {
          error: {
            code: 'SPRINT_NOT_FOUND',
            message: 'Sprint not found.',
          },
        },
        { status: 404 }
      )
    }

    // 4. Parse request body and call Sprint_Service
    const body = await request.json()
    const { increment_notes, stakeholder_feedback, accepted_stories_count } = body

    // 5. Call Sprint_Service.completeSprintWithReview
    const result = await completeSprintWithReview(sprintId, {
      increment_notes,
      stakeholder_feedback: stakeholder_feedback ?? null,
      accepted_stories_count,
    })

    if ('error' in result) {
      const statusCode = mapErrorToStatus(result.error)
      return NextResponse.json({ error: result.error }, { status: statusCode })
    }

    return NextResponse.json(
      { data: { review: result.review, sprint: result.sprint } },
      { status: 200 }
    )
  } catch (error) {
    console.error('Sprint review submission error:', error)
    return NextResponse.json(
      {
        error: {
          code: 'UNKNOWN',
          message: 'An unexpected error occurred. Please try again.',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * Map a SprintError code to the appropriate HTTP status code.
 */
function mapErrorToStatus(error: SprintError): number {
  switch (error.code) {
    case 'SPRINT_NOT_ACTIVE':
    case 'INVALID_STATUS_TRANSITION':
      return 400
    case 'UNAUTHORIZED':
      return 401
    case 'FORBIDDEN':
      return 403
    case 'SPRINT_NOT_FOUND':
      return 404
    case 'ACTIVE_SPRINT_EXISTS':
    case 'SPRINT_NUMBER_DUPLICATE':
      return 409
    default:
      // Validation errors and other business rule violations
      return 400
  }
}
