// app/api/admin/affiliate/refunds/logs/route.ts
// 관리자 환절 이력 조회 API

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface RefundLogEntry {
  date: string;
  type: string;
  amount: number;
  reason: string | null;
}

interface RefundLogResponse {
  ok: true;
  data: RefundLogEntry[];
}

interface ErrorResponse {
  ok: false;
  error: string;
}

export async function GET(req: NextRequest): Promise<NextResponse<RefundLogResponse | ErrorResponse>> {
  try {
    // 인증 확인
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 401 });
    }

    // 관리자 권한 확인 (GLOBAL_ADMIN만 접근 가능)
    if (sessionUser.role !== 'GLOBAL_ADMIN') {
      logger.warn('[REFUND_LOGS] 비관리자 접근 시도', {
        userId: sessionUser.id,
        role: sessionUser.role,
        ip: req.ip,
      });
      return NextResponse.json(
        { ok: false, error: '관리자만 접근 가능합니다' },
        { status: 403 }
      );
    }

    // saleId 파라미터 검증
    const saleId = req.nextUrl.searchParams.get('saleId');
    if (!saleId) {
      return NextResponse.json(
        { ok: false, error: 'saleId 파라미터가 필요합니다' },
        { status: 400 }
      );
    }

    const saleIdNum = parseInt(saleId, 10);
    if (isNaN(saleIdNum)) {
      return NextResponse.json(
        { ok: false, error: 'saleId는 숫자여야 합니다' },
        { status: 400 }
      );
    }

    // 1. 판매건 존재 확인
    const sale = await prisma.affiliateSale.findUnique({
      where: { id: saleIdNum },
      select: {
        id: true,
        saleAmount: true,
        status: true,
        agentId: true,
      },
    });

    if (!sale) {
      return NextResponse.json(
        { ok: false, error: '판매건을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 2. 환절 이력 조회 (REFUND_* 엔트리만)
    const refundLogs = await prisma.commissionLedger.findMany({
      where: {
        saleId: saleIdNum,
        entryType: { startsWith: 'REFUND_' },
      },
      select: {
        createdAt: true,
        entryType: true,
        amount: true,
        notes: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // 3. 응답 포맷팅 (날짜, 타입, 금액, 사유)
    const data: RefundLogEntry[] = refundLogs.map((log) => ({
      date: log.createdAt.toISOString().slice(0, 10),
      type: log.entryType,
      amount: log.amount,
      reason: log.notes ?? null,
    }));

    logger.debug('[REFUND_LOGS] 조회 성공', {
      saleId: saleIdNum,
      adminId: sessionUser.id,
      logCount: data.length,
      saleStatus: sale.status,
    });

    return NextResponse.json({
      ok: true,
      data,
    } as RefundLogResponse);
  } catch (error) {
    logger.error('[REFUND_LOGS] 조회 오류', {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      isDev: process.env.NODE_ENV === 'development',
    });
    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
