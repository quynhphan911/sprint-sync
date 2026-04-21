import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getTeamsForUser } from '@/lib/services/team-service'
import { InviteMemberForm } from '@/components/teams/InviteMemberForm'

interface TeamSettingsPageProps {
  params: { teamId: string }
}

/**
 * Team settings page — displays team management options.
 *
 * Server Component that:
 * 1. Verifies the user is authenticated.
 * 2. Verifies the user is a member of the team.
 * 3. Renders the `InviteMemberForm` if the user is a facilitator.
 *
 * Validates: Requirement 9.1
 */
export default async function TeamSettingsPage({ params }: TeamSettingsPageProps) {
  const { teamId } = params

  const supabase = createServerClient()

  // 1. Verify authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/auth')
  }

  // 2. Verify team membership and get user's role
  const teams = await getTeamsForUser(user.id)
  const team = teams.find((t) => t.id === teamId)

  if (!team) {
    redirect('/teams')
  }

  const isFacilitator = team.role === 'facilitator'

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">Team Settings</h1>
          <p className="mt-1 text-sm text-foreground/60">{team.name}</p>
        </div>

        {/* 3. Render invite form for facilitators only */}
        {isFacilitator ? (
          <InviteMemberForm teamId={teamId} />
        ) : (
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <p className="text-sm text-foreground/60">
              Only facilitators can manage team settings.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
