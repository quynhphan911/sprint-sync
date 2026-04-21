'use server'

import { createServerClient } from '@/lib/supabase/server'
import { inviteUserToTeam } from '@/lib/services/team-service'
import type { TeamServiceError } from '@/types/team'

/**
 * Server Action: invite a user to a team by email.
 *
 * Resolves the currently authenticated user, then delegates to
 * `inviteUserToTeam` in the team service.
 *
 * Validates: Requirements 9.2, 9.4, 9.5, 9.7
 */
export async function inviteUserAction(
  teamId: string,
  email: string
): Promise<{ success: true } | { error: TeamServiceError }> {
  const supabase = createServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      error: {
        code: 'FORBIDDEN',
        message: 'You must be signed in to invite members.',
      },
    }
  }

  const result = await inviteUserToTeam(teamId, email, user.id)

  if (result && 'error' in result) {
    return result
  }

  return { success: true }
}
