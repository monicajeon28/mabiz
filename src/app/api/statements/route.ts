/**
 * GET /api/statements
 * 정산 내역서 페이지
 * 성능 목표: 1M행 <2초
 *
 * Query Params:
 * - period: "YYYY-MM" (예: "2026-05")
 * - status: "ALL" | "DRAFT" | "APPROVED" | "LOCKED" | "PAID"
 * - page: number (1부터 시작)
 * - limit: number (기본값 50)
 * - sortBy: "amount" | "date" | "name" (기본: "amount")
 * - sortOrder: "asc" | "desc" (기본: "desc")
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCache, setCache } from '@/lib/redis';
import { getMabizSession } from '@/lib/auth';

const DEFAULT_LIMIT = 50;
const CACHE_TTL = 300; // 5분

interface SettlementSummary {
  id: string;
  period: string;
  profileId: string;
  profileName: string;
  totalSales: number;
  totalAmount: number;
  totalCommission: number;
  amountAfterTax: number;
  status: string;
  createdAt: string;
}

export async function GET(req: NextRequest) {
  try {
    // 1. 인증 확인
    const session = await getMabizSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = session.organizationId;

    // 2. 쿼리 파라미터
    const searchParams = req.nextUrl.searchParams;
    const period = searchParams.get('period') || getCurrentPeriod();
    const status = searchParams.get('status') || 'ALL';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10);
    const sortBy = searchParams.get('sortBy') || 'amount';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // 3. 캐시 키 생성
    const cacheKey = `statement:${organizationId}:${period}:${status}:${page}:${limit}:${sortBy}:${sortOrder}`;

    // 4. Redis 캐시 확인
    const cached = await getCache<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'X-Cache': 'HIT' }
      });
    }

    // 5. DB 쿼리 실행
    const offset = (page - 1) * limit;

    // Materialized View 사용 (아직 생성 전이면, SQL raw query 대신 임시 구현)
    const result = await getSettlementSummary({
      organizationId,
      period,
      status,
      offset,
      limit,
      sortBy,
      sortOrder
    });

    // 6. 응답 생성
    const response = {
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page,
        pageSize: limit,
        totalPages: Math.ceil(result.total / limit)
      },
      filters: {
        period,
        status,
        sortBy,
        sortOrder
      }
    };

    // 7. Redis 캐시 저장 (5분 TTL)
    await setCache(cacheKey, response, CACHE_TTL);

    return NextResponse.json(response, {
      headers: { 'X-Cache': 'MISS' }
    });

  } catch (error) {
    console.error('[GET /api/statements] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * 정산 요약 데이터 조회
 * settlement_summary View를 사용한 최적화된 쿼리
 */
async function getSettlementSummary({
  organizationId,
  period,
  status,
  offset,
  limit,
  sortBy,
  sortOrder
}: {
  organizationId: string;
  period: string;
  status: string;
  offset: number;
  limit: number;
  sortBy: string;
  sortOrder: string;
}): Promise<{ data: SettlementSummary[]; total: number }> {
  try {
    // 1. WHERE 절 구성
    let whereSQL = '';
    const params: any[] = [];

    if (period !== 'ALL') {
      const [year, month] = period.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      whereSQL = `WHERE "periodStart" >= $1 AND "periodEnd" <= $2`;
      params.push(startDate, endDate);
    }

    if (status !== 'ALL') {
      whereSQL += whereSQL ? ` AND status = $${params.length + 1}` : `WHERE status = $1`;
      params.push(status);
    }

    // 2. ORDER BY 절 구성
    const sortFieldMap: Record<string, string> = {
      amount: 'net_payout',
      date: '"periodStart"',
      name: 'settlement_id' // TODO: affiliate name 추가되면 변경
    };

    const sortField = sortFieldMap[sortBy] || 'net_payout';
    const orderSQL = `ORDER BY ${sortField} ${sortOrder.toUpperCase()}`;

    // 3. 총 행 수 조회
    const countQuery = `
      SELECT COUNT(*) as count FROM settlement_summary
      ${whereSQL}
    `;

    const countResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      countQuery,
      ...params
    );
    const total = Number(countResult[0]?.count || 0);

    // 4. 데이터 조회 (페이지네이션 + 정렬)
    const dataQuery = `
      SELECT
        settlement_id,
        "periodStart",
        "periodEnd",
        status,
        ledger_count,
        total_commission,
        total_withholding,
        net_payout,
        "createdAt"
      FROM settlement_summary
      ${whereSQL}
      ${orderSQL}
      LIMIT ${limit} OFFSET ${offset}
    `;

    const data = await prisma.$queryRawUnsafe<any[]>(
      dataQuery,
      ...params
    );

    // 5. 응답 변환
    const formattedData: SettlementSummary[] = data.map((row) => ({
      id: row.settlement_id?.toString() || 'unknown',
      period: getPeriodString(row.periodStart),
      profileId: 'profile_' + row.settlement_id,
      profileName: `Profile ${row.settlement_id}`, // TODO: affiliates 테이블과 조인
      totalSales: Number(row.ledger_count) || 0,
      totalAmount: Number(row.total_commission) || 0,
      totalCommission: Number(row.total_commission) || 0,
      amountAfterTax: Number(row.net_payout) || 0,
      status: row.status || 'DRAFT',
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : ''
    }));

    return { data: formattedData, total };

  } catch (error) {
    console.error('[getSettlementSummary] Error:', error);
    return { data: [], total: 0 };
  }
}

/**
 * 현재 월 (YYYY-MM) 반환
 */
function getCurrentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Date → "2026-05" 형식
 */
function getPeriodString(date: Date | null): string {
  if (!date) return 'N/A';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
