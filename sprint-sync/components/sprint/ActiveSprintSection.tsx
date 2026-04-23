'use client'

import { useState } from 'react'
import type { Sprint } from '@/types/sprint'
import { SprintCard } from './SprintCard'
import { SprintForm } from './SprintForm'

interface ActiveSprintSectionProps {
  sprint: Sprint | null
  teamId: string
}

/**
 * Renders the active sprint section of the dashboard.
 *
 * - If an active sprint exists, renders a SprintCard for it.
 * - If no active sprint exists, renders an empty-state prompt with a CTA
 *   button to open the SprintForm.
 *
 * Validates: Requirements 1.1, 1.3, 2.6
 */
export function ActiveSprintSection({ sprint, teamId }: ActiveSprintSectionProps) {
  const [showForm, setShowForm] = useState(false)

  return (
    <section aria-labelledby="active-sprint-heading">
      <h2
        id="active-sprint-heading"
        className="text-lg font-semibold text-foreground"
      >
        Active Sprint
      </h2>

      <div className="mt-3">
        {sprint ? (
          <SprintCard sprint={sprint} />
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center">
            <p className="text-sm text-foreground/60">
              No active sprint is running for this team.
            </p>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-3 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Create Sprint
            </button>
          </div>
        )}
      </div>

      {showForm && !sprint && (
        <div className="mt-4">
          <SprintForm
            teamId={teamId}
            onCancel={() => setShowForm(false)}
            onSuccess={() => setShowForm(false)}
          />
        </div>
      )}
    </section>
  )
}
