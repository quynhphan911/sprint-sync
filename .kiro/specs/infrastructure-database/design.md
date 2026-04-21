# Design Document: Infrastructure & Database

## Overview

This document describes the technical design for the SprintSync foundational infrastructure. It covers the Next.js project structure, Prisma ORM schema, Supabase-managed tables, RLS policies, Supabase client factories, middleware, and the Team management UI.

The architecture uses **Prisma** for type-safe server-side database access and schema management, and the **Supabase client** for all user-facing queries so that Row-Level Security policies are enforced at the database layer. These two clients serve distinct roles and must never be swapped.

### Key Design Decisions

- **Prisma for schema + admin ops**: `prisma/schema.prisma` is the single source of truth for all Prisma-managed tables. `lib/prisma.ts` exposes a singleton client used only in server-side admin operations.
- **Supabase client for user-facing queries**: All queries that must respect RLS (team membership checks, retro card reads, etc.) use the Supabase server or browser client from `@supabase/ssr`.
- **`profiles` and `team_members` outside Prisma**: These tables reference `auth.users` directly and are managed via raw SQL + Supabase triggers. Prisma does not own them.
- **Two connection strings**: `DATABASE_URL` (port 5432, pooled) for Prisma runtime queries; `DIRECT_URL` (port 6543, direct) for `prisma migrate dev` and `prisma db push`.

---

## Architecture

### High-Level Component Flow

```mermaid
flowchart TD
    Browser["Browser (Client Components)"]
    ServerComp["Server Components / Route Handlers"]
    Middleware["middleware.ts"]
    TeamService["Team Service (lib/services/team-service.ts)"]
    PrismaClient["Prisma Client (lib/prisma.ts)"]
    SupabaseServer["Supabase Server Client (lib/supabase/server.ts)"]
    SupabaseBrowser["Supabase Browser Client (lib/supabase/client.ts)"]
    SupabaseAuth["Supabase Auth"]
    PostgreSQL["PostgreSQL (Supabase)"]

    Browser -->|"form submit / Server Action"| ServerComp
    Browser -->|"real-time subscriptions / auth"| SupabaseBrowser
    Middleware -->|"session refresh"| SupabaseServer
    ServerComp --> TeamService
    TeamService --> SupabaseServer
    TeamService --> PrismaClient
    SupabaseServer --> SupabaseAuth
    SupabaseServer --> PostgreSQL
    PrismaClient --> PostgreSQL
    SupabaseBrowser --> SupabaseAuth
```

### Directory Structure

```
sprint-sync/
├── app/
│   ├── layout.tsx                        ← Root layout
│   ├── page.tsx                          ← Root redirect → /teams
│   ├── auth/
│   │   └── page.tsx                      ← Auth page (handled by user-account-management spec)
│   └── teams/
│       ├── page.tsx                      ← Teams_Page (Server Component)
│       └── [teamId]/
│           ├── dashboard/
│           │   └── page.tsx              ← Team dashboard (future spec)
│           └── settings/
│               └── page.tsx              ← Team settings + invite form
├── components/
│   └── teams/
│       ├── TeamForm.tsx                  ← Team creation form (Client Component)
│       ├── TeamList.tsx                  ← Team list display (Client Component)
│       └── InviteMemberForm.tsx          ← Invite by email (Client Component)
├── lib/
│   ├── env.ts                            ← Env var validation + typed exports
│   ├── prisma.ts                         ← Prisma client singleton
│   └── supabase/
│       ├── server.ts                     ← createServerClient factory
│       └── client.ts                     ← createBrowserClient factory
├── types/
│   └── team.ts                           ← Team, TeamMember, TeamWithRole interfaces
├── prisma/
│   ├── schema.prisma                     ← Prisma schema (all 6 models)
│   ├── seed.ts                           ← Seed script
│   └── migrations/
│       └── supabase_managed_tables.sql   ← profiles, team_members, RLS policies
├── middleware.ts                         ← Session refresh + route protection
├── .env.local.example                    ← Env var template
├── .gitignore
├── tailwind.config.ts
├── tsconfig.json
├── eslint.config.mjs
└── README.md
```

