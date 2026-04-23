import { getActiveSprint, getCompletedSprints } from '@/lib/sprint/service'
import { ActiveSprintSection } from '@/components/sprint/ActiveSprintSection'
import { CompletedSprintsSection } from '@/components/sprint/CompletedSprintsSection'

interface TeamDashboardPageProps {
  params: Promise<{ teamId: string }>
}

/**
 * Team Dashboard — Server Component.
 *
 * Fetches the active sprint and completed sprints for the team server-side,
 * then passes data to client components for rendering.
 *
 * Auth is handled by middleware — unauthenticated users are redirected to /auth.
 *
 * Validates: Requirements 1.1, 1.2, 1.7, 6.3, 6.4
 */
export default async function TeamDashboardPage({ params }: TeamDashboardPageProps) {
  const { teamId } = await params

  const [activeSprint, completedSprints] = await Promise.all([
    getActiveSprint(teamId),
    getCompletedSprints(teamId),
  ])

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <h1 className="text-2xl font-semibold text-foreground">Team Dashboard</h1>

        <ActiveSprintSection sprint={activeSprint} teamId={teamId} />

        <CompletedSprintsSection sprints={completedSprints} />
      </div>
    </main>
  )
}
