export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

type Provider = 'KAKAO' | 'NAVER' | 'GOOGLE' | 'DIRECT';

type RawMember = {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  mallUserId: string | null;
  mallNickname: string | null;
  kakaoChannelAdded: boolean;
  createdAt: Date;
  isLocked: boolean;
  affiliateType: string | null;
  provider: Provider;
};

type RawCount = { total: bigint };

export async function GET(req: Request) {
  try {
    // 권한 확인 — GLOBAL_ADMIN 전용
    const session = await getMabizSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: '로그인이 필요합니다.' }, { status: 401 });
    }
    if (session.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    // Query Parameter 파싱
    const { searchParams } = new URL(req.url);

    const pageRaw = parseInt(searchParams.get('page') ?? '1', 10);
    const page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;

    const limitRaw = parseInt(searchParams.get('limit') ?? '30', 10);
    const limit = isNaN(limitRaw) || limitRaw < 1 ? 30 : Math.min(limitRaw, 100);

    const q = searchParams.get('q')?.trim() ?? '';
    const providerParam = searchParams.get('provider')?.trim().toUpperCase() ?? '';

    const offset = (page - 1) * limit;

    // provider 필터 조건 (Prisma.sql 템플릿 리터럴)
    const validProviders: Provider[] = ['KAKAO', 'NAVER', 'GOOGLE', 'DIRECT'];
    const isValidProvider = validProviders.includes(providerParam as Provider);

    // provider에 따른 mallUserId LIKE 조건
    let providerFilter: Prisma.Sql;
    if (isValidProvider) {
      if (providerParam === 'KAKAO') {
        providerFilter = Prisma.sql`AND u."mallUserId" LIKE 'kakao_%'`;
      } else if (providerParam === 'NAVER') {
        providerFilter = Prisma.sql`AND u."mallUserId" LIKE 'naver_%'`;
      } else if (providerParam === 'GOOGLE') {
        providerFilter = Prisma.sql`AND u."mallUserId" LIKE 'google_%'`;
      } else {
        // DIRECT: mallUserId가 NULL이거나 소셜 접두사가 없는 경우
        providerFilter = Prisma.sql`AND (
          u."mallUserId" IS NULL
          OR (
            u."mallUserId" NOT LIKE 'kakao_%'
            AND u."mallUserId" NOT LIKE 'naver_%'
            AND u."mallUserId" NOT LIKE 'google_%'
          )
        )`;
      }
    } else {
      providerFilter = Prisma.sql``;
    }

    // 검색 조건 (이름 또는 전화번호 ILIKE)
    let searchFilter: Prisma.Sql;
    if (q) {
      const likePattern = `%${q}%`;
      searchFilter = Prisma.sql`AND (u.name ILIKE ${likePattern} OR u.phone ILIKE ${likePattern})`;
    } else {
      searchFilter = Prisma.sql``;
    }

    // 회원 목록 조회
    const members = await prisma.$queryRaw<RawMember[]>(
      Prisma.sql`
        SELECT
          u.id,
          u.name,
          u.phone,
          u.email,
          u."mallUserId",
          u."mallNickname",
          u."kakaoChannelAdded",
          u."createdAt",
          u."isLocked",
          ap.type as "affiliateType",
          CASE
            WHEN u."mallUserId" LIKE 'kakao_%' THEN 'KAKAO'
            WHEN u."mallUserId" LIKE 'naver_%' THEN 'NAVER'
            WHEN u."mallUserId" LIKE 'google_%' THEN 'GOOGLE'
            ELSE 'DIRECT'
          END as provider
        FROM "User" u
        LEFT JOIN "AffiliateProfile" ap ON ap."userId" = u.id AND ap.status = 'ACTIVE'
        WHERE u.role = 'community'
          ${searchFilter}
          ${providerFilter}
        ORDER BY u."createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    );

    // 전체 건수 조회
    const countRows = await prisma.$queryRaw<RawCount[]>(
      Prisma.sql`
        SELECT COUNT(*) as total
        FROM "User" u
        WHERE u.role = 'community'
          ${searchFilter}
          ${providerFilter}
      `
    );

    const total = Number(countRows[0]?.total ?? 0);

    return NextResponse.json({
      ok: true,
      members,
      total,
      page,
      limit,
    });
  } catch (err) {
    logger.error('[GET /api/members]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
