# Tasks: Real-Time Retrospective Board

## Task List

- [ ] 1. Database schema and migrations
  - [ ] 1.1 Write and apply Supabase migration: create `retro_boards` table with constraints (`UNIQUE(sprint_id)`, status CHECK, `timer_duration_minutes BETWEEN 1 AND 120`) and RLS policies (select/insert/update scoped to team members via sprint → team_members join)
  - [ ] 1.2 Write and apply Supabase migration: create `retro_cards` table with constraints (`votes >= 0`, `char_length(content) BETWEEN 1 AND 500`, category CHECK) and RLS policies (select/insert/update scoped to team members via retro_boards → sprints → team_members join)
  - [ ] 1.3 Write and apply Supabase migration: create `increment_card_votes` RPC function (atomically increments `votes` by 1 for a given card ID, raises `CARD_NOT_FOUND` if card does not exist, uses `SECURITY DEFINER`)
  - [ ] 1.4 Create `types/retro.ts` with `RetroBoard`, `RetroCard`, `BoardStatus`, `RetroCategory`, `RetroError`, `RetroErrorCode`, `CreateBoardData`, `CreateCardData`, `BoardResult`, `CardResult` types

- [ ] 2. Validator (`lib/retro/validators.ts`)
  - [ ] 2.1 Implement `validateContent` — non-empty, at least one non-whitespace character, at most 500 characters
  - [ ] 2.2 Implement `validateCategory` — must be exactly one of `'Start'`, `'Stop'`, or `'Continue'`
  - [ ] 2.3 Implement `validateTimerDuration` — positive integer in the range [1, 120]
  - [ ] 2.4 Implement `validateTimerExtension(currentRemainingMinutes, additionalMinutes)` — sum of current remaining and additional must not exceed 120 minutes

- [ ] 3. Board_Service (`lib/retro/service.ts`)
  - [ ] 3.1 Implement `getBoardForSprint(sprintId)` — fetch the retro_boards record for the given sprint_id using server client; return `null` if not found
  - [ ] 3.2 Implement `createBoard(sprintId, data)` — validate timer_duration_minutes if provided, insert retro_boards record with `status='collecting'` and `facilitator_id` set to the authenticated user's ID; set `timer_started_at = now()` when timer_duration_minutes is provided; map unique constraint violation to `BOARD_ALREADY_EXISTS` error
  - [ ] 3.3 Implement `getCardsForBoard(boardId, requestingUserId, isFacilitator)` — fetch retro_cards for the board; when board status is `'collecting'` and `isFacilitator` is false, filter to only cards where `author_id = requestingUserId`; for all other statuses or when `isFacilitator` is true, return all cards
  - [ ] 3.4 Implement `createCard(boardId, data, authorId)` — check board exists and is in an accepting state (not discussing/closed) and timer has not expired; validate content and category; insert retro_cards record with `votes=0` and `author_id` set to `authorId` (null for anonymous); map errors to appropriate `RetroErrorCode` values
  - [ ] 3.5 Implement `upvoteCard(cardId, boardId)` — call `increment_card_votes` RPC; map `CARD_NOT_FOUND` RPC error to `RetroError`; return updated card on success
  - [ ] 3.6 Implement `transitionBoardStatus(boardId, requestingUserId)` — verify `requestingUserId` matches `facilitator_id` (return `FORBIDDEN` if not); apply `TRANSITIONS` map to determine next status; update board status; return `INVALID_STATUS_TRANSITION` if no valid next status exists
  - [ ] 3.7 Implement `startTimer(boardId, durationMinutes)` — validate duration, update board with `timer_duration_minutes` and `timer_started_at = now()`
  - [ ] 3.8 Implement `cancelTimer(boardId)` — clear `timer_duration_minutes`, `timer_started_at`, and `timer_expired_at` on the board
  - [ ] 3.9 Implement `extendTimer(boardId, additionalMinutes)` — compute current remaining minutes from `timer_started_at` and `timer_duration_minutes`; validate extension does not exceed 120 minutes total; update `timer_duration_minutes` to reflect the extended duration
  - [ ] 3.10 Implement `recordTimerExpiry(boardId)` — set `timer_expired_at = now()` on the board

