/**
 * Smoke Tests: Sprint Dashboard Schema & Infrastructure (Task 9.9)
 *
 * Verifies that the database schema, constraints, RLS policies, and RPC
 * function are correctly defined in the migration files, and that the
 * middleware redirects unauthenticated users.
 *
 * These tests read the SQL migration files and verify they contain the
 * expected DDL statements, rather than querying a live database.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readMigration(filename: string): string {
  const filePath = resolve(
    __dirname,
    '../../../prisma/migrations',
    filename
  )
  return readFileSync(filePath, 'utf-8')
}

function readSourceFile(relativePath: string): string {
  const filePath = resolve(__dirname, '../../..', relativePath)
  return readFileSync(filePath, 'utf-8')
}

// ---------------------------------------------------------------------------
// Sprints table schema, constraints, RLS, and partial unique index
// ---------------------------------------------------------------------------

describe('Smoke: sprints table schema and constraints (9.9)', () => {
  let sprintsMigration: string

  beforeAll(() => {
    sprintsMigration = readMigration('sprint_dashboard_sprints_table.sql')
  })

  it('should define the status CHECK constraint (active | completed)', () => {
    expect(sprintsMigration).toContain('sprints_status_check')
    expect(sprintsMigration).toMatch(/status\s+IN\s*\(\s*'active'\s*,\s*'completed'\s*\)/)
  })

  it('should define the end_after_start CHECK constraint', () => {
    expect(sprintsMigration).toContain('sprints_end_after_start')
    expect(sprintsMigration).toMatch(/end_date\s*>\s*start_date/)
  })

  it('should define the sprint_number_positive CHECK constraint', () => {
    expect(sprintsMigration).toContain('sprints_sprint_number_positive')
    expect(sprintsMigration).toMatch(/sprint_number\s*>\s*0/)
  })

  it('should make goal, start_date, end_date, and status NOT NULL', () => {
    expect(sprintsMigration).toContain('goal SET NOT NULL')
    expect(sprintsMigration).toContain('start_date SET NOT NULL')
    expect(sprintsMigration).toContain('end_date SET NOT NULL')
    expect(sprintsMigration).toContain('status SET NOT NULL')
  })

  it('should define the partial unique index sprints_one_active_per_team', () => {
    expect(sprintsMigration).toContain('sprints_one_active_per_team')
    expect(sprintsMigration).toMatch(
      /CREATE\s+UNIQUE\s+INDEX.*sprints_one_active_per_team/i
    )
    expect(sprintsMigration).toMatch(/WHERE\s+status\s*=\s*'active'/i)
  })

  it('should define SELECT RLS policy for team members', () => {
    expect(sprintsMigration).toContain('sprints_select_team_member')
    expect(sprintsMigration).toContain('FOR SELECT')
  })

  it('should define INSERT RLS policy for team members', () => {
    expect(sprintsMigration).toContain('sprints_insert_team_member')
    expect(sprintsMigration).toContain('FOR INSERT')
  })

  it('should define UPDATE RLS policy for team members', () => {
    expect(sprintsMigration).toContain('sprints_update_team_member')
    expect(sprintsMigration).toContain('FOR UPDATE')
  })

  it('should scope all RLS policies to auth.uid() via team_members', () => {
    // All policies should reference team_members and auth.uid()
    const policyMatches = sprintsMigration.match(/auth\.uid\(\)/g)
    expect(policyMatches).not.toBeNull()
    expect(policyMatches!.length).toBeGreaterThanOrEqual(3)
    expect(sprintsMigration).toContain('team_members')
  })
})

// ---------------------------------------------------------------------------
// Sprint reviews table schema, constraints, and RLS
// ---------------------------------------------------------------------------

describe('Smoke: sprint_reviews table schema and constraints (9.9)', () => {
  let reviewsMigration: string

  beforeAll(() => {
    reviewsMigration = readMigration('sprint_dashboard_reviews_table.sql')
  })

  it('should make increment_notes NOT NULL', () => {
    expect(reviewsMigration).toContain('increment_notes SET NOT NULL')
  })

  it('should make accepted_stories_count NOT NULL', () => {
    expect(reviewsMigration).toContain('accepted_stories_count SET NOT NULL')
  })

  it('should define the accepted_stories_count non-negative CHECK constraint', () => {
    expect(reviewsMigration).toContain(
      'sprint_reviews_accepted_stories_count_non_negative'
    )
    expect(reviewsMigration).toMatch(/accepted_stories_count\s*>=\s*0/)
  })

  it('should enable RLS on sprint_reviews', () => {
    expect(reviewsMigration).toMatch(
      /ALTER\s+TABLE\s+sprint_reviews\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i
    )
  })

  it('should define SELECT RLS policy for team members', () => {
    expect(reviewsMigration).toContain('sprint_reviews_select_team_member')
    expect(reviewsMigration).toContain('FOR SELECT')
  })

  it('should define INSERT RLS policy for team members', () => {
    expect(reviewsMigration).toContain('sprint_reviews_insert_team_member')
    expect(reviewsMigration).toContain('FOR INSERT')
  })

  it('should define UPDATE RLS policy for team members', () => {
    expect(reviewsMigration).toContain('sprint_reviews_update_team_member')
    expect(reviewsMigration).toContain('FOR UPDATE')
  })

  it('should scope sprint_reviews RLS policies via sprints join to team_members', () => {
    // Reviews RLS should join through sprints to team_members
    expect(reviewsMigration).toContain('sprints s')
    expect(reviewsMigration).toContain('team_members tm')
    expect(reviewsMigration).toContain('auth.uid()')
  })
})

// ---------------------------------------------------------------------------
// complete_sprint_with_review RPC function
// ---------------------------------------------------------------------------

describe('Smoke: complete_sprint_with_review RPC function (9.9)', () => {
  let rpcMigration: string

  beforeAll(() => {
    rpcMigration = readMigration('sprint_dashboard_rpc_complete_sprint.sql')
  })

  it('should define the complete_sprint_with_review function', () => {
    expect(rpcMigration).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+complete_sprint_with_review/i
    )
  })

  it('should accept the correct parameters (p_sprint_id, p_increment_notes, p_stakeholder_feedback, p_accepted_stories_count)', () => {
    expect(rpcMigration).toContain('p_sprint_id uuid')
    expect(rpcMigration).toContain('p_increment_notes text')
    expect(rpcMigration).toContain('p_stakeholder_feedback text')
    expect(rpcMigration).toContain('p_accepted_stories_count integer')
  })

  it('should validate sprint is active before proceeding', () => {
    expect(rpcMigration).toMatch(/status\s*=\s*'active'/)
    expect(rpcMigration).toContain('SPRINT_NOT_ACTIVE')
  })

  it('should upsert the sprint_reviews record with ON CONFLICT', () => {
    expect(rpcMigration).toContain('INSERT INTO sprint_reviews')
    expect(rpcMigration).toContain('ON CONFLICT (sprint_id) DO UPDATE')
  })

  it('should transition sprint status to completed', () => {
    expect(rpcMigration).toMatch(
      /UPDATE\s+sprints\s+SET\s+status\s*=\s*'completed'/i
    )
  })

  it('should be defined as SECURITY DEFINER', () => {
    expect(rpcMigration).toContain('SECURITY DEFINER')
  })

  it('should use plpgsql language', () => {
    expect(rpcMigration).toContain('LANGUAGE plpgsql')
  })
})

// ---------------------------------------------------------------------------
// Middleware: unauthenticated redirect to /auth
// ---------------------------------------------------------------------------

describe('Smoke: Middleware redirects unauthenticated users to /auth (9.9)', () => {
  let middlewareSource: string

  beforeAll(() => {
    middlewareSource = readSourceFile('middleware.ts')
  })

  it('should redirect unauthenticated users accessing /teams routes to /auth', () => {
    // The middleware checks !user and pathname.startsWith('/teams')
    expect(middlewareSource).toContain("pathname.startsWith('/teams')")
    expect(middlewareSource).toContain("pathname = '/auth'")
  })

  it('should include a redirect query parameter with the original path', () => {
    expect(middlewareSource).toContain("searchParams.set('redirect'")
  })

  it('should use Supabase auth.getUser() for session validation', () => {
    expect(middlewareSource).toContain('supabase.auth.getUser()')
  })
})

// ---------------------------------------------------------------------------
// Prisma schema: sprints and sprint_reviews models
// ---------------------------------------------------------------------------

describe('Smoke: Prisma schema defines Sprint and SprintReview models (9.9)', () => {
  let prismaSchema: string

  beforeAll(() => {
    prismaSchema = readSourceFile('prisma/schema.prisma')
  })

  it('should define the Sprint model mapped to sprints table', () => {
    expect(prismaSchema).toContain('model Sprint')
    expect(prismaSchema).toContain('@@map("sprints")')
  })

  it('should define the SprintReview model mapped to sprint_reviews table', () => {
    expect(prismaSchema).toContain('model SprintReview')
    expect(prismaSchema).toContain('@@map("sprint_reviews")')
  })

  it('should define unique constraint on (teamId, sprintNumber) for Sprint', () => {
    expect(prismaSchema).toContain('@@unique([teamId, sprintNumber])')
  })

  it('should define unique constraint on sprintId for SprintReview', () => {
    expect(prismaSchema).toMatch(/sprintId\s+String\s+@unique/)
  })
})
