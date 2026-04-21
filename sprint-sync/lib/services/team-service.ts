import { createServerClient } from '@/lib/supabase/server'
import type { TeamWithRole, TeamServiceError } from '@/types/team'

/**
 * Invites a user to a team by email address.
 *
 * Steps:
 * 1. Verify the requesting user is a facilitator of the team.
 * 2. Look up the target user's ID via the `get_user_id_by_email` RPC function.
 * 3. Check that the target user is not already a member.
 * 4. Insert a `team_members` row with `role = 'member'`.
 *
 * Returns `void` on success, or a `{ error: TeamServiceError }` on failure.
 *
 * Validates: Requirements 9.2, 9.4, 9.5, 9.7
 */
export async function inviteUserToTeam(
  teamId: string,
  email: string,
  requestingUserId: string
): Promise<void | { error: TeamServiceError }> {
  const supabase = createServerClient()

  // 1. Verify requesting user is a facilitator
  const { data: membership, error: membershipError } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', requestingUserId)
    .single()

  if (membershipError || !membership || membership.role !== 'facilitator') {
    return {
      error: {
        code: 'FORBIDDEN',
        message: 'Only facilitators can invite members.',
      },
    }
  }

  // 2. Look up target user by email via RPC
  const { data: rpcResult, error: lookupError } = await supabase.rpc(
    'get_user_id_by_email',
    { email }
  )

  if (lookupError || !rpcResult || (Array.isArray(rpcResult) && rpcResult.length === 0)) {
    return {
      error: {
        code: 'NOT_FOUND',
        message: 'No SprintSync account found for that email address.',
      },
    }
  }

  const targetUserId: string = Array.isArray(rpcResult) ? rpcResult[0].id : rpcResult

  if (!targetUserId) {
    return {
      error: {
        code: 'NOT_FOUND',
        message: 'No SprintSync account found for that email address.',
      },
    }
  }

  // 3. Check for existing membership
  const { data: existing } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('team_id', teamId)
    .eq('user_id', targetUserId)
    .maybeSingle()

  if (existing) {
    return {
      error: {
        code: 'ALREADY_MEMBER',
        message: 'This user is already a member of the team.',
      },
    }
  }

  // 4. Insert new member row
  const { error: insertError } = await supabase
    .from('team_members')
    .insert({ team_id: teamId, user_id: targetUserId, role: 'member' })

  if (insertError) {
    return {
      error: {
        code: 'UNKNOWN',
        message: `Failed to add member: ${insertError.message}`,
      },
    }
  }
}

/**
 * Returns all teams the authenticated user belongs to, with their role in each team.
 *
 * Queries `team_members` joined with `teams` via the Supabase server client so
 * RLS is enforced — users can only see teams they are members of.
 *
 * Validates: Requirements 8.1, 8.9
 */
export async function getTeamsForUser(userId: string): Promise<TeamWithRole[]> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('team_members')
    .select('role, teams(id, name, created_at)')
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to fetch teams: ${error.message}`)
  }

  return (data ?? []).map((row) => ({
    ...(row.teams as { id: string; name: string; created_at: string }),
    role: row.role as 'facilitator' | 'member',
  }))
}

/**
 * Creates a new team and adds the creator as a facilitator.
 *
 * Validates the team name (non-empty, ≤ 100 characters), inserts into `teams`,
 * then inserts into `team_members` with `role = 'facilitator'`. Uses the
 * Supabase server client so RLS is enforced.
 *
 * Returns the created team with the user's role, or a descriptive error.
 *
 * Validates: Requirements 8.3, 8.4, 8.8
 */
export async function createTeam(
  name: string,
  userId: string
): Promise<{ team: TeamWithRole } | { error: TeamServiceError }> {
  const trimmedName = name?.trim() ?? ''

  if (trimmedName.length === 0) {
    return {
      error: {
        code: 'VALIDATION',
        message: 'Team name is required.',
      },
    }
  }

  if (trimmedName.length > 100) {
    return {
      error: {
        code: 'VALIDATION',
        message: 'Team name must be 100 characters or fewer.',
      },
    }
  }

  const supabase = createServerClient()

  const { data: team, error: teamError } = await supabase
    .from('teams')
    .insert({ name: trimmedName })
    .select('id, name, created_at')
    .single()

  if (teamError || !team) {
    return {
      error: {
        code: 'UNKNOWN',
        message: teamError?.message ?? 'Failed to create team.',
      },
    }
  }

  const { error: memberError } = await supabase
    .from('team_members')
    .insert({ team_id: team.id, user_id: userId, role: 'facilitator' })

  if (memberError) {
    return {
      error: {
        code: 'UNKNOWN',
        message: `Team created but failed to add you as facilitator: ${memberError.message}`,
      },
    }
  }

  return {
    team: {
      id: team.id,
      name: team.name,
      created_at: team.created_at,
      role: 'facilitator',
    },
  }
}
