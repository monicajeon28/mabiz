/**
 * src/lib/recaptcha-queue.ts
 * ReCAPTCHA 검증을 Upstash QStash 비동기 큐에 등록하는 클라이언트
 *
 * 특징:
 * - QStash REST API를 직접 호출 (SDK 의존도 최소화)
 * - 5초 지연 후 ReCAPTCHA 검증 실행
 * - 3회 자동 재시도 (지수 백오프)
 * - 웹훅 서명 검증으로 보안 보장
 *
 * 환경변수 필수:
 *   QSTASH_TOKEN           - Upstash QStash API 토큰
 *   QSTASH_CURRENT_SIGNING_KEY - 현재 서명 키
 *   QSTASH_NEXT_SIGNING_KEY    - 다음 서명 키 (롤오버 시)
 *   NEXT_PUBLIC_APP_URL    - 외부에서 접근 가능한 도메인
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { logger } from '@/lib/logger';

// QStash 설정
const QSTASH_API_BASE = 'https://qstash.io/v2/publish';
const QSTASH_TOKEN = process.env.QSTASH_TOKEN;
const QSTASH_CURRENT_SIGNING_KEY = process.env.QSTASH_CURRENT_SIGNING_KEY;
const QSTASH_NEXT_SIGNING_KEY = process.env.QSTASH_NEXT_SIGNING_KEY;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://mabizcruisedot.com';
const RECAPTCHA_WEBHOOK_PATH = '/api/internal/verify-recaptcha';

// ============================================================================
// 타입 정의
// ============================================================================

export interface RecaptchaVerificationPayload {
  /** 조직 ID */
  organizationId: string;
  /** 연락처 ID */
  contactId: string;
  /** 그룹 ID */
  groupId: string;
  /** 클라이언트로부터 받은 ReCAPTCHA 토큰 */
  recaptchaToken: string;
  /** QStash가 전송할 콜백 URL (자동 생성) */
  callbackUrl?: string;
  /** 추가 메타데이터 */
  metadata?: {
    [key: string]: unknown;
  };
}

export interface EnqueueResponse {
  /** 큐에 등록된 작업의 고유 ID */
  taskId: string;
  /** 스케줄된 실행 시간 (ISO 8601) */
  scheduledAt: string;
  /** QStash 응답 (원본) */
  qstashResponse?: unknown;
}

export interface QStashSignatureVerifyResult {
  ok: boolean;
  reason?: string;
}

// ============================================================================
// QStash 클라이언트 초기화
// ============================================================================

/**
 * QStash REST 클라이언트 초기화
 * - 환경변수 검증
 * - 기본 헤더 설정
 *
 * @throws Error - 필수 환경변수가 없으면 throw
 */
export function initQStashClient(): {
  token: string;
  currentSigningKey: string;
  nextSigningKey: string | undefined;
} {
  if (!QSTASH_TOKEN) {
    throw new Error('QSTASH_TOKEN 환경변수가 설정되지 않았습니다');
  }

  if (!QSTASH_CURRENT_SIGNING_KEY) {
    throw new Error('QSTASH_CURRENT_SIGNING_KEY 환경변수가 설정되지 않았습니다');
  }

  logger.log('[QStash] 클라이언트 초기화 완료', {
    token: QSTASH_TOKEN.slice(0, 10) + '***',
    keyPresent: !!QSTASH_CURRENT_SIGNING_KEY,
  });

  return {
    token: QSTASH_TOKEN,
    currentSigningKey: QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: QSTASH_NEXT_SIGNING_KEY,
  };
}

// ============================================================================
// 공개 API: 큐에 ReCAPTCHA 검증 작업 등록
// ============================================================================

/**
 * ReCAPTCHA 검증을 QStash 큐에 등록
 *
 * 동작:
 * - callbackUrl이 없으면 자동 생성 (createRecaptchaWebhookUrl)
 * - payload를 JSON으로 직렬화
 * - 5초 지연(Delay: "5s")하여 QStash에 POST
 * - 3회 재시도(Retries: 3)
 * - 응답에서 MessageId 추출하여 taskId 반환
 *
 * @param payload - ReCAPTCHA 검증 요청 정보
 * @returns EnqueueResponse - { taskId, scheduledAt }
 * @throws Error - QStash 요청 실패 시 throw
 */
