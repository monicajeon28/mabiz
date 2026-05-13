export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireCrmManager } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

// ── TypeScript 타입 정의 ────────────────────────────────────────
interface RawCustomerRecord {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  role: string;
  createdAt: Date;
  tripCount: number | null;
  customerStatus: string | null;
  tripId: number | null;
  cruiseName: string | null;
  productCode: string | null;
  shipName: string | null;
  departureDate: Date | null;
  submissionId: number | null;
  tripId_submission: number | null;
  token: string | null;
  tokenExpiresAt: Date | null;
  isSubmitted: boolean;
  submittedAt: Date | null;
  submissionCreatedAt: Date | null;
  submissionUpdatedAt: Date | null;
  logId: number | null;
  logStatus: string | null;
  messageChannel: string | null;
  sentAt: Date | null;
  adminId: number | null;
  adminName: string | null;
}

const MAX_LIMIT = 200;

type RoleFilter = 'all' | 'guide' | 'mall' | 'test';

/**
 * GET /api/passport/admin/customers
 * 여권 요청 고객 목록 조회
 * 권한: GLOBAL_ADMIN + OWNER (대리점장)
 */
export async function GET(req: NextRequest) {
  try {
    const manager = await requireCrmManager();
    if (!manager) {
      return NextResponse.json({
        ok: false,
        message: '인증이 필요합니다. 다시 로그인해 주세요.',
      }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim() ?? '';
    const statusFilter = searchParams.get('status')?.trim() ?? '';
    const roleFilterParam = (searchParams.get('role')?.trim() ?? 'all') as RoleFilter;
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const limitParam = parseInt(searchParams.get('limit') ?? '100', 10);
    const take = Math.min(Math.max(limitParam || 100, 1), MAX_LIMIT);
    const skip = (page - 1) * take;

    // ── 동적 WHERE 조건 빌드 (매개변수 바인딩) ───────────────────
    // SQL 인젝션 방지를 위해 Prisma.sql 사용
    const whereConditions: Prisma.Sql[] = [Prisma.sql`u.role != 'admin'`];

    // role 필터 조건 추가
    switch (roleFilterParam) {
      case 'guide':
        whereConditions.push(
          Prisma.sql`u.role = 'user' AND (u."customerStatus" IS NULL OR u."customerStatus" != 'test')`
        );
        break;
      case 'mall':
        whereConditions.push(Prisma.sql`u.role = 'community'`);
        break;
      case 'test':
        whereConditions.push(Prisma.sql`u.role = 'user' AND u."customerStatus" = 'test'`);
        break;
    }

    // search 필터 조건 추가
    if (search) {
      const normalizedPhone = search.replace(/\D/g, '');
      const searchPattern = `%${search}%`;
      const phonePattern = `%${normalizedPhone}%`;

      const orConditions: Prisma.Sql[] = [
        Prisma.sql`u.name ILIKE ${searchPattern}`,
        Prisma.sql`u.email ILIKE ${searchPattern}`,
        Prisma.sql`u.phone ILIKE ${searchPattern}`,
      ];

      if (normalizedPhone.length >= 3 && normalizedPhone !== search) {
        orConditions.push(Prisma.sql`u.phone ILIKE ${phonePattern}`);
      }

      // OR 조건을 하나로 결합
      whereConditions.push(
        Prisma.sql`(${Prisma.join(orConditions, ' OR ')})`
      );
    }

    // ── Raw SQL로 한 번의 LEFT JOIN 쿼리 실행 ──────────────────
    // Prisma.sql로 매개변수 바인딩하여 SQL 인젝션 방지
    const whereClause = Prisma.sql`WHERE ${Prisma.join(whereConditions, ' AND ')}`;

    const users = await prisma.$queryRaw<RawCustomerRecord[]>`
      SELECT
        u.id, u.name, u.phone, u.email, u.role, u."createdAt",
        u."tripCount", u."customerStatus",
        t.id as "tripId", t."cruiseName", t."productCode",
        t."shipName", t."departureDate",
        ps.id as "submissionId", ps."tripId" as "tripId_submission",
        ps.token, ps."tokenExpiresAt", ps."isSubmitted",
        ps."submittedAt", ps."createdAt" as "submissionCreatedAt",
        ps."updatedAt" as "submissionUpdatedAt",
        prl.id as "logId", prl.status as "logStatus",
        prl."messageChannel", prl."sentAt", prl."adminId",
        a.name as "adminName"
      FROM "GmUser" u
      LEFT JOIN LATERAL (
        SELECT id, "userId", "cruiseName", "productCode", "shipName", "departureDate"
        FROM "GmTrip"
        WHERE "userId" = u.id
        ORDER BY "departureDate" DESC
        LIMIT 1
      ) t ON true
      LEFT JOIN LATERAL (
        SELECT id, "userId", "tripId", token, "tokenExpiresAt",
                "isSubmitted", "submittedAt", "createdAt", "updatedAt"
        FROM "GmPassportSubmission"
        WHERE "userId" = u.id
        ORDER BY "updatedAt" DESC
        LIMIT 1
      ) ps ON true
      LEFT JOIN LATERAL (
        SELECT id, "userId", status, "messageChannel", "sentAt", "adminId"
        FROM "GmPassportRequestLog"
        WHERE "userId" = u.id
        ORDER BY "sentAt" DESC
        LIMIT 1
      ) prl ON true
      LEFT JOIN "GmUser" a ON prl."adminId" = a.id
      ${whereClause}
      ORDER BY u."createdAt" DESC
      LIMIT ${take} OFFSET ${skip}
    `;

    // ── 결과 매핑 (메모리 집계) ────────────────────────────────
    // Raw SQL 결과를 기존 응답 형식으로 변환
    const recordMap = new Map<number, (typeof records)[0]>();

    for (const row of users) {
      if (!recordMap.has(row.id)) {
        const submissionStatus = row.submissionId
          ? row.isSubmitted ? 'submitted' : 'pending'
          : 'not_requested';

        recordMap.set(row.id, {
          id: row.id,
          name: row.name,
          // 민감정보 마스킹: OWNER는 전체 번호 못 봄
          phone: manager.role === 'GLOBAL_ADMIN'
            ? row.phone
            : row.phone ? row.phone.slice(0, 3) + '****' + row.phone.slice(-4) : null,
          email: row.email,
          role: row.role,
          customerStatus: row.customerStatus,
          createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
          tripCount: row.tripCount || 0,
          latestTrip: row.tripId ? {
            id: row.tripId,
            cruiseName: row.cruiseName,
            productCode: row.productCode,
            shipName: row.shipName,
            departureDate: row.departureDate?.toISOString() ?? null,
          } : null,
          submission: row.submissionId ? {
            id: row.submissionId,
            tripId: row.tripId_submission,
            token: row.token,
            tokenExpiresAt: row.tokenExpiresAt?.toISOString() ?? null,
            isSubmitted: row.isSubmitted || false,
            submittedAt: row.submittedAt?.toISOString() ?? null,
            createdAt: row.submissionCreatedAt?.toISOString() ?? new Date().toISOString(),
            updatedAt: row.submissionUpdatedAt?.toISOString() ?? new Date().toISOString(),
          } : null,
          lastRequest: row.logId ? {
            id: row.logId,
            status: row.logStatus,
            messageChannel: row.messageChannel,
            sentAt: row.sentAt?.toISOString() ?? null,
            admin: row.adminId ? { id: row.adminId, name: row.adminName } : null,
          } : null,
          submissionStatus,
        });
      }
    }

    const records = Array.from(recordMap.values());

    // ── 상태 필터링 (메모리 필터) ──────────────────────────────
    const filtered = statusFilter
      ? records.filter((r) => {
          if (statusFilter === 'submitted') return r.submissionStatus === 'submitted';
          if (statusFilter === 'pending') return r.submissionStatus === 'pending';
          if (statusFilter === 'not_requested') return r.submissionStatus === 'not_requested';
          if (statusFilter === 'no_request') return r.lastRequest === null;
          return true;
        })
      : records;

    return NextResponse.json({
      ok: true,
      data: filtered,
      meta: { page, limit: take, count: filtered.length },
    });
  } catch (error) {
    logger.error('[PassportCustomers] GET 실패', { error });
    return NextResponse.json(
      { ok: false, message: '고객 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
