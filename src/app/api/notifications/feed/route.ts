export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * GET /api/notifications/feed
 *
 * 여러 테이블의 이벤트를 UNION ALL 단일 쿼리로 병합해 반환하는 통합 알림 API.
 *
 * Query params:
 *   since  (선택) ISO8601 타임스탬프. 없으면 최근 24시간.
 *   limit  (선택) 기본 30, 최대 50.
 *
 * Response: { ok: true; items: FeedItem[]; total: number }
 */

type FeedItem = {
  id: string;
  type: 'LANDING_REG' | 'SALE_PENDING' | 'GOLD_INQUIRY' | 'B2B_LEAD' | 'NEW_CONTACT' | 'ORG_CONTRACT' | 'CALL_DUE';
  name: string;
  phone: string | null;
  detail: string | null;
  amount: number | null;
  linkPath: string;
  createdAt: string;
};

// Raw row returned from the UNION ALL query
type RawFeedRow = {
  type: string;
  id: string;
  name: string;
  phone: string | null;
  detail: string | null;
  amount: bigint | null;
  link_path: string;
  created_at: Date;
};

const LINK_PATH: Record<string, string> = {
  LANDING_REG:  '/contacts',
  SALE_PENDING: '/affiliate-sales',
  GOLD_INQUIRY: '/gold-inquiries',
  B2B_LEAD:     '/b2b',
  NEW_CONTACT:  '/contacts',
  ORG_CONTRACT: '/admin/organizations',
  CALL_DUE:     '/contacts',
};

function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  const d = phone.replace(/\D/g, '');
  return d.length >= 8 ? d.slice(0, 4) + '****' : phone.slice(0, 2) + '****';
}

