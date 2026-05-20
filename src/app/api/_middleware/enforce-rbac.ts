import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export type AllowedRole = 'GLOBAL_ADMIN' | 'OWNER' | 'AGENT' | 'FREE_SALES';

export interface RBACOptions {
  /** Array of allowed roles. If empty, only auth header presence is checked */
  allowedRoles?: AllowedRole[];
  /** Custom error message (default: '접근 권한이 없습니다') */
  errorMessage?: string;
  /** If true, skip role check and only verify auth headers exist */
  authOnly?: boolean;
  /** If true, log all requests (not just denials) */
  logAll?: boolean;
}

/**
 * Enforce RBAC for API endpoints
 *
 * Usage:
 *   const result = enforceRBAC(request, { allowedRoles: ['GLOBAL_ADMIN', 'OWNER'] });
 *   if (result !== true) return result; // Returns 403 NextResponse if denied
 *
 * @param request - NextRequest with auth headers injected by middleware.ts
 * @param options - RBAC configuration
 * @returns true if authorized, NextResponse with 403 if denied
 */
export function enforceRBAC(
  request: NextRequest,
  options: RBACOptions = {}
): true | NextResponse {
  const {
    allowedRoles = [],
    errorMessage = '접근 권한이 없습니다.',
    authOnly = false,
    logAll = false,
  } = options;

  const userRole = request.headers.get('x-user-role');
  const isAdmin = request.headers.get('x-is-admin') === 'true';
  const sessionId = request.headers.get('x-session-id') || 'unknown';
  const orgId = request.headers.get('x-org-id') || '';
  const pathname = request.nextUrl.pathname;
  const method = request.method;

  // ──────────────────────────────────────────────────────────
  // 1. Check auth headers exist
  // ──────────────────────────────────────────────────────────
  if (!userRole || !sessionId) {
    logger.warn('[RBAC] Missing auth headers', {
      endpoint: pathname,
      method,
      hasUserRole: !!userRole,
      hasSessionId: !!sessionId,
      ip: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json(
      {
        ok: false,
        error: '인증이 필요합니다.',
        code: 'AUTH_REQUIRED',
      },
      { status: 401 }
    );
  }

  // ──────────────────────────────────────────────────────────
  // 2. Auth-only mode: just verify headers exist
  // ──────────────────────────────────────────────────────────
  if (authOnly) {
    if (logAll) {
      logger.log('[RBAC] Auth-only check passed', {
        endpoint: pathname,
        method,
        userRole,
        isAdmin,
      });
    }
    return true;
  }

  // ──────────────────────────────────────────────────────────
  // 3. Role-based check
  // ──────────────────────────────────────────────────────────
  if (allowedRoles.length === 0) {
    // No role restrictions specified - allow all authenticated users
    if (logAll) {
      logger.log('[RBAC] No role restrictions specified', {
        endpoint: pathname,
        method,
        userRole,
      });
    }
    return true;
  }

  // Normalize admin check: GLOBAL_ADMIN role OR x-is-admin header
  const hasRequiredRole = allowedRoles.includes(userRole as AllowedRole) ||
    (isAdmin && allowedRoles.includes('GLOBAL_ADMIN'));

  if (!hasRequiredRole) {
    logger.warn('[RBAC] Insufficient permissions', {
      endpoint: pathname,
      method,
      userRole,
      isAdmin,
      allowedRoles,
      organizationId: orgId || 'none',
      sessionId: sessionId.substring(0, 8) + '...',
      ip: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json(
      {
        ok: false,
        error: errorMessage,
        code: 'FORBIDDEN',
      },
      { status: 403 }
    );
  }

  if (logAll) {
    logger.log('[RBAC] Authorization passed', {
      endpoint: pathname,
      method,
      userRole,
      isAdmin,
      allowedRoles,
    });
  }

  return true;
}

/**
 * Enforce RBAC with organization ID check
 * Ensures user has access to the specified organization
 *
 * @param request - NextRequest with auth headers
 * @param targetOrgId - Organization ID to check access for
 * @param options - Additional RBAC options
 * @returns true if authorized, NextResponse with 403 if denied
 */
export function enforceRBACWithOrg(
  request: NextRequest,
  targetOrgId: string | null,
  options: RBACOptions = {}
): true | NextResponse {
  // First check basic RBAC
  const basicCheck = enforceRBAC(request, options);
  if (basicCheck !== true) return basicCheck;

  // GLOBAL_ADMIN can access any org
  const isAdmin = request.headers.get('x-is-admin') === 'true';
  if (isAdmin) return true;

  // For org-specific endpoints, user's org must match target org
  const userOrgId = request.headers.get('x-org-id');
  const userRole = request.headers.get('x-user-role');

  if (userRole !== 'GLOBAL_ADMIN' && targetOrgId && userOrgId !== targetOrgId) {
    logger.warn('[RBAC] Organization mismatch', {
      endpoint: request.nextUrl.pathname,
      method: request.method,
      userOrgId,
      targetOrgId,
      userRole,
      ip: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json(
      {
        ok: false,
        error: '해당 조직에 대한 접근 권한이 없습니다.',
        code: 'ORG_FORBIDDEN',
      },
      { status: 403 }
    );
  }

  return true;
}

/**
 * Get auth context from request headers
 * Safe way to extract auth info in API routes
 */
export function getAuthFromRequest(request: NextRequest) {
  return {
    sessionId: request.headers.get('x-session-id') || '',
    userRole: (request.headers.get('x-user-role') || '') as AllowedRole,
    isAdmin: request.headers.get('x-is-admin') === 'true',
    organizationId: request.headers.get('x-org-id') || null,
  };
}
