export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

type PerfStatus = 'GREEN' | 'YELLOW' | 'RED' | 'BLACK';

function calcScore(refundRate: number, activeMonths: number): { refundScore: number; activityScore: number; total: number } {
  let refundScore: number;
  if (refundRate < 5)        refundScore = 60;
  else if (refundRate < 10)  refundScore = 50;
  else if (refundRate < 15)  refundScore = 30;
  else if (refundRate < 20)  refundScore = 15;
  else                       refundScore = 0;
  const activityScore = Math.min(activeMonths * 8, 40);
  return { refundScore, activityScore, total: refundScore + activityScore };
}

function calcStatus(score: number, refundRate: number): PerfStatus {
  // 환불율 강제 트리거: 10% → YELLOW 최소, 20% → RED 강제
  let scoreLevel: number;
  if (score >= 75)      scoreLevel = 0; // GREEN
  else if (score >= 55) scoreLevel = 1; // YELLOW
  else if (score >= 35) scoreLevel = 2; // RED
  else                  scoreLevel = 3; // BLACK

  let refundLevel: number;
  if (refundRate >= 20)      refundLevel = 2; // RED 강제
  else if (refundRate >= 10) refundLevel = 1; // YELLOW 최소
  else                       refundLevel = 0;

  return (['GREEN', 'YELLOW', 'RED', 'BLACK'] as const)[Math.max(scoreLevel, refundLevel)];
}

// 최근 5개월 범위 (오래된 순 → 최신 순)
function getMonthRanges() {
  const now = new Date();
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (4 - i), 1);
    return {
      ym:    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      start: new Date(d.getFullYear(), d.getMonth(), 1),
      end:   new Date(d.getFullYear(), d.getMonth() + 1, 1),
    };
  });
}

