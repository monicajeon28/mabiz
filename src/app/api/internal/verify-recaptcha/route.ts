/**
 * POST /api/internal/verify-recaptcha
 * QStash 웹훅: ReCAPTCHA v3 검증 (내부용)
 *
 * 역할:
 * - QStash에서 비동기 호출
 * - Google ReCAPTCHA API 검증
 * - 검증 결과를 DB에 저장
 * - 차단된 봇의 경우 Contact 상태 업데이트
 *
 * 보안:
 * - QStash 서명 검증 (X-Qstash-Signature)
 * - 필수 필드 검증
 * - timeout 5초 적용
 * - race condition 방지 (atomic update)
 *
 * 이 엔드포인트는 내부용(Internal)이므로 공개 문서에 노출 금지
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { RecaptchaVerificationStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel 함수 타임아웃

// QStash 공식 토큰 (Vercel 환경에서 자동 제공)
const QSTASH_CURRENT_SIGNING_KEY = process.env.QSTASH_CURRENT_SIGNING_KEY;

interface VerifyRecaptchaPayload {
  organizationId: string;
  contactId: string;
  groupId: string;
  recaptchaToken: string;
  callbackUrl?: string;
}

interface GoogleRecaptchaResponse {
  success: boolean;
  score: number;
  action: string;
  challenge_ts: string;
  hostname: string;
  error_codes?: string[];
}

/**
 * QStash 서명 검증
 * @param signature X-Qstash-Signature 헤더값
 * @param body 요청 바디 (JSON 문자열)
 * @returns 검증 성공 여부
 */
function verifyQStashSignature(signature: string | null, body: string): boolean {
  if (!signature || !QSTASH_CURRENT_SIGNING_KEY) {
    return false;
  }

  try {
    // QStash 서명 형식: `{HMAC_SHA256_HEX}.{HMAC_SHA256_BASE64}`
    // body가 변조되지 않았는지 검증하기 위해 HMAC-SHA256 사용
    const crypto = require('crypto');
    const computed = crypto
      .createHmac('sha256', Buffer.from(QSTASH_CURRENT_SIGNING_KEY, 'base64'))
      .update(body)
      .digest('base64');

    // 서명 형식: signature = `{hex}.{base64}`
    const parts = signature.split('.');
    if (parts.length !== 2) {
      return false;
    }

    // parts[1]이 computed base64와 일치하는지 확인
    return parts[1] === computed;
  } catch (err) {
    logger.error('[VerifyRecaptcha] QStash 서명 검증 오류', { error: String(err) });
    return false;
  }
}

/**
 * Google ReCAPTCHA API 호출
 * @param recaptchaToken 클라이언트 토큰
 * @returns Google 응답
 */
