/**
 * Settlement Handler
 * - Partner Tier 자동 재평가 (Commission 기반)
 * - Churn 신호 감지 (수입 20% 이상 감소)
 * - Partner 정산 알림 SMS 발송
 *
 * Tier 기준:
 * - Bronze: $0-10K/월
 * - Silver: $10K-50K/월
 * - Gold: $50K-150K/월
 * - Platinum: $150K+/월
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export type PartnerTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

/**
 * SMS 발송 헬퍼 (Aligo API 호출)
 */
async function sendPartnerSms(
  organizationId: string,
  phone: string,
  message: string
) {
  const { sendSms } = await import('@/lib/aligo');

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { smsConfig: true }
  });

  if (!org?.smsConfig) {
    throw new Error(`SMS Config not found for organization: ${organizationId}`);
  }

  return sendSms({
    config: {
      key: org.smsConfig.aligoKey,
      userId: org.smsConfig.aligoUserId,
      sender: org.smsConfig.senderPhone
    },
    receiver: phone,
    msg: message,
    msgType: 'SMS',
    organizationId,
    channel: 'PARTNER_SETTLEMENT'
  });
}

/**
 * Partner Tier 자동 계산
 * @param monthlyCommission 월 수수료 (USD, 단위: 센트)
 * @returns PartnerTier
 */
export function calculateTier(monthlyCommissionCents: number): PartnerTier {
  const monthlyUSD = monthlyCommissionCents / 100;

  if (monthlyUSD >= 150000) return 'Platinum';
  if (monthlyUSD >= 50000) return 'Gold';
  if (monthlyUSD >= 10000) return 'Silver';
  return 'Bronze';
}

/**
 * 이전 달 수익 조회
 * @param partnerId Partner ID
 * @returns 이전 달 수입 (센트 단위)
 */
export async function getPreviousMonthRevenue(
  partnerId: string
): Promise<number | null> {
  const currentDate = new Date();
  const lastMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() - 1,
    1
  );
  const period = `${lastMonth.getFullYear()}-${String(
    lastMonth.getMonth() + 1
  ).padStart(2, '0')}`;

  const previousLedger = await prisma.settlementLedger.findFirst({
    where: {
      partnerId,
      period,
      status: 'PAID'
    },
    select: { netAmount: true }
  });

  return previousLedger?.netAmount || null;
}

/**
 * Churn 신호 감지 (3개월 평균 vs 현재)
 * @param partnerId Partner ID
 * @param currentMonthAmount 현재 달 순 지급액 (센트 단위)
 * @returns 20% 이상 감소 여부
 */
export async function detectChurnSignal(
  partnerId: string,
  currentMonthAmount: number
): Promise<boolean> {
  // 지난 3개월 평균 조회 (period 기준으로 정렬하여 INDEX 활용)
  const lastThreeMonths = await prisma.settlementLedger.findMany({
    where: {
      partnerId,
      status: 'PAID'
    },
    select: { netAmount: true },
    orderBy: { period: 'desc' },
    take: 3  // 최근 3개월만 조회
  });

  if (lastThreeMonths.length === 0) {
    return false; // 기존 데이터 없음 = Churn 신호 아님
  }

  const averageAmount =
    lastThreeMonths.reduce((sum, ledger) => sum + ledger.netAmount, 0) /
    lastThreeMonths.length;

  // 평균 금액이 0 이하이면 Churn 신호 아님
  if (averageAmount <= 0) {
    return false;
  }

  const decreasePercent = (averageAmount - currentMonthAmount) / averageAmount;

  return decreasePercent > 0.2; // 20% 이상 감소
}

/**
 * Partner Tier 업데이트
 * @param partnerId Partner ID
 * @param newTier 새로운 Tier
 */
export async function updatePartnerTier(
  partnerId: string,
  newTier: PartnerTier
) {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId }
  });

  if (!partner) {
    throw new Error(`Partner not found: ${partnerId}`);
  }

  if (partner.tier !== newTier) {
    await prisma.partner.update({
      where: { id: partnerId },
      data: { tier: newTier }
    });

    logger.log('[settlement-handler] Partner Tier 업데이트', {
      partnerId,
      oldTier: partner.tier,
      newTier
    });
  }
}