- [ ] 4. Retro_Store (`lib/retro/store.ts`)
  - [ ] 4.1 Define Zustand store with `board`, `cards` (keyed by `RetroCategory`), and `timerExpiresAt` state fields
  - [ ] 4.2 Implement `initialise(board, cards)` — populate store with server-fetched board and cards; group cards by category; compute `timerExpiresAt` from `timer_started_at` and `timer_duration_minutes`
  - [ ] 4.3 Implement `optimisticAddCard(card)` — prepend card to the correct category array in `cards`
  - [ ] 4.4 Implement `optimisticIncrementVote(cardId)` — find card by ID across all category arrays and increment its `votes` by 1
  - [ ] 4.5 Implement `handleCardInsert(card)` — add card to the correct category array if not already present (deduplication guard for optimistic updates)
  - [ ] 4.6 Implement `handleCardUpdate(card)` — find card by ID across all category arrays and replace it with the updated card (reconciles optimistic vote counts with confirmed DB values)
  - [ ] 4.7 Implement `handleBoardUpdate(board)` — replace the store's `board` with the updated board; recompute `timerExpiresAt` from updated timer fields

- [ ] 5. Route Handlers
  - [ ] 5.1 Create `app/api/teams/[teamId]/sprints/[sprintId]/retro/route.ts` — POST handler: authenticate request, verify user is a member of `teamId` (403 if not), verify `sprintId` belongs to `teamId` (404 if not), validate optional `timer_duration_minutes`, call `createBoard`, return `{ data: RetroBoard }` on success or `{ error: RetroError }` with appropriate HTTP status
  - [ ] 5.2 Create `app/api/teams/[teamId]/sprints/[sprintId]/retro/cards/route.ts` — POST handler: authenticate request, verify team membership and sprint ownership, validate `content` and `category`, call `createCard` with `authorId` set to null if `anonymous=true` or authenticated user ID if `anonymous=false`, return `{ data: RetroCard }` on success or `{ error: RetroError }` with appropriate HTTP status
  - [ ] 5.3 Create `app/api/teams/[teamId]/sprints/[sprintId]/retro/cards/[cardId]/votes/route.ts` — POST handler: authenticate request, verify team membership, call `upvoteCard`, return `{ data: RetroCard }` on success or `{ error: RetroError }` with appropriate HTTP status
  - [ ] 5.4 Create `app/api/teams/[teamId]/sprints/[sprintId]/retro/status/route.ts` — PATCH handler: authenticate request, verify team membership, call `transitionBoardStatus` with authenticated user ID, return `{ data: RetroBoard }` on success or `{ error: RetroError }` with appropriate HTTP status
  - [ ] 5.5 Create `app/api/teams/[teamId]/sprints/[sprintId]/retro/timer/route.ts` — POST handler (start timer): authenticate, verify facilitator, validate duration, call `startTimer`; PATCH handler (extend timer): authenticate, verify facilitator, validate extension, call `extendTimer`; DELETE handler (cancel timer): authenticate, verify facilitator, call `cancelTimer`; all return `{ data: RetroBoard }` on success or `{ error: RetroError }` with appropriate HTTP status

- [ ] 6. Retro_Page and RetroBoard component
  - [ ] 6.1 Create `app/teams/[teamId]/sprints/[sprintId]/retro/page.tsx` — Server Component: fetch board via `getBoardForSprint`; if no board exists, render board creation UI (Start Retrospective CTA with optional timer input); if board exists, fetch cards via `getCardsForBoard` (passing authenticated user ID and facilitator check); render `RetroBoard` with initial board and cards as props; call `notFound()` if sprint does not belong to team
  - [ ] 6.2 Create `components/retro/RetroBoard.tsx` — Client Component: initialise `Retro_Store` with server-fetched board and cards on mount; establish Supabase Realtime channel subscribed to INSERT/UPDATE on `retro_cards` (filtered by `board_id`) and UPDATE on `retro_boards` (filtered by `id`); wire Realtime events to store handlers; unsubscribe on unmount; display reconnection indicator on subscription status change; render `RetroColumn` for each category, `BoardStatusBadge`, `StatusTransitionButton` (facilitator only), and `CountdownDisplay` / `TimerControls` when timer is active

