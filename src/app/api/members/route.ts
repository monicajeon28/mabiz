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
  naverChannelAdded: boolean;
  googleChannelAdded: boolean;
  createdAt: Date;
  isLocked: boolean;
  affiliateType: string | null;
  provider: Provider;
  memberStatus: string | null;
  memberTags: string[];
};

type RawCount = { total: bigint };

/**
 * GET /api/members
 *
 * 일반 고객(role='user')만 필터링하여 반환
 *
 * 쿼리 파라미터:
 *   - page: 페이지 번호 (기본값: 1)
 *   - limit: 페이지당 건수 (기본값: 30, 최대: 100)
 *   - q: 이름 또는 전화번호 검색
 *   - provider: 가입 경로 필터 (KAKAO, NAVER, GOOGLE, DIRECT)
 *   - status: 회원 상태 필터 (잠재고객, 소통, 구매완료, VIP, 수신거부)
 *   - date: 가입 날짜 필터 (YYYY-MM-DD~YYYY-MM-DD 형식)
 *
 * 응답:
 *   {
 *     ok: boolean,
 *     members: RawMember[],
 *     total: number,
 *     page: number,
 *     limit: number,
 *     error?: string
 *   }
 */
export async function GET(req: Request) {
  const startTime = Date.now();

  try {
    // 권한 확인 — GLOBAL_ADMIN 전용 (최적화: 먼저 확인)
    const session = await getMabizSession();
    if (!session) {
      return NextResponse.json(
        { ok: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }
    if (session.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json(
        { ok: false, error: '권한이 없습니다.' },
        { status: 403 }
      );
    }

    // Query Parameter 파싱 (최적화: 정규식 제거, 직접 파싱)
    const url = new URL(req.url);
    const searchParams = url.searchParams;

    const pageRaw = parseInt(searchParams.get('page') ?? '1', 10);
    const page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;

    const limitRaw = parseInt(searchParams.get('limit') ?? '30', 10);
    const limit = isNaN(limitRaw) || limitRaw < 1 ? 30 : Math.min(limitRaw, 100);

    const q = searchParams.get('q')?.trim() ?? '';
    const providerParam = searchParams.get('provider')?.trim().toUpperCase() ?? '';
    const statusParam = searchParams.get('status')?.trim() ?? '';
    const dateParam = searchParams.get('date')?.trim() ?? '';

    const offset = (page - 1) * limit;

    // 타임아웃: 5초 (기본 10초에서 5초로 단축 → 빠른 응답)
    const timeoutDuration = 5000;

    // provider 필터 조건 (Prisma.sql 템플릿 리터럴)
    const validProviders: Provider[] = ['KAKAO', 'NAVER', 'GOOGLE', 'DIRECT'];
    const isValidProvider = validProviders.includes(providerParam as Provider);

    // provider 필터 조건 — socialProvider 필드 우선, mallUserId 보조
    let providerFilter: Prisma.Sql;
    if (isValidProvider) {
      if (providerParam === 'KAKAO') {
        providerFilter = Prisma.sql`AND (u."socialProvider" = 'kakao' OR u."mallUserId" LIKE 'kakao_%')`;
      } else if (providerParam === 'NAVER') {
        providerFilter = Prisma.sql`AND (u."socialProvider" = 'naver' OR u."mallUserId" LIKE 'naver_%')`;
      } else if (providerParam === 'GOOGLE') {
        providerFilter = Prisma.sql`AND (u."socialProvider" = 'google' OR u."mallUserId" LIKE 'google_%')`;
      } else {
        // DIRECT: socialProvider 없고 mallUserId 소셜 접두사도 없는 경우
        providerFilter = Prisma.sql`AND (
          (u."socialProvider" IS NULL OR u."socialProvider" = '')
          AND (
            u."mallUserId" IS NULL
            OR (
              u."mallUserId" NOT LIKE 'kakao_%'
              AND u."mallUserId" NOT LIKE 'naver_%'
              AND u."mallUserId" NOT LIKE 'google_%'
            )
          )
        )`;
      }
    } else {
      providerFilter = Prisma.sql``;
    }

    // 상태 필터 조건
    const validStatuses = ['잠재고객', '소통', '구매완료', 'VIP', '수신거부'];
    let statusFilter: Prisma.Sql;
    if (statusParam && validStatuses.includes(statusParam)) {
      statusFilter = Prisma.sql`AND u."memberStatus" = ${statusParam}`;
    } else {
      statusFilter = Prisma.sql``;
    }

    // 날짜 범위 필터 조건 (YYYY-MM-DD~YYYY-MM-DD)
    let dateFilter: Prisma.Sql;
    if (dateParam && dateParam.includes('~')) {
      const [startDate, endDate] = dateParam.split('~').map((d) => d.trim());
      if (startDate && endDate) {
        try {
          new Date(startDate);
          new Date(endDate);
          dateFilter = Prisma.sql`AND u."createdAt"::date BETWEEN ${startDate}::date AND ${endDate}::date`;
        } catch {
          dateFilter = Prisma.sql``;
        }
      } else {
        dateFilter = Prisma.sql``;
      }
    } else {
      dateFilter = Prisma.sql``;
    }

    // 검색 조건 (이름 또는 전화번호 ILIKE)
    let searchFilter: Prisma.Sql;
    if (q) {
      const likePattern = `%${q}%`;
      searchFilter = Prisma.sql`AND (u.name ILIKE ${likePattern} OR u.phone ILIKE ${likePattern})`;
    } else {
      searchFilter = Prisma.sql``;
    }

    // 회원 목록 조회 (일반 고객만: role = 'user')
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
          u."naverChannelAdded",
          u."googleChannelAdded",
          u."createdAt",
          u."isLocked",
          ap.type as "affiliateType",
          u."memberStatus",
          COALESCE(u."memberTags", ARRAY[]::text[]) as "memberTags",
          CASE
            WHEN u."socialProvider" = 'kakao' OR u."mallUserId" LIKE 'kakao_%' THEN 'KAKAO'
            WHEN u."socialProvider" = 'naver' OR u."mallUserId" LIKE 'naver_%' THEN 'NAVER'
            WHEN u."socialProvider" = 'google' OR u."mallUserId" LIKE 'google_%' THEN 'GOOGLE'
            ELSE 'DIRECT'
          END as provider
        FROM "User" u
        LEFT JOIN "AffiliateProfile" ap ON ap."userId" = u.id AND ap.status = 'ACTIVE'
        WHERE u.role = 'user'
          ${searchFilter}
          ${providerFilter}
          ${statusFilter}
          ${dateFilter}
        ORDER BY u."createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    );

    // 전체 건수 조회
    const countRows = await prisma.$queryRaw<RawCount[]>(
      Prisma.sql`
        SELECT COUNT(*) as total
        FROM "User" u
        WHERE u.role = 'user'
          ${searchFilter}
          ${providerFilter}
          ${statusFilter}
          ${dateFilter}
      `
    );

    const total = Number(countRows[0]?.total ?? 0);
    const duration = Date.now() - startTime;

    logger.info('[GET /api/members] 완료', {
      total,
      count: members.length,
      page,
      limit,
      durationMs: duration,
      filters: { q, provider: providerParam, status: statusParam, date: dateParam },
    });

    return NextResponse.json({
      ok: true,
      members,
      total,
      page,
      limit,
    });
  } catch (err: unknown) {
    logger.error('[GET /api/members]', { err });
    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
