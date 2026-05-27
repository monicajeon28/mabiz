import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getSession } from '@/lib/auth';

/**
 * GET /api/partner/risk-score-changes
 * RiskScore 변경 이력 조회
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
    const partnerId = searchParams.get('partnerId');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '20', 10));
    const days = Math.max(1, parseInt(searchParams.get('days') || '30', 10));

    const offset = (page - 1) * limit;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    let where: any = {
      organizationId: session.organizationId,
      createdAt: { gte: fromDate },
    };

    if (partnerId) {
      where.partnerId = partnerId;
    }

    const [data, total] = await Promise.all([
      prisma.partnerRiskScoreChange.findMany({
        where,
        include: {
          partner: {
            select: {
              name: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.partnerRiskScoreChange.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      data: data.map((item) => ({
        id: item.id,
        partnerId: item.partnerId,
        partnerName: item.partner.name,
        partnerPhone: item.partner.phone,
        previousScore: item.previousScore,
        currentScore: item.currentScore,
        previousLevel: item.previousLevel,
        currentLevel: item.currentLevel,
        triggerReason: item.triggerReason,
        smsTriggered: item.smsTriggered,
        smsMessageType: item.smsMessageType,
        createdAt: item.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    logger.error('[risk-score-changes GET] 오류', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
