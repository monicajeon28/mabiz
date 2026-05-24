import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

type TeamStatement = {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  teamNetAmount: number;
  paidAt: string | null;
  teamMemberId?: string;
  memberName?: string;
  memberRole?: string;
  daysOverdue?: number;
};

/**
 * CRM 자동분류: 정산 건강도 판정 및 SMS Day 계산
 * Risk Flags: NONE / DELAYED_3_7DAYS / DELAYED_7PLUS_DAYS
 */
function calculateDaysOverdue(status: string, periodEnd: string): number {
  if (status === "COMPLETED" || status === "APPROVED") return 0;

  const endDate = new Date(periodEnd);
  const now = new Date();
  const diffMs = now.getTime() - endDate.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

export async function GET() {
  try {
    const ctx = await getAuthContext();

    // OWNER만 접근 가능
    if (ctx.role !== 'OWNER') {
      return NextResponse.json({ ok: true, statements: [] });
    }

    // 1. affiliateCode 조회
    const sale = await prisma.affiliateSale.findFirst({
      where: { affiliateUserId: ctx.userId },
      orderBy: { createdAt: 'desc' },
      select: { affiliateCode: true },
    });

    if (!sale?.affiliateCode) {
      return NextResponse.json({ ok: true, statements: [] });
    }

    // 2. 크루즈닷 internal API 호출
    const baseUrl = process.env.CRUISEDOT_BASE_URL;
    const secret  = process.env.CRUISEDOT_INTERNAL_SECRET;

    if (!baseUrl || !secret) {
      logger.log('[TeamStatements] CRUISEDOT 환경변수 미설정');
      return NextResponse.json({ ok: true, statements: [] });
    }

    const res = await fetch(
      `${baseUrl}/api/internal/team-statements?affiliateCode=${encodeURIComponent(sale.affiliateCode)}`,
      {
        headers: { Authorization: `Bearer ${secret}` },
        next: { revalidate: 300 }, // 5분 캐시
      }
    );

    if (!res.ok) {
      logger.log('[TeamStatements] 크루즈닷 응답 실패', { status: res.status });
      return NextResponse.json({ ok: true, statements: [] });
    }

    const data = await res.json() as { ok: boolean; statements: TeamStatement[] };

    // L5 + L10: 팀원 역할 및 지연일수 계산 후 응답에 추가
    const enrichedStatements = (data.statements ?? []).map((stmt) => ({
      ...stmt,
      daysOverdue: calculateDaysOverdue(stmt.status, stmt.periodEnd),
      memberRole: stmt.memberRole ?? "JUNIOR_OWNER", // 기본값
    }));

    return NextResponse.json({ ok: true, statements: enrichedStatements });

  } catch (e) {
    logger.log('[TeamStatements] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: true, statements: [] });
  }
}
