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
 *  6. SettlementLedger 기록 저장
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleWebhook } from '@/lib/webhooks/base';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  calculateTier,
  updatePartnerTier,
  detectChurnSignal,
  setChurnRiskFlag,
  sendSettlementNotificationSms,
  sendChurnAlertSms,
  upsertSettlementLedger
} from '@/lib/webhooks/settlement-handler';

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
  organizationId?: string; // Optional: Mabiz Organization ID
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
      const partnerId = profileId.toString();

      // 1. Partner 조회 또는 생성
      let partner = await prisma.partner.findUnique({
        where: { id: partnerId }
      });

      if (!partner) {
        // Partner 생성 (첫 정산)
        const org = await prisma.organization.findFirst({
          where: {
            externalAffiliateProfileId: profileId
          }
        });

        if (!org) {
          logger.warn('[settlement-updated] 연결된 Organization 없음', {
            profileId
          });
          throw new Error(`No organization found for profileId: ${profileId}`);
        }

        partner = await prisma.partner.create({
          data: {
            id: partnerId,
            organizationId: org.id,
            name: `Partner ${profileId}`,
            status: 'ACTIVE'
          }
        });

        logger.log('[settlement-updated] Partner 신규 생성', {
          partnerId: partner.id,
          organizationId: org.id
        });
      }

      // 2. Partner 업데이트 (lastSettlementAt, totalEarnings)
      partner = await prisma.partner.update({
        where: { id: partnerId },
        data: {
          lastSettlementAt: new Date(),
          totalEarnings: {
            increment: netAmount
          }
        }
      });

      logger.log('[settlement-updated] Partner 누적 수익 업데이트', {
        partnerId: partner.id,
        netAmount,
        totalEarnings: partner.totalEarnings
      });

      // 3. PartnerTier 자동 재평가
      const monthlyUSD = netAmount / 100;
      const newTier = calculateTier(netAmount);

      await updatePartnerTier(partnerId, newTier);

      // 4. Churn 신호 감지
      const isChurnDetected = await detectChurnSignal(partnerId, netAmount);

      if (isChurnDetected) {
        // Churn 플래그 설정
        await setChurnRiskFlag(partnerId);

        // 감소율 계산 (알림용)
        const previousMonthLedger = await prisma.settlementLedger.findFirst({
          where: {
            partnerId,
            status: 'PAID'
          },
          select: { netAmount: true },
          orderBy: { period: 'desc' },
          take: 1
        });

        const decreasePercent = previousMonthLedger
          ? (previousMonthLedger.netAmount - netAmount) /
            previousMonthLedger.netAmount
          : 0;

        logger.log('[settlement-updated] Churn 신호 감지', {
          partnerId,
          currentMonth: monthlyUSD,
          previousMonth: previousMonthLedger?.netAmount
            ? previousMonthLedger.netAmount / 100
            : 'N/A',
          decreasePercent: `${(decreasePercent * 100).toFixed(1)}%`
        });

        // Churn 알림 SMS 발송
        if (decreasePercent > 0) {
          try {
            await sendChurnAlertSms(
              partner.organizationId,
              partnerId,
              decreasePercent
            );
          } catch (error) {
            logger.error('[settlement-updated] Churn 알림 SMS 발송 실패', {
              partnerId,
              error: error instanceof Error ? error.message : String(error)
            });
            // SMS 실패는 프로세스를 중단하지 않음
          }
        }
      }

      // 5. SettlementLedger 저장
      await upsertSettlementLedger(
        partnerId,
        period,
        settlementId,
        status,
        totalCommission,
        totalWithholding,
        isChurnDetected
      );

      logger.log('[settlement-updated] SettlementLedger 저장', {
        partnerId,
        period,
        settlementId,
        status,
        netAmount: monthlyUSD,
        churnDetected: isChurnDetected
      });

      // 6. 정산 알림 SMS 발송 (status가 PAID일 때)
      if (status === 'PAID') {
        try {
          await sendSettlementNotificationSms(
            partner.organizationId,
            partnerId,
            netAmount,
            period
          );
        } catch (error) {
          logger.error('[settlement-updated] 정산 알림 SMS 발송 실패', {
            partnerId,
            error: error instanceof Error ? error.message : String(error)
          });
          // SMS 실패는 프로세스를 중단하지 않음
        }
      }

      return {
        partnerId,
        totalEarnings: partner.totalEarnings,
        tier: newTier,
        churnDetected: isChurnDetected,
        status: 'processed'
      };
    }
  });
}
