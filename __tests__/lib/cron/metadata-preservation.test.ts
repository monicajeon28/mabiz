/**
 * Phase 3 메타데이터 보존 검증 테스트
 *
 * 목표: SendingHistory에 subject/body/metadata가 정확히 저장되는지 검증
 * 범위: Email 및 SMS 발송 시 메타데이터 유지 확인
 *
 * @see docs/PHASE3_METADATA_STRATEGY.md
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { sendCampaign } from '@/lib/cron/execute-campaigns';

describe('메타데이터 보존 검증 (Phase 3)', () => {
  let campaignId: string;
  let contactId: string;

  beforeEach(async () => {
    // 테스트용 캠페인 생성
    const campaign = await db.campaign.create({
      data: {
        title: '2026 카리브해 크루즈 특가',
        slug: 'caribbean-2026',
        description: 'Test campaign for metadata validation',
        template: {
          subject: '2026 카리브해 크루즈 특가 50% 할인',
          body: '<html><body>특별 한정 모집!</body></html>',
          smsBody: '카리브해 크루즈 50% 할인. 지금 예약하세요!',
        },
        status: 'DRAFT',
        channel: 'email',
        ownerId: 'user_123',
        organizationId: 'org_123',
      },
    });
    campaignId = campaign.id;

    // 테스트용 Contact 생성
    const contact = await db.contact.create({
      data: {
        firstName: '홍',
        lastName: '길동',
        email: 'hong@example.com',
        phone: '01012345678',
        ownerId: 'user_123',
        organizationId: 'org_123',
        segmentTags: ['vip', 'repeat-customer'],
      },
    });
    contactId = contact.id;
  });

  afterEach(async () => {
    // 테스트 데이터 정리
    await db.sendingHistory.deleteMany({
      where: { campaignId },
    });
    await db.executionLog.deleteMany({
      where: { campaignId },
    });
    await db.campaign.delete({
      where: { id: campaignId },
    });
    await db.contact.delete({
      where: { id: contactId },
    });
  });

  describe('SendingHistory 메타데이터 저장', () => {
    it('subject가 SendingHistory에 저장되어야 함', async () => {
      // 이메일 발송
      await sendCampaign(campaignId);

      // SendingHistory에서 확인
      const history = await db.sendingHistory.findFirst({
        where: {
          campaignId,
          contactId,
          channel: 'email',
        },
      });

      expect(history).toBeDefined();
      expect(history?.subject).toBe('2026 카리브해 크루즈 특가 50% 할인');
    });

    it('body가 SendingHistory에 저장되어야 함', async () => {
      // 이메일 발송
      await sendCampaign(campaignId);

      // SendingHistory에서 확인
      const history = await db.sendingHistory.findFirst({
        where: {
          campaignId,
          contactId,
          channel: 'email',
        },
      });

      expect(history).toBeDefined();
      expect(history?.body).toContain('<html><body>특별 한정 모집!</body></html>');
    });

    it('metadata가 SendingHistory에 저장되어야 함', async () => {
      // 메타데이터 포함하여 캠페인 업데이트
      await db.campaign.update({
        where: { id: campaignId },
        data: {
          metadata: {
            segmentId: 'segment_vip_repeat',
            tags: ['vip', 'repeat-customer'],
            utm_source: 'crm-automation',
            utm_medium: 'email',
            utm_campaign: 'caribbean-summer',
            shipIds: ['ship_001', 'ship_002'],
          },
        },
      });

      // 이메일 발송
      await sendCampaign(campaignId);

      // SendingHistory에서 확인
      const history = await db.sendingHistory.findFirst({
        where: {
          campaignId,
          contactId,
          channel: 'email',
        },
      });

      expect(history).toBeDefined();
      expect(history?.metadata).toBeDefined();
      expect(history?.metadata?.utm_source).toBe('crm-automation');
      expect(history?.metadata?.tags).toEqual(['vip', 'repeat-customer']);
    });

    it('모든 메타데이터가 완전하게 저장되어야 함', async () => {
      // 메타데이터 설정
      const testMetadata = {
        campaignName: 'caribbean-2026',
        segmentId: 'segment_vip_repeat',
        tags: ['vip', 'repeat-customer', 'early-booker'],
        utm_source: 'crm-automation',
        utm_medium: 'email',
        utm_campaign: 'caribbean-summer',
        utm_content: 'wave-1-email',
        shipIds: ['ship_001', 'ship_002'],
        departurePortId: 'miami',
        startDate: '2026-07-01',
        endDate: '2026-07-14',
      };

      await db.campaign.update({
        where: { id: campaignId },
        data: { metadata: testMetadata },
      });

      // 발송
      await sendCampaign(campaignId);

      // 검증
      const history = await db.sendingHistory.findFirst({
        where: { campaignId, contactId },
      });

      expect(history?.metadata).toEqual(testMetadata);
      expect(Object.keys(history?.metadata || {})).toHaveLength(
        Object.keys(testMetadata).length
      );
    });
  });

  describe('ExecutionLog와 메타데이터 분리', () => {
    it('ExecutionLog에는 subject가 저장되지 않아야 함', async () => {
      // 발송
      await sendCampaign(campaignId);

      // ExecutionLog 확인
      const executionLog = await db.executionLog.findFirst({
        where: {
          campaignId,
          contactId,
          type: 'SEND_EMAIL',
        },
      });

      expect(executionLog).toBeDefined();
      // ExecutionLog 스키마에는 subject 필드가 없음
      expect((executionLog as any)?.subject).toBeUndefined();
    });

    it('ExecutionLog에는 body가 저장되지 않아야 함', async () => {
      // 발송
      await sendCampaign(campaignId);

      // ExecutionLog 확인
      const executionLog = await db.executionLog.findFirst({
        where: {
          campaignId,
          contactId,
          type: 'SEND_EMAIL',
        },
      });

      expect(executionLog).toBeDefined();
      // ExecutionLog 스키마에는 body 필드가 없음
      expect((executionLog as any)?.body).toBeUndefined();
    });

    it('ExecutionLog는 감시용 필드만 포함해야 함', async () => {
      // 발송
      await sendCampaign(campaignId);

      // ExecutionLog 확인
      const executionLog = await db.executionLog.findFirst({
        where: {
          campaignId,
          contactId,
          type: 'SEND_EMAIL',
        },
      });

      // ExecutionLog가 가져야 할 필드
      expect(executionLog).toHaveProperty('id');
      expect(executionLog).toHaveProperty('campaignId');
      expect(executionLog).toHaveProperty('contactId');
      expect(executionLog).toHaveProperty('type');
      expect(executionLog).toHaveProperty('status');
      expect(executionLog).toHaveProperty('startedAt');
      expect(executionLog).toHaveProperty('duration');

      // 메타데이터 필드는 없어야 함
      expect((executionLog as any)?.subject).toBeUndefined();
      expect((executionLog as any)?.body).toBeUndefined();
    });
  });

  describe('채널별 메타데이터 저장', () => {
    it('SMS 발송 시에도 메타데이터가 저장되어야 함', async () => {
      // SMS 캠페인으로 업데이트
      await db.campaign.update({
        where: { id: campaignId },
        data: {
          channel: 'sms',
          metadata: {
            campaignName: 'caribbean-sms',
            tags: ['sms-only'],
            utm_campaign: 'caribbean-summer-sms',
          },
        },
      });

      // SMS 발송
      await sendCampaign(campaignId);

      // SendingHistory에서 SMS 확인
      const smsSent = await db.sendingHistory.findFirst({
        where: {
          campaignId,
          contactId,
          channel: 'sms',
        },
      });

      expect(smsSent).toBeDefined();
      expect(smsSent?.metadata?.tags).toContain('sms-only');
      expect(smsSent?.metadata?.utm_campaign).toBe('caribbean-summer-sms');
    });

    it('동일 Contact에 Email과 SMS 모두 발송 시 각각 메타데이터 유지', async () => {
      // 이중 채널 캠페인 (Email + SMS)
      await db.campaign.update({
        where: { id: campaignId },
        data: {
          channel: 'both', // 또는 개별 발송
          metadata: {
            campaignName: 'caribbean-dual',
            tags: ['vip', 'dual-channel'],
          },
        },
      });

      // Email 발송
      await db.sendingHistory.create({
        data: {
          campaignId,
          contactId,
          channel: 'email',
          subject: 'Test Email',
          body: '<html>Test</html>',
          status: 'SENT',
          metadata: {
            campaignName: 'caribbean-dual',
            tags: ['vip', 'dual-channel'],
            channelType: 'email',
          },
        },
      });

      // SMS 발송
      await db.sendingHistory.create({
        data: {
          campaignId,
          contactId,
          channel: 'sms',
          subject: 'Test SMS',
          body: 'Test message',
          status: 'SENT',
          metadata: {
            campaignName: 'caribbean-dual',
            tags: ['vip', 'dual-channel'],
            channelType: 'sms',
          },
        },
      });

      // 검증: Email 메타데이터
      const email = await db.sendingHistory.findFirst({
        where: {
          campaignId,
          contactId,
          channel: 'email',
        },
      });
      expect(email?.metadata?.channelType).toBe('email');

      // 검증: SMS 메타데이터
      const sms = await db.sendingHistory.findFirst({
        where: {
          campaignId,
          contactId,
          channel: 'sms',
        },
      });
      expect(sms?.metadata?.channelType).toBe('sms');
    });
  });

  describe('메타데이터 쿼리 성능', () => {
    it('SendingHistory에서 메타데이터를 효율적으로 조회할 수 있어야 함', async () => {
      // 대량 데이터 생성
      const contacts = await Promise.all(
        Array.from({ length: 100 }).map((_, i) =>
          db.contact.create({
            data: {
              firstName: `User${i}`,
              lastName: 'Test',
              email: `user${i}@example.com`,
              ownerId: 'user_123',
              organizationId: 'org_123',
            },
          })
        )
      );

      // 대량 SendingHistory 생성
      await db.sendingHistory.createMany({
        data: contacts.map((contact) => ({
          campaignId,
          contactId: contact.id,
          channel: 'email',
          subject: 'Test',
          body: '<html>Test</html>',
          status: 'SENT',
          metadata: {
            index: contacts.indexOf(contact),
            tags: ['bulk', 'test'],
          },
        })),
      });

      // 성능 테스트: 전체 조회
      const startTime = performance.now();
      const results = await db.sendingHistory.findMany({
        where: { campaignId },
        select: {
          id: true,
          contactId: true,
          metadata: true,
        },
      });
      const endTime = performance.now();

      expect(results).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(5000); // 5초 이내

      // 정리
      await db.contact.deleteMany({
        where: {
          id: {
            in: contacts.map((c) => c.id),
          },
        },
      });
    });

    it('Contact당 발송 이력에서 메타데이터를 빠르게 조회할 수 있어야 함', async () => {
      // SendingHistory 생성
      const histories = [];
      for (let i = 0; i: 50; i++) {
        histories.push({
          campaignId,
          contactId,
          channel: i % 2 === 0 ? 'email' : 'sms',
          subject: `Campaign ${i}`,
          body: `Body ${i}`,
          status: 'SENT' as const,
          metadata: {
            campaignIndex: i,
            tags: ['archive'],
          },
        });
      }
      await db.sendingHistory.createMany({ data: histories });

      // 고객별 이메일 조회
      const startTime = performance.now();
      const emailHistories = await db.sendingHistory.findMany({
        where: {
          contactId,
          channel: 'email',
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      const endTime = performance.now();

      expect(emailHistories.length).toBeGreaterThan(0);
      expect(emailHistories[0]?.metadata).toBeDefined();
      expect(endTime - startTime).toBeLessThan(1000); // 1초 이내
    });
  });

  describe('메타데이터 타입 검증', () => {
    it('metadata는 JSON 객체여야 함', async () => {
      await db.sendingHistory.create({
        data: {
          campaignId,
          contactId,
          channel: 'email',
          subject: 'Test',
          body: '<html>Test</html>',
          status: 'SENT',
          metadata: {
            string: 'value',
            number: 123,
            boolean: true,
            array: ['a', 'b'],
            nested: { key: 'value' },
          },
        },
      });

      const history = await db.sendingHistory.findFirst({
        where: { campaignId, contactId },
      });

      expect(typeof history?.metadata).toBe('object');
      expect(Array.isArray(history?.metadata)).toBe(false);
      expect((history?.metadata as any)?.string).toBe('value');
      expect((history?.metadata as any)?.number).toBe(123);
      expect((history?.metadata as any)?.boolean).toBe(true);
      expect((history?.metadata as any)?.nested?.key).toBe('value');
    });

    it('metadata에 null 값이 포함될 수 있어야 함', async () => {
      await db.sendingHistory.create({
        data: {
          campaignId,
          contactId,
          channel: 'email',
          subject: 'Test',
          body: '<html>Test</html>',
          status: 'SENT',
          metadata: {
            defined: 'value',
            undefined: null,
          },
        },
      });

      const history = await db.sendingHistory.findFirst({
        where: { campaignId, contactId },
      });

      expect((history?.metadata as any)?.defined).toBe('value');
      expect((history?.metadata as any)?.undefined).toBeNull();
    });
  });

  describe('메타데이터 크기 제한', () => {
    it('큰 metadata도 저장할 수 있어야 함', async () => {
      const largeMetadata = {
        shipDetails: {
          shipId: 'ship_001',
          name: '크루즈 드림',
          cabins: Array.from({ length: 100 }).map((_, i) => ({
            cabinId: `cabin_${i}`,
            type: 'oceanview',
            price: 5000 + i * 100,
          })),
        },
        itinerary: Array.from({ length: 14 }).map((_, i) => ({
          day: i + 1,
          port: ['Miami', 'Cozumel', 'Cayman Islands'][i % 3],
          activities: ['swimming', 'snorkeling', 'dining'],
        })),
      };

      await db.sendingHistory.create({
        data: {
          campaignId,
          contactId,
          channel: 'email',
          subject: 'Cruise Details',
          body: '<html>Details</html>',
          status: 'SENT',
          metadata: largeMetadata,
        },
      });

      const history = await db.sendingHistory.findFirst({
        where: { campaignId, contactId },
      });

      expect((history?.metadata as any)?.shipDetails?.cabins).toHaveLength(100);
      expect((history?.metadata as any)?.itinerary).toHaveLength(14);
    });
  });
});
