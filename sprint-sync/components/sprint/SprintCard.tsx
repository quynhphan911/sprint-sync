'use client'

import Link from 'next/link'
import type { Sprint } from '@/types/sprint'

interface SprintCardProps {
  sprint: Sprint
}

/**
 * Renders a single sprint's summary as a clickable card.
 *
 * Displays sprint_number, goal, status, start_date, and end_date.
 * Wraps in a Next.js Link navigating to the Sprint Detail page.
 *
 * Validates: Requirements 1.5, 1.6
 */
export function SprintCard({ sprint }: SprintCardProps) {
  const isActive = sprint.status === 'active'

  return (
    <Link
      href={`/teams/${sprint.team_id}/sprints/${sprint.id}`}
      className="block rounded-lg border border-border bg-card p-5 shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-foreground">
          Sprint {sprint.sprint_number}
        </h3>
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

      <p className="mt-2 text-sm text-foreground/70 line-clamp-2">
        {sprint.goal}
      </p>

      <div className="mt-3 flex items-center gap-3 text-xs text-foreground/50">
        <span>{formatDate(sprint.start_date)}</span>
        <span aria-hidden="true">→</span>
        <span>{formatDate(sprint.end_date)}</span>
      </div>
    </Link>
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
