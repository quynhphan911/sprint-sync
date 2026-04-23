import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createSprint } from '@/lib/sprint/service'
import type { SprintError } from '@/types/sprint'

/**
 * POST /api/teams/[teamId]/sprints
 *
 * Route Handler for creating a new sprint for a team.
 *
 * Authentication: Required — returns 401 if no valid session exists.
 * Authorization: The authenticated user must be a member of `teamId` — returns 403 if not.
 *
 * Request body: { goal: string; start_date: string; end_date: string; sprint_number: number }
 *
 * Responses:
 *   200 — { data: Sprint }
 *   400 — { error: SprintError }  (validation failure or business rule violation)
 *   401 — { error: { code: 'UNAUTHORIZED', message } }
 *   403 — { error: { code: 'FORBIDDEN', message } }
 *   409 — { error: SprintError }  (active sprint exists or duplicate sprint_number)
 *   500 — { error: { code: 'UNKNOWN', message } }
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 6.1, 6.4
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params

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

    // 3. Parse and validate request body via Sprint_Service
    const body = await request.json()
    const { goal, start_date, end_date, sprint_number } = body

    // 4. Call Sprint_Service.createSprint
    const result = await createSprint(teamId, {
      goal,
      start_date,
      end_date,
      sprint_number,
    })

    if ('error' in result) {
      const statusCode = mapErrorToStatus(result.error)
      return NextResponse.json({ error: result.error }, { status: statusCode })
    }

    return NextResponse.json({ data: result.sprint }, { status: 200 })
  } catch (error) {
    console.error('Sprint creation error:', error)
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
    case 'ACTIVE_SPRINT_EXISTS':
    case 'SPRINT_NUMBER_DUPLICATE':
      return 409
    case 'UNAUTHORIZED':
      return 401
    case 'FORBIDDEN':
      return 403
    case 'SPRINT_NOT_FOUND':
      return 404
    default:
      // Validation errors and other business rule violations
      return 400
  }
}
