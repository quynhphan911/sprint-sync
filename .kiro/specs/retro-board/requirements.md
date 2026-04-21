# Requirements Document

## Introduction

The Real-Time Retrospective Board feature provides Esoft teams with a structured, live workspace for running Sprint Retrospectives inside SprintSync. It introduces a kanban-style board with three columns (Start, Stop, Continue), supports anonymous card creation, real-time upvoting, and a facilitator-controlled board lifecycle (collecting → grouping → voting → discussing → closed). All connected clients receive updates instantly via Supabase Realtime subscriptions without requiring a page refresh.

## Glossary

- **RetroBoard**: The retrospective board entity, linked to a Sprint, with a `status` field controlling the current phase of the retrospective session.
- **RetroCard**: A card submitted by a participant on the RetroBoard, belonging to one of three categories: `Start`, `Stop`, or `Continue`.
- **Facilitator**: An authenticated team member with permission to transition the board status and manage the retrospective session.
- **Participant**: Any authenticated team member who can view the board and submit or upvote cards.
- **Board_Status**: The lifecycle phase of a RetroBoard — one of `collecting`, `grouping`, `voting`, `discussing`, or `closed`.
- **Category**: The kanban column a RetroCard belongs to — one of `Start`, `Stop`, or `Continue`.
- **Retro_Page**: The Next.js page rendered at `/teams/[teamId]/sprints/[sprintId]/retro`, hosting the RetroBoard UI.
- **Board_Service**: The server-side data access layer responsible for all RetroBoard and RetroCard database operations.
- **Realtime_Subscription**: A Supabase Realtime channel subscription that pushes database change events to connected browser clients.
- **Retro_Store**: The Zustand store managing ephemeral client-side state during an active retro session (optimistic card additions, local vote counts).
- **Card_Form**: The client-side form component used to submit a new RetroCard.
- **Validator**: The input validation logic applied before persisting RetroBoard or RetroCard data.
- **Timer**: An optional countdown associated with a RetroBoard that counts down from a facilitator-specified duration to zero during the `collecting` phase.
- **Timer_Service**: The server-side and client-side logic responsible for persisting timer state, broadcasting timer events, and enforcing timer-based card creation restrictions.
- **Countdown_Display**: The UI component that renders the remaining timer duration and is visible to all connected participants.

---

## Requirements

### Requirement 1: Board Initialisation

**User Story:** As a facilitator, I want to create a retrospective board for a sprint, so that the team has a dedicated space to run the retrospective.

#### Acceptance Criteria

1. WHEN a facilitator navigates to the Retro_Page for a sprint that has no existing RetroBoard, THE Retro_Page SHALL display a "Start Retrospective" call-to-action.
2. WHEN a facilitator activates the "Start Retrospective" action, THE Retro_Page SHALL provide an optional input field for the facilitator to specify a timer duration in minutes for the `collecting` phase.
3. WHEN a facilitator activates the "Start Retrospective" action, THE Board_Service SHALL create a new RetroBoard record linked to the `sprint_id` with `status` set to `collecting`, and SHALL persist the timer duration if provided.
4. THE Validator SHALL reject RetroBoard creation if a RetroBoard already exists for the given `sprint_id`; IF a duplicate is detected, THEN THE Board_Service SHALL return a descriptive error.
5. WHERE a timer duration is provided, THE Validator SHALL require the duration to be a positive integer between 1 and 120 minutes; IF the duration is invalid, THEN THE Board_Service SHALL reject the request and return a descriptive error.
6. WHEN a RetroBoard is successfully created, THE Retro_Page SHALL display the board with three empty columns labelled `Start`, `Stop`, and `Continue` without requiring a full page reload.
7. WHEN a participant navigates to the Retro_Page for a sprint that already has a RetroBoard, THE Retro_Page SHALL display the existing board in its current state.

---

### Requirement 2: Card Creation

**User Story:** As a participant, I want to add cards to the retrospective board, so that I can share my thoughts under the appropriate category.

#### Acceptance Criteria

