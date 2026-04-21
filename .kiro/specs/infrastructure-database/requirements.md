# Requirements Document

## Introduction

The Infrastructure & Database Implementation is the foundational layer of SprintSync. It covers Next.js project scaffolding, Supabase project setup, full database schema creation via Prisma ORM, Row-Level Security (RLS) policy configuration, Supabase Auth initialisation, and Team management. Every other SprintSync feature — Sprint Dashboard, Retrospective Board, and Action Items — depends on the infrastructure established here. This spec defines what must be in place before any feature-level development begins.

## Glossary

- **Scaffolding_Service**: The set of configuration files, directory structure, and tooling setup that constitutes the initial Next.js project.
- **Supabase_Project**: The hosted Supabase instance providing PostgreSQL, Realtime, Auth, and Storage services for SprintSync.
- **Prisma_Schema**: The `prisma/schema.prisma` file that defines all database models, relations, and configuration for Prisma ORM. It is the single source of truth for the database structure managed by Prisma.
- **Prisma_Client**: The auto-generated, type-safe TypeScript client produced by `prisma generate`, used for server-side database operations. A global singleton instance is maintained in `lib/prisma.ts` to prevent multiple instances during Next.js hot-reloading.
- **Migration**: A versioned change applied to the Supabase database to create or alter schema objects in a reproducible, ordered manner. Prisma migrations are generated via `npx prisma migrate dev`; schema can also be pushed directly with `npx prisma db push` during development.
- **Schema**: The complete set of PostgreSQL tables, columns, constraints, indexes, and relationships that model SprintSync's data, defined in the Prisma_Schema and synchronised to the Supabase_Project database.
- **RLS_Policy**: A PostgreSQL Row-Level Security policy attached to a table that restricts which rows a given database role or authenticated user may read or write. Prisma uses the database service role and bypasses RLS by default; RLS is enforced for user-facing queries via the Supabase_Client.
- **Supabase_Client**: The TypeScript client used to interact with Supabase services — either the server client (from `@supabase/ssr`, used in Server Components and Route Handlers) or the browser client (used in Client Components for real-time subscriptions and auth). The Supabase_Client respects RLS policies and is used for all user-facing data queries.
- **Middleware**: The Next.js `middleware.ts` file that runs on every request to refresh Supabase sessions and enforce route-level authentication guards.
- **Team**: The core organisational entity in SprintSync — a named group of Esoft team members who share sprints, retro boards, and action items.
- **Team_Member**: An authenticated user who belongs to one or more Teams via the `team_members` join table.
- **Team_Service**: The server-side data access layer responsible for all Team and Team_Member database operations.
- **Teams_Page**: The Next.js page rendered at `/teams`, listing all teams the authenticated user belongs to.
- **Team_Form**: The client-side form component used to create a new Team.
- **Validator**: The input validation logic applied before persisting Team or Team_Member data.
- **Env_Config**: The set of environment variables required to connect the Next.js application to Supabase and Prisma: `NEXT_PUBLIC_SUPABASE_URL` (Supabase project URL), `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase anonymous key for client-side auth and real-time), `DATABASE_URL` (Prisma connection pooling URL on port 5432), and `DIRECT_URL` (Prisma direct migration URL on port 6543).
- **Seed_Script**: An optional SQL or TypeScript script that populates the database with representative development data for local testing.

---

## Requirements

### Requirement 1: Next.js Project Scaffolding

**User Story:** As a developer, I want a correctly configured Next.js project with all required dependencies and conventions in place, so that the team can begin feature development on a consistent, reproducible foundation.

#### Acceptance Criteria

1. THE Scaffolding_Service SHALL initialise a Next.js project using the App Router with TypeScript strict mode enabled and no `any` types permitted.
2. THE Scaffolding_Service SHALL install and configure Tailwind CSS with the project's design tokens (white/light-gray background, primary colour accent) applied in `tailwind.config.ts`.
3. THE Scaffolding_Service SHALL install and configure shadcn/ui with the default component registry, making primitives available for use across all features.
4. THE Scaffolding_Service SHALL install `@supabase/ssr` and `@supabase/supabase-js` as dependencies and SHALL create `lib/supabase/server.ts` (server client factory) and `lib/supabase/client.ts` (browser client factory).
5. THE Scaffolding_Service SHALL install `@prisma/client` as a production dependency and `prisma` as a development dependency for type-safe database access and schema management.
6. THE Scaffolding_Service SHALL install `lucide-react` as a dependency for iconography.
7. THE Scaffolding_Service SHALL install Zustand as a dependency for ephemeral client-side session state management.
8. THE Scaffolding_Service SHALL establish the following top-level directory structure: `app/`, `components/`, `lib/`, `types/`, `prisma/`.
9. THE Scaffolding_Service SHALL configure ESLint and Prettier with rules enforcing the project's code style conventions (named exports, no `any`, `async/await` preference).
10. THE Scaffolding_Service SHALL provide an `.env.local.example` file listing all four Env_Config variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL`, `DIRECT_URL`) with placeholder values and inline documentation.
11. IF a required Env_Config variable is absent at application startup, THEN THE application SHALL throw a descriptive error identifying the missing variable and SHALL NOT start.