- [ ] 7. Card components
  - [ ] 7.1 Create `components/retro/RetroColumn.tsx` — Client Component: renders column header with category label; renders list of `RetroCard` components for the category from the store; renders `CardForm` when card creation is permitted (board status in {collecting, grouping, voting} and timer not expired)
  - [ ] 7.2 Create `components/retro/RetroCard.tsx` — Client Component: renders card `content`; renders author attribution as "Anonymous" when `author_id` is null, or omits attribution for non-facilitators; renders `votes` count when board status is `'voting'`, `'discussing'`, or `'closed'`; renders upvote button when board status is `'voting'`; upvote button calls POST votes Route Handler, calls `optimisticIncrementVote` before the request, shows toast on success
  - [ ] 7.3 Create `components/retro/CardForm.tsx` — Client Component: controlled textarea for `content` (max 500 chars with character counter); category selector (Start / Stop / Continue); anonymity toggle (opt-in, defaults to off); client-side validation using Validator; POST to cards Route Handler; call `optimisticAddCard` before the request; display field-level errors inline; show toast on success; retain form data on error; clear and focus textarea on success

- [ ] 8. Board control components
  - [ ] 8.1 Create `components/retro/BoardStatusBadge.tsx` — Client Component: renders the current `Board_Status` as a labelled badge with a phase-appropriate label (e.g., "Collecting", "Grouping", "Voting", "Discussing", "Closed")
  - [ ] 8.2 Create `components/retro/StatusTransitionButton.tsx` — Client Component: visible only when authenticated user is the facilitator and board status is not `'closed'`; displays the next phase label; PATCH to status Route Handler on click; show toast on success; show error toast on failure
  - [ ] 8.3 Create `components/retro/CountdownDisplay.tsx` — Client Component: reads `timerExpiresAt` from `Retro_Store`; computes remaining seconds as `(timerExpiresAt - now) / 1000`; renders in `MM:SS` format with zero-padded values; updates every second using `setInterval`; shows `00:00` when timer has expired; hidden when no timer is active
  - [ ] 8.4 Create `components/retro/TimerControls.tsx` — Client Component: visible only when authenticated user is the facilitator and a timer is active; renders "Cancel Timer" button (DELETE timer Route Handler) and "Extend Timer" button (opens input for additional minutes, PATCH timer Route Handler); show toast on success; validate extension input client-side using `validateTimerExtension`

- [ ] 9. Board initialisation UI
  - [ ] 9.1 Create board creation form within `Retro_Page` (or as a separate `BoardInitForm` Client Component): renders "Start Retrospective" heading; optional number input for timer duration in minutes (1–120); client-side validation using `validateTimerDuration`; POST to retro Route Handler on submit; display field-level error for invalid timer duration; show toast on success; update page to display the new board without full page reload

- [ ] 10. Board display and layout
  - [ ] 10.1 Apply Tailwind responsive classes to `RetroBoard` — three columns stacked vertically on viewports < 768px (`flex-col`), side-by-side on viewports >= 768px (`md:flex-row`)
  - [ ] 10.2 Apply sort order to `RetroColumn` — when board status is `'discussing'` or `'closed'`, sort cards by `votes` descending before rendering; for all other statuses, render in insertion order
  - [ ] 10.3 Ensure `RetroCard` and `CardForm` have touch-friendly tap target sizes (minimum 44×44px for interactive elements) for mobile card entry

