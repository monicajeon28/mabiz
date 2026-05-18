/**
 * SMS Rate Limiter 단위 테스트
 *
 * 테스트 케이스:
 * 1. 초기 3개 토큰 - 즉시 발송 가능
 * 2. 토큰 부족 시 대기 시간 계산
 * 3. 시간 경과에 따른 토큰 재충전
 * 4. 초당 3건 속도 제한 검증
 */

import { getSmsRateLimiter, waitForSmsCapacity } from "./sms-rate-limiter";

describe("SmsRateLimiter", () => {
  beforeEach(() => {
    // 각 테스트마다 limiter 리셋
    const limiter = getSmsRateLimiter();
    limiter.reset();
  });

  it("초기 상태: 3개 토큰 사용 가능 (즉시 발송)", () => {
    const limiter = getSmsRateLimiter();

    // 처음 3건은 대기 없이 발송 가능
    expect(limiter.acquire()).toBe(0);
    expect(limiter.acquire()).toBe(0);
    expect(limiter.acquire()).toBe(0);

    // 4번째는 대기 필요
    const waitMs = limiter.acquire();
    expect(waitMs).toBeGreaterThan(0);
    expect(waitMs).toBeLessThanOrEqual(400); // ~333ms (1초 / 3개)
  });

  it("Rate Limit: 초당 3건 제한 준수", async () => {
    const limiter = getSmsRateLimiter();
    const startTime = Date.now();

    // 10개 토큰 요청 (초당 3개 → 약 3.3초 필요)
    for (let i = 0; i < 10; i++) {
      const waitMs = limiter.acquire();
      if (waitMs > 0) {
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
    }

    const elapsedMs = Date.now() - startTime;

    // 이론값: (10 tokens) / (3 tokens/sec) = 3.33초
    // 실제: 약 3초 이상, 5초 이하 (여유 있음)
    expect(elapsedMs).toBeGreaterThanOrEqual(2500);
    expect(elapsedMs).toBeLessThan(5000);
  });

  it("동시 요청 시뮬레이션: Promise.all 처리", async () => {
    const limiter = getSmsRateLimiter();

    // 6개 비동기 요청 (초당 3개 → 2초 필요)
    const startTime = Date.now();
    await Promise.all(
      Array(6)
        .fill(0)
        .map(async () => {
          const waitMs = limiter.acquire();
          if (waitMs > 0) {
            await new Promise(resolve => setTimeout(resolve, waitMs));
          }
          return "sent";
        })
    );
    const elapsedMs = Date.now() - startTime;

    // 실제: 약 1.5초 이상, 3초 이하
    expect(elapsedMs).toBeGreaterThanOrEqual(1000);
    expect(elapsedMs).toBeLessThan(3500);
  });

  it("getStatus(): 현재 토큰 상태 조회", () => {
    const limiter = getSmsRateLimiter();

    // 초기 상태
    let status = limiter.getStatus();
    expect(status.availableTokens).toBe(3);
    expect(status.maxTokens).toBe(3);
    expect(status.refillRate).toBe(3);

    // 1개 토큰 사용
    limiter.acquire();
    status = limiter.getStatus();
    expect(status.availableTokens).toBe(2);

    // 3개 토큰 모두 사용
    limiter.acquire();
    limiter.acquire();
    status = limiter.getStatus();
    expect(status.availableTokens).toBe(0);
  });

  it("waitForSmsCapacity(): 인터페이스 테스트", async () => {
    const limiter = getSmsRateLimiter();
    const startTime = Date.now();

    // 처음 3개는 즉시
    await waitForSmsCapacity();
    await waitForSmsCapacity();
    await waitForSmsCapacity();

    // 4번째는 대기
    await waitForSmsCapacity();

    const elapsedMs = Date.now() - startTime;
    // 약 300ms 이상 대기
    expect(elapsedMs).toBeGreaterThan(200);
    expect(elapsedMs).toBeLessThan(1500);
  });

  it("장시간 유휴 상태 → 토큰 충전", async () => {
    const limiter = getSmsRateLimiter();

    // 초기 토큰 소진
    limiter.acquire();
    limiter.acquire();
    limiter.acquire();

    // 1.5초 대기 (토큰 재충전 충분)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 다시 3개 사용 가능
    expect(limiter.acquire()).toBe(0);
    expect(limiter.acquire()).toBe(0);
    expect(limiter.acquire()).toBe(0);

    // 4번째는 대기
    expect(limiter.acquire()).toBeGreaterThan(0);
  });
});

// Load Test: 1500명 발송 시뮬레이션
describe("Performance: 1500-person Campaign", () => {
  it("Rate Limiter 오버헤드 측정", async () => {
    const limiter = getSmsRateLimiter();
    const contactCount = 1500;
    const batchSize = 150;

    const startTime = Date.now();

    // 배치별 처리 시뮬레이션
    for (let i = 0; i < contactCount; i += batchSize) {
      const batch = Math.min(batchSize, contactCount - i);

      // 배치 내 SMS 발송 루프 (Rate Limit 포함)
      for (let j = 0; j < batch; j++) {
        const waitMs = limiter.acquire();
        if (waitMs > 0) {
          await new Promise(resolve => setTimeout(resolve, waitMs));
        }
        // 실제 SMS 발송 시간 시뮬레이션 (100ms)
        // await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const elapsedMs = Date.now() - startTime;
    const elapsedSec = elapsedMs / 1000;

    // 1500명 ÷ 3명/초 = 500초
    // Rate Limiter 오버헤드 제외 시뮬레이션
    console.log(`Total time: ${elapsedSec.toFixed(2)}s for ${contactCount} contacts`);
    console.log(`Avg: ${(elapsedMs / contactCount).toFixed(1)}ms per contact`);

    // 최소 450초 이상 (Rate Limit 강제)
    expect(elapsedMs).toBeGreaterThanOrEqual(450000);

    // 최대 600초 이하 (합리적 범위)
    expect(elapsedMs).toBeLessThan(600000);
  });

  it("1500명을 5분 내 발송 가능성 검증", async () => {
    const limiter = getSmsRateLimiter();
    const contactCount = 1500;
    const batchSize = 150; // 배치 크기 150
    const batchCount = Math.ceil(contactCount / batchSize); // 10배치

    // 한 배치 처리 시간 추정: 150명 ÷ 3명/초 = 50초
    const estimatedTimePerBatch = (batchSize / 3) * 1000; // ms
    const estimatedTotal = estimatedTimePerBatch * batchCount;

    const fiveMinutesMs = 5 * 60 * 1000; // 300,000ms

    console.log(`Batch count: ${batchCount}`);
    console.log(`Estimated time per batch: ${estimatedTimePerBatch.toFixed(0)}ms`);
    console.log(`Estimated total time: ${estimatedTotal.toFixed(0)}ms (${(estimatedTotal / 1000).toFixed(1)}s)`);
    console.log(`5-minute limit: ${fiveMinutesMs}ms`);

    // 이론적으로 충분한가?
    expect(estimatedTotal).toBeLessThan(fiveMinutesMs);
  });
});
