# Tasks: Sprint Dashboard & Review Management

## Task List

- [ ] 1. Database schema and migrations
  - [ ] 1.1 Write and apply Supabase migration: create `sprints` table with constraints (`end_date > start_date`, `sprint_number > 0`, `UNIQUE(team_id, sprint_number)`) and RLS policies
  - [ ] 1.2 Write and apply Supabase migration: create partial unique index `sprints_one_active_per_team` on `sprints(team_id) WHERE status = 'active'`
  - [ ] 1.3 Write and apply Supabase migration: create `sprint_reviews` table with constraints (`accepted_stories_count >= 0`, `UNIQUE(sprint_id)`) and RLS policies
  - [ ] 1.4 Write and apply Supabase migration: create `complete_sprint_with_review` RPC function (upserts review + transitions sprint status atomically, raises `SPRINT_NOT_ACTIVE` if sprint is not active)
  - [ ] 1.5 Create `types/sprint.ts` with `Sprint`, `SprintReview`, `SprintStatus`, `SprintError`, `SprintErrorCode`, `CreateSprintData`, `UpsertReviewData`, `SprintResult`, `ReviewResult` types

- [ ] 2. Validator (`lib/sprint/validators.ts`)
  - [ ] 2.1 Implement `validateGoal` — non-empty, non-whitespace-only string
  - [ ] 2.2 Implement `validateStartDate` — non-empty, valid ISO date string
  - [ ] 2.3 Implement `validateEndDate(value, startDate)` — non-empty, valid ISO date, strictly after `startDate`
  - [ ] 2.4 Implement `validateSprintNumber` — positive integer (> 0, no decimals)
  - [ ] 2.5 Implement `validateIncrementNotes` — non-empty, non-whitespace-only string
  - [ ] 2.6 Implement `validateAcceptedStoriesCount` — non-negative integer (>= 0, no decimals)

- [ ] 3. Sprint_Service (`lib/sprint/service.ts`)
  - [ ] 3.1 Implement `getSprintsForTeam(teamId)` — fetch all sprints for the team using server client, ordered by `sprint_number` descending
  - [ ] 3.2 Implement `getActiveSprint(teamId)` — fetch the single sprint with `status = 'active'` for the team, or return `null`
  - [ ] 3.3 Implement `getCompletedSprints(teamId)` — fetch all sprints with `status = 'completed'` for the team, ordered by `sprint_number` descending
  - [ ] 3.4 Implement `getSprintById(sprintId, teamId)` — fetch sprint by id scoped to teamId; return `null` if not found or not belonging to team
  - [ ] 3.5 Implement `getSprintReview(sprintId)` — fetch the sprint_reviews record for the sprint, or return `null`
  - [ ] 3.6 Implement `createSprint(teamId, data)` — validate inputs, insert sprint record; map DB errors (unique constraint on sprint_number → `SPRINT_NUMBER_DUPLICATE`, partial index violation → `ACTIVE_SPRINT_EXISTS`) to `SprintError`
  - [ ] 3.7 Implement `completeSprintWithReview(sprintId, reviewData)` — call `complete_sprint_with_review` RPC; map RPC errors (`SPRINT_NOT_ACTIVE` → `SprintErrorCode`) to `SprintError`; return updated sprint and review on success

- [ ] 4. Route Handlers
  - [ ] 4.1 Create `app/api/teams/[teamId]/sprints/route.ts` — POST handler: authenticate request, verify user is a member of `teamId` (403 if not), run Validator on body, call `createSprint`, return `{ data: Sprint }` on success or `{ error: SprintError }` with appropriate HTTP status
  - [ ] 4.2 Create `app/api/teams/[teamId]/sprints/[sprintId]/reviews/route.ts` — POST handler: authenticate request, verify user is a member of `teamId` (403 if not), verify `sprintId` belongs to `teamId` (404 if not), run Validator on body, call `completeSprintWithReview`, return `{ data: { review, sprint } }` on success or `{ error: SprintError }` with appropriate HTTP status

- [ ] 5. Dashboard page and components
  - [ ] 5.1 Create `app/teams/[teamId]/dashboard/page.tsx` — Server Component: fetch active sprint via `getActiveSprint` and completed sprints via `getCompletedSprints`; pass data to `ActiveSprintSection` and `CompletedSprintsSection`; redirect to `/auth` if unauthenticated (handled by middleware)
  - [ ] 5.2 Create `components/sprint/SprintCard.tsx` — Client Component: renders `sprint_number`, `goal`, `status`, `start_date`, `end_date`; wraps in a link navigating to `/teams/[teamId]/sprints/[sprintId]`
  - [ ] 5.3 Create `components/sprint/ActiveSprintSection.tsx` — Client Component: renders `SprintCard` for the active sprint if present; renders empty-state prompt with CTA to open `SprintForm` if no active sprint exists
  - [ ] 5.4 Create `components/sprint/CompletedSprintsSection.tsx` — Client Component: renders a responsive grid of `SprintCard` components for completed sprints; renders empty-state message if none exist
  - [ ] 5.5 Create `components/sprint/SprintForm.tsx` — Client Component: controlled form with `goal`, `start_date`, `end_date`, `sprint_number` fields; client-side validation using Validator; POST to `/api/teams/[teamId]/sprints`; display field-level errors inline; show toast on success; refresh dashboard data on success without full page reload; retain form data on error

