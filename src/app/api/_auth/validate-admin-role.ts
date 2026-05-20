import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * Validates that user has GLOBAL_ADMIN or equivalent admin role
 *
 * Checks:
 * 1. x-is-admin header = 'true'
 * 2. x-user-role header = 'GLOBAL_ADMIN'
 *
 * @param req - NextRequest object with injected auth headers
 * @returns true if admin, Response with 403 if not
 */
export function validateAdminRole(req: NextRequest): true | NextResponse {
  const isAdmin = req.headers.get('x-is-admin') === 'true';
  const userRole = req.headers.get('x-user-role');
  const sessionId = req.headers.get('x-session-id') || 'unknown';

  if (!isAdmin && userRole !== 'GLOBAL_ADMIN') {
    logger.warn('[API Auth] Admin-only endpoint blocked', {
      endpoint: req.nextUrl.pathname,
      method: req.method,
      userRole,
      isAdmin,
      sessionId: sessionId.substring(0, 8) + '...',
      ip: req.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json(
      {
        ok: false,
        error: '관리자 권한이 필요합니다.',
        code: 'ADMIN_REQUIRED',
      },
      { status: 403 }
    );
  }

  return true;
}
