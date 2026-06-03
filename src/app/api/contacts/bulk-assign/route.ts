import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * POST /api/contacts/bulk-assign
 * 일괄 담당자 할당 (OWNER/GLOBAL_ADMIN 전용)
 *
 * Body: { contactIds: string[], assignToUserId: string | null }
 * assignToUserId가 null이면 미배정으로 변경
 */
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (ctx.role !== 'OWNER' && ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, message: '할당 권한이 없습니다' }, { status: 403 });
    }
    const orgId = requireOrgId(ctx);

    const body = await req.json() as { contactIds: string[]; assignToUserId: string | null };
    const { contactIds, assignToUserId } = body;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json({ ok: false, message: '할당할 고객을 선택하세요' }, { status: 400 });
    }
    if (contactIds.length > 200) {
      return NextResponse.json({ ok: false, message: '한 번에 200명까지 할당 가능합니다' }, { status: 400 });
    }

    // 대상 멤버 검증 (null이면 미배정)
    if (assignToUserId) {
      const member = await prisma.organizationMember.findFirst({
        where: { organizationId: orgId, userId: assignToUserId, isActive: true },
        select: { userId: true, displayName: true },
      });
      if (!member) {
        return NextResponse.json({ ok: false, message: '할당 대상 멤버를 찾을 수 없습니다' }, { status: 404 });
      }
    }

    // 트랜잭션: 일괄 업데이트 + 이력 기록
    const result = await prisma.$transaction(async (tx) => {
      // 소유권 확인 + 업데이트
      const updated = await tx.contact.updateMany({
        where: {
          id: { in: contactIds },
          organizationId: orgId,
          deletedAt: null,
        },
        data: { assignedUserId: assignToUserId },
      });

      // 이력 기록 (일괄) - 실제 업데이트된 ID를 DB에서 별도 조회하여 정확한 이력 생성
      if (updated.count > 0) {
        const actualUpdatedContacts = await tx.contact.findMany({
          where: {
            id: { in: contactIds },
            organizationId: orgId,
            deletedAt: null,
            assignedUserId: assignToUserId,
          },
          select: { id: true },
        });
        const actualUpdatedIds = actualUpdatedContacts.map((c) => c.id);
        if (actualUpdatedIds.length > 0) {
          await tx.contactTransferLog.createMany({
            data: actualUpdatedIds.map((contactId) => ({
              contactId,
              fromOrgId: orgId,
              toUserId: assignToUserId,
              transferType: 'AGENT_ASSIGN',
              transferredBy: ctx.userId,
            })),
          });
        }
      }

      return updated.count;
    });

    logger.log('[POST /api/contacts/bulk-assign]', {
      orgId, count: result, assignTo: assignToUserId,
    });

    return NextResponse.json({ ok: true, count: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ ok: false }, { status: 401 });
    logger.error('[POST /api/contacts/bulk-assign]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
