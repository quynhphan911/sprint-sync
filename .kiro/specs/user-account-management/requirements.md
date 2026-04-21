# Requirements Document

## Introduction

The User Account Management feature provides Esoft team members with the ability to register, authenticate, and manage their personal accounts within SprintSync. It covers email/password registration and login, optional Google SSO, profile management (display name and avatar), password change, account deletion, and session handling. This is the foundational feature in SprintSync's implementation order — all other features depend on authenticated identity and team membership established here.

## Glossary

- **User**: An individual with a SprintSync account, authenticated via Supabase Auth.
- **Profile**: The user-facing record extending Supabase Auth identity with display name and avatar URL, stored in the `profiles` table.
- **Auth_Service**: The server-side data access layer responsible for all authentication and account operations via Supabase Auth and the `profiles` table.
- **Auth_Page**: The Next.js page rendered at `/auth`, hosting the login and registration forms.
- **Register_Form**: The client-side form component used to create a new account.
- **Login_Form**: The client-side form component used to authenticate an existing user.
- **Profile_Page**: The Next.js page rendered at `/account/profile`, where an authenticated user can view and edit their profile.
- **Account_Settings_Page**: The Next.js page rendered at `/account/settings`, where an authenticated user can change their password or delete their account.
- **Validator**: The input validation logic applied before submitting authentication or profile data.
- **Session**: The Supabase Auth session token pair (access token + refresh token) that identifies an authenticated user across requests.
- **Facilitator**: An authenticated team member with elevated permissions within a team context (defined per team, not globally).
- **Google_SSO**: The optional OAuth 2.0 sign-in flow via Google, provided by Supabase Auth.

---

## Requirements

### Requirement 1: User Registration

**User Story:** As a new Esoft team member, I want to register for a SprintSync account using my email address and a password, so that I can access the application and join my team.

#### Acceptance Criteria

1. THE Auth_Page SHALL display the Register_Form with fields for `email`, `password`, and `display_name`.
2. WHEN a visitor submits the Register_Form with valid data, THE Auth_Service SHALL create a new Supabase Auth user with the provided `email` and `password`, and SHALL create a corresponding `profiles` record with the provided `display_name`.
3. THE Validator SHALL require `email` to be a non-empty string in valid email format; IF the email is empty or malformed, THEN THE Register_Form SHALL display a field-level error message.
4. THE Validator SHALL require `password` to be a non-empty string of at least 8 characters containing at least one uppercase letter, one lowercase letter, and one digit; IF the password does not meet these criteria, THEN THE Register_Form SHALL display a field-level error message.
5. THE Validator SHALL require `display_name` to be a non-empty string of at most 50 characters; IF the display name is empty or exceeds 50 characters, THEN THE Register_Form SHALL display a field-level error message.
6. IF the provided `email` is already associated with an existing account, THEN THE Auth_Service SHALL return a descriptive error and THE Register_Form SHALL display a field-level error message without revealing whether the email exists in the system.
7. WHEN a user is successfully registered, THE Auth_Service SHALL establish a Session for the new user and THE Auth_Page SHALL redirect the user to `/teams` without requiring a manual login step.
8. IF the Auth_Service returns an error during registration, THEN THE Register_Form SHALL display a descriptive error message and SHALL retain the user's entered data except for the `password` field.

---

### Requirement 2: Email/Password Login

**User Story:** As a registered user, I want to log in with my email address and password, so that I can access my SprintSync account.

#### Acceptance Criteria

1. THE Auth_Page SHALL display the Login_Form with fields for `email` and `password`.
2. WHEN a user submits the Login_Form with valid credentials, THE Auth_Service SHALL authenticate the user via Supabase Auth and SHALL establish a Session.
3. WHEN a Session is successfully established, THE Auth_Page SHALL redirect the user to `/teams`.
4. THE Validator SHALL require `email` and `password` to be non-empty before the Login_Form is submitted; IF either field is empty, THEN THE Login_Form SHALL display a field-level error message.
5. IF the provided credentials do not match any existing account, THEN THE Auth_Service SHALL return a generic error and THE Login_Form SHALL display the message "Invalid email or password" without indicating which field is incorrect.
6. IF the Auth_Service returns an error during login, THEN THE Login_Form SHALL display a descriptive error message and SHALL retain the user's entered `email` value.
7. WHEN an unauthenticated user attempts to access any protected route, THE application SHALL redirect the user to the Auth_Page, preserving the originally requested URL as a redirect parameter.
8. WHEN a user is redirected to the Auth_Page with a redirect parameter, THE Auth_Page SHALL redirect the user to the originally requested URL after a successful login.

---

### Requirement 3: Google SSO Login and Registration

**User Story:** As a user, I want the option to sign in or register using my Google account, so that I can access SprintSync without managing a separate password.

#### Acceptance Criteria

