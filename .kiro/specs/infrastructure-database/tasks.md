# Implementation Plan: Infrastructure & Database

## Overview

Set up the foundational SprintSync infrastructure: Next.js project scaffolding with TypeScript strict mode, environment configuration with startup validation, Prisma schema with all six models and indexes, Supabase-managed tables (profiles, team_members) with RLS policies, Supabase client factories, Next.js middleware for session management and route protection, Team management UI, team member invitation, seed data, and developer tooling.

## Tasks

- [x] 1. Initialise Next.js project with core dependencies and directory structure
  - Run `create-next-app` with App Router, TypeScript strict mode, Tailwind CSS, and ESLint
  - Install production dependencies: `@supabase/ssr`, `@supabase/supabase-js`, `@prisma/client`, `lucide-react`, `zustand`
  - Install dev dependencies: `prisma`, `prettier`, `eslint-config-prettier`
  - Install and initialise shadcn/ui with the default component registry
  - Create top-level directories: `app/`, `components/`, `lib/`, `types/`, `prisma/`
  - Configure `tailwind.config.ts` with design tokens (white/light-gray background, primary colour accent)
  - Configure ESLint rules: named exports, no `any`, `async/await` preference
  - Configure Prettier with project code style conventions
  - Create `.gitignore` excluding `.env.local`, `node_modules/`, `.next/`, and generated Prisma artefacts
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

