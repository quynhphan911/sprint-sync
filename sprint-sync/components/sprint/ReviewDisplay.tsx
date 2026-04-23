'use client'

import type { SprintReview } from '@/types/sprint'

interface ReviewDisplayProps {
  review: SprintReview
}

/**
 * Read-only display of a submitted Sprint Review.
 *
 * Renders increment_notes, stakeholder_feedback (if non-null), and
 * accepted_stories_count in a clean, read-only presentation.
 *
 * Validates: Requirements 3.2, 3.4
 */
export function ReviewDisplay({ review }: ReviewDisplayProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-foreground">Sprint Review</h3>

      <div className="mt-4 space-y-4">
        {/* Increment Notes */}
        <div>
          <dt className="text-sm font-medium text-foreground/60">
            Increment Notes
          </dt>
          <dd className="mt-1 whitespace-pre-wrap text-sm text-foreground">
            {review.increment_notes}
          </dd>
        </div>

        {/* Stakeholder Feedback */}
        {review.stakeholder_feedback != null && (
          <div>
            <dt className="text-sm font-medium text-foreground/60">
              Stakeholder Feedback
            </dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-foreground">
              {review.stakeholder_feedback}
            </dd>
          </div>
        )}

        {/* Accepted Stories Count */}
        <div>
          <dt className="text-sm font-medium text-foreground/60">
            Accepted Stories
          </dt>
          <dd className="mt-1 text-sm font-medium text-foreground">
            {review.accepted_stories_count}
          </dd>
        </div>
      </div>
    </div>
  )
}
