export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/affiliate-managers
 * 대리점 관리자 목록 (OrganizationMember 기반)
 * role: BRANCH_MANAGER | OWNER
 *
 * 접근: GLOBAL_ADMIN 전용
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { enforceRBAC } from '@/app/api/_middleware/enforce-rbac';

type Row = {
  memberId: string;
  userId: string;
  phone: string | null;
  email: string | null;
  displayName: string | null;
  role: string;
  isActive: boolean;
  organizationId: string;
  organizationName: string;
  organizationPlan: string;
  organizationStatus: string;
  externalAffiliateProfileId: number | null;
  subMemberCount: bigint;
};

type AffRow = { id: number; affiliateCode: string | null; status: string };

export async function GET(req: NextRequest) {
  // ────────────────────────────────────────────────────────
  // RBAC: GLOBAL_ADMIN 전용 엔드포인트
  // ────────────────────────────────────────────────────────
  const rbacCheck = enforceRBAC(req, {
    allowedRoles: ['GLOBAL_ADMIN'],
    errorMessage: '관리자 권한이 필요합니다.',
  });
  if (rbacCheck !== true) return rbacCheck;

  try {
    const ctx = await getAuthContext();
    if (!ctx || ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() ?? '';
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = 50;
    const offset = (page - 1) * limit;

    // Prisma.sql 파라미터 바인딩으로 SQL 인젝션 구조적 차단
    const searchFragment = q
      ? Prisma.sql`AND (om."displayName" ILIKE ${'%' + q + '%'} OR om."userId" ILIKE ${'%' + q + '%'} OR om.phone ILIKE ${'%' + q + '%'} OR o.name ILIKE ${'%' + q + '%'})`
      : Prisma.empty;

    const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT
        om.id                           AS "memberId",
        om."userId",
        om.phone,
        om.email,
        om."displayName",
        om.role,
        om."isActive",
        om."organizationId",
        o.name                          AS "organizationName",
        o.plan                          AS "organizationPlan",
        o.status                        AS "organizationStatus",
        o."externalAffiliateProfileId",
        COUNT(sub.id)::bigint           AS "subMemberCount"
      FROM "OrganizationMember" om
      JOIN "Organization" o ON o.id = om."organizationId"
      LEFT JOIN "OrganizationMember" sub
        ON sub."organizationId" = om."organizationId"
        AND sub.role IN ('SALES_AGENT','FREE_SALES','PRE_SALES','AGENT')
        AND sub."isActive" = true
      WHERE om.role IN ('BRANCH_MANAGER','OWNER')
        ${searchFragment}
      GROUP BY
        om.id, om."userId", om.phone, om.email, om."displayName",
        om.role, om."isActive", om."organizationId",
        o.name, o.plan, o.status, o."externalAffiliateProfileId"
      ORDER BY o.name ASC
      LIMIT ${limit} OFFSET ${offset}
    `);

    // total 카운트
    const countRows = await prisma.$queryRaw<[{ total: bigint }]>(Prisma.sql`
      SELECT COUNT(DISTINCT om.id)::bigint AS total
      FROM "OrganizationMember" om
      JOIN "Organization" o ON o.id = om."organizationId"
      WHERE om.role IN ('BRANCH_MANAGER','OWNER')
        ${searchFragment}
    `);
    const total = Number(countRows[0]?.total ?? 0);

    // AffiliateProfile 연결 여부
    const profileIds = rows
      .map((r) => r.externalAffiliateProfileId)
      .filter((id): id is number => id != null);

    const profileMap: Record<number, AffRow> = {};
    if (profileIds.length > 0) {
      const profiles = await prisma.$queryRaw<AffRow[]>(Prisma.sql`
        SELECT id, "affiliateCode", status
        FROM "AffiliateProfile"
        WHERE id = ANY(${profileIds}::int[])
      `);
      for (const p of profiles) profileMap[p.id] = p;
    }

    logger.log('[GET /api/admin/affiliate-managers]', { total, role: ctx.role });

    return NextResponse.json({
      ok: true,
      data: {
        managers: rows.map((r) => {
          const extId = r.externalAffiliateProfileId;
          const profile = extId ? profileMap[extId] : null;
          return {
            memberId: r.memberId,
            userId: r.userId,
            phone: r.phone,
            email: r.email,
            displayName: r.displayName,
            role: r.role,
            isActive: r.isActive,
            organizationId: r.organizationId,
            organizationName: r.organizationName,
            organizationPlan: r.organizationPlan,
            organizationStatus: r.organizationStatus,
            subMemberCount: Number(r.subMemberCount),
            hasAffiliateProfile: !!profile,
            affiliateCode: profile?.affiliateCode ?? null,
            affiliateProfileId: extId ?? null,
          };
        }),
        total,
        page,
      },
    });
  } catch (err) {
    logger.error('[GET /api/admin/affiliate-managers]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
