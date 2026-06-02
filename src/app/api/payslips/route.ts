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

    // 역할 확인: AGENT 또는 OWNER만 접근 가능 (자신의 급여명세만 조회)
    // GLOBAL_ADMIN은 전체 조회 가능
    if (session.role !== 'AGENT' && session.role !== 'OWNER' && session.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json(
        { ok: false, error: 'Partner access required' },
        { status: 403 }
      );
    }

    // AGENT/OWNER인 경우, GMcruise 링크가 있어야 급여명세 조회 가능
    if (session.role !== 'GLOBAL_ADMIN') {
      if (!session.mallUser || !session.mallUser.id) {
        // 자신의 급여명세를 조회할 권한이 없으면 빈 결과 반환
        return NextResponse.json({
          ok: true,
          payslips: [],
          total: 0,
        });
      }
    }

    const page = parseInt(req.nextUrl.searchParams.get('page') || '1', 10);
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20', 10);
    const status = req.nextUrl.searchParams.get('status') || '';
    const yearMonth = req.nextUrl.searchParams.get('yearMonth') || '';

    const offset = (page - 1) * limit;

    // where 조건 구성
    let agentId: number | undefined;
    if (session.role === 'GLOBAL_ADMIN') {
      // GLOBAL_ADMIN은 쿼리 파라미터로 agentId를 받을 수 있음
      const agentIdParam = req.nextUrl.searchParams.get('agentId');
      if (agentIdParam) {
        agentId = parseInt(agentIdParam, 10);
      }
    } else {
      // AGENT/OWNER는 자신의 급여만 조회 가능
      agentId = session.mallUser!.id;
    }

    const where: any = agentId ? { agentId } : {};

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

