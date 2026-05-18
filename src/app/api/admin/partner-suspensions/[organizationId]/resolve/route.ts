import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * POST /api/admin/partner-suspensions/:organizationId/resolve
 * 관리자 전용: 파트너 정지 해제/거절
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  try {
    const ctx = await getAuthContext();

    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const { action, notes } = await req.json() as { action: string; notes?: string };
    const { organizationId } = await params;

    // action: 'UNSUSPEND' | 'DENY_APPEAL'
    if (!['UNSUSPEND', 'DENY_APPEAL'].includes(action)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid action' },
        { status: 400 }
      );
    }

    const suspension = await prisma.partnerSuspension.findFirst({
      where: { organizationId },
    });

    if (!suspension) {
      return NextResponse.json(
        { ok: false, error: 'Suspension not found' },
        { status: 404 }
      );
    }

    // 액션 처리
    if (action === 'UNSUSPEND') {
      await prisma.partnerSuspension.update({
        where: { id: suspension.id },
        data: {
          suspensionStatus: 'RESOLVED',
          resolvedAt: new Date(),
          resolutionNotes: notes || null,
        },
      });
    } else if (action === 'DENY_APPEAL') {
      await prisma.partnerSuspension.update({
        where: { id: suspension.id },
        data: {
          suspensionStatus: 'SUSPENDED',
          appealedAt: null,
          appealMessage: null,
          resolutionNotes: notes || null,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      message: '처리되었습니다',
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error('파트너 정지 해제 오류:' + errMsg);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