---

## Prisma Schema

### `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model Team {
  id        String   @id @default(uuid())
  name      String
  createdAt DateTime @default(now()) @map("created_at")
  sprints   Sprint[]

  @@map("teams")
}

model Sprint {
  id           String        @id @default(uuid())
  teamId       String        @map("team_id")
  sprintNumber Int           @map("sprint_number")
  goal         String?
  status       String        @default("draft")
  startDate    DateTime?     @map("start_date")
  endDate      DateTime?     @map("end_date")
  createdAt    DateTime      @default(now()) @map("created_at")
  team         Team          @relation(fields: [teamId], references: [id], onDelete: Cascade)
  review       SprintReview?
  retroBoard   RetroBoard?
  actionItems  ActionItem[]

  @@unique([teamId, sprintNumber])
  @@index([teamId])
  @@map("sprints")
}

model SprintReview {
  id                 String   @id @default(uuid())
  sprintId           String   @unique @map("sprint_id")
  incrementNotes     String?  @db.Text @map("increment_notes")
  stakeholderFeedback String? @db.Text @map("stakeholder_feedback")
  acceptedStories    Int?     @map("accepted_stories")
  createdAt          DateTime @default(now()) @map("created_at")
  sprint             Sprint   @relation(fields: [sprintId], references: [id], onDelete: Cascade)

  @@map("sprint_reviews")
}

model RetroBoard {
  id        String      @id @default(uuid())
  sprintId  String      @unique @map("sprint_id")
  status    String      @default("collecting")
  createdAt DateTime    @default(now()) @map("created_at")
  sprint    Sprint      @relation(fields: [sprintId], references: [id], onDelete: Cascade)
  cards     RetroCard[]

  @@index([sprintId])
  @@map("retro_boards")
}

model RetroCard {
  id        String     @id @default(uuid())
  boardId   String     @map("board_id")
  authorId  String?    @map("author_id")
  category  String
  content   String     @db.Text
  votes     Int        @default(0)
  createdAt DateTime   @default(now()) @map("created_at")
  board     RetroBoard @relation(fields: [boardId], references: [id], onDelete: Cascade)

  @@index([boardId])
  @@index([boardId, category])
  @@map("retro_cards")
}

model ActionItem {
  id          String   @id @default(uuid())
  sprintId    String   @map("sprint_id")
  assigneeId  String?  @map("assignee_id")
  description String   @db.Text
  status      String   @default("todo")
  createdAt   DateTime @default(now()) @map("created_at")
  sprint      Sprint   @relation(fields: [sprintId], references: [id], onDelete: Cascade)

  @@index([sprintId])
  @@index([assigneeId])
  @@map("action_items")
}
```

**Sprint status values**: `'draft'` | `'active'` | `'completed'`
**RetroBoard status values**: `'collecting'` | `'grouping'` | `'voting'` | `'discussing'` | `'closed'`
**RetroCard category values**: `'Start'` | `'Stop'` | `'Continue'`
**ActionItem status values**: `'todo'` | `'in_progress'` | `'done'`

---

## Supabase-Managed Tables

These tables reference `auth.users` and cannot be owned by Prisma. They are created and managed via SQL in `prisma/migrations/supabase_managed_tables.sql`.

### `profiles` Table

```sql
CREATE TABLE IF NOT EXISTS profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 50),
  avatar_url   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
