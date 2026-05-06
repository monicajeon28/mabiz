export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

const VALID_STATUSES = new Set(['PENDING', 'CONTACTED', 'CONVERTED', 'REJECTED']);

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(0, 3) + '-****-' + digits.slice(-4);
  }
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

type RawInquiry = {
  id: number;
  name: string;
  phone: string;
  tier: number | null;
  status: string;
  message: string | null;
  submittedAt: Date;
  createdAt: Date;
  agentName: string | null;
  agentMallUserId: string | null;
};

/**
 * GET /api/gold-inquiries
 * GMcruise ProductInquiry WHERE productCode='GOLD_MEMBERSHIP' 목록 조회
 *
 * GLOBAL_ADMIN: 전체
 * OWNER:        managerId = affiliateProfileId
 * AGENT:        agentId   = affiliateProfileId
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

    const rawStatus = searchParams.get('status');
    const q         = searchParams.get('q')?.trim() ?? '';
    const status    = rawStatus && VALID_STATUSES.has(rawStatus) ? rawStatus : null;

    let roleCondition: Prisma.Sql = Prisma.empty;
    if (ctx.role === 'OWNER' || ctx.role === 'AGENT') {
      const profileId = ctx.mallUser?.affiliateProfileId;
      if (!profileId) {
        return NextResponse.json({ ok: false, error: '파트너 프로필이 없습니다.' }, { status: 403 });
      }
      roleCondition = ctx.role === 'OWNER'
        ? Prisma.sql`AND pi."managerId" = ${profileId}`
        : Prisma.sql`AND pi."agentId"   = ${profileId}`;
    }

    const statusCondition: Prisma.Sql = status
      ? Prisma.sql`AND pi.status = ${status}`
      : Prisma.empty;
    const searchCondition: Prisma.Sql = q
      ? Prisma.sql`AND (pi.name ILIKE ${'%' + q + '%'} OR pi.phone ILIKE ${'%' + q + '%'})`
      : Prisma.empty;

    const [rows, countRows] = await Promise.all([
      prisma.$queryRaw<RawInquiry[]>(Prisma.sql`
        SELECT
          pi.id, pi.name, pi.phone, pi.tier, pi.status, pi.message,
          pi."submittedAt", pi."createdAt",
          u.name         AS "agentName",
          u."mallUserId" AS "agentMallUserId"
        FROM "ProductInquiry" pi
        LEFT JOIN "AffiliateProfile" ap ON ap.id = pi."agentId"
        LEFT JOIN "User"             u  ON u.id  = ap."userId"
        WHERE pi."productCode" = 'GOLD_MEMBERSHIP'
          ${roleCondition}
          ${statusCondition}
          ${searchCondition}
        ORDER BY pi."submittedAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      prisma.$queryRaw<[{ total: bigint }]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM "ProductInquiry" pi
        WHERE pi."productCode" = 'GOLD_MEMBERSHIP'
          ${roleCondition}
          ${statusCondition}
          ${searchCondition}
      `),
    ]);

    const total = Number(countRows[0]?.total ?? 0);

    const inquiries = rows.map((r) => ({
      id:              r.id,
      name:            r.name,
      phone:           maskPhone(r.phone),
      tier:            r.tier,
      status:          r.status,
      message:         r.message,
      submittedAt:     r.submittedAt?.toISOString() ?? null,
      createdAt:       r.createdAt.toISOString(),
      agentName:       r.agentName       ?? null,
      agentMallUserId: r.agentMallUserId ?? null,
    }));

    logger.log('[GET /api/gold-inquiries]', { role: ctx.role, total, page });
    return NextResponse.json({ ok: true, inquiries, total, page, totalPages: Math.ceil(total / limit) });

  } catch (err) {
    logger.error('[GET /api/gold-inquiries]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
