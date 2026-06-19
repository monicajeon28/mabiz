export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

const ALLOWED_STATUSES = new Set(['DRAFT', 'SENT', 'SIGNED', 'EXPIRED', 'CANCELLED']);
const ALLOWED_TYPES    = new Set(['INITIAL', 'RENEWAL', 'TERMINATION']);

type RawContract = {
  id:               number;
  agentId:          number;
  type:             string;
  status:           string;
  startDate:        Date | null;
  endDate:          Date | null;
  signedAt:         Date | null;
  note:             string | null;
  createdAt:        Date;
  agentDisplayName: string | null;
  agentMallUserId:  string | null;
};

/**
 * GET /api/affiliate-contracts
 * GMcruise AffiliateContract 계약 목록 조회
 *
 * GLOBAL_ADMIN: 전체
 * OWNER:        AffiliateRelation 소속 에이전트만
 * AGENT:        본인 agentId만
 * FREE_SALES:   403
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, parseInt(searchParams.get('page')  ?? '1')  || 1);
    const limit  = Math.min(100, parseInt(searchParams.get('limit') ?? '20') || 20);
    const offset = (page - 1) * limit;

    const rawAgentId = searchParams.get('agentId');
    const rawStatus  = searchParams.get('status');
    const rawType    = searchParams.get('type');

    const agentIdFilter = rawAgentId ? parseInt(rawAgentId, 10) || null : null;
    const statusFilter  = rawStatus && ALLOWED_STATUSES.has(rawStatus) ? rawStatus : null;
    const typeFilter    = rawType   && ALLOWED_TYPES.has(rawType)      ? rawType   : null;

    const agentIdCondition: Prisma.Sql = agentIdFilter
      ? Prisma.sql`AND ac."agentId" = ${agentIdFilter}`
      : Prisma.empty;
    const statusCondition: Prisma.Sql = statusFilter
      ? Prisma.sql`AND ac.status = ${statusFilter}`
      : Prisma.empty;
    const typeCondition: Prisma.Sql = typeFilter
      ? Prisma.sql`AND ac.type = ${typeFilter}`
      : Prisma.empty;

    let roleCondition: Prisma.Sql = Prisma.empty;
    if (ctx.role === 'OWNER') {
      const ownerProfileId = ctx.mallUser?.affiliateProfileId;
      if (!ownerProfileId) {
        return NextResponse.json({ ok: false, error: '파트너 프로필이 없습니다.' }, { status: 403 });
      }
      roleCondition = Prisma.sql`
        AND ac."agentId" IN (
          SELECT ar."agentId" FROM "AffiliateRelation" ar
          WHERE ar."managerId" = ${ownerProfileId} AND ar.status = 'ACTIVE'
        )
      `;
    } else if (ctx.role === 'AGENT') {
      const agentProfileId = ctx.mallUser?.affiliateProfileId;
      if (!agentProfileId) {
        return NextResponse.json({ ok: false, error: '에이전트 프로필이 없습니다.' }, { status: 403 });
      }
      roleCondition = Prisma.sql`AND ac."agentId" = ${agentProfileId}`;
    }

    const [rows, countRows] = await Promise.all([
      prisma.$queryRaw<RawContract[]>(Prisma.sql`
        SELECT
          ac.id, ac."agentId", ac.type, ac.status,
          ac."startDate", ac."endDate", ac."signedAt", ac.note, ac."createdAt",
          ap."displayName" AS "agentDisplayName",
          u."mallUserId"   AS "agentMallUserId"
        FROM "AffiliateContract" ac
        JOIN "AffiliateProfile" ap ON ap.id = ac."agentId"
        JOIN "User"             u  ON u.id  = ap."userId"
        WHERE 1=1
          ${agentIdCondition}
          ${statusCondition}
          ${typeCondition}
          ${roleCondition}
        ORDER BY ac."createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      prisma.$queryRaw<[{ total: bigint }]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM "AffiliateContract" ac
        JOIN "AffiliateProfile" ap ON ap.id = ac."agentId"
        JOIN "User"             u  ON u.id  = ap."userId"
        WHERE 1=1
          ${agentIdCondition}
          ${statusCondition}
          ${typeCondition}
          ${roleCondition}
      `),
    ]);

    const total = Number(countRows[0]?.total ?? 0);

    const contracts = rows.map((r) => ({
      id:               r.id,
      agentId:          r.agentId,
      type:             r.type,
      status:           r.status,
      startDate:        r.startDate ? new Date(r.startDate).toISOString() : null,
      endDate:          r.endDate ? new Date(r.endDate).toISOString() : null,
      signedAt:         r.signedAt ? new Date(r.signedAt).toISOString() : null,
      note:             r.note,
      createdAt:        new Date(r.createdAt).toISOString(),
      agentDisplayName: r.agentDisplayName,
      agentMallUserId:  r.agentMallUserId,
    }));

    logger.log('[GET /api/affiliate-contracts]', { role: ctx.role, total, page });
    return NextResponse.json({ ok: true, contracts, total, page, totalPages: Math.ceil(total / limit) });

  } catch (err) {
    logger.error('[GET /api/affiliate-contracts]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
