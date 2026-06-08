/**
 * Passport Query Performance Benchmark
 * ====================================
 *
 * 실행: npx ts-node src/lib/passport-benchmark.test.ts
 *
 * 기대 결과:
 * - SELECT 500명: < 700ms (쿼리 500ms + 계산 200ms)
 * - 필터링: < 100ms
 * - 마스킹: < 50ms
 * 전체: < 2초 ✅
 */

import { benchmarkQueries } from './passport-queries';

async function main() {
  // Test Trip ID: 1 (실제 DB에서 조정 필요)
  const tripId = 1;

  try {
    const results = await benchmarkQueries(tripId);

    // 검증
    const isSuccess = results.total < 2000;
    const exitCode = isSuccess ? 0 : 1;

    console.log(`\n=== Benchmark ${isSuccess ? 'PASSED ✅' : 'FAILED ❌'} ===`);
    process.exit(exitCode);
  } catch (error) {
    console.error('Benchmark error:', error);
    process.exit(1);
  }
}

main();
