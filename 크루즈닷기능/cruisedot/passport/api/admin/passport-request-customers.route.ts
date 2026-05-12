export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireAdminUser } from '../_utils';

const MAX_LIMIT = 200;

type RoleFilter = 'all' | 'guide' | 'mall' | 'test';

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin) {
      return NextResponse.json({ 
        ok: false, 
        message: '인증이 필요합니다. 다시 로그인해 주세요.',
        details: 'Admin authentication failed'
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

    const where: Prisma.UserWhereInput = {
      role: { not: 'admin' },
    };

    const appendAndCondition = (condition: Prisma.UserWhereInput) => {
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
      const orConditions: Prisma.UserWhereInput[] = [
        {
          name: {
            contains: search,
            // SQLite는 case-insensitive를 기본 지원하지 않으므로 제거
          },
        } as Prisma.UserWhereInput,
        {
          email: {
            contains: search,
            // SQLite는 case-insensitive를 기본 지원하지 않으므로 제거
          },
        } as Prisma.UserWhereInput,
        { phone: { contains: search } },
      ];

      if (normalizedPhone.length >= 3 && normalizedPhone !== search) {
        orConditions.push({ phone: { contains: normalizedPhone } });
      }

      where.OR = orConditions;
    }

    let users;
    try {
      users = await prisma.user.findMany({
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
          Trip: {
            orderBy: { startDate: 'desc' },
            take: 1,
            select: {
              id: true,
              cruiseName: true,
              startDate: true,
              endDate: true,
              reservationCode: true,
              productId: true,
            },
          },
          PassportSubmission: {
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
          PassportRequestLog_PassportRequestLog_userIdToUser: {
            orderBy: { sentAt: 'desc' },
            take: 1,
            select: {
              id: true,
              status: true,
              messageChannel: true,
              sentAt: true,
              adminId: true,
              User_PassportRequestLog_adminIdToUser: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });
    } catch (queryError: any) {
      console.error('[PassportRequest] Database query error:', queryError);
      console.error('[PassportRequest] Error details:', {
        message: queryError?.message,
        code: queryError?.code,
        meta: queryError?.meta,
        stack: queryError?.stack,
      });
      
      // 테이블이 없는 경우
      if (queryError?.code === 'P2021' || queryError?.message?.includes('does not exist')) {
        return NextResponse.json({
          ok: true,
          data: [],
          message: '테이블이 아직 생성되지 않았습니다.',
        });
      }
      
      // 관계 필드 오류인 경우
      if (queryError?.code === 'P2019' || queryError?.message?.includes('Unknown field')) {
        console.error('[PassportRequest] Relation field error - check Prisma schema');
        // 관계 필드 없이 기본 정보만 반환
        try {
          const simpleUsers = await prisma.user.findMany({
            where: {
              role: { not: 'admin' },
            },
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
            },
          });
          
          return NextResponse.json({
            ok: true,
            data: simpleUsers.map(user => ({
              id: user.id,
              name: user.name,
              phone: user.phone,
              email: user.email,
              role: user.role,
              customerStatus: user.customerStatus,
              createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
              tripCount: user.tripCount || 0,
              latestTrip: null,
              submission: null,
              lastRequest: null,
              submissionStatus: 'not_requested',
            })),
            meta: {
              page,
              limit: take,
              count: simpleUsers.length,
            },
          });
        } catch (fallbackError: any) {
          console.error('[PassportRequest] Fallback query error:', fallbackError);
        }
      }
      
      return NextResponse.json(
        { 
          ok: false, 
          message: '고객 목록을 불러오는데 실패했습니다.',
          details: process.env.NODE_ENV === 'development' ? queryError?.message : undefined
        },
        { status: 500 }
      );
    }

    const records = users.map((user) => {
      try {
        const latestSubmission = (Array.isArray(user.PassportSubmission) ? user.PassportSubmission[0] : null) ?? null;
        const latestLog = (Array.isArray(user.PassportRequestLog_PassportRequestLog_userIdToUser) ? user.PassportRequestLog_PassportRequestLog_userIdToUser[0] : null) ?? null;
        const latestTrip = (Array.isArray(user.Trip) ? user.Trip[0] : null) ?? null;

        const submissionStatus = latestSubmission
          ? latestSubmission.isSubmitted
            ? 'submitted'
            : 'pending'
          : 'not_requested';

        return {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
          customerStatus: user.customerStatus,
          createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
          tripCount: user.tripCount || 0,
          latestTrip: latestTrip
            ? {
                id: latestTrip.id,
                cruiseName: latestTrip.cruiseName,
                reservationCode: latestTrip.reservationCode,
                productId: latestTrip.productId,
                startDate: latestTrip.startDate?.toISOString() ?? null,
                endDate: latestTrip.endDate?.toISOString() ?? null,
              }
            : null,
          submission: latestSubmission
            ? {
                id: latestSubmission.id,
                tripId: latestSubmission.tripId,
                token: latestSubmission.token,
                tokenExpiresAt: latestSubmission.tokenExpiresAt?.toISOString() ?? null,
                isSubmitted: latestSubmission.isSubmitted || false,
                submittedAt: latestSubmission.submittedAt?.toISOString() ?? null,
                createdAt: latestSubmission.createdAt?.toISOString() ?? new Date().toISOString(),
                updatedAt: latestSubmission.updatedAt?.toISOString() ?? new Date().toISOString(),
              }
            : null,
          lastRequest: latestLog
            ? {
                id: latestLog.id,
                status: latestLog.status,
                messageChannel: latestLog.messageChannel,
                sentAt: latestLog.sentAt?.toISOString() ?? null,
                admin: latestLog.User_PassportRequestLog_adminIdToUser || null,
              }
            : null,
          submissionStatus,
        };
      } catch (mapError: any) {
        console.error(`[PassportRequest] Error mapping user ${user.id}:`, mapError);
        // 기본 정보만 반환
        return {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
          customerStatus: user.customerStatus,
          createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
          tripCount: user.tripCount || 0,
          latestTrip: null,
          submission: null,
          lastRequest: null,
          submissionStatus: 'not_requested',
        };
      }
    });

    const filtered = records.filter((record) => {
      if (!statusFilter) return true;
      if (statusFilter === 'submitted') {
        return record.submissionStatus === 'submitted';
      }
      if (statusFilter === 'pending') {
        return record.submissionStatus === 'pending';
      }
      if (statusFilter === 'not_requested') {
        return record.submissionStatus === 'not_requested';
      }
      if (statusFilter === 'no_request') {
        return record.lastRequest === null;
      }
      return true;
    });

    return NextResponse.json({
      ok: true,
      data: filtered,
      meta: {
        page,
        limit: take,
        count: filtered.length,
      },
    });
  } catch (error: any) {
    console.error('[PassportRequest] GET /customers error:', error);
    console.error('[PassportRequest] Error details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    });
    return NextResponse.json(
      { 
        ok: false, 
        message: '고객 목록을 불러오는데 실패했습니다.',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      },
      { status: 500 }
    );
  }
}
