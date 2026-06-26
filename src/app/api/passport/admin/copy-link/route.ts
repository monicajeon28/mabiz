export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requireCrmManager } from '@/lib/passport-auth';
import { buildPassportLink, generatePassportToken } from '@/lib/passport-utils';
import { logger } from '@/lib/logger';

/**
 * POST /api/passport/admin/copy-link
 *
 * 고객 행에서 "제출 링크 복사" 버튼이 호출한다. 문자(SMS)를 보내지 않고
 * 여권 제출용 토큰 링크만 생성/재사용해 반환한다.
 *
 * - send/route.ts 와 동일한 buildPassportLink() 로 URL을 생성해
 *   문자로 받는 링크와 복사 링크가 완전히 동일하다(혼동 방지).
 * - 유효한(미만료) 토큰이 이미 있으면 재발급하지 않고 그대로 재사용한다
 *   (같은 고객에게 여러 번 눌러도 링크가 흔들리지 않음).
 * - 기본 유효기간 72시간. body.expiresInHours 로 조정(1~336시간).
 *
 * 권한: requireCrmManager (GLOBAL_ADMIN / OWNER) — send/route 와 동일 게이트.
 */

interface CopyLinkBody {
  userId?: number | string;
  expiresInHours?: number;
  target?: 'passport' | 'pnr';
}

const DEFAULT_EXPIRES_HOURS = 72;

export async function POST(req: NextRequest) {
  try {
    const manager = await requireCrmManager();
    if (!manager) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다. 다시 로그인해 주세요.' },
        { status: 403 },
      );
    }

    const body: CopyLinkBody = await req.json().catch(() => ({}));
    const userId = typeof body.userId === 'string' ? parseInt(body.userId, 10) : body.userId;
    if (typeof userId !== 'number' || Number.isNaN(userId)) {
      return NextResponse.json({ ok: false, error: '고객 ID가 필요합니다.' }, { status: 400 });
    }

    const target = body.target === 'pnr' ? 'pnr' : 'passport';
    const expiresInHours = Math.max(1, Math.min(body.expiresInHours ?? DEFAULT_EXPIRES_HOURS, 24 * 14));

    const user = await prisma.gmUser.findFirst({
      where: { id: userId, role: { not: 'admin' } },
      select: {
        id: true,
        name: true,
        trips: {
          orderBy: { startDate: 'desc' },
          take: 1,
          select: { id: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: '고객을 찾을 수 없습니다.' }, { status: 404 });
    }

    const latestTripId = user.trips[0]?.id ?? null;

    // ── PNR 링크: 예약 기반 (send/route 와 동일 형식) ───────────────────
    if (target === 'pnr') {
      if (!latestTripId) {
        return NextResponse.json({ ok: false, error: '여행 정보가 없어 항공 입력 링크를 만들 수 없습니다.' }, { status: 400 });
      }
      const reservation = await prisma.gmReservation.findFirst({
        where: { tripId: latestTripId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (!reservation) {
        return NextResponse.json({ ok: false, error: '예약 정보가 없습니다.' }, { status: 400 });
      }
      const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL ?? 'https://mabizcruisedot.com').replace(/\/$/, '');
      return NextResponse.json({
        ok: true,
        target: 'pnr',
        link: `${baseUrl}/pnr/${reservation.id}`,
      });
    }

    // ── 여권 제출 링크 ────────────────────────────────────────────────
    // 미만료 토큰 재사용 (같은 trip 기준). 없으면 새 토큰 발급.
    const now = new Date();
    const existing = await prisma.gmPassportSubmission.findFirst({
      where: {
        userId: user.id,
        tripId: latestTripId,
        isSubmitted: false,
        tokenExpiresAt: { gt: now },
      },
      orderBy: { updatedAt: 'desc' },
      select: { token: true, tokenExpiresAt: true },
    });

    if (existing?.token) {
      return NextResponse.json({
        ok: true,
        target: 'passport',
        link: buildPassportLink(existing.token),
        reused: true,
        expiresAt: existing.tokenExpiresAt.toISOString(),
      });
    }

    const token = generatePassportToken();
    const tokenExpiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    // send/route 와 동일한 upsert 전략 (tripId null 분기 포함)
    if (latestTripId !== null) {
      await prisma.gmPassportSubmission.upsert({
        where: { userId_tripId: { userId: user.id, tripId: latestTripId } },
        update: {
          token,
          tokenExpiresAt,
          isSubmitted: false,
          updatedAt: new Date(),
          extraData: Prisma.JsonNull,
        },
        create: {
          userId: user.id,
          tripId: latestTripId,
          token,
          tokenExpiresAt,
          isSubmitted: false,
          driveFolderUrl: null,
          extraData: Prisma.JsonNull,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } else {
      const existingNull = await prisma.gmPassportSubmission.findFirst({
        where: { userId: user.id, tripId: null },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      });
      if (existingNull) {
        await prisma.gmPassportSubmission.update({
          where: { id: existingNull.id },
          data: { token, tokenExpiresAt, isSubmitted: false, updatedAt: new Date(), extraData: Prisma.JsonNull },
        });
      } else {
        try {
          await prisma.gmPassportSubmission.create({
            data: {
              userId: user.id,
              token,
              tokenExpiresAt,
              isSubmitted: false,
              driveFolderUrl: null,
              extraData: Prisma.JsonNull,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
        } catch (createErr) {
          // P2002: 동시 요청 race condition → 재조회 후 update
          if (createErr instanceof Prisma.PrismaClientKnownRequestError && createErr.code === 'P2002') {
            const race = await prisma.gmPassportSubmission.findFirst({
              where: { userId: user.id, tripId: null },
              orderBy: { updatedAt: 'desc' },
              select: { id: true },
            });
            if (race) {
              await prisma.gmPassportSubmission.update({
                where: { id: race.id },
                data: { token, tokenExpiresAt, isSubmitted: false, updatedAt: new Date(), extraData: Prisma.JsonNull },
              });
            } else {
              throw createErr;
            }
          } else {
            throw createErr;
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      target: 'passport',
      link: buildPassportLink(token),
      reused: false,
      expiresAt: tokenExpiresAt.toISOString(),
    });
  } catch (error) {
    logger.error('[Passport CopyLink] POST error', {
      err: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