export async function GET(_req: Request) {
  try {
    const ctx = await requirePartnerContext();
    if (!ctx) return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 403 });

    const isAdmin = ctx.sessionUser.role === 'admin';
    const isOwner = ctx.sessionUser.role === 'owner';
    const orgId   = ctx.organizationId;
    const selfId  = ctx.sessionUser.crmUserId; // OrganizationMember.id = OrganizationMember.userId

    const monthRanges    = getMonthRanges();
    const start5         = monthRanges[0].start;
    const endNow         = monthRanges[4].end;
    const currentMonth   = monthRanges[4]; // 이번달
    const prevMonth      = monthRanges[3]; // 전달

    // ── 멤버 목록 조회 ──
    let memberRows: Array<{ id: string; userId: string; displayName: string | null; role: string; organizationId: string }>;

    if (isAdmin) {
      memberRows = await prisma.organizationMember.findMany({
        where:   { isActive: true },
        select:  { id: true, userId: true, displayName: true, role: true, organizationId: true },
        orderBy: { organizationId: 'asc' },
        take:    300,
      });
    } else if (isOwner && orgId) {
      memberRows = await prisma.organizationMember.findMany({
        where:  { organizationId: orgId, isActive: true },
        select: { id: true, userId: true, displayName: true, role: true, organizationId: true },
      });
    } else {
      if (!orgId) return NextResponse.json({ ok: false, error: '조직 정보 없음' }, { status: 403 });
      const m = await prisma.organizationMember.findUnique({
        where:  { id: selfId },
        select: { id: true, userId: true, displayName: true, role: true, organizationId: true },
      });
      if (!m) return NextResponse.json({ ok: false, error: '멤버 정보 없음' }, { status: 403 });
      memberRows = [m];
    }

    if (memberRows.length === 0) {
      return NextResponse.json({ ok: true, data: { members: [], isAdmin, isOwner, monthLabels: monthRanges.map(m => m.ym) } });
    }

    // ── 조직명 조회 ──
    const orgIds = [...new Set(memberRows.map(m => m.organizationId))];
    const orgRows = await prisma.organization.findMany({
      where:  { id: { in: orgIds } },
      select: { id: true, name: true },
    });
    const orgNameMap = new Map(orgRows.map(o => [o.id, o.name]));

    // ── 판매 데이터 (단일 배치 쿼리) ──
    const memberIds = memberRows.map(m => m.id);
    const allSales = await prisma.affiliateSale.findMany({
      where: {
        affiliateUserId: { in: memberIds },
        createdAt:       { gte: start5, lt: endNow },
      },
      select: {
        affiliateUserId: true,
        saleAmount:      true,
        refundedAt:      true,
        createdAt:       true,
      },
    });

    // ── 기존 정지 현황 (배치) ──
    const suspensions = await prisma.partnerSuspension.findMany({
      where: {
        organizationId: { in: orgIds },
        partnerId:      { in: memberIds },
        suspensionStatus: { in: ['SUSPENDED', 'APPEALING'] },
      },
      select: { partnerId: true, suspensionStatus: true },
    });
    const suspendedSet = new Set(suspensions.map(s => s.partnerId).filter(Boolean) as string[]);

    // ── 판매 Map 인덱싱 (O(N×M) → O(N+M)) ──
    const salesByMember = new Map<string, typeof allSales>();
    for (const sale of allSales) {
      if (!sale.affiliateUserId) continue;
      const list = salesByMember.get(sale.affiliateUserId) ?? [];
      list.push(sale);
      salesByMember.set(sale.affiliateUserId, list);
    }

    // ── 통계 계산 ──
    const statusOrder: Record<PerfStatus, number> = { BLACK: 0, RED: 1, YELLOW: 2, GREEN: 3 };

    const result = memberRows.map(member => {
      const sales = salesByMember.get(member.id) ?? [];

      // 월별 집계
      const monthlySales = monthRanges.map(({ ym, start, end }) => {
        const ms = sales.filter(s => s.createdAt >= start && s.createdAt < end);
        return {
          month:  ym,
          amount: ms.reduce((sum, s) => sum + (s.saleAmount ?? 0), 0),
          count:  ms.length,
        };
      });

      const activeMonths = monthlySales.filter(m => m.count > 0).length;

      // 이번달 환불율
      const curSales   = sales.filter(s => s.createdAt >= currentMonth.start && s.createdAt < currentMonth.end);
      const curTotal   = curSales.length;
      const curRefunds = curSales.filter(s => s.refundedAt !== null).length;
      const refundRate = curTotal === 0 ? 0 : Math.round((curRefunds / curTotal) * 100);

      // 전달 환불율 (추세 계산용)
      const prevSales    = sales.filter(s => s.createdAt >= prevMonth.start && s.createdAt < prevMonth.end);
      const prevTotal    = prevSales.length;
      const prevRefunds  = prevSales.filter(s => s.refundedAt !== null).length;
      const prevRefundRate = prevTotal === 0 ? 0 : Math.round((prevRefunds / prevTotal) * 100);

      // 추세: 음수 = 개선(환불율 감소), 양수 = 악화
      const refundTrend = curTotal === 0 && prevTotal === 0 ? 0 : refundRate - prevRefundRate;

      const { refundScore, activityScore, total: score } = calcScore(refundRate, activeMonths);
      const status = calcStatus(score, refundRate);

      const autoSuspendNeeded = refundRate >= 20 && !suspendedSet.has(member.id);

      return {
        memberId:            member.id,
        orgId:               member.organizationId,
        displayName:         member.displayName ?? '이름 없음',
        role:                member.role,
        orgName:             orgNameMap.get(member.organizationId) ?? '-',
        monthlySales,
        currentMonthSales:   curTotal,
        currentMonthRefunds: curRefunds,
        refundRate,
        prevMonthRefundRate: prevRefundRate,
        refundTrend,
        refundScore,
        activityScore,
        score,
        status,
        isSelf:              member.id === selfId,
        alreadySuspended:    suspendedSet.has(member.id),
        autoSuspendNeeded,
      };
    });

    // 자기 먼저, 그 다음 위험도 순 (BLACK/RED 먼저)
    result.sort((a, b) => {
      if (a.isSelf && !b.isSelf) return -1;
      if (!a.isSelf && b.isSelf) return 1;
      return statusOrder[a.status] - statusOrder[b.status];
    });

    logger.log('[dashboard/performance] 조회 완료', {
      memberCount: result.length,
      redCount:    result.filter(m => m.status === 'RED').length,
      blackCount:  result.filter(m => m.status === 'BLACK').length,
    });

    return NextResponse.json({
      ok: true,
      data: {
        members:     result,
        isAdmin,
        isOwner,
        monthLabels: monthRanges.map(m => m.ym),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[dashboard/performance] 오류', { message });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
