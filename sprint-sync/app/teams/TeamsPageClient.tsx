'use client'

import { useState } from 'react'
import type { TeamWithRole } from '@/types/team'
import { TeamList } from '@/components/teams/TeamList'
import { TeamForm } from '@/components/teams/TeamForm'

interface TeamsPageClientProps {
  initialTeams: TeamWithRole[]
}

/**
 * Client component for the Teams page.
 *
 * Manages the team list state and updates it when a new team is created,
 * without requiring a full page reload.
 *
 * Validates: Requirements 8.5, 8.6
 */
export function TeamsPageClient({ initialTeams }: TeamsPageClientProps) {
  const [teams, setTeams] = useState<TeamWithRole[]>(initialTeams)

  function handleTeamCreated(newTeam: TeamWithRole) {
    setTeams((prev) => [...prev, newTeam])
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Your Teams</h1>
            <p className="mt-1 text-sm text-foreground/60">
              Manage your teams and sprint ceremonies.
            </p>
          </div>
        </div>

        {teams.length === 0 ? (
          <div className="mb-8 rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
            <h2 className="text-base font-medium text-foreground">No teams yet</h2>
            <p className="mt-1 text-sm text-foreground/60">
              Create your first team below to get started with SprintSync.
            </p>
          </div>
        ) : (
          <div className="mb-8">
            <TeamList teams={teams} />
          </div>
        )}

        <TeamForm onTeamCreated={handleTeamCreated} />
      </div>
    </main>
  )
}
