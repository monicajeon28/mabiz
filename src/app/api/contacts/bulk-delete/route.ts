import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * POST /api/contacts/bulk-delete
 * 고객 일괄 삭제 (소프트 삭제: deletedAt 설정)
 * OWNER/GLOBAL_ADMIN 전용
 *
 * Body: { contactIds: string[] }
 */
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (ctx.role !== 'OWNER' && ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, message: '삭제 권한이 없습니다' }, { status: 403 });
    }
    const orgId = requireOrgId(ctx);

    const body = await req.json() as { contactIds: string[] };
    const { contactIds } = body;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json({ ok: false, message: '삭제할 고객을 선택하세요' }, { status: 400 });
    }
    if (contactIds.length > 500) {
      return NextResponse.json({ ok: false, message: '한 번에 500명까지 삭제 가능합니다' }, { status: 400 });
    }

    // 트랜잭션: 일괄 소프트 삭제
    const result = await prisma.$transaction(async (tx) => {
      // 소유권 확인 + 소프트 삭제 (deletedAt 설정)
      const deleted = await tx.contact.updateMany({
        where: {
          id: { in: contactIds },
          organizationId: orgId,
          deletedAt: null, // 이미 삭제된 것은 제외
        },
        data: { deletedAt: new Date() },
      });

      return deleted.count;
    });

    logger.log('[POST /api/contacts/bulk-delete]', {
      orgId,
      count: result,
      deletedBy: ctx.userId,
    });

    return NextResponse.json({ ok: true, count: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ ok: false }, { status: 401 });
    logger.error('[POST /api/contacts/bulk-delete]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
