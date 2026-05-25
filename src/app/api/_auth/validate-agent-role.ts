import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * Validates that user has OWNER or AGENT role (organization member)
 *
 * Checks:
 * 1. x-user-role in ['OWNER', 'AGENT', 'GLOBAL_ADMIN']
 * 2. x-org-id header is present (not empty)
 *
 * Blocks:
 * - FREE_SALES users (no org access)
 * - Unauthenticated users
 *
 * @param req - NextRequest object with injected auth headers
 * @returns true if authorized, Response with 403 if not
 */
export function validateAgentRole(req: NextRequest): true | NextResponse {
  const userRole = req.headers.get('x-user-role');
  const orgId = req.headers.get('x-org-id');
  const sessionId = req.headers.get('x-session-id') || 'unknown';

  // Allow GLOBAL_ADMIN, OWNER, AGENT
  const validRoles = ['OWNER', 'AGENT', 'GLOBAL_ADMIN'];
  const isValidRole = validRoles.includes(userRole || '');
  const hasOrgId = orgId && orgId.trim() !== '';

  if (!isValidRole || (userRole !== 'GLOBAL_ADMIN' && !hasOrgId)) {
    logger.warn('[API Auth] Agent-level endpoint blocked', {
      endpoint: req.nextUrl.pathname,
      method: req.method,
      userRole,
      hasOrgId,
      sessionId: sessionId.substring(0, 8) + '...',
      ip: req.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json(
      {
        ok: false,
        error: '조직 구성원 권한이 필요합니다.',
        code: 'AGENT_ROLE_REQUIRED',
      },
      { status: 403 }
    );
  }

  return true;
}

/**
 * Alias for validateAgentRole - validates organization membership
 * Checks that user has OWNER, AGENT, or GLOBAL_ADMIN role with orgId
 *
 * @param req - NextRequest object with injected auth headers
 * @returns true if authorized, Response with 403 if not
 */
export function validateOrgMembership(req: NextRequest): true | NextResponse {
  return validateAgentRole(req);
}
