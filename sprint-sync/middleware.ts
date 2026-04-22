import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Next.js middleware for session management and route protection.
 *
 * - Refreshes the Supabase session on every request (handles expired access tokens)
 * - Redirects unauthenticated users accessing protected routes to /auth?redirect=<original_url>
 * - Redirects authenticated users accessing /auth to /teams
 *
 * Validates: Requirements 7.3, 7.4, 7.5, 8.10
 */

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: any[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — do not remove this call
  // The getUser() call automatically exchanges the refresh token for a new access token
  // if the current access token is expired. The updated tokens are written back to cookies
  // via the setAll callback above, ensuring seamless session persistence.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Redirect unauthenticated users away from protected routes
  if (!user && (pathname.startsWith('/teams') || pathname.startsWith('/account'))) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/auth'
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect authenticated users away from the auth page
  if (user && pathname === '/auth') {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/teams'
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - _next/data (data fetching files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - api/* (API routes handle auth internally)
     * - Static assets with file extensions (images, fonts, etc.)
     */
    '/((?!_next/static|_next/image|_next/data|favicon.ico|sitemap.xml|robots.txt|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|otf)$).*)',
  ],
}
