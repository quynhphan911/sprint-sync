import { createServerClient as createSSRServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Supabase server client factory.
 *
 * Constructs a Supabase server client using cookies from the current request
 * context. Compatible with Next.js App Router Server Components and Route
 * Handlers. Throws a descriptive error if called outside a valid request
 * context.
 *
 * Validates: Requirements 1.4, 7.1, 7.6
 */

export function createServerClient() {
  const cookieStore = cookies()

  return createSSRServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
