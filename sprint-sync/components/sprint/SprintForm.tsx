'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  validateGoal,
  validateStartDate,
  validateEndDate,
  validateSprintNumber,
} from '@/lib/sprint/validators'
import type { SprintError } from '@/types/sprint'

interface SprintFormProps {
  teamId: string
  onCancel?: () => void
  onSuccess?: () => void
}

interface FieldErrors {
  goal?: string
  start_date?: string
  end_date?: string
  sprint_number?: string
}

/**
 * Controlled form for creating a new sprint.
 *
 * - Client-side validation using Validator functions.
 * - POST to `/api/teams/[teamId]/sprints`.
 * - Field-level errors displayed inline with aria-describedby for accessibility.
 * - Toast on success via sonner.
 * - Refreshes dashboard data via router.refresh() on success (no full page reload).
 * - Retains form data on error.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8
 */
export function SprintForm({ teamId, onCancel, onSuccess }: SprintFormProps) {
  const router = useRouter()

  const [goal, setGoal] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sprintNumber, setSprintNumber] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function validateAll(): FieldErrors {
    const errors: FieldErrors = {}

    const goalResult = validateGoal(goal)
    if (!goalResult.valid) errors.goal = goalResult.message

    const startResult = validateStartDate(startDate)
    if (!startResult.valid) errors.start_date = startResult.message

    const endResult = validateEndDate(endDate, startDate)
    if (!endResult.valid) errors.end_date = endResult.message

    const num = Number(sprintNumber)
    const numResult = validateSprintNumber(num)
    if (!numResult.valid) errors.sprint_number = numResult.message

    return errors
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const errors = validateAll()
    setFieldErrors(errors)
    setSubmitError(null)

    if (Object.keys(errors).length > 0) return

    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/teams/${teamId}/sprints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: goal.trim(),
          start_date: startDate,
          end_date: endDate,
          sprint_number: Number(sprintNumber),
        }),
      })

      const json = await response.json()

      if (!response.ok) {
        const error = json.error as SprintError | undefined
        if (error?.field) {
          setFieldErrors((prev) => ({
            ...prev,
            [error.field!]: error.message,
          }))
        } else if (error?.message) {
          setSubmitError(error.message)
        } else {
          setSubmitError('Something went wrong. Please try again.')
        }
        return
      }

      // Success
      toast.success('Sprint created successfully.')
      router.refresh()
      onSuccess?.()
    } catch {
      setSubmitError('Network error. Please check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function clearFieldError(field: keyof FieldErrors) {
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-foreground">Create Sprint</h3>
      <p className="mt-1 text-sm text-foreground/60">
        Define a new sprint for your team.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
        {/* Goal */}
        <div>
          <label
            htmlFor="sprint-goal"
            className="block text-sm font-medium text-foreground"
          >
            Goal
          </label>
          <textarea
            id="sprint-goal"
            value={goal}
            onChange={(e) => {
              setGoal(e.target.value)
              clearFieldError('goal')
            }}
            disabled={isSubmitting}
            aria-describedby={fieldErrors.goal ? 'sprint-goal-error' : undefined}
            aria-invalid={fieldErrors.goal ? 'true' : 'false'}
            placeholder="What does this sprint aim to achieve?"
            rows={3}
            className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
              fieldErrors.goal
                ? 'border-destructive bg-destructive/5 focus:ring-destructive/40'
                : 'border-input bg-background focus:border-ring'
            }`}
          />
          {fieldErrors.goal && (
            <p id="sprint-goal-error" role="alert" className="mt-1 text-xs text-destructive">
              {fieldErrors.goal}
            </p>
          )}
        </div>

        {/* Sprint Number */}
        <div>
          <label
            htmlFor="sprint-number"
            className="block text-sm font-medium text-foreground"
          >
            Sprint Number
          </label>
          <input
            id="sprint-number"
            type="number"
            min={1}
            step={1}
            value={sprintNumber}
            onChange={(e) => {
              setSprintNumber(e.target.value)
              clearFieldError('sprint_number')
            }}
            disabled={isSubmitting}
            aria-describedby={
              fieldErrors.sprint_number ? 'sprint-number-error' : undefined
            }
            aria-invalid={fieldErrors.sprint_number ? 'true' : 'false'}
            placeholder="e.g. 1"
            className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
              fieldErrors.sprint_number
                ? 'border-destructive bg-destructive/5 focus:ring-destructive/40'
                : 'border-input bg-background focus:border-ring'
            }`}
          />
          {fieldErrors.sprint_number && (
            <p
              id="sprint-number-error"
              role="alert"
              className="mt-1 text-xs text-destructive"
            >
              {fieldErrors.sprint_number}
            </p>
          )}
        </div>

        {/* Date fields row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Start Date */}
          <div>
            <label
              htmlFor="sprint-start-date"
              className="block text-sm font-medium text-foreground"
            >
              Start Date
            </label>
            <input
              id="sprint-start-date"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                clearFieldError('start_date')
              }}
              disabled={isSubmitting}
              aria-describedby={
                fieldErrors.start_date ? 'sprint-start-date-error' : undefined
              }
              aria-invalid={fieldErrors.start_date ? 'true' : 'false'}
              className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
                fieldErrors.start_date
                  ? 'border-destructive bg-destructive/5 focus:ring-destructive/40'
                  : 'border-input bg-background focus:border-ring'
              }`}
            />
            {fieldErrors.start_date && (
              <p
                id="sprint-start-date-error"
                role="alert"
                className="mt-1 text-xs text-destructive"
              >
                {fieldErrors.start_date}
              </p>
            )}
          </div>

          {/* End Date */}
          <div>
            <label
              htmlFor="sprint-end-date"
              className="block text-sm font-medium text-foreground"
            >
              End Date
            </label>
            <input
              id="sprint-end-date"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                clearFieldError('end_date')
              }}
              disabled={isSubmitting}
              aria-describedby={
                fieldErrors.end_date ? 'sprint-end-date-error' : undefined
              }
              aria-invalid={fieldErrors.end_date ? 'true' : 'false'}
              className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
                fieldErrors.end_date
                  ? 'border-destructive bg-destructive/5 focus:ring-destructive/40'
                  : 'border-input bg-background focus:border-ring'
              }`}
            />
            {fieldErrors.end_date && (
              <p
                id="sprint-end-date-error"
                role="alert"
                className="mt-1 text-xs text-destructive"
              >
                {fieldErrors.end_date}
              </p>
            )}
          </div>
        </div>

        {/* Submit error */}
        {submitError && (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {submitError}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Creating…' : 'Create Sprint'}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
