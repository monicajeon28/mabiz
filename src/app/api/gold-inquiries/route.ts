export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

// GMcruise ProductInquiry 실제 status 값 (소문자)
const VALID_STATUSES = new Set(['pending', 'unavailable', 'passport_waiting', 'confirmed', 'refund']);

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(0, 3) + '-****-' + digits.slice(-4);
  }
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

type RawInquiry = {
  id: number;
  productCode: string;
  name: string;
  phone: string;
  message: string | null;
  status: string;
  createdAt: Date;
  userId: number | null;
};

/**
 * GET /api/gold-inquiries
 * GMcruise ProductInquiry 목록 조회
 *
 * ProductInquiry에는 agentId/managerId 컬럼이 없으므로 역할별 scope 없음
 * GLOBAL_ADMIN / OWNER / AGENT: 전체 조회 (productCode로만 필터)
 * FREE_SALES: 403
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
    // 대소문자 모두 처리: UI가 보내는 값 소문자 정규화
    const statusRaw = rawStatus?.toLowerCase() ?? '';
    const status    = statusRaw && VALID_STATUSES.has(statusRaw) ? statusRaw : null;

    const statusCondition: Prisma.Sql = status
      ? Prisma.sql`AND pi.status = ${status}`
      : Prisma.empty;
    const searchCondition: Prisma.Sql = q
      ? Prisma.sql`AND (pi.name ILIKE ${'%' + q + '%'} OR pi.phone ILIKE ${'%' + q + '%'})`
      : Prisma.empty;

    const [rows, countRows] = await Promise.all([
      prisma.$queryRaw<RawInquiry[]>(Prisma.sql`
        SELECT
          pi.id,
          pi."productCode",
          pi.name,
          pi.phone,
          pi.message,
          pi.status,
          pi."createdAt",
          pi."userId"
        FROM "ProductInquiry" pi
        WHERE pi."productCode" = 'GOLD_MEMBERSHIP'
          ${statusCondition}
          ${searchCondition}
        ORDER BY pi."createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      prisma.$queryRaw<[{ total: bigint }]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM "ProductInquiry" pi
        WHERE pi."productCode" = 'GOLD_MEMBERSHIP'
          ${statusCondition}
          ${searchCondition}
      `),
    ]);

    const total = Number(countRows[0]?.total ?? 0);

    const inquiries = rows.map((r) => ({
      id:          r.id,
      productCode: r.productCode,
      name:        r.name,
      phone:       maskPhone(r.phone),
      message:     r.message,
      status:      r.status,
      submittedAt: r.createdAt.toISOString(), // UI 호환성
      createdAt:   r.createdAt.toISOString(),
      tier:        null,     // ProductInquiry에 tier 컬럼 없음
      agentName:   null,     // ProductInquiry에 agentId 컬럼 없음
    }));

    logger.log('[GET /api/gold-inquiries]', { role: ctx.role, total, page });
    return NextResponse.json({ ok: true, inquiries, total, page, totalPages: Math.ceil(total / limit) });

  } catch (err) {
    logger.error('[GET /api/gold-inquiries]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
