import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { getCache, setCache } from '@/lib/redis';

interface TeamStatement {
  id: string;
  memberId: string;
  memberName: string;
  role: string;
  totalCommission: number;
  totalWithholding: number;
  netAmount: number;
  period: string;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = session.organizationId;
    const period = req.nextUrl.searchParams.get('period') || getCurrentPeriod();
    const page = parseInt(req.nextUrl.searchParams.get('page') || '1', 10);
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10);

    const cacheKey = `team-statement:${organizationId}:${period}:${page}:${limit}`;
    const cached = await getCache<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, { headers: { 'X-Cache': 'HIT' } });
    }

    // 팀 멤버별 정산 데이터 조회
    const result = await getTeamStatements({
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
    console.error('[GET /api/team-statements] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function getTeamStatements({
  organizationId,
  period,
  page,
  limit
}: {
  organizationId: string;
  period: string;
  page: number;
  limit: number;
}): Promise<{ data: TeamStatement[]; total: number }> {
  try {
    const offset = (page - 1) * limit;

    // 기간 파싱
    const [year, month] = period.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // 조직 멤버 조회
    const members = await prisma.organizationMember.findMany({
      where: { organizationId },
      orderBy: { displayName: 'asc' },
      skip: offset,
      take: limit
    });

    const total = await prisma.organizationMember.count({
      where: { organizationId }
    });

    // 각 멤버별 정산액 조회
    const data: TeamStatement[] = await Promise.all(
      members.map(async (member) => {
        const commissions = await prisma.commissionLedger.findMany({
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          }
        });

        const totalCommission = commissions.reduce(
          (sum, c) => sum + (Number(c.amount) || 0),
          0
        );

        const totalWithholding = Math.round(totalCommission * 0.033);
        const netAmount = totalCommission - totalWithholding;

        return {
          id: member.id,
          memberId: member.id,
          memberName: member.displayName || 'Unknown',
          role: member.role,
          totalCommission,
          totalWithholding,
          netAmount,
          period
        };
      })
    );

    // 지급액 기준 정렬
    data.sort((a, b) => b.netAmount - a.netAmount);

    return { data, total };

  } catch (error) {
    console.error('[getTeamStatements] Error:', error);
    return { data: [], total: 0 };
  }
}

function getCurrentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
