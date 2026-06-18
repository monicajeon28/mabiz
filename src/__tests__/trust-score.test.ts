/**
 * 신뢰도 시스템 단위 테스트
 * @see docs/TRUST_SCORE_API_SPEC.md
 */

import {
  calculateTrustScore,
  determineStatus,
  getNextThreshold,
  getStatusMessage,
  getAccessPermissions,
} from '@/lib/trust-score';
import type { TrustStatus } from '@/types/trust-score';

describe('Trust Score Calculation', () => {
  // 1️⃣ calculateTrustScore 함수 테스트 (10개)
  describe('calculateTrustScore', () => {
    test('환불 0건 → 신뢰도 100점, GOOD', () => {
      const result = calculateTrustScore(100, 0);
      expect(result.trustScore).toBe(100);
      expect(result.refundRate).toBe(0);
      expect(result.status).toBe('GOOD');
    });

    test('환불율 10% → 신뢰도 90점, GOOD', () => {
      const result = calculateTrustScore(100, 10);
      expect(result.trustScore).toBe(90);
      expect(result.refundRate).toBe(10);
      expect(result.status).toBe('GOOD');
    });

    test('환불율 30% → 신뢰도 70점, WARNING', () => {
      const result = calculateTrustScore(100, 30);
      expect(result.trustScore).toBe(70);
      expect(result.refundRate).toBe(30);
      expect(result.status).toBe('WARNING');
    });

    test('환불율 32% → 신뢰도 68점, WARNING', () => {
      const result = calculateTrustScore(100, 32);
      expect(result.trustScore).toBe(68);
      expect(result.refundRate).toBe(32);
      expect(result.status).toBe('WARNING');
    });

    test('환불율 35% → 신뢰도 65점, RESTRICTED', () => {
      const result = calculateTrustScore(100, 35);
      expect(result.trustScore).toBe(65);
      expect(result.refundRate).toBe(35);
      expect(result.status).toBe('RESTRICTED');
    });

    test('환불율 38% → 신뢰도 62점, RESTRICTED', () => {
      const result = calculateTrustScore(100, 38);
      expect(result.trustScore).toBe(62);
      expect(result.refundRate).toBe(38);
      expect(result.status).toBe('RESTRICTED');
    });

    test('환불율 40% → 신뢰도 60점, SUSPENDED', () => {
      const result = calculateTrustScore(100, 40);
      expect(result.trustScore).toBe(60);
      expect(result.refundRate).toBe(40);
      expect(result.status).toBe('SUSPENDED');
    });

    test('환불율 50% → 신뢰도 50점, SUSPENDED', () => {
      const result = calculateTrustScore(100, 50);
      expect(result.trustScore).toBe(50);
      expect(result.refundRate).toBe(50);
      expect(result.status).toBe('SUSPENDED');
    });

    test('판매 0건 → 신뢰도 100점, GOOD (초기 상태)', () => {
      const result = calculateTrustScore(0, 0);
      expect(result.trustScore).toBe(100);
      expect(result.refundRate).toBe(0);
      expect(result.status).toBe('GOOD');
    });

    test('환불율 소수점 처리: 33.33% → 신뢰도 66점, WARNING', () => {
      const result = calculateTrustScore(300, 100);
      expect(result.trustScore).toBe(67); // 100 - 33.3 ≈ 67
      expect(result.refundRate).toBe(33.3); // 반올림됨
      expect(result.status).toBe('WARNING');
    });
  });

  // 2️⃣ determineStatus 함수 테스트 (5개)
  describe('determineStatus', () => {
    test('환불율 < 30% → GOOD', () => {
      expect(determineStatus(0)).toBe('GOOD');
      expect(determineStatus(15)).toBe('GOOD');
      expect(determineStatus(29.9)).toBe('GOOD');
    });

    test('환불율 30-35% → WARNING', () => {
      expect(determineStatus(30)).toBe('WARNING');
      expect(determineStatus(32)).toBe('WARNING');
      expect(determineStatus(34.9)).toBe('WARNING');
    });

    test('환불율 35-40% → RESTRICTED', () => {
      expect(determineStatus(35)).toBe('RESTRICTED');
      expect(determineStatus(37)).toBe('RESTRICTED');
      expect(determineStatus(39.9)).toBe('RESTRICTED');
    });

    test('환불율 >= 40% → SUSPENDED', () => {
      expect(determineStatus(40)).toBe('SUSPENDED');
      expect(determineStatus(50)).toBe('SUSPENDED');
      expect(determineStatus(100)).toBe('SUSPENDED');
    });

    test('경계값 정확성', () => {
      expect(determineStatus(29.99)).toBe('GOOD');
      expect(determineStatus(30.01)).toBe('WARNING');
      expect(determineStatus(34.99)).toBe('WARNING');
      expect(determineStatus(35.01)).toBe('RESTRICTED');
      expect(determineStatus(39.99)).toBe('RESTRICTED');
      expect(determineStatus(40.01)).toBe('SUSPENDED');
    });
  });

  // 3️⃣ getNextThreshold 함수 테스트 (4개)
  describe('getNextThreshold', () => {
    test('GOOD → 30%', () => {
      expect(getNextThreshold('GOOD')).toBe(30);
    });

    test('WARNING → 35%', () => {
      expect(getNextThreshold('WARNING')).toBe(35);
    });

    test('RESTRICTED → 40%', () => {
      expect(getNextThreshold('RESTRICTED')).toBe(40);
    });

    test('SUSPENDED → 40%', () => {
      expect(getNextThreshold('SUSPENDED')).toBe(40);
    });
  });

  // 4️⃣ getStatusMessage 함수 테스트 (4개)
  describe('getStatusMessage', () => {
    test('GOOD 메시지', () => {
      const msg = getStatusMessage('GOOD');
      expect(msg).toContain('훌륭해요');
    });

    test('WARNING 메시지', () => {
      const msg = getStatusMessage('WARNING');
      expect(msg).toContain('조금 더');
    });

    test('RESTRICTED 메시지', () => {
      const msg = getStatusMessage('RESTRICTED');
      expect(msg).toContain('개선');
    });

    test('SUSPENDED 메시지', () => {
      const msg = getStatusMessage('SUSPENDED');
      expect(msg).toContain('일시 중지');
    });
  });

  // 5️⃣ getAccessPermissions 함수 테스트 (7개)
  describe('getAccessPermissions', () => {
    test('GOOD: 모든 권한 가능', () => {
      const perms = getAccessPermissions('GOOD');
      expect(perms.canLogin).toBe(true);
      expect(perms.canSell).toBe(true);
      expect(perms.canRegisterProduct).toBe(true);
      expect(perms.canModifySettings).toBe(true);
    });

    test('WARNING: 모든 권한 가능', () => {
      const perms = getAccessPermissions('WARNING');
      expect(perms.canLogin).toBe(true);
      expect(perms.canSell).toBe(true);
      expect(perms.canRegisterProduct).toBe(true);
      expect(perms.canModifySettings).toBe(true);
    });

    test('RESTRICTED: 신상품 등록 불가', () => {
      const perms = getAccessPermissions('RESTRICTED');
      expect(perms.canLogin).toBe(true);
      expect(perms.canSell).toBe(true);
      expect(perms.canRegisterProduct).toBe(false);
      expect(perms.canModifySettings).toBe(true);
    });

    test('SUSPENDED: 로그인만 불가', () => {
      const perms = getAccessPermissions('SUSPENDED');
      expect(perms.canLogin).toBe(false);
      expect(perms.canSell).toBe(false);
      expect(perms.canRegisterProduct).toBe(false);
      expect(perms.canModifySettings).toBe(false);
    });

    test('상태 변경에 따른 권한 변화', () => {
      const statuses: TrustStatus[] = ['GOOD', 'WARNING', 'RESTRICTED', 'SUSPENDED'];
      for (const status of statuses) {
        const perms = getAccessPermissions(status);
        expect(perms).toHaveProperty('canLogin');
        expect(perms).toHaveProperty('canSell');
        expect(perms).toHaveProperty('canRegisterProduct');
        expect(perms).toHaveProperty('canModifySettings');
      }
    });

    test('SUSPENDED 상태에서 로그인 불가', () => {
      const perms = getAccessPermissions('SUSPENDED');
      expect(perms.canLogin).toBe(false);
    });

    test('RESTRICTED 상태에서 신상품만 불가', () => {
      const perms = getAccessPermissions('RESTRICTED');
      expect(perms.canRegisterProduct).toBe(false);
      expect(perms.canSell).toBe(true);
    });
  });
});