---

### Requirement 2: Supabase Project Initialisation

**User Story:** As a developer, I want the Supabase project configured and connected to the Next.js application, so that database, auth, and realtime services are available for all features.

#### Acceptance Criteria

1. THE Supabase_Project SHALL have Email/Password authentication enabled as the primary sign-in method.
2. WHERE Google SSO is required, THE Supabase_Project SHALL have the Google OAuth provider configured with the correct redirect URIs for both local development and production environments.
3. THE Supabase_Project SHALL have Supabase Realtime enabled on the `retro_cards` table to support live card creation and upvoting.
4. THE Supabase_Project SHALL have a Supabase Storage bucket named `avatars` created with public read access and owner-scoped write access.
5. THE Scaffolding_Service SHALL document the steps to connect to the hosted Supabase_Project in the project `README.md`, including how to obtain the four Env_Config variable values from the Supabase dashboard.

---

### Requirement 3: Database Schema — Prisma Models

**User Story:** As a developer, I want all core SprintSync data models defined in the Prisma_Schema with correct fields, types, relations, and constraints, so that every feature has a reliable, type-safe data layer to build on.

#### Acceptance Criteria

1. THE Prisma_Schema SHALL be located at `prisma/schema.prisma` and SHALL configure the `postgresql` datasource provider with `url` set to `DATABASE_URL` and `directUrl` set to `DIRECT_URL`.
2. THE Prisma_Schema SHALL define a `Team` model with fields: `id` (String, UUID, primary key, default `uuid()`), `name` (String), `createdAt` (DateTime, default `now()`), and a relation to multiple `Sprint` records and multiple `team_members` rows.
3. THE Prisma_Schema SHALL define a `Sprint` model with fields: `id` (String, UUID, primary key, default `uuid()`), `teamId` (String, foreign key to `Team`), `sprintNumber` (Int), `goal` (String, nullable), `status` (String, default `'draft'`), `startDate` (DateTime, nullable), `endDate` (DateTime, nullable), `createdAt` (DateTime, default `now()`). The `status` field SHALL accept the values `'draft'`, `'active'`, and `'completed'`.
4. THE Prisma_Schema SHALL define a `SprintReview` model with fields: `id` (String, UUID, primary key, default `uuid()`), `sprintId` (String, unique, foreign key to `Sprint`), `incrementNotes` (String, nullable, mapped to Text), `stakeholderFeedback` (String, nullable, mapped to Text), `acceptedStories` (Int, nullable), `createdAt` (DateTime, default `now()`).
5. THE Prisma_Schema SHALL define a `RetroBoard` model with fields: `id` (String, UUID, primary key, default `uuid()`), `sprintId` (String, unique, foreign key to `Sprint`), `status` (String, default `'collecting'`), `createdAt` (DateTime, default `now()`). The `status` field SHALL accept the values `'collecting'`, `'grouping'`, `'voting'`, `'discussing'`, and `'closed'`.
6. THE Prisma_Schema SHALL define a `RetroCard` model with fields: `id` (String, UUID, primary key, default `uuid()`), `boardId` (String, foreign key to `RetroBoard`), `authorId` (String, nullable — for anonymous card support), `category` (String — values `'Start'`, `'Stop'`, `'Continue'`), `content` (String, mapped to Text), `votes` (Int, default 0), `createdAt` (DateTime, default `now()`).
7. THE Prisma_Schema SHALL define an `ActionItem` model with fields: `id` (String, UUID, primary key, default `uuid()`), `sprintId` (String, foreign key to `Sprint`), `assigneeId` (String, nullable), `description` (String, mapped to Text), `status` (String — values `'todo'`, `'in_progress'`, `'done'`), `createdAt` (DateTime, default `now()`).
8. THE Schema SHALL include a `profiles` table (managed outside Prisma via Supabase Auth triggers) with columns: `id` (uuid, primary key, references `auth.users(id)` on delete cascade), `display_name` (text, not null, length 1–50), `avatar_url` (text, nullable), `created_at` (timestamptz, not null, default `now()`). This table stores Supabase Auth user display data and is queried via the Supabase_Client.
9. THE Schema SHALL include a `team_members` join table (managed outside Prisma via Supabase RLS-aware queries) with columns: `team_id` (uuid, references `teams(id)` on delete cascade), `user_id` (uuid, references `auth.users(id)` on delete cascade), `role` (text, not null, check `role IN ('facilitator', 'member')`), `joined_at` (timestamptz, not null, default `now()`), with a composite primary key on `(team_id, user_id)`.
10. THE Prisma_Schema SHALL define all foreign key relations with explicit referential actions; IF a parent record is deleted, THEN the cascade behaviour SHALL be applied automatically without requiring application-level logic.

