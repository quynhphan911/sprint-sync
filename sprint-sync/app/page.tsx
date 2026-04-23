import { redirect } from 'next/navigation'

/**
 * Root page — redirects to /auth.
 *
 * The middleware handles the rest:
 * - If authenticated, middleware redirects /auth → /teams
 * - If unauthenticated, user lands on /auth to log in
 */
export default function RootPage() {
  redirect('/auth')
}
