import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '@/lib/prisma';
import { detectSegment } from '@/lib/segment-detector';
import { recommendProducts } from '@/lib/product-recommender';

describe('Contact API - Segment Detection & Product Recommendation', () => {
  let testOrgId: string;

  beforeAll(async () => {
    // 테스트용 조직 생성
    const org = await prisma.organization.create({
      data: {
        name: 'Test Organization for Segment',
        slug: `test-segment-${Date.now()}`,
      },
    });
    testOrgId = org.id;
  });

  afterAll(async () => {
    // 테스트 데이터 삭제
    await prisma.contact.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.organization.delete({
      where: { id: testOrgId },
    });
  });

  describe('Segment Detection', () => {
    it('30대 기혼 자녀0 → segment=A', () => {
      const segment = detectSegment({
        age: 30,
        maritalStatus: 'MARRIED',
        childrenCount: 0,
      });
      expect(segment).toBe('A');
    });

    it('40대 기혼 자녀2 → segment=B', () => {
      const segment = detectSegment({
        age: 45,
        maritalStatus: 'MARRIED',
        childrenCount: 2,
      });
      expect(segment).toBe('B');
    });

    it('나이 미입력 → fallback 처리', () => {
      const segment = detectSegment({
        age: undefined,
        maritalStatus: 'MARRIED',
        childrenCount: 0,
      });
      expect(segment).toBeDefined();
      expect(['A', 'B', 'C', 'D', 'E']).toContain(segment);
    });

    it('maritalStatus 빈 문자열 → 정상 처리', () => {
      const segment = detectSegment({
        age: 30,
        maritalStatus: '',
        childrenCount: 0,
      });
      expect(segment).toBeDefined();
      expect(['A', 'B', 'C', 'D', 'E']).toContain(segment);
    });

    it('maritalStatus null → 정상 처리', () => {
      const segment = detectSegment({
        age: 30,
        maritalStatus: null,
        childrenCount: 0,
      });
      expect(segment).toBeDefined();
      expect(['A', 'B', 'C', 'D', 'E']).toContain(segment);
    });
  });

  describe('Product Recommendation', () => {
    it('Segment A → AI_PACKAGE 추천', () => {
      const recommendations = recommendProducts('A');
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].productCode).toBe('AI_PACKAGE');
      expect(recommendations[0].rank).toBe('primary');
    });

    it('Segment B → AI_PACKAGE 추천', () => {
      const recommendations = recommendProducts('B');
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].productCode).toBe('AI_PACKAGE');
      expect(recommendations[0].rank).toBe('primary');
    });

    it('모든 세그먼트 추천값 검증', () => {
      const segments = ['A', 'B', 'C', 'D', 'E'] as const;
      segments.forEach((seg) => {
        const recommendations = recommendProducts(seg);
        expect(recommendations.length).toBeGreaterThan(0);
        expect(recommendations[0].rank).toBe('primary');
        expect(recommendations[0].productCode).toBeTruthy();
      });
    });
  });

  describe('Database Persistence', () => {
    it('Contact 생성 시 segment 저장', async () => {
      const contact = await prisma.contact.create({
        data: {
          name: 'Test User A',
          phone: `+82-10-segment-${Date.now()}`,
          organizationId: testOrgId,
          age: 30,
          maritalStatus: 'MARRIED',
          childrenCount: 0,
          segment: 'A',
          recommendedProduct: 'AI_PACKAGE',
        },
      });

      expect(contact.segment).toBe('A');
      expect(contact.recommendedProduct).toBe('AI_PACKAGE');

      // 조회 검증
      const retrieved = await prisma.contact.findUnique({
        where: { id: contact.id },
      });
      expect(retrieved?.segment).toBe('A');
      expect(retrieved?.recommendedProduct).toBe('AI_PACKAGE');
    });

    it('Contact 생성 시 segment와 recommendedProduct 함께 저장', async () => {
      const age = 45;
      const maritalStatus = 'MARRIED';
      const childrenCount = 2;
      const segment = detectSegment({ age, maritalStatus, childrenCount });
      const recommendations = recommendProducts(segment);
      const recommendedProduct = recommendations[0]?.productCode;

      const contact = await prisma.contact.create({
        data: {
          name: 'Test User B',
          phone: `+82-10-segment-b-${Date.now()}`,
          organizationId: testOrgId,
          age,
          maritalStatus,
          childrenCount,
          segment,
          recommendedProduct: recommendedProduct || null,
        },
      });

      expect(contact.segment).toBe('B');
      expect(contact.recommendedProduct).toBe('AI_PACKAGE');
    });
  });
});