- [ ] 11. Unit and property-based tests
  - [ ] 11.1 Write unit tests for all Validator functions — boundary values (empty string, whitespace-only content, content of exactly 500 chars, content of 501 chars, timer duration of 0, 1, 120, 121, non-integer) and representative valid inputs
  - [ ] 11.2 Write unit tests for `Board_Service.transitionBoardStatus` — test all valid transitions succeed, all invalid transitions return `INVALID_STATUS_TRANSITION`, and non-facilitator calls return `FORBIDDEN`
  - [ ] 11.3 Write unit tests for `Board_Service.getCardsForBoard` — test collecting phase filters non-facilitator to own cards, facilitator sees all cards, and post-collecting returns all cards
  - [ ] 11.4 Write unit tests for all `Retro_Store` actions — test `optimisticAddCard`, `optimisticIncrementVote`, `handleCardInsert`, `handleCardUpdate`, `handleBoardUpdate` with representative inputs
  - [ ] 11.5 Write property test for Property 1: board creation round-trip preserves all provided fields (fast-check, min 100 iterations, mocked Supabase)
  - [ ] 11.6 Write property test for Property 2: duplicate board creation is rejected (fast-check, min 100 iterations, mocked Supabase returning unique constraint violation)
  - [ ] 11.7 Write property test for Property 3: timer duration validator correctly classifies values (fast-check, min 100 iterations — generate values outside [1, 120] and integers in [1, 120])
  - [ ] 11.8 Write property test for Property 4: board state is correctly reflected in the UI (fast-check, min 100 iterations — generate RetroBoard objects with each status)
  - [ ] 11.9 Write property test for Property 5: card form availability matches board status and timer state (fast-check, min 100 iterations — generate boards in accepting and non-accepting states)
  - [ ] 11.10 Write property test for Property 6: card creation round-trip preserves all provided fields (fast-check, min 100 iterations, mocked Supabase)
  - [ ] 11.11 Write property test for Property 7: content validator correctly classifies values (fast-check, min 100 iterations — generate empty, whitespace-only, >500 char strings and valid strings)
  - [ ] 11.12 Write property test for Property 8: category validator correctly classifies values (fast-check, min 100 iterations — generate arbitrary strings and the three valid values)
  - [ ] 11.13 Write property test for Property 9: optimistic card addition places card in correct column (fast-check, min 100 iterations — generate RetroCard objects with varying categories)
  - [ ] 11.14 Write property test for Property 10: timer expiry rejects card creation (fast-check, min 100 iterations — generate boards with timer_expired_at set)
  - [ ] 11.15 Write property test for Property 11: realtime card insert event updates the correct column in the store (fast-check, min 100 iterations — generate RetroCard objects with varying categories)
  - [ ] 11.16 Write property test for Property 12: card visibility during collecting phase is enforced at the data layer (fast-check, min 100 iterations — generate boards in collecting status with cards from multiple authors)
  - [ ] 11.17 Write property test for Property 13: post-collecting transition reveals all cards (fast-check, min 100 iterations — generate boards with non-collecting statuses)
  - [ ] 11.18 Write property test for Property 14: status transition state machine enforces valid transitions only (fast-check, min 100 iterations — generate all (current_status, attempted_next_status) pairs)
  - [ ] 11.19 Write property test for Property 15: non-facilitator status transition is rejected (fast-check, min 100 iterations — generate boards with non-matching user IDs)
  - [ ] 11.20 Write property test for Property 16: board update event is reflected in the store (fast-check, min 100 iterations — generate RetroBoard objects with varying statuses and timer fields)
  - [ ] 11.21 Write property test for Property 17: upvote increments vote count by exactly one (fast-check, min 100 iterations — generate RetroCard objects with varying vote counts, mocked RPC)
  - [ ] 11.22 Write property test for Property 18: vote state management — optimistic update and reconciliation (fast-check, min 100 iterations — generate cards with varying vote counts and confirmed values)
  - [ ] 11.23 Write property test for Property 19: upvote control visibility matches board status (fast-check, min 100 iterations — generate boards with each status)
  - [ ] 11.24 Write property test for Property 20: concurrent vote increments produce no lost updates (fast-check, min 100 iterations — generate cards with initial vote count V and N concurrent calls, mocked atomic RPC)
  - [ ] 11.25 Write property test for Property 21: cards are rendered in the correct column (fast-check, min 100 iterations — generate sets of RetroCard objects with varying categories)
  - [ ] 11.26 Write property test for Property 22: cards are sorted by votes descending in discussing and closed phases (fast-check, min 100 iterations — generate sets of cards with varying vote counts)
  - [ ] 11.27 Write property test for Property 23: vote counts are displayed during voting phase (fast-check, min 100 iterations — generate RetroCard objects with varying vote counts)
  - [ ] 11.28 Write property test for Property 24: toast notifications are shown for all significant actions (fast-check, min 100 iterations — generate each action type)
  - [ ] 11.29 Write property test for Property 25: anonymous card author attribution renders as "Anonymous" (fast-check, min 100 iterations — generate RetroCard objects with author_id=null)
  - [ ] 11.30 Write property test for Property 26: anonymous card author_id is not exposed to non-facilitator clients (fast-check, min 100 iterations — generate anonymous cards)
  - [ ] 11.31 Write property test for Property 27: cross-team board_id is rejected during card creation (fast-check, min 100 iterations — generate card creation requests with board_ids from other teams, mocked RLS)
  - [ ] 11.32 Write property test for Property 28: countdown display renders remaining time in MM:SS format (fast-check, min 100 iterations — generate remaining durations from 1 to 7200 seconds)
  - [ ] 11.33 Write property test for Property 29: remaining time calculation uses server-authoritative timestamps (fast-check, min 100 iterations — generate (timer_started_at, timer_duration_minutes) pairs)
  - [ ] 11.34 Write property test for Property 30: timer extension validator correctly classifies values (fast-check, min 100 iterations — generate (currentRemainingMinutes, additionalMinutes) pairs)

