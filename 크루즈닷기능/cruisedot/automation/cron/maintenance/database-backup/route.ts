export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { manualRunDatabaseBackup } from '@/lib/scheduler/databaseBackup';

/**
 * Vercel Cron Job: 매일 오전 12시 (한국 시간) 데이터베이스 백업
 * 
 * Vercel Cron 설정:
 * {
 *   "path": "/api/cron/database-backup",
 *   "schedule": "0 3 * * *"  // UTC 오전 3시 = KST 오전 12시
 * }
 */
export async function GET(request: Request) {
  try {
    // Vercel Cron 요청 검증
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Cron] Database backup started');
    
    const result = await manualRunDatabaseBackup();

    return NextResponse.json({
      ok: true,
      message: 'Database backup completed',
      data: result,
    });
  } catch (error: any) {
    console.error('[Cron] Database backup error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'Database backup failed',
      },
      { status: 500 }
    );
  }
}
