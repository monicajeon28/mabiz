import { NextRequest, NextResponse } from 'next/server';
import { processSmsQueue, getSmsQueueStatus } from '@/lib/sms-queue';
import { logger } from '@/lib/logger';

/**
 * SMS 로그 큐 처리 엔드포인트
 * - Vercel Cron 또는 외부 스케줄러에서 주기적으로 호출
 * - Redis 큐에서 배치로 읽어 DB에 저장
 *
 * 사용: POST /api/queues/sms-process
 * 헤더: Authorization: Bearer <SECRET_QUEUE_TOKEN> (선택)
 */
export async function POST(request: NextRequest) {
  try {
    // 선택적 인증 (환경변수 설정 시)
    const authToken = request.headers.get('authorization')?.replace('Bearer ', '');
    const expectedToken = process.env.QUEUE_WORKER_TOKEN;

    if (expectedToken && authToken !== expectedToken) {
      logger.warn('[SMS Queue API] 인증 실패', {
        hasToken: !!authToken,
      });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 큐 처리 실행
    await processSmsQueue();

    // 처리 후 상태 조회
    const status = await getSmsQueueStatus();

    return NextResponse.json({
      success: true,
      status,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[SMS Queue API] 처리 실패', { err });
    return NextResponse.json(
      { error: 'Internal Server Error', details: String(err) },
      { status: 500 }
    );
  }
}

/**
 * SMS 큐 상태 확인 엔드포인트
 * 사용: GET /api/queues/sms-process
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = request.headers.get('authorization')?.replace('Bearer ', '');
    const expectedToken = process.env.QUEUE_WORKER_TOKEN;

    if (expectedToken && authToken !== expectedToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const status = await getSmsQueueStatus();

    return NextResponse.json({
      success: true,
      status,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[SMS Queue API] 상태 조회 실패', { err });
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
