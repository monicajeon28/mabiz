import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { generateUniqueShortlink } from '@/lib/landing-page-utils';

export async function GET(req: Request) {
  try {
    const ctx   = await getAuthContext();
    // ?deleted=1 이면 휴지통(삭제된=isActive:false) 조회 — 복원용
    const showDeleted = new URL(req.url).searchParams.get('deleted') === '1';
    // 자기가 만든 링크만 조회 (GLOBAL_ADMIN 포함)
    const linksBase = await prisma.shortLink.findMany({
      where:   { createdBy: ctx.userId, isActive: !showDeleted },
      orderBy: { createdAt: 'desc' },
      take:    100,
      select:  { id: true, code: true, title: true, targetUrl: true, category: true, createdAt: true, contactId: true, autoGroupId: true, createdBy: true },
    });

    // [P1-2 FIX] N+1 쿼리 → groupBy 최적화: Promise.all 제거, 단일 쿼리 + Map
    const clickCounts = await prisma.shortLinkClick.groupBy({
      by: ['linkId'],
      _count: { id: true },
      where: { linkId: { in: linksBase.map(l => l.id) } }
    });

    const clickMap = new Map(
      clickCounts.map(c => [c.linkId, c._count.id])
    );

    const links = linksBase.map(link => ({
      ...link,
      clickCount: clickMap.get(link.id) ?? 0
    }));

    return NextResponse.json({ ok: true, links });
  } catch (e) {
    logger.log('[Links GET] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const body  = await req.json() as { targetUrl: string; title?: string; category?: string; contactId?: string; autoGroupId?: string };

    if (!body.targetUrl) return NextResponse.json({ ok: false, message: 'targetUrl 필수' }, { status: 400 });

    // URL 유효성 + SSRF 방어 (개발환경 localhost 허용)
    const isDev = process.env.NODE_ENV === 'development';
    try {
      const parsed = new URL(body.targetUrl);
      const h = parsed.hostname || '';
      const isLocalhost = /^(localhost|127\.0\.0\.1|::1)$/i.test(h);

      // [P0 FIX #4] 명확한 조건 분기: DEV+localhost → 모든 URL 허용
      if (isDev && isLocalhost) {
        // DEV 환경 + localhost: 모든 URL 허용 (개발용)
        // continue (검증 스킵)
      } else if (isDev && !isLocalhost) {
        // DEV 환경이지만 localhost가 아니면: 경고만 (개발 편의성)
        logger.warn(`Non-localhost URL in DEV`, { hostname: h });
        // continue (허용하지만 경고)
      } else if (!isDev) {
        // PROD 환경: 엄격한 화이트리스트
        const allowedHosts = process.env.ALLOWED_DOMAINS?.split(',').map(d => d.trim()) || [
          'cruisedot.co.kr',
          'www.cruisedot.co.kr',
          'app.cruisedot.co.kr',
          'landing.cruisedot.co.kr',
          // CRM 운영 도메인 — 대리점장 봇/랜딩 개인 판매링크가 이 도메인을 가리킴(누락 시 링크 생성 차단)
          'mabizcruisedot.com',
          'www.mabizcruisedot.com',
        ];

        if (!allowedHosts.includes(h)) {
          return NextResponse.json(
            { ok: false, message: 'URL domain not whitelisted' },
            { status: 400 }
          );
        }

        // PROD: HTTPS 필수
        if (parsed.protocol !== 'https:') {
          return NextResponse.json({ ok: false, message: 'https URL만 허용됩니다' }, { status: 400 });
        }

        // PROD: 사설 IP 차단
        const isPrivate = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|localhost$)/i.test(h);
        if (isPrivate) {
          return NextResponse.json({ ok: false, message: '내부 네트워크 URL은 허용되지 않습니다' }, { status: 400 });
        }
      }
    } catch { return NextResponse.json({ ok: false, message: '유효하지 않은 URL' }, { status: 400 }); }

    // 중복 없는 코드 확보 (generateUniqueShortlink: 3회 재시도, nanoid(8))
    let code: string;
    try {
      code = await generateUniqueShortlink();
    } catch (err) {
      logger.error('[Links POST] 숏링크 생성 실패', { error: err instanceof Error ? err.message : String(err) });
      return NextResponse.json({ ok: false, message: '링크 생성 실패. 잠시 후 다시 시도해주세요.' }, { status: 500 });
    }

    // Race condition 방어: DB unique constraint 위반 시 새 코드로 1회 재시도
    let link;
    try {
      link = await prisma.shortLink.create({
        data: { organizationId: orgId, createdBy: ctx.userId, code, ...body },
        select: { id: true, code: true, targetUrl: true, title: true },
      });
    } catch (createErr) {
      const msg = createErr instanceof Error ? createErr.message : String(createErr);
      if (msg.includes('Unique constraint') || msg.includes('unique constraint')) {
        try {
          code = await generateUniqueShortlink();
        } catch {
          throw new Error('Failed to generate alternative shortlink');
        }
        link = await prisma.shortLink.create({
          data: { organizationId: orgId, createdBy: ctx.userId, code, ...body },
          select: { id: true, code: true, targetUrl: true, title: true },
        });
      } else {
        throw createErr;
      }
    }

    logger.log('[Links POST] 생성', { code, orgId });
    return NextResponse.json({ ok: true, link, shortUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/l/${link.code}` });
  } catch (e) {
    logger.log('[Links POST] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
