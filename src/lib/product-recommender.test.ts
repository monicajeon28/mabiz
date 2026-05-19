import { recommendProducts, getRecommendationMessage } from './product-recommender';
import type { Segment } from '@/types/segment';

describe('product-recommender', () => {
  describe('recommendProducts', () => {
    it('세그먼트 A (30대 커플) → AI_PACKAGE 1순위, GOLD_MEMBERSHIP 2순위', () => {
      const result = recommendProducts('A');
      expect(result[0].code).toBe('AI_PACKAGE');
      expect(result[1].code).toBe('GOLD_MEMBERSHIP');
    });

    it('세그먼트 B (40대 가족) → AI_PACKAGE 1순위, FREE_TRAVEL 2순위', () => {
      const result = recommendProducts('B');
      expect(result[0].code).toBe('AI_PACKAGE');
      expect(result[1].code).toBe('FREE_TRAVEL');
    });

    it('세그먼트 C (중년 부부) → GOLD_MEMBERSHIP 1순위, AI_PACKAGE 2순위', () => {
      const result = recommendProducts('C');
      expect(result[0].code).toBe('GOLD_MEMBERSHIP');
      expect(result[1].code).toBe('AI_PACKAGE');
    });

    it('세그먼트 D (50-60대) → BASIC_PACKAGE 1순위, AI_PACKAGE 2순위', () => {
      const result = recommendProducts('D');
      expect(result[0].code).toBe('BASIC_PACKAGE');
      expect(result[1].code).toBe('AI_PACKAGE');
    });

    it('세그먼트 E (60대+) → AI_PACKAGE 1순위, ABC_COURSE 2순위', () => {
      const result = recommendProducts('E');
      expect(result[0].code).toBe('AI_PACKAGE');
      expect(result[1].code).toBe('ABC_COURSE');
    });

    it('각 추천은 이유(reason)를 포함해야 함', () => {
      const result = recommendProducts('A');
      expect(result[0]).toHaveProperty('reason');
      expect(result[0].reason).toBeTruthy();
      expect(result[0].reason.length > 0).toBe(true);
    });

    it('모든 세그먼트는 정확히 2개 추천을 반환해야 함', () => {
      const segments: Segment[] = ['A', 'B', 'C', 'D', 'E'];
      segments.forEach((segment) => {
        const result = recommendProducts(segment);
        expect(result).toHaveLength(2);
      });
    });

    it('추천 순서는 일관성이 있어야 함 (같은 입력 → 같은 결과)', () => {
      const result1 = recommendProducts('C');
      const result2 = recommendProducts('C');
      expect(result1[0].code).toBe(result2[0].code);
      expect(result1[1].code).toBe(result2[1].code);
    });
  });

  describe('getRecommendationMessage', () => {
    it('세그먼트별 맞춤형 메시지를 반환해야 함', () => {
      const message = getRecommendationMessage('A');
      expect(message).toContain('크루즈');
      expect(message.length > 10).toBe(true);
    });

    it('모든 세그먼트가 메시지를 가져야 함', () => {
      const segments: Segment[] = ['A', 'B', 'C', 'D', 'E'];
      segments.forEach((segment) => {
        const message = getRecommendationMessage(segment);
        expect(message).toBeTruthy();
        expect(message.length > 0).toBe(true);
      });
    });

    it('메시지는 사용자 친화적이어야 함 (물음표 또는 느낌표 포함)', () => {
      const segments: Segment[] = ['A', 'B', 'C', 'D', 'E'];
      segments.forEach((segment) => {
        const message = getRecommendationMessage(segment);
        const hasPunctuation = message.includes('?') || message.includes('!');
        expect(hasPunctuation).toBe(true);
      });
    });
  });
});
