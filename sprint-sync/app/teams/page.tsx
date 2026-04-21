import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getTeamsForUser } from '@/lib/services/team-service'
import { TeamsPageClient } from './TeamsPageClient'

/**
 * Teams page — Server Component.
 *
 * Fetches the authenticated user's teams on the server and passes them to the
 * client component for rendering and dynamic updates.
 *
 * Validates: Requirements 8.1, 8.2, 8.7, 8.9
 */
export default async function TeamsPage() {
  const supabase = createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  const teams = await getTeamsForUser(user.id)

  return <TeamsPageClient initialTeams={teams} />
}
