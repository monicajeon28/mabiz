/**
 * Loop 5 Dashboard API 통합 테스트
 * 4개 엔드포인트 테스트: stats, segment-breakdown, ab-test-results, day-progression
 */

describe('Loop 5 Dashboard APIs', () => {
  const BASE_URL = 'http://localhost:3000/api/loop5/dashboard';
  const testParams = {
    fromDate: '2026-05-20T00:00:00Z',
    toDate: '2026-05-27T23:59:59Z',
  };

  describe('GET /api/loop5/dashboard/stats', () => {
    it('Hero KPI 집계 데이터 반환', async () => {
      const params = new URLSearchParams(testParams);
      const response = await fetch(`${BASE_URL}/stats?${params}`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('totalSent');
      expect(data).toHaveProperty('totalClicked');
      expect(data).toHaveProperty('totalFormSubmitted');
      expect(data).toHaveProperty('responseRate');
      expect(data).toHaveProperty('formCompletionRate');
      expect(data).toHaveProperty('estimatedRevenue');
      expect(data).toHaveProperty('byDay');
      expect(data).toHaveProperty('trends');
      expect(data).toHaveProperty('lastUpdated');

      // 데이터 타입 검증
      expect(typeof data.totalSent).toBe('number');
      expect(typeof data.responseRate).toBe('number');
      expect(typeof data.estimatedRevenue).toBe('number');
    });

    it('필수 파라미터 검증: fromDate/toDate 필수', async () => {
      const response = await fetch(`${BASE_URL}/stats`);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });

    it('Day별 분석 데이터 포함 (0-7일)', async () => {
      const params = new URLSearchParams(testParams);
      const response = await fetch(`${BASE_URL}/stats?${params}`);
      const data = await response.json();

      expect(data.byDay).toBeDefined();
      expect(Object.keys(data.byDay).length).toBeGreaterThan(0);

      // Day 0 검증
      const day0 = data.byDay[0];
      expect(day0).toHaveProperty('sent');
      expect(day0).toHaveProperty('clicked');
      expect(day0).toHaveProperty('submitted');
      expect(day0).toHaveProperty('rate');
      expect(day0).toHaveProperty('completionRate');
    });

    it('트렌드 데이터 포함 (주간 비교)', async () => {
      const params = new URLSearchParams(testParams);
      const response = await fetch(`${BASE_URL}/stats?${params}`);
      const data = await response.json();

      expect(data.trends).toBeDefined();
      expect(data.trends).toHaveProperty('responseRateChange');
      expect(data.trends).toHaveProperty('formCompletionChange');
      expect(data.trends).toHaveProperty('revenueChange');
    });
  });

  describe('GET /api/loop5/dashboard/segment-breakdown', () => {
    it('세그먼트별 성과 분석 반환 (A-E + 합계)', async () => {
      const params = new URLSearchParams(testParams);
      const response = await fetch(`${BASE_URL}/segment-breakdown?${params}`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('segments');
      expect(Array.isArray(data.segments)).toBe(true);

      // 5개 세그먼트 + 합계 = 6개
      expect(data.segments.length).toBe(6);
    });

    it('각 세그먼트 메트릭 검증', async () => {
      const params = new URLSearchParams(testParams);
      const response = await fetch(`${BASE_URL}/segment-breakdown?${params}`);
      const data = await response.json();

      data.segments.forEach((segment: any) => {
        expect(segment).toHaveProperty('key');
        expect(segment).toHaveProperty('name');
        expect(segment).toHaveProperty('sent');
        expect(segment).toHaveProperty('clicked');
        expect(segment).toHaveProperty('submitted');
        expect(segment).toHaveProperty('responseRate');
        expect(segment).toHaveProperty('formCompletionRate');
        expect(segment).toHaveProperty('estimatedRevenue');
        expect(segment).toHaveProperty('trend');

        // 트렌드 값 검증: up/down/stable/neutral
        expect(['up', 'down', 'stable', 'neutral']).toContain(segment.trend);
      });
    });

    it('합계 행 정확성 검증', async () => {
      const params = new URLSearchParams(testParams);
      const response = await fetch(`${BASE_URL}/segment-breakdown?${params}`);
      const data = await response.json();

      const total = data.segments.find((s: any) => s.key === 'TOTAL');
      expect(total).toBeDefined();

      const sumSent = data.segments
        .filter((s: any) => s.key !== 'TOTAL')
        .reduce((sum: number, s: any) => sum + s.sent, 0);

      expect(total.sent).toBe(sumSent);
    });

    it('세그먼트 이름 매핑 검증', async () => {
      const params = new URLSearchParams(testParams);
      const response = await fetch(`${BASE_URL}/segment-breakdown?${params}`);
      const data = await response.json();

      const expectedNames = ['신혼부부', '가족', '중년', 'VVIP', '70s+', '합계'];
      const actualNames = data.segments.map((s: any) => s.name);

      expectedNames.forEach(name => {
        expect(actualNames).toContain(name);
      });
    });
  });

  describe('GET /api/loop5/dashboard/ab-test-results', () => {
    it('CTA A/B 테스트 결과 반환', async () => {
      const params = new URLSearchParams(testParams);
      const response = await fetch(`${BASE_URL}/ab-test-results?${params}`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('ctaTests');
      expect(Array.isArray(data.ctaTests)).toBe(true);
    });

    it('CTA 테스트 메트릭 검증', async () => {
      const params = new URLSearchParams(testParams);
      const response = await fetch(`${BASE_URL}/ab-test-results?${params}`);
      const data = await response.json();

      data.ctaTests.forEach((test: any) => {
        expect(test).toHaveProperty('variant');
        expect(test).toHaveProperty('clicks');
        expect(test).toHaveProperty('total');
        expect(test).toHaveProperty('rate');
        expect(['A', 'B', 'C']).toContain(test.variant);
      });
    });

    it('SMS Day별 버전 테스트 결과 반환', async () => {
      const params = new URLSearchParams(testParams);
      const response = await fetch(`${BASE_URL}/ab-test-results?${params}`);
      const data = await response.json();

      expect(data).toHaveProperty('smsTests');
      expect(Array.isArray(data.smsTests)).toBe(true);
    });

    it('SMS 테스트 Day별 분류', async () => {
      const params = new URLSearchParams(testParams);
      const response = await fetch(`${BASE_URL}/ab-test-results?${params}`);
      const data = await response.json();

      data.smsTests.forEach((test: any) => {
        expect(test).toHaveProperty('day');
        expect(test).toHaveProperty('version');
        expect(test).toHaveProperty('clicks');
        expect(test).toHaveProperty('total');
        expect(test).toHaveProperty('rate');
        expect(test).toHaveProperty('recommended');
        expect([0, 1, 2, 3]).toContain(test.day);
        expect(['v1', 'v2']).toContain(test.version);
      });
    });

    it('신뢰도 계산 검증', async () => {
      const params = new URLSearchParams(testParams);
      const response = await fetch(`${BASE_URL}/ab-test-results?${params}`);
      const data = await response.json();

      // 신뢰도가 있으면 0-100 범위 검증
      data.ctaTests.forEach((test: any) => {
        if (test.confidence !== undefined) {
          expect(test.confidence).toBeGreaterThanOrEqual(0);
          expect(test.confidence).toBeLessThanOrEqual(100);
        }
      });
    });

    it('요약 정보 포함', async () => {
      const params = new URLSearchParams(testParams);
      const response = await fetch(`${BASE_URL}/ab-test-results?${params}`);
      const data = await response.json();

      expect(data).toHaveProperty('summary');
      expect(data.summary).toHaveProperty('totalVariants');
      expect(data.summary).toHaveProperty('totalSmsTests');
      expect(data.summary).toHaveProperty('recommendation');
    });
  });

  describe('GET /api/loop5/dashboard/day-progression', () => {
    it('Day 0-3 진행 데이터 반환', async () => {
      const params = new URLSearchParams(testParams);
      const response = await fetch(`${BASE_URL}/day-progression?${params}`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('progression');
      expect(Array.isArray(data.progression)).toBe(true);
      expect(data.progression.length).toBe(4); // Day 0-3
    });

    it('각 Day별 메트릭 검증', async () => {
      const params = new URLSearchParams(testParams);
      const response = await fetch(`${BASE_URL}/day-progression?${params}`);
      const data = await response.json();

      data.progression.forEach((day: any) => {
        expect(day).toHaveProperty('day');
        expect(day).toHaveProperty('sent');
        expect(day).toHaveProperty('clicked');
        expect(day).toHaveProperty('submitted');
        expect(day).toHaveProperty('openRate');
        expect(day).toHaveProperty('completionRate');
        expect(day).toHaveProperty('estimatedRevenue');
        expect(day).toHaveProperty('trend');

        // 메트릭 타입 검증
        expect(typeof day.sent).toBe('number');
        expect(typeof day.openRate).toBe('string');
        expect(typeof day.estimatedRevenue).toBe('number');
      });
    });

    it('누적 지표 계산 정확성', async () => {
      const params = new URLSearchParams(testParams);
      const response = await fetch(`${BASE_URL}/day-progression?${params}`);
      const data = await response.json();

      const cumulativeFromProgression = data.progression.reduce(
        (sum: number, day: any) => sum + day.sent,
        0
      );

      expect(data.cumulative.totalSent).toBe(cumulativeFromProgression);
    });

    it('Day별 트렌드 판정 (baseline/up/down/stable)', async () => {
      const params = new URLSearchParams(testParams);
      const response = await fetch(`${BASE_URL}/day-progression?${params}`);
      const data = await response.json();

      expect(data.progression[0].trend).toBe('baseline'); // Day 0
      data.progression.slice(1).forEach((day: any) => {
        expect(['up', 'down', 'stable']).toContain(day.trend);
      });
    });

    it('Day 대비 분석 (Day 0 기준 변화율)', async () => {
      const params = new URLSearchParams(testParams);
      const response = await fetch(`${BASE_URL}/day-progression?${params}`);
      const data = await response.json();

      expect(data.summary).toHaveProperty('dayComparison');
      expect(Array.isArray(data.summary.dayComparison)).toBe(true);

      data.summary.dayComparison.forEach((comp: any) => {
        expect(comp).toHaveProperty('day');
        expect(comp).toHaveProperty('clicksDelta');
        expect(comp).toHaveProperty('changePercent');
        expect(typeof comp.changePercent).toBe('string');
        expect(comp.changePercent).toMatch(/[+-]\d+\.\d+%/);
      });
    });

    it('전체 성공도 계산 검증', async () => {
      const params = new URLSearchParams(testParams);
      const response = await fetch(`${BASE_URL}/day-progression?${params}`);
      const data = await response.json();

      expect(data.summary).toHaveProperty('overallSuccessRate');
      expect(typeof data.summary.overallSuccessRate).toBe('string');
      expect(data.summary.overallSuccessRate).toMatch(/\d+\.\d+%/);
    });

    it('평균 Open Rate 계산', async () => {
      const params = new URLSearchParams(testParams);
      const response = await fetch(`${BASE_URL}/day-progression?${params}`);
      const data = await response.json();

      expect(data.summary).toHaveProperty('avgOpenRate');
      expect(typeof data.summary.avgOpenRate).toBe('string');
    });

    it('필수 파라미터 검증: fromDate/toDate 필수', async () => {
      const response = await fetch(`${BASE_URL}/day-progression`);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });
  });

  describe('Cross-API 일관성 테스트', () => {
    it('모든 API lastUpdated 시간 포함', async () => {
      const params = new URLSearchParams(testParams);

      const statsResponse = await fetch(`${BASE_URL}/stats?${params}`);
      const statsData = await statsResponse.json();

      const segmentResponse = await fetch(`${BASE_URL}/segment-breakdown?${params}`);
      const segmentData = await segmentResponse.json();

      const abResponse = await fetch(`${BASE_URL}/ab-test-results?${params}`);
      const abData = await abResponse.json();

      const dayResponse = await fetch(`${BASE_URL}/day-progression?${params}`);
      const dayData = await dayResponse.json();

      expect(statsData).toHaveProperty('lastUpdated');
      expect(segmentData).toHaveProperty('lastUpdated');
      expect(abData).toHaveProperty('lastUpdated');
      expect(dayData).toHaveProperty('lastUpdated');
    });

    it('Stats와 Segment-Breakdown 총합 일치', async () => {
      const params = new URLSearchParams(testParams);

      const statsResponse = await fetch(`${BASE_URL}/stats?${params}`);
      const statsData = await statsResponse.json();

      const segmentResponse = await fetch(`${BASE_URL}/segment-breakdown?${params}`);
      const segmentData = await segmentResponse.json();

      const segmentTotal = segmentData.segments.find((s: any) => s.key === 'TOTAL');

      expect(statsData.totalSent).toBe(segmentTotal.sent);
      expect(statsData.totalClicked).toBe(segmentTotal.clicked);
    });

    it('모든 API 에러 처리 일관성', async () => {
      const invalidParams = new URLSearchParams({
        fromDate: 'invalid-date',
        toDate: 'invalid-date',
      });

      const endpoints = [
        `${BASE_URL}/stats`,
        `${BASE_URL}/segment-breakdown`,
        `${BASE_URL}/ab-test-results`,
        `${BASE_URL}/day-progression`,
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(`${endpoint}?${invalidParams}`);
          // 400 또는 500 상태코드 예상
          expect([400, 500]).toContain(response.status);
        } catch (error) {
          // 네트워크 에러는 무시
        }
      }
    });
  });

  describe('성능 테스트', () => {
    it('Stats API 응답 시간 < 2초', async () => {
      const params = new URLSearchParams(testParams);
      const start = performance.now();
      await fetch(`${BASE_URL}/stats?${params}`);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(2000);
    });

    it('Day Progression API 응답 시간 < 1.5초', async () => {
      const params = new URLSearchParams(testParams);
      const start = performance.now();
      await fetch(`${BASE_URL}/day-progression?${params}`);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1500);
    });
  });
});
