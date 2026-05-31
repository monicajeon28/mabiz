/**
 * GET /api/payslips
 * 급여명세서 조회
 * 원천징수 자동 계산 (3.3%)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { getCache, setCache } from '@/lib/redis';

const WITHHOLDING_TAX_RATE = 0.033; // 3.3%

interface PayslipItem {
  id: string;
  period: string;
  profileId: string;
  profileName: string;
  commission: number;
  bonus: number;
  grossAmount: number;
  withholdingTax: number;
  netAmount: number;
  createdAt: string;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session || !session.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId: string = session.organizationId;
    const period: string = req.nextUrl.searchParams.get('period') ?? getCurrentPeriod();
    const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10);
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10);

    const cacheKey = `payslip:${organizationId}:${period}:${page}:${limit}`;
    const cached = await getCache<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, { headers: { 'X-Cache': 'HIT' } });
    }

    // 실제 데이터 조회
    const result = await getPayslipData({
      organizationId,
      period,
      page,
      limit
    });

    const response = {
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page,
        pageSize: limit,
        totalPages: Math.ceil(result.total / limit)
      }
    };

    await setCache(cacheKey, response, 300);
    return NextResponse.json(response, { headers: { 'X-Cache': 'MISS' } });

  } catch (error) {
    console.error('[GET /api/payslips] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * 급여명세서 데이터 조회 및 원천징수 자동 계산
 */
async function getPayslipData({
  organizationId,
  period,
  page,
  limit
}: {
  organizationId: string;
  period: string;
  page: number;
  limit: number;
}): Promise<{ data: PayslipItem[]; total: number }> {
  try {
    const offset = (page - 1) * limit;

    // 기간 파싱
    const [year, month] = period.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // CommissionLedger에서 정산액 조회
    const [ledgers, total] = await Promise.all([
      prisma.commissionLedger.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.commissionLedger.count({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      })
    ]);

    // PayslipBonus 데이터 조회 (보너스)
    const bonuses = await prisma.payslipBonus.findMany({
      where: {
        period: period // YYYY-MM 형식
      }
    });

    // 보너스 맵 생성
    const bonusMap = new Map(
      bonuses.map(b => [b.profileId, b.bonusAmount])
    );

    // 응답 데이터 변환
    const data: PayslipItem[] = ledgers.map((ledger, index) => {
      const commission = Number(ledger.amount) || 0;
      const profileIdNum = ledger.profileId || 0;
      const profileId: string = String(profileIdNum);
      const bonus = bonusMap.get(Number(profileId)) || 0;
      const grossAmount = commission + bonus;
      const withholdingTax = Math.round(grossAmount * WITHHOLDING_TAX_RATE);
      const netAmount = grossAmount - withholdingTax;

      return {
        id: ledger.id.toString(),
        period,
        profileId,
        profileName: `Profile ${profileIdNum}`, // TODO: affiliates 테이블과 조인
        commission,
        bonus,
        grossAmount,
        withholdingTax,
        netAmount,
        createdAt: ledger.createdAt.toISOString()
      };
    });

    return { data, total };

  } catch (error) {
    console.error('[getPayslipData] Error:', error);
    return { data: [], total: 0 };
  }
}

function getCurrentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
