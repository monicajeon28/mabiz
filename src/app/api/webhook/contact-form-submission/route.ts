export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { generateErrorId, logSafeError } from '@/lib/pii-masker';

/**
 * POST /api/webhook/contact-form-submission
 *
 * Loop 5-C 폼 제출 로깅
 * FormSubmission 테이블에 기록하여 A/B 테스트 추적
 */

interface FormSubmissionPayload {
  name: string;
  phone: string;
  email?: string | null;
  ageRange: string;
  preferenceType: string;
  variant: 'a' | 'b' | 'c';
  segment: 'A' | 'B' | 'C' | 'D' | 'E';
  completionTimeMs: number;
  timestamp: number;
  userAgent: string;
  affiliateCode?: string | null;
}

export async function POST(req: NextRequest) {
  // [P0-SEC-501] Bearer token 검증 (WEBHOOK_SECRET)
  const authHeader = req.headers.get('authorization') ?? '';
  const secret = process.env.WEBHOOK_SECRET;

  if (!secret) {
    logger.error('[ContactFormSubmission] CRITICAL: WEBHOOK_SECRET 미설정. 웹훅 수신 불가능합니다. DevOps에 연락하세요.');
    return NextResponse.json(
      { ok: false, message: 'Server configuration error' },
      { status: 500 }
    );
  }

  // [P0-SEC-502] Bearer token 형식 검증
  if (!authHeader.startsWith('Bearer ')) {
    logger.warn('[ContactFormSubmission] Bearer token 미제공 — 요청 차단');
    return NextResponse.json(
      { ok: false, message: 'Unauthorized' },
      { status: 401 }
    );
  }

  const token = authHeader.slice(7);
  if (
    token.length === 0 ||
    token.length !== secret.length ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(secret))
  ) {
    logger.warn('[ContactFormSubmission] Bearer token 불일치 — 인증 실패');
    return NextResponse.json(
      { ok: false, message: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json() as FormSubmissionPayload;

    // 필수 필드 검증
    if (!body.variant || !body.segment || !body.ageRange || !body.preferenceType) {
      return NextResponse.json(
        { ok: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // [P0-SEC-503] User-Agent 길이 제한 (DDoS/메모리 공격 방지)
    const MAX_USER_AGENT_LENGTH = 500; // 표준 UA는 150-300자
    const userAgentRaw = body.userAgent || 'unknown';
    if (userAgentRaw.length > MAX_USER_AGENT_LENGTH) {
      logger.warn('[ContactFormSubmission] User-Agent 길이 초과 — 요청 차단', {
        length: userAgentRaw.length,
        max: MAX_USER_AGENT_LENGTH,
      });
      return NextResponse.json(
        { ok: false, message: 'User-Agent too long' },
        { status: 400 }
      );
    }

    const userAgent = userAgentRaw.slice(0, 512);
    const affiliateCode = body.affiliateCode ? body.affiliateCode.slice(0, 64) : null;
    const segment = body.segment.slice(0, 8) as FormSubmissionPayload['segment'];

    // FormSubmission 레코드 생성 (A/B 테스트 추적용)
    const submission = await prisma.formSubmission.create({
      data: {
        variant: body.variant,
        segment,
        completionTimeMs: body.completionTimeMs,
        ageRange: body.ageRange.slice(0, 32),
        preferenceType: body.preferenceType.slice(0, 64),
        affiliateCode,
        userAgent,
      },
      select: { id: true, createdAt: true },
    });

    logger.log('[ContactFormSubmission]', {
      submissionId: submission.id,
      variant: body.variant,
      segment: body.segment,
      completionTimeMs: body.completionTimeMs,
      ageRange: body.ageRange,
      preferenceType: body.preferenceType,
    });

    return NextResponse.json({
      ok: true,
      submissionId: submission.id,
      createdAt: submission.createdAt.toISOString(),
    });
  } catch (err) {
    const errorId = generateErrorId();
    logSafeError(logger, err, '[ContactFormSubmission] Error');

    return NextResponse.json(
      {
        ok: false,
        message: '폼 제출을 처리할 수 없습니다',
        errorId,
        contactSupport: true,
      },
      { status: 500 }
    );
  }
}
