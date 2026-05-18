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
    performance.mark('q1-start');
    const campaignStats = await prisma.executionLog.groupBy({
      by: ['sourceId'],
      where: {
        organizationId: { not: 'test_org_benchmark' }, // 테스트 데이터 격리
        sourceType: 'CAMPAIGN',
        scheduledAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lte: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      },
      _count: { id: true },
    });
    performance.mark('q1-end');
    const measure1 = performance.measure('q1', 'q1-start', 'q1-end');
    const duration1 = Math.round(measure1.duration * 100) / 100;
    results.push({
      query: 'groupBy (today-stats)',
      duration: duration1,
      rowCount: campaignStats.length,
      isOptimal: duration1 <= RESPONSE_TIME_LIMIT,
    });

    // 2. Cron 재시도 검색 (RETRY_SCHEDULED)
    performance.mark('q2-start');
    const retryTargets = await prisma.executionLog.count({
      where: {
        organizationId: { not: 'test_org_benchmark' },
        status: 'RETRY_SCHEDULED',
        nextRetryAt: {
          lte: new Date(),
        },
      },
    });
    performance.mark('q2-end');
    const measure2 = performance.measure('q2', 'q2-start', 'q2-end');
    const duration2 = Math.round(measure2.duration * 100) / 100;
    results.push({
      query: 'count (retry targets)',
      duration: duration2,
      rowCount: retryTargets,
      isOptimal: duration2 <= RESPONSE_TIME_LIMIT,
    });

    // 3. 캠페인별 상태 조회 (campaign-specific)
    performance.mark('q3-start');
    const campaignStatus = await prisma.executionLog.groupBy({
      by: ['status', 'channel'],
      where: {
        organizationId: { not: 'test_org_benchmark' },
        sourceType: 'CAMPAIGN',
        createdAt: {
          gte: new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000), // 7일
        },
      },
      _count: { id: true },
    });
    performance.mark('q3-end');
    const measure3 = performance.measure('q3', 'q3-start', 'q3-end');
    const duration3 = Math.round(measure3.duration * 100) / 100;
    results.push({
      query: 'groupBy (campaign status)',
      duration: duration3,
      rowCount: campaignStatus.length,
      isOptimal: duration3 <= RESPONSE_TIME_LIMIT,
    });

    // 4. Contact별 발송이력 (contact-specific)
    performance.mark('q4-start');
    const firstContact = await prisma.contact.findFirst({
      where: { organizationId: { not: 'test_org_benchmark' } },
      select: { id: true },
    });

    if (firstContact) {
      const contactHistory = await prisma.executionLog.findMany({
        where: {
          organizationId: { not: 'test_org_benchmark' },
          contactId: firstContact.id,
        },
        select: { id: true, status: true, executeMonth: true },
        take: 100,
      });
      performance.mark('q4-end');
      const measure4 = performance.measure('q4', 'q4-start', 'q4-end');
      const duration4 = Math.round(measure4.duration * 100) / 100;
      results.push({
        query: 'findMany (contact history)',
        duration: duration4,
        rowCount: contactHistory.length,
        isOptimal: duration4 <= RESPONSE_TIME_LIMIT,
      });
    }

    // 5. 상태별 조회 (status filtering)
    performance.mark('q5-start');
    const pendingCount = await prisma.executionLog.count({
      where: {
        organizationId: { not: 'test_org_benchmark' },
        status: 'PENDING',
      },
    });
    performance.mark('q5-end');
    const measure5 = performance.measure('q5', 'q5-start', 'q5-end');
    const duration5 = Math.round(measure5.duration * 100) / 100;
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