export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();

    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, message: '접근 권한 없음' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);

    // --- since 파라미터 파싱/검증 ---
    const sinceParam = searchParams.get('since');
    let sinceDate: Date;
    if (sinceParam) {
      sinceDate = new Date(sinceParam);
      if (isNaN(sinceDate.getTime())) {
        return NextResponse.json(
          { ok: false, message: 'since 파라미터가 올바른 ISO 날짜가 아닙니다' },
          { status: 400 },
        );
      }
    } else {
      sinceDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    }

    // --- limit 파라미터 ---
    const limitParam = searchParams.get('limit');
    const limit = Math.min(50, Math.max(1, parseInt(limitParam ?? '30') || 30));

    // ──────────────────────────────────────────────────────────────────
    // 역할별 UNION ALL 서브쿼리 조립
    // ──────────────────────────────────────────────────────────────────
    const parts: Prisma.Sql[] = [];

    if (ctx.role === 'GLOBAL_ADMIN') {
      // ── LANDING_REG (전체) ──
      parts.push(Prisma.sql`
        SELECT
          'LANDING_REG'::text         AS type,
          r.id::text                  AS id,
          r.name                      AS name,
          r.phone                     AS phone,
          lp.title                    AS detail,
          NULL::bigint                AS amount,
          '/contacts'::text           AS link_path,
          r."createdAt"               AS created_at
        FROM "CrmLandingRegistration" r
        JOIN "CrmLandingPage" lp ON lp.id = r."landingPageId"
        WHERE r."createdAt" >= ${sinceDate}
      `);

      // ── SALE_PENDING (전체, CRM 자체 AffiliateSale) ──
      parts.push(Prisma.sql`
        SELECT
          'SALE_PENDING'::text                                    AS type,
          als.id                                                  AS id,
          COALESCE(als."customerPhone", als."affiliateCode", '판매건') AS name,
          NULL::text                                              AS phone,
          als."productName"                                       AS detail,
          als."saleAmount"::bigint                                AS amount,
          '/affiliate-sales'::text                                AS link_path,
          als."createdAt"                                         AS created_at
        FROM "CrmAffiliateSale" als
        WHERE als.status = 'PENDING'
          AND als."createdAt" >= ${sinceDate}
      `);

      // ── GOLD_INQUIRY: ProductInquiry 테이블은 이 DB에 없으므로 제외 ──

      // ── B2B_LEAD (status='NEW', 전체) ──
      parts.push(Prisma.sql`
        SELECT
          'B2B_LEAD'::text             AS type,
          b.id::text                   AS id,
          b."customerName"             AS name,
          b."customerPhone"            AS phone,
          b.source                     AS detail,
          NULL::bigint                 AS amount,
          '/b2b'::text                 AS link_path,
          b."createdAt"                AS created_at
        FROM "AffiliateLead" b
        WHERE b.status = 'NEW'
          AND b."createdAt" >= ${sinceDate}
      `);

      // ── NEW_CONTACT (전체) ──
      parts.push(Prisma.sql`
        SELECT
          'NEW_CONTACT'::text          AS type,
          c.id::text                   AS id,
          c.name                       AS name,
          c.phone                      AS phone,
          NULL::text                   AS detail,
          NULL::bigint                 AS amount,
          '/contacts'::text            AS link_path,
          c."createdAt"                AS created_at
        FROM "Contact" c
        WHERE c."createdAt" >= ${sinceDate}
      `);

      // ── ORG_CONTRACT (신규 조직) ──
      parts.push(Prisma.sql`
        SELECT
          'ORG_CONTRACT'::text         AS type,
          o.id::text                   AS id,
          o.name                       AS name,
          NULL::text                   AS phone,
          o."contractRef"              AS detail,
          NULL::bigint                 AS amount,
          '/admin/organizations'::text AS link_path,
          o."createdAt"                AS created_at
        FROM "Organization" o
        WHERE o."createdAt" >= ${sinceDate}
      `);

      // ── CALL_DUE (오늘 콜 예정) ──
      parts.push(Prisma.sql`
        SELECT
          'CALL_DUE'::text             AS type,
          cl.id::text                  AS id,
          c.name                       AS name,
          c.phone                      AS phone,
          cl."nextAction"              AS detail,
          NULL::bigint                 AS amount,
          ('/contacts/' || c.id)::text AS link_path,
          cl."scheduledAt"             AS created_at
        FROM "CallLog" cl
        JOIN "Contact" c ON c.id = cl."contactId"
        WHERE (cl."scheduledAt"::date) = (NOW() AT TIME ZONE 'Asia/Seoul')::date
      `);

    } else if (ctx.role === 'OWNER') {
      const orgId = ctx.organizationId!;

      // ── LANDING_REG (조직 랜딩페이지) ──
      parts.push(Prisma.sql`
        SELECT
          'LANDING_REG'::text         AS type,
          r.id::text                  AS id,
          r.name                      AS name,
          r.phone                     AS phone,
          lp.title                    AS detail,
          NULL::bigint                AS amount,
          '/contacts'::text           AS link_path,
          r."createdAt"               AS created_at
        FROM "CrmLandingRegistration" r
        JOIN "CrmLandingPage" lp ON lp.id = r."landingPageId"
        WHERE lp."organizationId" = ${orgId}
          AND r."createdAt" >= ${sinceDate}
      `);

      // ── SALE_PENDING (OWNER: 조직 기준) ──
      parts.push(Prisma.sql`
        SELECT
          'SALE_PENDING'::text                                    AS type,
          als.id                                                  AS id,
          COALESCE(als."customerPhone", als."affiliateCode", '판매건') AS name,
          NULL::text                                              AS phone,
          als."productName"                                       AS detail,
          als."saleAmount"::bigint                                AS amount,
          '/affiliate-sales'::text                                AS link_path,
          als."createdAt"                                         AS created_at
        FROM "CrmAffiliateSale" als
        WHERE als."organizationId" = ${orgId}
          AND als.status = 'PENDING'
          AND als."createdAt" >= ${sinceDate}
      `);

      // ── GOLD_INQUIRY: ProductInquiry 테이블은 이 DB에 없으므로 제외 ──

      // ── B2B_LEAD (조직 필터) ──
      parts.push(Prisma.sql`
        SELECT
          'B2B_LEAD'::text             AS type,
          b.id::text                   AS id,
          b."customerName"             AS name,
          b."customerPhone"            AS phone,
          b.source                     AS detail,
          NULL::bigint                 AS amount,
          '/b2b'::text                 AS link_path,
          b."createdAt"                AS created_at
        FROM "AffiliateLead" b
        WHERE b.status = 'NEW'
          AND b."createdAt" >= ${sinceDate}
      `);

      // ── NEW_CONTACT (조직 필터) ──
      parts.push(Prisma.sql`
        SELECT
          'NEW_CONTACT'::text          AS type,
          c.id::text                   AS id,
          c.name                       AS name,
          c.phone                      AS phone,
          NULL::text                   AS detail,
          NULL::bigint                 AS amount,
          '/contacts'::text            AS link_path,
          c."createdAt"                AS created_at
        FROM "Contact" c
        WHERE c."organizationId" = ${orgId}
          AND c."createdAt" >= ${sinceDate}
      `);

      // ── CALL_DUE (조직 필터, 모든 콜) ──
      parts.push(Prisma.sql`
        SELECT
          'CALL_DUE'::text             AS type,
          cl.id::text                  AS id,
          c.name                       AS name,
          c.phone                      AS phone,
          cl."nextAction"              AS detail,
          NULL::bigint                 AS amount,
          ('/contacts/' || c.id)::text AS link_path,
          cl."scheduledAt"             AS created_at
        FROM "CallLog" cl
        JOIN "Contact" c ON c.id = cl."contactId"
        WHERE c."organizationId" = ${orgId}
          AND (cl."scheduledAt"::date) = (NOW() AT TIME ZONE 'Asia/Seoul')::date
      `);

    } else {
      // AGENT
      const orgId = ctx.organizationId!;

      // ── LANDING_REG (조직 랜딩페이지) ──
      parts.push(Prisma.sql`
        SELECT
          'LANDING_REG'::text         AS type,
          r.id::text                  AS id,
          r.name                      AS name,
          r.phone                     AS phone,
          lp.title                    AS detail,
          NULL::bigint                AS amount,
          '/contacts'::text           AS link_path,
          r."createdAt"               AS created_at
        FROM "CrmLandingRegistration" r
        JOIN "CrmLandingPage" lp ON lp.id = r."landingPageId"
        WHERE lp."organizationId" = ${orgId}
          AND r."createdAt" >= ${sinceDate}
      `);

      // ── SALE_PENDING (AGENT: affiliateUserId 기준) ──
      parts.push(Prisma.sql`
        SELECT
          'SALE_PENDING'::text                                    AS type,
          als.id                                                  AS id,
          COALESCE(als."customerPhone", als."affiliateCode", '판매건') AS name,
          NULL::text                                              AS phone,
          als."productName"                                       AS detail,
          als."saleAmount"::bigint                                AS amount,
          '/affiliate-sales'::text                                AS link_path,
          als."createdAt"                                         AS created_at
        FROM "CrmAffiliateSale" als
        WHERE als."affiliateUserId" = ${ctx.userId}
          AND als.status = 'PENDING'
          AND als."createdAt" >= ${sinceDate}
      `);

      // ── GOLD_INQUIRY: ProductInquiry 테이블은 이 DB에 없으므로 제외 ──

      // ── NEW_CONTACT (담당자 배당 고객만) ──
      parts.push(Prisma.sql`
        SELECT
          'NEW_CONTACT'::text          AS type,
          c.id::text                   AS id,
          c.name                       AS name,
          c.phone                      AS phone,
          NULL::text                   AS detail,
          NULL::bigint                 AS amount,
          '/contacts'::text            AS link_path,
          c."createdAt"                AS created_at
        FROM "Contact" c
        WHERE c."organizationId" = ${orgId}
          AND c."assignedUserId" = ${ctx.userId}
          AND c."createdAt" >= ${sinceDate}
      `);

      // ── CALL_DUE (본인 콜로그만) ──
      parts.push(Prisma.sql`
        SELECT
          'CALL_DUE'::text             AS type,
          cl.id::text                  AS id,
          c.name                       AS name,
          c.phone                      AS phone,
          cl."nextAction"              AS detail,
          NULL::bigint                 AS amount,
          ('/contacts/' || c.id)::text AS link_path,
          cl."scheduledAt"             AS created_at
        FROM "CallLog" cl
        JOIN "Contact" c ON c.id = cl."contactId"
        WHERE cl."userId" = ${ctx.userId}
          AND (cl."scheduledAt"::date) = (NOW() AT TIME ZONE 'Asia/Seoul')::date
      `);
    }

    // parts가 0개인 경우 (OWNER/AGENT에 mallUser 없어서 SALE_PENDING만 빠진 경우 등은 이미 다른 parts가 있으므로 안전)
    // 단, 혹시라도 비어있으면 빈 결과 반환
    if (parts.length === 0) {
      return NextResponse.json({ ok: true, items: [], total: 0 });
    }

    const unionSql = Prisma.join(parts, ' UNION ALL ');

    const rows = await prisma.$queryRaw<RawFeedRow[]>(Prisma.sql`
      SELECT type, id, name, phone, detail, amount, link_path, created_at
      FROM (
        ${unionSql}
      ) sub
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);

    const items: FeedItem[] = rows.map((r) => ({
      id:        r.id,
      type:      r.type as FeedItem['type'],
      name:      r.name,
      phone:     maskPhone(r.phone),
      detail:    r.detail ?? null,
      amount:    r.amount != null ? Number(r.amount) : null,
      linkPath:  LINK_PATH[r.type] ?? '/',
      createdAt: r.created_at.toISOString(),
    }));

    logger.log('[GET /api/notifications/feed]', {
      role:  ctx.role,
      since: sinceDate.toISOString(),
      limit,
      count: items.length,
    });

    return NextResponse.json({ ok: true, items, total: items.length });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, message: '인증이 필요합니다' }, { status: 401 });
    }
    if (msg === 'FREE_SALES_NO_ACCESS') {
      return NextResponse.json({ ok: false, message: '접근 권한 없음' }, { status: 403 });
    }

    logger.error('[GET /api/notifications/feed]', { err });
    return NextResponse.json(
      { ok: false, message: '조회 중 오류가 발생했습니다' },
      { status: 500 },
    );
  }
}
