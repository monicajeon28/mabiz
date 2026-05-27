import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getSession } from '@/lib/auth';
import {
  updatePartnerRiskScore,
  calculatePartnerRiskScore,
  generateDay03Messages,
} from '@/lib/partner-risk-scoring';
import { sendPartnerAlertSms } from '@/lib/aligo-sms-service';

/**
 * GET /api/affiliate/partner-alert
 * 파트너 위험도 대시보드 조회
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.organizationId) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const riskLevel = searchParams.get('riskLevel'); // RED, YELLOW, GREEN
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50', 10));

    const offset = (page - 1) * limit;

    let where: any = {};
    if (riskLevel && ['RED', 'YELLOW', 'GREEN'].includes(riskLevel)) {
      // Map risk level to score ranges
      if (riskLevel === 'RED') {
        where.totalRiskScore = { gte: 67 };
      } else if (riskLevel === 'YELLOW') {
        where.totalRiskScore = { gte: 34, lte: 66 };
      } else {
        where.totalRiskScore = { lt: 34 };
      }
    }

    const [partners, total] = await Promise.all([
      prisma.partnerRiskFlags.findMany({
        where: { partner: { organizationId: session.organizationId } },
        select: {
          partnerId: true,
          totalRiskScore: true,
          lowPerformanceScore: true,
          churnScore: true,
          dishonestyScore: true,
          skillGapScore: true,
          partner: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              automationRate: true,
              monthlyIncomeGoal: true,
              totalRevenue: true,
            },
          },
        },
        orderBy: { totalRiskScore: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.partnerRiskFlags.count({
        where: { partner: { organizationId: session.organizationId } },
      }),
    ]);

    const mapped = partners.map((p) => ({
      partnerId: p.partnerId,
      name: p.partner.name,
      email: p.partner.email,
      phone: p.partner.phone,
      riskScore: p.totalRiskScore,
      riskLevel:
        p.totalRiskScore > 66 ? 'RED' : p.totalRiskScore > 33 ? 'YELLOW' : 'GREEN',
      automationRate: p.partner.automationRate,
      monthlyIncomeGoal: p.partner.monthlyIncomeGoal,
      totalRevenue: p.partner.totalRevenue,
    }));

    return NextResponse.json({
      ok: true,
      data: mapped,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    logger.error('[partner-alert GET] 오류', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/affiliate/partner-alert/:partnerId/trigger-sms
 * 파트너 Alert SMS 트리거 (Day 0-3 시퀀스)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId || !session?.organizationId) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { partnerId, day } = body;

    if (!partnerId) {
      return NextResponse.json(
        { ok: false, error: 'partnerId가 필요합니다.' },
        { status: 400 }
      );
    }

    // 파트너 조회
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        organizationId: true,
        name: true,
        phone: true,
        email: true,
        riskFlags: {
          select: {
            lowPerformanceScore: true,
            churnScore: true,
            dishonestyScore: true,
            skillGapScore: true,
          },
        },
      },
    });

    if (!partner) {
      return NextResponse.json(
        { ok: false, error: '파트너를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (partner.organizationId !== session.organizationId) {
      return NextResponse.json(
        { ok: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    if (!partner.phone) {
      return NextResponse.json(
        { ok: false, error: '파트너 전화번호가 없습니다.' },
        { status: 400 }
      );
    }

    // Risk Score 재계산
    const riskResult = await updatePartnerRiskScore(
      partnerId,
      session.organizationId
    );

    if (!riskResult) {
      return NextResponse.json(
        { ok: false, error: '위험도 데이터를 계산할 수 없습니다.' },
        { status: 400 }
      );
    }

    // Day 0-3 메시지 생성
    const messages = generateDay03Messages(
      riskResult,
      partner.name,
      partner.phone
    );

    // 특정 day 메시지 선택 (기본값: day0)
    const targetDay = day || 'day0';
    const targetMessage = messages[targetDay] || messages.day0;

    // SMS 발송 (실제 Aligo 연동)
    const smsResult = await sendPartnerAlertSms(
      session.organizationId,
      partnerId,
      targetDay as 'day0' | 'day1' | 'day2' | 'day3',
      riskResult.level,
      getMessageType(riskResult.level, targetDay),
      targetMessage,
      partner.phone
    );

    logger.log('[partner-alert POST] SMS 발송', {
      partnerId,
      day: targetDay,
      riskLevel: riskResult.level,
      smsSent: smsResult.success,
      smsId: smsResult.smsId,
      senderId: session.userId,
    });

    return NextResponse.json({
      ok: smsResult.success,
      partnerId,
      riskLevel: riskResult.level,
      riskScore: riskResult.totalRiskScore,
      message: targetMessage,
      day: targetDay,
      smsSent: smsResult.success,
      smsId: smsResult.smsId,
      error: smsResult.error,
    });
  } catch (error: unknown) {
    logger.error('[partner-alert POST] 오류', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

function getMessageType(
  riskLevel: 'RED' | 'YELLOW' | 'GREEN',
  day: string
): string {
  if (riskLevel === 'RED') {
    if (day === 'day0' || day === 'day1') return 'URGENT_RETENTION';
    if (day === 'day2' || day === 'day3') return 'URGENT_INCENTIVE';
  }
  if (riskLevel === 'YELLOW') {
    return 'TRAINING_OFFER';
  }
  return 'POSITIVE_REINFORCEMENT';
}
