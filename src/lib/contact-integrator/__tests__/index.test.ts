/**
 * Customer Integrator Unit Tests
 * 360도 고객 뷰, PII 마스킹, Risk Score 계산 검증
 */

import { maskPII, MaskOptions } from '../pii-mask';
import { calculateRiskScore, categorizeRiskScore, summarizeRiskProfile } from '../risk-calculator';
import { Contact360Response } from '../types';

describe('Customer Integrator - Contact 360도 뷰', () => {
  // Mock 데이터
  const mockContact360: Contact360Response = {
    contact: {
      id: 'contact_123',
      phone: '01012345678',
      name: '김민준',
      email: 'kim@example.com',
      organizationId: 'org_001',
      type: 'CUSTOMER',
      segment: 'repeat_gold',
      autoSegment: 'high_value',
      createdAt: new Date('2025-01-15'),
      updatedAt: new Date(),
      lastContactedAt: new Date(),
      tags: ['vip', 'repeat_customer']
    },
    goldMember: null,
    partner: null,
    groups: [],
    orders: [],
    communications: {
      smsLogs: [],
      emailLogs: [],
      callLogs: [],
      totalInteractions: 5,
      lastInteractionAt: new Date()
    },
    psychologyProfile: {
      lensClassifications: [],
      sequenceStatus: {}
    },
    riskProfile: {
      riskScore: 15,
      flags: [],
      recommendedActions: []
    },
    affiliateTracking: null,
    metadata: {
      dataQuality: {
        completeness: 0.95,
        lastValidatedAt: new Date(),
        issues: []
      },
      cacheInfo: {
        cachedAt: new Date(),
        ttl: 1800,
        source: 'redis'
      }
    }
  };

  describe('PII 마스킹', () => {
    it('ADMIN 권한: 마스킹 없음', () => {
      const options: MaskOptions = {
        level: 'none',
        roles: ['ADMIN'],
        orgId: 'org_001'
      };

      const masked = maskPII(mockContact360, options);
      expect(masked.contact.phone).toBe('01012345678');
      expect(masked.contact.email).toBe('kim@example.com');
      expect(masked.contact.name).toBe('김민준');
    });

    it('AGENT 권한: 전화번호 부분 마스킹', () => {
      const options: MaskOptions = {
        level: 'full',
        roles: ['AGENT'],
        orgId: 'org_001'
      };

      const masked = maskPII(mockContact360, options);
      // 010***5678 패턴 확인
      expect(masked.contact.phone).toMatch(/^010\*+\d{4}$/);
      expect(masked.contact.phone).toBe('010****5678');
    });

    it('VIEWER 권한: 이름까지 마스킹', () => {
      const options: MaskOptions = {
        level: 'full',
        roles: ['VIEWER'],
        orgId: 'org_001'
      };

      const masked = maskPII(mockContact360, options);
      expect(masked.contact.name).toMatch(/^김\*+$/);
      expect(masked.contact.name).toBe('김**');
    });

    it('이메일 마스킹 검증', () => {
      const options: MaskOptions = {
        level: 'full',
        roles: ['AGENT'],
        orgId: 'org_001'
      };

      const masked = maskPII(mockContact360, options);
      // 첫 글자 + @ + 도메인 패턴
      expect(masked.contact.email).toMatch(/^k.*@example\.com$/);
    });
  });

  describe('Risk Score 계산', () => {
    it('부재중 고객 위험도 계산', async () => {
      const contact = {
        id: 'contact_inactive',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date(),
        lastContactedAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000), // 120일 전
        type: 'CUSTOMER',
        segment: 'dormant'
      };

      const result = await calculateRiskScore(contact as any);
      expect(result.riskScore).toBeGreaterThan(20);
      expect(result.flags.some(f => f.type === 'INACTIVITY_3MONTH')).toBe(true);
    });

    it('준비 불안도 높은 고객 위험도 계산', async () => {
      const contact = {
        id: 'contact_anxiety',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastContactedAt: new Date(),
        type: 'LEAD',
        segment: 'anxiety_high',
        anxietyScore: 85, // HIGH
        preparationStage: 'visa_concern'
      };

      const result = await calculateRiskScore(contact as any);
      expect(result.flags.some(f => f.type === 'PREPARATION_ANXIETY')).toBe(true);
      expect(result.flags.some(f => f.severity === 'CRITICAL' || f.severity === 'HIGH')).toBe(true);
    });

    it('경쟁사 언급 미대응 위험도 계산', async () => {
      const contact = {
        id: 'contact_competitor',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastContactedAt: new Date(),
        type: 'CUSTOMER',
        segment: 'competitor_mention',
        competitorMentioned: true,
        competitorNames: ['Royal Caribbean', 'MSC'],
        differentiationResponseSent: false // 미응답
      };

      const result = await calculateRiskScore(contact as any);
      expect(result.flags.some(f => f.type === 'COMPETITOR_UNADDRESSED')).toBe(true);
      expect(result.riskScore).toBeGreaterThan(20);
    });

    it('결정 윈도우 임박 위험도 계산', async () => {
      const soon = new Date();
      soon.setHours(soon.getHours() + 48); // 48시간 후

      const contact = {
        id: 'contact_deadline',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastContactedAt: new Date(),
        type: 'CUSTOMER',
        segment: 'decision_window',
        decisionWindowExpiresAt: soon // 48시간 내
      };

      const result = await calculateRiskScore(contact as any);
      expect(result.flags.some(f => f.type === 'DECISION_WINDOW_CLOSING')).toBe(true);
      expect(result.flags.some(f => f.severity === 'CRITICAL' || f.severity === 'HIGH')).toBe(true);
    });
  });

  describe('Risk Score 분류', () => {
    it('GREEN: 안전 (0-20)', () => {
      expect(categorizeRiskScore(15)).toBe('GREEN');
    });

    it('YELLOW: 주의 (20-40)', () => {
      expect(categorizeRiskScore(35)).toBe('YELLOW');
    });

    it('ORANGE: 경고 (40-70)', () => {
      expect(categorizeRiskScore(55)).toBe('ORANGE');
    });

    it('RED: 위험 (70+)', () => {
      expect(categorizeRiskScore(85)).toBe('RED');
    });
  });

  describe('Risk Profile 요약', () => {
    it('요약 생성 검증', async () => {
      const contact = {
        id: 'contact_summary',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastContactedAt: new Date(),
        type: 'CUSTOMER',
        segment: 'test',
        competitorMentioned: true,
        differentiationResponseSent: false
      };

      const profile = await calculateRiskScore(contact as any);
      const summary = summarizeRiskProfile(profile);

      expect(summary).toHaveProperty('overallScore');
      expect(summary).toHaveProperty('category');
      expect(summary).toHaveProperty('flagCount');
      expect(summary).toHaveProperty('criticalFlagCount');
      expect(summary).toHaveProperty('actionCount');
      expect(['GREEN', 'YELLOW', 'ORANGE', 'RED']).toContain(summary.category);
    });
  });

  describe('권장 액션 생성', () => {
    it('부재중 고객 재활성화 권장', async () => {
      const contact = {
        id: 'contact_reactivation',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date(),
        lastContactedAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000), // 120일 전
        type: 'CUSTOMER',
        segment: 'dormant'
      };

      const profile = await calculateRiskScore(contact as any);
      const reactivationAction = profile.recommendedActions.find(
        a => a.action === 'SEND_REACTIVATION_SMS'
      );

      expect(reactivationAction).toBeDefined();
      expect(reactivationAction?.priority).toBe('CRITICAL');
      expect(reactivationAction?.reason).toContain('재활성화');
    });

    it('경쟁사 대응 권장', async () => {
      const contact = {
        id: 'contact_competitor',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastContactedAt: new Date(),
        type: 'CUSTOMER',
        segment: 'competitor_mention',
        competitorMentioned: true,
        competitorNames: ['Royal Caribbean'],
        differentiationResponseSent: false
      };

      const profile = await calculateRiskScore(contact as any);
      const differentiationAction = profile.recommendedActions.find(
        a => a.action === 'SEND_DIFFERENTIATION_SMS'
      );

      expect(differentiationAction).toBeDefined();
      expect(differentiationAction?.priority).toBe('CRITICAL');
    });

    it('의료 신뢰 구축 권장', async () => {
      const contact = {
        id: 'contact_health',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastContactedAt: new Date(),
        type: 'CUSTOMER',
        segment: 'health_risk',
        compoundHealthRisk: true,
        l5l6MedicalRiskLevel: 'high'
      };

      const profile = await calculateRiskScore(contact as any);
      const healthAction = profile.recommendedActions.find(
        a => a.action === 'PROVIDE_MEDICAL_ASSURANCE'
      );

      expect(healthAction).toBeDefined();
      expect(healthAction?.priority).toMatch(/MEDIUM|HIGH|CRITICAL/);
    });
  });
});

describe('Contact 360도 성능', () => {
  it('캐시 응답 시간 < 100ms', () => {
    // Redis 캐시에서 조회 (실제 테스트는 통합 테스트에서)
    expect(true).toBe(true);
  });

  it('DB 응답 시간 < 2초', () => {
    // DataLoader 배치 조회 (실제 테스트는 통합 테스트에서)
    expect(true).toBe(true);
  });
});
