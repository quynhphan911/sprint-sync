# SprintSync

An internal Agile tool for Esoft — real-time Sprint Reviews and Retrospectives.

## Prerequisites

- **Node.js** 18.17 or later
- A **Supabase** project (free tier works for development)
- The four environment variables listed in `.env.local.example`

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url>
cd sprint-sync
npm install
```

### 2. Set up environment variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in the four values. You can find them in the Supabase Dashboard:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Dashboard → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Dashboard → Settings → API → Project API keys → anon / public |
| `DATABASE_URL` | Dashboard → Settings → Database → Connection string → URI mode (port 5432) |
| `DIRECT_URL` | Same as `DATABASE_URL` but change the port to **6543** |

### 3. Push the Prisma schema to your database

```bash
npm run db:push
```

This syncs `prisma/schema.prisma` to your Supabase database without creating migration history files. Use this for rapid development iteration.

### 4. Apply Supabase-managed tables and RLS policies

Open the Supabase SQL Editor and run the contents of:

```
prisma/migrations/supabase_managed_tables.sql
```

This creates the `profiles` and `team_members` tables (which reference `auth.users`) and applies all Row-Level Security policies.

### 5. Generate the Prisma client

```bash
npm run db:generate
```

Run this whenever you change `prisma/schema.prisma`.

### 6. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Available Scripts

| Script | Command | Purpose |
|---|---|---|
| `npm run dev` | `next dev` | Start Next.js development server |
| `npm run build` | `next build` | Production build |
| `npm run lint` | `next lint` | Run ESLint |
| `npm run type-check` | `tsc --noEmit` | TypeScript type checking |
| `npm run db:push` | `prisma db push` | Sync schema to DB (no migration history) |
| `npm run db:migrate` | `prisma migrate dev` | Generate + apply versioned migration |
| `npm run db:generate` | `prisma generate` | Regenerate Prisma client after schema changes |
| `npm run seed` | `tsx prisma/seed.ts` | Seed database with development data |

### `db:push` vs `db:migrate`

- **`db:push`** — Directly syncs your `schema.prisma` to the database. Fast for local development iteration. Does not create migration history files. Use this during active development.
- **`db:migrate`** — Generates a versioned migration file and applies it. Creates a reproducible history of schema changes. Use this when preparing changes for production deployment.

---

## Connecting to Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Enable **Email/Password** authentication: Dashboard → Authentication → Providers → Email
3. Copy the four connection values into `.env.local` (see step 2 above)
4. Run `npm run db:push` to create the Prisma-managed tables
5. Run the SQL in `prisma/migrations/supabase_managed_tables.sql` to create `profiles`, `team_members`, and all RLS policies

---

## Project Structure

```
sprint-sync/
├── app/                    # Next.js App Router pages and layouts
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Root redirect → /teams
│   ├── auth/               # Auth page (user-account-management spec)
│   └── teams/              # Teams pages
├── components/             # Shared React components
│   └── teams/              # Team-specific components
├── lib/                    # Utility modules and service layer
│   ├── env.ts              # Environment variable validation
│   ├── prisma.ts           # Prisma client singleton
│   └── supabase/           # Supabase client factories
│       ├── server.ts       # Server client (Server Components / Route Handlers)
│       └── client.ts       # Browser client (Client Components)
├── types/                  # Shared TypeScript interfaces
├── prisma/                 # Prisma schema, migrations, and seed
│   ├── schema.prisma       # Single source of truth for DB schema
│   ├── seed.ts             # Development seed data
│   └── migrations/         # SQL for Supabase-managed tables + RLS
└── middleware.ts           # Session refresh + route protection
```

---

## Architecture Notes

- **Prisma** is used for type-safe server-side admin operations on Prisma-managed tables (`teams`, `sprints`, `sprint_reviews`, `retro_boards`, `retro_cards`, `action_items`).
- **Supabase client** is used for all user-facing queries so that Row-Level Security policies are enforced at the database layer.
- **`profiles` and `team_members`** reference `auth.users` and are managed outside Prisma via raw SQL.
- **Never use the Prisma client for user-facing queries** — it bypasses RLS by default.
