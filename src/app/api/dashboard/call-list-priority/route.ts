export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';

interface CallListItem {
  contactId: string;
  name: string;
  phone: string;
  priority: number;
  label: string;
  reason: string;
  lastSmsAt: string | null;
  lastSmsOpened: string | null;
  lastSmsResponse: string | null;
  nextAction: string;
  psychologyLens: string;
  preparationLevel: string;
  anxietyScore: number;
  timeSinceContact: string;
  callDueTime: string;
}

/**
 * GET /api/dashboard/call-list-priority
 *
 * Grant Cardone TOP 5-10 콜리스트 우선도 계산
 *
 * 역할별 필터링:
 * - GLOBAL_ADMIN: 전체 조직 데이터
 * - OWNER: 팀 에이전트 담당 고객만
 * - AGENT: 본인 담당 고객만
 */
export async function GET() {
  try {
    const ctx = await getMabizSession();
    if (!ctx) {
      return NextResponse.json({ ok: false, error: '인증 필요' }, { status: 401 });
    }

    // ───────────────────────────────────────────────────────
    // 역할별 필터 조건
    // ───────────────────────────────────────────────────────
    let contactFilter: any = { deletedAt: null, status: { not: 'ACTIVE' } };

    if (ctx.role === 'OWNER' && ctx.organizationId) {
      // OWNER: 팀 소속 에이전트 담당 고객만
      const teamAgentIds = await prisma.organizationMember.findMany({
        where: { organizationId: ctx.organizationId, role: 'AGENT' },
        select: { userId: true },
      });
      const userIds = teamAgentIds.map((m: { userId: string }) => m.userId);
      contactFilter.createdByUserId = { in: userIds };
    } else if (ctx.role === 'AGENT') {
      // AGENT: 본인 담당 고객만
      contactFilter.createdByUserId = ctx.userId;
    }
    // GLOBAL_ADMIN: 필터 없음

    // ───────────────────────────────────────────────────────
    // Contact 데이터 조회 (상위 100개)
    // ───────────────────────────────────────────────────────
    const contacts = await prisma.contact.findMany({
      where: contactFilter,
      select: {
        id: true,
        name: true,
        phone: true,
        lastContactedAt: true,
        departureDate: true,
        anxietyScore: true,
        differentiationScore: true,
        l5l6CombinedScore: true,
        createdAt: true,
      },
      take: 100,
    });

    // ───────────────────────────────────────────────────────
    // 각 Contact의 마지막 SMS 정보 조회
    // ───────────────────────────────────────────────────────
    let smsOrgFilter: any = {};
    if (ctx.role !== 'GLOBAL_ADMIN' && ctx.organizationId) {
      smsOrgFilter.organizationId = ctx.organizationId;
    }

    const lastSmsMap = new Map<string, any>();
    for (const contact of contacts) {
      const lastSms = await prisma.smsLog.findFirst({
        where: { ...smsOrgFilter, contactId: contact.id },
        orderBy: { sentAt: 'desc' },
        select: {
          sentAt: true,
          openedAt: true,
          contentPreview: true,
        },
        take: 1,
      });
      if (lastSms) {
        lastSmsMap.set(contact.id, lastSms);
      }
    }

    // ───────────────────────────────────────────────────────
    // 우선도 계산 함수
    // ───────────────────────────────────────────────────────

    const calculateImmediacy = (lastOpenedAt: Date | null): number => {
      if (!lastOpenedAt) return 0;

      const hoursSince = (Date.now() - lastOpenedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 1) return 100;
      if (hoursSince < 3) return 80;
      if (hoursSince < 24) return 50;
      return 0;
    };

    const calculateResponsiveness = (contact: any): number => {
      let score = 0;

      if (contact.lastContactedAt) score += 50;

      const daysSinceContact =
        (Date.now() - (contact.lastContactedAt?.getTime() || Infinity)) / (1000 * 60 * 60 * 24);
      if (daysSinceContact < 7) score += 30;

      if (daysSinceContact < 1) score += 20;

      return Math.min(score, 100);
    };

    const calculatePsychologyScore = (contact: any): number => {
      let score = 0;

      if (contact.departureDate) {
        const daysUntilDeparture =
          (contact.departureDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        if (daysUntilDeparture < 30) score += 30;
      }

      if (contact.l5l6CombinedScore && contact.l5l6CombinedScore > 60) score += 20;

      if (contact.anxietyScore && contact.anxietyScore > 60) score += 10;

      return Math.min(score, 100);
    };

    const calculateReadiness = (contact: any): number => {
      const anxietyScore = contact.anxietyScore || 0;

      if (anxietyScore > 80) return 50;
      if (anxietyScore > 60) return 40;
      if (anxietyScore > 40) return 30;
      if (anxietyScore > 20) return 20;
      return 10;
    };

    const calculatePriority = (contact: any, lastSms: any): number => {
      const immediacy = calculateImmediacy(lastSms?.openedAt) * 0.4;
      const responsiveness = calculateResponsiveness(contact) * 0.3;
      const psychology = calculatePsychologyScore(contact) * 0.2;
      const readiness = calculateReadiness(contact) * 0.1;

      const priority = immediacy + responsiveness + psychology + readiness;

      if (immediacy === 40) return 999;

      if (immediacy >= 32 || (responsiveness >= 80 && immediacy >= 20)) return 500;

      if (psychology >= 20) return 300;

      if (readiness >= 30) return 200;

      return Math.max(100, Math.round(priority));
    };

    const recommendNextAction = (contact: any): string => {
      const anxietyScore = contact.anxietyScore || 0;
      const differentiationScore = contact.differentiationScore || 0;

      if (anxietyScore > 70) {
        return 'Grant 반박법 #2 (준비 불안 해소)';
      }
      if (differentiationScore < 30) {
        return 'Grant 반박법 #3 (기항지 차별성)';
      }
      if (anxietyScore > 40) {
        return 'Grant 반박법 #1 (가격 재정의)';
      }

      return 'Grant 반박법 #5 (신뢰 구축)';
    };

    const getPsychologyLens = (contact: any): string => {
      const anxietyScore = contact.anxietyScore || 0;

      if (anxietyScore > 70) return 'L2 준비불안도';
      if (anxietyScore > 50) return 'L6 타이밍 손실회피';
      if (anxietyScore > 30) return 'L1 가격민감도';
      return 'L10 즉시 구매 결정';
    };

    const formatTimeDifference = (date: Date | null): string => {
      if (!date) return '미접촉';

      const diff = Date.now() - date.getTime();
      const minutes = Math.floor(diff / (1000 * 60));
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      if (minutes < 60) return `${minutes}분`;
      if (hours < 24) return `${hours}시간`;
      return `${days}일`;
    };

    const getCallDueTime = (priority: number): string => {
      if (priority === 999) return '지금';
      if (priority === 500) return '1시간 내';
      if (priority === 300) return '3시간 내';
      if (priority === 200) return '하루 내';
      return '2-3일 내';
    };

    // ───────────────────────────────────────────────────────
    // 모든 Contact에 대해 우선도 계산
    // ───────────────────────────────────────────────────────
    const callListWithPriority = contacts
      .map((contact) => {
        const lastSms = lastSmsMap.get(contact.id);
        const priority = calculatePriority(contact, lastSms);

        return {
          contactId: contact.id,
          name: contact.name || '(이름 없음)',
          phone: contact.phone || '(번호 없음)',
          priority,
          label:
            priority === 999
              ? '지금 전화!'
              : priority === 500
                ? '1시간 내 전화'
                : priority === 300
                  ? '3시간 내 전화'
                  : priority === 200
                    ? '하루 내 전화'
                    : '일반',
          reason:
            priority === 999
              ? 'SMS 1시간 내 열람'
              : priority === 500
                ? 'SMS 응답 있음'
                : priority === 300
                  ? '출발일 임박'
                  : '준비 불안 높음',
          lastSmsAt: lastSms?.sentAt ? new Date(lastSms.sentAt).toISOString() : null,
          lastSmsOpened: lastSms?.openedAt
            ? new Date(lastSms.openedAt).toISOString()
            : null,
          lastSmsResponse:
            priority === 500
              ? '(응답 있음)'
              : lastSms
                ? lastSms.contentPreview?.slice(0, 30) + '...'
                : null,
          nextAction: recommendNextAction(contact),
          psychologyLens: getPsychologyLens(contact),
          preparationLevel: contact.anxietyScore > 60 ? 'high_anxiety' : 'ready',
          anxietyScore: contact.anxietyScore || 0,
          timeSinceContact: formatTimeDifference(contact.lastContactedAt),
          callDueTime: getCallDueTime(priority),
        } as CallListItem;
      })
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 10);

    // ───────────────────────────────────────────────────────
    // 요약 통계
    // ───────────────────────────────────────────────────────
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const week7DaysAgo = new Date(today);
    week7DaysAgo.setDate(week7DaysAgo.getDate() - 7);

    const today_count = contacts.filter((c) => c.createdAt >= today && c.createdAt <= todayEnd)
      .length;

    const overdue_count = callListWithPriority.filter(
      (c) => c.priority === 999 || c.priority === 500
    ).length;

    const week_count = callListWithPriority.filter((c) => c.priority >= 300).length;

    return NextResponse.json({
      ok: true,
      callList: callListWithPriority,
      summary: {
        totalToCall: contacts.length,
        today: today_count,
        overdue: overdue_count,
        nextSevenDays: week_count,
      },
    });
  } catch (err) {
    console.error('[dashboard/call-list-priority]', err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : '서버 오류',
      },
      { status: 500 }
    );
  }
}