- [x] 2. Configure environment variables and startup validation
  - [x] 2.1 Create `.env.local.example` with all four `Env_Config` variables
    - Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL`, `DIRECT_URL` with placeholder values and inline documentation comments
    - _Requirements: 1.10_

  - [x] 2.2 Implement environment validation module
    - Create `lib/env.ts` that reads all four required env vars at module load time
    - Throw a descriptive error naming the missing variable if any are absent
    - Export typed constants for use throughout the app
    - Import `lib/env.ts` in the app entry point so validation runs at startup
    - _Requirements: 1.11, 6.4_

- [x] 3. Implement Prisma schema with all models and indexes
  - [x] 3.1 Create `prisma/schema.prisma` with datasource and generator blocks
    - Configure `postgresql` datasource with `url = env("DATABASE_URL")` and `directUrl = env("DIRECT_URL")`
    - Add `prisma-client-js` generator block
    - _Requirements: 3.1_

  - [x] 3.2 Define all six Prisma models
    - `Team`: `id` (String UUID PK), `name` (String), `createdAt` (DateTime default now()), relation to `Sprint[]`
    - `Sprint`: `id` (String UUID PK), `teamId` (FK → Team), `sprintNumber` (Int), `goal` (String?), `status` (String default `'draft'`), `startDate` (DateTime?), `endDate` (DateTime?), `createdAt` (DateTime default now()), relation to `SprintReview`, `RetroBoard`, `ActionItem[]`
    - `SprintReview`: `id` (String UUID PK), `sprintId` (String unique FK → Sprint), `incrementNotes` (String? @db.Text), `stakeholderFeedback` (String? @db.Text), `acceptedStories` (Int?), `createdAt` (DateTime default now())
    - `RetroBoard`: `id` (String UUID PK), `sprintId` (String unique FK → Sprint), `status` (String default `'collecting'`), `createdAt` (DateTime default now()), relation to `RetroCard[]`
    - `RetroCard`: `id` (String UUID PK), `boardId` (FK → RetroBoard), `authorId` (String?), `category` (String), `content` (String @db.Text), `votes` (Int default 0), `createdAt` (DateTime default now())
    - `ActionItem`: `id` (String UUID PK), `sprintId` (FK → Sprint), `assigneeId` (String?), `description` (String @db.Text), `status` (String), `createdAt` (DateTime default now())
    - Apply cascade delete referential actions on all FK relations
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.10, 10.1, 10.2, 10.3, 10.5_

  - [x] 3.3 Add all performance indexes to the schema
    - `@@index([teamId])` on `Sprint`
    - `@@index([sprintId])` on `RetroBoard`
    - `@@index([boardId])` on `RetroCard`
    - `@@index([boardId, category])` composite on `RetroCard`
    - `@@index([sprintId])` on `ActionItem`
    - `@@index([assigneeId])` on `ActionItem`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 4. Create Prisma client singleton
  - Create `lib/prisma.ts` using the `globalThis` pattern: in development reuse the instance stored on `globalThis`; in production create a single instance per process
  - Guard against missing `DATABASE_URL` with a descriptive startup error
  - Export the singleton as a named export `prisma`
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 5. Create Supabase client factories
  - [x] 5.1 Create `lib/supabase/server.ts`
    - Export a named `createServerClient` factory that constructs a Supabase server client using `@supabase/ssr`, reading cookies from the current request context
    - Compatible with Next.js App Router Server Components and Route Handlers
    - Throw a descriptive error if called outside a valid request context
    - _Requirements: 1.4, 7.1, 7.6_

  - [x] 5.2 Create `lib/supabase/client.ts`
    - Export a named `createBrowserClient` factory that constructs a Supabase browser client using `@supabase/ssr`
    - For use in Client Components, real-time subscriptions, and auth operations
    - _Requirements: 1.4, 7.2_

- [x] 6. Implement Next.js middleware for session management and route protection
  - Create `middleware.ts` at the project root
  - Refresh the Supabase session on every request (handle expired access tokens)
  - Redirect unauthenticated users accessing protected routes to `/auth?redirect=<original_url>`
  - Redirect authenticated users accessing `/auth` to `/teams`
  - Define the route matcher to protect `/teams`, `/account`, and other authenticated paths; exclude `/auth`, `/api/auth`, and Next.js static asset paths (`/_next`, `/favicon.ico`, etc.)
  - _Requirements: 7.3, 7.4, 7.5, 8.10_

- [x] 7. Create Supabase-managed SQL tables, indexes, and RLS policies
  - [x] 7.1 Write SQL migration for `profiles` and `team_members` tables
    - `profiles`: `id` (uuid PK references `auth.users(id)` on delete cascade), `display_name` (text not null, length check 1–50), `avatar_url` (text nullable), `created_at` (timestamptz not null default now())
    - `team_members`: `team_id` (uuid references `teams(id)` on delete cascade), `user_id` (uuid references `auth.users(id)` on delete cascade), `role` (text not null, check `role IN ('facilitator', 'member')`), `joined_at` (timestamptz not null default now()), composite PK `(team_id, user_id)`
    - Add index on `team_members(user_id)`
    - Place SQL in `prisma/migrations/supabase_managed_tables.sql` for reference
    - _Requirements: 3.8, 3.9, 4.7, 10.6_

  - [x] 7.2 Write RLS policies for `profiles` and `team_members`
    - Enable RLS on `profiles`; SELECT/UPDATE only where `id = auth.uid()`; INSERT only where `id = auth.uid()`
    - Enable RLS on `team_members`; SELECT for any team the user belongs to; INSERT/DELETE for facilitators (or self-removal)
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 7.3 Write RLS policies for all Prisma-managed tables
    - Enable RLS on `teams`: SELECT for members; INSERT for any authenticated user; UPDATE/DELETE for facilitators only
    - Enable RLS on `sprints`: SELECT/INSERT/UPDATE/DELETE for team members
    - Enable RLS on `sprint_reviews`: SELECT/INSERT/UPDATE for team members (via sprint → team)
    - Enable RLS on `retro_boards`: SELECT/INSERT/UPDATE for team members (via sprint → team)
    - Enable RLS on `retro_cards`: SELECT/INSERT/UPDATE for team members (via board → sprint → team)
    - Enable RLS on `action_items`: SELECT/INSERT/UPDATE/DELETE for team members (via sprint → team)
    - Append all policies to `prisma/migrations/supabase_managed_tables.sql`
    - _Requirements: 5.1, 5.3, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.12_

- [x] 8. Checkpoint — verify schema and connectivity
  - Ensure `npx prisma db push` runs without errors against the Supabase project
  - Ensure `npx prisma generate` produces the typed client without errors
  - Ensure all RLS policies are applied (query `pg_policies` or use Supabase dashboard)
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement Team management data layer and Teams page
  - [x] 9.1 Create `lib/services/team-service.ts` with core Team operations
    - `getTeamsForUser(userId)`: query `team_members` joined with `teams` via Supabase server client; return teams with user's role
    - `createTeam(name, userId)`: validate name (non-empty, ≤ 100 chars); insert into `teams`; insert into `team_members` with `role = 'facilitator'`; return created team or descriptive error
    - Use the Supabase server client so RLS is enforced
    - _Requirements: 8.1, 8.3, 8.4, 8.8, 8.9_

  - [x] 9.2 Create `types/team.ts` with shared TypeScript interfaces
    - `Team`, `TeamMember`, `TeamWithRole`, `CreateTeamInput` interfaces
    - _Requirements: 8.1, 8.3_

  - [x] 9.3 Create the Teams page at `app/teams/page.tsx`
    - Server Component; fetch teams using `getTeamsForUser` on initial load
    - Render team list showing `name` and user's `role` per team
    - Render empty-state message with CTA when user belongs to no teams
    - Each team card links to `/teams/[teamId]/dashboard`
    - Pass server-fetched teams as props to the client `TeamList` component
    - _Requirements: 8.1, 8.2, 8.7, 8.9_

  - [x] 9.4 Create `components/teams/TeamForm.tsx` client component
    - Controlled form with `name` field
    - Client-side validation: non-empty, ≤ 100 characters; display field-level error on violation
    - On submit call a Server Action or Route Handler that invokes `createTeam`
    - On success: update team list without full page reload; display toast notification
    - On error: display descriptive error message; retain entered data
    - _Requirements: 8.3, 8.4, 8.5, 8.6, 8.8_

- [x] 10. Implement Team member invitation
  - [x] 10.1 Add `inviteUserToTeam(teamId, email, requestingUserId)` to `lib/services/team-service.ts`
    - Verify requesting user is a facilitator of the team; return authorisation error if not
    - Look up `auth.users` by email to find the target user's `id`
    - Return descriptive error if user not found
    - Check `team_members` for existing membership; return descriptive error if already a member
    - Insert `team_members` row with `role = 'member'`
    - _Requirements: 9.2, 9.4, 9.5, 9.7_

  - [x] 10.2 Create `components/teams/InviteMemberForm.tsx` client component
    - Controlled form with `email` field
    - Client-side validation: non-empty, valid email format; display field-level error on violation
    - On submit call a Server Action or Route Handler that invokes `inviteUserToTeam`
    - On success: display toast notification confirming the invitation
    - On error: display descriptive error message from the service
    - _Requirements: 9.1, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [x] 10.3 Create team settings page at `app/teams/[teamId]/settings/page.tsx`
    - Server Component; verify user is authenticated and a member of the team
    - Render `InviteMemberForm` for facilitators
    - _Requirements: 9.1_

- [x] 11. Create seed script
  - Create `prisma/seed.ts` (TypeScript, run via `ts-node` or `tsx`)
  - Seed at minimum: one Team, two Team_Members (one facilitator, one member), one Sprint, one RetroBoard, two RetroCards, one ActionItem
  - Use the Prisma client for Prisma-managed tables; use raw SQL or Supabase admin client for `profiles` and `team_members`
  - Add `"seed"` script to `package.json` pointing to the seed file
  - _Requirements: 11.3_

- [x] 12. Add package.json scripts and README documentation
  - [x] 12.1 Add all required scripts to `package.json`
    - `dev`: `next dev`
    - `build`: `next build`
    - `lint`: `next lint`
    - `type-check`: `tsc --noEmit`
    - `db:push`: `prisma db push`
    - `db:migrate`: `prisma migrate dev`
    - `db:generate`: `prisma generate`
    - _Requirements: 11.2_

  - [x] 12.2 Write `README.md` at the project root
    - Prerequisites: Node.js version, required environment variables
    - Environment variable setup: where to find each value in the Supabase dashboard
    - Steps: clone → copy `.env.local.example` → fill in values → `npm install` → `npm run db:push` → `npm run dev`
    - Distinction between `db:push` (rapid dev iteration) and `db:migrate` (versioned migration files for production)
    - `db:generate` usage: run after every schema change
    - Supabase project connection steps
    - _Requirements: 2.5, 11.1, 11.4, 11.6_

- [x] 13. Final checkpoint — full integration verification
  - Ensure `npm run type-check` passes with zero errors
  - Ensure `npm run lint` passes with zero warnings
  - Ensure `npm run build` completes successfully
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The design document has no Correctness Properties section, so no property-based test sub-tasks are included; use unit and integration tests where needed
- `profiles` and `team_members` are managed outside Prisma (Supabase Auth triggers + RLS-aware queries); all other tables are Prisma-managed
- Always use the Supabase server client for user-facing queries so RLS is enforced; use the Prisma client only for server-side admin operations
- The Prisma client bypasses RLS by default — never use it for user-facing data access
- Run `npm run db:generate` after any change to `prisma/schema.prisma`
