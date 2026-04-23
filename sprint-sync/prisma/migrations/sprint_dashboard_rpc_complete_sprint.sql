-- =============================================================================
-- Sprint Dashboard: complete_sprint_with_review RPC function
--
-- This migration creates the `complete_sprint_with_review` Postgres function
-- that atomically:
--   1. Validates the sprint is currently active (raises SPRINT_NOT_ACTIVE if not)
--   2. Upserts the sprint_reviews record (INSERT ... ON CONFLICT DO UPDATE)
--   3. Transitions the sprint status from 'active' to 'completed'
--
-- The function is SECURITY DEFINER so it bypasses RLS for the atomic operation.
-- This is safe because the Route Handler layer validates team membership before
-- calling the RPC.
--
-- Run this SQL in the Supabase SQL Editor after the sprints and sprint_reviews
-- table migrations have been applied.
-- =============================================================================

CREATE OR REPLACE FUNCTION complete_sprint_with_review(
  p_sprint_id uuid,
  p_increment_notes text,
  p_stakeholder_feedback text,
  p_accepted_stories_count integer
) RETURNS void AS $$
BEGIN
  -- Validate that the sprint exists and is currently active
  IF NOT EXISTS (
    SELECT 1 FROM sprints WHERE id = p_sprint_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'SPRINT_NOT_ACTIVE';
  END IF;

  -- Upsert the sprint review record
  INSERT INTO sprint_reviews (sprint_id, increment_notes, stakeholder_feedback, accepted_stories_count)
  VALUES (p_sprint_id, p_increment_notes, p_stakeholder_feedback, p_accepted_stories_count)
  ON CONFLICT (sprint_id) DO UPDATE
    SET increment_notes = EXCLUDED.increment_notes,
        stakeholder_feedback = EXCLUDED.stakeholder_feedback,
        accepted_stories_count = EXCLUDED.accepted_stories_count;

  -- Transition sprint status from active to completed
  UPDATE sprints SET status = 'completed' WHERE id = p_sprint_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
