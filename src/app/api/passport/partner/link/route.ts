export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/lib/passport-auth';
import { generatePassportToken } from '@/lib/passport-utils';
import { logger } from '@/lib/logger';

/**
 * POST: 파트너용 여권/PNR 등록 링크 생성
 * - 파트너 권한 확인
 * - 해당 고객(Lead)이 파트너의 관리 대상인지 확인
 * - 토큰 생성 및 링크 반환
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePartnerContext();
    if (!ctx) {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }
    const { profile } = ctx;
    const body = await req.json();
    const { userId, leadId } = body;

    if (!userId || !leadId) {
      return NextResponse.json({ ok: false, error: 'User ID and Lead ID are required' }, { status: 400 });
    }

    // Lead가 파트너의 관리 대상인지 확인
    const lead = await prisma.gmAffiliateLead.findUnique({
      where: { id: Number(leadId) },
      select: {
        id: true,
        managerId: true,
        agentId: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ ok: false, error: 'Lead not found' }, { status: 404 });
    }

    // 권한 체크
    let hasAccess = false;
    if (profile.type === 'BRANCH_MANAGER') {
      // 대리점장은 본인 또는 소속 판매원의 Lead 접근 가능
      if (lead.managerId === profile.id || lead.agentId === profile.id) {
        hasAccess = true;
      } else if (lead.agentId) {
        // 판매원이 본인 팀인지 확인
        const relation = await prisma.gmAffiliateRelation.findFirst({
          where: {
            managerId: profile.id,
            agentId: lead.agentId,
            status: 'ACTIVE',
          },
        });
        if (relation) hasAccess = true;
      }
    } else if (profile.type === 'SALES_AGENT') {
      // 판매원은 본인 Lead만 접근 가능
      if (lead.agentId === profile.id) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ ok: false, error: 'Access denied' }, { status: 403 });
    }

    // Trip ID 찾기 (최근 예약 기준)
    const latestReservation = await prisma.gmReservation.findFirst({
      where: { mainUserId: Number(userId) },
      orderBy: { id: 'desc' },
      select: { tripId: true },
    });

    let tripId = latestReservation?.tripId;

    if (!tripId) {
      // 예약이 없으면 gmTrip 확인
      const latestUserTrip = await prisma.gmTrip.findFirst({
        where: { userId: Number(userId) },
        orderBy: { createdAt: 'desc' },
        select: { id: true, productId: true, productCode: true },
      });

      // Trip 테이블에서 productCode로 tripId 찾기
      if (latestUserTrip?.productId) {
        const products = await prisma.$queryRaw<{ productCode: string }[]>`
          SELECT "productCode" FROM "Product" WHERE id = ${latestUserTrip.productId} LIMIT 1
        `;
        const productCode = products[0]?.productCode;
        if (productCode) {
          const trip = await prisma.gmTrip.findFirst({
            where: { productCode },
          });
          tripId = trip?.id;
        }
      } else if (latestUserTrip) {
        tripId = latestUserTrip.id;
      }
    }

    if (!tripId) {
      return NextResponse.json(
        { ok: false, error: '해당 고객의 예약 또는 여행 정보를 찾을 수 없어 여권 링크를 생성할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 토큰 생성 (기존 유효한 submission 확인 후 없으면 새로 생성)
    const existingSubmission = await prisma.gmPassportSubmission.findFirst({
      where: {
        userId: Number(userId),
        tripId: tripId,
        tokenExpiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    let token: string;
    if (existingSubmission) {
      token = existingSubmission.token;
    } else {
      token = generatePassportToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 3); // 3일 유효

      await prisma.gmPassportSubmission.create({
        data: {
          userId: Number(userId),
          tripId: tripId,
          token: token,
          tokenExpiresAt: expiresAt,
          isSubmitted: false,
        },
      });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://cruiseguide.co.kr';
    const passportLink = `${baseUrl}/passport/${token}?mode=passport`;
    const pnrLink = `${baseUrl}/passport/${token}?mode=pnr`;

    return NextResponse.json({
      ok: true,
      passportLink,
      pnrLink,
    });
  } catch (error) {
    logger.error('[Partner Passport Link] Error:', error as Record<string, unknown>);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
