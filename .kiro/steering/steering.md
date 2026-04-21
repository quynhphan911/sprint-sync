---
inclusion: always
---

# SprintSync — Project Steering Guide

## Project Overview

SprintSync is an internal Agile tool for Esoft. It is a real-time web application for facilitating Sprint Reviews and Sprint Retrospectives, replacing generic whiteboards with a structured workspace for tracking increments, gathering feedback, running blameless retros, and managing action items.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Database / Real-time | Supabase (PostgreSQL + Realtime subscriptions) |
| Auth | Supabase Auth (Email/Password; optional Google SSO) |
| Client state | Zustand (active retro session state only) |

Always use the App Router conventions (`app/` directory, Server Components by default, Client Components only when interactivity or browser APIs are required).

## Code Style & Conventions

- TypeScript strict mode — no `any`, prefer explicit types and interfaces.
- Use named exports for components and utilities; default exports only for Next.js page/layout files.
- Co-locate component-specific types in the same file; shared types go in `types/`.
- Tailwind for all styling — no inline styles, no CSS modules unless absolutely necessary.
- Use shadcn/ui primitives before building custom UI components.
- Prefer `async/await` over `.then()` chains.
- Handle errors explicitly; never silently swallow exceptions.
- Use Supabase server client (from `@supabase/ssr`) in Server Components and Route Handlers; use the browser client only in Client Components.

## Data Models

Implement and respect these core entities:

- `Team` — id, name, created_at
- `Sprint` — id, team_id, sprint_number, goal, status (`active` | `completed`), start_date, end_date
- `SprintReview` — id, sprint_id, increment_notes, stakeholder_feedback, accepted_stories_count
- `RetroBoard` — id, sprint_id, status (`collecting` | `grouping` | `voting` | `discussing` | `closed`)
- `RetroCard` — id, board_id, author_id (nullable for anonymity), category (`Start` | `Stop` | `Continue`), content, votes (integer)
- `ActionItem` — id, sprint_id, assignee_id, description, status (`todo` | `in_progress` | `done`)

## Architecture Patterns

- **Real-time first:** Supabase Realtime subscriptions are required for `RetroCard` creation and upvoting — all connected clients must see updates instantly without a page refresh.
- **Server Components for data fetching:** Fetch Supabase data in Server Components or Route Handlers; pass data down as props.
- **Zustand for ephemeral session state:** Use Zustand only for transient UI state during an active retro session (e.g., optimistic card additions, local vote counts before sync).
- **Row-Level Security (RLS):** All Supabase tables must have RLS policies. Never bypass RLS in application code.
- **Anonymity support:** `RetroCard.author_id` is nullable by design — do not require it.

## Feature Scope (Implementation Order)

1. Project scaffolding, Supabase setup, auth, and Team management.
2. Team Dashboard and Sprint management (create/view sprints, Sprint Review input).
3. Real-time Retrospective Board — kanban columns (Start / Stop / Continue), card creation, upvoting, and board status transitions.
4. Action Items — convert retro cards to action items, assign owners, surface unresolved items on the next sprint dashboard.
5. Past Sprints archive.

## UX Rules

- Visual style: clean, minimal, professional — white/light-gray background with subtle primary color accents.
- Must be fully responsive (desktop for screen sharing, mobile/tablet for live card entry).
- Show toast notifications for all significant user actions (card added, action item assigned, etc.).
- Cards must be hidden from non-facilitators when the board is in `collecting` status; reveal on transition to `discussing`.

# Infrastructure & Database Implementation Spec

## 1. Goal
Set up the foundational infrastructure for SprintSync, including the Next.js project, database schema, ORM configuration, and environment variables. Do not build the frontend UI yet; focus strictly on backend connectivity and database initialization.

## 2. Tech Stack & Tooling
* **Database:** Supabase (PostgreSQL).
* **ORM:** Prisma (for type-safe database access and schema management).
* **Authentication:** Supabase Auth.
* **Environment:** Next.js 14+ (App Router).

## 3. Execution Steps for Kiro

### Step 1: Project Initialization
1. Initialize a new Next.js project with TypeScript, Tailwind CSS, and ESLint.
2. Install necessary dependencies: `@prisma/client`, `prisma` (dev dependency), `@supabase/supabase-js`, `zustand`, `lucide-react`.

### Step 2: Environment Configuration
1. Create a `.env.local` file template.
2. Add the following required keys (leave values blank for me to fill in):
   * `NEXT_PUBLIC_SUPABASE_URL=https://npcsdackcnhgpxfxmceo.supabase.co`
   * `NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_33vcjK4qLNNHNzBRbFN2Bw_bOhnyTYB`
   * `DATABASE_URL=postgresql://postgres:[Gi@han20_Nov_2019]@db.npcsdackcnhgpxfxmceo.supabase.co:5432/postgres` (For Prisma connection pooling)
   * `DIRECT_URL=postgresql://postgres:[Gi@han20_Nov_2019]@db.npcsdackcnhgpxfxmceo.supabase.co:6543/postgres` (For Prisma migrations)

### Step 3: Prisma Schema Definition
Create the `schema.prisma` file and implement the following models. Ensure proper foreign key relations and indexing for performance.

* **Team:** `id` (UUID), `name` (String), `createdAt` (DateTime).
* **Sprint:** `id` (UUID), `teamId` (Relation to Team), `sprintNumber` (Int), `goal` (String?), `status` (String - default 'draft'), `startDate` (DateTime?), `endDate` (DateTime?), `createdAt` (DateTime).
* **SprintReview:** `id` (UUID), `sprintId` (Relation to Sprint, unique), `incrementNotes` (Text?), `stakeholderFeedback` (Text?), `acceptedStories` (Int?), `createdAt` (DateTime).
* **RetroBoard:** `id` (UUID), `sprintId` (Relation to Sprint, unique), `status` (String - default 'collecting'), `createdAt` (DateTime).
* **RetroCard:** `id` (UUID), `boardId` (Relation to RetroBoard), `authorId` (String? - for anonymous support), `category` (String - 'start', 'stop', 'continue'), `content` (Text), `votes` (Int - default 0), `createdAt` (DateTime).
* **ActionItem:** `id` (UUID), `sprintId` (Relation to Sprint), `assigneeId` (String?), `description` (Text), `status` (String - 'todo', 'in_progress', 'done'), `createdAt` (DateTime).

### Step 4: Database Connection Setup
1. Create a utility file (e.g., `lib/prisma.ts`) to instantiate the Prisma client globally, preventing multiple instances during Next.js hot-reloading.
2. Create a utility file (e.g., `lib/supabase.ts`) to initialize the Supabase client for frontend real-time subscriptions and auth.

### Step 5: Verification
1. Generate the Prisma client.
2. Output instructions for me on how to run `npx prisma db push` or `npx prisma migrate dev` to sync this schema with my Supabase project.