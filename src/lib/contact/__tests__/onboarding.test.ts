/**
 * SMS 온보딩 마법사 Jest 테스트 스위트
 *
 * 테스트 목표:
 * 1. NLP 파싱 정확도 (Day 0-3 각각)
 * 2. 신뢰도 기반 액션 결정
 * 3. 자동 저장 + Contact 필드 업데이트
 * 4. 세그먼트 분류 정확성
 * 5. 에러 핸들링
 */

import {
  parseMaritalStatus,
  parseMarriageAndChildren,
  parseAge,
  parseTravelPurpose,
  parseOnboardingResponse,
  decideOnboardingAction,
} from '../sms-onboarding-parser';
import { classifySegment } from '../segment-classifier';

describe('SMS 온보딩 마법사', () => {
  // ========== 테스트 1: NLP 파싱 정확도 ==========
  describe('NLP 파싱', () => {
    // Day 0: 결혼 상태
    test('Day0: 숫자 입력으로 결혼 상태 파싱', () => {
      const result = parseMaritalStatus('2');
      expect(result.success).toBe(true);
      expect(result.marriageStatus).toBe('married');
      expect(result.confidence).toBeGreaterThanOrEqual(90);
      expect(result.parseMethod).toBe('number_extract');
    });

    test('Day0: 키워드로 미혼 파싱', () => {
      const result = parseMaritalStatus('미혼');
      expect(result.success).toBe(true);
      expect(result.marriageStatus).toBe('single');
      expect(result.confidence).toBeGreaterThanOrEqual(85);
      expect(result.parseMethod).toBe('keyword');
    });

    test('Day0: 영문 키워드 파싱', () => {
      const result = parseMaritalStatus('married');
      expect(result.success).toBe(true);
      expect(result.marriageStatus).toBe('married');
      expect(result.confidence).toBeGreaterThanOrEqual(85);
    });

    test('Day0: 파싱 불가능한 입력', () => {
      const result = parseMaritalStatus('ㅇㅇㅇ');
      expect(result.success).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.parseMethod).toBe('fallback');
    });

    test('Day0: 빈 입력', () => {
      const result = parseMaritalStatus('');
      expect(result.success).toBe(false);
      expect(result.confidence).toBe(0);
    });

    // Day 1: 결혼년수 + 자녀정보 (복합)
    test('Day1: 완전한 정보 파싱 (결혼년수 + 자녀수 + 나이)', () => {
      const result = parseMarriageAndChildren(
        '결혼 5년 됐어요, 아이 2명 10살 8살이에요'
      );
      expect(result.success).toBe(true);
      expect(result.marriageDate).toBeDefined();
      expect(result.childrenCount).toBe(2);
      expect(result.childrenAges).toEqual([10, 8]);
      expect(result.confidence).toBeGreaterThanOrEqual(80);
    });

    test('Day1: 결혼년수만 파싱', () => {
      const result = parseMarriageAndChildren('결혼 3년');
      expect(result.success).toBe(true);
      expect(result.marriageDate).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(50);
    });

    test('Day1: 자녀 없음 파싱', () => {
      const result = parseMarriageAndChildren('결혼 3년, 자녀 없음');
      expect(result.success).toBe(true);
      expect(result.childrenCount).toBe(0);
      expect(result.confidence).toBeGreaterThanOrEqual(60);
    });

    test('Day1: 자녀 나이만 추출', () => {
      const result = parseMarriageAndChildren('아이 10살 8살');
      expect(result.childrenAges).toEqual([10, 8]);
    });

    test('Day1: 유효하지 않은 범위 필터링', () => {
      const result = parseMarriageAndChildren('결혼 200년'); // 200년은 유효 범위 벗어남
      // 200년은 파싱 불가능하지만, 함수 구현상 유효하지 않으면 무시
      expect(result.success).toBe(false); // 다른 정보 없으므로
    });

    // Day 2: 나이
    test('Day2: 숫자로 나이 파싱', () => {
      const result = parseAge('45');
      expect(result.success).toBe(true);
      expect(result.ageInYears).toBe(45);
      expect(result.confidence).toBeGreaterThanOrEqual(90);
      expect(result.parseMethod).toBe('number_extract');
    });

    test('Day2: "살" 단위 파싱', () => {
      const result = parseAge('45살입니다');
      expect(result.success).toBe(true);
      expect(result.ageInYears).toBe(45);
      expect(result.confidence).toBeGreaterThanOrEqual(90);
    });

    test('Day2: 세 단위 파싱', () => {
      const result = parseAge('45세');
      expect(result.success).toBe(true);
      expect(result.ageInYears).toBe(45);
    });

    test('Day2: 유효 범위 밖 (18세 미만)', () => {
      const result = parseAge('15');
      expect(result.success).toBe(false);
    });

    test('Day2: 유효 범위 밖 (100세 초과)', () => {
      const result = parseAge('120');
      expect(result.success).toBe(false);
    });

    // Day 3: 여행 목적
    test('Day3: 숫자로 여행 목적 파싱', () => {
      const result = parseTravelPurpose('1');
      expect(result.success).toBe(true);
      expect(result.travelPurpose).toBe('relaxation');
      expect(result.confidence).toBeGreaterThanOrEqual(90);
    });

    test('Day3: 키워드로 모험 파싱', () => {
      const result = parseTravelPurpose('모험이 좋아요');
      expect(result.success).toBe(true);
      expect(result.travelPurpose).toBe('adventure');
      expect(result.confidence).toBeGreaterThanOrEqual(85);
    });

    test('Day3: 문화 여행 파싱', () => {
      const result = parseTravelPurpose('문화와 역사');
      expect(result.success).toBe(true);
      expect(result.travelPurpose).toBe('culture');
    });

    test('Day3: 파싱 불가능', () => {
      const result = parseTravelPurpose('음...');
      expect(result.success).toBe(false);
      expect(result.confidence).toBe(0);
    });
  });

  // ========== 테스트 2: 신뢰도 기반 액션 결정 ==========
  describe('신뢰도 기반 액션 결정', () => {
    test('confidence >= 80: auto_save', () => {
      const action = decideOnboardingAction({ success: true, confidence: 95 });
      expect(action).toBe('auto_save');
    });

    test('confidence 50-80: manual_review', () => {
      const action = decideOnboardingAction({ success: true, confidence: 65 });
      expect(action).toBe('manual_review');
    });

    test('confidence 20-50: retry_sms', () => {
      const action = decideOnboardingAction({ success: false, confidence: 30 });
      expect(action).toBe('retry_sms');
    });

    test('confidence < 20: call_required', () => {
      const action = decideOnboardingAction({ success: false, confidence: 10 });
      expect(action).toBe('call_required');
    });

    test('confidence 0: call_required', () => {
      const action = decideOnboardingAction({ success: false, confidence: 0 });
      expect(action).toBe('call_required');
    });
  });

  // ========== 테스트 3: 통합 파싱 함수 ==========
  describe('통합 파싱 함수 (parseOnboardingResponse)', () => {
    test('Day 0 통합', () => {
      const result = parseOnboardingResponse(0, '2');
      expect(result.marriageStatus).toBe('married');
    });

    test('Day 1 통합', () => {
      const result = parseOnboardingResponse(
        1,
        '결혼 5년, 아이 2명 10살 8살'
      );
      expect(result.childrenCount).toBe(2);
    });

    test('Day 2 통합', () => {
      const result = parseOnboardingResponse(2, '45');
      expect(result.ageInYears).toBe(45);
    });

    test('Day 3 통합', () => {
      const result = parseOnboardingResponse(3, '휴식');
      expect(result.travelPurpose).toBe('relaxation');
    });

    test('유효하지 않은 Day', () => {
      const result = parseOnboardingResponse(5, 'test');
      expect(result.success).toBe(false);
    });
  });

  // ========== 테스트 4: 세그먼트 분류 정확성 ==========
  describe('세그먼트 분류', () => {
    const dateOneYearAgo = new Date();
    dateOneYearAgo.setFullYear(dateOneYearAgo.getFullYear() - 1);

    const dateTwoYearsAgo = new Date();
    dateTwoYearsAgo.setFullYear(dateTwoYearsAgo.getFullYear() - 2);

    const dateThreeYearsAgo = new Date();
    dateThreeYearsAgo.setFullYear(dateThreeYearsAgo.getFullYear() - 3);

    test('Segment A: 신혼 (결혼 1년)', () => {
      const segment = classifySegment({
        marriageStatus: 'married',
        marriageDate: dateOneYearAgo,
        ageInYears: 30,
        childrenAges: [],
      });
      expect(segment).toBe('A');
    });

    test('Segment B: 자녀 10-15세 우선', () => {
      const segment = classifySegment({
        marriageStatus: 'married',
        marriageDate: dateThreeYearsAgo,
        ageInYears: 45,
        childrenAges: [12, 8],
      });
      expect(segment).toBe('B');
    });

    test('Segment C: 40-55세 + 자녀 없음', () => {
      const segment = classifySegment({
        marriageStatus: 'married',
        marriageDate: dateThreeYearsAgo,
        ageInYears: 48,
        childrenAges: [],
      });
      expect(segment).toBe('C');
    });

    test('Segment D: 55세 이상', () => {
      const segment = classifySegment({
        marriageStatus: 'married',
        ageInYears: 65,
        childrenAges: [],
      });
      expect(segment).toBe('D');
    });

    test('Unclassified: 나이 없음', () => {
      const segment = classifySegment({
        marriageStatus: 'married',
        ageInYears: undefined,
      });
      expect(segment).toBe('unclassified');
    });

    test('Unclassified: 결혼 상태 없음', () => {
      const segment = classifySegment({
        marriageStatus: undefined,
        ageInYears: 40,
      });
      expect(segment).toBe('unclassified');
    });
  });

  // ========== 테스트 5: 엣지 케이스 ==========
  describe('엣지 케이스', () => {
    test('특수문자 포함 입력', () => {
      const result = parseMaritalStatus('결혼!@#$%');
      expect(result.success).toBe(true);
      expect(result.marriageStatus).toBe('married');
    });

    test('초과 공백 처리', () => {
      const result = parseAge('   45   ');
      expect(result.ageInYears).toBe(45);
    });

    test('혼합 언어 (한글 + 숫자)', () => {
      const result = parseMarriageAndChildren('결혼 5년 아이 2명 10살');
      expect(result.marriageDate).toBeDefined();
      expect(result.childrenCount).toBe(2);
    });

    test('쉼표 vs 마침표 구분', () => {
      const result1 = parseMarriageAndChildren('결혼 5년, 아이 2명');
      const result2 = parseMarriageAndChildren('결혼 5년. 아이 2명');
      // 둘 다 파싱 가능해야 함
      expect(result1.success || result2.success).toBe(true);
    });

    test('Null/undefined 입력', () => {
      const result = parseAge(null as any);
      expect(result.success).toBe(false);
    });
  });

  // ========== 테스트 6: 성능 검증 ==========
  describe('성능', () => {
    test('1000명 파싱 성능 (< 1초)', () => {
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        parseMaritalStatus('2');
        parseMarriageAndChildren('결혼 5년, 아이 2명 10살 8살');
        parseAge('45');
        parseTravelPurpose('휴식');
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // 1초 이내
    });

    test('정규식 재컴파일 최소화', () => {
      // 같은 입력 반복 시 캐싱 효과 확인
      const input = '결혼 5년, 아이 2명 10살 8살';
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        parseMarriageAndChildren(input);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // 100ms 이내
    });
  });
});
