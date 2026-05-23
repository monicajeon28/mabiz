import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { validateSessionInMiddleware } from '@/lib/middleware-auth';
import { checkPathAccess, getRedirectForPath } from '@/lib/route-rules';
import { AuthRole } from '@/types/auth-headers';

// Constants
const MABIZ_SESSION_COOKIE = 'mabiz.sid';

/**
 * Route protection patterns
 * Routes that require authentication and role-based access control
 */
const PROTECTED_ROUTES = {
  ADMIN: /^\/admin(\/.*)?$/,           // /admin/* - Global admin only
  CONTRACTS: /^\/contracts(\/.*)?$/,   // /contracts/* - Global admin only
  DASHBOARD_TEAM: /^\/dashboard\/team(\/.*)?$/, // /dashboard/team/* - Owner/Agent only
  PNR: /^\/pnr(\/.*)?$/,                // /pnr/* - Authenticated users
  DASHBOARD: /^\/dashboard(\/.*)?$/,   // /dashboard/* - Authenticated users
  CONTACTS: /^\/contacts(\/.*)?$/,     // /contacts/* - Authenticated users
  MESSAGES: /^\/messages(\/.*)?$/,     // /messages/* - Authenticated users
  SETTINGS: /^\/settings(\/.*)?$/,     // /settings/* - Authenticated users
  WEBHOOKS: /^\/webhooks(\/.*)?$/,     // /webhooks/* - Authenticated users
  REPORTS: /^\/reports(\/.*)?$/,       // /reports/* - Authenticated users
};

/**
 * Routes that require GLOBAL_ADMIN role
 */
const ADMIN_ONLY_ROUTES = [PROTECTED_ROUTES.ADMIN, PROTECTED_ROUTES.CONTRACTS];

/**
 * Check if route requires authentication
 */
function isProtectedRoute(pathname: string): boolean {
  return Object.values(PROTECTED_ROUTES).some(pattern => pattern.test(pathname));
}

/**
 * Check if route requires admin role
 */
function isAdminRoute(pathname: string): boolean {
  return ADMIN_ONLY_ROUTES.some(pattern => pattern.test(pathname));
}

/**
 * Extract session ID from request cookies
 */
function getSessionId(request: NextRequest): string | null {
  return request.cookies.get(MABIZ_SESSION_COOKIE)?.value || null;
}


/**
 * NextJS 13+ middleware to inject auth context into request headers
 *
 * This runs before each request to:
 * 1. Verify authentication (for protected routes)
 * 2. Inject auth headers (X-Session-ID, X-User-Role, X-Org-ID, X-Is-Admin)
 * 3. Enforce role-based access control
 * 4. Log auth events for debugging
 *
 * Note: This middleware has lightweight session validation.
 * Full auth context (with all roles and member details) is loaded
 * in server components using getMabizSession() from src/lib/auth.ts
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const method = request.method;

  // Skip middleware for static assets and public endpoints
  if (pathname.startsWith('/_next') ||
      pathname.startsWith('/api/public/') ||
      pathname === '/' ||
      pathname === '/sign-in' ||
      pathname === '/signup' ||
      pathname.match(/\.(json|ico|png|jpg|jpeg|svg|gif|webp)$/)) {
    return NextResponse.next();
  }

  try {
    const sessionId = getSessionId(request);

    // Log request for debugging
    logger.log('[Middleware]', {
      pathname,
      method,
      hasSession: !!sessionId,
      isProtected: isProtectedRoute(pathname),
    });

    // If route is protected, user must have valid session
    if (isProtectedRoute(pathname)) {
      if (!sessionId) {
        logger.warn('[Middleware] Protected route without session', {
          pathname,
          method,
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        });
        // Redirect to login
        return NextResponse.redirect(new URL('/sign-in', request.url));
      }

      // Validate session exists and is not expired
      const sessionData = await validateSessionInMiddleware(sessionId);

      if (!sessionData) {
        logger.warn('[Middleware] Invalid or expired session', {
          pathname,
          method,
          sessionId: sessionId.substring(0, 8) + '...',
        });
        // Clear invalid session cookie
        const response = NextResponse.redirect(new URL('/sign-in', request.url));
        response.cookies.delete(MABIZ_SESSION_COOKIE);
        return response;
      }

      // ✅ Phase 3 Update: Use centralized route rules for access control
      const authRole = (sessionData.role || 'UNKNOWN') as AuthRole;
      const hasAccess = checkPathAccess(pathname, authRole);

      if (!hasAccess) {
        const redirectUrl = getRedirectForPath(pathname, authRole);
        logger.warn('[Middleware] Insufficient permissions (route-rules)', {
          pathname,
          method,
          role: authRole,
          userId: sessionData.adminId || 'member',
          redirectTo: redirectUrl,
        });

        // Redirect or return 403
        if (redirectUrl) {
          return NextResponse.redirect(new URL(redirectUrl, request.url));
        }

        return NextResponse.json(
          { error: 'FORBIDDEN: Insufficient permissions' },
          { status: 403 }
        );
      }

      // Inject auth headers for downstream processing
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-session-id', sessionId);
      requestHeaders.set('x-user-role', sessionData.role || 'UNKNOWN');
      requestHeaders.set('x-org-id', sessionData.organizationId || '');
      requestHeaders.set('x-is-admin', (sessionData.role === 'GLOBAL_ADMIN').toString());

      logger.log('[Middleware] Auth headers injected (route-rules validated)', {
        pathname,
        role: authRole,
        isAdmin: authRole === 'GLOBAL_ADMIN',
      });

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }

    // For non-protected routes, still inject session if available
    if (sessionId) {
      const sessionData = await validateSessionInMiddleware(sessionId);

      if (sessionData) {
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-session-id', sessionId);
        requestHeaders.set('x-user-role', sessionData.role || 'UNKNOWN');
        requestHeaders.set('x-org-id', sessionData.organizationId || '');
        requestHeaders.set('x-is-admin', (sessionData.role === 'GLOBAL_ADMIN').toString());

        return NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        });
      }
    }

    return NextResponse.next();

  } catch (error) {
    logger.error('[Middleware] Unexpected error', {
      pathname,
      method,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Allow request to proceed but log the error
    return NextResponse.next();
  }
}

/**
 * Matcher: Define which routes trigger this middleware
 *
 * We match all except static assets, because we need to inject
 * auth context into every request for downstream processing
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
