# Tasks: User Account Management

## Task List

- [ ] 1. Project foundation and Supabase setup
  - [ ] 1.1 Install and configure Supabase SSR packages (`@supabase/ssr`, `@supabase/supabase-js`)
  - [ ] 1.2 Create `lib/supabase/server.ts` — `createServerClient` helper using `@supabase/ssr`
  - [ ] 1.3 Create `lib/supabase/client.ts` — `createBrowserClient` helper
  - [ ] 1.4 Write and apply Supabase migration: create `profiles` table with RLS policies
  - [ ] 1.5 Write and apply Supabase migration: create `avatars` storage bucket with RLS policies
  - [ ] 1.6 Write and apply Supabase migration: add `ON DELETE SET NULL` FK on `retro_cards.author_id` and `action_items.assignee_id`
  - [ ] 1.7 Create `types/auth.ts` with `Profile`, `UserWithProfile`, `AuthError`, `AuthErrorCode`, `ValidationResult` types

- [ ] 2. Validator (`lib/auth/validators.ts`)
  - [ ] 2.1 Implement `validateEmail` — non-empty, valid email format
  - [ ] 2.2 Implement `validatePassword` — min 8 chars, at least one uppercase, one lowercase, one digit
  - [ ] 2.3 Implement `validateDisplayName` — non-empty, at most 50 characters
  - [ ] 2.4 Implement `validateAvatarFile` — JPEG/PNG/WebP, max 2 MB
  - [ ] 2.5 Implement `validatePasswordsMatch` — exact equality check
  - [ ] 2.6 Implement `sanitiseDisplayName` — strip all HTML markup, return plain text

- [ ] 3. Auth_Service (`lib/auth/service.ts`)
  - [ ] 3.1 Implement `registerWithEmail` — create Supabase Auth user and `profiles` record in a single operation
  - [ ] 3.2 Implement `loginWithEmail` — authenticate via Supabase Auth, return session
  - [ ] 3.3 Implement `initiateGoogleSSO` — return OAuth redirect URL from Supabase Auth
  - [ ] 3.4 Implement `logout` — call Supabase `signOut`, clear session cookies
  - [ ] 3.5 Implement `getProfile` — fetch `profiles` record for authenticated user using server client
  - [ ] 3.6 Implement `updateProfile` — update `display_name` and/or `avatar_url` on `profiles`, sanitise display name before persistence
  - [ ] 3.7 Implement `uploadAvatar` — upload file to `avatars` bucket at `{userId}/{filename}`, return public URL
  - [ ] 3.8 Implement `changePassword` — re-authenticate with current password, then update via Supabase Auth
  - [ ] 3.9 Implement `requestPasswordReset` — call Supabase `resetPasswordForEmail`
  - [ ] 3.10 Implement `completePasswordReset` — update credentials via Supabase Auth using reset token
  - [ ] 3.11 Implement `deleteAccount` — delete Supabase Auth user (cascades to `profiles`); verify `author_id` and `assignee_id` nullification via DB cascade

- [ ] 4. Middleware (`middleware.ts`)
  - [ ] 4.1 Implement session refresh logic using `@supabase/ssr` — exchange refresh token on every request
  - [ ] 4.2 Implement route protection — redirect unauthenticated users to `/auth?redirect=<original_url>` for all protected routes
  - [ ] 4.3 Implement authenticated redirect — redirect authenticated users away from `/auth` to `/teams`
  - [ ] 4.4 Define protected route matcher pattern in middleware config

- [ ] 5. Auth page and forms (`app/auth/`)
  - [ ] 5.1 Create `app/auth/page.tsx` — Auth_Page with toggle between Login_Form and Register_Form, Google SSO button
  - [ ] 5.2 Create `components/auth/RegisterForm.tsx` — Client Component with email, password, display_name fields; client-side validation; loading state; error display
  - [ ] 5.3 Create `components/auth/LoginForm.tsx` — Client Component with email, password fields; client-side validation; loading state; error display; retain email on error
  - [ ] 5.4 Create `components/auth/GoogleSSOButton.tsx` — Client Component; conditionally rendered based on SSO config; initiates OAuth flow
  - [ ] 5.5 Create `app/auth/reset-password/page.tsx` — password reset request form with email field and confirmation message display
  - [ ] 5.6 Create `app/auth/confirm/page.tsx` — Server Component; handles Supabase auth callback URL; redirects to password reset completion or `/teams`
  - [ ] 5.7 Create password reset completion form (within confirm page or dedicated route) — new_password and confirm_new_password fields

- [ ] 6. Protected layout and navigation
  - [ ] 6.1 Create `app/(protected)/layout.tsx` — Server Component; validates session server-side; renders NavHeader
  - [ ] 6.2 Create `components/shared/NavHeader.tsx` — displays user avatar and display name; logout button that calls Auth_Service logout action

