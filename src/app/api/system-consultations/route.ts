export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * GET /api/system-consultations
 * GMcruise 공유 DB의 SystemConsultation 테이블을 CRM이 직접 읽어오는 API
 * GLOBAL_ADMIN 전용
 */

type RawConsultation = {
  id: number;
  name: string | null;
  phone: string | null;
  message: string | null;
  status: string | null;
  managerId: number | null;
  agentId: number | null;
  createdAt: Date;
};

export async function GET(req: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: 'GLOBAL_ADMIN 전용' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, parseInt(searchParams.get('page')  ?? '1')  || 1);
    const limit  = Math.min(100, parseInt(searchParams.get('limit') ?? '30') || 30);
    const offset = (page - 1) * limit;
    const q      = searchParams.get('q')?.trim() ?? '';
    const status = searchParams.get('status')?.trim() ?? '';

    // 동적 WHERE 조건 구성
    const conditions: Prisma.Sql[] = [];

    if (q) {
      conditions.push(
        Prisma.sql`(sc.name ILIKE ${'%' + q + '%'} OR sc.phone ILIKE ${'%' + q + '%'})`
      );
    }

    if (status) {
      conditions.push(Prisma.sql`sc.status = ${status}`);
    }

    const whereClause = conditions.length > 0
      ? Prisma.sql`AND ${Prisma.join(conditions, ' AND ')}`
      : Prisma.empty;

    const [rows, countRows] = await Promise.all([
      prisma.$queryRaw<RawConsultation[]>(Prisma.sql`
        SELECT
          sc.id,
          sc.name,
          sc.phone,
          sc.message,
          sc.status,
          sc."managerId",
          sc."agentId",
          sc."createdAt"
        FROM "SystemConsultation" sc
        WHERE 1=1
          ${whereClause}
        ORDER BY sc."createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      prisma.$queryRaw<[{ total: bigint }]>(Prisma.sql`
        SELECT COUNT(*) AS total
        FROM "SystemConsultation" sc
        WHERE 1=1
          ${whereClause}
      `),
    ]);

    const total = Number(countRows[0]?.total ?? 0);

    const consultations = rows.map((r) => ({
      id:        r.id,
      name:      r.name,
      phone:     r.phone,
      message:   r.message,
      status:    r.status,
      managerId: r.managerId,
      agentId:   r.agentId,
      createdAt: r.createdAt.toISOString(),
    }));

    logger.log('[GET /api/system-consultations]', { total, page, limit, q: q || null, status: status || null });

    return NextResponse.json({
      ok: true,
      consultations,
      total,
      page,
      limit,
    });

  } catch (err) {
    logger.error('[GET /api/system-consultations] 조회 실패', { err });
    return NextResponse.json({ ok: false, error: '조회 실패' }, { status: 500 });
  }
}
