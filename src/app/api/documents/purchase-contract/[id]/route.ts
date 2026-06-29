/**
 * 구매계약서(SalesDocument) 단건 관리
 *
 * DELETE: 소프트삭제(status="ARCHIVED") — 하드삭제 금지(수당/주문 정합성).
 * PATCH  : action="reject" — 반려 처리(rejectedReason 저장). SIGNED/APPROVED 도 반려 가능.
 *
 * 권한: GLOBAL_ADMIN/OWNER 조직 전체, AGENT 본인 createdBy 만. FREE_SALES 차단.
 *       (send-contract-sms route 패턴 동일: resolveOrgId + organizationId 필터 + AGENT createdBy)
 */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { checkOrigin } from '@/lib/origin-guard';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

// ─── DELETE: 소프트삭제(ARCHIVED) ────────────────────────────────────────────
export async function DELETE(req: Request, { params }: Params) {
  try {
    if (!checkOrigin(req, 'PurchaseContractArchive')) {
      return NextResponse.json({ ok: false, message: '잘못된 접근입니다.' }, { status: 403 });
    }
    const ctx = await getAuthContext();
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, message: '권한이 없습니다.' }, { status: 403 });
    }
    const orgId = resolveOrgId(ctx);
    const { id } = await params;

    const doc = await prisma.salesDocument.findFirst({
      where: { id, organizationId: orgId, documentType: 'PURCHASE_CONTRACT' },
      select: { id: true, createdBy: true, generatedData: true },
    });
    if (!doc) {
      return NextResponse.json({ ok: false, message: '계약서를 찾을 수 없습니다.' }, { status: 404 });
    }
    if (ctx.role === 'AGENT' && doc.createdBy !== ctx.userId) {
      return NextResponse.json(
        { ok: false, message: '본인이 발급한 계약서만 보관할 수 있습니다.' },
        { status: 403 },
      );
    }

    const gd = (doc.generatedData ?? {}) as Record<string, unknown>;
    await prisma.salesDocument.updateMany({
      where: { id, organizationId: orgId },
      data: {
        status: 'ARCHIVED',
        generatedData: { ...gd, archivedAt: new Date().toISOString(), archivedBy: ctx.userId },
      },
    });

    logger.log('[PurchaseContract DELETE] 보관처리', { id, role: ctx.role });
    return NextResponse.json({ ok: true, message: '계약서를 보관함으로 옮겼습니다.', status: 'ARCHIVED' });
  } catch (e) {
    logger.error('[PurchaseContract DELETE] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false, message: '처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// ─── PATCH: action="reject" 반려 ─────────────────────────────────────────────
export async function PATCH(req: Request, { params }: Params) {
  try {
    if (!checkOrigin(req, 'PurchaseContractReject')) {
      return NextResponse.json({ ok: false, message: '잘못된 접근입니다.' }, { status: 403 });
    }
    const ctx = await getAuthContext();
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, message: '권한이 없습니다.' }, { status: 403 });
    }
    const orgId = resolveOrgId(ctx);
    const { id } = await params;

    const body = (await req.json().catch(() => null)) as { action?: string; reason?: string } | null;
    if (body?.action !== 'reject') {
      return NextResponse.json({ ok: false, message: '지원하지 않는 작업입니다.' }, { status: 400 });
    }
    const reason = (body?.reason ?? '').toString().trim() || '반려';

    const doc = await prisma.salesDocument.findFirst({
      where: { id, organizationId: orgId, documentType: 'PURCHASE_CONTRACT' },
      select: { id: true, createdBy: true },
    });
    if (!doc) {
      return NextResponse.json({ ok: false, message: '계약서를 찾을 수 없습니다.' }, { status: 404 });
    }
    if (ctx.role === 'AGENT' && doc.createdBy !== ctx.userId) {
      return NextResponse.json(
        { ok: false, message: '본인이 발급한 계약서만 반려할 수 있습니다.' },
        { status: 403 },
      );
    }

    // SIGNED/APPROVED 도 반려 가능 — 현재 상태 제한 없음
    await prisma.$transaction([
      prisma.salesDocument.updateMany({
        where: { id, organizationId: orgId },
        data: { status: 'REJECTED', rejectedReason: reason },
      }),
      prisma.salesDocumentApproval.create({
        data: {
          documentId:     id,
          organizationId: orgId,
          requestedBy:    doc.createdBy,
          approvedBy:     ctx.userId,
          status:         'REJECTED',
          adminNote:      reason,
          processedAt:    new Date(),
        },
      }),
    ]);

    logger.log('[PurchaseContract PATCH] 반려', { id, role: ctx.role });
    return NextResponse.json({ ok: true, message: '계약서를 반려했습니다.', status: 'REJECTED' });
  } catch (e) {
    logger.error('[PurchaseContract PATCH] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false, message: '처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
