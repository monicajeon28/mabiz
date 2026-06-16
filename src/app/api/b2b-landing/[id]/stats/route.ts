export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { checkOrigin } from '@/lib/origin-guard';
import { getCache, setCache } from '@/lib/redis';
import { NotFoundError, B2BError } from '@/lib/b2b/errors';

type Params = { params: Promise<{ id: string }> };

/**
 * B2B 랜딩페이지 통계 타입
 */
interface B2BStats {
  viewCount: number;
  registered: number;
  emailSent: number;
  funnelEntered: number;
  purchased: number;
  payappPayments: number;
  payappRevenue: number;
  rates: {
    visitToRegister: number;
    registerToEmail: number;
    registerToFunnel: number;
    funnelToPurchase: number;
    visitToPurchase: number;
  };
}

/**
 * GET /api/b2b-landing/[id]/stats
 * 5단 퍼널 지표 조회 (내 조직 소유 랜딩만)
 *
 * 반환:
 *   viewCount      - 방문 수 (B2BLandingPage.viewCount)
 *   registered     - 신청 수
 *   emailSent      - 이메일 발송 수 (신청자 → Contact → EmailLog)
 *   funnelEntered  - 퍼널 진입 수 (funnelStarted=true)
 *   purchased      - 구매 전환 수 (phone 조인 + purchasedAt IS NOT NULL)
 *   rates:         - 각 단계 전환율 %
 */
export async function GET(req: Request, { params }: Params) {
  const startTime = Date.now();
  try {
    if (!checkOrigin(req, 'B2BLandingStats')) {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const ctx   = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { id } = await params;

    // [캐싱] Redis에서 5분 TTL로 캐시된 통계 조회 (orgId 포함으로 조직 간 캐시 격리)
    const cacheKey = `b2b:stats:${orgId}:${id}`;
    const cachedStats = await getCache<{ ok: boolean; stats: B2BStats; title: string; note: Record<string, string> }>(cacheKey);
    if (cachedStats) {
      logger.log('[B2BLandingStats] 캐시에서 조회', { id, orgId });
      return NextResponse.json(cachedStats);
    }

    // [보안] 소유권 검증 (IDOR 방지)
    const page = await prisma.b2BLandingPage.findFirst({
      where:  { id, organizationId: orgId },
      select: { id: true, viewCount: true, title: true },
    });
    if (!page) {
      throw new NotFoundError('랜딩페이지');
    }

    // 등록 수 + 퍼널 진입 수 + 전화번호 목록 — 단일 쿼리
    const [regStats, regs] = await Promise.all([
      prisma.b2BLandingRegistration.groupBy({
        by:     ['funnelStarted'],
        where:  { landingPageId: id },
        _count: { id: true },
      }),
      prisma.b2BLandingRegistration.findMany({
        where:  { landingPageId: id },
        select: { phone: true },
      }),
    ]);

    const registered    = regStats.reduce((s, r) => s + r._count.id, 0);
    const funnelEntered = regStats.find(r => r.funnelStarted === true)?._count.id ?? 0;
    const phoneList     = regs.map(r => r.phone).filter(Boolean);

    // 이메일 발송 수 + 구매 전환 수 + PayApp 결제 — 병렬 처리
    let emailSent = 0;
    let purchased = 0;
    let payappPayments = 0;
    let payappRevenue = 0;

    // PayApp 결제 (landingPageId = B2B 페이지 ID, status = paid)
    const payappAgg = await prisma.payAppPayment.aggregate({
      where: { landingPageId: id, status: 'paid' },
      _count: { id: true },
      _sum:   { amount: true },
    });
    payappPayments = payappAgg._count.id;
    payappRevenue  = payappAgg._sum.amount ?? 0;

    if (phoneList.length > 0) {
      // phone → contactId 조인 (같은 조직)
      const contacts = await prisma.contact.findMany({
        where:  { organizationId: orgId, phone: { in: phoneList } },
        select: { id: true, purchasedAt: true },
      });

      purchased = contacts.filter(c => c.purchasedAt !== null).length;

      // 이메일 발송 수 병렬 처리
      if (contacts.length > 0) {
        const contactIds = contacts.map(c => c.id);
        emailSent = await prisma.emailLog.count({
          where: {
            organizationId: orgId,
            contactId: { in: contactIds },
            status: 'SENT',
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
      payappPayments,
      payappRevenue,
      rates: {
        visitToRegister:   toRate(registered,    page.viewCount),
        registerToEmail:   toRate(emailSent,     registered),
        registerToFunnel:  toRate(funnelEntered, registered),
        funnelToPurchase:  toRate(purchased,     funnelEntered),
        visitToPurchase:   toRate(purchased,     page.viewCount),
      },
    };

    logger.log('[GET /api/b2b-landing/[id]/stats] Success', {
      landingPageId: id,
      orgId,
      viewCount: page.viewCount,
      registered,
      emailSent,
      funnelEntered,
      purchased,
      payappPayments,
      payappRevenue,
      phoneListLength: phoneList.length,
      durationMs: Date.now() - startTime,
    });

    const response = {
      ok: true,
      stats,
      title: page.title,
      note: { purchased: 'phone 기반 근사치', emailSent: 'contactId 기반 — 해당 신청자에게 발송된 전체 이메일', payappPayments: 'PayApp 실결제 건수 (status=paid)', payappRevenue: 'PayApp 결제 누적 금액 (원)' },
    };

    // [캐싱] 응답을 5분 TTL로 Redis에 캐시
    await setCache(cacheKey, response, 300);

    return NextResponse.json(response);
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json(
        { ok: false, error: err.code, message: err.message },
        { status: err.statusCode }
      );
    }
    if (err instanceof B2BError) {
      return NextResponse.json(
        { ok: false, error: err.code, message: err.message },
        { status: err.statusCode }
      );
    }
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorCode =
      err instanceof Error && 'code' in err
        ? String((err as Record<string, unknown>).code)
        : 'UNKNOWN';
    logger.error('[GET /api/b2b-landing/[id]/stats] Error', {
      error: errorMsg,
      errorCode,
      stack: err instanceof Error ? err.stack?.split('\n').slice(0, 3).join('\n') : undefined,
    });
    return NextResponse.json(
      { ok: false, error: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
