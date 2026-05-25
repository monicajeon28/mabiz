export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { checkRateLimitAsync } from '@/lib/rate-limit';

/**
 * GET /api/passport/public/passport-upload
 * 파트너가 고객에게 보낸 링크를 통해 여권 업로드 페이지로 리다이렉트
 * Public API — 토큰 기반, 인증 없음
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get('leadId');
    const partnerId = searchParams.get('partnerId');

    if (!leadId) {
      return NextResponse.json(
        { ok: false, error: '고객 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const parsedLeadId = Number(leadId);
    if (isNaN(parsedLeadId)) {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 고객 ID입니다.' },
        { status: 400 }
      );
    }

    // Rate Limit — 브루트포스 공격 방지 (leadId당 5분에 5회)
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
    const rateLimitKey = `passport:${parsedLeadId}:${clientIp}`;
    const rateLimitResult = await checkRateLimitAsync(rateLimitKey, 5, 5 * 60 * 1000);

    if (!rateLimitResult.allowed) {
      logger.warn('[Public Passport Upload] Rate limit exceeded', {
        leadId: parsedLeadId,
        clientIp,
      });
      return NextResponse.json(
        { ok: false, error: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      );
    }

    // 고객 정보 확인
    const lead = await prisma.gmAffiliateLead.findUnique({
      where: { id: parsedLeadId },
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
      },
    });

    if (!lead) {
      return NextResponse.json(
        { ok: false, error: '고객을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 안전한 토큰 생성
    const token = randomBytes(32).toString('hex');

    // PassportUploadToken 테이블에 upsert (raw query — Prisma 모델 미정의)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.$executeRaw`
      INSERT INTO "PassportUploadToken" ("token", "leadId", "expiresAt", "createdAt", "updatedAt")
      VALUES (${token}, ${parsedLeadId}, ${expiresAt}, NOW(), NOW())
      ON CONFLICT ("leadId")
      DO UPDATE SET "token" = ${token}, "expiresAt" = ${expiresAt}, "updatedAt" = NOW()
    `;

    const redirectUrl = `/passport/${token}?leadId=${leadId}${partnerId ? `&partnerId=${partnerId}` : ''}`;

    return NextResponse.redirect(new URL(redirectUrl, req.url));
  } catch (error) {
    const err = error as Record<string, unknown>;
    logger.error('[Public Passport Upload] GET error:', { err });
    return NextResponse.json(
      { ok: false, error: '여권 업로드 페이지로 이동할 수 없습니다.' },
      { status: 500 }
    );
  }
}
