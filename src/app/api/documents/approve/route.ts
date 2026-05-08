import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * POST: 문서 승인 또는 거부
 * 권한: ADMIN, GLOBAL_ADMIN만 가능
 */
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = ctx.organizationId;
    if (!orgId) {
      return NextResponse.json({ ok: false, message: '조직 정보 없음' }, { status: 400 });
    }

    // 권한 체크 (ADMIN 이상만 승인 가능)
    if (!['ADMIN', 'GLOBAL_ADMIN', 'OWNER'].includes(ctx.role)) {
      return NextResponse.json({ ok: false, message: '승인 권한 없음' }, { status: 403 });
    }

    const { documentId, comment, action } = await req.json();
    if (!documentId || !action) {
      return NextResponse.json(
        { ok: false, message: '문서 ID와 action(approve/reject) 필수' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ ok: false, message: 'action은 approve 또는 reject' }, { status: 400 });
    }

    const doc = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      return NextResponse.json({ ok: false, message: '문서를 찾을 수 없습니다' }, { status: 404 });
    }

    if (doc.organizationId !== orgId) {
      return NextResponse.json({ ok: false, message: '접근 권한 없음' }, { status: 403 });
    }

    if (doc.status !== 'SUBMITTED') {
      return NextResponse.json(
        { ok: false, message: '승인 대기 상태만 처리 가능합니다' },
        { status: 400 }
      );
    }

    // 승인 기록 생성 (또는 업데이트)
    const approvalStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
    await prisma.documentApproval.upsert({
      where: {
        documentId_approvedBy: {
          documentId,
          approvedBy: ctx.userId,
        },
      },
      create: {
        documentId,
        approvedBy: ctx.userId,
        status: approvalStatus,
        comment: comment || null,
      },
      update: {
        status: approvalStatus,
        comment: comment || null,
      },
    });

    // 문서 상태 업데이트
    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
    const updated = await prisma.document.update({
      where: { id: documentId },
      data: {
        status: newStatus,
        updatedBy: ctx.userId,
      },
      include: {
        versions: { orderBy: { versionNumber: 'desc' } },
        approvals: true,
      },
    });

    return NextResponse.json({
      ok: true,
      data: updated,
      message: action === 'approve' ? '문서가 승인되었습니다' : '문서가 거부되었습니다',
    });
  } catch (err) {
    logger.error('[POST /api/documents/approve]', { err });
    return NextResponse.json({ ok: false, message: String(err) }, { status: 500 });
  }
}
