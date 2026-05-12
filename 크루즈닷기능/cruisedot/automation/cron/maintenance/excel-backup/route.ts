// app/api/cron/excel-backup/route.ts
// 월별 엑셀 자동 백업 크론잡

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { uploadAllExcels } from '@/lib/affiliate/excel-backup';

export async function GET(request: NextRequest) {
  try {
    // Vercel Cron 인증 (선택 사항)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 지난 달 데이터 백업
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const period = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

    console.log(`[Cron] Excel backup starting for period: ${period}`);

    const results = await uploadAllExcels(period);

    console.log(`[Cron] Excel backup completed:`, results);

    return NextResponse.json({
      success: true,
      period,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error: any) {
    console.error('[Cron Excel Backup] Error:', error);
    return NextResponse.json(
      {
        error: '크론 백업 실패',
        details: error?.message || String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
