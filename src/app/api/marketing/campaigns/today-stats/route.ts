import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { startOfDay, endOfDay } from 'date-fns';
import { ExecutionStatus } from '@prisma/client';

/**
 * GET /api/marketing/campaigns/today-stats
 * 오늘 캠페인 발송 현황 조회
 * - 예정: 오늘 sendAt 시간인 DRAFT 또는 PENDING 캠페인 (SCHEDULED 상태는 스키마에 없음)
 * - 진행중: 현재 발송 중인 캠페인 (SENDING 상태, sentCount < totalCount)
 * - 완료: 오늘 발송 완료한 캠페인 (SENT 상태)
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, message: '이 기능을 사용할 권한이 없어요.' }, { status: 403 });
    }

    // non-GLOBAL_ADMIN인데 organizationId가 없으면 (onboarding 미완료 계정 등) 403 반환
    if (ctx.role !== 'GLOBAL_ADMIN' && !ctx.organizationId) {
      return NextResponse.json(
        { ok: false, message: '조직 정보가 없어요. 관리자에게 문의해주세요.' },
        { status: 403 }
      );
    }

    // ── 권한 로직: organizationId 파라미터 처리 (관리자가 특정 조직 선택)
    let orgIdFilter: string | null = null;
    const selectedOrgIdParam = new URL(req.url).searchParams.get('organizationId');

    if (ctx.role === 'OWNER') {
      // 대리점장: 자신의 조직만 조회
      orgIdFilter = ctx.organizationId || null;
    } else if (ctx.role === 'GLOBAL_ADMIN') {
      if (selectedOrgIdParam) {
        // 관리자가 특정 조직 선택
        const org = await prisma.organization.findUnique({
          where: { id: selectedOrgIdParam },
          select: { id: true },
        });
        if (!org) {
          return NextResponse.json({ ok: false, message: '유효하지 않은 조직입니다.' }, { status: 403 });
        }
        orgIdFilter = org.id;
      } else {
        // 관리자가 organizationId 없으면 전체 조직 데이터 조회
        orgIdFilter = null;
      }
    } else {
      // OWNER/AGENT
      orgIdFilter = ctx.organizationId || null;
    }

    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    const baseWhere = {
      sendAt: {
        gte: todayStart,
        lte: todayEnd,
      },
    };

    // branchManagerId 파라미터 또는 organizationId로 필터
    const campaignWhere = orgIdFilter
      ? { ...baseWhere, organizationId: orgIdFilter }
      : baseWhere;

    const logWhere = orgIdFilter
      ? {
          organizationId: orgIdFilter,
          sourceType: 'CAMPAIGN' as const,
          campaignId: { not: null },
          scheduledAt: {
            gte: todayStart,
            lte: todayEnd,
          },
        }
      : {
          sourceType: 'CAMPAIGN' as const,
          campaignId: { not: null },
          scheduledAt: {
            gte: todayStart,
            lte: todayEnd,
          },
        };

    // 1. 오늘 예약된 캠페인 중 아직 발송 대기 중인 것
    const scheduledToday = await prisma.crmMarketingCampaign.count({
      where: {
        ...campaignWhere,
        status: { in: ['DRAFT', 'PENDING'] },
      },
    });

    // 2. 발송 진행 중 (ExecutionLog에서 일부는 SENT, 일부는 PENDING)
    // [API-TODAY-STATS-SENDING-FILTER-001] SENDING 쿼리에서 sendAt 범위 필터 제거
    // — 어제 시작해 자정을 넘긴 캠페인도 inProgress에 포함되어야 함
    // [DB-TODAY-STATS-INPROGRESS-STUCK-001] totalCount=0 stuck 방지: updatedAt 기준 30분 이내만 포함
    // [DB-TODAY-STATS-STALE-THRESHOLD-NO-DB-FILTER-001]
    // updatedAt 필터를 DB 레벨에서 적용해 GLOBAL_ADMIN의 전체 SENDING 캠페인 full-scan 방지.
    // Prisma StringFilter.in은 mutable string[]을 요구하므로 변수로 선언해 readonly 타입 오류 방지.
    const staleThreshold = new Date(Date.now() - 30 * 60 * 1000);
    const sendingStatusFilter: string[] = ['SENDING'];
    const sendingWhere = orgIdFilter
      ? { status: { in: sendingStatusFilter }, organizationId: orgIdFilter, updatedAt: { gte: staleThreshold } }
      : { status: { in: sendingStatusFilter }, updatedAt: { gte: staleThreshold } };
    const campaigns = await prisma.crmMarketingCampaign.findMany({
      where: sendingWhere,
      select: {
        id: true,
        totalCount: true,
        sentCount: true,
        updatedAt: true,
      },
    });

    // DB에서 staleThreshold 이전 캠페인이 이미 필터링됨.
    // totalCount=0인 캠페인(초기화 직후)은 준비 중으로 간주하고 inProgress에서 제외.
    const inProgress = campaigns.filter(c =>
      c.totalCount > 0 ? c.sentCount < c.totalCount : false
    ).length;

    // 3. 오늘 완료한 캠페인 — status: SENT 기준으로 정확히 계산
    const completedToday = await prisma.crmMarketingCampaign.count({
      where: {
        ...campaignWhere,
        status: 'SENT',
      },
    });

    // 더 정확한 완료 통계를 위해 ExecutionLog에서 SENT 건수
    const completedExecutions = await prisma.executionLog.count({
      where: {
        ...logWhere,
        status: ExecutionStatus.SENT,
      },
    });

    // 전체 예정된 발송건 중 완료된 비율로 계산
    const totalExecutionLogsToday = await prisma.executionLog.count({
      where: logWhere,
    });

    return NextResponse.json({
      ok: true,
      scheduledToday,
      inProgress,
      completedToday,
      // 추가 통계 (운영용)
      totalExecutedToday: completedExecutions,
      totalPendingToday: Math.max(0, totalExecutionLogsToday - completedExecutions),
    });
  } catch (err) {
    logger.error('[GET /api/marketing/campaigns/today-stats]', { err });
    return NextResponse.json({ ok: false, message: '통계 조회 실패' }, { status: 500 });
  }
}
