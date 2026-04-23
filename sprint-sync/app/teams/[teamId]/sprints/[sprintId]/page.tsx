import { notFound } from 'next/navigation'
import { getSprintById, getSprintReview } from '@/lib/sprint/service'
import { SprintDetail } from '@/components/sprint/SprintDetail'
import { ReviewForm } from '@/components/sprint/ReviewForm'
import { ReviewDisplay } from '@/components/sprint/ReviewDisplay'

interface SprintDetailPageProps {
  params: Promise<{ teamId: string; sprintId: string }>
}

/**
 * Sprint Detail Page — Server Component.
 *
 * Fetches the sprint and its review server-side, then renders:
 * - SprintDetail with sprint metadata
 * - ReviewForm if the sprint is active (allows review submission)
 * - Read-only ReviewDisplay if the sprint is completed and has a review
 *
 * Returns 404 if the sprint does not exist or does not belong to the team.
 * Auth is handled by middleware — unauthenticated users are redirected to /auth.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
export default async function SprintDetailPage({ params }: SprintDetailPageProps) {
  const { teamId, sprintId } = await params

  const sprint = await getSprintById(sprintId, teamId)

  if (!sprint) {
    notFound()
  }

  const review = await getSprintReview(sprintId)

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <SprintDetail sprint={sprint} />

        {sprint.status === 'active' && (
          <ReviewForm teamId={teamId} sprintId={sprintId} />
        )}

        {sprint.status === 'completed' && review && (
          <ReviewDisplay review={review} />
        )}
      </div>
    </main>
  )
}
