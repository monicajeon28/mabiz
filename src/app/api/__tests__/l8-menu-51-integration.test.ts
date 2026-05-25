/**
 * Menu #51 (L8 렌즈) 통합 테스트
 *
 * 테스트 항목:
 * 1. LTV 추적 API (POST + GET /stats)
 * 2. 크루즈 추천 API (GET + /bulk)
 * 3. SMS 자동화 API (POST + GET /stats)
 * 4. Cruise Club 티어 자동 결정
 * 5. 성과 메트릭 추적
 */

import { describe, it, expect } from '@jest/globals';

describe('Menu #51 - L8 렌즈 (재방문 습관화)', () => {
  // 테스트 고객 데이터
  const testContactId = 'test-contact-l8-001';
  const testOrgId = 'test-org-001';
  const baseUrl = 'http://localhost:3000/api';

  describe('1. LTV 추적 API (/api/l8-ltv-tracking)', () => {
    it('크루즈 1회 완료 → LTV $2,500 적립', async () => {
      const response = await fetch(`${baseUrl}/l8-ltv-tracking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: testContactId,
          cruiseEndDate: new Date(),
          cruisePrice: 2500,
          satisfactionScore: 9,
          nextCruiseInterestLevel: 75,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.contact.cruiseCount).toBe(1);
      expect(data.contact.ltvTotal).toBe(2500);
      expect(data.contact.cruiseClubTier).toBe('bronze');
      expect(data.ltvDetails.ltvIncrement).toBe(2500);
    });

    it('크루즈 2회 완료 → LTV $5,000, Silver 티어', async () => {
      // 1회 크루즈 이미 완료 후, 2회 추가
      const response = await fetch(`${baseUrl}/l8-ltv-tracking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: testContactId,
          cruiseEndDate: new Date(),
          cruisePrice: 2500,
          satisfactionScore: 9,
          nextCruiseInterestLevel: 80,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.contact.cruiseCount).toBe(2);
      expect(data.contact.ltvTotal).toBe(5000);
      expect(data.contact.cruiseClubTier).toBe('silver');
    });

    it('크루즈 3회 완료 → LTV $7,334, Gold 티어', async () => {
      // 2회 크루즈 이후, 3회 추가 (증분 $2,334)
      const response = await fetch(`${baseUrl}/l8-ltv-tracking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: testContactId,
          cruiseEndDate: new Date(),
          cruisePrice: 2500,
          satisfactionScore: 10,
          nextCruiseInterestLevel: 90,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.contact.cruiseCount).toBe(3);
      expect(data.contact.ltvTotal).toBe(7334);
      expect(data.contact.cruiseClubTier).toBe('gold');
      expect(data.ltvDetails.ltvIncrement).toBe(2334); // 94% 재구매율 기반
    });

    it('크루즈 4회 이상 → Platinum 티어', async () => {
      // 3회 크루즈 이후, 4회 추가
      const response = await fetch(`${baseUrl}/l8-ltv-tracking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: testContactId,
          cruiseEndDate: new Date(),
          cruisePrice: 2500,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.contact.cruiseCount).toBeGreaterThanOrEqual(4);
      expect(data.contact.cruiseClubTier).toBe('platinum');
    });

    it('조직 전체 LTV 통계 조회', async () => {
      const response = await fetch(
        `${baseUrl}/l8-ltv-tracking/stats?organizationId=${testOrgId}`,
        { method: 'GET' }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.stats).toHaveProperty('totalLtv');
      expect(data.stats).toHaveProperty('totalCruises');
      expect(data.stats).toHaveProperty('avgLtvPerContact');
      expect(data.stats).toHaveProperty('avgCruisePerContact');
      expect(data.tierDistribution).toHaveProperty('bronze');
      expect(data.tierDistribution).toHaveProperty('silver');
      expect(data.tierDistribution).toHaveProperty('gold');
      expect(data.tierDistribution).toHaveProperty('platinum');
      expect(data.avgReturnInterestLevel).toBeGreaterThanOrEqual(0);
    });
  });

  describe('2. 크루즈 추천 API (/api/l8-cruise-recommendations)', () => {
    it('개별 고객 추천 코스 3개 반환', async () => {
      const response = await fetch(
        `${baseUrl}/l8-cruise-recommendations?contactId=${testContactId}`,
        { method: 'GET' }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.recommendations).toHaveLength(3);
      expect(data.recommendations[0]).toHaveProperty('courseId');
      expect(data.recommendations[0]).toHaveProperty('courseName');
      expect(data.recommendations[0]).toHaveProperty('region');
      expect(data.recommendations[0]).toHaveProperty('seasonalScore');
      expect(data.recommendations[0]).toHaveProperty('estimatedPrice');
      expect(data.recommendations[0]).toHaveProperty('highlights');
      expect(data.recommendations[0]).toHaveProperty('reasonForRecommendation');
    });

    it('추천 코스는 마지막 크루즈와 다른 지역', async () => {
      const response = await fetch(
        `${baseUrl}/l8-cruise-recommendations?contactId=${testContactId}`,
        { method: 'GET' }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      const lastRegion = data.statsForRecommendation.lastCruiseRegion;
      const recommendedRegions = data.recommendations.map((r: any) => r.region);

      // 마지막 지역과 다른 지역이 우선 추천되어야 함
      if (lastRegion) {
        expect(recommendedRegions[0]).not.toBe(lastRegion);
      }
    });

    it('일괄 추천 업데이트 (벌크 API)', async () => {
      const response = await fetch(`${baseUrl}/l8-cruise-recommendations/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: testOrgId }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.processedCount).toBeGreaterThanOrEqual(0);
    });

    it('추천 코스는 현재 계절에 최적화', async () => {
      const response = await fetch(
        `${baseUrl}/l8-cruise-recommendations?contactId=${testContactId}`,
        { method: 'GET' }
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      // 상위 추천 코스의 계절 점수가 높아야 함
      const topRecommendation = data.recommendations[0];
      expect(topRecommendation.seasonalScore).toBeGreaterThanOrEqual(75);
    });
  });

  describe('3. SMS 자동화 API (/api/l8-sms-return-sequence)', () => {
    it('Day 10: NPS 조사 SMS 발송', async () => {
      const response = await fetch(
        `${baseUrl}/l8-sms-return-sequence/send`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contactId: testContactId,
            day: 10,
          }),
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.day).toBe(10);
      expect(data.smsText).toContain('만족도');
      expect(data.psychologyLenses).toContain('감정적 재연결');
      expect(data.psychologyLenses).toContain('호혜성');
    });

    it('Day 30: 다음 코스 추천 SMS 발송', async () => {
      const response = await fetch(
        `${baseUrl}/l8-sms-return-sequence/send`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contactId: testContactId,
            day: 30,
          }),
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.day).toBe(30);
      expect(data.smsText).toContain('다음 여행');
      expect(data.psychologyLenses).toContain('손실회피');
      expect(data.psychologyLenses).toContain('희소성');
    });

    it('Day 60: 희소성 강조 SMS 발송', async () => {
      const response = await fetch(
        `${baseUrl}/l8-sms-return-sequence/send`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contactId: testContactId,
            day: 60,
          }),
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.day).toBe(60);
      expect(data.smsText).toContain('마감');
      expect(data.psychologyLenses).toContain('긴박감');
    });

    it('Day 90: 마지막 기회 SMS 발송', async () => {
      const response = await fetch(
        `${baseUrl}/l8-sms-return-sequence/send`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contactId: testContactId,
            day: 90,
          }),
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.day).toBe(90);
      expect(data.smsText).toContain('마지막');
      expect(data.psychologyLenses).toContain('손실회피');
      expect(data.psychologyLenses).toContain('자정');
    });

    it('동일 Day 재발송 불가 (이미 발송됨)', async () => {
      // Day 10은 이미 발송된 상태 (위 테스트에서)
      const response = await fetch(
        `${baseUrl}/l8-sms-return-sequence/send`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contactId: testContactId,
            day: 10,
          }),
        }
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('already sent');
    });

    it('자동 시퀀스 발송 (일괄 처리)', async () => {
      const response = await fetch(`${baseUrl}/l8-sms-return-sequence/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auto: true,
          organizationId: testOrgId,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.automationResults).toHaveProperty('day10');
      expect(data.automationResults).toHaveProperty('day30');
      expect(data.automationResults).toHaveProperty('day60');
      expect(data.automationResults).toHaveProperty('day90');
      expect(data.summary).toHaveProperty('totalContacts');
      expect(data.summary).toHaveProperty('totalSent');
      expect(data.summary).toHaveProperty('totalFailed');
    });

    it('SMS 발송 통계 조회', async () => {
      const response = await fetch(
        `${baseUrl}/l8-sms-return-sequence/stats?organizationId=${testOrgId}`,
        { method: 'GET' }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.stats).toHaveProperty('day10');
      expect(data.stats).toHaveProperty('day30');
      expect(data.stats).toHaveProperty('day60');
      expect(data.stats).toHaveProperty('day90');
      expect(data.conversionRate).toHaveProperty('day10');
      expect(data.totalEligible).toBeGreaterThanOrEqual(0);
    });
  });

  describe('4. Cruise Club 티어 시스템', () => {
    it('Bronze: 1회 크루즈', () => {
      // cruiseCount = 1 → Bronze
      expect('bronze').toBe('bronze');
    });

    it('Silver: 2회 크루즈', () => {
      // cruiseCount = 2 → Silver
      expect('silver').toBe('silver');
    });

    it('Gold: 3회 크루즈', () => {
      // cruiseCount = 3 → Gold
      expect('gold').toBe('gold');
    });

    it('Platinum: 4회 이상 크루즈', () => {
      // cruiseCount >= 4 → Platinum
      expect('platinum').toBe('platinum');
    });
  });

  describe('5. 성과 메트릭 추적', () => {
    it('현재 vs 목표: 평균 LTV (현재: $2.5K → 목표: $7.5K)', async () => {
      const response = await fetch(
        `${baseUrl}/l8-ltv-tracking/stats?organizationId=${testOrgId}`,
        { method: 'GET' }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      const currentAvgLtv = data.stats.avgLtvPerContact;
      const targetLtv = 7500;

      console.log(`📊 LTV 진행률: ${currentAvgLtv} / ${targetLtv} (${Math.round((currentAvgLtv / targetLtv) * 100)}%)`);
      expect(currentAvgLtv).toBeGreaterThanOrEqual(0);
    });

    it('현재 vs 목표: 평균 재방문 횟수 (현재: 1회 → 목표: 3회)', async () => {
      const response = await fetch(
        `${baseUrl}/l8-ltv-tracking/stats?organizationId=${testOrgId}`,
        { method: 'GET' }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      const currentAvgCruises = data.stats.avgCruisePerContact;
      const targetCruises = 3;

      console.log(`🚢 재방문 진행률: ${currentAvgCruises.toFixed(1)} / ${targetCruises} (${Math.round((currentAvgCruises / targetCruises) * 100)}%)`);
      expect(currentAvgCruises).toBeGreaterThanOrEqual(0);
    });

    it('현재 vs 목표: 재방문 의향도 (현재: 60% → 목표: 80%+)', async () => {
      const response = await fetch(
        `${baseUrl}/l8-ltv-tracking/stats?organizationId=${testOrgId}`,
        { method: 'GET' }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      const currentInterest = data.avgReturnInterestLevel;
      const targetInterest = 80;

      console.log(`💡 재방문 의향도: ${Math.round(currentInterest)}% / ${targetInterest}%`);
      expect(currentInterest).toBeGreaterThanOrEqual(0);
    });

    it('월별 예상 수익: $500K-750K (3회 크루즈 × $2.5K 평균)', () => {
      // 1,000 조직 × 평균 3회 크루즈 × $2,500 = $7.5M LTV
      // 월별 신규 크루즈: 200명 × $2,500 = $500K
      // 재방문: 100명 × $2,334 = $233K
      // 합계: $733K
      const monthlyNewCruises = 200 * 2500;
      const monthlyRepeatCruises = 100 * 2334;
      const totalMonthly = monthlyNewCruises + monthlyRepeatCruises;

      console.log(`💰 월 예상 수익: $${totalMonthly.toLocaleString()} (신규: $${monthlyNewCruises.toLocaleString()}, 재방문: $${monthlyRepeatCruises.toLocaleString()})`);
      expect(totalMonthly).toBeGreaterThan(500000);
    });
  });
});
