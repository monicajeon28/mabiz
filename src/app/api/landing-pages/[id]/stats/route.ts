export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthContext, resolveOrgIdOrNull } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/landing-pages/[id]/stats
 * 5단 퍼널 지표 조회 (내 조직 소유 랜딩만)
 *
 * 반환:
 *   viewCount      - 방문 수 (CrmLandingPage.viewCount)
 *   registered     - 신청 수
 *   emailSent      - 이메일 발송 수 (신청자 → Contact → EmailLog)
 *   funnelEntered  - 퍼널 진입 수 (funnelStarted=true)
 *   purchased      - 구매 전환 수 (phone 조인 + purchasedAt IS NOT NULL)
 *   rates:         - 각 단계 전환율 %
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = resolveOrgIdOrNull(ctx);
    const { id } = await params;

    // [보안] 소유권 검증 (IDOR 방지)
    const page = await prisma.crmLandingPage.findFirst({
      where:  { id, ...(orgId ? { organizationId: orgId } : {}) },
      select: { id: true, viewCount: true, title: true },
    });
    if (!page) {
      return NextResponse.json({ ok: false, message: '랜딩페이지를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 등록 수 + 퍼널 진입 수 + 전화번호 목록 — 단일 쿼리
    const [regStats, regs] = await Promise.all([
      prisma.crmLandingRegistration.groupBy({
        by:     ['funnelStarted'],
        where:  { landingPageId: id },
        _count: { id: true },
      }),
      prisma.crmLandingRegistration.findMany({
        where:  { landingPageId: id },
        select: { phone: true },
      }),
    ]);

    const registered    = regStats.reduce((s, r) => s + r._count.id, 0);
    const funnelEntered = regStats.find(r => r.funnelStarted === true)?._count.id ?? 0;
    const phoneList     = regs.map(r => r.phone).filter(Boolean);

    // 이메일 발송 수 + 구매 전환 수 — 병렬 처리
    let emailSent = 0;
    let purchased = 0;

    if (phoneList.length > 0) {
      // phone → contactId 조인 (같은 조직)
      const contacts = await prisma.contact.findMany({
        where:  { ...(orgId ? { organizationId: orgId } : {}), phone: { in: phoneList } },
        select: { id: true, purchasedAt: true },
      });

      const contactIds = contacts.map(c => c.id);
      purchased = contacts.filter(c => c.purchasedAt !== null).length;

      // 신청자 contactId 기준 이메일 발송 수
      if (contactIds.length > 0) {
        emailSent = await prisma.emailLog.count({
          where: {
            ...(orgId ? { organizationId: orgId } : {}),
            contactId:      { in: contactIds },
            status:         'SENT',
          },
        });
      }
    }

    // 전환율 계산 (0 나누기 방지)
    const toRate = (num: number, den: number) =>
      den > 0 ? parseFloat((num / den * 100).toFixed(1)) : 0;

    const stats = {
      viewCount: page.viewCount,
      registered,
      emailSent,
      funnelEntered,
      purchased,
      rates: {
        visitToRegister:   toRate(registered,    page.viewCount),
        registerToEmail:   toRate(emailSent,     registered),
        registerToFunnel:  toRate(funnelEntered, registered),
        funnelToPurchase:  toRate(purchased,     funnelEntered),
        visitToPurchase:   toRate(purchased,     page.viewCount),
      },
    };

    logger.log('[LandingStats] 조회', { id, orgId, ...stats });

    return NextResponse.json({
      ok: true,
      stats,
      title: page.title,
      note: { purchased: 'phone 기반 근사치', emailSent: 'contactId 기반 — 해당 신청자에게 발송된 전체 이메일' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('401') || msg.includes('Unauthorized')) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    logger.error('[LandingStats] 조회 실패', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
