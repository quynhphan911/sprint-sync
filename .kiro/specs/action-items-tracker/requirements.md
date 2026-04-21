# Requirements Document

## Introduction

The Action Items Tracker & History feature gives Esoft teams a structured way to capture, assign, track, and carry forward action items within SprintSync. Action items can be created directly from RetroCards at the end of a retrospective or added manually by a facilitator. Each action item is linked to a sprint, assigned to a team member, and carries a status lifecycle (`todo` → `in_progress` → `done`). Unresolved items from a completed sprint are surfaced prominently on the next sprint's dashboard so nothing falls through the cracks. This is the fourth feature in SprintSync's implementation order, building on the Retrospective Board.

## Glossary

- **ActionItem**: A task entity linked to a `sprint_id` and an `assignee_id`, with a `description` and a `status` of `todo`, `in_progress`, or `done`.
- **Assignee**: The authenticated team member to whom an ActionItem is assigned.
- **Facilitator**: An authenticated team member with permission to create, edit, and delete ActionItems and to convert RetroCards into ActionItems.
- **Participant**: Any authenticated team member who can view ActionItems and update the status of items assigned to them.
- **Source_Card**: The RetroCard from which an ActionItem was created via conversion. The relationship is optional — ActionItems may also be created manually.
- **Action_Items_Panel**: The UI section rendered on the Retro_Page that lists all ActionItems for the current sprint and provides controls to create and manage them.
- **Dashboard_Callout**: The UI section rendered on the Dashboard_Page that surfaces unresolved ActionItems (status `todo` or `in_progress`) carried over from the most recently completed sprint.
- **ActionItem_Service**: The server-side data access layer responsible for all ActionItem database operations.
- **ActionItem_Form**: The client-side form component used to create or edit an ActionItem.
- **Validator**: The input validation logic applied before persisting ActionItem data.
- **Retro_Page**: The Next.js page at `/teams/[teamId]/sprints/[sprintId]/retro`, which hosts the Action_Items_Panel alongside the RetroBoard.
- **Dashboard_Page**: The Next.js page at `/teams/[teamId]/dashboard`, which hosts the Dashboard_Callout.
- **Action_Items_History_Page**: The Next.js Server Component page rendered at `/teams/[teamId]/sprints/[sprintId]/action-items`, listing all ActionItems for a given sprint.

---

## Requirements

### Requirement 1: Create Action Items from RetroCards

**User Story:** As a facilitator, I want to convert a RetroCard into an action item during the retrospective, so that discussion outcomes are immediately captured as trackable tasks.

#### Acceptance Criteria

