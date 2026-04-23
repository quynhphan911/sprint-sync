import { describe, it, expect } from 'vitest'
import {
  validateGoal,
  validateStartDate,
  validateEndDate,
  validateSprintNumber,
  validateIncrementNotes,
  validateAcceptedStoriesCount,
} from '@/lib/sprint/validators'

// ---------------------------------------------------------------------------
// validateGoal
// ---------------------------------------------------------------------------

describe('validateGoal', () => {
  it('rejects an empty string', () => {
    const result = validateGoal('')
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.message).toBeTruthy()
  })

  it('rejects a space-only string', () => {
    const result = validateGoal('   ')
    expect(result.valid).toBe(false)
  })

  it('rejects a tab-only string', () => {
    const result = validateGoal('\t')
    expect(result.valid).toBe(false)
  })

  it('rejects a newline-only string', () => {
    const result = validateGoal('\n')
    expect(result.valid).toBe(false)
  })

  it('accepts a valid goal string', () => {
    const result = validateGoal('Deliver user authentication')
    expect(result).toEqual({ valid: true })
  })
})

// ---------------------------------------------------------------------------
// validateStartDate
// ---------------------------------------------------------------------------

describe('validateStartDate', () => {
  it('rejects an empty string', () => {
    const result = validateStartDate('')
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.message).toBeTruthy()
  })

  it('rejects an invalid format', () => {
    const result = validateStartDate('not-a-date')
    expect(result.valid).toBe(false)
  })

  it('rejects an invalid calendar date (Feb 30)', () => {
    const result = validateStartDate('2024-02-30')
    expect(result.valid).toBe(false)
  })

  it('accepts a valid ISO date', () => {
    const result = validateStartDate('2024-01-15')
    expect(result).toEqual({ valid: true })
  })
})

// ---------------------------------------------------------------------------
// validateEndDate
// ---------------------------------------------------------------------------

describe('validateEndDate', () => {
  it('rejects an empty string', () => {
    const result = validateEndDate('', '2024-01-15')
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.message).toBeTruthy()
  })

  it('rejects an invalid format', () => {
    const result = validateEndDate('not-a-date', '2024-01-15')
    expect(result.valid).toBe(false)
  })

  it('rejects end_date equal to start_date', () => {
    const result = validateEndDate('2024-01-15', '2024-01-15')
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.message).toBeTruthy()
  })

  it('rejects end_date before start_date', () => {
    const result = validateEndDate('2024-01-10', '2024-01-15')
    expect(result.valid).toBe(false)
  })

  it('accepts end_date strictly after start_date', () => {
    const result = validateEndDate('2024-01-29', '2024-01-15')
    expect(result).toEqual({ valid: true })
  })
})

// ---------------------------------------------------------------------------
// validateSprintNumber
// ---------------------------------------------------------------------------

describe('validateSprintNumber', () => {
  it('rejects zero', () => {
    const result = validateSprintNumber(0)
    expect(result.valid).toBe(false)
  })

  it('rejects negative numbers', () => {
    const result = validateSprintNumber(-1)
    expect(result.valid).toBe(false)
  })

  it('rejects decimals', () => {
    const result = validateSprintNumber(1.5)
    expect(result.valid).toBe(false)
  })

  it('rejects NaN', () => {
    const result = validateSprintNumber(NaN)
    expect(result.valid).toBe(false)
  })

  it('rejects Infinity', () => {
    const result = validateSprintNumber(Infinity)
    expect(result.valid).toBe(false)
  })

  it('accepts 1', () => {
    const result = validateSprintNumber(1)
    expect(result).toEqual({ valid: true })
  })

  it('accepts 100', () => {
    const result = validateSprintNumber(100)
    expect(result).toEqual({ valid: true })
  })
})

// ---------------------------------------------------------------------------
// validateIncrementNotes
// ---------------------------------------------------------------------------

describe('validateIncrementNotes', () => {
  it('rejects an empty string', () => {
    const result = validateIncrementNotes('')
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.message).toBeTruthy()
  })

  it('rejects a space-only string', () => {
    const result = validateIncrementNotes('   ')
    expect(result.valid).toBe(false)
  })

  it('rejects a tab-only string', () => {
    const result = validateIncrementNotes('\t')
    expect(result.valid).toBe(false)
  })

  it('rejects a newline-only string', () => {
    const result = validateIncrementNotes('\n')
    expect(result.valid).toBe(false)
  })

  it('accepts a valid notes string', () => {
    const result = validateIncrementNotes('Shipped login flow and profile page')
    expect(result).toEqual({ valid: true })
  })
})

// ---------------------------------------------------------------------------
// validateAcceptedStoriesCount
// ---------------------------------------------------------------------------

describe('validateAcceptedStoriesCount', () => {
  it('rejects -1', () => {
    const result = validateAcceptedStoriesCount(-1)
    expect(result.valid).toBe(false)
  })

  it('rejects negative decimals', () => {
    const result = validateAcceptedStoriesCount(-0.5)
    expect(result.valid).toBe(false)
  })

  it('rejects NaN', () => {
    const result = validateAcceptedStoriesCount(NaN)
    expect(result.valid).toBe(false)
  })

  it('rejects Infinity', () => {
    const result = validateAcceptedStoriesCount(Infinity)
    expect(result.valid).toBe(false)
  })

  it('accepts 0', () => {
    const result = validateAcceptedStoriesCount(0)
    expect(result).toEqual({ valid: true })
  })

  it('accepts 5', () => {
    const result = validateAcceptedStoriesCount(5)
    expect(result).toEqual({ valid: true })
  })
})
