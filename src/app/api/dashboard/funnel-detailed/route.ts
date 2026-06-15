export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';

/**
 * GET /api/dashboard/funnel-detailed
 *
 * Russell Brunson 퍼널 상세 추적 (5단계)
 * - Stage 1: Landing 신청 (Contact 생성)
 * - Stage 2: Email/SMS 발송 (SmsLog.sent = true)
 * - Stage 3: SMS 열람 (SmsLog.openedAt != null)
 * - Stage 4: SMS 응답 (Contact.lastContactedAt != null)
 * - Stage 5: 계약 완료 (ContractInstance.status = 'SIGNED')
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
    // 날짜 범위 설정 (어제~오늘)
    // ───────────────────────────────────────────────────────
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    // ───────────────────────────────────────────────────────
    // 역할별 필터 조건
    // ───────────────────────────────────────────────────────
    let contactFilter: any = { deletedAt: null };

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
    // Stage 1: Landing 신청 (Contact 생성)
    // ───────────────────────────────────────────────────────
    const stage1Count = await prisma.contact.count({
      where: {
        ...contactFilter,
        createdAt: { gte: yesterday, lte: todayEnd },
      },
    });

    const stage1CountYesterday = await prisma.contact.count({
      where: {
        ...contactFilter,
        createdAt: {
          gte: new Date(yesterday.getTime() - 24 * 60 * 60 * 1000),
          lte: new Date(yesterday.getTime() + 23 * 60 * 60 * 1000 + 59 * 60 * 1000 + 999),
        },
      },
    });

    // ───────────────────────────────────────────────────────
    // Stage 2: SMS 발송 (SmsLog 레코드 존재)
    // ───────────────────────────────────────────────────────
    let smsOrgFilter: any = {};
    if (ctx.role !== 'GLOBAL_ADMIN' && ctx.organizationId) {
      smsOrgFilter.organizationId = ctx.organizationId;
    }

    const smsLogBase = await prisma.smsLog.findMany({
      where: {
        ...smsOrgFilter,
        sentAt: { gte: yesterday, lte: todayEnd },
      },
      distinct: ['contactId'],
      select: { contactId: true },
    });

    const stage2Count = smsLogBase.filter((log) => log.contactId).length;

    const smsLogBaseYesterday = await prisma.smsLog.findMany({
      where: {
        ...smsOrgFilter,
        sentAt: {
          gte: new Date(yesterday.getTime() - 24 * 60 * 60 * 1000),
          lte: new Date(yesterday.getTime() + 23 * 60 * 60 * 1000 + 59 * 60 * 1000 + 999),
        },
      },
      distinct: ['contactId'],
      select: { contactId: true },
    });

    const stage2CountYesterday = smsLogBaseYesterday.filter((log) => log.contactId).length;

    // ───────────────────────────────────────────────────────
    // Stage 3: SMS 열람 (SmsLog.openedAt != null)
    // ───────────────────────────────────────────────────────
    const stage3Count = await prisma.smsLog.count({
      where: {
        ...smsOrgFilter,
        openedAt: { not: null },
        sentAt: { gte: yesterday, lte: todayEnd },
      },
    });

    const stage3CountYesterday = await prisma.smsLog.count({
      where: {
        ...smsOrgFilter,
        openedAt: { not: null },
        sentAt: {
          gte: new Date(yesterday.getTime() - 24 * 60 * 60 * 1000),
          lte: new Date(yesterday.getTime() + 23 * 60 * 60 * 1000 + 59 * 60 * 1000 + 999),
        },
      },
    });

    // ───────────────────────────────────────────────────────
    // Stage 4: SMS 응답 (Contact.lastContactedAt != null)
    // ───────────────────────────────────────────────────────
    const stage4Count = await prisma.contact.count({
      where: {
        ...contactFilter,
        lastContactedAt: { gte: yesterday, lte: todayEnd },
      },
    });

    const stage4CountYesterday = await prisma.contact.count({
      where: {
        ...contactFilter,
        lastContactedAt: {
          gte: new Date(yesterday.getTime() - 24 * 60 * 60 * 1000),
          lte: new Date(yesterday.getTime() + 23 * 60 * 60 * 1000 + 59 * 60 * 1000 + 999),
        },
      },
    });

    // ───────────────────────────────────────────────────────
    // Stage 5: 계약 완료 (ContractInstance.status = 'SIGNED')
    // ───────────────────────────────────────────────────────
    let stage5Count = 0;
    let stage5CountYesterday = 0;

    if (ctx.role === 'GLOBAL_ADMIN') {
      stage5Count = await prisma.contractInstance.count({
        where: {
          signedAt: { gte: yesterday, lte: todayEnd },
        },
      });

      stage5CountYesterday = await prisma.contractInstance.count({
        where: {
          signedAt: {
            gte: new Date(yesterday.getTime() - 24 * 60 * 60 * 1000),
            lte: new Date(yesterday.getTime() + 23 * 60 * 60 * 1000 + 59 * 60 * 1000 + 999),
          },
        },
      });
    } else if (ctx.organizationId) {
      stage5Count = await prisma.contractInstance.count({
        where: {
          organizationId: ctx.organizationId,
          signedAt: { gte: yesterday, lte: todayEnd },
        },
      });

      stage5CountYesterday = await prisma.contractInstance.count({
        where: {
          organizationId: ctx.organizationId,
          signedAt: {
            gte: new Date(yesterday.getTime() - 24 * 60 * 60 * 1000),
            lte: new Date(yesterday.getTime() + 23 * 60 * 60 * 1000 + 59 * 60 * 1000 + 999),
          },
        },
      });
    }

    // ───────────────────────────────────────────────────────
    // 백분율 및 추세 계산
    // ───────────────────────────────────────────────────────
    const stage1Pct = 100;
    const stage2Pct = stage1Count > 0 ? Math.round((stage2Count / stage1Count) * 100) : 0;
    const stage3Pct = stage2Count > 0 ? Math.round((stage3Count / stage2Count) * 100) : 0;
    const stage4Pct = stage3Count > 0 ? Math.round((stage4Count / stage3Count) * 100) : 0;
    const stage5Pct = stage4Count > 0 ? Math.round((stage5Count / stage4Count) * 100) : 0;

    // 추세 계산 (어제 대비)
    const trend1 =
      stage1CountYesterday > 0
        ? ((stage1Count - stage1CountYesterday) / stage1CountYesterday) * 100
        : stage1Count > 0 ? 100 : 0;

    const trend2 =
      stage2CountYesterday > 0
        ? ((stage2Count - stage2CountYesterday) / stage2CountYesterday) * 100
        : stage2Count > 0 ? 100 : 0;

    const trend3 =
      stage3CountYesterday > 0
        ? ((stage3Count - stage3CountYesterday) / stage3CountYesterday) * 100
        : stage3Count > 0 ? 100 : 0;

    const trend4 =
      stage4CountYesterday > 0
        ? ((stage4Count - stage4CountYesterday) / stage4CountYesterday) * 100
        : stage4Count > 0 ? 100 : 0;

    const trend5 =
      stage5CountYesterday > 0
        ? ((stage5Count - stage5CountYesterday) / stage5CountYesterday) * 100
        : stage5Count > 0 ? 100 : 0;

    const formatTrend = (value: number) => {
      const sign = value > 0 ? '+' : '';
      return `${sign}${value.toFixed(1)}%`;
    };

    // ───────────────────────────────────────────────────────
    // 병목(Bottleneck) 감지
    // ───────────────────────────────────────────────────────
    const dropoffs = [
      {
        from: 'landing',
        to: 'sms_sent',
        loss: Math.max(0, stage1Count - stage2Count),
        fromCount: stage1Count,
        toCount: stage2Count,
      },
      {
        from: 'sms_sent',
        to: 'sms_opened',
        loss: Math.max(0, stage2Count - stage3Count),
        fromCount: stage2Count,
        toCount: stage3Count,
      },
      {
        from: 'sms_opened',
        to: 'responded',
        loss: Math.max(0, stage3Count - stage4Count),
        fromCount: stage3Count,
        toCount: stage4Count,
      },
      {
        from: 'responded',
        to: 'contracted',
        loss: Math.max(0, stage4Count - stage5Count),
        fromCount: stage4Count,
        toCount: stage5Count,
      },
    ];

    const bottleneck = dropoffs.reduce((max, d) => (d.loss > max.loss ? d : max));

    // ───────────────────────────────────────────────────────
    // 응답
    // ───────────────────────────────────────────────────────
    return NextResponse.json({
      ok: true,
      funnel: [
        {
          stage: 'landing',
          label: '신청',
          count: stage1Count,
          percentage: stage1Pct,
          trend: formatTrend(trend1),
        },
        {
          stage: 'sms_sent',
          label: '문자 발송',
          count: stage2Count,
          percentage: stage2Pct,
          trend: formatTrend(trend2),
        },
        {
          stage: 'sms_opened',
          label: '문자 열람',
          count: stage3Count,
          percentage: stage3Pct,
          trend: formatTrend(trend3),
        },
        {
          stage: 'responded',
          label: '응답 있음',
          count: stage4Count,
          percentage: stage4Pct,
          trend: formatTrend(trend4),
        },
        {
          stage: 'contracted',
          label: '계약 완료',
          count: stage5Count,
          percentage: stage5Pct,
          trend: formatTrend(trend5),
        },
      ],
      totalDropoff: Math.max(0, stage1Count - stage5Count),
      avgConversionRate: stage1Count > 0 ? `${stage5Pct}%` : '0%',
      bottleneck: `${bottleneck.from} → ${bottleneck.to}`,
      bottleneckDetails: bottleneck,
    });
  } catch (err) {
    console.error('[dashboard/funnel-detailed]', err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : '서버 오류',
      },
      { status: 500 }
    );
  }
}