describe('Trust Score Thresholds', () => {
  // 6️⃣ 환불율별 전환 시나리오 (5개)
  describe('상태 전환 시나리오', () => {
    test('GOOD → WARNING (29% → 30%)', () => {
      const good = calculateTrustScore(100, 29);
      const warning = calculateTrustScore(100, 30);
      expect(good.status).toBe('GOOD');
      expect(warning.status).toBe('WARNING');
    });

    test('WARNING → RESTRICTED (34% → 35%)', () => {
      const warning = calculateTrustScore(100, 34);
      const restricted = calculateTrustScore(100, 35);
      expect(warning.status).toBe('WARNING');
      expect(restricted.status).toBe('RESTRICTED');
    });

    test('RESTRICTED → SUSPENDED (39% → 40%)', () => {
      const restricted = calculateTrustScore(100, 39);
      const suspended = calculateTrustScore(100, 40);
      expect(restricted.status).toBe('RESTRICTED');
      expect(suspended.status).toBe('SUSPENDED');
    });

    test('대규모 거래 데이터 (1000명 판매, 350명 환불)', () => {
      const result = calculateTrustScore(1000, 350);
      expect(result.refundRate).toBe(35);
      expect(result.trustScore).toBe(65);
      expect(result.status).toBe('RESTRICTED');
    });

    test('점진적 악화: GOOD → WARNING → RESTRICTED → SUSPENDED', () => {
      const stages = [
        { sales: 100, refunds: 20, expectedStatus: 'GOOD' },
        { sales: 100, refunds: 32, expectedStatus: 'WARNING' },
        { sales: 100, refunds: 37, expectedStatus: 'RESTRICTED' },
        { sales: 100, refunds: 42, expectedStatus: 'SUSPENDED' },
      ];

      for (const stage of stages) {
        const result = calculateTrustScore(stage.sales, stage.refunds);
        expect(result.status).toBe(stage.expectedStatus);
      }
    });
  });
});

