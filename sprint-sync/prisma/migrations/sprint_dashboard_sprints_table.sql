-- =============================================================================
-- Sprint Dashboard: sprints table constraints and RLS policies
--
-- This migration updates the existing sprints table to match the Sprint
-- Dashboard & Review Management design spec:
--   1. Makes goal, start_date, end_date NOT NULL
--   2. Changes status default from 'draft' to 'active' with CHECK constraint
--   3. Changes start_date and end_date column types to date
--   4. Adds CHECK constraints (end_date > start_date, sprint_number > 0)
--   5. Replaces the generic FOR ALL RLS policy with granular per-operation policies
--   6. Adds partial unique index to enforce at most one active sprint per team
--
-- Run this SQL in the Supabase SQL Editor after running `npx prisma db push`.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Column type and nullability changes
-- ---------------------------------------------------------------------------

-- Change start_date and end_date from timestamptz to date
ALTER TABLE sprints
  ALTER COLUMN start_date TYPE date USING start_date::date,
  ALTER COLUMN end_date   TYPE date USING end_date::date;

-- Make goal NOT NULL (set a default for any existing NULL rows first)
UPDATE sprints SET goal = '' WHERE goal IS NULL;
ALTER TABLE sprints ALTER COLUMN goal SET NOT NULL;

-- Make start_date and end_date NOT NULL
-- (existing NULL rows must be handled before running this migration)
ALTER TABLE sprints ALTER COLUMN start_date SET NOT NULL;
ALTER TABLE sprints ALTER COLUMN end_date SET NOT NULL;

-- Change status default from 'draft' to 'active'
ALTER TABLE sprints ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE sprints ALTER COLUMN status SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. CHECK constraints
-- ---------------------------------------------------------------------------

-- Status must be 'active' or 'completed'
ALTER TABLE sprints
  ADD CONSTRAINT sprints_status_check
  CHECK (status IN ('active', 'completed'));

-- end_date must be strictly after start_date
ALTER TABLE sprints
  ADD CONSTRAINT sprints_end_after_start
  CHECK (end_date > start_date);

-- sprint_number must be a positive integer
ALTER TABLE sprints
  ADD CONSTRAINT sprints_sprint_number_positive
  CHECK (sprint_number > 0);

-- ---------------------------------------------------------------------------
-- 3. Replace generic RLS policy with granular per-operation policies
-- ---------------------------------------------------------------------------

-- Drop the existing generic policy
DROP POLICY IF EXISTS "sprints_team_member" ON sprints;

-- SELECT: team members can read sprints for their teams
CREATE POLICY "sprints_select_team_member"
  ON sprints FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- INSERT: team members can create sprints for their teams
CREATE POLICY "sprints_insert_team_member"
  ON sprints FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- UPDATE: team members can update sprints for their teams
CREATE POLICY "sprints_update_team_member"
  ON sprints FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Partial unique index: at most one active sprint per team
-- ---------------------------------------------------------------------------

-- Enforce at most one active sprint per team at the database level
CREATE UNIQUE INDEX IF NOT EXISTS sprints_one_active_per_team
  ON sprints (team_id)
  WHERE status = 'active';
