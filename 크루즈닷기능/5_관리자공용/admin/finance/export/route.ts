export const dynamic = 'force-dynamic';

// app/api/admin/finance/export/route.ts
// 재무 데이터 엑셀 다운로드 (payslip-excel 엔드포인트로 위임)

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || !['admin', 'superadmin'].includes(user.role ?? '')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 실제 엑셀 다운로드는 /api/admin/finance/payslip-excel 엔드포인트를 사용한다.
    // 쿼리파라미터를 그대로 전달하여 리다이렉트한다.
    const { searchParams } = new URL(req.url);
    const redirectUrl = new URL('/api/admin/finance/payslip-excel', req.url);
    searchParams.forEach((value, key) => {
      redirectUrl.searchParams.set(key, value);
    });

    logger.debug('[Admin Finance Export] Redirecting to payslip-excel', {
      adminId: user.id,
      params: Object.fromEntries(searchParams.entries()),
    });

    return NextResponse.redirect(redirectUrl.toString());
  } catch (error) {
    logger.error('[Admin Finance Export] 내보내기 실패', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: '내보내기 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