1. THE Auth_Page SHALL display a "Sign in with Google" button alongside the Login_Form and Register_Form.
2. WHEN a user activates the "Sign in with Google" button, THE Auth_Service SHALL initiate the Google_SSO OAuth 2.0 flow via Supabase Auth.
3. WHEN the Google_SSO flow completes successfully for a new user, THE Auth_Service SHALL create a `profiles` record using the display name and avatar URL provided by Google, and SHALL establish a Session.
4. WHEN the Google_SSO flow completes successfully for an existing user, THE Auth_Service SHALL establish a Session for that user without creating a duplicate `profiles` record.
5. WHEN a Session is established via Google_SSO, THE Auth_Page SHALL redirect the user to `/teams`.
6. IF the Google_SSO flow is cancelled or returns an error, THEN THE Auth_Page SHALL display a descriptive error message and SHALL remain on the Auth_Page.
7. WHERE Google_SSO is disabled in the Supabase project configuration, THE Auth_Page SHALL NOT render the "Sign in with Google" button.

---

### Requirement 4: Session Management and Logout

**User Story:** As an authenticated user, I want my session to persist across page reloads and browser tabs, and I want to be able to log out securely, so that my account remains accessible during my work session and protected when I am done.

#### Acceptance Criteria

1. WHILE a valid Session exists, THE application SHALL maintain the authenticated state across page reloads and navigation without requiring the user to log in again.
2. THE Auth_Service SHALL use Supabase Auth's server-side session handling via `@supabase/ssr` to validate the Session on every protected Server Component render and Route Handler request.
3. WHEN a Session's access token expires, THE Auth_Service SHALL automatically refresh the Session using the refresh token without interrupting the user's workflow.
4. IF the refresh token is expired or invalid, THEN THE Auth_Service SHALL clear the Session and THE application SHALL redirect the user to the Auth_Page.
5. WHEN an authenticated user activates the logout control, THE Auth_Service SHALL invalidate the Session via Supabase Auth and SHALL clear all session cookies.
6. WHEN a Session is successfully invalidated, THE application SHALL redirect the user to the Auth_Page.
7. THE application SHALL display a logout control accessible from all authenticated pages via the navigation header.

---

### Requirement 5: Profile Management

**User Story:** As an authenticated user, I want to update my display name and avatar, so that my team members can identify me correctly within SprintSync.

#### Acceptance Criteria

1. WHEN an authenticated user navigates to the Profile_Page, THE Profile_Page SHALL display the user's current `display_name` and `avatar_url` in an editable form.
2. WHEN a user submits the profile form with a valid `display_name`, THE Auth_Service SHALL update the `profiles` record for the authenticated user in the database.
3. THE Validator SHALL require `display_name` to be a non-empty string of at most 50 characters; IF the display name is empty or exceeds 50 characters, THEN THE Profile_Page SHALL display a field-level error message.
4. WHEN a user uploads an avatar image, THE Auth_Service SHALL store the image in Supabase Storage and SHALL update the `avatar_url` field on the user's `profiles` record.
5. THE Validator SHALL require any uploaded avatar image to be in JPEG, PNG, or WebP format and to not exceed 2 MB in size; IF the file does not meet these criteria, THEN THE Profile_Page SHALL display a descriptive error message and SHALL NOT upload the file.
6. WHEN a profile update is successfully saved, THE Profile_Page SHALL display a toast notification confirming the change.
7. IF the Auth_Service returns an error during a profile update, THEN THE Profile_Page SHALL display a descriptive error message and SHALL retain the user's entered data.
8. THE Profile_Page SHALL fetch the current profile data using the Supabase server client in a Server Component on initial page load.

---

### Requirement 6: Password Change

**User Story:** As an authenticated user who registered with email/password, I want to change my password, so that I can maintain the security of my account.

#### Acceptance Criteria

1. WHEN an authenticated user navigates to the Account_Settings_Page, THE Account_Settings_Page SHALL display a password change form with fields for `current_password`, `new_password`, and `confirm_new_password`.
2. WHEN a user submits the password change form, THE Auth_Service SHALL verify the `current_password` against the user's existing Supabase Auth credentials before applying any change.
3. IF the `current_password` does not match the user's existing credentials, THEN THE Auth_Service SHALL return a descriptive error and THE Account_Settings_Page SHALL display a field-level error message on the `current_password` field.
4. THE Validator SHALL require `new_password` to meet the same criteria defined in Requirement 1 Acceptance Criterion 4; IF the new password does not meet these criteria, THEN THE Account_Settings_Page SHALL display a field-level error message.
5. THE Validator SHALL require `confirm_new_password` to exactly match `new_password`; IF the values do not match, THEN THE Account_Settings_Page SHALL display a field-level error message.
6. WHEN the password is successfully changed, THE Auth_Service SHALL update the user's credentials via Supabase Auth and THE Account_Settings_Page SHALL display a toast notification confirming the change.
7. IF the Auth_Service returns an error during the password change, THEN THE Account_Settings_Page SHALL display a descriptive error message and SHALL clear all password fields.
8. WHERE a user authenticated exclusively via Google_SSO, THE Account_Settings_Page SHALL NOT display the password change form.

---

### Requirement 7: Password Reset

**User Story:** As a user who has forgotten their password, I want to request a password reset link sent to my email address, so that I can regain access to my account.

#### Acceptance Criteria

