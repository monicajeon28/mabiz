import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

function generateCode(): string {
  return randomBytes(4).toString('hex').substring(0, 6);
}

export async function GET(req: Request) {
  try {
    const ctx   = await getAuthContext();
    // 자기가 만든 링크만 조회 (GLOBAL_ADMIN 포함)
    const linksBase = await prisma.shortLink.findMany({
      where:   { createdBy: ctx.userId, isActive: true },
      orderBy: { createdAt: 'desc' },
      take:    100,
      select:  { id: true, code: true, title: true, targetUrl: true, category: true, createdAt: true, contactId: true, autoGroupId: true, createdBy: true },
    });

    // [P0 FIX #5] clickCount는 ShortLinkClick 테이블에서 동적 계산
    const links = await Promise.all(
      linksBase.map(async (link) => {
        const clickCount = await prisma.shortLinkClick.count({
          where: { linkId: link.id }
        });
        return {
          ...link,
          clickCount,
        };
      })
    );

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
        console.warn(`[WARNING] Non-localhost URL in DEV: ${h}`);
        // continue (허용하지만 경고)
      } else if (!isDev) {
        // PROD 환경: 엄격한 화이트리스트
        const allowedHosts = process.env.ALLOWED_DOMAINS?.split(',').map(d => d.trim()) || [
          'cruisedot.co.kr',
          'app.cruisedot.co.kr',
          'landing.cruisedot.co.kr',
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

    // 중복 없는 코드 확보 (최대 10회 재시도)
    let code = generateCode();
    for (let i = 0; i < 10; i++) {
      const exists = await prisma.shortLink.findUnique({ where: { code } });
      if (!exists) break;
      if (i === 9) {
        return NextResponse.json({ ok: false, message: '링크 생성 실패. 잠시 후 다시 시도해주세요.' }, { status: 500 });
      }
      code = generateCode();
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
        code = generateCode();
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
