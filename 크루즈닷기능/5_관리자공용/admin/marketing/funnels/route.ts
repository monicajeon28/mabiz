export const dynamic = 'force-dynamic';

// app/api/admin/marketing/funnels/route.ts
// 마케팅 퍼널 목록 조회
// Prisma schema에 Funnel 모델 없음 — stub 반환

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || !['admin', 'superadmin'].includes(user.role ?? '')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    logger.debug('[Admin Marketing Funnels] GET called', { adminId: user.id });

    // Funnel 모델이 schema에 없으므로 빈 배열 반환 (준비 중)
    return NextResponse.json({
      ok: true,
      funnels: [],
      message: '마케팅 퍼널 기능은 준비 중입니다.',
    });
  } catch (error) {
    logger.error('[Admin Marketing Funnels] Error:', error);
    return NextResponse.json(
      { ok: false, error: '요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || !['admin', 'superadmin'].includes(user.role ?? '')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    logger.debug('[Admin Marketing Funnels] POST called', { adminId: user.id });

    // Funnel 모델이 schema에 없으므로 stub 응답
    return NextResponse.json(
      { ok: false, error: '마케팅 퍼널 기능은 준비 중입니다.' },
      { status: 501 }
    );
  } catch (error) {
    logger.error('[Admin Marketing Funnels] POST Error:', error);
    return NextResponse.json(
      { ok: false, error: '요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