1. WHILE the RetroBoard `status` is `collecting`, `grouping`, or `voting`, AND the Timer has not expired, THE Card_Form SHALL be available to all authenticated participants.
2. WHEN a participant submits the Card_Form with valid data, THE Board_Service SHALL persist a new RetroCard record with the provided `content`, `category`, `board_id`, and `author_id` (which MAY be null for anonymous submissions), and with `votes` initialised to `0`.
3. THE Validator SHALL require `content` to be a non-empty string of at most 500 characters before the Card_Form is submitted; IF the content is empty or exceeds 500 characters, THEN THE Card_Form SHALL display a field-level error message.
4. THE Validator SHALL require `category` to be one of `Start`, `Stop`, or `Continue`; IF an invalid category is provided, THEN THE Board_Service SHALL reject the request and return a descriptive error.
5. WHERE a participant chooses to submit anonymously, THE Board_Service SHALL persist the RetroCard with `author_id` set to `null`.
6. WHEN a RetroCard is successfully created, THE Retro_Store SHALL optimistically add the card to the local column before the Realtime_Subscription confirms the change.
7. IF the Board_Service returns an error during card creation, THEN THE Card_Form SHALL display a descriptive error message and SHALL retain the participant's entered data.
8. WHILE the RetroBoard `status` is `discussing` or `closed`, THE Card_Form SHALL be hidden and card creation SHALL be disabled.
9. WHEN the Timer expires, THE Card_Form SHALL be hidden and THE Board_Service SHALL reject any further card creation requests for the board, regardless of the current Board_Status.

---

### Requirement 3: Real-Time Card Synchronisation

**User Story:** As a participant, I want to see cards added by other team members appear instantly on my board, so that the session stays in sync without manual refreshes.

#### Acceptance Criteria

1. WHEN a participant opens the Retro_Page, THE Retro_Page SHALL establish a Realtime_Subscription to the `retro_cards` table scoped to the current `board_id`.
2. WHEN a RetroCard is inserted into the database by any client, THE Realtime_Subscription SHALL deliver the new card to all connected clients within the same board session.
3. WHEN the Realtime_Subscription delivers a new card event, THE Retro_Store SHALL update the local card list for the relevant column without requiring a page refresh.
4. WHEN a participant navigates away from the Retro_Page, THE Retro_Page SHALL unsubscribe from the Realtime_Subscription to prevent memory leaks.
5. IF the Realtime_Subscription connection is interrupted, THEN THE Retro_Page SHALL display a non-blocking reconnection indicator and SHALL attempt to re-establish the subscription automatically.
6. WHEN the Timer state changes (started, cancelled, extended, or expired), THE Realtime_Subscription SHALL deliver the timer event to all connected clients within the same board session so that the Countdown_Display remains consistent across all clients.

---

### Requirement 4: Card Visibility — Collecting Phase

**User Story:** As a facilitator, I want cards to be hidden from other participants during the collecting phase, so that participants submit their thoughts independently without being influenced by others.

#### Acceptance Criteria

1. WHILE the RetroBoard `status` is `collecting`, THE Retro_Page SHALL display each participant's own cards to that participant only, and SHALL NOT render other participants' cards.
2. WHILE the RetroBoard `status` is `collecting`, THE Retro_Page SHALL display each participant's own cards to the Facilitator in full.
3. WHILE the RetroBoard `status` is `collecting`, THE Board_Service SHALL enforce card visibility at the data layer by filtering RetroCards in queries so that non-facilitator clients only receive their own cards.
4. WHEN the RetroBoard `status` transitions away from `collecting`, THE Retro_Page SHALL reveal all cards to all participants without requiring a page refresh.

---

### Requirement 5: Board Status Transitions

**User Story:** As a facilitator, I want to advance the board through its lifecycle phases, so that I can guide the team from card collection through to discussion and closure.

#### Acceptance Criteria

