export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthContext, resolveOrgIdOrNull, canManageSettings } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

type LandingStats = {
  viewCount: number;
  registered: number;
  emailSent: number;
  funnelEntered: number;
  purchased: number;
  rates: {
    visitToRegister: number;
    registerToEmail: number;
    registerToFunnel: number;
    funnelToPurchase: number;
    visitToPurchase: number;
  };
};

/**
 * POST /api/landing-pages/batch-stats
 * 여러 랜딩페이지의 통계를 한번에 조회 (N+1 방지)
 *
 * 요청:
 *   { pageIds: ["id1", "id2", ...] }
 *
 * 응답:
 *   {
 *     ok: true,
 *     stats: {
 *       "id1": { viewCount, registered, ... rates },
 *       "id2": { ... }
 *     }
 *   }
 */
export async function POST(req: Request) {
  try {
    const ctx   = await getAuthContext();
    // 랜딩페이지 통계는 대리점장(OWNER)·시스템관리자(GLOBAL_ADMIN) 전용 (P0-2)
    if (!canManageSettings(ctx)) {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN', message: '권한이 없습니다' }, { status: 403 });
    }
    const orgId = resolveOrgIdOrNull(ctx);
    const body  = await req.json();
    const { pageIds } = body;

    if (!Array.isArray(pageIds) || pageIds.length === 0) {
      return NextResponse.json({ ok: false, message: '페이지 ID 배열이 필요합니다.' }, { status: 400 });
    }

    if (pageIds.length > 200) {
      return NextResponse.json({ ok: false, message: 'pageIds는 최대 200개까지 가능합니다.' }, { status: 400 });
    }

    // [보안] 소유권 검증 (IDOR 방지)
    const pages = await prisma.crmLandingPage.findMany({
      where: { id: { in: pageIds }, ...(orgId ? { organizationId: orgId } : {}) },
      select: { id: true, viewCount: true, title: true },
    });

    if (pages.length === 0) {
      return NextResponse.json({ ok: false, message: '접근 가능한 랜딩페이지가 없습니다.' }, { status: 404 });
    }

    const validPageIds = pages.map(p => p.id);

    // 모든 등록자 정보 한 번에 조회
    const allRegs = await prisma.crmLandingRegistration.findMany({
      where: { landingPageId: { in: validPageIds } },
      select: { landingPageId: true, phone: true, funnelStarted: true },
    });

    // 페이지별로 그룹화
    const regsByPage: Record<string, { phone: string | null; funnelStarted: boolean }[]> = {};
    validPageIds.forEach(id => regsByPage[id] = []);
    allRegs.forEach(reg => regsByPage[reg.landingPageId].push(reg));

    // 모든 전화번호 수집 (중복 제거)
    const allPhones = [...new Set(allRegs.map(r => r.phone).filter(Boolean) as string[])];
    let phoneToContact: Record<string, { id: string; purchasedAt: Date | null }> = {};

    if (allPhones.length > 0) {
      const contacts = await prisma.contact.findMany({
        where: { ...(orgId ? { organizationId: orgId } : {}), phone: { in: allPhones } },
        select: { id: true, phone: true, purchasedAt: true },
      });
      phoneToContact = Object.fromEntries(contacts.map(c => [c.phone, { id: c.id, purchasedAt: c.purchasedAt }]));
    }

    // 모든 contactId 수집
    const allContactIds = Object.values(phoneToContact).map(c => c.id);
    let emailSentByContactId: Record<string, number> = {};

    if (allContactIds.length > 0) {
      const emailCounts = await prisma.emailLog.groupBy({
        by: ['contactId'],
        where: { ...(orgId ? { organizationId: orgId } : {}), contactId: { in: allContactIds }, status: 'SENT' },
        _count: { id: true },
      });
      emailCounts.forEach(ec => {
        if (ec.contactId) {
          emailSentByContactId[ec.contactId] = ec._count.id;
        }
      });
    }

    // 페이지별 통계 계산
    const stats: Record<string, LandingStats> = {};
    const toRate = (num: number, den: number) =>
      den > 0 ? parseFloat((num / den * 100).toFixed(1)) : 0;

    validPageIds.forEach(pageId => {
      const page = pages.find(p => p.id === pageId)!;
      const regs = regsByPage[pageId];

      const registered = regs.length;
      const funnelEntered = regs.filter(r => r.funnelStarted).length;

      let emailSent = 0;
      let purchased = 0;

      regs.forEach(reg => {
        if (reg.phone) {
          const contact = phoneToContact[reg.phone];
          if (contact) {
            if (contact.purchasedAt) purchased++;
            emailSent += emailSentByContactId[contact.id] ?? 0;
          }
        }
      });

      stats[pageId] = {
        viewCount: page.viewCount,
        registered,
        emailSent,
        funnelEntered,
        purchased,
        rates: {
          visitToRegister: toRate(registered, page.viewCount),
          registerToEmail: toRate(emailSent, registered),
          registerToFunnel: toRate(funnelEntered, registered),
          funnelToPurchase: toRate(purchased, funnelEntered),
          visitToPurchase: toRate(purchased, page.viewCount),
        },
      };
    });

    const foundIds = new Set(validPageIds);
    const notFound = pageIds.filter((id: string) => !foundIds.has(id));

    logger.log('[LandingBatchStats] 조회', { pageCount: validPageIds.length, notFoundCount: notFound.length, orgId });

    return NextResponse.json({
      ok: true,
      stats,
      ...(notFound.length > 0 ? { notFound } : {}),
    });
  } catch (err) {
    const isUnauth = err instanceof Error && err.message === 'UNAUTHORIZED';
    if (isUnauth) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    logger.error('[LandingBatchStats] 조회 실패', { err: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
