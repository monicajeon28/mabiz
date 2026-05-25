/**
 * GET /api/segments/reactivation
 * 부재중 고객 세그먼트 조회
 *
 * Query Parameters:
 * - segment: "3-6m" | "6-12m" | "1y+"
 * - limit: 기본값 50
 * - offset: 기본값 0
 * - smsStatus: "sent" | "pending" | "all" (Day 0-3 SMS 발송 상태)
 *
 * Response:
 * - contacts: 부재중 고객 목록
 * - total: 전체 고객 수
 * - conversionEstimate: 예상 재예약율 (%)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const organizationId = requireOrgId(ctx);

    const { searchParams } = new URL(request.url);
    const segment = searchParams.get('segment') as '3-6m' | '6-12m' | '1y+' | null;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const smsStatus = searchParams.get('smsStatus') || 'all';

    // 세그먼트 검증
    const validSegments = ['3-6m', '6-12m', '1y+'];
    if (segment && !validSegments.includes(segment)) {
      return NextResponse.json({ error: 'Invalid segment' }, { status: 400 });
    }

    // 재활성화 세그먼트 필터 빌드
    interface WhereCondition {
      organizationId: string;
      reactivationSegment?: string | null;
      deletedAt?: null;
      smsDay0Sent?: boolean;
      smsDay1Sent?: boolean;
      smsDay2Sent?: boolean;
      smsDay3Sent?: boolean;
    }

    const where: WhereCondition = {
      organizationId: organizationId,
      deletedAt: null,
    };

    if (segment) {
      where.reactivationSegment = segment;
    }

    // SMS 상태 필터
    if (smsStatus === 'sent') {
      where.smsDay0Sent = true;
    } else if (smsStatus === 'pending') {
      where.smsDay0Sent = false;
    }

    // 부재중 고객 조회
    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          reactivationSegment: true,
          reactivationLikelihood: true,
          lastCruiseDate: true,
          lastSatisfactionScore: true,
          cruiseCount: true,
          vipStatus: true,
          smsDay0Sent: true,
          smsDay0SentAt: true,
          smsDay1Sent: true,
          smsDay2Sent: true,
          smsDay3Sent: true,
        },
        orderBy: { reactivationLikelihood: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.contact.count({ where }),
    ]);

    // 예상 재예약율 계산
    const conversionEstimate = contacts.length > 0 ? calculateConversionEstimate(contacts) : 0;

    return NextResponse.json({
      contacts,
      total,
      segment: segment || 'all',
      limit,
      offset,
      conversionEstimate,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[GET /api/segments/reactivation]', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch segments' },
      { status: 500 },
    );
  }
}

/**
 * 예상 재예약율 계산
 * reactivationLikelihood 점수(0-100)를 기반으로 가중평균 계산
 */
function calculateConversionEstimate(contacts: any[]): number {
  if (contacts.length === 0) return 0;

  const avgLikelihood = contacts.reduce((sum, c) => sum + (c.reactivationLikelihood || 0), 0) / contacts.length;

  // 선형 매핑: 0 → 30%, 100 → 95%
  return Math.round(30 + (avgLikelihood / 100) * 65);
}