- [ ] 6. Sprint detail page and components
  - [ ] 6.1 Create `app/teams/[teamId]/sprints/[sprintId]/page.tsx` — Server Component: fetch sprint via `getSprintById` (call `notFound()` if null); fetch review via `getSprintReview`; render `SprintDetail`; conditionally render `ReviewForm` (if `status === 'active'`) or read-only review display (if `status === 'completed'`)
  - [ ] 6.2 Create `components/sprint/SprintDetail.tsx` — Client Component: renders `sprint_number`, `goal`, `status`, `start_date`, `end_date` fields
  - [ ] 6.3 Create `components/sprint/ReviewForm.tsx` — Client Component: controlled form with `increment_notes`, `stakeholder_feedback`, `accepted_stories_count` fields; client-side validation using Validator; POST to `/api/teams/[teamId]/sprints/[sprintId]/reviews`; display field-level errors inline; show toast on success; transition to read-only review display on success without full page reload; retain form data on error
  - [ ] 6.4 Implement read-only review display within `Sprint_Detail_Page` — renders `increment_notes`, `stakeholder_feedback`, and `accepted_stories_count` from the SprintReview record

- [ ] 7. Responsive layout
  - [ ] 7.1 Apply Tailwind responsive classes to `CompletedSprintsSection` — single-column on viewports < 768px (`grid-cols-1`), multi-column grid on viewports >= 768px (`md:grid-cols-2` or `md:grid-cols-3`)
  - [ ] 7.2 Apply Tailwind responsive classes to `Sprint_Detail_Page` layout — single-column on viewports < 768px; ensure `ReviewForm` fields and submit button are touch-friendly (adequate tap target sizes)

- [ ] 8. Unit and property-based tests
  - [ ] 8.1 Write unit tests for all Validator functions — boundary values (empty string, whitespace-only, `end_date === start_date`, `sprint_number = 0`, `accepted_stories_count = -1`) and representative valid inputs
  - [ ] 8.2 Write property test for Property 1: completed sprints ordered by sprint_number descending (fast-check, min 100 iterations, mocked Sprint_Service)
  - [ ] 8.3 Write property test for Property 2: sprint data display contains all required fields (fast-check, min 100 iterations, random Sprint objects)
  - [ ] 8.4 Write property test for Property 3: sprint review data display contains all required fields (fast-check, min 100 iterations, random SprintReview objects)
  - [ ] 8.5 Write property test for Property 4: sprint creation round-trip preserves all provided fields (fast-check, min 100 iterations, mocked Supabase)
  - [ ] 8.6 Write property test for Property 5: validators reject all empty and whitespace-only inputs (fast-check, min 100 iterations — generate whitespace strings for validateGoal and validateIncrementNotes)
  - [ ] 8.7 Write property test for Property 6: end date must be strictly after start date (fast-check, min 100 iterations — generate date pairs where end <= start and where end > start)
  - [ ] 8.8 Write property test for Property 7: sprint number must be a positive integer (fast-check, min 100 iterations — generate zero, negatives, floats, and positive integers)
  - [ ] 8.9 Write property test for Property 8: active sprint uniqueness invariant (fast-check, min 100 iterations, mocked Supabase returning conflict)
  - [ ] 8.10 Write property test for Property 9: cross-team sprint access returns null (fast-check, min 100 iterations, mocked Supabase returning no rows)
  - [ ] 8.11 Write property test for Property 10: review submission round-trip preserves all provided fields (fast-check, min 100 iterations, mocked RPC)
  - [ ] 8.12 Write property test for Property 11: review submission transitions sprint status to completed (fast-check, min 100 iterations, mocked RPC)
  - [ ] 8.13 Write property test for Property 12: accepted stories count must be a non-negative integer (fast-check, min 100 iterations)
  - [ ] 8.14 Write property test for Property 13: review upsert is idempotent (fast-check, min 100 iterations, mocked Supabase verifying ON CONFLICT upsert call)
  - [ ] 8.15 Write property test for Property 14: only active-to-completed status transition is permitted (fast-check, min 100 iterations, mocked RPC returning SPRINT_NOT_ACTIVE)

- [ ] 9. Integration and smoke tests
  - [ ] 9.1 Write integration test: sprint creation flow — POST to Route Handler with valid data; verify sprint record created with correct fields and `status = 'active'`
  - [ ] 9.2 Write integration test: active sprint conflict — POST sprint creation when team already has an active sprint; verify 409 response and no new record created
  - [ ] 9.3 Write integration test: review submission flow — POST to review Route Handler; verify sprint_reviews record upserted and sprint status transitions to `'completed'`
  - [ ] 9.4 Write integration test: review upsert — submit review twice for the same sprint; verify exactly one sprint_reviews record exists with the latest data
  - [ ] 9.5 Write integration test: RLS enforcement on sprints — attempt to read/write sprints for a team the user doesn't belong to; verify access is denied
  - [ ] 9.6 Write integration test: RLS enforcement on sprint_reviews — attempt to read/write sprint_reviews for another team's sprints; verify access is denied
  - [ ] 9.7 Write integration test: cross-team 404 — navigate to a sprintId belonging to another team; verify `getSprintById` returns null and page returns 404
  - [ ] 9.8 Write integration test: dashboard data scoping — verify `getSprintsForTeam` only returns sprints for the specified teamId
  - [ ] 9.9 Write smoke test: `sprints` table exists with correct schema, constraints, RLS policies, and partial unique index; `sprint_reviews` table exists with correct schema, constraints, and RLS policies; `complete_sprint_with_review` RPC function exists; unauthenticated requests to `/teams/[teamId]/dashboard` are redirected to `/auth`