---

### Requirement 4: Database Indexes

**User Story:** As a developer, I want performance-critical query paths covered by database indexes, so that the application remains responsive as data volumes grow.

#### Acceptance Criteria

1. THE Prisma_Schema SHALL include an index on `Sprint.teamId` to support efficient sprint lookups by team.
2. THE Prisma_Schema SHALL include an index on `RetroBoard.sprintId` to support efficient board lookups by sprint.
3. THE Prisma_Schema SHALL include an index on `RetroCard.boardId` to support efficient card lookups by board.
4. THE Prisma_Schema SHALL include a composite index on `RetroCard(boardId, category)` to support efficient per-column card queries on the retro board.
5. THE Prisma_Schema SHALL include an index on `ActionItem.sprintId` to support efficient action item lookups by sprint.
6. THE Prisma_Schema SHALL include an index on `ActionItem.assigneeId` to support efficient lookups of items assigned to a specific user.
7. THE Schema SHALL include an index on `team_members(user_id)` to support efficient team membership lookups for a given user.

---

### Requirement 5: Row-Level Security Policies

**User Story:** As a system operator, I want RLS policies active on every Supabase table, so that users can only access data belonging to their own teams and no cross-team data leakage is possible at the database layer.

#### Acceptance Criteria

1. THE Schema SHALL enable RLS on all tables: `profiles`, `teams`, `team_members`, `sprints`, `sprint_reviews`, `retro_boards`, `retro_cards`, and `action_items`.
2. THE RLS_Policy on `profiles` SHALL permit a user to select and update only the row where `id = auth.uid()`; inserts SHALL be permitted only when `id = auth.uid()`.
3. THE RLS_Policy on `teams` SHALL permit a user to select only teams where the user has a corresponding row in `team_members`; inserts SHALL be permitted for any authenticated user (team creation); updates and deletes SHALL be permitted only for users with `role = 'facilitator'` in that team.
4. THE RLS_Policy on `team_members` SHALL permit a user to select rows for any team they belong to; inserts SHALL be permitted for facilitators of the target team; deletes SHALL be permitted for facilitators of the target team or for the user removing themselves.
5. THE RLS_Policy on `sprints` SHALL permit a user to select, insert, update, and delete Sprint records only for teams where the user has a row in `team_members`.
6. THE RLS_Policy on `sprint_reviews` SHALL permit a user to select, insert, and update SprintReview records only for sprints belonging to teams where the user has a row in `team_members`.
7. THE RLS_Policy on `retro_boards` SHALL permit a user to select, insert, and update RetroBoard records only for sprints belonging to teams where the user has a row in `team_members`.
8. THE RLS_Policy on `retro_cards` SHALL permit a user to select RetroCard records only for boards belonging to sprints of teams where the user has a row in `team_members`; inserts and updates SHALL be permitted under the same team membership condition.
9. THE RLS_Policy on `action_items` SHALL permit a user to select, insert, update, and delete ActionItem records only for sprints belonging to teams where the user has a row in `team_members`.
10. IF an authenticated user attempts a database operation that violates an RLS_Policy, THEN the database SHALL return an empty result set for SELECT operations and an error for INSERT, UPDATE, or DELETE operations, without revealing the existence of the restricted rows.
11. THE Scaffolding_Service SHALL verify that RLS is enabled on all tables as part of the local development setup validation; IF any table is found without RLS enabled, THEN the validation SHALL report the table name and fail.
12. WHILE using the Prisma_Client for server-side admin operations, THE application SHALL NOT bypass RLS for user-facing queries; user-facing queries SHALL use the Supabase_Client so that RLS policies are enforced at the database layer.