export async function enqueueRecaptchaVerification(
  payload: RecaptchaVerificationPayload,
): Promise<EnqueueResponse> {
  try {
    // 1) 환경변수 검증
    const client = initQStashClient();

    // 2) callbackUrl 생성 또는 사용
    const finalPayload: RecaptchaVerificationPayload = {
      ...payload,
      callbackUrl: payload.callbackUrl || createRecaptchaWebhookUrl(),
    };

    // 3) 요청 헤더 구성
    const headers: HeadersInit = {
      'Authorization': `Bearer ${client.token}`,
      'Content-Type': 'application/json',
      'Delay': '5s', // 5초 후 실행
      'Retries': '3', // 3회 재시도
    };

    // 4) QStash에 POST 요청
    const response = await fetch(QSTASH_API_BASE, {
      method: 'POST',
      headers,
      body: JSON.stringify(finalPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `QStash 요청 실패: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    // 5) 응답 파싱
    const data = (await response.json()) as {
      MessageId?: string;
      [key: string]: unknown;
    };

    const taskId = data.MessageId || `task-${Date.now()}`;
    const scheduledAt = new Date(Date.now() + 5000).toISOString();

    logger.log('[Recaptcha Queue] 작업 등록 완료', {
      taskId,
      organizationId: payload.organizationId,
      contactId: payload.contactId,
      scheduledAt,
    });

    return {
      taskId,
      scheduledAt,
      qstashResponse: data,
    };
  } catch (err) {
    logger.error('[Recaptcha Queue] 작업 등록 실패', {
      err,
      organizationId: payload.organizationId,
      contactId: payload.contactId,
    });
    throw err;
  }
}

// ============================================================================
// 공개 API: QStash 웹훅 서명 검증
// ============================================================================

/**
 * QStash 웹훅의 X-Qstash-Signature 헤더를 검증
 *
 * 동작:
 * - 현재 서명 키로 검증 시도
 * - 실패하면 다음 서명 키로 재시도 (키 롤오버 지원)
 * - HMAC-SHA256 기반 서명
 * - timing-safe 비교로 타이밍 공격 방지
 *
 * @param signature - X-Qstash-Signature 헤더값
 * @param body - raw request body (Buffer)
 * @returns QStashSignatureVerifyResult
 */
export function verifyQStashSignature(
  signature: string | null | undefined,
  body: Buffer,
): QStashSignatureVerifyResult {
  try {
    // 1) 환경변수 검증
    const client = initQStashClient();

    // 2) 서명 헤더 확인
    if (!signature) {
      return {
        ok: false,
        reason: 'X-Qstash-Signature 헤더가 없습니다',
      };
    }

    // 3) 현재 서명 키로 검증
    const verifyWithKey = (key: string): boolean => {
      const expected = createHmac('sha256', key)
        .update(body)
        .digest('base64');

      // 길이가 다르면 timingSafeEqual이 throw — 먼저 길이 확인
      if (expected.length !== signature.length) {
        return false;
      }

      try {
        const match = timingSafeEqual(
          Buffer.from(expected),
          Buffer.from(signature),
        );
        return match;
      } catch {
        return false;
      }
    };

    // 4) 현재 키로 검증
    if (verifyWithKey(client.currentSigningKey)) {
      logger.log('[Recaptcha Queue] 서명 검증 성공 (현재 키)');
      return { ok: true };
    }

    // 5) 다음 키로 검증 (롤오버 중일 때)
    if (client.nextSigningKey && verifyWithKey(client.nextSigningKey)) {
      logger.log('[Recaptcha Queue] 서명 검증 성공 (다음 키)');
      return { ok: true };
    }

    // 6) 모든 키 실패
    return {
      ok: false,
      reason: '서명 검증 실패 - 모든 키와 불일치',
    };
  } catch (err) {
    logger.error('[Recaptcha Queue] 서명 검증 중 오류', { err });
    return {
      ok: false,
      reason: `서명 검증 오류: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ============================================================================
// 유틸리티: 웹훅 URL 생성
// ============================================================================

/**
 * ReCAPTCHA 검증 웹훅 URL 생성
 * - 현재 도메인 + "/api/internal/verify-recaptcha"
 * - localhost 제외 (외부 호출 가능한 URL만)
 * - 프로덕션/스테이징: NEXT_PUBLIC_APP_URL 사용
 *
 * @returns 웹훅 URL (예: https://mabizcruisedot.com/api/internal/verify-recaptcha)
 */
export function createRecaptchaWebhookUrl(): string {
  const baseUrl = APP_URL;

  if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
    logger.warn('[Recaptcha Queue] localhost 도메인 감지 - 외부 호출 불가능', {
      baseUrl,
    });
  }

  const url = new URL(RECAPTCHA_WEBHOOK_PATH, baseUrl).toString();
  logger.log('[Recaptcha Queue] 웹훅 URL 생성', { url });
  return url;
}

// ============================================================================
// 헬퍼: QStash 웹훅 payload 검증 및 파싱
// ============================================================================

/**
 * QStash 웹훅 요청의 body를 안전하게 파싱
 *
 * @param body - raw request body (Buffer)
 * @returns 파싱된 RecaptchaVerificationPayload
 * @throws Error - JSON 파싱 실패 시
 */
export function parseRecaptchaPayload(body: Buffer): RecaptchaVerificationPayload {
  try {
    const text = body.toString('utf-8');
    const data = JSON.parse(text);

    // 필수 필드 검증
    if (!data.organizationId || !data.contactId || !data.groupId || !data.recaptchaToken) {
      throw new Error('필수 필드가 누락되었습니다');
    }

    return data as RecaptchaVerificationPayload;
  } catch (err) {
    logger.error('[Recaptcha Queue] Payload 파싱 실패', { err });
    throw new Error(
      `Payload 파싱 실패: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ============================================================================
// 디버깅: 환경변수 체크
// ============================================================================

/**
 * QStash 환경변수 설정 상태 확인 (로깅용)
 */
export function checkQStashConfig(): {
  token: boolean;
  currentSigningKey: boolean;
  nextSigningKey: boolean;
  appUrl: string;
} {
  return {
    token: !!QSTASH_TOKEN,
    currentSigningKey: !!QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: !!QSTASH_NEXT_SIGNING_KEY,
    appUrl: APP_URL,
  };
}
