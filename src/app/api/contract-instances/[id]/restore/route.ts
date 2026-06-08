import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    // 권한 검증: OWNER 이상만
    if (ctx.role !== 'GLOBAL_ADMIN' && ctx.role !== 'OWNER') {
      return NextResponse.json(
        { ok: false, message: '권한이 없습니다' },
        { status: 403 }
      );
    }

    const { id } = params;

    // 계약서 조회
    const instance = await prisma.contractInstance.findUnique({
      where: { id, organizationId: orgId },
      select: { status: true },
    });

    if (!instance) {
      return NextResponse.json(
        { ok: false, message: '계약서를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // ARCHIVED 상태만 복구 가능
    if (instance.status !== 'ARCHIVED') {
      return NextResponse.json(
        { ok: false, message: '휴지통의 계약서만 복구 가능합니다' },
        { status: 400 }
      );
    }

    // 복구: ARCHIVED → DRAFT
    const updated = await prisma.contractInstance.update({
      where: { id, organizationId: orgId },
      data: {
        status: 'DRAFT',
        updatedAt: new Date(),
      },
      select: { id: true, status: true },
    });

    // 감사추적 로깅
    logger.log('[Contract] 복구', {
      id,
      orgId,
      userId: ctx.userId,
      fromStatus: 'ARCHIVED',
      toStatus: 'DRAFT',
    });

    return NextResponse.json({
      ok: true,
      message: '복구되었습니다',
      status: updated.status,
    });
  } catch (e) {
    logger.error('[Contract Restore] 오류', {
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
