import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr'

/**
 * Supabase browser client factory.
 *
 * Constructs a Supabase browser client for use in Client Components,
 * real-time subscriptions, and auth operations.
 *
 * Validates: Requirements 1.4, 7.2
 */

export function createBrowserClient() {
  return createSSRBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
