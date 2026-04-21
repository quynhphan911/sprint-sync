'use client'

import Link from 'next/link'
import type { TeamWithRole } from '@/types/team'

interface TeamListProps {
  teams: TeamWithRole[]
}

/**
 * Renders the list of teams the user belongs to.
 * Each card links to the team's dashboard and shows the user's role.
 *
 * Validates: Requirements 8.1, 8.2, 8.7
 */
export function TeamList({ teams }: TeamListProps) {
  if (teams.length === 0) {
    return null
  }

  return (
    <ul className="space-y-3" role="list" aria-label="Your teams">
      {teams.map((team) => (
        <li key={team.id}>
          <Link
            href={`/teams/${team.id}/dashboard`}
            className="flex items-center justify-between rounded-lg border border-border bg-card px-5 py-4 shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="font-medium text-foreground">{team.name}</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                team.role === 'facilitator'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {team.role}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