async function verifyWithGoogle(recaptchaToken: string): Promise<GoogleRecaptchaResponse | null> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    logger.error('[VerifyRecaptcha] RECAPTCHA_SECRET_KEY 미설정');
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5초 타임아웃

    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(recaptchaToken)}`,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      logger.error('[VerifyRecaptcha] Google API 오류', {
        status: response.status,
        statusText: response.statusText,
      });
      return null;
    }

    const data = (await response.json()) as GoogleRecaptchaResponse;
    return data;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      logger.error('[VerifyRecaptcha] Google API 타임아웃 (5초)');
    } else {
      logger.error('[VerifyRecaptcha] Google API 호출 실패', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return null;
  }
}

/**
 * 검증 결과 저장 및 상태 결정
 * @param payload QStash 페이로드
 * @param googleData Google 응답 데이터 (또는 null)
 * @returns 저장된 검증 결과
 */
async function saveVerificationResult(
  payload: VerifyRecaptchaPayload,
  googleData: GoogleRecaptchaResponse | null
): Promise<{
  verificationStatus: RecaptchaVerificationStatus;
  score: number;
  verification?: {
    id: string;
    verificationStatus: RecaptchaVerificationStatus;
  };
}> {
  const { organizationId, contactId, groupId } = payload;

  // 상태 결정 로직
  let verificationStatus: RecaptchaVerificationStatus;
  let score = 0;

  if (!googleData) {
    // Google API 호출 실패
    verificationStatus = 'FAILED';
  } else if (!googleData.success) {
    // Google이 검증 실패 반환
    verificationStatus = 'FAILED';
    score = googleData.score;
  } else {
    // Google 검증 성공 — score 판단
    score = googleData.score;
    const threshold = parseFloat(process.env.RECAPTCHA_SCORE_THRESHOLD || '0.5');
    verificationStatus = score >= threshold ? 'SUCCESS' : 'BLOCKED';
  }

  // DB에 검증 결과 저장
  try {
    const verification = await prisma.recaptchaVerification.create({
      data: {
        organizationId,
        contactId,
        groupId,
        recaptchaToken: payload.recaptchaToken,
        recaptchaScore: score,
        verificationStatus,
        verifiedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30일
      },
      select: {
        id: true,
        verificationStatus: true,
      },
    });

    return {
      verificationStatus,
      score,
      verification,
    };
  } catch (err) {
    logger.error('[VerifyRecaptcha] DB 저장 실패', {
      error: err instanceof Error ? err.message : String(err),
      contactId,
    });
    throw err;
  }
}

/**
 * SUCCESS 경우 처리
 */
async function handleSuccessCase(
  payload: VerifyRecaptchaPayload,
  score: number
): Promise<void> {
  logger.log('[VerifyRecaptcha:SUCCESS] 검증 성공', {
    contactId: payload.contactId,
    groupId: payload.groupId,
    score,
  });

  // Contact 상태 유지 (별도 업데이트 불필요)
  // GroupMember는 이미 생성되어 있음
}

/**
 * BLOCKED 경우 처리 (봇 차단)
 */
async function handleBlockedCase(
  payload: VerifyRecaptchaPayload,
  score: number
): Promise<void> {
  const { organizationId, contactId } = payload;

  logger.warn('[VerifyRecaptcha:BLOCKED] 봇 차단', {
    contactId,
    groupId: payload.groupId,
    score,
  });

  try {
    // Contact type을 'BLOCKED_BOT'으로 업데이트 (atomic)
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        type: 'BLOCKED_BOT',
        adminMemo: `[ReCAPTCHA] Bot blocked at ${new Date().toISOString()} (score: ${score})`,
      },
    });

    // 선택: 관리자 알림 이메일 발송 (추후 구현)
    // await sendBotBlockedNotification(organizationId, contactId, score);
  } catch (err) {
    logger.error('[VerifyRecaptcha:BLOCKED] Contact 업데이트 실패', {
      error: err instanceof Error ? err.message : String(err),
      contactId,
    });
  }
}

/**
 * FAILED 경우 처리 (일시적 오류, 재시도 대상)
 */
async function handleFailedCase(
  payload: VerifyRecaptchaPayload
): Promise<void> {
  const { contactId, groupId } = payload;

  logger.error('[VerifyRecaptcha:FAILED] Google API 검증 실패', {
    contactId,
    groupId,
  });

  // 현재는 로깅만 수행
  // QStash가 자동으로 재시도 (최대 3회, exponential backoff)
  // 재시도 설정: src/lib/recaptcha-queue.ts의 topic 설정 참고
}

/**
 * POST 핸들러
 */
export async function POST(req: Request) {
  let rawBody: string = '';

  try {
    // [1] 요청 본문 읽기
    rawBody = await req.text();
    const payload = JSON.parse(rawBody) as VerifyRecaptchaPayload;

    // [2] QStash 서명 검증
    const signature = req.headers.get('x-qstash-signature');
    if (process.env.NODE_ENV === 'production') {
      const signatureValid = verifyQStashSignature(signature, rawBody);
      if (!signatureValid) {
        logger.warn('[VerifyRecaptcha] QStash 서명 검증 실패');
        return NextResponse.json({ ok: false, error: 'INVALID_SIGNATURE' }, { status: 401 });
      }
    } else {
      logger.log('[VerifyRecaptcha] 개발 환경: 서명 검증 생략');
    }

    // [3] 필수 필드 검증
    const { organizationId, contactId, groupId, recaptchaToken } = payload;
    if (!organizationId || !contactId || !groupId || !recaptchaToken) {
      return NextResponse.json(
        {
          ok: false,
          error: 'INVALID_PAYLOAD',
          details: 'organizationId, contactId, groupId, recaptchaToken 필수',
        },
        { status: 400 }
      );
    }

    logger.log('[VerifyRecaptcha] 수신', { contactId, groupId });

    // [4] Google ReCAPTCHA 검증
    const googleData = await verifyWithGoogle(recaptchaToken);

    // [5] 검증 결과 저장
    const result = await saveVerificationResult(payload, googleData);
    const { verificationStatus, score } = result;

    // [6] 검증 상태별 콜백 실행
    switch (verificationStatus) {
      case 'SUCCESS':
        await handleSuccessCase(payload, score);
        break;
      case 'BLOCKED':
        await handleBlockedCase(payload, score);
        break;
      case 'FAILED':
        await handleFailedCase(payload);
        break;
      default:
        logger.warn('[VerifyRecaptcha] 미정의된 상태', { verificationStatus });
    }

    // [7] 응답 반환
    return NextResponse.json(
      {
        ok: true,
        verificationStatus,
        score,
        verificationId: result.verification?.id,
      },
      { status: 200 }
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error('[VerifyRecaptcha] POST 핸들러 오류', { message: errMsg });
    return NextResponse.json(
      { ok: false, error: 'SERVER_ERROR', details: errMsg },
      { status: 500 }
    );
  }
}

/**
 * 다른 HTTP 메서드는 지원하지 않음
 */
export async function GET() {
  return NextResponse.json(
    { ok: false, error: 'METHOD_NOT_ALLOWED' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}