1. THE Auth_Page SHALL display a "Forgot password?" link that navigates the user to a password reset request form.
2. WHEN a user submits the password reset request form with a valid email address, THE Auth_Service SHALL trigger Supabase Auth to send a password reset email to that address.
3. THE Validator SHALL require the email field to be a non-empty string in valid email format; IF the email is empty or malformed, THEN the password reset form SHALL display a field-level error message.
4. WHEN the password reset request is submitted, THE Auth_Page SHALL display a confirmation message instructing the user to check their email, regardless of whether the email address is associated with an existing account.
5. WHEN a user follows the password reset link from their email, THE application SHALL render a password reset completion form with fields for `new_password` and `confirm_new_password`.
6. WHEN a user submits the password reset completion form with valid data, THE Auth_Service SHALL update the user's credentials via Supabase Auth and SHALL establish a new Session.
7. THE Validator SHALL require `new_password` to meet the same criteria defined in Requirement 1 Acceptance Criterion 4, and SHALL require `confirm_new_password` to exactly match `new_password`; IF either condition is not met, THEN the password reset completion form SHALL display a field-level error message.
8. WHEN the password reset is successfully completed, THE application SHALL redirect the user to `/teams`.
9. IF the password reset link is expired or invalid, THEN THE application SHALL display a descriptive error message and SHALL provide a link to request a new reset email.

---

### Requirement 8: Account Deletion

**User Story:** As an authenticated user, I want to permanently delete my account, so that my personal data is removed from SprintSync.

#### Acceptance Criteria

1. THE Account_Settings_Page SHALL display an account deletion control in a visually distinct danger zone section.
2. WHEN a user activates the account deletion control, THE Account_Settings_Page SHALL display a confirmation dialog requiring the user to type their `email` address to confirm intent.
3. WHEN a user confirms account deletion with the correct `email`, THE Auth_Service SHALL permanently delete the user's Supabase Auth record and `profiles` record.
4. THE Auth_Service SHALL set `author_id` to `null` on all RetroCards authored by the deleted user, preserving the card content while removing the personal attribution.
5. THE Auth_Service SHALL reassign or retain ActionItems assigned to the deleted user with `assignee_id` set to `null`, preserving the task record without personal attribution.
6. WHEN account deletion is successfully completed, THE Auth_Service SHALL invalidate the Session and THE application SHALL redirect the user to the Auth_Page.
7. IF the Auth_Service returns an error during account deletion, THEN THE Account_Settings_Page SHALL display a descriptive error message and SHALL NOT proceed with deletion.
8. IF the email entered in the confirmation dialog does not match the authenticated user's email, THEN THE Account_Settings_Page SHALL display a field-level error message and SHALL NOT proceed with deletion.

---

### Requirement 9: Data Integrity and Security

**User Story:** As a system operator, I want all user account data to be protected by access controls and secure practices, so that personal information is only accessible to the account owner.

#### Acceptance Criteria

1. THE Auth_Service SHALL enforce Row-Level Security (RLS) policies on the `profiles` table so that a user can only read their own profile record and update their own `display_name` and `avatar_url`.
2. THE Auth_Service SHALL use the Supabase server client from `@supabase/ssr` for all authentication operations in Server Components and Route Handlers, and SHALL NOT use the browser client for server-side auth mutations.
3. THE Auth_Service SHALL never expose password values, Supabase Auth internal tokens, or raw session secrets in API responses, client-side state, or logs.
4. IF an unauthenticated request is made to any Route Handler that performs a protected mutation, THEN THE Route Handler SHALL return a 401 response.
5. THE Auth_Service SHALL validate that all profile mutation requests are scoped to the authenticated user's own `profiles` record; IF a request targets a different user's record, THEN THE Auth_Service SHALL reject the request and return a 403 response.
6. THE Auth_Service SHALL store avatar images in a Supabase Storage bucket with RLS policies that permit only the owning user to upload or replace their own avatar.
7. THE Validator SHALL sanitise all text inputs before persistence to prevent stored cross-site scripting; `display_name` SHALL be stored as plain text with no HTML markup permitted.

---

### Requirement 10: Responsive Layout and UX

**User Story:** As a user, I want the authentication and account management pages to be usable on both desktop and mobile devices, so that I can register, log in, and manage my account from any device.

#### Acceptance Criteria

1. THE Auth_Page SHALL render the Login_Form and Register_Form in a single-column, centred card layout on all viewport widths, with all input fields and buttons fully operable via touch on mobile devices.
2. THE Profile_Page and Account_Settings_Page SHALL render all form fields and controls in a single-column layout on viewports narrower than 768px and in a two-column layout on viewports 768px and wider.
3. WHEN a significant user action completes (registration, login, profile update, password change, logout), THE application SHALL display a toast notification confirming the action.
4. WHILE an authentication or profile mutation request is in progress, THE relevant form SHALL display a loading indicator and SHALL disable the submit control to prevent duplicate submissions.
5. THE Auth_Page SHALL provide a clearly visible toggle allowing users to switch between the Login_Form and Register_Form without navigating to a different URL.
