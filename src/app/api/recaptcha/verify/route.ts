/**
 * QStash ReCAPTCHA 검증 엔드포인트
 * - QStash에서 호출됨 (비동기 백그라운드 작업)
 * - ReCAPTCHA v3 토큰을 검증하고 결과를 DB에 기록
 * - 검증 실패 시: ContactGroupMember 자동 삭제는 하지 않음 (사용자 이미 가입됨)
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface RecaptchaVerificationPayload {
  organizationId: string;
  contactId: string;
  groupId: string;
  recaptchaToken: string;
  callbackUrl?: string;
}

export async function POST(req: Request) {
  try {
    // QStash 서명 검증 (X-Qstash-Signature 헤더)
    const signature = req.headers.get('x-qstash-signature');
    if (!signature && process.env.NODE_ENV === 'production') {
      logger.warn('[RecaptchaVerify] Missing QStash signature header');
      return NextResponse.json(
        { ok: false, error: 'INVALID_SIGNATURE' },
        { status: 401 }
      );
    }

    const payload: RecaptchaVerificationPayload = await req.json();
    const { organizationId, contactId, groupId, recaptchaToken } = payload;

    if (!organizationId || !contactId || !groupId || !recaptchaToken) {
      return NextResponse.json(
        { ok: false, error: 'INVALID_PAYLOAD' },
        { status: 400 }
      );
    }

    // ReCAPTCHA v3 검증
    const recaptchaResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`,
    });

    const recaptchaData = await recaptchaResponse.json() as {
      success: boolean;
      score: number;
      action: string;
      challenge_ts: string;
      hostname: string;
      error_codes?: string[];
    };

    const passed: boolean = recaptchaData.success && recaptchaData.score >= 0.5;

    // 검증 결과 로깅
    logger.log('[RecaptchaVerify] ReCAPTCHA 검증 완료', {
      contactId,
      groupId,
      passed,
      score: recaptchaData.score,
      action: recaptchaData.action,
    });

    // DB에 검증 결과 기록 (향후 분석용)
    // 현재는 로깅만 하고, 실패 시에도 Contact는 유지됨
    // (Contact/GroupMember는 이미 생성되어 있음)

    // 콜백 URL이 있으면 호출 (선택)
    if (payload.callbackUrl && passed) {
      try {
        await fetch(payload.callbackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contactId,
            groupId,
            verified: true,
            score: recaptchaData.score,
          }),
        });
      } catch (err) {
        logger.error('[RecaptchaVerify] Callback URL 호출 실패', { err });
        // 콜백 실패는 무시함 (검증 자체는 성공)
      }
    }

    return NextResponse.json(
      {
        ok: true,
        verified: passed,
        score: recaptchaData.score,
        contactId,
        groupId,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error('[POST /api/recaptcha/verify]', { message: errMsg });
    return NextResponse.json(
      { ok: false, error: 'SERVER_ERROR', message: errMsg },
      { status: 500 }
    );
  }
}
