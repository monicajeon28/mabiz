export const dynamic = 'force-dynamic';

/**
 * 관리자 - 크루즈몰 매출내역 엑셀 다운로드
 * GET /api/admin/mall-sales/export?month=2026-04&status=all&search=
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import * as XLSX from 'xlsx';
import type { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 });
  }

  // DB에서 역할 재확인
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, role: true },
  });
  if (!user || !['admin', 'superadmin'].includes(user.role || '')) {
    return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') || '';   // '2026-04'
  const status = searchParams.get('status') || 'all';
  const search = searchParams.get('search') || '';

  try {
    // 필터 구성
    const where: Prisma.PaymentWhereInput = {};

    if (status !== 'all') {
      where.status = status;
    }

    if (month) {
      const [yearStr, monthStr] = month.split('-');
      const year = parseInt(yearStr ?? '');
      const monthNum = parseInt(monthStr ?? '');
      if (isNaN(year) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        return NextResponse.json(
          { ok: false, error: '유효하지 않은 월 형식입니다. (YYYY-MM)' },
          { status: 400 }
        );
      }
      const startDate = new Date(Date.UTC(year, monthNum - 1, 1));
      const endDate = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999));
      where.createdAt = { gte: startDate, lte: endDate };
    }

    if (search) {
      where.OR = [
        { buyerName: { contains: search } },
        { buyerTel: { contains: search } },
      ];
    }

    // 데이터 조회 (최대 10,000건)
    const payments = await prisma.payment.findMany({
      where,
      select: {
        orderId: true,
        buyerName: true,
        buyerTel: true,
        buyerEmail: true,
        productName: true,
        amount: true,
        status: true,
        pgProvider: true,
        affiliateCode: true,
        paidAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    // 상태 라벨 매핑
    const STATUS_LABELS: Record<string, string> = {
      pending: '대기중',
      paid: '결제완료',
      completed: '결제완료',
      cancelled: '환불완료',
      failed: '결제실패',
    };

    // 엑셀 행 변환 — 연락처 마스킹 (PII 보호)
    const rows = payments.map(p => ({
      '주문번호': p.orderId || '',
      '구매자명': p.buyerName || '',
      '연락처': p.buyerTel ? `${p.buyerTel.substring(0, 3)}****` : '',
      '이메일': p.buyerEmail || '',
      '상품명': p.productName || '',
      '금액': Math.max(0, p.amount),
      '상태': STATUS_LABELS[p.status] || p.status,
      'PG사': p.pgProvider || '',
      '어필리에이트코드': p.affiliateCode || '',
      '결제일': p.paidAt ? p.paidAt.toLocaleDateString('ko-KR') : '',
      '등록일': p.createdAt.toLocaleDateString('ko-KR'),
    }));

    // 엑셀 생성
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '매출내역');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    logger.debug('[MallSales Export] 엑셀 다운로드', {
      adminId: user.id,
      count: payments.length,
      month: month || 'all',
      status,
    });

    const filenameLabel = month || 'all';
    const encodedFilename = encodeURIComponent(`매출내역_${filenameLabel}.xlsx`);

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
      },
    });
  } catch (error) {
    logger.error('[MallSales Export] 오류', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { ok: false, error: '엑셀 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