```

### `team_members` Table

```sql
CREATE TABLE IF NOT EXISTS team_members (
  team_id   uuid REFERENCES teams(id) ON DELETE CASCADE,
  user_id   uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role      text NOT NULL CHECK (role IN ('facilitator', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
```

---

## Row-Level Security Policies

All policies are applied in `prisma/migrations/supabase_managed_tables.sql`.

### `profiles`

```sql
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
```

### `team_members`

```sql
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
```

### `teams`

```sql
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
```

### `sprints`

```sql
ALTER TABLE sprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sprints_team_member" ON sprints
  FOR ALL USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );
```

### `sprint_reviews`

```sql
ALTER TABLE sprint_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sprint_reviews_team_member" ON sprint_reviews
  FOR ALL USING (
    sprint_id IN (
      SELECT id FROM sprints
      WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    )
  );
```

### `retro_boards`

```sql
ALTER TABLE retro_boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "retro_boards_team_member" ON retro_boards
  FOR ALL USING (
    sprint_id IN (
      SELECT id FROM sprints
      WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    )
  );
```

### `retro_cards`

```sql
ALTER TABLE retro_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "retro_cards_team_member" ON retro_cards
  FOR ALL USING (
    board_id IN (
      SELECT rb.id FROM retro_boards rb
      JOIN sprints s ON s.id = rb.sprint_id
      WHERE s.team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    )
  );
```

### `action_items`

```sql
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "action_items_team_member" ON action_items
  FOR ALL USING (
    sprint_id IN (
      SELECT id FROM sprints
      WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    )
  );
```

---

## Components and Interfaces

### Environment Validation (`lib/env.ts`)

```typescript
function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing required environment variable: ${key}`)
  return value
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  DATABASE_URL: requireEnv('DATABASE_URL'),
  DIRECT_URL: requireEnv('DIRECT_URL'),
}
```

### Prisma Singleton (`lib/prisma.ts`)

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

### Supabase Server Client (`lib/supabase/server.ts`)

```typescript
import { createServerClient as createSSRServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createServerClient() {
  const cookieStore = cookies()
  return createSSRServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

### Supabase Browser Client (`lib/supabase/client.ts`)

```typescript
import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr'

export function createBrowserClient() {
  return createSSRBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### Middleware (`middleware.ts`)

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  if (!user && pathname.startsWith('/teams')) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/auth'
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  if (user && pathname === '/auth') {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/teams'
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
}
```

### Team Service (`lib/services/team-service.ts`)

```typescript
import { createServerClient } from '@/lib/supabase/server'

export interface TeamWithRole {
  id: string
  name: string
  created_at: string
  role: 'facilitator' | 'member'
}

export interface TeamServiceError {
  code: 'NOT_FOUND' | 'ALREADY_MEMBER' | 'FORBIDDEN' | 'VALIDATION' | 'UNKNOWN'
  message: string
}

// Returns all teams the user belongs to with their role
export async function getTeamsForUser(userId: string): Promise<TeamWithRole[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('team_members')
    .select('role, teams(id, name, created_at)')
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({ ...row.teams, role: row.role }))
}

// Creates a team and adds the creator as facilitator
export async function createTeam(
  name: string,
  userId: string
): Promise<{ team: TeamWithRole } | { error: TeamServiceError }> {
  if (!name || name.trim().length === 0 || name.length > 100) {
    return { error: { code: 'VALIDATION', message: 'Team name must be 1–100 characters.' } }
  }
  const supabase = createServerClient()
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .insert({ name: name.trim() })
    .select()
    .single()
  if (teamError) return { error: { code: 'UNKNOWN', message: teamError.message } }
  const { error: memberError } = await supabase
    .from('team_members')
    .insert({ team_id: team.id, user_id: userId, role: 'facilitator' })
  if (memberError) return { error: { code: 'UNKNOWN', message: memberError.message } }
  return { team: { ...team, role: 'facilitator' } }
}

// Invites a user to a team by email (facilitator only)
export async function inviteUserToTeam(
  teamId: string,
  email: string,
  requestingUserId: string
): Promise<void | { error: TeamServiceError }> {
  const supabase = createServerClient()
  // Verify requester is facilitator
  const { data: membership } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', requestingUserId)
    .single()
  if (!membership || membership.role !== 'facilitator') {
    return { error: { code: 'FORBIDDEN', message: 'Only facilitators can invite members.' } }
  }
  // Look up user by email
  const { data: users, error: lookupError } = await supabase
    .rpc('get_user_id_by_email', { email })
  if (lookupError || !users?.length) {
    return { error: { code: 'NOT_FOUND', message: 'No SprintSync account found for that email.' } }
  }
  const targetUserId = users[0].id
  // Check existing membership
  const { data: existing } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('team_id', teamId)
    .eq('user_id', targetUserId)
    .single()
  if (existing) {
    return { error: { code: 'ALREADY_MEMBER', message: 'This user is already a member of the team.' } }
  }
  const { error: insertError } = await supabase
    .from('team_members')
    .insert({ team_id: teamId, user_id: targetUserId, role: 'member' })
  if (insertError) return { error: { code: 'UNKNOWN', message: insertError.message } }
}
```

### TypeScript Types (`types/team.ts`)

```typescript
export interface Team {
  id: string
  name: string
  created_at: string
}

export interface TeamMember {
  team_id: string
  user_id: string
  role: 'facilitator' | 'member'
  joined_at: string
}

export interface TeamWithRole extends Team {
  role: 'facilitator' | 'member'
}

export interface CreateTeamInput {
  name: string
}

export interface InviteMemberInput {
  email: string
}
```

---

## Page Structure

### Teams Page (`app/teams/page.tsx`)

Server Component. Fetches teams server-side and passes them to the `TeamList` client component.

```
Teams Page (Server Component)
├── Fetches teams via getTeamsForUser()
├── TeamList (Client Component)
│   ├── Maps teams → TeamCard components
│   └── Each card links to /teams/[teamId]/dashboard
├── TeamForm (Client Component) — create new team
└── Empty state — shown when teams array is empty
```

### Team Settings Page (`app/teams/[teamId]/settings/page.tsx`)

Server Component. Verifies user is authenticated and a team member, then renders the invite form.

```
Team Settings Page (Server Component)
├── Verifies membership via getTeamsForUser()
└── InviteMemberForm (Client Component) — visible to facilitators only
```

---

## Environment Configuration

### `.env.local.example`

```bash
# Supabase project URL — found in Supabase Dashboard → Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co

# Supabase anonymous key — found in Supabase Dashboard → Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Prisma connection pooling URL (port 5432) — found in Supabase Dashboard → Settings → Database → Connection string (URI mode)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.your-project-ref.supabase.co:5432/postgres

# Prisma direct URL for migrations (port 6543) — same as above but port 6543
DIRECT_URL=postgresql://postgres:[PASSWORD]@db.your-project-ref.supabase.co:6543/postgres
```

---

## Developer Tooling

### `package.json` Scripts

| Script | Command | Purpose |
|---|---|---|
| `dev` | `next dev` | Start Next.js development server |
| `build` | `next build` | Production build |
| `lint` | `next lint` | Run ESLint |
| `type-check` | `tsc --noEmit` | TypeScript type checking |
| `db:push` | `prisma db push` | Sync schema to DB (no migration history) |
| `db:migrate` | `prisma migrate dev` | Generate + apply versioned migration |
| `db:generate` | `prisma generate` | Regenerate Prisma client after schema changes |

### Seed Script (`prisma/seed.ts`)

Seeds the database with representative data for local development:
- 1 Team (`"Esoft Alpha"`)
- 2 Team Members (1 facilitator, 1 member) — requires two existing `auth.users` rows
- 1 Sprint (status `'active'`)
- 1 RetroBoard (status `'collecting'`)
- 2 RetroCards (one `'Start'`, one `'Stop'`)
- 1 ActionItem (status `'todo'`)

---

## Correctness Properties

### Property 1: Env validation fails fast on missing variables

*For any* application startup where one or more of the four required env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL`, `DIRECT_URL`) is absent, `lib/env.ts` must throw an error that names the missing variable before any database connection is attempted.

**Validates: Requirements 1.11, 6.4**

---

### Property 2: Prisma singleton is reused across hot-reloads

*For any* number of Next.js hot-reload cycles in development, the number of active `PrismaClient` instances must remain exactly 1 — the instance stored on `globalThis`.

**Validates: Requirements 6.1, 6.2, 6.3**

---

### Property 3: Team creation always assigns facilitator role

*For any* successful `createTeam` call with a valid name and authenticated user ID, the resulting `team_members` row for that user must have `role = 'facilitator'`.

**Validates: Requirement 8.3**

---

### Property 4: Team name validator rejects all out-of-range inputs

*For any* name string that is empty or exceeds 100 characters, `createTeam` must return a validation error and must not insert any row into `teams` or `team_members`.

**Validates: Requirement 8.4**

---

### Property 5: Invitation is rejected for non-facilitators

*For any* `inviteUserToTeam` call where the requesting user's role in the target team is `'member'` (not `'facilitator'`), the function must return a `FORBIDDEN` error and must not insert any row into `team_members`.

**Validates: Requirement 9.7**

---

### Property 6: Duplicate membership is rejected

*For any* `inviteUserToTeam` call where the target user is already a member of the team, the function must return an `ALREADY_MEMBER` error and must not insert a duplicate row into `team_members`.

**Validates: Requirement 9.5**

---

### Property 7: RLS prevents cross-team data access

*For any* authenticated user who is not a member of a given team, all SELECT queries on `sprints`, `retro_boards`, `retro_cards`, and `action_items` belonging to that team must return zero rows.

**Validates: Requirements 5.5, 5.7, 5.8, 5.9**

---

### Property 8: Prisma schema push is idempotent

*For any* valid `schema.prisma`, running `prisma db push` against a database that already has the schema applied must produce no changes and must not error.

**Validates: Requirement 10.4**

---

## Testing Strategy

### Unit Tests (Vitest)

- **`lib/env.ts`**: Assert throws with the correct variable name for each missing env var; assert returns typed values when all vars are present.
- **`lib/services/team-service.ts`**: Test `createTeam` validation (empty name, name > 100 chars, valid name); test `inviteUserToTeam` error paths (non-facilitator, already member, user not found) using mocked Supabase client.

### Property-Based Tests (fast-check)

**Property 3 — Team creation always assigns facilitator role**
Generate: valid team names (1–100 chars); assert `team_members` insert always uses `role = 'facilitator'` (mocked Supabase).

**Property 4 — Team name validator rejects all out-of-range inputs**
Generate: empty strings and strings of length > 100; assert `createTeam` returns validation error without DB calls.

**Property 5 — Invitation rejected for non-facilitators**
Generate: team/user combinations where requesting user has `role = 'member'`; assert `FORBIDDEN` error returned.

**Property 6 — Duplicate membership rejected**
Generate: scenarios where target user already exists in `team_members`; assert `ALREADY_MEMBER` error returned.

### Integration Tests

- **Schema push**: Run `prisma db push` against a test database; verify all tables, indexes, and constraints exist.
- **RLS enforcement**: Insert rows as user A; attempt to read them as user B (not a team member); verify zero rows returned.
- **Team creation flow**: Create a team via `createTeam`; verify `teams` row and `team_members` row with `role = 'facilitator'` both exist.
- **Middleware redirect**: Request `/teams` without a session; verify redirect to `/auth`.
- **Middleware auth redirect**: Request `/auth` with a valid session; verify redirect to `/teams`.

### Smoke Tests

- Supabase project is reachable (`NEXT_PUBLIC_SUPABASE_URL` resolves).
- `prisma generate` completes without errors.
- `prisma db push` completes without errors against the configured database.
- All 8 tables have RLS enabled (query `pg_tables` + `pg_policies`).

