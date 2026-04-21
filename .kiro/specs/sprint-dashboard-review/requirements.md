# Requirements Document

## Introduction

The Sprint Dashboard & Review Management feature provides Esoft teams with a central workspace for managing their sprint lifecycle. It covers the Team Dashboard (showing active and past sprints), sprint creation and viewing, and Sprint Review input (increment notes, stakeholder feedback, and accepted stories count). This is the second feature in SprintSync's implementation order, building on top of the existing auth and team management foundation.

## Glossary

- **Dashboard**: The main page a team member sees after selecting their team, listing all sprints associated with that team.
- **Sprint**: A time-boxed iteration defined by a goal, start date, end date, and status (`active` or `completed`).
- **Active Sprint**: A Sprint whose status is `active`. A team may have at most one active sprint at a time.
- **Completed Sprint**: A Sprint whose status is `completed`.
- **Sprint Review**: A record capturing the outcome of a sprint, including increment notes, stakeholder feedback, and the count of accepted user stories.
- **Facilitator**: An authenticated team member with permission to create sprints and submit Sprint Reviews.
- **Team Member**: Any authenticated user who belongs to the team.
- **Dashboard_Page**: The Next.js Server Component page rendered at `/teams/[teamId]/dashboard`.
- **Sprint_Form**: The client-side form component used to create a new sprint.
- **Sprint_Detail_Page**: The Next.js Server Component page rendered at `/teams/[teamId]/sprints/[sprintId]`.
- **Review_Form**: The client-side form component used to submit or edit a Sprint Review.
- **Sprint_Service**: The server-side data access layer responsible for all Sprint and SprintReview database operations.
- **Validator**: The input validation logic applied before persisting Sprint or SprintReview data.

---

## Requirements

### Requirement 1: Team Dashboard — Sprint Overview

**User Story:** As a team member, I want to see all sprints for my team on a single dashboard, so that I can quickly understand the team's current and historical sprint activity.

#### Acceptance Criteria

1. WHEN a team member navigates to `/teams/[teamId]/dashboard`, THE Dashboard_Page SHALL display the active sprint (if one exists) in a visually distinct section at the top of the page.
2. WHEN a team member navigates to `/teams/[teamId]/dashboard`, THE Dashboard_Page SHALL display all completed sprints in a separate section, ordered by `sprint_number` descending.
3. WHILE no active sprint exists for the team, THE Dashboard_Page SHALL display a prompt indicating that no active sprint is running and offering a call-to-action to create one.
4. WHILE no completed sprints exist for the team, THE Dashboard_Page SHALL display an empty-state message in the completed sprints section.
5. THE Dashboard_Page SHALL display the following fields for each sprint card: `sprint_number`, `goal`, `status`, `start_date`, and `end_date`.
6. WHEN a team member clicks a sprint card, THE Dashboard_Page SHALL navigate the team member to the Sprint_Detail_Page for that sprint.
7. THE Dashboard_Page SHALL fetch sprint data using the Supabase server client in a Server Component, scoped to the authenticated team member's team.

---

### Requirement 2: Sprint Creation

**User Story:** As a facilitator, I want to create a new sprint for my team, so that the team has a defined iteration to work within.

#### Acceptance Criteria

1. WHEN a facilitator submits the Sprint_Form with valid data, THE Sprint_Service SHALL persist a new Sprint record with the provided `goal`, `start_date`, `end_date`, and `sprint_number`, and with `status` set to `active`.
2. THE Validator SHALL require `goal`, `start_date`, and `end_date` to be non-empty before the Sprint_Form is submitted.
3. THE Validator SHALL require `end_date` to be strictly after `start_date`; IF `end_date` is not after `start_date`, THEN THE Sprint_Form SHALL display a field-level error message.
4. THE Validator SHALL require `sprint_number` to be a positive integer unique within the team; IF a duplicate `sprint_number` is detected, THEN THE Sprint_Form SHALL display a field-level error message.
5. IF a team already has an active sprint, THEN THE Sprint_Service SHALL reject the creation request and THE Sprint_Form SHALL display an error message stating that only one active sprint is allowed per team at a time.
6. WHEN a sprint is successfully created, THE Dashboard_Page SHALL display the new sprint in the active sprint section without requiring a full page reload.
7. WHEN a sprint is successfully created, THE Dashboard_Page SHALL display a toast notification confirming the sprint was created.
8. IF the Sprint_Service returns an error during sprint creation, THEN THE Sprint_Form SHALL display a descriptive error message and SHALL NOT navigate away from the form.

---

### Requirement 3: Sprint Detail View

**User Story:** As a team member, I want to view the details of a specific sprint, so that I can review its goal, dates, and review outcome.

#### Acceptance Criteria

