import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

type Statement = {
  id: string;
  saleDate: string;
  externalOrderCode: string | null;
  saleAmount: number;
  commissionRate: number;
  confirmedAmount: number;
  status: string;
};

interface ApiResponse {
  ok: boolean;
  statements: Statement[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

async function fallbackFromAffiliateSale(
  userId: string,
  opts: { from: string | null; to: string | null; status: string | null; page: number; limit: number }
): Promise<NextResponse<ApiResponse>> {
  const { from, to, status, page, limit } = opts;

  const where = {
    affiliateUserId: userId,
    ...(status && status !== 'ALL' ? { status } : {}),
    ...(from || to ? {
      createdAt: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      },
    } : {}),
  };

  const [sales, total] = await Promise.all([
    prisma.affiliateSale.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, orderId: true, saleAmount: true,
        commissionRate: true, commissionAmount: true,
        status: true, createdAt: true,
      },
    }),
    prisma.affiliateSale.count({ where }),
  ]);

  const statements: Statement[] = sales.map((s) => ({
    id:                s.id,
    saleDate:          s.createdAt.toISOString(),
    externalOrderCode: s.orderId ?? null,
    saleAmount:        s.saleAmount,
    commissionRate:    s.commissionRate,
    confirmedAmount:   s.commissionAmount,
    status:            s.status,
  }));

  return NextResponse.json<ApiResponse>({
    ok: true,
    statements,
    total,
    page,
    pageSize: limit,
    totalPages: Math.ceil(total / limit),
  });
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const searchParams = request.nextUrl.searchParams;

    // 1. 쿼리 파라미터 파싱
    const from = searchParams.get('from'); // YYYY-MM-01 형식
    const to = searchParams.get('to'); // YYYY-MM-31 형식
    const status = searchParams.get('status'); // COMPLETED | APPROVED | ALL
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    // 2. affiliateCode 조회
    const sale = await prisma.affiliateSale.findFirst({
      where: { affiliateUserId: ctx.userId },
      orderBy: { createdAt: 'desc' },
      select: { affiliateCode: true },
    });

    if (!sale?.affiliateCode) {
      return NextResponse.json<ApiResponse>({ ok: true, statements: [] });
    }

    // 3. 크루즈닷 internal API 호출 (쿼리 파라미터 추가)
    const baseUrl = process.env.CRUISEDOT_BASE_URL;
    const secret = process.env.CRUISEDOT_INTERNAL_SECRET;

    if (!baseUrl || !secret) {
      logger.log('[Statements] CRUISEDOT 환경변수 미설정 — DB fallback 사용');
      return fallbackFromAffiliateSale(ctx.userId, { from, to, status, page, limit });
    }

    // 쿼리 URL 구성
    const queryUrl = new URL(`${baseUrl}/api/internal/statements`);
    queryUrl.searchParams.set('affiliateCode', sale.affiliateCode);
    if (from) queryUrl.searchParams.set('from', from);
    if (to) queryUrl.searchParams.set('to', to);
    if (status && status !== 'ALL') queryUrl.searchParams.set('status', status);
    queryUrl.searchParams.set('page', String(page));
    queryUrl.searchParams.set('limit', String(limit));

    const res = await fetch(queryUrl.toString(), {
      headers: { Authorization: `Bearer ${secret}` },
      next: { revalidate: 300 }, // 5분 캐시
    });

    if (!res.ok) {
      logger.log('[Statements] 크루즈닷 응답 실패', { status: res.status });
      return NextResponse.json<ApiResponse>({ ok: true, statements: [] });
    }

    const data = (await res.json()) as {
      ok: boolean;
      statements: Statement[];
      total?: number;
      page?: number;
      pageSize?: number;
      totalPages?: number;
    };

    return NextResponse.json<ApiResponse>({
      ok: true,
      statements: data.statements ?? [],
      total: data.total,
      page: data.page,
      pageSize: data.pageSize,
      totalPages: data.totalPages,
    });
  } catch (e) {
    logger.log('[Statements] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json<ApiResponse>({ ok: true, statements: [] });
  }
}