/**
 * Churn 신호 플래그 설정
 * @param partnerId Partner ID
 */
export async function setChurnRiskFlag(partnerId: string) {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId }
  });

  if (!partner) {
    throw new Error(`Partner not found: ${partnerId}`);
  }

  if (!partner.churnRiskFlag) {
    await prisma.partner.update({
      where: { id: partnerId },
      data: {
        churnRiskFlag: true,
        churnRiskDetectedAt: new Date()
      }
    });

    logger.log('[settlement-handler] Churn 신호 플래그 설정', {
      partnerId,
      detectedAt: new Date()
    });
  }
}

/**
 * Partner 정산 알림 SMS 발송
 * @param organizationId Organization ID
 * @param partnerId Partner ID
 * @param netAmount 순 지급액 (USD, 센트 단위)
 * @param period 정산 기간 (YYYY-MM)
 */
export async function sendSettlementNotificationSms(
  organizationId: string,
  partnerId: string,
  netAmount: number,
  period: string
) {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: {
      phone: true,
      displayName: true
    }
  });

  if (!partner?.phone) {
    logger.warn('[settlement-handler] Partner 전화번호 없음', {
      partnerId
    });
    return;
  }

  const netAmountUSD = netAmount / 100;
  const message = `정산 완료! ${period} 수입: $${netAmountUSD.toLocaleString('en-US', {
    maximumFractionDigits: 0
  })}. 자세히 보기: [대시보드]`;

  try {
    await sendPartnerSms(organizationId, partner.phone, message);

    logger.log('[settlement-handler] 정산 알림 SMS 발송', {
      partnerId,
      phone: partner.phone,
      netAmount: netAmountUSD,
      period
    });
  } catch (error) {
    logger.error('[settlement-handler] 정산 알림 SMS 발송 실패', {
      partnerId,
      phone: partner.phone,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Churn 감지 시 SMS 발송 (파트너에게 원인 문의)
 * @param organizationId Organization ID
 * @param partnerId Partner ID
 * @param decreasePercent 감소율 (%)
 */
export async function sendChurnAlertSms(
  organizationId: string,
  partnerId: string,
  decreasePercent: number
) {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: {
      phone: true,
      displayName: true
    }
  });

  if (!partner?.phone) {
    logger.warn('[settlement-handler] Partner 전화번호 없음 (Churn)', {
      partnerId
    });
    return;
  }

  const message = `월 수입이 ${(decreasePercent * 100).toFixed(0)}% 감소했습니다. 원인을 알려주세요: [피드백 링크]`;

  try {
    await sendPartnerSms(organizationId, partner.phone, message);

    logger.log('[settlement-handler] Churn 알림 SMS 발송', {
      partnerId,
      phone: partner.phone,
      decreasePercent
    });
  } catch (error) {
    logger.error('[settlement-handler] Churn 알림 SMS 발송 실패', {
      partnerId,
      phone: partner.phone,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * SettlementLedger 생성 또는 업데이트
 * @param partnerId Partner ID
 * @param period 정산 기간 (YYYY-MM)
 * @param settlementId 크루즈닷몰 정산 ID
 * @param status 정산 상태
 * @param totalCommission 총 수수료 (센트 단위)
 * @param totalWithholding 총 제외액 (센트 단위)
 * @param churnDetected Churn 감지 여부
 */
export async function upsertSettlementLedger(
  partnerId: string,
  period: string,
  settlementId: string,
  status: string,
  totalCommission: number,
  totalWithholding: number,
  churnDetected: boolean
) {
  const netAmount = totalCommission - totalWithholding;

  return prisma.settlementLedger.upsert({
    where: {
      partnerId_period: {
        partnerId,
        period
      }
    },
    create: {
      partnerId,
      period,
      settlementId,
      status,
      totalCommission,
      totalWithholding,
      netAmount,
      churnDetected,
      previousMonthRevenue: await getPreviousMonthRevenue(partnerId)
    },
    update: {
      status,
      totalCommission,
      totalWithholding,
      netAmount,
      churnDetected
    }
  });
}
