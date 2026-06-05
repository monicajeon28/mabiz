export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCrmManager } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { randomBytes } from 'crypto';

const Schema = z.object({
  // 기존 GmUser 사용 시
  userId: z.number().int().positive().optional(),
  // 신규 GmUser 생성 시
  name: z.string().min(1).max(100).optional(),
  phone: z.string().regex(/^01[0-9]{8,9}$/).optional(),
  email: z.string().email().optional().or(z.literal('')),
  // Trip 정보 (필수)
  shipName: z.string().min(1).max(200),
  departureDate: z.string().datetime(),
  productCode: z.string().max(50).optional().or(z.literal('')),
  cruiseName: z.string().max(200).optional().or(z.literal('')),
});

export async function POST(req: NextRequest) {
  const manager = await requireCrmManager();
  if (!manager) return NextResponse.json({ ok: false }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: '요청 본문을 파싱할 수 없습니다.' }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: '입력값을 확인해주세요.', errors: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const d = parsed.data;

  // userId 없으면 name + phone 필수
  if (!d.userId && (!d.name || !d.phone)) {
    return NextResponse.json(
      { ok: false, message: '신규 등록 시 이름과 전화번호는 필수입니다.' },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      let userId: number;

      if (d.userId) {
        // 기존 GmUser 확인
        const existing = await tx.gmUser.findUnique({
          where: { id: d.userId },
          select: { id: true },
        });
        if (!existing) throw new Error('USER_NOT_FOUND');
        userId = existing.id;
      } else {
        // 전화번호로 기존 GmUser 검색
        const normalizedPhone = d.phone!.replace(/[^0-9]/g, '');
        const existing = await tx.gmUser.findFirst({
          where: { phone: { contains: normalizedPhone } },
          select: { id: true },
        });

        if (existing) {
          userId = existing.id;
        } else {
          // 신규 GmUser 생성
          const password = `manual_${randomBytes(8).toString('hex')}`;
          const newUser = await tx.gmUser.create({
            data: {
              name: d.name!,
              phone: d.phone!,
              email: d.email || null,
              password,
              role: 'user',
              tripCount: 0,
              totalTripCount: 0,
              adminMemo: `수동 여권 등록용 사용자 (CRM 수동 등록, 관리자: ${manager.name ?? manager.id})`,
            },
            select: { id: true },
          });
          userId = newUser.id;
        }
      }

      // GmTrip 생성
      const trip = await tx.gmTrip.create({
        data: {
          userId,
          shipName: d.shipName,
          departureDate: new Date(d.departureDate),
          updatedAt: new Date(),
          productCode: d.productCode || '',
          cruiseName: d.cruiseName || null,
          status: 'Upcoming',
        },
        select: { id: true },
      });

      // tripCount 증가
      await tx.gmUser.update({
        where: { id: userId },
        data: { tripCount: { increment: 1 }, totalTripCount: { increment: 1 } },
      });

      return { userId, tripId: trip.id };
    });

    logger.log('[POST /api/passport/admin/create-trip]', {
      ...result,
      managerId: manager.id,
      managerRole: manager.role,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'USER_NOT_FOUND') {
      return NextResponse.json({ ok: false, message: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }
    logger.error('[POST /api/passport/admin/create-trip]', { err });
    return NextResponse.json({ ok: false, message: '등록 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
