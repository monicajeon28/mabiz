export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

/**
 * GET /api/partner/dashboard/gold?month=2026-05
 * 골드회원 대시보드 탭: 회원 통계 + 전월 대비 트렌드 + 최근 회원 + 최근 상담
 */
export async function GET(req: Request) {
  try {
    const ctx = await requirePartnerContext();
    if (!ctx) {
      logger.warn('[dashboard/gold] 인증 실패 - 세션 없음');
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get('month');
    const now = new Date();

    // 월 파라미터 파싱 (유효성 검증)
    let year = now.getFullYear();
    let month = now.getMonth() + 1;

    if (monthParam) {
      const parts = monthParam.split('-').map(Number);
      if (parts.length === 2 && parts[0] > 0 && parts[1] > 0 && parts[1] <= 12) {
        year = parts[0];
        month = parts[1];
      } else {
        logger.warn('[dashboard/gold] 유효하지 않은 month 파라미터', { monthParam });
      }
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);
    const prevStart = new Date(year, month - 2, 1);
    const prevEnd = startDate;

    const isAdmin = ctx.sessionUser.role === 'admin';
    const isAgent = ctx.sessionUser.role === 'agent';
    const orgId = isAdmin ? undefined : (ctx.organizationId ?? undefined);

    // AGENT(대리점장)는 본인 담당 골드회원만 조회 (list API /api/gold-members 와 동일 기준:
    // where.agentId = parseInt(ctx.userId)=CRM User.id). NaN이면 격리 불가 → 접근 차단.
    let agentId: number | undefined;
    if (isAgent) {
      const numericId = parseInt(ctx.sessionUser.crmUserId, 10);
      if (isNaN(numericId)) {
        logger.warn('[dashboard/gold] AGENT crmUserId 파싱 실패 → 접근 차단', { crmUserId: ctx.sessionUser.crmUserId });
        return NextResponse.json({ ok: false, error: '사용자 ID 오류' }, { status: 403 });
      }
      agentId = numericId;
    }

    const orgFilter = isAdmin
      ? {}
      : { organizationId: orgId, ...(isAgent ? { agentId } : {}) };
    const consultOrgFilter = isAdmin
      ? {}
      : { organizationId: orgId, ...(isAgent ? { agentId } : {}) };

    // GoldMember 테이블 존재 여부 확인 (마이그레이션 미적용 환경 대비)
    try {
      await prisma.goldMember.count({ where: { id: 'probe_non_existent_record_12345' } });
    } catch (tableError: unknown) {
      const errMsg = (tableError as any)?.message || String(tableError);
      if (errMsg.includes('does not exist') || errMsg.includes('GoldMember')) {
        logger.warn('[gold dashboard] GoldMember 테이블 없음 - 빈 데이터 반환', { error: errMsg });
        return NextResponse.json({
          ok: true,
          memberCount: 0,
          memberGrowth: 0,
          newInquiryCount: 0,
          inquiryGrowth: 0,
          paymentRate: 0,
          paymentRateChange: 0,
          recentMembers: [],
          recentConsultations: [],
        });
      }
      // 다른 에러는 계속 진행 (select 권한 없음 등)
    }

    // ── 1) 골드회원 수 + 상담 수 (현재 + 전월 병렬) ──
    const [
      memberCount, prevMemberCount,
      newInquiryCount, prevInquiryCount,
    ] = await Promise.all([
      prisma.goldMember.count({ where: { ...orgFilter, status: 'ACTIVE' } }),
      prisma.goldMember.count({
        where: { ...orgFilter, status: 'ACTIVE', createdAt: { lt: prevEnd } },
      }),
      prisma.goldMemberConsultation.count({
        where: { createdAt: { gte: startDate, lt: endDate }, goldMember: consultOrgFilter },
      }),
      prisma.goldMemberConsultation.count({
        where: { createdAt: { gte: prevStart, lt: prevEnd }, goldMember: consultOrgFilter },
      }),
    ]).catch((err) => {
      logger.error('[gold dashboard] 병렬 쿼리 실패', { error: (err as any)?.message });
      throw err;
    });

    // ── 납부율: SQL 집계 사용 (성능 최적화: findMany+reduce 제거) ──
    let paymentRate = 0;
    let prevPaymentRate = 0;

    if (isAdmin) {
      const result = await prisma.$queryRaw<Array<{ rate: number | null }>>`
        SELECT CASE WHEN COUNT(*) = 0 THEN 0
          ELSE ROUND((AVG("paidCount"::float / NULLIF("totalPayments", 0)) * 100)::numeric, 2)
        END AS rate
        FROM "GoldMember"
        WHERE "status" = 'ACTIVE' AND "totalPayments" > 0
      `;
      // Array.isArray 체크 + 안전한 접근
      paymentRate = result && Array.isArray(result) && result.length > 0
        ? Number(result[0]?.rate ?? 0)
        : 0;
    } else if (orgId) {
      // AGENT면 본인 담당(agentId)만, OWNER면 조직 전체
      const agentClause = isAgent && agentId !== undefined
        ? Prisma.sql`AND "agentId" = ${agentId}`
        : Prisma.empty;
      const result = await prisma.$queryRaw<Array<{ rate: number | null }>>`
        SELECT CASE WHEN COUNT(*) = 0 THEN 0
          ELSE ROUND((AVG("paidCount"::float / NULLIF("totalPayments", 0)) * 100)::numeric, 2)
        END AS rate
        FROM "GoldMember"
        WHERE "status" = 'ACTIVE' AND "totalPayments" > 0
          AND "organizationId" = ${orgId}
          ${agentClause}
      `;
      // Array.isArray 체크 + 안전한 접근
      paymentRate = result && Array.isArray(result) && result.length > 0
        ? Number(result[0]?.rate ?? 0)
        : 0;
    }

    // ── 2) 최근 회원 10건 (프론트 타입에 맞게 매핑) ──
    const recentMembersRaw = await prisma.goldMember.findMany({
      where: orgFilter,
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const members = recentMembersRaw.map((m) => ({
      id: m.id,
      name: m.name,
      course: m.courseType,
      paidCount: m.paidCount,
      totalCount: m.totalPayments,
      status: m.status,
    }));

    // ── 3) 최근 상담 5건 (프론트 타입에 맞게 매핑) ──
    const recentConsRaw = await prisma.goldMemberConsultation.findMany({
      where: { goldMember: consultOrgFilter },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { goldMember: { select: { name: true, memberCode: true } } },
    });

    const recentConsultations = recentConsRaw.map((c) => ({
      id: c.id,
      memberName: c.goldMember.name,
      content: c.content,
      date: c.createdAt.toISOString().slice(0, 10),
    }));

    // ── 트렌드 ──
    const calcTrend = (curr: number, prev: number) =>
      prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);

    logger.log('[dashboard/gold] 조회 완료', {
      orgId: ctx.organizationId,
      month: `${year}-${String(month).padStart(2, '0')}`,
    });

    return NextResponse.json({
      ok: true,
      data: {
        goldMemberCount: memberCount,
        newInquiries: newInquiryCount,
        paymentRate,
        members,
        recentConsultations,
        trends: {
          goldMemberCount: calcTrend(memberCount, prevMemberCount),
          newInquiries: calcTrend(newInquiryCount, prevInquiryCount),
          paymentRate: 0, // 납부율은 비율이라 트렌드 불필요
        },
      },
    });
  } catch (error) {
    const err = error as Record<string, unknown>;
    logger.error('[dashboard/gold] 오류', { message: err.message, stack: err.stack });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}

