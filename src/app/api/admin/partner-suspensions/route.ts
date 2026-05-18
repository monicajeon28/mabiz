import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/partner-suspensions?status=SUSPENDED&limit=100
 * 관리자 전용: 파트너 정지 관리 목록
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext();

    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get('status') || 'SUSPENDED';
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const page = parseInt(url.searchParams.get('page') || '1');

    const skip = (page - 1) * limit;

    // 정지된 파트너 목록
    const [suspensions, total] = await Promise.all([
      prisma.partnerSuspension.findMany({
        where: { suspensionStatus: status },
        select: {
          id: true,
          organizationId: true,
          partnerId: true,
          partnerName: true,
          partnerRole: true,
          suspensionStatus: true,
          suspensionReason: true,
          reasonDetails: true,
          suspendedAt: true,
          appealedAt: true,
          appealMessage: true,
          resolvedAt: true,
          resolutionNotes: true,
        },
        orderBy: { suspendedAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.partnerSuspension.count({
        where: { suspensionStatus: status },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        suspensions,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error('파트너 정지 목록 조회 오류:' + errMsg);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
