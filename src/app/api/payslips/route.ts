/**
 * GET /api/payslips
 * 급여명세서 조회 - Partner 급여 조회 (Partner 로그인 시)
 *
 * 쿼리 파라미터:
 * - page: 페이지 번호 (기본: 1)
 * - limit: 페이지당 항목 수 (기본: 20)
 * - status: 필터 (PENDING, APPROVED, SENT)
 * - yearMonth: 기간 필터 (YYYY-MM 형식)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';

const WITHHOLDING_TAX_RATE = 0.033; // 3.3%


export async function GET(req: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // GMcruise 사용자만 접근 가능 (파트너/제휴사)
    if (!session.mallUser || !session.mallUser.affiliateProfileId) {
      return NextResponse.json(
        { ok: false, error: 'Partner access required' },
        { status: 403 }
      );
    }

    const page = parseInt(req.nextUrl.searchParams.get('page') || '1', 10);
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20', 10);
    const status = req.nextUrl.searchParams.get('status') || '';
    const yearMonth = req.nextUrl.searchParams.get('yearMonth') || '';

    const offset = (page - 1) * limit;

    // where 조건 구성
    const where: any = {
      agentId: session.mallUser.id, // 현재 로그인한 파트너의 급여만
    };

    if (status) {
      where.status = status;
    }

    if (yearMonth) {
      where.yearMonth = yearMonth;
    }

    // 급여명세 조회
    const [payslips, total] = await Promise.all([
      prisma.affiliatePayslip.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.affiliatePayslip.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      payslips: payslips.map((p) => ({
        id: p.id,
        agentId: p.agentId,
        yearMonth: p.yearMonth,
        baseCommission: Number(p.baseCommission),
        bonus: p.bonus !== null ? Number(p.bonus) : null,
        deduction: p.deduction !== null ? Number(p.deduction) : null,
        netAmount: Number(p.netAmount),
        status: p.status,
        paidAt: p.paidAt ? p.paidAt.toISOString() : null,
        note: p.note,
        createdAt: p.createdAt.toISOString(),
        agentDisplayName: p.agentDisplayName,
        agentMallUserId: p.agentMallUserId,
      })),
      total,
    });

  } catch (error) {
    console.error('[GET /api/payslips] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