1. THE Board_Service SHALL only permit the following `status` transitions for a RetroBoard: `collecting` → `grouping`, `grouping` → `voting`, `voting` → `discussing`, `discussing` → `closed`; all other transitions SHALL be rejected.
2. WHEN a facilitator triggers a status transition, THE Board_Service SHALL update the RetroBoard `status` to the next phase in the sequence.
3. IF a non-facilitator attempts to trigger a status transition, THEN THE Board_Service SHALL reject the request and return a descriptive authorisation error.
4. WHEN the RetroBoard `status` is updated, THE Realtime_Subscription SHALL deliver the status change event to all connected clients.
5. WHEN all connected clients receive a status change event, THE Retro_Page SHALL update the board UI to reflect the new phase without requiring a page refresh.
6. WHEN the RetroBoard `status` transitions to `closed`, THE Retro_Page SHALL display the board in a read-only state and SHALL hide all interactive controls.
7. WHILE the RetroBoard `status` is `closed`, THE Board_Service SHALL reject any further status transition requests and return a descriptive error.

---

### Requirement 6: Card Upvoting

**User Story:** As a participant, I want to upvote cards during the voting phase, so that the team can identify the most important topics to discuss.

#### Acceptance Criteria

1. WHILE the RetroBoard `status` is `voting`, THE Retro_Page SHALL display an upvote control on each visible RetroCard.
2. WHEN a participant activates the upvote control on a RetroCard, THE Board_Service SHALL increment the `votes` field of that RetroCard by `1` in the database.
3. WHEN a vote is cast, THE Retro_Store SHALL optimistically increment the local vote count for the card before the Realtime_Subscription confirms the change.
4. WHEN the Realtime_Subscription delivers a card update event reflecting a vote change, THE Retro_Page SHALL reconcile the displayed vote count with the confirmed database value.
5. WHILE the RetroBoard `status` is NOT `voting`, THE Retro_Page SHALL hide the upvote control on all RetroCards.
6. THE Board_Service SHALL enforce that `votes` is a non-negative integer; IF an operation would result in a negative vote count, THEN THE Board_Service SHALL reject the request and return a descriptive error.

---

### Requirement 7: Real-Time Vote Synchronisation

**User Story:** As a participant, I want to see vote counts update in real time across all connected clients, so that the team has a live view of card popularity during voting.

#### Acceptance Criteria

1. WHEN a RetroCard `votes` field is updated in the database, THE Realtime_Subscription SHALL deliver the update event to all connected clients within the same board session.
2. WHEN the Realtime_Subscription delivers a vote update event, THE Retro_Store SHALL update the local vote count for the affected card without requiring a page refresh.
3. FOR ALL sequences of concurrent vote increments on the same RetroCard, THE Board_Service SHALL produce a final `votes` value equal to the sum of all individual increments (no lost updates).

---

### Requirement 8: Board Display and Layout

**User Story:** As a participant, I want to view the retrospective board as a clear three-column kanban layout, so that I can easily read and interact with cards in each category.

#### Acceptance Criteria

1. THE Retro_Page SHALL render three columns labelled `Start`, `Stop`, and `Continue`, each displaying only the RetroCards belonging to that category.
2. THE Retro_Page SHALL display the current Board_Status visibly so that all participants know which phase the session is in.
3. WHILE the RetroBoard `status` is `voting`, THE Retro_Page SHALL display each RetroCard's `votes` count.
4. WHILE the RetroBoard `status` is `discussing` or `closed`, THE Retro_Page SHALL display RetroCards sorted by `votes` descending within each column.
5. THE Retro_Page SHALL render a responsive layout that displays the three columns stacked vertically on viewports narrower than 768px and side-by-side on viewports 768px and wider.
6. WHEN a significant user action completes (card added, vote cast, status transitioned), THE Retro_Page SHALL display a toast notification confirming the action.

---

### Requirement 9: Anonymous Card Authorship

**User Story:** As a participant, I want the option to submit cards anonymously, so that I can share candid feedback without attribution.

#### Acceptance Criteria

