import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getSession } from '@/lib/auth';
import { detectAndTriggerRiskScoreChange } from '@/lib/partner-performance-trigger';

/**
 * POST /api/partner/trigger-risk-change
 * 테스트용: 수동으로 RiskScore 변경 감지 및 SMS 트리거
 * (개발/테스트 목적)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.organizationId || !session?.userId) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { partnerId, newRiskScore } = body;

    if (!partnerId || typeof newRiskScore !== 'number') {
      return NextResponse.json(
        { ok: false, error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      );
    }

    if (newRiskScore < 0 || newRiskScore > 100) {
      return NextResponse.json(
        { ok: false, error: 'newRiskScore는 0-100 사이여야 합니다.' },
        { status: 400 }
      );
    }

    // 파트너 권한 확인
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { organizationId: true, name: true },
    });

    if (!partner || partner.organizationId !== session.organizationId) {
      return NextResponse.json(
        { ok: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // RiskScore 강제 업데이트 (테스트용)
    await prisma.partnerRiskFlags.upsert({
      where: { partnerId },
      create: {
        partnerId,
        totalRiskScore: newRiskScore,
        lowPerformanceScore: newRiskScore > 50 ? 25 : 0,
      },
      update: {
        totalRiskScore: newRiskScore,
      },
    });

    // RiskScore 변경 감지 및 SMS 발송
    const triggerResult = await detectAndTriggerRiskScoreChange(
      session.organizationId,
      partnerId
    );

    logger.log('[trigger-risk-change] 테스트 트리거', {
      partnerId,
      partnerName: partner.name,
      newRiskScore,
      triggerResult,
      triggeredBy: session.userId,
    });

    return NextResponse.json({
      ok: true,
      partnerId,
      newRiskScore,
      triggerResult,
      message: '테스트 트리거 완료',
    });
  } catch (error: unknown) {
    logger.error('[trigger-risk-change] 오류', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
