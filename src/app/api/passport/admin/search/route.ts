export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireCrmManager } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

const MAX_MATCHES = 20;

/**
 * 전화번호를 마스킹합니다
 * - GLOBAL_ADMIN, OWNER, AGENT: 전체 공개 (관리자/대리점장 권한)
 * - 그 외: 마스킹 (010-****-**** 형식) — 외부 노출 시에만
 */
function maskPhoneNumber(phone: string | null, role: string): string | null {
  if (!phone) return null;

  // 관리자, 대리점장, 정식판매원: 전체 번호 공개
  if (['GLOBAL_ADMIN', 'OWNER', 'AGENT'].includes(role)) return phone;

  // 기타 역할: 마스킹
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 11) return digits.slice(0, 3) + '-****-****';
  if (digits.length === 10) return digits.slice(0, 2) + '-****-****';
  return '***-****-****';
}

export async function GET(req: NextRequest) {
  try {
    const manager = await requireCrmManager();
    if (!manager) {
      return NextResponse.json({
        ok: false,
        message: '인증이 필요합니다. 다시 로그인해 주세요.',
        details: 'Admin authentication failed'
      }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const rawQuery = searchParams.get('q')?.trim() ?? '';
    const normalizedPhone = rawQuery.replace(/\D/g, '');

    const orConditions: Prisma.GmUserWhereInput[] = [];

    if (rawQuery) {
      orConditions.push(
        {
          name: {
            contains: rawQuery,
            mode: Prisma.QueryMode.insensitive,
          },
        } as Prisma.GmUserWhereInput,
        {
          email: {
            contains: rawQuery,
            mode: Prisma.QueryMode.insensitive,
          },
        } as Prisma.GmUserWhereInput,
        { phone: { contains: rawQuery } }
      );
    }

    if (normalizedPhone.length >= 3 && normalizedPhone !== rawQuery) {
      orConditions.push({ phone: { contains: normalizedPhone } });
    }

    const where = {
      role: { not: 'admin' },
      ...(orConditions.length ? { OR: orConditions } : {}),
    } as const;

    const matches = await prisma.gmUser.findMany({
      where,
      orderBy: rawQuery ? { name: 'asc' } : { createdAt: 'desc' },
      take: MAX_MATCHES,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        customerStatus: true,
        createdAt: true,
        tripCount: true,
        trips: {
          select: {
            id: true,
            productCode: true,
            cruiseName: true,
            departureDate: true,
            startDate: true,
            endDate: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        passportSubmissions: {
          select: {
            id: true,
            isSubmitted: true,
            updatedAt: true,
            submittedAt: true,
            tokenExpiresAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        passportRequestLogs: {
          select: {
            id: true,
            status: true,
            sentAt: true,
            messageChannel: true,
          },
          orderBy: { sentAt: 'desc' },
          take: 1,
        },
      },
    });

    // 응답 데이터에서 전화번호 마스킹 적용
    const maskedData = matches.map(user => ({
      ...user,
      phone: maskPhoneNumber(user.phone, manager.role),
    }));

    return NextResponse.json({ ok: true, data: maskedData });
  } catch (error) {
    logger.error('[PassportRequest] GET /search error:', error as Record<string, unknown>);
    return NextResponse.json(
      { ok: false, message: '검색 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