- [ ] 12. Integration and smoke tests
  - [ ] 12.1 Write integration test: board creation flow — POST to Route Handler with valid data; verify retro_boards record created with status='collecting' and correct sprint_id
  - [ ] 12.2 Write integration test: duplicate board conflict — POST board creation when sprint already has a board; verify 409 response and no new record created
  - [ ] 12.3 Write integration test: card creation flow — POST to cards Route Handler with valid data; verify retro_cards record created with correct fields and votes=0
  - [ ] 12.4 Write integration test: card creation with timer expired — POST card creation when timer_expired_at is set; verify 400 response with TIMER_EXPIRED code
  - [ ] 12.5 Write integration test: upvote flow — POST to votes Route Handler; verify votes field incremented by 1 in DB
  - [ ] 12.6 Write integration test: status transition flow — PATCH status as facilitator; verify board status updated to next phase
  - [ ] 12.7 Write integration test: non-facilitator transition rejected — PATCH status as non-facilitator; verify 403 response
  - [ ] 12.8 Write integration test: invalid status transition rejected — PATCH status on a closed board; verify 400 response with INVALID_STATUS_TRANSITION code
  - [ ] 12.9 Write integration test: timer start flow — POST to timer Route Handler; verify timer_started_at and timer_duration_minutes set on board
  - [ ] 12.10 Write integration test: timer cancel flow — DELETE to timer Route Handler; verify timer fields cleared on board
  - [ ] 12.11 Write integration test: timer extend flow — PATCH to timer Route Handler; verify timer_duration_minutes updated correctly; verify 400 when extension would exceed 120 minutes
  - [ ] 12.12 Write integration test: RLS enforcement on retro_boards — attempt to read/write boards for a team the user doesn't belong to; verify access is denied
  - [ ] 12.13 Write integration test: RLS enforcement on retro_cards — attempt to read/write cards for another team's boards; verify access is denied
  - [ ] 12.14 Write integration test: card visibility in collecting phase — fetch cards as non-facilitator during collecting; verify only own cards returned
  - [ ] 12.15 Write integration test: card visibility post-collecting — fetch cards after status transitions to grouping; verify all cards returned
  - [ ] 12.16 Write integration test: Realtime subscription — insert a card and verify the subscription callback fires with the new card data
  - [ ] 12.17 Write smoke test: `retro_boards` table exists with correct schema, constraints, and RLS policies; `retro_cards` table exists with correct schema, constraints, and RLS policies; `increment_card_votes` RPC function exists; Supabase Realtime is enabled for both tables; unauthenticated requests to the Retro_Page are redirected to `/auth`
