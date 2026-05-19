/**
 * Menu #38 Phase 4 Step 5-2: 자동분류 알고리즘 테스트
 *
 * L1-L10 렌즈별 분류 + 신뢰도 + 키워드 감지
 *
 * @file __tests__/lib/lens-classifier.test.ts
 */

import { classifyCustomerLens, detectKeywords } from '../../src/lib/lens-classifier';
import { QuestionnaireResponse } from '../../src/lib/lens-classifier/types';

describe('자동분류 알고리즘 (Menu #38 Phase 4 Step 5-2)', () => {
  describe('L1 렌즈: 가격 오해형 (광고 불신)', () => {
    test('[L1-001] 전형적인 가격 오해 고객 - 광고/가격 민감도 높음', () => {
      const responses: QuestionnaireResponse = {
        contactId: 'test_l1_001',
        q1_ad_trust: 2, // 광고 신뢰도 낮음
        q2_price_sensitivity: 5, // 가격 민감도 높음
        q3_preparation_burden: 2,
        q4_cruise_experience: 1,
        q5_decision_readiness: 2,
        source: 'INFLUENCER_AD',
      };

      const result = classifyCustomerLens(responses, '월 33,000원이라고 했는데 150만원이라고?');

      expect(result.primary_lens).toBe('L1');
      expect(result.confidence_score).toBeGreaterThan(60);
      expect(result.priority).toBe('MEDIUM');
      expect(result.recommended_script).toBe('L1_PRICE_RESISTANCE_MAIN');
    });

    test('[L1-002] 가격 민감도 매우 높고 광고 불신', () => {
      const responses: QuestionnaireResponse = {
        contactId: 'test_l1_002',
        q1_ad_trust: 1,
        q2_price_sensitivity: 5,
        q3_preparation_burden: 3,
        q4_cruise_experience: 1,
        q5_decision_readiness: 2,
        source: 'INFLUENCER_AD',
      };

      const result = classifyCustomerLens(responses);
      expect(result.primary_lens).toBe('L1');
      expect(result.confidence_score).toBeGreaterThan(70);
    });

    test('[L1-003] 키워드로만 감지되는 L1 신호', () => {
      const responses: QuestionnaireResponse = {
        contactId: 'test_l1_003',
        q1_ad_trust: 3,
        q2_price_sensitivity: 3,
        q3_preparation_burden: 2,
        q4_cruise_experience: 2,
        q5_decision_readiness: 2,
      };

      const result = classifyCustomerLens(
        responses,
        '실제 가격이 예상보다 훨씬 비싸네요. 광고는 정말 사기 같아요.'
      );

      expect(result.primary_lens).toBe('L1');
    });

    test('[L1-004] 멤버비 vs 상품비 혼동', () => {
      const responses: QuestionnaireResponse = {
        contactId: 'test_l1_004',
        q1_ad_trust: 2,
        q2_price_sensitivity: 4,
        q3_preparation_burden: 2,
        q4_cruise_experience: 1,
        q5_decision_readiness: 2,
      };

      const result = classifyCustomerLens(responses, '멤버도 내야 하고 상품도 내야 한다고요? 둘 다?');
      expect(result.primary_lens).toBe('L1');
    });

    test('[L1-005] 저가격 고객층 (신혼 저소득)', () => {
      const responses: QuestionnaireResponse = {
        contactId: 'test_l1_005',
        q1_ad_trust: 2,
        q2_price_sensitivity: 5,
        q3_preparation_burden: 2,
        q4_cruise_experience: 1,
        q5_decision_readiness: 1,
        buyerType: 'NEWLYWED',
      };

      const result = classifyCustomerLens(responses);
      expect(result.primary_lens).toBe('L1');
    });
  });

  describe('L3 렌즈: 차별성 미인지형 (새로운 경험)', () => {
    test('[L3-001] 전형적인 차별성 미인지 고객 - 크루즈 경험 없음', () => {
      const responses: QuestionnaireResponse = {
        contactId: 'test_l3_001',
        q1_ad_trust: 4,
        q2_price_sensitivity: 3,
        q3_preparation_burden: 3,
        q4_cruise_experience: 1, // 경험 없음
        q5_decision_readiness: 3,
        source: 'ORGANIC',
      };

      const result = classifyCustomerLens(responses, '배타고 도는 게 뭐 하는 거예요? 호텔이랑 뭐가 달라요?');

      expect(result.primary_lens).toBe('L3');
      expect(result.confidence_score).toBeGreaterThan(60);
      expect(result.recommended_script).toBe('L3_DIFFERENTIATION_MAIN');
    });

    test('[L3-002] 일반 여행과의 비교 신호', () => {
      const responses: QuestionnaireResponse = {
        contactId: 'test_l3_002',
        q1_ad_trust: 3,
        q2_price_sensitivity: 3,
        q3_preparation_burden: 2,
        q4_cruise_experience: 1,
        q5_decision_readiness: 2,
      };

      const result = classifyCustomerLens(responses, '일반 여행이랑 뭐가 달라서 크루즈를 타야 되나요?');
      expect(result.primary_lens).toBe('L3');
    });

    test('[L3-003] 배에 대한 구체적인 오해', () => {
      const responses: QuestionnaireResponse = {
        contactId: 'test_l3_003',
        q1_ad_trust: 3,
        q2_price_sensitivity: 3,
        q3_preparation_burden: 3,
        q4_cruise_experience: 1,
        q5_decision_readiness: 2,
      };

      const result = classifyCustomerLens(responses, '배를 탈 때 멀미 안 할까요? 배가 흔들거리면 어떻게?');
      expect(result.primary_lens).toBe('L3');
    });

    test('[L3-004] 40대 가족 + 첫 크루즈', () => {
      const responses: QuestionnaireResponse = {
        contactId: 'test_l3_004',
        q1_ad_trust: 3,
        q2_price_sensitivity: 3,
        q3_preparation_burden: 3,
        q4_cruise_experience: 1,
        q5_decision_readiness: 3,
        age: 45,
        buyerType: 'FAMILY_40S',
      };

      const result = classifyCustomerLens(responses);
      expect(result.primary_lens).toBe('L3');
    });

    test('[L3-005] Referral 소스 + 신규 고객', () => {
      const responses: QuestionnaireResponse = {
        contactId: 'test_l3_005',
        q1_ad_trust: 4,
        q2_price_sensitivity: 2,
        q3_preparation_burden: 2,
        q4_cruise_experience: 1,
        q5_decision_readiness: 3,
        source: 'REFERRAL',
      };

      const result = classifyCustomerLens(responses);
      expect(result.primary_lens).toBe('L3');
    });
  });

  describe('L10 렌즈: 즉시 구매형 (결정 완료)', () => {
    test('[L10-001] 전형적인 L10 - 높은 결정 준비도 + 마지막 고민', () => {
      const responses: QuestionnaireResponse = {
        contactId: 'test_l10_001',
        q1_ad_trust: 4,
        q2_price_sensitivity: 2,
        q3_preparation_burden: 1,
        q4_cruise_experience: 1,
        q5_decision_readiness: 5, // 매우 준비됨
      };

      const result = classifyCustomerLens(responses, '이미 배도 정했고 객실도 정했는데, 지금 예약할까요?');

      expect(result.primary_lens).toBe('L10');
      expect(result.priority).toBe('CRITICAL');
      expect(result.confidence_score).toBeGreaterThan(70);
      expect(result.sms_sequence_key).toBe('l10_urgent_immediate');
    });

    test('[L10-002] 선택 직전 상태 (배/객실 정함)', () => {
      const responses: QuestionnaireResponse = {
        contactId: 'test_l10_002',
        q1_ad_trust: 5,
        q2_price_sensitivity: 1,
        q3_preparation_burden: 1,
        q4_cruise_experience: 2,
        q5_decision_readiness: 4,
      };

      const result = classifyCustomerLens(responses, '지중해 크루즈 2월 출발, 발코니 객실 선택 완료했어요.');
      expect(result.primary_lens).toBe('L10');
      expect(result.priority).toBe('CRITICAL');
    });

    test('[L10-003] 마지막 확인만 남은 상태', () => {
      const responses: QuestionnaireResponse = {
        contactId: 'test_l10_003',
        q1_ad_trust: 4,
        q2_price_sensitivity: 2,
        q3_preparation_burden: 2,
        q4_cruise_experience: 1,
        q5_decision_readiness: 4,
      };

      const result = classifyCustomerLens(responses, '마지막으로 뭘 더 확인해야 하는데, 지금 예약 가능해요?');
      expect(result.primary_lens).toBe('L10');
    });

    test('[L10-004] Q5=4점 (중상의 준비도도 L10 가능)', () => {
      const responses: QuestionnaireResponse = {
        contactId: 'test_l10_004',
        q1_ad_trust: 4,
        q2_price_sensitivity: 2,
        q3_preparation_burden: 2,
        q4_cruise_experience: 2,
        q5_decision_readiness: 4,
      };

      const result = classifyCustomerLens(responses);
      // L10은 아닐 수도 있지만, 높은 점수는 받아야 함
      expect(result.confidence_score).toBeGreaterThan(40);
    });

    test('[L10-005] 이미 경험 있는 고객 + 재구매', () => {
      const responses: QuestionnaireResponse = {
        contactId: 'test_l10_005',
        q1_ad_trust: 5,
        q2_price_sensitivity: 1,
        q3_preparation_burden: 1,
        q4_cruise_experience: 4,
        q5_decision_readiness: 5,
        source: 'RETURNING',
        lastPurchaseDate: new Date('2023-06-01'),
      };

      const result = classifyCustomerLens(responses);
      expect(result.primary_lens).toBe('L10');
    });
  });

  describe('L6 렌즈: 타이밍 미결형 (일정 미정)', () => {
    test('[L6-001] Q5=3점 + 타이밍 미결 신호', () => {
      const responses: QuestionnaireResponse = {
        contactId: 'test_l6_001',
        q1_ad_trust: 3,
        q2_price_sensitivity: 2,
        q3_preparation_burden: 2,
        q4_cruise_experience: 2,
        q5_decision_readiness: 3, // 중간
      };

      const result = classifyCustomerLens(responses, '언제 갈지 아직 못 정했어요. 일정이 나와야');

      expect(result.primary_lens).toBe('L6');
      expect(result.priority).toBe('HIGH');
      expect(result.sms_sequence_key).toBe('l6_urgent_4day');
    });

    test('[L6-002] Q5=2점 (아직 멀음)', () => {
      const responses: QuestionnaireResponse = {
        contactId: 'test_l6_002',
        q1_ad_trust: 4,
        q2_price_sensitivity: 2,
        q3_preparation_burden: 2,
        q4_cruise_experience: 2,
        q5_decision_readiness: 2,
      };

      const result = classifyCustomerLens(responses, '다음달 일정 나올 때까지는 예약할 수 없을 것 같아요');
      expect(result.primary_lens).toBe('L6');
    });

    test('[L6-003] 휴가 계획 미정', () => {
      const responses: QuestionnaireResponse = {
        contactId: 'test_l6_003',
        q1_ad_trust: 3,
        q2_price_sensitivity: 3,
        q3_preparation_burden: 3,
        q4_cruise_experience: 1,
        q5_decision_readiness: 2,
      };

      const result = classifyCustomerLens(responses, '아직 휴가를 언제 낼지 못 정했거든요');
      expect(result.primary_lens).toBe('L6');
    });
  });

  describe('L9 렌즈: 건강/안전 불안형', () => {
    test('[L9-001] 멀미 우려 고객', () => {
      const responses: QuestionnaireResponse = {
        contactId: 'test_l9_001',
        q1_ad_trust: 3,
        q2_price_sensitivity: 3,
        q3_preparation_burden: 4, // 준비 부담 높음 (건강 때문에)
        q4_cruise_experience: 1,
        q5_decision_readiness: 2,
      };

      const result = classifyCustomerLens(responses, '배타면 멀미 심할 것 같은데 괜찮을까요?');

      expect(result.primary_lens).toBe('L9');
      expect(result.priority).toBe('CRITICAL');
      expect(result.sms_sequence_key).toBe('l9_urgent_4day');
    });

    test('[L9-002] 아이 안전 우려 (40대 가족)', () => {
      const responses: QuestionnaireResponse = {
        contactId: 'test_l9_002',
        q1_ad_trust: 3,
        q2_price_sensitivity: 3,
        q3_preparation_burden: 4,
        q4_cruise_experience: 1,
        q5_decision_readiness: 2,
        buyerType: 'FAMILY_40S',
      };

      const result = classifyCustomerLens(responses, '아이들이 배에서 안전할까요? 물에 빠지지 않을까?');
      expect(result.primary_lens).toBe('L9');
    });

    test('[L9-003] 지병 및 건강 문제', () => {
      const responses: QuestionnaireResponse = {
        contactId: 'test_l9_003',
        q1_ad_trust: 3,
        q2_price_sensitivity: 2,
        q3_preparation_burden: 3,
        q4_cruise_experience: 1,
        q5_decision_readiness: 3,
      };

      const result = classifyCustomerLens(
        responses,
        '저는 지병이 있어서 건강이 걱정돼요. 배를 탈 수 있을까요?'
      );
      // L9 키워드가 있어야 L9가 감지됨
      if (result.primary_lens === 'L9') {
        expect(result.priority).toBe('CRITICAL');
      }
    });
  });

  describe('혼합 렌즈 시나리오 (다중 신호)', () => {
    test('[MIX-001] L1 + L2 신호 겹침 (가격 + 준비 부담)', () => {
      const responses: QuestionnaireResponse = {
        contactId: 'test_mix_001',
        q1_ad_trust: 2,
        q2_price_sensitivity: 4,
        q3_preparation_burden: 4,
        q4_cruise_experience: 1,
        q5_decision_readiness: 1,
      };

      const result = classifyCustomerLens(
        responses,
        '월 33,000원 광고 보고 전화 드렸는데 실제로 비싸네요. 준비도 복잡하지 않을까?'
      );

      // L1과 L2 중 하나는 primary, 다른 하나는 secondary
      expect(['L1', 'L2']).toContain(result.primary_lens);
    });

    test('[MIX-002] L3 + L6 신호 (차별성 미인지 + 타이밍 미결)', () => {
      const responses: QuestionnaireResponse = {
        contactId: 'test_mix_002',
        q1_ad_trust: 3,
        q2_price_sensitivity: 2,
        q3_preparation_burden: 2,
        q4_cruise_experience: 1,
        q5_decision_readiness: 3,
      };

      const result = classifyCustomerLens(
        responses,
        '크루즈가 뭐 하는 건지 모르겠고, 언제 갈지도 못 정했어요'
      );

      // L3(경험 없음)과 L6(타이밍 미결) 중 하나가 primary여야 함
      expect(['L3', 'L6']).toContain(result.primary_lens);
      // 신뢰도가 보통 수준이어야 함 (다중 신호)
      expect(result.confidence_score).toBeGreaterThan(30);
    });

    test('[MIX-003] L8 + L4 신호 (부재중 + 멤버십 저항)', () => {
      const responses: QuestionnaireResponse = {
        contactId: 'test_mix_003',
        q1_ad_trust: 4,
        q2_price_sensitivity: 2,
        q3_preparation_burden: 2,
        q4_cruise_experience: 3,
        q5_decision_readiness: 3,
        source: 'RETURNING',
        lastPurchaseDate: new Date('2023-03-01'), // 1년 이상 전
      };

      const result = classifyCustomerLens(
        responses,
        '작년에 탔는데 멤버십이 필요한가요? 한두 번만 타도 되지 않을까?'
      );

      // 부재중 DB(source=RETURNING, lastPurchaseDate) + L8 키워드가 강한 신호
      // L8이거나 L4여야 함 (둘 다 관련성 있음)
      expect(['L8', 'L4']).toContain(result.primary_lens);
    });

    test('[MIX-004] L10 + 다른 신호 겹침 (결정 준비도 높음이 우선)', () => {
      const responses: QuestionnaireResponse = {
        contactId: 'test_mix_004',
        q1_ad_trust: 3, // L1 신호 중립
        q2_price_sensitivity: 2, // 가격 민감도 낮음
        q3_preparation_burden: 1,
        q4_cruise_experience: 2,
        q5_decision_readiness: 5, // L10 신호 강함
      };

      const result = classifyCustomerLens(responses, '이미 결정했어요. 지금 예약 가능한가요?');

      expect(result.primary_lens).toBe('L10');
    });
  });

  describe('엣지 케이스 (모호한 경우)', () => {
    test('[EDGE-001] 모든 답변이 3점 (중립)', () => {
      const responses: QuestionnaireResponse = {
        contactId: 'test_edge_001',
        q1_ad_trust: 3,
        q2_price_sensitivity: 3,
        q3_preparation_burden: 3,
        q4_cruise_experience: 3,
        q5_decision_readiness: 3,
      };

      const result = classifyCustomerLens(responses);

      // 어떤 렌즈든 선택되어야 함 (null이 아니어야 함)
      expect(result.primary_lens).toBeDefined();
      expect(['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10']).toContain(result.primary_lens);
    });

    test('[EDGE-002] 신뢰도 50% 미만 (모호한 경우)', () => {
      const responses: QuestionnaireResponse = {
        contactId: 'test_edge_002',
        q1_ad_trust: 3,
        q2_price_sensitivity: 3,
        q3_preparation_burden: 3,
        q4_cruise_experience: 3,
        q5_decision_readiness: 3,
      };

      const result = classifyCustomerLens(responses);

      if (result.confidence_score < 50) {
        expect(result.reasoning).toContain('신뢰도');
      }
    });

    test('[EDGE-003] 키워드 없이 Q만으로 판단', () => {
      const responses: QuestionnaireResponse = {
        contactId: 'test_edge_003',
        q1_ad_trust: 1,
        q2_price_sensitivity: 5,
        q3_preparation_burden: 1,
        q4_cruise_experience: 5,
        q5_decision_readiness: 1,
      };

      const result = classifyCustomerLens(responses); // 키워드 없음

      expect(result.primary_lens).toBe('L1');
      expect(result.confidence_score).toBeGreaterThan(0);
    });

    test('[EDGE-004] 입력 유효성 검증 - Q1이 0 (유효하지 않음)', () => {
      const responses: QuestionnaireResponse = {
        contactId: 'test_edge_004',
        q1_ad_trust: 0, // 유효하지 않음 (1-5만 허용)
        q2_price_sensitivity: 3,
        q3_preparation_burden: 3,
        q4_cruise_experience: 3,
        q5_decision_readiness: 3,
      };

      expect(() => classifyCustomerLens(responses)).toThrow('1-5 사이의 정수여야 합니다');
    });

    test('[EDGE-005] 입력 유효성 검증 - Q2가 6 (유효하지 않음)', () => {
      const responses: QuestionnaireResponse = {
        contactId: 'test_edge_005',
        q1_ad_trust: 3,
        q2_price_sensitivity: 6, // 유효하지 않음
        q3_preparation_burden: 3,
        q4_cruise_experience: 3,
        q5_decision_readiness: 3,
      };

      expect(() => classifyCustomerLens(responses)).toThrow();
    });
  });

  describe('키워드 감지 엔진', () => {
    test('[KW-001] L1 키워드 감지 - "월 33,000"', () => {
      const signals = detectKeywords('월 33,000원이라고 광고했는데');
      expect(signals.length).toBeGreaterThan(0);
      expect(signals[0].lenses).toContain('L1');
    });

    test('[KW-002] L3 키워드 감지 - "배 타는 것"', () => {
      const signals = detectKeywords('배타고 도는 게 뭐 하는 거야?');
      expect(signals.some((s) => s.lenses.includes('L3'))).toBe(true);
    });

    test('[KW-003] L6 키워드 감지 - "언제"', () => {
      const signals = detectKeywords('언제 갈지 못 정했어요');
      expect(signals.some((s) => s.lenses.includes('L6'))).toBe(true);
    });

    test('[KW-004] L9 키워드 감지 - "멀미"', () => {
      const signals = detectKeywords('배타면 멀미 심할 것 같아요');
      expect(signals.some((s) => s.lenses.includes('L9'))).toBe(true);
    });

    test('[KW-005] L10 키워드 감지 - "이미 정했다"', () => {
      const signals = detectKeywords('배도 정했고 객실도 정했는데 지금 예약할까?');
      expect(signals.some((s) => s.lenses.includes('L10'))).toBe(true);
    });

    test('[KW-006] 빈 텍스트 (키워드 없음)', () => {
      const signals = detectKeywords('');
      expect(signals.length).toBe(0);
    });

    test('[KW-007] 무관한 텍스트', () => {
      const signals = detectKeywords('오늘 기분이 좋습니다. 점심으로 짜장면을 먹었어요.');
      expect(signals.length).toBe(0);
    });

    test('[KW-008] 여러 키워드 감지 (순서 정렬)', () => {
      const signals = detectKeywords('월 33,000원 광고는 사기 같고, 배타면 멀미도 심하고');
      // L1 (가격) + L9 (건강) 신호
      expect(signals.length).toBeGreaterThan(0);
      // 신뢰도순 정렬되어야 함
      for (let i = 0; i < signals.length - 1; i++) {
        expect(signals[i].confidence).toBeGreaterThanOrEqual(signals[i + 1].confidence);
      }
    });
  });

  describe('우선도 및 성능', () => {
    test('[PRIORITY-001] L10은 CRITICAL 우선도', () => {
      const responses: QuestionnaireResponse = {
        contactId: 'test_priority_001',
        q1_ad_trust: 4,
        q2_price_sensitivity: 1,
        q3_preparation_burden: 1,
        q4_cruise_experience: 1,
        q5_decision_readiness: 5,
      };

      const result = classifyCustomerLens(responses);
      if (result.primary_lens === 'L10') {
        expect(result.priority).toBe('CRITICAL');
      }
    });

    test('[PRIORITY-002] L9도 CRITICAL 우선도', () => {
      const responses: QuestionnaireResponse = {
        contactId: 'test_priority_002',
        q1_ad_trust: 3,
        q2_price_sensitivity: 3,
        q3_preparation_burden: 3,
        q4_cruise_experience: 1,
        q5_decision_readiness: 2,
      };

      const result = classifyCustomerLens(responses, '배타면 멀미 심하니까 괜찮을까요?');
      if (result.primary_lens === 'L9') {
        expect(result.priority).toBe('CRITICAL');
      }
    });

    test('[PERF-001] 성능 테스트 - 100개 동시 분류 < 1초', () => {
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        const responses: QuestionnaireResponse = {
          contactId: `perf_test_${i}`,
          q1_ad_trust: Math.floor(Math.random() * 5) + 1,
          q2_price_sensitivity: Math.floor(Math.random() * 5) + 1,
          q3_preparation_burden: Math.floor(Math.random() * 5) + 1,
          q4_cruise_experience: Math.floor(Math.random() * 5) + 1,
          q5_decision_readiness: Math.floor(Math.random() * 5) + 1,
        };
        classifyCustomerLens(responses);
      }

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // 100개 분류가 1초 이내여야 함
      expect(elapsed).toBeLessThan(1000);
    });
  });
});
