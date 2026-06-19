/**
 * 🗑️ 삭제 유예기간 만료 처리
 * Cron: 매일 8:00 PM (20:00)
 *
 * 30일 유예기간 만료된 Contact 영구 삭제
 * (GDPR Right to be Forgotten 구현)
 *
 * 2026-05-27 Compliance Monitor Agent
 */

import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { dataDeletionManager } from '@/lib/compliance/data-deletion';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    // Cron secret 검증
    const expectedToken = process.env.CRON_SECRET;
    if (!expectedToken) {
      return NextResponse.json({ error: 'CRON_SECRET 미설정' }, { status: 503 });
    }
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const tokenBuf = Buffer.from(token, 'utf8');
    const expectedBuf = Buffer.from(expectedToken, 'utf8');
    if (tokenBuf.byteLength !== expectedBuf.byteLength || !timingSafeEqual(tokenBuf, expectedBuf)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
        error: '서버 오류가 발생했습니다.',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
