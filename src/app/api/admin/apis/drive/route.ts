export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { enforceRBAC } from '@/app/api/_middleware/enforce-rbac';
import { uploadApisToDrive } from '@/lib/apis-drive';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

/**
 * POST /api/admin/apis/drive
 * 특정 상품의 APIS 명단을 Google Drive에 저장 (멱등)
 * OWNER / GLOBAL_ADMIN 전용
 * body 또는 query 로 productCode 전달
 */
export async function POST(req: NextRequest) {
  // ────────────────────────────────────────────────────────
  // RBAC: GLOBAL_ADMIN / OWNER 전용 엔드포인트
  // ────────────────────────────────────────────────────────
  const rbacCheck = enforceRBAC(req, {
    allowedRoles: ['GLOBAL_ADMIN', 'OWNER'],
    errorMessage: '권한이 없습니다.',
  });
  if (rbacCheck !== true) return rbacCheck;

  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401, headers: NO_STORE });
    if (ctx.role !== 'OWNER' && ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json(
        { ok: false, error: '권한이 없습니다.' },
        { status: 403, headers: NO_STORE },
      );
    }

    // ── productCode 추출 (body 우선, 없으면 query) ──────────────
    let productCode = '';
    try {
      const body = (await req.json()) as { productCode?: string } | null;
      productCode = body?.productCode?.trim() ?? '';
    } catch {
      // body 없음/파싱 실패 → query 폴백
    }
    if (!productCode) {
      productCode = req.nextUrl.searchParams.get('productCode')?.trim() ?? '';
    }
    if (!productCode) {
      return NextResponse.json(
        { ok: false, error: 'productCode 파라미터가 필요합니다.' },
        { status: 400, headers: NO_STORE },
      );
    }

    // ── Drive 저장 ──────────────────────────────────────────────
    const result = await uploadApisToDrive(productCode);

    if (result.skipped) {
      logger.log('[APIS Drive] skipped', {
        role: ctx.role,
        productCode,
        travelerCount: result.travelerCount,
      });
      return NextResponse.json(
        { ok: true, skipped: true, message: '탑승객 0명 — 저장할 명단 없음' },
        { status: 200, headers: NO_STORE },
      );
    }

    logger.log('[APIS Drive] saved', {
      role: ctx.role,
      productCode,
      folderId: result.folderId,
      fileId: result.fileId,
      travelerCount: result.travelerCount,
    });

    return NextResponse.json(
      { ok: true, folderId: result.folderId, fileId: result.fileId, viewUrl: result.viewUrl },
      { status: 200, headers: NO_STORE },
    );
  } catch (err) {
    // ── Drive 권한/403 오류는 명확한 메시지로 (무한 재시도 금지) ──
    const status =
      (err as { code?: number; status?: number })?.code ??
      (err as { code?: number; status?: number })?.status;
    if (status === 403 || status === 401) {
      logger.error('[APIS Drive] 권한 오류', { status });
      return NextResponse.json(
        { ok: false, error: '드라이브 권한이 없습니다. 관리자에게 문의하세요' },
        { status: 200, headers: NO_STORE },
      );
    }

    logger.error('[APIS Drive]', { err });
    return NextResponse.json(
      { ok: false, error: '서버 오류' },
      { status: 500, headers: NO_STORE },
    );
  }
}
