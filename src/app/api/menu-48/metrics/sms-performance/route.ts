import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * GET /api/menu-48/metrics/sms-performance
 *
 * SMS 시퀀스 Day별 성과
 * - openRate, clickRate: Aligo 오픈 추적 미지원 — 더미 유지
 * - conversionRate: smsDay{N}Sent=true 고객 중 purchasedAt 비율 실측
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const organizationId = resolveOrgId(ctx);

    const baseWhere = { organizationId, anxietyAssessmentAt: { not: null } } as const;

    // Day별 발송 수 및 전환 수 집계
    const [
      day0Total, day0Converted,
      day1Total, day1Converted,
      day2Total, day2Converted,
      day3Total, day3Converted,
    ] = await Promise.all([
      prisma.contact.count({ where: { ...baseWhere, smsDay0Sent: true } }),
      prisma.contact.count({ where: { ...baseWhere, smsDay0Sent: true, purchasedAt: { not: null } } }),
      prisma.contact.count({ where: { ...baseWhere, smsDay1Sent: true } }),
      prisma.contact.count({ where: { ...baseWhere, smsDay1Sent: true, purchasedAt: { not: null } } }),
      prisma.contact.count({ where: { ...baseWhere, smsDay2Sent: true } }),
      prisma.contact.count({ where: { ...baseWhere, smsDay2Sent: true, purchasedAt: { not: null } } }),
      prisma.contact.count({ where: { ...baseWhere, smsDay3Sent: true } }),
      prisma.contact.count({ where: { ...baseWhere, smsDay3Sent: true, purchasedAt: { not: null } } }),
    ]);

    const calcRate = (converted: number, total: number) =>
      total > 0 ? Math.round((converted / total) * 1000) / 10 : 0;

    // openRate, clickRate는 Aligo 미지원으로 더미 유지
    const smsPerformance = [
      { day: 0, openRate: 72, clickRate: 35, conversionRate: calcRate(day0Converted, day0Total) },
      { day: 1, openRate: 68, clickRate: 42, conversionRate: calcRate(day1Converted, day1Total) },
      { day: 2, openRate: 65, clickRate: 45, conversionRate: calcRate(day2Converted, day2Total) },
      { day: 3, openRate: 78, clickRate: 58, conversionRate: calcRate(day3Converted, day3Total) },
    ];

    return NextResponse.json({ smsPerformance });
  } catch (error) {
    logger.error('[GET /api/menu-48/metrics/sms-performance]', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
