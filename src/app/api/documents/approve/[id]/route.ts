import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id } = await params;

    // OWNER 이상만 승인 가능
    if (ctx.role !== 'OWNER' && ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, message: '승인 권한 없음' }, { status: 403 });
    }

    const body = await req.json() as { action: 'approve' | 'reject'; note?: string };

    // 서류 조회 + 조직 소유권
    const doc = await prisma.salesDocument.findFirst({
      where: { id, organizationId: orgId, status: 'PENDING_APPROVAL' },
    });
    if (!doc) return NextResponse.json({ ok: false, message: '승인 대기 서류 없음' }, { status: 404 });

    // 환불증서는 GLOBAL_ADMIN만 최종 승인
    if (doc.documentType === 'REFUND_CERTIFICATE' && ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, message: '환불증서는 본사만 승인 가능' }, { status: 403 });
    }

    const newStatus = body.action === 'approve' ? 'APPROVED' : 'REJECTED';

    await prisma.$transaction([
      prisma.salesDocument.update({
        where: { id },
        data: {
          status:        newStatus,
          approvedBy:    body.action === 'approve' ? ctx.userId : undefined,
          approvedAt:    body.action === 'approve' ? new Date() : undefined,
          rejectedReason: body.action === 'reject' ? (body.note ?? '거절') : undefined,
        },
      }),
      prisma.salesDocumentApproval.create({
        data: {
          documentId:     id,
          organizationId: orgId,
          requestedBy:    doc.createdBy,
          approvedBy:     ctx.userId,
          status:         newStatus,
          adminNote:      body.note ?? null,
          processedAt:    new Date(),
        },
      }),
    ]);

    logger.log('[DocApprove] 처리', { id, action: body.action, role: ctx.role });
    return NextResponse.json({ ok: true, status: newStatus });
  } catch (e) {
    logger.log('[DocApprove] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
