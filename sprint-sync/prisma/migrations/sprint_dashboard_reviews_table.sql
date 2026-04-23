-- =============================================================================
-- Sprint Dashboard: sprint_reviews table constraints and RLS policies
--
-- This migration updates the existing sprint_reviews table to match the Sprint
-- Dashboard & Review Management design spec:
--   1. Renames accepted_stories to accepted_stories_count
--   2. Makes increment_notes NOT NULL
--   3. Makes accepted_stories_count NOT NULL with CHECK >= 0
--   4. Enables RLS with granular per-operation policies
--
-- Run this SQL in the Supabase SQL Editor after running `npx prisma db push`.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Column rename and nullability changes
-- ---------------------------------------------------------------------------

-- Rename accepted_stories to accepted_stories_count
ALTER TABLE sprint_reviews
  RENAME COLUMN accepted_stories TO accepted_stories_count;

-- Make increment_notes NOT NULL (set a default for any existing NULL rows first)
UPDATE sprint_reviews SET increment_notes = '' WHERE increment_notes IS NULL;
ALTER TABLE sprint_reviews ALTER COLUMN increment_notes SET NOT NULL;

-- Make accepted_stories_count NOT NULL (set a default for any existing NULL rows first)
UPDATE sprint_reviews SET accepted_stories_count = 0 WHERE accepted_stories_count IS NULL;
ALTER TABLE sprint_reviews ALTER COLUMN accepted_stories_count SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. CHECK constraints
-- ---------------------------------------------------------------------------

-- accepted_stories_count must be a non-negative integer
ALTER TABLE sprint_reviews
  ADD CONSTRAINT sprint_reviews_accepted_stories_count_non_negative
  CHECK (accepted_stories_count >= 0);

-- ---------------------------------------------------------------------------
-- 3. Enable RLS and create granular per-operation policies
-- ---------------------------------------------------------------------------

ALTER TABLE sprint_reviews ENABLE ROW LEVEL SECURITY;

-- Drop any existing generic policy (if present)
DROP POLICY IF EXISTS "sprint_reviews_team_member" ON sprint_reviews;

-- SELECT: team members can read reviews for their team's sprints
CREATE POLICY "sprint_reviews_select_team_member"
  ON sprint_reviews FOR SELECT
  USING (
    sprint_id IN (
      SELECT s.id FROM sprints s
      JOIN team_members tm ON tm.team_id = s.team_id
      WHERE tm.user_id = auth.uid()
    )
  );

-- INSERT: team members can insert reviews for their team's sprints
CREATE POLICY "sprint_reviews_insert_team_member"
  ON sprint_reviews FOR INSERT
  WITH CHECK (
    sprint_id IN (
      SELECT s.id FROM sprints s
      JOIN team_members tm ON tm.team_id = s.team_id
      WHERE tm.user_id = auth.uid()
    )
  );

-- UPDATE: team members can update reviews for their team's sprints
CREATE POLICY "sprint_reviews_update_team_member"
  ON sprint_reviews FOR UPDATE
  USING (
    sprint_id IN (
      SELECT s.id FROM sprints s
      JOIN team_members tm ON tm.team_id = s.team_id
      WHERE tm.user_id = auth.uid()
    )
  );
