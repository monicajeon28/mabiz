export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

const SLUG_RE = /^[a-z0-9-]{3,50}$/;

/**
 * GET /api/affiliates/[id]/landing-slug
 * GLOBAL_ADMIN: 누구든 조회 가능
 * OWNER/AGENT:  본인 affiliateProfileId === id 인 경우만 (타인 조회 시 403)
 */
export async function GET(
  _req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

    const profileId = parseInt(context.params.id);
    if (isNaN(profileId) || profileId <= 0) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 ID' }, { status: 400 });
    }

    // OWNER/AGENT: 본인 프로필만 조회
    if (ctx.role !== 'GLOBAL_ADMIN') {
      const myProfileId = ctx.mallUser?.affiliateProfileId ?? null;
      if (myProfileId !== profileId) {
        return NextResponse.json({ ok: false, error: '권한 없음' }, { status: 403 });
      }
    }

    const rows = await prisma.$queryRaw<{ landingSlug: string | null; affiliateCode: string | null }[]>(
      Prisma.sql`
        SELECT ap."landingSlug", u."affiliateCode"
        FROM   "AffiliateProfile" ap
        JOIN   "User" u ON u.id = ap."userId"
        WHERE  ap.id = ${profileId}
        LIMIT  1
      `
    );

    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: '프로필을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      landingSlug:   rows[0].landingSlug,
      affiliateCode: rows[0].affiliateCode,
    });

  } catch (err) {
    logger.error('[GET /api/affiliates/landing-slug]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}

/**
 * PATCH /api/affiliates/[id]/landing-slug
 * GLOBAL_ADMIN: 누구든 수정 가능
 * OWNER/AGENT:  본인만 수정 가능
 * FREE_SALES:   403
 */
export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, error: '권한 없음' }, { status: 403 });
    }

    const profileId = parseInt(context.params.id);
    if (isNaN(profileId) || profileId <= 0) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 ID' }, { status: 400 });
    }

    // OWNER/AGENT: 본인만
    if (ctx.role !== 'GLOBAL_ADMIN') {
      const myProfileId = ctx.mallUser?.affiliateProfileId ?? null;
      if (myProfileId !== profileId) {
        return NextResponse.json({ ok: false, error: '권한 없음' }, { status: 403 });
      }
    }

    let slug: string;
    try {
      const body = await req.json() as { slug?: unknown };
      if (typeof body.slug !== 'string') {
        return NextResponse.json({ ok: false, error: 'slug 값이 필요합니다.' }, { status: 400 });
      }
      slug = body.slug;
    } catch {
      return NextResponse.json({ ok: false, error: '잘못된 요청 형식입니다.' }, { status: 400 });
    }

    if (!SLUG_RE.test(slug)) {
      return NextResponse.json(
        { ok: false, error: '슬러그는 소문자 영문·숫자·하이픈만 사용 가능하며, 3~50자여야 합니다.' },
        { status: 422 }
      );
    }

    // 중복 체크
    const dup = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
      SELECT id FROM "AffiliateProfile"
      WHERE  "landingSlug" = ${slug}
        AND  id <> ${profileId}
      LIMIT  1
    `);
    if (dup.length > 0) {
      return NextResponse.json({ ok: false, error: '이미 사용 중인 슬러그입니다.' }, { status: 409 });
    }

    const updated = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
      UPDATE "AffiliateProfile"
      SET    "landingSlug" = ${slug}
      WHERE  id = ${profileId}
      RETURNING id
    `);
    if (updated.length === 0) {
      return NextResponse.json({ ok: false, error: '프로필을 찾을 수 없습니다.' }, { status: 404 });
    }

    logger.log('[PATCH /api/affiliates/landing-slug]', { profileId, slug });
    return NextResponse.json({ ok: true, landingSlug: slug });

  } catch (err) {
    logger.error('[PATCH /api/affiliates/landing-slug]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
