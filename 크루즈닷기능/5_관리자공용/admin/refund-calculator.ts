/**
 * 환불 정책 계산 헬퍼 (관리자용)
 * 상품의 구조화된 환불정책을 기반으로 환불금액 계산
 */

import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';

export interface RefundSlot {
  dayRange: { min: number; max: number };  // 0-7일, 8-14일 등
  refundPercent: number;                   // 80, 50, 30
}

export interface RefundCalculationInput {
  saleAmount: number;
  daysSincePurchase: number;
  refundPolicy: Prisma.JsonValue;  // DB에서 가져온 구조화된 정책
}

export function calculateRefundAmount(input: RefundCalculationInput): {
  refundAmount: number;
  refundPercent: number;
  reason: string;
} {
  const { saleAmount, daysSincePurchase, refundPolicy } = input;

  // Step 1: 입력값 기본 검증
  if (saleAmount < 0) {
    logger.error('[RefundCalculator] Invalid saleAmount (negative)', { saleAmount });
    return { refundAmount: 0, refundPercent: 0, reason: '입력값 오류' };
  }

  if (daysSincePurchase < 0) {
    logger.error('[RefundCalculator] Invalid daysSincePurchase (negative)', { daysSincePurchase });
    return { refundAmount: 0, refundPercent: 0, reason: '입력값 오류' };
  }

  // Step 2: refundPolicy 파싱 (타입 가드 추가)
  let slots: RefundSlot[] = [];

  if (refundPolicy && typeof refundPolicy === 'object' && !Array.isArray(refundPolicy)) {
    // refundPolicy가 객체일 때만 slots 추출 시도
    const policy = refundPolicy as Record<string, unknown>;
    if (Array.isArray(policy.slots)) {
      slots = policy.slots as RefundSlot[];
    }
  }

  // Step 3: 슬롯 배열 유효성 검증
  if (!Array.isArray(slots) || slots.length === 0) {
    logger.debug('[RefundCalculator] No refund policy defined', { daysSincePurchase });
    return { refundAmount: 0, refundPercent: 0, reason: '환불 기간 만료' };
  }

  // Step 4: 매칭 슬롯 찾기
  const matchedSlot = slots.find(s =>
    daysSincePurchase >= s.dayRange.min && daysSincePurchase <= s.dayRange.max
  );

  if (!matchedSlot) {
    logger.debug('[RefundCalculator] No matching policy', { daysSincePurchase });
    return { refundAmount: 0, refundPercent: 0, reason: '환불 기간 만료' };
  }

  // Step 5: refundPercent 범위 검증
  if (matchedSlot.refundPercent < 0 || matchedSlot.refundPercent > 100) {
    logger.error('[RefundCalculator] Invalid refundPercent', {
      refundPercent: matchedSlot.refundPercent
    });
    return { refundAmount: 0, refundPercent: 0, reason: '입력값 오류' };
  }

  // 최종 계산
  const refundAmount = Math.floor(saleAmount * matchedSlot.refundPercent / 100);

  return {
    refundAmount,
    refundPercent: matchedSlot.refundPercent,
    reason: `${daysSincePurchase}일: ${matchedSlot.refundPercent}% 환불`
  };
}
