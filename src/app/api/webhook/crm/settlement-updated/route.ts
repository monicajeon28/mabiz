/**
 * POST /api/webhook/crm/settlement-updated
 * 정산 정보 변경 이벤트 수신
 *
 * 트리거: 정산 생성, 승인, 잠금, 지급
 * 액션:
 *  1. Partner.lastSettlementAt 업데이트
 *  2. Partner.totalEarnings 누적
 *  3. PartnerTier 자동 재평가
 *  4. Churn 신호 감지 (수입 감소)
 *  5. 정산 알림 SMS 발송
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleWebhook } from '@/lib/webhooks/base';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface SettlementUpdatedPayload {
  eventId: string;
  eventType: 'settlement.created' | 'settlement.approved' | 'settlement.locked' | 'settlement.paid';
  timestamp: string;
  settlementId: string;
  period: string; // YYYY-MM
  status: 'DRAFT' | 'APPROVED' | 'LOCKED' | 'PAID';
  totalCommission: number;
  totalWithholding: number;
  profileId: number; // 제휴사 ID
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRUISEDOT_WEBHOOK_SECRET || 'test-secret';

  return handleWebhook(req, {
    webhookType: 'settlement-updated',
    secret,
    requireAuth: true,
    handler: async (payload: SettlementUpdatedPayload) => {
      const {
        eventId,
        settlementId,
        period,
        status,
        totalCommission,
        totalWithholding,
        profileId
      } = payload;

      // 필드 검증
      if (!settlementId || !period || !status || !profileId) {
        logger.warn('[settlement-updated] 필수 필드 누락', {
          settlementId,
          period,
          status,
          profileId
        });
        throw new Error('Missing required fields');
      }

      const netAmount = totalCommission - totalWithholding;

      // Partner 업데이트
      const partner = await prisma.partner.upsert({
        where: { id: profileId.toString() },
        create: {
          id: profileId.toString(),
          displayName: `Partner ${profileId}`,
          lastSettlementAt: new Date(),
          totalEarnings: netAmount,
          status: 'ACTIVE'
        },
        update: {
          lastSettlementAt: new Date(),
          totalEarnings: {
            increment: netAmount
          }
        },
        select: {
          id: true,
          totalEarnings: true,
          displayName: true
        }
      });

      logger.log('[settlement-updated] Partner 업데이트', {
        partnerId: partner.id,
        totalEarnings: partner.totalEarnings,
        netAmount
      });

      // TODO: PartnerTier 자동 재평가
      // Tier 기준:
      // - Bronze: $0-$10K
      // - Silver: $10K-$50K
      // - Gold: $50K-$200K
      // - Platinum: $200K+

      // TODO: Churn 신호 감지 (수입 감소)
      // 지난 3개월 평균 vs 현재: 20% 이상 감소

      // TODO: 정산 알림 SMS 발송
      // "정산 ${period}: ¥${netAmount.toLocaleString()}K 지급 예정"

      return {
        partnerId: partner.id,
        totalEarnings: partner.totalEarnings,
        status: 'updated'
      };
    }
  });
}
