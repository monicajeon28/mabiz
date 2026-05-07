import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

type MemberRow = {
  userId: string;
  displayName: string | null;
  role: string;
  isActive: boolean;
  phone: string | null;
  isGoldMember: boolean;
  goldMemberSince: Date | null;
};

// GET /api/org/members
// 조직 전체 팀원 목록 (OWNER+GLOBAL_ADMIN만 조회 가능)
// 골드회원 겸직 여부를 LEFT JOIN으로 실시간 확인 (ProductInquiry 공유 DB)
export async function GET() {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    if (ctx.role !== 'OWNER' && ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const rows = await prisma.$queryRaw<MemberRow[]>(Prisma.sql`
      SELECT
        m."userId",
        m."displayName",
        m.role,
        m."isActive",
        m.phone,
        CASE WHEN pi.id IS NOT NULL THEN true ELSE false END AS "isGoldMember",
        pi."createdAt" AS "goldMemberSince"
      FROM "OrganizationMember" m
      LEFT JOIN "ProductInquiry" pi
        ON pi.phone = m.phone
        AND pi."productCode" = 'GOLD_MEMBERSHIP'
        AND pi.status = 'confirmed'
      WHERE m."organizationId" = ${orgId}
      ORDER BY m."isActive" DESC, m.role ASC
    `);

    const members = rows.map((r) => ({
      userId:          r.userId,
      displayName:     r.displayName,
      role:            r.role,
      isActive:        r.isActive,
      isGoldMember:    r.isGoldMember,
      goldMemberSince: r.goldMemberSince?.toISOString() ?? null,
    }));

    logger.log('[OrgMembers] 목록 조회', { orgId, count: members.length });
    return NextResponse.json({ ok: true, members });
  } catch (e) {
    logger.error('[OrgMembers GET]', { e });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
