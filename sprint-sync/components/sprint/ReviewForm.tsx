'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  validateIncrementNotes,
  validateAcceptedStoriesCount,
} from '@/lib/sprint/validators'
import { ReviewDisplay } from '@/components/sprint/ReviewDisplay'
import type { SprintError, SprintReview } from '@/types/sprint'

interface ReviewFormProps {
  teamId: string
  sprintId: string
}

interface FieldErrors {
  increment_notes?: string
  accepted_stories_count?: string
}

/**
 * Controlled form for submitting a Sprint Review.
 *
 * - Client-side validation using Validator functions.
 * - POST to `/api/teams/[teamId]/sprints/[sprintId]/reviews`.
 * - Field-level errors displayed inline with aria-describedby for accessibility.
 * - Toast on success via sonner.
 * - On success: transitions to read-only ReviewDisplay without full page reload.
 * - Retains form data on error.
 *
 * Validates: Requirements 4.1, 4.3, 4.4, 4.6, 4.7, 4.8
 */
export function ReviewForm({ teamId, sprintId }: ReviewFormProps) {
  const [incrementNotes, setIncrementNotes] = useState('')
  const [stakeholderFeedback, setStakeholderFeedback] = useState('')
  const [acceptedStoriesCount, setAcceptedStoriesCount] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedReview, setSubmittedReview] = useState<SprintReview | null>(null)

  // If a review was successfully submitted, show the read-only display
  if (submittedReview) {
    return <ReviewDisplay review={submittedReview} />
  }

  function validateAll(): FieldErrors {
    const errors: FieldErrors = {}

    const notesResult = validateIncrementNotes(incrementNotes)
    if (!notesResult.valid) errors.increment_notes = notesResult.message

    const num = Number(acceptedStoriesCount)
    const storiesResult = validateAcceptedStoriesCount(
      acceptedStoriesCount === '' ? NaN : num
    )
    if (!storiesResult.valid) errors.accepted_stories_count = storiesResult.message

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
      const response = await fetch(
        `/api/teams/${teamId}/sprints/${sprintId}/reviews`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            increment_notes: incrementNotes.trim(),
            stakeholder_feedback:
              stakeholderFeedback.trim() || null,
            accepted_stories_count: Number(acceptedStoriesCount),
          }),
        }
      )

      const json = await response.json()

      if (!response.ok) {
        const error = json.error as SprintError | undefined
        if (error?.field) {
          const fieldName = error.field
          setFieldErrors((prev) => ({
            ...prev,
            [fieldName]: error.message,
          }))
        } else if (error?.message) {
          setSubmitError(error.message)
        } else {
          setSubmitError('Something went wrong. Please try again.')
        }
        return
      }

      // Success — transition to read-only display
      toast.success('Sprint review saved successfully.')
      setSubmittedReview(json.data.review as SprintReview)
    } catch {
      setSubmitError(
        'Network error. Please check your connection and try again.'
      )
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
      <h3 className="text-lg font-semibold text-foreground">Submit Sprint Review</h3>
      <p className="mt-1 text-sm text-foreground/60">
        Record the sprint outcomes and stakeholder feedback.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
        {/* Increment Notes */}
        <div>
          <label
            htmlFor="review-increment-notes"
            className="block text-sm font-medium text-foreground"
          >
            Increment Notes
          </label>
          <textarea
            id="review-increment-notes"
            value={incrementNotes}
            onChange={(e) => {
              setIncrementNotes(e.target.value)
              clearFieldError('increment_notes')
            }}
            disabled={isSubmitting}
            aria-describedby={
              fieldErrors.increment_notes
                ? 'review-increment-notes-error'
                : undefined
            }
            aria-invalid={fieldErrors.increment_notes ? 'true' : 'false'}
            placeholder="What was delivered in this sprint?"
            rows={4}
            className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
              fieldErrors.increment_notes
                ? 'border-destructive bg-destructive/5 focus:ring-destructive/40'
                : 'border-input bg-background focus:border-ring'
            }`}
          />
          {fieldErrors.increment_notes && (
            <p
              id="review-increment-notes-error"
              role="alert"
              className="mt-1 text-xs text-destructive"
            >
              {fieldErrors.increment_notes}
            </p>
          )}
        </div>

        {/* Stakeholder Feedback (optional) */}
        <div>
          <label
            htmlFor="review-stakeholder-feedback"
            className="block text-sm font-medium text-foreground"
          >
            Stakeholder Feedback{' '}
            <span className="font-normal text-foreground/40">(optional)</span>
          </label>
          <textarea
            id="review-stakeholder-feedback"
            value={stakeholderFeedback}
            onChange={(e) => setStakeholderFeedback(e.target.value)}
            disabled={isSubmitting}
            placeholder="Any feedback from stakeholders?"
            rows={3}
            className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {/* Accepted Stories Count */}
        <div>
          <label
            htmlFor="review-accepted-stories"
            className="block text-sm font-medium text-foreground"
          >
            Accepted Stories Count
          </label>
          <input
            id="review-accepted-stories"
            type="number"
            min={0}
            step={1}
            value={acceptedStoriesCount}
            onChange={(e) => {
              setAcceptedStoriesCount(e.target.value)
              clearFieldError('accepted_stories_count')
            }}
            disabled={isSubmitting}
            aria-describedby={
              fieldErrors.accepted_stories_count
                ? 'review-accepted-stories-error'
                : undefined
            }
            aria-invalid={
              fieldErrors.accepted_stories_count ? 'true' : 'false'
            }
            placeholder="e.g. 5"
            className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
              fieldErrors.accepted_stories_count
                ? 'border-destructive bg-destructive/5 focus:ring-destructive/40'
                : 'border-input bg-background focus:border-ring'
            }`}
          />
          {fieldErrors.accepted_stories_count && (
            <p
              id="review-accepted-stories-error"
              role="alert"
              className="mt-1 text-xs text-destructive"
            >
              {fieldErrors.accepted_stories_count}
            </p>
          )}
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
        <div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting…' : 'Submit Review'}
          </button>
        </div>
      </form>
    </div>
  )
}
