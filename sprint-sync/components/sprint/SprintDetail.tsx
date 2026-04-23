'use client'

import type { Sprint } from '@/types/sprint'

interface SprintDetailProps {
  sprint: Sprint
}

/**
 * Renders sprint metadata as a detail view.
 *
 * Displays sprint_number, goal, status badge, start_date, and end_date.
 * Similar styling to SprintCard but presented as a non-clickable detail header.
 *
 * Validates: Requirements 3.1
 */
export function SprintDetail({ sprint }: SprintDetailProps) {
  const isActive = sprint.status === 'active'

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-semibold text-foreground">
          Sprint {sprint.sprint_number}
        </h2>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
            isActive
              ? 'bg-primary/10 text-primary'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {sprint.status}
        </span>
      </div>

      <p className="mt-3 text-sm text-foreground/70">{sprint.goal}</p>

      <div className="mt-4 flex items-center gap-3 text-sm text-foreground/50">
        <span>{formatDate(sprint.start_date)}</span>
        <span aria-hidden="true">→</span>
        <span>{formatDate(sprint.end_date)}</span>
      </div>
    </div>
  )
}

/**
 * Format an ISO date string (YYYY-MM-DD) into a human-readable short format.
 */
function formatDate(isoDate: string): string {
  const date = new Date(isoDate + 'T00:00:00Z')
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
