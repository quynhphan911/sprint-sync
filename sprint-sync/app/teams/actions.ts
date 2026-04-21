'use server'

import { createServerClient } from '@/lib/supabase/server'
import { createTeam } from '@/lib/services/team-service'
import type { TeamWithRole, TeamServiceError } from '@/types/team'

/**
 * Server Action: create a new team for the currently authenticated user.
 *
 * Validates: Requirements 8.3, 8.4, 8.8
 */
export async function createTeamAction(
  name: string
): Promise<{ team: TeamWithRole } | { error: TeamServiceError }> {
  const supabase = createServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      error: {
        code: 'FORBIDDEN',
        message: 'You must be signed in to create a team.',
      },
    }
  }

  return createTeam(name, user.id)
}
