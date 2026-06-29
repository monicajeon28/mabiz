/**
 * GET /api/documents/[id]/contract-pdf
 * 구매계약서(SalesDocument) PDF 다운로드.
 *
 * - 조직격리 + per-user 격리(GLOBAL_ADMIN/OWNER 조직 전체, AGENT 본인 발급분만).
 *   (send-contract-sms route 패턴 동일)
 * - src/lib/purchase-contract-pdf 의 renderPurchaseContractPdf(generatedData) 로 PDF 생성.
 * - 한글 파일명은 RFC 5987(filename*) 로 안전 인코딩.
 */
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { renderPurchaseContractPdf } from '@/lib/purchase-contract-pdf';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

// 상수시간 토큰 비교 (길이 노출 방지 위해 길이 다르면 즉시 false)
function safeTokenCompare(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

// generatedData → PDF 응답 (공유)
async function buildPdfResponse(docId: string, gd: Record<string, unknown>) {
  // PDF 생성 (Agent-LIB 정의 시그니처: renderPurchaseContractPdf(generatedData) -> Buffer/Stream)
  const pdf = await renderPurchaseContractPdf(gd);

  // 한글 파일명 안전 인코딩 (ASCII 폴백 + RFC 5987 filename*)
  const buyerName = (typeof gd.buyerName === 'string' && gd.buyerName.trim()) ? gd.buyerName.trim() : '고객';
  const dateStr = new Date().toISOString().slice(0, 10);
  const asciiName = `purchase-contract-${docId.slice(-8)}.pdf`;
  const utf8Name = encodeURIComponent(`구매계약서_${buyerName}_${dateStr}.pdf`);

  return new NextResponse(pdf as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const token = new URL(req.url).searchParams.get('token') ?? '';

    // ── 공개 경로: ?token= 제공 시 비로그인 고객(서명 직후/이메일)도 본인 계약서 다운로드 ──
    //   서명완료 시 발급된 pdfDownloadToken(추측불가 랜덤)과 상수시간 비교. 쿠키/조직격리 우회하되
    //   토큰을 모르면 절대 접근 불가 → 본인 문서만 내려받음.
    if (token) {
      const doc = await prisma.salesDocument.findFirst({
        where: { id, documentType: 'PURCHASE_CONTRACT' },
        select: { id: true, generatedData: true },
      });
      if (!doc) {
        return NextResponse.json({ ok: false, message: '계약서를 찾을 수 없습니다.' }, { status: 404 });
      }
      const gd = (doc.generatedData ?? {}) as Record<string, unknown>;
      const storedToken = typeof gd.pdfDownloadToken === 'string' ? gd.pdfDownloadToken : '';
      if (!safeTokenCompare(storedToken, token)) {
        return NextResponse.json({ ok: false, message: '유효하지 않은 다운로드 링크입니다.' }, { status: 403 });
      }
      return await buildPdfResponse(doc.id, gd);
    }

    // ── CRM 내부 경로: 쿠키 인증 + 조직/per-user 격리 ──
    const ctx = await getAuthContext();
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, message: '권한이 없습니다.' }, { status: 403 });
    }
    const orgId = resolveOrgId(ctx);

    const doc = await prisma.salesDocument.findFirst({
      where: { id, organizationId: orgId, documentType: 'PURCHASE_CONTRACT' },
      select: { id: true, createdBy: true, generatedData: true },
    });
    if (!doc) {
      return NextResponse.json({ ok: false, message: '계약서를 찾을 수 없습니다.' }, { status: 404 });
    }

    // per-user 격리: AGENT 는 본인이 발급한 계약서만 내려받기 가능
    if (ctx.role === 'AGENT' && doc.createdBy !== ctx.userId) {
      return NextResponse.json(
        { ok: false, message: '본인이 발급한 계약서만 내려받을 수 있습니다.' },
        { status: 403 },
      );
    }

    const gd = (doc.generatedData ?? {}) as Record<string, unknown>;
    return await buildPdfResponse(doc.id, gd);
  } catch (e) {
    logger.error('[ContractPdf GET] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false, message: 'PDF 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
