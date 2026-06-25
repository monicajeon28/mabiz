/**
 * Auth Headers Types
 * Types for X-Session-ID, X-User-Role, X-Org-ID, X-Is-Admin headers
 * injected by middleware.ts
 */

/**
 * User role types from mabiz_admin and organization_member tables
 * GLOBAL_ADMIN: Global administrator (mabiz_admin)
 * OWNER: Organization owner / 지사장 (organization_member)
 * AGENT: Sales agent / 대리점장 (organization_member)
 * MEMBER: Legacy member (organization_member)
 * FREE_SALES: Pre-sales / 마케터 (organization_member)
 * UNKNOWN: Unauthenticated
 */
export type AuthRole = 'GLOBAL_ADMIN' | 'OWNER' | 'AGENT' | 'MEMBER' | 'FREE_SALES' | 'UNKNOWN';

/**
 * Auth headers object injected into NextRequest by middleware
 */
export interface AuthHeaders {
  /** Session ID from mabiz_session.id */
  sessionId: string | null;

  /** User role: GLOBAL_ADMIN for admin sessions, MEMBER for member sessions */
  userRole: AuthRole;

  /** Organization ID from mabiz_session.organization_id (null for admins) */
  orgId: string | null;

  /** Whether user is GLOBAL_ADMIN (userRole === 'GLOBAL_ADMIN') */
  isAdmin: boolean;
}

/**
 * Session validation result from database
 */
export interface SessionValidationResult {
  valid: boolean;
  role?: AuthRole;
  organizationId?: string | null;
  adminId?: string | null;
}

/**
 * Helper to parse auth headers from NextRequest
 */
export function parseAuthHeaders(
  headers: Headers
): AuthHeaders {
  const sessionId = headers.get('x-session-id');
  const userRole = (headers.get('x-user-role') || 'UNKNOWN') as AuthRole;
  const orgId = headers.get('x-org-id') || null;
  const isAdmin = headers.get('x-is-admin') === 'true';

  return {
    sessionId,
    userRole,
    orgId,
    isAdmin,
  };
}

/**
 * Helper to set auth headers on NextRequest
 */
export function setAuthHeaders(
  headers: Headers,
  auth: Partial<AuthHeaders>
): void {
  if (auth.sessionId !== undefined) {
    headers.set('x-session-id', auth.sessionId || '');
  }
  if (auth.userRole !== undefined) {
    headers.set('x-user-role', auth.userRole);
  }
  if (auth.orgId !== undefined) {
    headers.set('x-org-id', auth.orgId || '');
  }
  if (auth.isAdmin !== undefined) {
    headers.set('x-is-admin', auth.isAdmin.toString());
  }
}