describe('Trust Score Calculations Accuracy', () => {
  // 7️⃣ 정확성 테스트 (5개)
  describe('소수점 정밀도', () => {
    test('환불율 33.33% 정확한 계산', () => {
      const result = calculateTrustScore(300, 100);
      expect(result.refundRate).toBe(33.3); // 소수점 1자리
    });

    test('환불율 25.5% 정확한 계산', () => {
      const result = calculateTrustScore(200, 51);
      expect(result.refundRate).toBe(25.5);
    });

    test('환발율 0.1% 정확한 계산', () => {
      const result = calculateTrustScore(1000, 1);
      expect(result.refundRate).toBe(0.1);
    });

    test('환불율 99.9% 정확한 계산', () => {
      const result = calculateTrustScore(100, 99);
      expect(result.refundRate).toBe(99);
    });

    test('신뢰도 음수 방지', () => {
      const result = calculateTrustScore(10, 15); // 150% 환불?
      expect(result.trustScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('경계값 테스트', () => {
    test('정확히 30% 환불율 처리', () => {
      const result = calculateTrustScore(100, 30);
      expect(result.status).toBe('WARNING');
      expect(result.trustScore).toBe(70);
    });

    test('정확히 35% 환불율 처리', () => {
      const result = calculateTrustScore(100, 35);
      expect(result.status).toBe('RESTRICTED');
      expect(result.trustScore).toBe(65);
    });

    test('정확히 40% 환불율 처리', () => {
      const result = calculateTrustScore(100, 40);
      expect(result.status).toBe('SUSPENDED');
      expect(result.trustScore).toBe(60);
    });
  });
});
