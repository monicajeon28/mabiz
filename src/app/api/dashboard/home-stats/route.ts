export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { DashboardHomeStats } from '@/types/dashboard';

/**
 * GET /api/dashboard/home-stats
 *
 * 50대 사용자 홈 대시보드용 단순화된 통계
 * - 오늘의 신청자 / 계약 완료 / 대기 중 / 위험도
 * - Russell 퍼널 (신청 → 문자 → 계약)
 * - Grant TOP 3 우선순위 콜
 *
 * 역할별 필터링:
 * - GLOBAL_ADMIN: 전체 조직 데이터
 * - OWNER: 팀 데이터
 * - AGENT: 본인 데이터
 */
export async function GET() {
  try {
    const ctx = await getMabizSession();
    if (!ctx) {
      return NextResponse.json({ ok: false, error: '인증 필요' }, { status: 401 });
    }

    const yearMonth = new Date().toISOString().slice(0, 7);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 역할별 필터 조건 구성
    let contactFilter: any = { deletedAt: null };
    let callLogFilter: any = {};

    if (ctx.role === 'OWNER' && ctx.organizationId) {
      // OWNER: 팀 소속 에이전트 담당 고객만
      const teamAgentIds = await prisma.organizationMember.findMany({
        where: { organizationId: ctx.organizationId, role: 'AGENT' },
        select: { userId: true },
      });
      const userIds = teamAgentIds.map((m: { userId: string }) => m.userId);
      contactFilter.createdByUserId = { in: userIds };
      callLogFilter.contact = { createdByUserId: { in: userIds } };
    } else if (ctx.role === 'AGENT') {
      // AGENT: 본인 담당 고객만
      contactFilter.createdByUserId = ctx.userId;
      callLogFilter.contact = { createdByUserId: ctx.userId };
    }
    // GLOBAL_ADMIN: 필터 없음 (전체)

    // ───────────────────────────────────────────────────────
    // 1. 오늘의 신청자 (Contact 생성일)
    // ───────────────────────────────────────────────────────
    const todayStart = new Date(today);
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setUTCHours(23, 59, 59, 999);

    const todayNewApplications = await prisma.contact.count({
      where: {
        ...contactFilter,
        createdAt: { gte: todayStart, lte: todayEnd },
      },
    });

    // ───────────────────────────────────────────────────────
    // 2. 계약 완료 (CallLog result='completed')
    // ───────────────────────────────────────────────────────
    const todayCompletedContracts = await prisma.callLog.count({
      where: {
        ...callLogFilter,
        result: 'completed',
        createdAt: { gte: todayStart, lte: todayEnd },
      },
    });

    // ───────────────────────────────────────────────────────
    // 3. 대기 중 (Contact status='INACTIVE' 또는 status 없음)
    // ───────────────────────────────────────────────────────
    const pendingCount = await prisma.contact.count({
      where: {
        ...contactFilter,
        status: { in: ['INACTIVE', null] },
      },
    });

    // ───────────────────────────────────────────────────────
    // 4. Russell 퍼널 (3단계)
    // ───────────────────────────────────────────────────────
    // Step 1: 전체 신청 (Contact)
    const step1Count = await prisma.contact.count({ where: contactFilter });

    // Step 2: 문자 발송됨 (최소 1개 SMS 기록)
    const contactsWithSms = await prisma.contact.findMany({
      where: contactFilter,
      select: { id: true },
      take: 10000,
    });
    const contactIdsWithSms = (
      await prisma.smsLog.findMany({
        where: {
          contactId: { in: contactsWithSms.map(c => c.id) },
        },
        distinct: ['contactId'],
        select: { contactId: true },
      })
    )
      .map(s => s.contactId)
      .filter(Boolean) as string[];
    const step2Count = contactIdsWithSms.length;

    // Step 3: 계약 완료 (status='ACTIVE')
    const step3Count = await prisma.contact.count({
      where: {
        ...contactFilter,
        status: 'ACTIVE',
      },
    });

    const step1Pct = 100;
    const step2Pct = step1Count > 0 ? (step2Count / step1Count) * 100 : 0;
    const step3Pct = step1Count > 0 ? (step3Count / step1Count) * 100 : 0;

    // ───────────────────────────────────────────────────────
    // 5. 위험도 계산 (복합 점수: anxietyScore, differentiationScore, l5l6CombinedScore)
    // ───────────────────────────────────────────────────────
    const riskScores = await prisma.contact.findMany({
      where: {
        ...contactFilter,
        status: { not: 'ACTIVE' }, // 완료되지 않은 것만
      },
      select: {
        anxietyScore: true,
        differentiationScore: true,
        l5l6CombinedScore: true,
      },
      take: 100,
    });

    let averageRiskScore = 0;
    if (riskScores.length > 0) {
      const totalRisk = riskScores.reduce((sum, c) => {
        const compositeScore =
          ((c.anxietyScore || 0) * 0.3 +
            (c.differentiationScore || 0) * 0.3 +
            (c.l5l6CombinedScore || 0) * 0.4) / 3;
        return sum + compositeScore;
      }, 0);
      averageRiskScore = totalRisk / riskScores.length;
    }

    const riskLevel = averageRiskScore >= 61 ? 'CRITICAL' : averageRiskScore >= 31 ? 'WARNING' : 'SAFE';

    // ───────────────────────────────────────────────────────
    // 6. Grant TOP 3 우선순위 (복합 점수 높은 순)
    // ───────────────────────────────────────────────────────
    const topCalls = await prisma.contact.findMany({
      where: {
        ...contactFilter,
        status: { not: 'ACTIVE' }, // 완료되지 않은 것만
      },
      select: {
        id: true,
        name: true,
        phone: true,
        anxietyScore: true,
        differentiationScore: true,
        l5l6CombinedScore: true,
        createdAt: true,
      },
      take: 100, // 정렬 후 상위 3개 선택
    });

    // 복합 점수로 정렬
    const sortedCalls = topCalls
      .map(call => ({
        ...call,
        compositeScore:
          ((call.anxietyScore || 0) * 0.3 +
            (call.differentiationScore || 0) * 0.3 +
            (call.l5l6CombinedScore || 0) * 0.4) / 3,
      }))
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, 3);

    const topPriorityCalls = sortedCalls.map((call, idx) => {
      const daysLeft = idx === 0 ? 0 : idx === 1 ? 1 : 2;
      const priority =
        idx === 0 ? ('HIGH' as const) : idx === 1 ? ('MEDIUM' as const) : ('LOW' as const);

      return {
        id: call.id,
        name: call.name || '(이름 없음)',
        phone: call.phone || '(번호 없음)',
        priority,
        daysLeft,
        nextAction: daysLeft === 0 ? '지금 전화!' : daysLeft === 1 ? '1시간 내' : '기한 임박',
        riskScore: Math.round(call.compositeScore),
        method: idx === 0 ? 'Grant 방법 #2' : idx === 1 ? '문자 확인' : '계약 재확인',
      };
    });

    // ───────────────────────────────────────────────────────
    // 응답 조합
    // ───────────────────────────────────────────────────────
    const stats: DashboardHomeStats = {
      todayNewApplications,
      todayCompletedContracts,
      pendingCount,
      riskLevel,
      funnelStats: {
        step1: { label: '신청', count: step1Count, percentage: step1Pct },
        step2: { label: '문자', count: step2Count, percentage: step2Pct },
        step3: { label: '계약', count: step3Count, percentage: step3Pct },
      },
      topPriorityCalls,
      yearMonth: new Date().toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
      }).replace(/년/, '년'),
    };

    return NextResponse.json({ ok: true, stats });
  } catch (err) {
    console.error('[dashboard/home-stats]', err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : '서버 오류',
      },
      { status: 500 }
    );
  }
}
