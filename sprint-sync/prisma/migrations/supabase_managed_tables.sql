-- =============================================================================
-- Supabase-Managed Tables, Indexes, and RLS Policies
--
-- These tables reference auth.users and cannot be owned by Prisma.
-- Run this SQL in the Supabase SQL Editor or via a migration tool.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 50),
  avatar_url   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for profiles
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- team_members table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_members (
  team_id   uuid REFERENCES teams(id) ON DELETE CASCADE,
  user_id   uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role      text NOT NULL CHECK (role IN ('facilitator', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- RLS policies for team_members
CREATE POLICY "team_members_select" ON team_members
  FOR SELECT USING (
    user_id = auth.uid() OR
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

CREATE POLICY "team_members_insert_facilitator" ON team_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = team_members.team_id
        AND user_id = auth.uid()
        AND role = 'facilitator'
    )
  );

CREATE POLICY "team_members_delete" ON team_members
  FOR DELETE USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'facilitator'
    )
  );

-- ---------------------------------------------------------------------------
-- RLS policies for Prisma-managed tables
-- ---------------------------------------------------------------------------

-- teams
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teams_select_member" ON teams
  FOR SELECT USING (
    id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

CREATE POLICY "teams_insert_authenticated" ON teams
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "teams_update_facilitator" ON teams
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = teams.id AND user_id = auth.uid() AND role = 'facilitator'
    )
  );

CREATE POLICY "teams_delete_facilitator" ON teams
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = teams.id AND user_id = auth.uid() AND role = 'facilitator'
    )
  );

-- sprints
ALTER TABLE sprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sprints_team_member" ON sprints
  FOR ALL USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

-- sprint_reviews
ALTER TABLE sprint_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sprint_reviews_team_member" ON sprint_reviews
  FOR ALL USING (
    sprint_id IN (
      SELECT id FROM sprints
      WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    )
  );

-- retro_boards
ALTER TABLE retro_boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "retro_boards_team_member" ON retro_boards
  FOR ALL USING (
    sprint_id IN (
      SELECT id FROM sprints
      WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    )
  );

-- retro_cards
ALTER TABLE retro_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "retro_cards_team_member" ON retro_cards
  FOR ALL USING (
    board_id IN (
      SELECT rb.id FROM retro_boards rb
      JOIN sprints s ON s.id = rb.sprint_id
      WHERE s.team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    )
  );

-- action_items
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "action_items_team_member" ON action_items
  FOR ALL USING (
    sprint_id IN (
      SELECT id FROM sprints
      WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- RPC: get_user_id_by_email
--
-- Returns the auth.users id for a given email address.
-- Used by inviteUserToTeam to resolve an email to a user ID.
-- Only callable by authenticated users (SECURITY DEFINER runs as the
-- function owner, which has access to auth.users).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_id_by_email(email text)
RETURNS TABLE (id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE auth.users.email = get_user_id_by_email.email LIMIT 1;
$$;

-- Revoke public execute and grant only to authenticated users
REVOKE EXECUTE ON FUNCTION get_user_id_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_id_by_email(text) TO authenticated;
