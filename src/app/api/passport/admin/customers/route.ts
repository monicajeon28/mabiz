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

// RoleFilter 제거: 모든 구매 고객을 표시하므로 역할 필터 불필요

// ── 전화번호 마스킹 함수 ────────────────────────────────────────
/**
 * 전화번호를 마스킹합니다
 * - GLOBAL_ADMIN: 전체 공개 (관리자 권한)
 * - 그 외 (OWNER/AGENT): 모두 마스킹 (010-****-**** 형식)
 *
 * @param phone - 전화번호 (원본 형식: 01012345678, 010-1234-5678, 02-1234-5678 등)
 * @param role - 사용자 역할
 * @returns 마스킹된 전화번호 또는 null
 */
function maskPhoneNumber(phone: string | null, role: string): string | null {
  if (!phone) return null;

  // GLOBAL_ADMIN은 전체 번호 공개
  if (role === 'GLOBAL_ADMIN') return phone;

  // 숫자만 추출
  const digits = phone.replace(/[^0-9]/g, '');

  if (digits.length === 11) {
    // 휴대전화: 010-****-****
    return digits.slice(0, 3) + '-****-****';
  }

  if (digits.length === 10) {
    // 지역번호 (02-1234-5678): 02-****-****
    return digits.slice(0, 2) + '-****-****';
  }

  // 그 외: ***-****-****
  return '***-****-****';
}

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
    // roleFilterParam 제거: 모든 구매 고객을 표시하므로 역할 필터 불필요
    const productCodeParam = searchParams.get('productCode')?.trim() ?? '';
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const limitParam = parseInt(searchParams.get('limit') ?? '100', 10);
    const take = Math.min(Math.max(limitParam || 100, 1), MAX_LIMIT);
    const skip = (page - 1) * take;

    // ── 동적 WHERE 조건 빌드 (매개변수 바인딩) ───────────────────
    // SQL 인젝션 방지를 위해 Prisma.sql 사용
    const whereConditions: Prisma.Sql[] = [
      Prisma.sql`u.role != 'admin'`,
      // 구매 고객만 필터링: 확정된 예약 + 결제 완료
      // GmTrip과 GmReservation의 관계 확인: GmReservation(tripId) → GmTrip(id), GmReservation(mainUserId) → GmUser(id)
      Prisma.sql`EXISTS(
        SELECT 1 FROM "GmReservation" r
        WHERE r."mainUserId" = u.id
        AND r.status = 'CONFIRMED'
        AND r."paymentAmount" > 0
      )`
    ];

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

    // statusFilter를 WHERE 절로 이동 (DB에서 필터링)
    if (statusFilter) {
      if (statusFilter === 'submitted') {
        whereConditions.push(Prisma.sql`ps."isSubmitted" = true`);
      } else if (statusFilter === 'pending') {
        whereConditions.push(
          Prisma.sql`ps.id IS NOT NULL AND ps."isSubmitted" = false`
        );
      } else if (statusFilter === 'not_requested') {
        whereConditions.push(Prisma.sql`ps.id IS NULL`);
      } else if (statusFilter === 'no_request') {
        whereConditions.push(Prisma.sql`prl.id IS NULL`);
      }
    }

    // productCode 필터 (상품별 고객 필터링)
    if (productCodeParam && productCodeParam !== 'all') {
      whereConditions.push(
        Prisma.sql`EXISTS(
          SELECT 1 FROM "GmTrip" t3
          JOIN "GmReservation" r2 ON r2."tripId" = t3.id
          WHERE t3."userId" = u.id
            AND t3."productCode" = ${productCodeParam}
            AND r2.status = 'CONFIRMED'
            AND r2."paymentAmount" > 0
        )`
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

    // ── 결과 매핑 (메모리 최적화: Map 제거, 직접 배열 변환) ──────────
    // LEFT JOIN LATERAL는 이미 LIMIT 1이므로 중복 제거 불필요
    const records = users.map((row) => {
      const submissionStatus = row.submissionId
        ? row.isSubmitted ? 'submitted' : 'pending'
        : 'not_requested';

      return {
        id: row.id,
        name: row.name,
        // 민감정보 마스킹: GLOBAL_ADMIN만 전체 공개, 그 외는 모두 마스킹
        phone: maskPhoneNumber(row.phone, manager.role),
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
      };
    });

    // statusFilter는 이제 DB에서 필터됨 (라인 151-164 WHERE 절)
    const filtered = records;

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
