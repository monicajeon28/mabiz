import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { sendFunnelEmail } from '@/lib/email';

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

    // 서류 조회 + 조직 소유권 (contactId 포함)
    const doc = await prisma.salesDocument.findFirst({
      where: { id, organizationId: orgId, status: 'PENDING_APPROVAL' },
      include: { contact: { select: { email: true, name: true } } },
    });
    if (!doc) return NextResponse.json({ ok: false, message: '승인 대기 서류 없음' }, { status: 404 });

    // 환불증서는 GLOBAL_ADMIN만 최종 승인
    if (doc.documentType === 'REFUND_CERTIFICATE' && ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, message: '환불증서는 본사만 승인 가능' }, { status: 403 });
    }

    const newStatus = body.action === 'approve' ? 'APPROVED' : 'REJECTED';

    await prisma.$transaction([
      prisma.salesDocument.updateMany({
        where: { id, organizationId: orgId },
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

    // 승인 시 이메일 발송 (fire-and-forget)
    if (body.action === 'approve') {
      const data = doc.generatedData as Record<string, unknown>;
      // 구매확인증/환불증: generatedData.buyerEmail, 비교견적: contact.email
      const recipientEmail = (data.buyerEmail as string | null) ?? doc.contact?.email ?? null;
      const buyerName      = (data.buyerName  as string | null) ?? doc.contact?.name  ?? '고객';

      if (recipientEmail) {
        const LABEL: Record<string, string> = {
          PURCHASE_CONFIRMATION: '구매확인증',
          REFUND_CERTIFICATE:    '환불확인증',
          COMPARISON_QUOTE:      '비교견적서',
        };
        const label       = LABEL[doc.documentType] ?? '문서';
        const productName = (data.productName as string | null) ?? '';

        sendFunnelEmail({
          organizationId: orgId,
          to:      recipientEmail,
          subject: `[${label}] ${productName ? productName + ' ' : ''}${label}이 승인되었습니다`,
          html: `<div style="font-family:sans-serif;line-height:1.8;max-width:600px;margin:0 auto;padding:32px 24px">
<h2 style="color:#1a1a2e;margin:0 0 16px">${label} 승인 완료</h2>
<p>${buyerName}님, 요청하신 ${label}이 승인 처리되었습니다.</p>
${productName ? `<p style="margin:4px 0"><strong>상품명:</strong> ${productName}</p>` : ''}
${data.amount ? `<p style="margin:4px 0"><strong>금액:</strong> ${(data.amount as number).toLocaleString()}원</p>` : ''}
${data.refundAmount ? `<p style="margin:4px 0"><strong>환불금액:</strong> ${(data.refundAmount as number).toLocaleString()}원</p>` : ''}
${body.note ? `<p style="margin:16px 0;padding:12px;background:#f8f9fa;border-radius:8px;font-size:14px;color:#666"><strong>담당자 메모:</strong> ${body.note}</p>` : ''}
<p style="color:#666;font-size:14px;margin-top:20px">문서번호: ${id}</p>
</div>`,
          channel: 'MANUAL',
        }).catch(() => {});
      }
    }

    logger.log('[DocApprove] 처리', { id, action: body.action, role: ctx.role });
    return NextResponse.json({ ok: true, status: newStatus });
  } catch (e) {
    logger.log('[DocApprove] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
