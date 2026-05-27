/**
 * POST /api/webhook/crm/customer-created
 * 크루즈닷몰 고객 생성 이벤트 수신
 *
 * 트리거: 크루즈닷몰에서 새 고객 가입
 * 액션:
 *  1. Contact 생성/업데이트
 *  2. 심리학 렌즈 자동 분류 (L0)
 *  3. 환영 SMS 발송 (Day 0)
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleWebhook } from '@/lib/webhooks/base';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CustomerCreatedPayload {
  eventId: string;
  eventType: 'customer.created';
  timestamp: string;
  customerId: string; // GMcruise User ID
  email: string;
  phoneNumber: string;
  name: string;
  affiliateId?: number; // 제휴사 ID
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRUISEDOT_WEBHOOK_SECRET || 'test-secret';

  return handleWebhook(req, {
    webhookType: 'customer-created',
    secret,
    requireAuth: true,
    handler: async (payload: CustomerCreatedPayload) => {
      const {
        eventId,
        customerId,
        email,
        phoneNumber,
        name,
        affiliateId
      } = payload;

      // 필드 검증
      if (!customerId || !email || !name) {
        logger.warn('[customer-created] 필수 필드 누락', { customerId, email, name });
        throw new Error('Missing required fields: customerId, email, name');
      }

      // 기본 organizationId (나중에 affiliateId 기반으로 결정)
      // TODO: affiliateId → organizationId 매핑
      const organizationId = 'org_cruisedot'; // 임시

      // Contact 생성/업데이트
      const contact = await prisma.contact.upsert({
        where: {
          email_organizationId: {
            email,
            organizationId
          }
        },
        create: {
          email,
          phone: phoneNumber || '',
          name,
          organizationId,
          type: 'PROSPECT', // 아직 구매 전
          externalId: customerId, // GMcruise User ID
          lastContactedAt: new Date(),
          dataSource: 'cruisedot'
        },
        update: {
          phone: phoneNumber || undefined,
          name,
          externalId: customerId,
          lastContactedAt: new Date()
        },
        select: {
          id: true,
          organizationId: true,
          email: true
        }
      });

      logger.log('[customer-created] Contact 생성/업데이트', {
        contactId: contact.id,
        email,
        customerId
      });

      // TODO: 심리학 렌즈 자동 분류 (L0)
      // TODO: 환영 SMS 발송 (Day 0 - PASONA P단계)

      return {
        contactId: contact.id,
        email: contact.email,
        status: 'created'
      };
    }
  });
}
