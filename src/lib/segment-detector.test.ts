import { detectSegment } from './segment-detector';
import type { Segment } from '@/types/segment';

describe('segment-detector', () => {
  describe('detectSegment - 정상 케이스', () => {
    it('30대 커플 (미혼X, 자녀0) → A', () => {
      const result = detectSegment({
        age: 35,
        maritalStatus: 'MARRIED',
        childrenCount: 0,
      });
      expect(result).toBe('A');
    });

    it('40대 가족 (기혼O, 자녀2+) → B', () => {
      const result = detectSegment({
        age: 45,
        maritalStatus: 'MARRIED',
        childrenCount: 2,
      });
      expect(result).toBe('B');
    });

    it('중년 부부 (기혼O, 자녀0) → C', () => {
      const result = detectSegment({
        age: 55,
        maritalStatus: 'MARRIED',
        childrenCount: 0,
      });
      expect(result).toBe('C');
    });

    it('50-60대 (미혼 또는 기혼) → D', () => {
      const result = detectSegment({
        age: 58,
        maritalStatus: 'SINGLE',
        childrenCount: 0,
      });
      expect(result).toBe('D');
    });

    it('60대+ (모든 상태) → E', () => {
      const result = detectSegment({
        age: 68,
        maritalStatus: 'MARRIED',
        childrenCount: 1,
      });
      expect(result).toBe('E');
    });
  });

  describe('detectSegment - null/undefined 처리', () => {
    it('maritalStatus가 null → UNKNOWN으로 정규화 후 처리', () => {
      const result = detectSegment({
        age: 35,
        maritalStatus: null,
        childrenCount: 0,
      });
      // null이 처리되어야 하고, segment가 결정되어야 함
      expect(result).toBeTruthy();
      expect(['A', 'B', 'C', 'D', 'E']).toContain(result);
    });

    it('maritalStatus가 undefined → UNKNOWN으로 정규화 후 처리', () => {
      const result = detectSegment({
        age: 40,
        maritalStatus: undefined,
        childrenCount: 2,
      });
      expect(result).toBeTruthy();
      expect(['A', 'B', 'C', 'D', 'E']).toContain(result);
    });

    it('maritalStatus가 빈 문자열 → UNKNOWN으로 정규화 후 처리', () => {
      const result = detectSegment({
        age: 35,
        maritalStatus: '',
        childrenCount: 0,
      });
      expect(result).toBeTruthy();
      expect(['A', 'B', 'C', 'D', 'E']).toContain(result);
    });

    it('maritalStatus가 공백만 있음 → UNKNOWN으로 정규화 후 처리', () => {
      const result = detectSegment({
        age: 45,
        maritalStatus: '   ',
        childrenCount: 1,
      });
      expect(result).toBeTruthy();
      expect(['A', 'B', 'C', 'D', 'E']).toContain(result);
    });
  });

  describe('detectSegment - 경계값', () => {
    it('정확히 30세 → A', () => {
      const result = detectSegment({
        age: 30,
        maritalStatus: 'MARRIED',
        childrenCount: 0,
      });
      expect(result).toBe('A');
    });

    it('정확히 40세 → B', () => {
      const result = detectSegment({
        age: 40,
        maritalStatus: 'MARRIED',
        childrenCount: 1,
      });
      expect(result).toBe('B');
    });

    it('정확히 50세 → C 또는 D (경계)', () => {
      const result = detectSegment({
        age: 50,
        maritalStatus: 'MARRIED',
        childrenCount: 0,
      });
      expect(['C', 'D']).toContain(result);
    });

    it('정확히 60세 → D 또는 E (경계)', () => {
      const result = detectSegment({
        age: 60,
        maritalStatus: 'SINGLE',
        childrenCount: 0,
      });
      expect(['D', 'E']).toContain(result);
    });

    it('65세 이상 → E', () => {
      const result = detectSegment({
        age: 65,
        maritalStatus: 'MARRIED',
        childrenCount: 0,
      });
      expect(result).toBe('E');
    });
  });

  describe('detectSegment - 대소문자 처리', () => {
    it('maritalStatus 대문자 MARRIED → 정상 처리', () => {
      const result = detectSegment({
        age: 35,
        maritalStatus: 'MARRIED',
        childrenCount: 0,
      });
      expect(result).toBeTruthy();
    });

    it('maritalStatus 소문자 married → 대문자로 정규화 후 처리', () => {
      const result = detectSegment({
        age: 35,
        maritalStatus: 'married',
        childrenCount: 0,
      });
      expect(result).toBeTruthy();
    });

    it('maritalStatus 혼합 Married → 대문자로 정규화 후 처리', () => {
      const result = detectSegment({
        age: 35,
        maritalStatus: 'Married',
        childrenCount: 0,
      });
      expect(result).toBeTruthy();
    });
  });

  describe('detectSegment - 일관성', () => {
    it('같은 입력 → 같은 결과', () => {
      const input = {
        age: 45,
        maritalStatus: 'MARRIED',
        childrenCount: 2,
      };
      const result1 = detectSegment(input);
      const result2 = detectSegment(input);
      expect(result1).toBe(result2);
    });

    it('모든 가능한 세그먼트 범위 반환', () => {
      const segments = new Set<Segment>();
      for (let age = 20; age <= 80; age++) {
        segments.add(
          detectSegment({
            age,
            maritalStatus: 'MARRIED',
            childrenCount: 0,
          })
        );
      }
      // 최소 3개 이상의 서로 다른 세그먼트가 나와야 함
      expect(segments.size).toBeGreaterThanOrEqual(3);
    });
  });
});
