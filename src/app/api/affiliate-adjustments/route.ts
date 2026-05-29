export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

const ALLOWED_TYPES   = new Set(['BONUS', 'DEDUCTION', 'CORRECTION']);
const ALLOWED_STATUSES = new Set(['DRAFT', 'CONFIRMED', 'PAID']);
const YEAR_MONTH_RE   = /^\d{4}-\d{2}$/;

type RawAdjustment = {
  id: number;
  agentId: number;
  type: string;
  amount: number;
  reason: string | null;
  yearMonth: string;
  createdBy: number | null;
  createdAt: Date;
  agentDisplayName: string | null;
  agentMallUserId: string | null;
};

/**
 * GET /api/affiliate-adjustments
 * 커미션 조정내역 목록 조회
 *
 * GLOBAL_ADMIN: 전체
 * OWNER:        AffiliateRelation 소속 에이전트
 * AGENT/FREE_SALES: 본인 agentId만
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page      = Math.max(1, parseInt(searchParams.get('page')  ?? '1')  || 1);
    const limit     = Math.min(100, parseInt(searchParams.get('limit') ?? '20') || 20);
    const offset    = (page - 1) * limit;

    const rawType      = searchParams.get('type');
    const rawYearMonth = searchParams.get('yearMonth')?.trim() ?? '';
    const rawAgentId   = searchParams.get('agentId');

    const type      = rawType && ALLOWED_TYPES.has(rawType) ? rawType : null;
    const yearMonth = YEAR_MONTH_RE.test(rawYearMonth) ? rawYearMonth : null;
    const agentId   = rawAgentId ? parseInt(rawAgentId) || null : null;

    const conditions: Prisma.Sql[] = [];

    // 역할별 기본 필터
    if (ctx.role === 'OWNER' && ctx.mallUser?.affiliateProfileId) {
      conditions.push(Prisma.sql`
        aa."agentId" IN (
          SELECT ar."agentId"
          FROM "AffiliateRelation" ar
          WHERE ar."managerId" = ${ctx.mallUser.affiliateProfileId}
            AND ar.status = 'ACTIVE'
        )
      `);
    } else if ((ctx.role === 'AGENT' || ctx.role === 'FREE_SALES') && ctx.mallUser?.affiliateProfileId) {
      conditions.push(Prisma.sql`aa."agentId" = ${ctx.mallUser.affiliateProfileId}`);
    }
    // GLOBAL_ADMIN + non-mallUser CRM sessions: no restriction

    if (type)      conditions.push(Prisma.sql`aa.type = ${type}`);
    if (yearMonth) conditions.push(Prisma.sql`aa."yearMonth" = ${yearMonth}`);
    if (agentId)   conditions.push(Prisma.sql`aa."agentId" = ${agentId}`);

    const whereClause = conditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
      : Prisma.empty;

    const [rows, countRows] = await Promise.all([
      prisma.$queryRaw<RawAdjustment[]>(Prisma.sql`
        SELECT
          aa.id,
          aa."agentId",
          aa.type,
          aa.amount,
          aa.reason,
          aa."yearMonth",
          aa."createdBy",
          aa."createdAt",
          ap."displayName" AS "agentDisplayName",
          u."mallUserId"   AS "agentMallUserId"
        FROM "AffiliateAdjustment" aa
        LEFT JOIN "AffiliateProfile" ap ON ap.id = aa."agentId"
        LEFT JOIN "User"             u  ON u.id  = ap."userId"
        ${whereClause}
        ORDER BY aa."createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      prisma.$queryRaw<[{ total: bigint }]>(Prisma.sql`
        SELECT COUNT(*) AS total
        FROM "AffiliateAdjustment" aa
        ${whereClause}
      `),
    ]);

    const total = Number(countRows[0]?.total ?? 0);

    const adjustments = rows.map((r) => ({
      id:               r.id,
      agentId:          r.agentId,
      type:             r.type,
      amount:           Number(r.amount),
      reason:           r.reason,
      yearMonth:        r.yearMonth,
      createdBy:        r.createdBy,
      createdAt:        new Date(r.createdAt).toISOString(),
      agentDisplayName: r.agentDisplayName,
      agentMallUserId:  r.agentMallUserId,
    }));

    logger.log('[GET /api/affiliate-adjustments]', { role: ctx.role, total });
    return NextResponse.json({ ok: true, adjustments, total, page, totalPages: Math.ceil(total / limit) });

  } catch (err) {
    logger.error('[GET /api/affiliate-adjustments]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}

/**
 * POST /api/affiliate-adjustments
 * 커미션 조정내역 생성 (GLOBAL_ADMIN / OWNER만)
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role !== 'GLOBAL_ADMIN' && ctx.role !== 'OWNER') {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await req.json() as {
      agentId?: unknown;
      type?: unknown;
      amount?: unknown;
      reason?: unknown;
      yearMonth?: unknown;
    };

    const agentId   = typeof body.agentId === 'number' ? Math.floor(body.agentId) : parseInt(String(body.agentId ?? ''));
    const type      = typeof body.type === 'string' && ALLOWED_TYPES.has(body.type) ? body.type : null;
    const amount    = typeof body.amount === 'number' ? Math.floor(body.amount) : parseInt(String(body.amount ?? ''));
    const yearMonth = typeof body.yearMonth === 'string' && YEAR_MONTH_RE.test(body.yearMonth) ? body.yearMonth : null;
    const reason    = typeof body.reason === 'string' ? body.reason.slice(0, 500) : null;

    if (!agentId || isNaN(agentId) || agentId <= 0) {
      return NextResponse.json({ ok: false, error: 'agentId 필수 (양의 정수)' }, { status: 400 });
    }
    if (!type) {
      return NextResponse.json({ ok: false, error: `type 필수: ${[...ALLOWED_TYPES].join('|')}` }, { status: 400 });
    }
    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: 'amount 필수 (양의 정수)' }, { status: 400 });
    }
    if (!yearMonth) {
      return NextResponse.json({ ok: false, error: 'yearMonth 필수 (YYYY-MM)' }, { status: 400 });
    }

    // OWNER: 소속 에이전트인지 확인
    if (ctx.role === 'OWNER' && ctx.mallUser?.affiliateProfileId) {
      const rel = await prisma.$queryRaw<[{ exists: boolean }]>(Prisma.sql`
        SELECT EXISTS (
          SELECT 1 FROM "AffiliateRelation"
          WHERE "managerId" = ${ctx.mallUser.affiliateProfileId}
            AND "agentId"   = ${agentId}
            AND status      = 'ACTIVE'
        ) AS exists
      `);
      if (!rel[0]?.exists) {
        return NextResponse.json({ ok: false, error: '소속 에이전트가 아닙니다.' }, { status: 403 });
      }
    }

    const createdBy = ctx.mallUser?.id ?? null;
    const now       = new Date();

    const rows = await prisma.$queryRaw<[{ id: number }]>(Prisma.sql`
      INSERT INTO "AffiliateAdjustment"
        ("agentId", type, amount, reason, "yearMonth", "createdBy", "createdAt")
      VALUES
        (${agentId}, ${type}, ${amount}, ${reason}, ${yearMonth}, ${createdBy}, ${now})
      RETURNING id
    `);

    logger.log('[POST /api/affiliate-adjustments]', { id: rows[0].id, agentId, type, amount });
    return NextResponse.json({ ok: true, id: rows[0].id });

  } catch (err) {
    logger.error('[POST /api/affiliate-adjustments]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
