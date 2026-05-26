import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { MABIZ_SESSION_COOKIE } from '@/lib/auth';

export async function POST() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(MABIZ_SESSION_COOKIE)?.value;

  if (sid) {
    try {
      await prisma.mabizSession.delete({ where: { id: sid } });
    } catch (err) {
      // P0-SEC-M5: Session 삭제 실패 로깅 (무한 좀비 세션 방지)
      logger.error('[Logout] Session 삭제 실패', {
        sid,
        error: err instanceof Error ? err.message : String(err),
      });
      // 쿠키는 삭제 (클라이언트 side에서 세션 종료)
    }
    cookieStore.delete(MABIZ_SESSION_COOKIE);
  }

  return NextResponse.json({ ok: true });
}