1. THE Card_Form SHALL include an opt-in anonymity toggle that participants can activate before submitting a card.
2. WHERE a participant activates the anonymity toggle, THE Board_Service SHALL persist the RetroCard with `author_id` set to `null`.
3. WHERE a participant does not activate the anonymity toggle, THE Board_Service SHALL persist the RetroCard with `author_id` set to the authenticated user's id.
4. WHEN a RetroCard with a `null` `author_id` is displayed, THE Retro_Page SHALL render the author attribution as "Anonymous".
5. THE Board_Service SHALL never expose the `author_id` of an anonymous card to non-facilitator clients; IF a non-facilitator client requests card data, THEN THE Board_Service SHALL omit the `author_id` field for cards where `author_id` is `null`.

---

### Requirement 10: Data Integrity and Security

**User Story:** As a system operator, I want all retrospective data to be protected by access controls, so that only authorised team members can view or modify their team's board.

#### Acceptance Criteria

1. THE Board_Service SHALL enforce Row-Level Security (RLS) policies on the `retro_boards` table so that a participant can only read or write RetroBoard records belonging to their own team's sprints.
2. THE Board_Service SHALL enforce Row-Level Security (RLS) policies on the `retro_cards` table so that a participant can only read or write RetroCard records belonging to a RetroBoard on their own team.
3. IF an unauthenticated user attempts to access the Retro_Page, THEN THE Retro_Page SHALL redirect the user to the login page.
4. THE Board_Service SHALL use the Supabase server client for all database operations in Server Components and Route Handlers, and SHALL NOT use the browser client for server-side data mutations.
5. THE Board_Service SHALL validate that the `board_id` on a submitted RetroCard belongs to a RetroBoard associated with the authenticated user's team; IF the `board_id` is invalid or unauthorised, THEN THE Board_Service SHALL reject the request and return a descriptive error.

---

### Requirement 11: Countdown Timer

**User Story:** As a facilitator, I want to set an optional countdown timer when starting the retrospective, so that participants have a clear, time-boxed window for adding cards and the board automatically stops accepting new cards when time runs out.

#### Acceptance Criteria

1. WHERE a facilitator provides a timer duration during board initialisation, THE Timer_Service SHALL start the countdown immediately when the RetroBoard is created with `status` set to `collecting`.
2. WHERE a Timer is active, THE Retro_Page SHALL display the Countdown_Display showing the remaining time in `MM:SS` format to all connected participants.
3. WHEN a participant opens the Retro_Page while a Timer is active, THE Retro_Page SHALL display the Countdown_Display with the correct remaining time based on the server-authoritative start time and duration.
4. WHEN the Timer reaches zero, THE Timer_Service SHALL record the expiry timestamp on the RetroBoard and THE Countdown_Display SHALL show `00:00`.
5. WHEN the Timer expires, THE Realtime_Subscription SHALL deliver a timer-expired event to all connected clients so that THE Card_Form is hidden on all clients simultaneously without requiring a page refresh.
6. WHEN the Timer expires, THE Board_Service SHALL reject any card creation request for the board and SHALL return a descriptive error indicating that the submission window has closed.
7. WHEN a facilitator cancels the Timer before it expires, THE Timer_Service SHALL clear the timer state on the RetroBoard and THE Countdown_Display SHALL be removed from all connected clients via the Realtime_Subscription.
8. WHEN a facilitator extends the Timer, THE Timer_Service SHALL update the remaining duration on the RetroBoard and THE Countdown_Display SHALL reflect the new remaining time on all connected clients via the Realtime_Subscription.
9. THE Validator SHALL require any timer extension to result in a total remaining duration of at most 120 minutes; IF the extension would exceed this limit, THEN THE Timer_Service SHALL reject the request and return a descriptive error.
10. IF no timer duration is provided during board initialisation, THEN THE Timer_Service SHALL not start a countdown and THE Card_Form SHALL remain available based solely on Board_Status as defined in Requirement 2.
11. THE Timer_Service SHALL use the server-side timestamp as the authoritative time source for all timer calculations; client-side clocks SHALL only be used for rendering the Countdown_Display between server sync events.