1. WHEN a team member navigates to `/teams/[teamId]/sprints/[sprintId]`, THE Sprint_Detail_Page SHALL display the sprint's `sprint_number`, `goal`, `status`, `start_date`, and `end_date`.
2. WHEN a team member navigates to the Sprint_Detail_Page for a sprint that has an associated SprintReview, THE Sprint_Detail_Page SHALL display the `increment_notes`, `stakeholder_feedback`, and `accepted_stories_count` from that review.
3. WHILE a sprint's status is `active`, THE Sprint_Detail_Page SHALL display the Review_Form to allow a facilitator to submit a Sprint Review.
4. WHILE a sprint's status is `completed`, THE Sprint_Detail_Page SHALL display the submitted Sprint Review in read-only mode.
5. IF a team member navigates to a `sprintId` that does not belong to their team, THEN THE Sprint_Detail_Page SHALL return a 404 response.
6. THE Sprint_Detail_Page SHALL fetch sprint and review data using the Supabase server client in a Server Component.

---

### Requirement 4: Sprint Review Submission

**User Story:** As a facilitator, I want to submit a Sprint Review for a completed sprint, so that the team's increment outcomes and stakeholder feedback are recorded.

#### Acceptance Criteria

1. WHEN a facilitator submits the Review_Form with valid data, THE Sprint_Service SHALL persist a SprintReview record with the provided `increment_notes`, `stakeholder_feedback`, and `accepted_stories_count`, linked to the correct `sprint_id`.
2. WHEN a facilitator submits the Review_Form, THE Sprint_Service SHALL update the associated Sprint's `status` from `active` to `completed` in the same operation.
3. THE Validator SHALL require `increment_notes` to be a non-empty string before the Review_Form is submitted.
4. THE Validator SHALL require `accepted_stories_count` to be a non-negative integer before the Review_Form is submitted; IF a non-integer or negative value is provided, THEN THE Review_Form SHALL display a field-level error message.
5. IF a SprintReview already exists for the sprint, THEN THE Sprint_Service SHALL update the existing record rather than creating a duplicate.
6. WHEN a Sprint Review is successfully submitted, THE Sprint_Detail_Page SHALL display a toast notification confirming the review was saved.
7. WHEN a Sprint Review is successfully submitted, THE Sprint_Detail_Page SHALL transition the view from the Review_Form to the read-only review display without requiring a full page reload.
8. IF the Sprint_Service returns an error during review submission, THEN THE Review_Form SHALL display a descriptive error message and SHALL retain the facilitator's entered data.

---

### Requirement 5: Sprint Status Transition

**User Story:** As a facilitator, I want the sprint status to automatically reflect its lifecycle stage, so that the dashboard always shows accurate sprint state.

#### Acceptance Criteria

1. THE Sprint_Service SHALL only allow a Sprint's `status` to transition from `active` to `completed`; no other status transitions are permitted.
2. IF a request is made to set a Sprint's `status` to `active` when the sprint is already `completed`, THEN THE Sprint_Service SHALL reject the request and return a descriptive error.
3. WHEN a Sprint's `status` transitions to `completed`, THE Dashboard_Page SHALL move the sprint card from the active sprint section to the completed sprints section on the next data load.

---

### Requirement 6: Data Integrity and Security

**User Story:** As a system operator, I want all sprint and review data to be protected by access controls, so that only authorized team members can view or modify their team's data.

#### Acceptance Criteria

1. THE Sprint_Service SHALL enforce Row-Level Security (RLS) policies on the `sprints` table so that a team member can only read or write Sprint records belonging to their own team.
2. THE Sprint_Service SHALL enforce Row-Level Security (RLS) policies on the `sprint_reviews` table so that a team member can only read or write SprintReview records for sprints belonging to their own team.
3. IF an unauthenticated user attempts to access the Dashboard_Page or Sprint_Detail_Page, THEN THE Dashboard_Page SHALL redirect the user to the login page.
4. THE Sprint_Service SHALL use the Supabase server client for all database operations in Server Components and Route Handlers, and SHALL NOT use the browser client for server-side data mutations.

---

### Requirement 7: Responsive Layout

**User Story:** As a team member, I want the dashboard and sprint detail pages to be usable on both desktop and mobile devices, so that I can participate in sprint reviews from any device.

#### Acceptance Criteria

1. THE Dashboard_Page SHALL render a responsive layout that displays sprint cards in a single-column layout on viewports narrower than 768px and in a multi-column grid on viewports 768px and wider.
2. THE Sprint_Detail_Page SHALL render all sprint detail fields and the Review_Form in a single-column layout on viewports narrower than 768px.
3. THE Review_Form SHALL display all input fields and the submit button in a layout that is fully operable via touch on mobile devices.
