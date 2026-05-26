/**
 * 🗑️ 삭제 유예기간 만료 처리
 * Cron: 매일 8:00 PM (20:00)
 *
 * 30일 유예기간 만료된 Contact 영구 삭제
 * (GDPR Right to be Forgotten 구현)
 *
 * 2026-05-27 Compliance Monitor Agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { dataDeletionManager } from '@/lib/compliance/data-deletion';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    // Cron secret 검증
    const cronSecret = req.headers.get('x-cron-secret');
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    logger.info('🗑️ Starting Deletion Grace Period Expiration Process');

    // 만료된 삭제 요청 처리
    const deletedCount = await dataDeletionManager.processExpiredDeletionRequests();

    logger.info('✅ Deletion Grace Period Expiration Process Complete', {
      deletedCount,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      deletedCount,
      message: `${deletedCount}개의 Contact가 영구 삭제되었습니다`,
    });
  } catch (error) {
    logger.error('❌ Deletion Grace Period Expiration Failed', {
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
