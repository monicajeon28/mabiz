import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getMabizSession } from '@/lib/auth';

export type UserRole = 'GLOBAL_ADMIN' | 'OWNER' | 'AGENT' | 'FREE_SALES';

/**
 * Auth guard middleware factory
 *
 * Creates a reusable middleware function that checks if the user's role
 * matches one of the required roles.
 *
 * Usage:
 * ```
 * const requireAdmin = createAuthGuard(['GLOBAL_ADMIN']);
 * const requireOwner = createAuthGuard(['OWNER', 'GLOBAL_ADMIN']);
 * const requireTeam = createAuthGuard(['OWNER', 'AGENT', 'GLOBAL_ADMIN']);
 *
 * export async function GET(req: NextRequest) {
 *   const guard = requireAdmin(req);
 *   if (guard instanceof NextResponse) return guard; // Failed
 *   // Proceed with request
 * }
 * ```
 *
 * @param requiredRoles - Array of roles that are allowed
 * @param options - Optional: { requireOrgId: boolean, logViolations: boolean }
 * @returns Middleware function that validates request
 */
export function createAuthGuard(
  requiredRoles: UserRole[],
  options: {
    requireOrgId?: boolean;
    logViolations?: boolean;
    errorMessage?: string;
  } = {}
) {
  const {
    requireOrgId = false,
    logViolations = true,
    errorMessage = '접근 권한이 없습니다.',
  } = options;

  return function authGuardMiddleware(req: NextRequest): true | NextResponse {
    const userRole = req.headers.get('x-user-role') as UserRole | null;
    const orgId = req.headers.get('x-org-id');
    const sessionId = req.headers.get('x-session-id') || 'unknown';

    // Check role
    if (!userRole || !requiredRoles.includes(userRole)) {
      if (logViolations) {
        logger.warn('[Auth Guard] Role check failed', {
          endpoint: req.nextUrl.pathname,
          method: req.method,
          userRole,
          requiredRoles,
          sessionId: sessionId.substring(0, 8) + '...',
          ip: req.headers.get('x-forwarded-for') || 'unknown',
        });
      }

      return NextResponse.json(
        {
          ok: false,
          error: errorMessage,
          code: 'ROLE_REQUIRED',
          required: requiredRoles,
          actual: userRole || 'UNKNOWN',
        },
        { status: 403 }
      );
    }

    // Check orgId if required (non-admin users need it)
    if (requireOrgId && userRole !== 'GLOBAL_ADMIN') {
      if (!orgId || orgId.trim() === '') {
        if (logViolations) {
          logger.warn('[Auth Guard] OrgId check failed', {
            endpoint: req.nextUrl.pathname,
            method: req.method,
            userRole,
            hasOrgId: false,
            sessionId: sessionId.substring(0, 8) + '...',
            ip: req.headers.get('x-forwarded-for') || 'unknown',
          });
        }

        return NextResponse.json(
          {
            ok: false,
            error: '조직 컨텍스트가 필요합니다.',
            code: 'ORG_ID_REQUIRED',
          },
          { status: 403 }
        );
      }
    }

    return true;
  };
}

/**
 * Preset auth guards for common use cases
 */
export const authGuards = {
  /**
   * Admin-only endpoints: /api/admin/*
   * Only GLOBAL_ADMIN
   */
  adminOnly: createAuthGuard(['GLOBAL_ADMIN'], {
    requireOrgId: false,
    errorMessage: '관리자 권한이 필요합니다.',
  }),

  /**
   * Owner-level endpoints: Can manage team
   * OWNER + GLOBAL_ADMIN
   */
  ownerOrAdmin: createAuthGuard(['OWNER', 'GLOBAL_ADMIN'], {
    requireOrgId: true,
    errorMessage: '대리점장 권한이 필요합니다.',
  }),

  /**
   * Team member endpoints: Read most data
   * OWNER + AGENT + GLOBAL_ADMIN
   */
  teamMember: createAuthGuard(['OWNER', 'AGENT', 'GLOBAL_ADMIN'], {
    requireOrgId: true,
    errorMessage: '조직 구성원 권한이 필요합니다.',
  }),

  /**
   * Sales-only endpoints: Cannot access admin
   * OWNER + AGENT (not GLOBAL_ADMIN for data isolation)
   */
  organizationOnly: createAuthGuard(['OWNER', 'AGENT'], {
    requireOrgId: true,
    errorMessage: '조직 구성원만 접근할 수 있습니다.',
  }),
};

/**
 * Helper: Extract auth headers from request
 */
export function getAuthHeaders(req: NextRequest) {
  return {
    sessionId: req.headers.get('x-session-id'),
    userRole: req.headers.get('x-user-role') as UserRole | null,
    orgId: req.headers.get('x-org-id'),
    isAdmin: req.headers.get('x-is-admin') === 'true',
  };
}

/**
 * Helper: Get request metadata for logging
 */
export function getRequestMetadata(req: NextRequest) {
  return {
    pathname: req.nextUrl.pathname,
    method: req.method,
    ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
    userAgent: req.headers.get('user-agent') || 'unknown',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Helper: Log authorization event
 */
export function logAuthEvent(
  req: NextRequest,
  status: 'allowed' | 'denied' | 'error',
  reason?: string
) {
  const auth = getAuthHeaders(req);
  const meta = getRequestMetadata(req);

  logger.log(`[Auth Event] ${status.toUpperCase()}`, {
    ...meta,
    userRole: auth.userRole,
    orgId: auth.orgId ? auth.orgId.substring(0, 8) + '...' : null,
    sessionId: auth.sessionId ? auth.sessionId.substring(0, 8) + '...' : null,
    reason,
  });
}

/**
 * Main auth middleware for API routes
 *
 * Combines createAuthGuard with request validation.
 * Returns validated auth info or null if unauthorized.
 *
 * Usage:
 * ```
 * export async function GET(req: NextRequest) {
 *   const auth = await authMiddleware(req, ['OWNER', 'GLOBAL_ADMIN']);
 *   if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *   // Proceed with validated auth context
 * }
 * ```
 */
export async function authMiddleware(
  req: NextRequest,
  requiredRoles?: UserRole[],
  options?: {
    requireOrgId?: boolean;
    logViolations?: boolean;
    errorMessage?: string;
  }
) {
  // 세션 쿠키 기반으로 DB에서 직접 검증 (헤더 신뢰 X)
  const session = await getMabizSession();
  if (!session?.userId) {
    logAuthEvent(req, 'denied', 'No valid session');
    return null;
  }

  const userRole = session.role as UserRole;

  if (requiredRoles && !requiredRoles.includes(userRole)) {
    logAuthEvent(req, 'denied', `Insufficient role: ${userRole}`);
    return null;
  }

  if (options?.requireOrgId && !session.organizationId) {
    logAuthEvent(req, 'denied', 'Missing organization ID');
    return null;
  }

  logAuthEvent(req, 'allowed', `Authenticated as ${userRole}`);
  return {
    sessionId: session.userId,
    userRole,
    orgId: session.organizationId ?? null,
    isAdmin: session.role === 'GLOBAL_ADMIN',
  };
}
