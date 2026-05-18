/**
 * Phase 3-α: ExecutionLog 성능 벤치마크
 *
 * 목적:
 * - ExecutionLog 응답시간 측정 (200ms 이내 목표)
 * - 부분 인덱스 효과 검증
 * - DB 풀 설정 영향 분석
 *
 * 사용:
 * $ npx ts-node scripts/benchmark-execution-log.ts
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

interface BenchmarkResult {
  query: string;
  duration: number; // ms
  rowCount: number;
  isOptimal: boolean;
}

const RESPONSE_TIME_LIMIT = 200; // ms

async function runBenchmarks(): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  try {
    logger.info('[Benchmark] ExecutionLog 성능 측정 시작');

    // 1. today-stats API: 오늘 캠페인 통계 (groupBy)
    const start1 = Date.now();
    const campaignStats = await prisma.executionLog.groupBy({
      by: ['sourceId'],
      where: {
        organizationId: { not: 'test' }, // 테스트 데이터 제외
        sourceType: 'CAMPAIGN',
        scheduledAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lte: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      },
      _count: { id: true },
    });
    const duration1 = Date.now() - start1;
    results.push({
      query: 'groupBy (today-stats)',
      duration: duration1,
      rowCount: campaignStats.length,
      isOptimal: duration1 <= RESPONSE_TIME_LIMIT,
    });

    // 2. Cron 재시도 검색 (RETRY_SCHEDULED)
    const start2 = Date.now();
    const retryTargets = await prisma.executionLog.count({
      where: {
        status: 'RETRY_SCHEDULED',
        nextRetryAt: {
          lte: new Date(),
        },
      },
    });
    const duration2 = Date.now() - start2;
    results.push({
      query: 'count (retry targets)',
      duration: duration2,
      rowCount: retryTargets,
      isOptimal: duration2 <= RESPONSE_TIME_LIMIT,
    });

    // 3. 캠페인별 상태 조회 (campaign-specific)
    const start3 = Date.now();
    const campaignStatus = await prisma.executionLog.groupBy({
      by: ['status', 'channel'],
      where: {
        organizationId: { not: 'test' },
        sourceType: 'CAMPAIGN',
        createdAt: {
          gte: new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000), // 7일
        },
      },
      _count: { id: true },
    });
    const duration3 = Date.now() - start3;
    results.push({
      query: 'groupBy (campaign status)',
      duration: duration3,
      rowCount: campaignStatus.length,
      isOptimal: duration3 <= RESPONSE_TIME_LIMIT,
    });

    // 4. Contact별 발송이력 (contact-specific)
    const start4 = Date.now();
    const firstContact = await prisma.contact.findFirst({
      where: { organizationId: { not: 'test' } },
      select: { id: true },
    });

    if (firstContact) {
      const contactHistory = await prisma.executionLog.findMany({
        where: {
          contactId: firstContact.id,
        },
        select: { id: true, status: true, executeMonth: true },
        take: 100,
      });
      const duration4 = Date.now() - start4;
      results.push({
        query: 'findMany (contact history)',
        duration: duration4,
        rowCount: contactHistory.length,
        isOptimal: duration4 <= RESPONSE_TIME_LIMIT,
      });
    }

    // 5. 상태별 조회 (status filtering)
    const start5 = Date.now();
    const pendingCount = await prisma.executionLog.count({
      where: {
        organizationId: { not: 'test' },
        status: 'PENDING',
      },
    });
    const duration5 = Date.now() - start5;
    results.push({
      query: 'count (pending status)',
      duration: duration5,
      rowCount: pendingCount,
      isOptimal: duration5 <= RESPONSE_TIME_LIMIT,
    });

    // 결과 출력
    logger.info('[Benchmark] 성능 측정 완료');
    console.table(results.map(r => ({
      Query: r.query,
      'Duration (ms)': r.duration,
      'Rows': r.rowCount,
      'Status': r.isOptimal ? '✓ PASS' : '✗ FAIL',
    })));

    // 요약
    const passed = results.filter(r => r.isOptimal).length;
    const total = results.length;
    const avgDuration = Math.round(results.reduce((sum, r) => sum + r.duration, 0) / results.length);

    console.log(`\n[Summary]
Total: ${total}
Passed: ${passed}/${total}
Average Duration: ${avgDuration}ms
Target: ${RESPONSE_TIME_LIMIT}ms
Status: ${passed === total ? '✓ ALL OPTIMAL' : `✗ ${total - passed} QUERIES SLOW`}`);

    return results;
  } catch (err) {
    logger.error('[Benchmark] 성능 측정 실패', { err });
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

// CLI 실행
if (require.main === module) {
  runBenchmarks()
    .then((results) => {
      const allOptimal = results.every(r => r.isOptimal);
      process.exit(allOptimal ? 0 : 1);
    })
    .catch((err) => {
      console.error('[Benchmark] Error:', err);
      process.exit(1);
    });
}

export { runBenchmarks };