---

### Requirement 6: Prisma Client Singleton

**User Story:** As a developer, I want a globally shared Prisma client instance, so that Next.js hot-reloading does not create multiple database connections during development.

#### Acceptance Criteria

1. THE Scaffolding_Service SHALL create `lib/prisma.ts` exporting a single Prisma_Client instance using the `globalThis` pattern to prevent multiple instantiations during Next.js hot-reloading in development.
2. WHILE the application is running in production, THE `lib/prisma.ts` module SHALL instantiate exactly one Prisma_Client instance per process.
3. WHILE the application is running in development with hot-reloading active, THE `lib/prisma.ts` module SHALL reuse the existing Prisma_Client instance stored on `globalThis` rather than creating a new connection on each module reload.
4. THE Prisma_Client instance SHALL be configured to read `DATABASE_URL` from the environment; IF `DATABASE_URL` is absent, THEN the module SHALL throw a descriptive error at startup.

---

### Requirement 7: Supabase Auth Configuration

**User Story:** As a developer, I want Supabase Auth correctly wired into the Next.js application using `@supabase/ssr`, so that session management, route protection, and server-side auth operations work correctly across all rendering contexts.

#### Acceptance Criteria

1. THE Scaffolding_Service SHALL create `lib/supabase/server.ts` exporting a `createServerClient` factory function that constructs a Supabase server client using cookies from the current request context, compatible with Next.js App Router Server Components and Route Handlers.
2. THE Scaffolding_Service SHALL create `lib/supabase/client.ts` exporting a `createBrowserClient` factory function that constructs a Supabase browser client for use in Client Components, real-time subscriptions, and auth operations.
3. THE Scaffolding_Service SHALL create `middleware.ts` at the project root that intercepts every request, refreshes the Supabase session if the access token is expired, and redirects unauthenticated users away from protected routes to `/auth?redirect=<original_url>`.
4. WHEN the Middleware processes a request from an authenticated user to `/auth`, THE Middleware SHALL redirect the user to `/teams`.
5. THE Middleware SHALL define the protected route matcher to cover all routes under `/teams`, `/account`, and any other authenticated paths, while excluding `/auth`, `/api/auth`, and Next.js static asset paths.
6. IF the Supabase server client is instantiated outside of a valid request context (e.g., in a build-time script), THEN the factory function SHALL throw a descriptive error rather than returning a misconfigured client.

---

### Requirement 8: Team Management

**User Story:** As an authenticated user, I want to create teams and view the teams I belong to, so that I can organise my colleagues into a shared workspace for sprint activities.

#### Acceptance Criteria

1. WHEN an authenticated user navigates to `/teams`, THE Teams_Page SHALL display all teams the user belongs to, showing each team's `name` and the user's `role` within that team.
2. WHILE an authenticated user belongs to no teams, THE Teams_Page SHALL display an empty-state message and a call-to-action to create a new team.
3. WHEN an authenticated user submits the Team_Form with a valid `name`, THE Team_Service SHALL persist a new Team record and SHALL insert a `team_members` row linking the creating user to the new team with `role = 'facilitator'`.
4. THE Validator SHALL require `name` to be a non-empty string of at most 100 characters; IF the name is empty or exceeds 100 characters, THEN THE Team_Form SHALL display a field-level error message.
5. WHEN a team is successfully created, THE Teams_Page SHALL display the new team in the list without requiring a full page reload.
6. WHEN a team is successfully created, THE Teams_Page SHALL display a toast notification confirming the team was created.
7. WHEN an authenticated user clicks a team on the Teams_Page, THE Teams_Page SHALL navigate the user to `/teams/[teamId]/dashboard`.
8. IF the Team_Service returns an error during team creation, THEN THE Team_Form SHALL display a descriptive error message and SHALL retain the user's entered data.
9. THE Teams_Page SHALL fetch team data using the Supabase server client in a Server Component on initial page load.
10. IF an unauthenticated user attempts to access the Teams_Page, THEN THE Middleware SHALL redirect the user to `/auth`.

