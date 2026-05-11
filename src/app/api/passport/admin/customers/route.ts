export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireCrmManager } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

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

    // ── WHERE 조건 빌드 ─────────────────────────────────────────
    const where: Prisma.GmUserWhereInput = {
      role: { not: 'admin' },
    };

    const appendAndCondition = (condition: Prisma.GmUserWhereInput) => {
      if (!where.AND) {
        where.AND = [condition];
      } else if (Array.isArray(where.AND)) {
        where.AND = [...where.AND, condition];
      } else {
        where.AND = [where.AND, condition];
      }
    };

    switch (roleFilterParam) {
      case 'guide':
        where.role = 'user';
        appendAndCondition({
          OR: [
            { customerStatus: null },
            { customerStatus: { not: 'test' } },
          ],
        });
        break;
      case 'mall':
        where.role = 'community';
        break;
      case 'test':
        where.role = 'user';
        where.customerStatus = 'test';
        break;
      default:
        break;
    }

    if (search) {
      const normalizedPhone = search.replace(/\D/g, '');
      const orConditions: Prisma.GmUserWhereInput[] = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];

      if (normalizedPhone.length >= 3 && normalizedPhone !== search) {
        orConditions.push({ phone: { contains: normalizedPhone } });
      }

      where.OR = orConditions;
    }

    // ── 쿼리 실행 ──────────────────────────────────────────────
    const users = await prisma.gmUser.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        createdAt: true,
        tripCount: true,
        customerStatus: true,
        trips: {
          orderBy: { departureDate: 'desc' },
          take: 1,
          select: {
            id: true,
            cruiseName: true,
            departureDate: true,
            productCode: true,
            shipName: true,
          },
        },
        passportSubmissions: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            tripId: true,
            token: true,
            tokenExpiresAt: true,
            isSubmitted: true,
            submittedAt: true,
            updatedAt: true,
            createdAt: true,
          },
        },
        passportRequestsSent: {
          orderBy: { sentAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            messageChannel: true,
            sentAt: true,
            adminId: true,
            admin: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    // ── 결과 매핑 ──────────────────────────────────────────────
    const records = users.map((user) => {
      const latestSubmission = user.passportSubmissions[0] ?? null;
      const latestLog = user.passportRequestsSent[0] ?? null;
      const latestTrip = user.trips[0] ?? null;

      const submissionStatus = latestSubmission
        ? latestSubmission.isSubmitted ? 'submitted' : 'pending'
        : 'not_requested';

      return {
        id: user.id,
        name: user.name,
        // 민감정보 마스킹: OWNER는 전체 번호 못 봄
        phone: manager.role === 'GLOBAL_ADMIN'
          ? user.phone
          : user.phone ? user.phone.slice(0, 3) + '****' + user.phone.slice(-4) : null,
        email: user.email,
        role: user.role,
        customerStatus: user.customerStatus,
        createdAt: user.createdAt?.toISOString() ?? new Date().toISOString(),
        tripCount: user.tripCount || 0,
        latestTrip: latestTrip ? {
          id: latestTrip.id,
          cruiseName: latestTrip.cruiseName,
          productCode: latestTrip.productCode,
          shipName: latestTrip.shipName,
          departureDate: latestTrip.departureDate?.toISOString() ?? null,
        } : null,
        submission: latestSubmission ? {
          id: latestSubmission.id,
          tripId: latestSubmission.tripId,
          token: latestSubmission.token,
          tokenExpiresAt: latestSubmission.tokenExpiresAt?.toISOString() ?? null,
          isSubmitted: latestSubmission.isSubmitted || false,
          submittedAt: latestSubmission.submittedAt?.toISOString() ?? null,
          createdAt: latestSubmission.createdAt?.toISOString() ?? new Date().toISOString(),
          updatedAt: latestSubmission.updatedAt?.toISOString() ?? new Date().toISOString(),
        } : null,
        lastRequest: latestLog ? {
          id: latestLog.id,
          status: latestLog.status,
          messageChannel: latestLog.messageChannel,
          sentAt: latestLog.sentAt?.toISOString() ?? null,
          admin: latestLog.admin ? { id: latestLog.admin.id, name: latestLog.admin.name } : null,
        } : null,
        submissionStatus,
      };
    });

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
