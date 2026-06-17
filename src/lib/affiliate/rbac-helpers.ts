import { NextResponse } from 'next/server';
import type { MabizAuthContext } from '@/lib/auth';

/**
 * OWNER 또는 GLOBAL_ADMIN 권한을 검증합니다.
 * 통과하면 null, 실패하면 NextResponse(401 또는 403)를 반환합니다.
 *
 * 사용 예시:
 *   const authError = requireOwnerOrAdmin(session);
 *   if (authError) return authError;
 */
export function requireOwnerOrAdmin(
  session: MabizAuthContext | null
): NextResponse | null {
  if (!session?.userId || !session?.organizationId) {
    return NextResponse.json(
      { ok: false, error: '인증이 필요합니다.' },
      { status: 401 }
    );
  }
  if (session.role !== 'OWNER' && session.role !== 'GLOBAL_ADMIN') {
    return NextResponse.json(
      { ok: false, error: '권한이 없습니다.' },
      { status: 403 }
    );
  }
  return null;
}
