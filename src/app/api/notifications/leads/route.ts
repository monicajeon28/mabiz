export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * GET /api/notifications/leads?since=ISO_DATE
 *
 * 해당 조직의 랜딩페이지 신규 등록건 조회 (알림 벨용)
 * - since 파라미터: 마지막 확인 이후 건수 (프론트에서 localStorage에 저장한 시각)
 * - 미전달 시 기본 7일 이내 조회
 * - seenAt은 프론트 localStorage로 관리 (스키마 변경 없음)
 * - FREE_SALES는 접근 불가 (고객 DB 접근 권한 없음)
 *
 * Response: { ok: true, leads: Lead[], count: number }
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();

    // FREE_SALES: 고객 DB 접근 불가
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, message: '접근 권한 없음' }, { status: 403 });
    }

    // GLOBAL_ADMIN은 organizationId가 없으므로 별도 처리
    if (ctx.role === 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, message: '조직을 먼저 선택하세요' }, { status: 400 });
    }

    const orgId = requireOrgId(ctx);

    const { searchParams } = new URL(req.url);
    const since = searchParams.get('since');
    const sinceDate = since
      ? new Date(since)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 기본 7일

    // 날짜 유효성 검증
    if (isNaN(sinceDate.getTime())) {
      return NextResponse.json(
        { ok: false, message: 'since 파라미터가 올바른 ISO 날짜가 아닙니다' },
        { status: 400 }
      );
    }

    // 조직 소유 랜딩페이지 ID 목록
    const landingPages = await prisma.crmLandingPage.findMany({
      where:  { organizationId: orgId },
      select: { id: true, title: true },
    });

    if (landingPages.length === 0) {
      return NextResponse.json({ ok: true, leads: [], count: 0 });
    }

    const lpIds       = landingPages.map(lp => lp.id);
    const lpTitleMap  = new Map(landingPages.map(lp => [lp.id, lp.title]));

    const regs = await prisma.crmLandingRegistration.findMany({
      where: {
        landingPageId: { in: lpIds },
        createdAt:     { gte: sinceDate },
      },
      orderBy: { createdAt: 'desc' },
      take:    50,
      select: {
        id:            true,
        name:          true,
        phone:         true,
        landingPageId: true,
        createdAt:     true,
        funnelStarted: true,
      },
    });

    const leads = regs.map(r => ({
      id:               r.id,
      name:             r.name,
      phone:            r.phone.substring(0, 4) + '****', // 마스킹
      landingPageTitle: lpTitleMap.get(r.landingPageId) ?? '랜딩페이지',
      createdAt:        r.createdAt,
      funnelStarted:    r.funnelStarted,
    }));

    logger.log('[LeadNotifications] 조회', {
      orgId,
      since:  sinceDate.toISOString(),
      count:  leads.length,
    });

    return NextResponse.json({ ok: true, leads, count: leads.length });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    if (msg === 'NO_ORGANIZATION' || msg === 'ORGANIZATION_REQUIRED') {
      return NextResponse.json({ ok: false, message: '조직 정보 없음' }, { status: 403 });
    }

    logger.error('[GET /api/notifications/leads]', { err });
    return NextResponse.json({ ok: false, message: '조회 중 오류가 발생했습니다' }, { status: 500 });
  }
}
