/**
 * L7 Lens (Family Persuasion) API Tests
 * Menu #50: 동반자 설득 API 통합 테스트
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { prisma } from '@/lib/prisma';

describe('L7 Family Assessment APIs', () => {
  let testContactId: string;
  let organizationId = 'test-org-001';

  beforeEach(async () => {
    // Create test contact
    const contact = await prisma.contact.create({
      data: {
        phone: '010-1234-5678',
        organizationId,
        name: '테스트고객',
      },
    });
    testContactId = contact.id;
  });

  afterEach(async () => {
    // Cleanup
    await prisma.contact.deleteMany({
      where: { organizationId },
    });
  });

  describe('POST /api/my/family-assessment', () => {
    it('should assess family composition and decision maker', async () => {
      const response = await fetch('/api/my/family-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: testContactId,
          familyComposition: 'spouse',
          decisionMaker: 'self',
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.contact.familyComposition).toBe('spouse');
      expect(data.contact.decisionMaker).toBe('self');
      expect(data.contact.familyAssessmentCompletedAt).toBeDefined();
    });

    it('should return 400 if familyComposition is missing', async () => {
      const response = await fetch('/api/my/family-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: testContactId,
          // familyComposition missing
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });

  describe('GET /api/my/family-assessment', () => {
    beforeEach(async () => {
      // Create assessed contact
      await prisma.contact.update({
        where: { id: testContactId },
        data: {
          familyComposition: 'spouse',
          decisionMaker: 'self',
          spouseName: '배우자이름',
          spousePhone: '010-9876-5432',
          spouseEngagement: 'interested',
          familyAssessmentCompletedAt: new Date(),
        },
      });
    });

    it('should retrieve family assessment data', async () => {
      const response = await fetch(
        `/api/my/family-assessment?contactId=${testContactId}`
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.contact.familyComposition).toBe('spouse');
      expect(data.contact.spouseName).toBe('배우자이름');
      expect(data.contact.spouseEngagement).toBe('interested');
    });

    it('should return 400 if contactId is missing', async () => {
      const response = await fetch('/api/my/family-assessment');

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should return 404 if contact not found', async () => {
      const response = await fetch(
        '/api/my/family-assessment?contactId=invalid-id'
      );

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });

  describe('POST /api/my/family-assessment/score', () => {
    it('should calculate family influence score correctly', async () => {
      const response = await fetch('/api/my/family-assessment/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: testContactId,
          spouseName: '이영희',
          spousePhone: '010-9876-5432',
          spouseEngagement: 'interested',
          parentName: '김순신',
          parentPhone: '010-5555-5555',
          parentEngagement: 'convinced',
          friendName: '박민수',
          friendPhone: '010-3333-3333',
          friendEngagement: 'aware',
          familyObjections: ['비용 부담', '시간 부족'],
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      // Score should be (50 + 100 + 25) / 3 = 58.33 → 58
      expect(data.score).toBe(58);
      expect(data.stage).toBe('interested');
      expect(data.contact.familyInfluenceScore).toBe(58);
    });

    it('should properly stage based on score ranges', async () => {
      // Test high score (convinced)
      let response = await fetch('/api/my/family-assessment/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: testContactId,
          spouseEngagement: 'convinced',
          parentEngagement: 'convinced',
          friendEngagement: 'convinced',
        }),
      });

      let data = await response.json();
      expect(data.stage).toBe('convinced');

      // Test low score (hesitant)
      response = await fetch('/api/my/family-assessment/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: testContactId,
          spouseEngagement: 'not_contacted',
          parentEngagement: 'aware',
          friendEngagement: 'not_contacted',
        }),
      });

      data = await response.json();
      expect(data.stage).toBe('hesitant');
    });

    it('should return 400 if contactId is missing', async () => {
      const response = await fetch('/api/my/family-assessment/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // contactId missing
          spouseEngagement: 'interested',
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });

  describe('POST /api/sms/family-persuasion', () => {
    beforeEach(async () => {
      await prisma.contact.update({
        where: { id: testContactId },
        data: {
          familyComposition: 'spouse',
          spouseName: '이영희',
          spousePhone: '010-9876-5432',
        },
      });
    });

    it('should send Day 0 SMS to spouse', async () => {
      const response = await fetch('/api/sms/family-persuasion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: testContactId,
          targetRole: 'spouse',
          day: 0,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.details.recipientName).toBe('이영희');
      expect(data.details.recipientPhone).toBe('010-9876-5432');
      expect(data.details.day).toBe(0);
      expect(data.details.targetRole).toBe('spouse');
    });

    it('should track SMS day status in contact', async () => {
      await fetch('/api/sms/family-persuasion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: testContactId,
          targetRole: 'spouse',
          day: 0,
        }),
      });

      const contact = await prisma.contact.findUnique({
        where: { id: testContactId },
      });

      expect(contact?.companionSmsDay0Sent).toBe(true);
      expect(contact?.companionSmsDay0SentAt).toBeDefined();
    });

    it('should return 400 if targetRole has no phone number', async () => {
      const response = await fetch('/api/sms/family-persuasion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: testContactId,
          targetRole: 'parent', // parent phone not set
          day: 0,
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('phone number');
    });
  });

  describe('GET /api/my/family-analytics', () => {
    it('should retrieve family persuasion analytics', async () => {
      const response = await fetch('/api/my/family-analytics?period=30');

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.summary).toBeDefined();
      expect(data.summary.totalContacts).toBeGreaterThanOrEqual(0);
      expect(data.smsSequence).toBeDefined();
      expect(data.familyComposition).toBeDefined();
      expect(data.spouseEngagement).toBeDefined();
      expect(data.topObjections).toBeInstanceOf(Array);
    });

    it('should calculate conversion rate correctly', async () => {
      // Create multiple test contacts with different stages
      const contacts = await Promise.all([
        prisma.contact.create({
          data: {
            phone: '010-1111-1111',
            organizationId,
            name: '예약완료1',
            companionPersuasionStage: 'booked',
            companionPersuasionStartedAt: new Date(),
          },
        }),
        prisma.contact.create({
          data: {
            phone: '010-2222-2222',
            organizationId,
            name: '예약완료2',
            companionPersuasionStage: 'booked',
            companionPersuasionStartedAt: new Date(),
          },
        }),
        prisma.contact.create({
          data: {
            phone: '010-3333-3333',
            organizationId,
            name: '관심만함',
            companionPersuasionStage: 'interested',
            companionPersuasionStartedAt: new Date(),
          },
        }),
      ]);

      const response = await fetch('/api/my/family-analytics?period=30');
      const data = await response.json();

      expect(data.summary.bookedCount).toBe(2);
      expect(data.summary.bookedPercentage).toBeGreaterThan(0);
    });
  });

  describe('Integration: Full L7 Flow', () => {
    it('should complete full family persuasion flow', async () => {
      // Step 1: Assess family composition
      let response = await fetch('/api/my/family-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: testContactId,
          familyComposition: 'spouse',
          decisionMaker: 'self',
        }),
      });
      expect(response.status).toBe(200);

      // Step 2: Calculate family influence score
      response = await fetch('/api/my/family-assessment/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: testContactId,
          spouseName: '테스트배우자',
          spousePhone: '010-9876-5432',
          spouseEngagement: 'interested',
        }),
      });
      expect(response.status).toBe(200);
      const scoreData = await response.json();
      expect(scoreData.stage).toBe('interested');

      // Step 3: Send Day 0 SMS
      response = await fetch('/api/sms/family-persuasion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: testContactId,
          targetRole: 'spouse',
          day: 0,
        }),
      });
      expect(response.status).toBe(200);

      // Step 4: Retrieve analytics
      response = await fetch('/api/my/family-analytics?period=30');
      expect(response.status).toBe(200);
      const analytics = await response.json();
      expect(analytics.success).toBe(true);
    });
  });
});
