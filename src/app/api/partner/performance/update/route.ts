import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getSession } from '@/lib/auth';
import {
  updatePartnerRiskScore,
} from '@/lib/partner-risk-scoring';
import { detectAndTriggerRiskScoreChange } from '@/lib/partner-performance-trigger';

/**
 * POST /api/partner/performance/update
 * 파트너 성과 데이터 업데이트 (RiskScore 자동 계산 + SMS 자동 발송)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.organizationId) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      partnerId,
      year,
      month,
      week,
      totalCalls,
      appointmentsMade,
      salesClosed,
      revenue,
    } = body;

    if (!partnerId || !year || !month) {
      return NextResponse.json(
        { ok: false, error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 파트너 권한 확인
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { organizationId: true, phone: true },
    });

    if (!partner || partner.organizationId !== session.organizationId) {
      return NextResponse.json(
        { ok: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 이전 RiskScore 저장 (비교용)
    const previousRiskFlags = await prisma.partnerRiskFlags.findUnique({
      where: { partnerId },
      select: { totalRiskScore: true },
    });
    const previousRiskScore = previousRiskFlags?.totalRiskScore || 0;

    // PartnerPerformance 업데이트
    const updated = await prisma.partnerPerformance.upsert({
      where: {
        partnerId_year_month_week: { partnerId, year, month, week: week || null },
      },
      create: {
        partnerId,
        year,
        month,
        week: week || null,
        totalCalls: totalCalls || 0,
        appointmentsMade: appointmentsMade || 0,
        salesClosed: salesClosed || 0,
        revenue: revenue || 0,
        callToAppointmentRate:
          totalCalls > 0 ? ((appointmentsMade / totalCalls) * 100) : 0,
        appointmentToSaleRate:
          appointmentsMade > 0
            ? ((salesClosed / appointmentsMade) * 100)
            : 0,
        overallConversionRate:
          totalCalls > 0 ? ((salesClosed / totalCalls) * 100) : 0,
      },
      update: {
        totalCalls: totalCalls || 0,
        appointmentsMade: appointmentsMade || 0,
        salesClosed: salesClosed || 0,
        revenue: revenue || 0,
        callToAppointmentRate:
          totalCalls > 0 ? ((appointmentsMade / totalCalls) * 100) : 0,
        appointmentToSaleRate:
          appointmentsMade > 0
            ? ((salesClosed / appointmentsMade) * 100)
            : 0,
        overallConversionRate:
          totalCalls > 0 ? ((salesClosed / totalCalls) * 100) : 0,
      },
    });

    // RiskScore 자동 재계산
    const riskResult = await updatePartnerRiskScore(
      partnerId,
      session.organizationId
    );

    if (!riskResult) {
      logger.warn('[performance/update] RiskScore 계산 실패', { partnerId });
    }

    const currentRiskScore = riskResult?.totalRiskScore || previousRiskScore;

    // RiskScore 변경 감지 및 SMS 자동 발송
    const triggerResult = await detectAndTriggerRiskScoreChange(
      session.organizationId,
      partnerId
    );

    logger.log('[performance/update] 완료', {
      partnerId,
      year,
      month,
      week,
      previousRiskScore,
      currentRiskScore,
      triggerResult,
    });

    return NextResponse.json({
      ok: true,
      performance: updated,
      riskScore: {
        previous: previousRiskScore,
        current: currentRiskScore,
      },
      trigger: triggerResult,
    });
  } catch (error: unknown) {
    logger.error('[performance/update] 오류', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
