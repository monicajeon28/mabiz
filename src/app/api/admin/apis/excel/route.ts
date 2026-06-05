export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { enforceRBAC } from '@/app/api/_middleware/enforce-rbac';
import {
  fetchApisData,
  buildApisWorkbook,
  dataRowsToApisRows,
  APIS_HEADERS,
} from '@/lib/apis-excel';

export type { ApisRow } from '@/lib/apis-excel';

/**
 * GET /api/admin/apis/excel?productCode=xxx
 * 특정 상품의 APIS 엑셀 파일 생성 · 다운로드
 * OWNER / GLOBAL_ADMIN 전용
 */
export async function GET(req: NextRequest) {
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
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role !== 'OWNER' && ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const productCode = req.nextUrl.searchParams.get('productCode')?.trim();
    if (!productCode) {
      return NextResponse.json({ ok: false, error: 'productCode 파라미터가 필요합니다.' }, { status: 400 });
    }
    // preview=1 이면 JSON 반환 (미리보기용)
    const isPreview = req.nextUrl.searchParams.get('preview') === '1';

    // ── 데이터 조회 (Trip → CruiseProduct 폴백) ────────────────
    const data = await fetchApisData(productCode);
    if (!data) {
      return NextResponse.json({ ok: false, error: '해당 상품코드를 찾을 수 없습니다.' }, { status: 404 });
    }

    const { trip, dataRows, depDateKor, titleText, reservationCount, travelerCount } = data;

    // ── 미리보기 JSON 응답 ─────────────────────────────────────
    if (isPreview) {
      const previewRows = dataRowsToApisRows(dataRows);

      logger.log('[APIS Preview]', { role: ctx.role, productCode, count: previewRows.length });
      return NextResponse.json({
        ok: true,
        productCode,
        tripTitle: titleText,
        rows: previewRows,
        reservationCount,
        travelerCount,
      });
    }

    // ── xlsx 워크북 생성 (다운로드) ────────────────────────────
    const buf = buildApisWorkbook(titleText, productCode, depDateKor, dataRows, APIS_HEADERS);

    const today = new Date();
    const todayStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const filename = encodeURIComponent(`APIS_${productCode}_${todayStr}.xlsx`);

    logger.log('[APIS Excel]', {
      role: ctx.role,
      productCode,
      tripId: trip.id,
      reservationCount,
      travelerCount,
    });

    return new NextResponse(buf as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (err) {
    logger.error('[APIS Excel]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
