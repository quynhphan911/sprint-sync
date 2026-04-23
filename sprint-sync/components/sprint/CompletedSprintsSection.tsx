'use client'

import type { Sprint } from '@/types/sprint'
import { SprintCard } from './SprintCard'

interface CompletedSprintsSectionProps {
  sprints: Sprint[]
}

/**
 * Renders the completed sprints section of the dashboard.
 *
 * - Renders a responsive grid of SprintCard components for completed sprints.
 * - Renders an empty-state message if no completed sprints exist.
 *
 * Validates: Requirements 1.2, 1.4, 7.1
 */
export function CompletedSprintsSection({ sprints }: CompletedSprintsSectionProps) {
  return (
    <section aria-labelledby="completed-sprints-heading">
      <h2
        id="completed-sprints-heading"
        className="text-lg font-semibold text-foreground"
      >
        Completed Sprints
      </h2>

      <div className="mt-3">
        {sprints.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center">
            <p className="text-sm text-foreground/60">
              No completed sprints yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sprints.map((sprint) => (
              <SprintCard key={sprint.id} sprint={sprint} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
