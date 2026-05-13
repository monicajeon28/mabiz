/**
 * WelcomePayments 결제 서비스
 *
 * 기능:
 * - HMAC-SHA256 서명 검증
 * - 결제 상태 조회 (추후 API 통합)
 * - 환경변수 관리
 *
 * 환경변수:
 * - WELCOMEPAYMENTS_SECRET_KEY: 웰컴페이먼츠 시크릿 키
 * - WELCOMEPAYMENTS_MERCHANT_KEY: 상인 키 (선택사항)
 *
 * 보안:
 * - Constant-time 비교로 타이밍 공격 방지
 * - HMAC-SHA256으로 메시지 위변조 검증
 * - 서명 검증 실패 시 로깅 (민감정보 제외)
 */

import crypto from 'crypto';
import { logger } from '@/lib/logger';

/**
 * WelcomePayments 서명 검증 (HMAC-SHA256)
 *
 * @param params - 검증할 파라미터 객체
 * @param signature - 클라이언트에서 전달한 서명
 * @returns 검증 성공 여부
 *
 * 예시:
 * const isValid = validateWelcomePaymentsSignature(
 *   { tid: 'tid123', orderId: 'order456', amount: '10000', status: 'paid' },
 *   'abc123def456...'
 * );
 */
export function validateWelcomePaymentsSignature(
  params: Record<string, any>,
  signature: string
): boolean {
  try {
    const secretKey = process.env.WELCOMEPAYMENTS_SECRET_KEY;

    if (!secretKey) {
      logger.warn('[WelcomePayments] 시크릿 키 미설정 (WELCOMEPAYMENTS_SECRET_KEY)');
      return false;
    }

    // 서명 검증 파라미터: tid|orderId|amount|status 순서
    const signatureData = [
      String(params.tid || ''),
      String(params.orderId || ''),
      String(params.amount || ''),
      String(params.status || 'pending'),
    ].join('|');

    // HMAC-SHA256 계산
    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(signatureData);
    const expectedSignature = hmac.digest('hex');

    // Constant-time 비교 (타이밍 공격 방지)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signature)
    );

    if (!isValid) {
      logger.warn('[WelcomePayments] 서명 검증 실패:', {
        orderId: params.orderId,
        signatureLength: signature.length,
      });
    }

    return isValid;
  } catch (error) {
    logger.error('[WelcomePayments] 서명 검증 중 오류:', {
      error: error instanceof Error ? error.message : String(error),
      orderId: params.orderId,
    });
    return false;
  }
}

/**
 * 결제 상태 파싱
 *
 * @param status - WelcomePayments 상태 코드
 * @returns 정규화된 상태
 */
export function parseWelcomePaymentsStatus(status?: string): string {
  if (!status) return 'pending';

  const statusMap: Record<string, string> = {
    paid: 'paid',
    success: 'paid',
    completed: 'paid',
    '0': 'paid', // 결제 완료
    pending: 'pending',
    '1': 'pending', // 대기중
    failed: 'failed',
    failure: 'failed',
    '-1': 'failed', // 실패
    cancelled: 'cancelled',
    cancel: 'cancelled',
    '-2': 'cancelled', // 취소
    refunded: 'refunded',
    '2': 'refunded', // 환불
    partial_refunded: 'partial_refunded',
  };

  return statusMap[status.toLowerCase()] || status;
}

/**
 * 웰컴페이먼츠 API 호출 (추후 구현)
 *
 * @param tid - 거래 ID
 * @returns 결제 정보
 */
export async function getWelcomePaymentsStatus(tid: string): Promise<any> {
  try {
    // TODO: WelcomePayments API 문서에 따라 구현
    // - GET /v1/transactions/{tid}
    // - Authorization: Bearer {API_KEY}
    // - Response: { status, amount, orderId, payMethod, ... }

    logger.log('[WelcomePayments] 결제 상태 조회 (미구현):', { tid });
    return null;
  } catch (error) {
    logger.error('[WelcomePayments] 결제 상태 조회 실패:', {
      error: error instanceof Error ? error.message : String(error),
      tid,
    });
    return null;
  }
}