---

### Requirement 9: Team Member Invitation

**User Story:** As a facilitator, I want to invite other Esoft team members to my team by email, so that they can participate in sprints and retrospectives.

#### Acceptance Criteria

1. WHEN a facilitator navigates to a team's settings page, THE page SHALL display a form to invite a user by `email` address.
2. WHEN a facilitator submits the invitation form with a valid `email`, THE Team_Service SHALL look up the `profiles` record associated with that email via `auth.users` and SHALL insert a `team_members` row with `role = 'member'` if the user exists and is not already a member.
3. THE Validator SHALL require `email` to be a non-empty string in valid email format; IF the email is empty or malformed, THEN the invitation form SHALL display a field-level error message.
4. IF the invited email does not correspond to an existing SprintSync account, THEN THE Team_Service SHALL return a descriptive error and the invitation form SHALL display a message indicating the user was not found.
5. IF the invited user is already a member of the team, THEN THE Team_Service SHALL return a descriptive error and the invitation form SHALL display a message indicating the user is already a member.
6. WHEN a user is successfully added to the team, THE page SHALL display a toast notification confirming the invitation.
7. IF a non-facilitator attempts to invite a user to a team, THEN THE Team_Service SHALL reject the request and return a descriptive authorisation error.

---

### Requirement 10: Data Integrity and Consistency

**User Story:** As a system operator, I want the database schema to enforce data integrity constraints, so that invalid or inconsistent data cannot be persisted regardless of application-layer behaviour.

#### Acceptance Criteria

1. THE Prisma_Schema SHALL enforce all relation constraints at the database level; IF an application attempts to insert or update a row that violates a foreign key constraint, THEN the database SHALL reject the operation and return an error.
2. THE Prisma_Schema SHALL enforce all unique constraints (e.g., `sprintId` on `SprintReview`, `sprintId` on `RetroBoard`) at the database level.
3. THE Schema SHALL enforce all `NOT NULL` constraints defined in Requirement 3 at the database level.
4. FOR ALL valid Prisma_Schema definitions, running `npx prisma db push` against a clean database and then running it again SHALL produce the same final schema state (idempotent schema synchronisation).
5. THE Prisma_Schema SHALL use UUID primary keys (via `@default(uuid())`) for all Prisma-managed models; no sequential integer primary keys SHALL be used.
6. THE Schema SHALL enforce all `CHECK` constraints on the `profiles` and `team_members` tables (managed outside Prisma) at the database level; IF an application attempts to insert or update a row that violates a constraint, THEN the database SHALL reject the operation and return an error.

---

### Requirement 11: Local Development and Developer Experience

**User Story:** As a developer, I want a smooth local development setup with clear documentation, so that any team member can get the project running from scratch in a single session.

#### Acceptance Criteria

1. THE Scaffolding_Service SHALL provide a `README.md` at the project root documenting: prerequisites (Node.js version, required environment variables), environment variable setup (including where to find each value in the Supabase dashboard), Prisma schema push steps (`npx prisma db push`), Prisma migration steps (`npx prisma migrate dev`), and Next.js development server startup.
2. THE Scaffolding_Service SHALL provide a `package.json` with scripts for: `dev` (start Next.js dev server), `build` (production build), `lint` (ESLint), `type-check` (TypeScript compiler check), `db:push` (run `prisma db push` to sync schema to the database), `db:migrate` (run `prisma migrate dev` to generate and apply a named migration), and `db:generate` (run `prisma generate` to regenerate the Prisma_Client after schema changes).
3. THE Scaffolding_Service SHALL provide a seed script with representative data covering at least one Team, two Team_Members (one facilitator, one member), one Sprint, one RetroBoard, two RetroCards, and one ActionItem, to support local development and manual testing.
4. THE `db:generate` script SHALL be documented in `README.md` and SHALL be run whenever the Prisma_Schema changes to keep the generated Prisma_Client in sync.
5. THE Scaffolding_Service SHALL configure a `.gitignore` that excludes `.env.local`, `node_modules/`, `.next/`, and any generated Prisma artefacts that should not be committed, from version control.
6. THE `README.md` SHALL document the distinction between `db:push` (for rapid development iteration without migration history) and `db:migrate` (for generating versioned migration files for production deployments).