- [ ] 7. Profile page (`app/account/profile/`)
  - [ ] 7.1 Create `app/account/profile/page.tsx` — Server Component; fetches profile via `getProfile`; passes data to ProfileForm
  - [ ] 7.2 Create `components/account/ProfileForm.tsx` — Client Component; display_name field pre-populated; submit calls `updateProfile`; toast on success; error display; retain data on error
  - [ ] 7.3 Create `components/account/AvatarUpload.tsx` — Client Component; file input with format/size validation; preview; calls `uploadAvatar` on selection; updates avatar_url

- [ ] 8. Account settings page (`app/account/settings/`)
  - [ ] 8.1 Create `app/account/settings/page.tsx` — Server Component; fetches user metadata (provider); passes to child components
  - [ ] 8.2 Create `components/account/PasswordChangeForm.tsx` — Client Component; current_password, new_password, confirm_new_password fields; hidden for Google-only users; toast on success; clear all fields on error
  - [ ] 8.3 Create `components/account/DeleteAccountDialog.tsx` — Client Component; danger zone trigger button; confirmation dialog requiring email entry; blocks deletion on mismatch; calls `deleteAccount` on confirmation

- [ ] 9. Route Handlers
  - [ ] 9.1 Create `app/api/auth/register/route.ts` — POST handler; validates inputs; calls `registerWithEmail`; returns 400 on validation failure, 409 on email conflict, 201 on success
  - [ ] 9.2 Create `app/api/auth/login/route.ts` — POST handler; validates inputs; calls `loginWithEmail`; returns 400 on validation failure, 401 on invalid credentials, 200 on success
  - [ ] 9.3 Create `app/api/auth/logout/route.ts` — POST handler; requires auth (401 if not); calls `logout`; returns 200
  - [ ] 9.4 Create `app/api/account/profile/route.ts` — PATCH handler; requires auth (401); validates ownership (403 if mismatch); calls `updateProfile`; returns 400/200
  - [ ] 9.5 Create `app/api/account/avatar/route.ts` — POST handler; requires auth (401); validates file; calls `uploadAvatar`; returns 400/200
  - [ ] 9.6 Create `app/api/account/password/route.ts` — PATCH handler; requires auth (401); calls `changePassword`; returns 400/401/200
  - [ ] 9.7 Create `app/api/account/delete/route.ts` — DELETE handler; requires auth (401); calls `deleteAccount`; returns 200

- [ ] 10. Unit and property-based tests
  - [ ] 10.1 Set up Vitest and fast-check in the project
  - [ ] 10.2 Write unit tests for all Validator functions — boundary values, representative valid/invalid inputs
  - [ ] 10.3 Write property test for Property 1: valid registration creates a profile (fast-check, min 100 iterations, mocked Supabase)
  - [ ] 10.4 Write property test for Property 2: Validator rejects all invalid inputs (fast-check, min 100 iterations)
  - [ ] 10.5 Write property test for Property 3: Validator accepts all conforming inputs (fast-check, min 100 iterations)
  - [ ] 10.6 Write property test for Property 4: passwords-match validation is commutative in failure (fast-check, min 100 iterations)
  - [ ] 10.7 Write property test for Property 5: display name sanitisation removes all HTML markup (fast-check, min 100 iterations)
  - [ ] 10.8 Write property test for Property 6: avatar file validation correctly classifies files (fast-check, min 100 iterations)
  - [ ] 10.9 Write property test for Property 7: Google SSO never creates duplicate profiles (fast-check, min 100 iterations, mocked Supabase)
  - [ ] 10.10 Write property test for Property 8: password reset confirmation is always shown (fast-check, min 100 iterations)
  - [ ] 10.11 Write property test for Property 9: unauthenticated requests to protected endpoints return 401 (fast-check, min 100 iterations)
  - [ ] 10.12 Write property test for Property 10: cross-user profile mutations are rejected with 403 (fast-check, min 100 iterations)
  - [ ] 10.13 Write property test for Property 11: account deletion nullifies personal attribution (fast-check, min 100 iterations, mocked DB)
  - [ ] 10.14 Write property test for Property 12: email confirmation mismatch blocks account deletion (fast-check, min 100 iterations)
  - [ ] 10.15 Write property test for Property 13: toast notifications are shown for all significant actions (fast-check, min 100 iterations)

- [ ] 11. Integration and smoke tests
  - [ ] 11.1 Write integration test: full registration flow — Route Handler creates auth user and profiles record, session cookie set
  - [ ] 11.2 Write integration test: login flow — valid credentials establish session; invalid credentials return 401 with generic message
  - [ ] 11.3 Write integration test: Google SSO callback — new user creates profile; existing user does not duplicate profile
  - [ ] 11.4 Write integration test: session refresh — expired access token is refreshed transparently by middleware
  - [ ] 11.5 Write integration test: account deletion cascade — profiles deleted, RetroCard.author_id null, ActionItem.assignee_id null
  - [ ] 11.6 Write integration test: RLS enforcement — reading/updating another user's profile returns error
  - [ ] 11.7 Write smoke test: Supabase project reachable, Auth enabled, profiles table exists with correct schema and RLS, avatars bucket exists with correct RLS
