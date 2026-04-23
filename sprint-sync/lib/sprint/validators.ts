/**
 * Validator — pure validation functions for Sprint and SprintReview data.
 * No side effects, no I/O.
 *
 * Validates: Requirements 2.2, 2.3, 2.4, 4.3, 4.4
 */

/**
 * Result of a validation check.
 * Either the value is valid, or it is invalid with a human-readable message.
 */
export type ValidationResult = { valid: true } | { valid: false; message: string }

// ---------------------------------------------------------------------------
// ISO date regex: YYYY-MM-DD
// ---------------------------------------------------------------------------

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

/**
 * Returns true if `value` is a valid ISO date string (YYYY-MM-DD) that
 * represents a real calendar date.
 */
function isValidISODate(value: string): boolean {
  if (!ISO_DATE_REGEX.test(value)) {
    return false
  }

  const date = new Date(value + 'T00:00:00Z')
  if (isNaN(date.getTime())) {
    return false
  }

  // Guard against dates like "2024-02-30" which JS silently rolls over.
  // Compare the parsed components back to the input.
  const [year, month, day] = value.split('-').map(Number)
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  )
}

// ---------------------------------------------------------------------------
// Goal
// ---------------------------------------------------------------------------

/**
 * Validates a sprint goal.
 *
 * Rules:
 * - Must be a non-empty string (after trimming).
 *
 * Validates: Requirements 2.2
 */
export function validateGoal(value: string): ValidationResult {
  if (!value || value.trim().length === 0) {
    return { valid: false, message: 'Goal is required.' }
  }

  return { valid: true }
}

// ---------------------------------------------------------------------------
// Start date
// ---------------------------------------------------------------------------

/**
 * Validates a sprint start date.
 *
 * Rules:
 * - Must be a non-empty string.
 * - Must be a valid ISO date (YYYY-MM-DD).
 *
 * Validates: Requirements 2.2
 */
export function validateStartDate(value: string): ValidationResult {
  if (!value || value.trim().length === 0) {
    return { valid: false, message: 'Start date is required.' }
  }

  if (!isValidISODate(value)) {
    return { valid: false, message: 'Start date must be a valid date (YYYY-MM-DD).' }
  }

  return { valid: true }
}

// ---------------------------------------------------------------------------
// End date
// ---------------------------------------------------------------------------

/**
 * Validates a sprint end date.
 *
 * Rules:
 * - Must be a non-empty string.
 * - Must be a valid ISO date (YYYY-MM-DD).
 * - Must be strictly after `startDate`.
 *
 * Validates: Requirements 2.3
 */
export function validateEndDate(value: string, startDate: string): ValidationResult {
  if (!value || value.trim().length === 0) {
    return { valid: false, message: 'End date is required.' }
  }

  if (!isValidISODate(value)) {
    return { valid: false, message: 'End date must be a valid date (YYYY-MM-DD).' }
  }

  if (!isValidISODate(startDate)) {
    return { valid: false, message: 'Start date is invalid; cannot validate end date.' }
  }

  if (value <= startDate) {
    return { valid: false, message: 'End date must be after start date.' }
  }

  return { valid: true }
}

// ---------------------------------------------------------------------------
// Sprint number
// ---------------------------------------------------------------------------

/**
 * Validates a sprint number.
 *
 * Rules:
 * - Must be a positive integer (> 0).
 * - Must not be NaN, Infinity, or a decimal.
 *
 * Validates: Requirements 2.4
 */
export function validateSprintNumber(value: number): ValidationResult {
  if (!Number.isInteger(value) || value <= 0) {
    return { valid: false, message: 'Sprint number must be a positive integer.' }
  }

  return { valid: true }
}

// ---------------------------------------------------------------------------
// Increment notes
// ---------------------------------------------------------------------------

/**
 * Validates sprint review increment notes.
 *
 * Rules:
 * - Must be a non-empty string (after trimming).
 *
 * Validates: Requirements 4.3
 */
export function validateIncrementNotes(value: string): ValidationResult {
  if (!value || value.trim().length === 0) {
    return { valid: false, message: 'Increment notes are required.' }
  }

  return { valid: true }
}

// ---------------------------------------------------------------------------
// Accepted stories count
// ---------------------------------------------------------------------------

/**
 * Validates the accepted stories count for a sprint review.
 *
 * Rules:
 * - Must be a non-negative integer (>= 0).
 * - Must not be NaN, Infinity, or a decimal.
 *
 * Validates: Requirements 4.4
 */
export function validateAcceptedStoriesCount(value: number): ValidationResult {
  if (!Number.isInteger(value) || value < 0) {
    return { valid: false, message: 'Accepted stories count must be a non-negative integer.' }
  }

  return { valid: true }
}
