export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

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
  try {
    const body = await req.json() as FormSubmissionPayload;

    // 필수 필드 검증
    if (!body.variant || !body.segment || !body.ageRange || !body.preferenceType) {
      return NextResponse.json(
        { ok: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // FormSubmission 레코드 생성 (A/B 테스트 추적용)
    const submission = await prisma.formSubmission.create({
      data: {
        variant: body.variant,
        segment: body.segment,
        completionTimeMs: body.completionTimeMs,
        ageRange: body.ageRange,
        preferenceType: body.preferenceType,
        affiliateCode: body.affiliateCode || null,
        userAgent: body.userAgent || 'unknown',
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
    logger.error('[ContactFormSubmission] Error', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });

    return NextResponse.json(
      { ok: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
