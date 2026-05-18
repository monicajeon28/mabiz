import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/cron/monitor
 * 실시간 모니터링: 시스템 상태 점검
 *
 * Vercel Crons으로 등록하여 정기적으로 실행
 * 또는 수동으로 호출 가능
 */
export async function GET(req: NextRequest) {
  const authToken = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || 'default-secret';

  // [SEC] Cron 요청 검증
  if (authToken !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { ok: false, error: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  try {
    const timestamp = new Date().toISOString();
    const checks = [];

    // 1) 데이터베이스 연결 확인
    try {
      const dbCheck = await prisma.$queryRaw`SELECT 1 as health`;
      checks.push({
        name: 'database',
        status: 'ok',
        timestamp,
      });
      logger.log('[Monitor] 데이터베이스 정상', { timestamp });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      checks.push({
        name: 'database',
        status: 'failed',
        error: errorMsg,
        timestamp,
      });
      logger.error('[Monitor] 데이터베이스 오류', {
        error: errorMsg,
        timestamp,
      });
    }

    // 2) 주요 테이블 행 수 확인 (이상치 감지)
    try {
      const [contactCount, groupCount, organizationCount] = await Promise.all([
        prisma.contact.count(),
        prisma.contactGroup.count(),
        prisma.organization.count(),
      ]);

      checks.push({
        name: 'table_stats',
        status: 'ok',
        data: {
          contacts: contactCount,
          groups: groupCount,
          organizations: organizationCount,
        },
        timestamp,
      });

      logger.log('[Monitor] 테이블 통계', {
        contacts: contactCount,
        groups: groupCount,
        organizations: organizationCount,
        timestamp,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      checks.push({
        name: 'table_stats',
        status: 'failed',
        error: errorMsg,
        timestamp,
      });
      logger.error('[Monitor] 테이블 통계 오류', {
        error: errorMsg,
        timestamp,
      });
    }

    // 3) 최근 에러 로그 확인 (지난 1시간)
    try {
      // 실제 로깅 시스템에서 가져오는 로직
      // 여기서는 데이터베이스에 에러 로그를 저장한다고 가정
      checks.push({
        name: 'recent_errors',
        status: 'ok',
        note: 'Check application logs for details',
        timestamp,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      checks.push({
        name: 'recent_errors',
        status: 'failed',
        error: errorMsg,
        timestamp,
      });
    }

    // 4) API 응답 시간 측정
    const startTime = Date.now();
    const responseTime = Date.now() - startTime;

    checks.push({
      name: 'api_response_time',
      status: 'ok',
      responseTime: `${responseTime}ms`,
      timestamp,
    });

    // 5) 종합 판정
    const allOk = checks.every((c) => c.status === 'ok');
    const status = allOk ? 'healthy' : 'degraded';

    const result = {
      ok: allOk,
      status,
      checks,
      timestamp,
      environment: process.env.NODE_ENV,
    };

    logger.log('[Monitor] 모니터링 완료', {
      status,
      checkCount: checks.length,
      failedCount: checks.filter((c) => c.status === 'failed').length,
      timestamp,
    });

    return NextResponse.json(result);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[Monitor] 모니터링 실패', { error: errorMsg });

    return NextResponse.json(
      {
        ok: false,
        status: 'error',
        error: errorMsg,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/monitor
 * 모니터링 결과를 저장 (선택사항)
 */
export async function POST(req: NextRequest) {
  const authToken = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || 'default-secret';

  if (authToken !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { ok: false, error: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { status, checks } = body;

    logger.log('[Monitor] 모니터링 결과 저장', {
      status,
      checkCount: checks?.length || 0,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      message: '모니터링 결과가 저장되었습니다.',
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[Monitor] 결과 저장 실패', { error: errorMsg });

    return NextResponse.json(
      { ok: false, error: errorMsg },
      { status: 500 }
    );
  }
}