1. WHILE the RetroBoard `status` is `discussing` or `closed`, THE Action_Items_Panel SHALL display a "Convert to Action Item" control on each visible RetroCard.
2. WHEN a facilitator activates the "Convert to Action Item" control on a RetroCard, THE Action_Items_Panel SHALL open the ActionItem_Form pre-populated with the RetroCard's `content` as the `description`.
3. WHEN a facilitator submits the ActionItem_Form with valid data, THE ActionItem_Service SHALL persist a new ActionItem record with the provided `description`, `assignee_id`, and `sprint_id`, with `status` set to `todo`.
4. THE ActionItem_Service SHALL record the `source_card_id` (the originating RetroCard's `id`) on the ActionItem when the item is created via card conversion; WHERE an ActionItem is created manually, THE ActionItem_Service SHALL persist `source_card_id` as `null`.
5. IF a RetroCard has already been converted to an ActionItem, THEN THE Action_Items_Panel SHALL visually indicate that the card has been converted and SHALL disable the "Convert to Action Item" control for that card.
6. WHEN an ActionItem is successfully created, THE Action_Items_Panel SHALL display the new item in the action items list without requiring a full page reload.
7. WHEN an ActionItem is successfully created, THE Retro_Page SHALL display a toast notification confirming the action item was created.

---

### Requirement 2: Create Action Items Manually

**User Story:** As a facilitator, I want to add action items directly without converting a retro card, so that I can capture tasks that arise outside of card discussions.

#### Acceptance Criteria

1. THE Action_Items_Panel SHALL display an "Add Action Item" button that is available to facilitators at all times while the Retro_Page is open.
2. WHEN a facilitator activates the "Add Action Item" button, THE Action_Items_Panel SHALL open the ActionItem_Form with all fields empty.
3. WHEN a facilitator submits the ActionItem_Form with valid data, THE ActionItem_Service SHALL persist a new ActionItem record with the provided `description`, `assignee_id`, and `sprint_id`, with `status` set to `todo` and `source_card_id` set to `null`.
4. THE Validator SHALL require `description` to be a non-empty string of at most 500 characters; IF the description is empty or exceeds 500 characters, THEN THE ActionItem_Form SHALL display a field-level error message.
5. THE Validator SHALL require `assignee_id` to reference a valid member of the current team; IF an invalid or missing `assignee_id` is provided, THEN THE ActionItem_Form SHALL display a field-level error message.
6. IF the ActionItem_Service returns an error during creation, THEN THE ActionItem_Form SHALL display a descriptive error message and SHALL retain the facilitator's entered data.

---

### Requirement 3: View Action Items on the Retro Page

**User Story:** As a participant, I want to see all action items for the current sprint on the retro page, so that I know what tasks have been captured during the session.

#### Acceptance Criteria

1. THE Action_Items_Panel SHALL display all ActionItems linked to the current `sprint_id`, ordered by creation time ascending.
2. THE Action_Items_Panel SHALL display the following fields for each ActionItem: `description`, the Assignee's display name, and `status`.
3. WHILE the RetroBoard `status` is `collecting` or `grouping`, THE Action_Items_Panel SHALL be visible but SHALL display an empty state message indicating that action items can be added once discussion begins.
4. THE Action_Items_Panel SHALL fetch ActionItem data using the Supabase server client in a Server Component on initial page load, and SHALL update the list in real time via a Realtime_Subscription scoped to the current `sprint_id`.
5. WHEN an ActionItem is inserted or updated in the database, THE Realtime_Subscription SHALL deliver the change event to all connected clients on the Retro_Page so that the Action_Items_Panel reflects the latest state without requiring a page refresh.

---

### Requirement 4: Update Action Item Status

**User Story:** As a participant, I want to update the status of an action item assigned to me, so that the team can track progress without waiting for the facilitator.

#### Acceptance Criteria

1. WHEN a participant views an ActionItem assigned to them, THE Action_Items_Panel SHALL display a status control allowing the participant to transition the status.
2. THE ActionItem_Service SHALL only permit the following `status` transitions for an ActionItem: `todo` → `in_progress`, `in_progress` → `done`, and `done` → `in_progress`; all other transitions SHALL be rejected.
3. WHEN a participant activates the status control, THE ActionItem_Service SHALL update the ActionItem's `status` to the selected value in the database.
4. WHEN the status is updated, THE Realtime_Subscription SHALL deliver the update event to all connected clients on the Retro_Page so that the Action_Items_Panel reflects the new status without requiring a page refresh.
5. WHEN an ActionItem's status is successfully updated, THE Retro_Page SHALL display a toast notification confirming the status change.
6. IF the ActionItem_Service returns an error during a status update, THEN THE Action_Items_Panel SHALL display a descriptive error message and SHALL revert the status control to the previous value.

---

### Requirement 5: Edit and Delete Action Items

**User Story:** As a facilitator, I want to edit or delete action items, so that I can correct mistakes or remove items that are no longer relevant.

#### Acceptance Criteria

1. THE Action_Items_Panel SHALL display "Edit" and "Delete" controls on each ActionItem that are visible only to facilitators.
2. WHEN a facilitator activates the "Edit" control on an ActionItem, THE Action_Items_Panel SHALL open the ActionItem_Form pre-populated with the item's current `description` and `assignee_id`.
3. WHEN a facilitator submits the ActionItem_Form with valid updated data, THE ActionItem_Service SHALL update the ActionItem record's `description` and `assignee_id` in the database.
4. WHEN a facilitator activates the "Delete" control on an ActionItem, THE Action_Items_Panel SHALL display a confirmation prompt before deletion.
5. WHEN a facilitator confirms deletion, THE ActionItem_Service SHALL permanently remove the ActionItem record from the database.
6. WHEN an ActionItem is successfully edited or deleted, THE Action_Items_Panel SHALL reflect the change without requiring a full page reload.
7. WHEN an ActionItem is successfully edited or deleted, THE Retro_Page SHALL display a toast notification confirming the action.
8. IF the ActionItem_Service returns an error during an edit or delete operation, THEN THE Action_Items_Panel SHALL display a descriptive error message.

---

### Requirement 6: Surface Unresolved Action Items on the Sprint Dashboard

**User Story:** As a team member, I want to see unresolved action items from the previous sprint on the current sprint's dashboard, so that the team is reminded of outstanding commitments at the start of each sprint.

#### Acceptance Criteria

1. WHEN a team member navigates to the Dashboard_Page and the team has a completed sprint with ActionItems whose `status` is `todo` or `in_progress`, THE Dashboard_Callout SHALL display those unresolved ActionItems grouped under the heading of the sprint they belong to.
2. THE Dashboard_Callout SHALL display the following fields for each unresolved ActionItem: `description`, the Assignee's display name, and `status`.
3. THE Dashboard_Callout SHALL only surface ActionItems from the single most recently completed sprint; ActionItems from older sprints SHALL NOT appear in the Dashboard_Callout.
4. WHILE all ActionItems from the most recently completed sprint have `status` `done`, THE Dashboard_Callout SHALL NOT be rendered on the Dashboard_Page.
5. WHILE no completed sprint exists for the team, THE Dashboard_Callout SHALL NOT be rendered on the Dashboard_Page.
6. THE Dashboard_Page SHALL fetch Dashboard_Callout data using the Supabase server client in a Server Component, scoped to the authenticated team member's team.
7. WHEN a team member clicks an unresolved ActionItem in the Dashboard_Callout, THE Dashboard_Page SHALL navigate the team member to the Action_Items_History_Page for the sprint that owns that item.

---

### Requirement 7: Action Items History Page

**User Story:** As a team member, I want to view all action items for any past sprint, so that I can review what was committed to and what was completed.

#### Acceptance Criteria

1. WHEN a team member navigates to `/teams/[teamId]/sprints/[sprintId]/action-items`, THE Action_Items_History_Page SHALL display all ActionItems linked to that `sprint_id`, ordered by creation time ascending.
2. THE Action_Items_History_Page SHALL display the following fields for each ActionItem: `description`, the Assignee's display name, `status`, and the creation timestamp.
3. THE Action_Items_History_Page SHALL display a summary row showing the total count of ActionItems and the count of items with `status` `done` for the sprint.
4. IF a team member navigates to a `sprintId` that does not belong to their team, THEN THE Action_Items_History_Page SHALL return a 404 response.
5. THE Action_Items_History_Page SHALL fetch data using the Supabase server client in a Server Component.
6. WHILE the Action_Items_History_Page is displaying a sprint whose status is `active`, THE Action_Items_History_Page SHALL allow facilitators to update ActionItem statuses inline using the same status transition rules defined in Requirement 4.

---

### Requirement 8: Carry Forward Unresolved Items

**User Story:** As a facilitator, I want to carry forward unresolved action items to the next sprint, so that outstanding tasks are not lost when a sprint closes.

#### Acceptance Criteria

1. WHEN a facilitator views the Dashboard_Callout for unresolved ActionItems from the previous sprint, THE Dashboard_Callout SHALL display a "Carry Forward" control for each unresolved item.
2. WHEN a facilitator activates the "Carry Forward" control for an ActionItem, THE ActionItem_Service SHALL create a new ActionItem record linked to the current active sprint's `sprint_id`, copying the `description` and `assignee_id` from the original item, with `status` set to `todo`.
3. THE ActionItem_Service SHALL NOT modify or delete the original ActionItem when carrying it forward; the original record SHALL remain linked to its source sprint.
4. WHEN an ActionItem is successfully carried forward, THE Dashboard_Callout SHALL display a visual indicator on the original item confirming it has been carried forward to the active sprint.
5. WHEN an ActionItem is successfully carried forward, THE Dashboard_Page SHALL display a toast notification confirming the action.
6. IF no active sprint exists for the team when a facilitator attempts to carry forward an item, THEN THE Dashboard_Callout SHALL display an error message stating that an active sprint is required.
7. IF the ActionItem_Service returns an error during the carry-forward operation, THEN THE Dashboard_Callout SHALL display a descriptive error message.

---

### Requirement 9: Data Integrity and Security

**User Story:** As a system operator, I want all action item data to be protected by access controls, so that only authorised team members can view or modify their team's action items.

#### Acceptance Criteria

1. THE ActionItem_Service SHALL enforce Row-Level Security (RLS) policies on the `action_items` table so that a team member can only read or write ActionItem records belonging to sprints of their own team.
2. IF a non-facilitator attempts to create, edit, or delete an ActionItem, THEN THE ActionItem_Service SHALL reject the request and return a descriptive authorisation error.
3. IF a participant attempts to update the `status` of an ActionItem not assigned to them, THEN THE ActionItem_Service SHALL reject the request and return a descriptive authorisation error.
4. IF an unauthenticated user attempts to access the Retro_Page or Action_Items_History_Page, THEN THE respective page SHALL redirect the user to the login page.
5. THE ActionItem_Service SHALL use the Supabase server client for all database operations in Server Components and Route Handlers, and SHALL NOT use the browser client for server-side data mutations.
6. THE ActionItem_Service SHALL validate that the `sprint_id` on a submitted ActionItem belongs to a sprint associated with the authenticated user's team; IF the `sprint_id` is invalid or unauthorised, THEN THE ActionItem_Service SHALL reject the request and return a descriptive error.

---

### Requirement 10: Responsive Layout

**User Story:** As a team member, I want the action items panel and history page to be usable on both desktop and mobile devices, so that I can manage tasks from any device.

#### Acceptance Criteria

1. THE Action_Items_Panel SHALL render a responsive layout that displays action items in a single-column list on all viewport widths, with controls remaining accessible via touch on mobile devices.
2. THE Action_Items_History_Page SHALL render all ActionItem fields and summary row in a single-column layout on viewports narrower than 768px and in a table layout on viewports 768px and wider.
3. THE Dashboard_Callout SHALL render unresolved ActionItems in a single-column list on viewports narrower than 768px and in a two-column grid on viewports 768px and wider.
