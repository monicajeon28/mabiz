/**
 * 고객 여정 추적 시스템
 * 고객이 한 그룹에서 다른 그룹으로 이동할 때 자동으로 기록
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export type CustomerGroup =
  | 'prospects'         // 잠재고객 (마케팅 랜딩페이지 고객)
  | 'landing-page'      // 랜딩페이지 고객 (prospects와 동일하지만 구분)
  | 'trial'             // 크루즈가이드 3일 체험 고객 (잠재고객)
  | 'mall'              // 크루즈몰 고객 (잠재고객)
  | 'purchase'          // 크루즈가이드 지니 구매고객
  | 'refund'            // 환불고객
  | 'manager-customers' // 대리점장 소유 고객 (소유권 기반)
  | 'agent-customers'   // 판매원 소유 고객 (소유권 기반)
  | null;               // 초기 상태

export type TriggerType =
  | 'reservation_created'    // 예약 생성
  | 'certificate_issued'     // 인증서 발급
  | 'refund_processed'       // 환불 처리
  | 'manual'                 // 관리자 수동 변경
  | 'auto';                   // 자동 전환

/**
 * 고객의 현재 그룹 판단
 */
export async function getCurrentCustomerGroup(userId: number): Promise<CustomerGroup> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      customerStatus: true,
      customerSource: true,
      testModeStartedAt: true,
      role: true,
      mallUserId: true,
      Reservation: {
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!user) return null;

  // 1. 환불고객 (최우선)
  if (user.customerStatus === 'refunded') {
    return 'refund';
  }

  // 2. 구매고객
  if (user.customerStatus === 'purchase_confirmed' || (user.Reservation && user.Reservation.length > 0)) {
    return 'purchase';
  }

  // 3. 3일 체험 고객
  if (user.customerSource === 'test-guide' || user.testModeStartedAt) {
    return 'trial';
  }

  // 4. 크루즈몰 고객
  if (user.role === 'community' || user.mallUserId) {
    return 'mall';
  }

  // 5. 랜딩페이지 고객
  if (user.customerSource === 'landing-page') {
    return 'landing-page';
  }

  return null;
}

/**
 * 고객 여정 기록
 */
export async function recordCustomerJourney(
  userId: number,
  toGroup: CustomerGroup,
  triggerType: TriggerType,
  options?: {
    triggerId?: number;
    triggerDescription?: string;
    metadata?: any;
  }
): Promise<void> {
  if (!toGroup) return; // null 그룹은 기록하지 않음

  try {
    // 현재 그룹 확인
    const currentGroup = await getCurrentCustomerGroup(userId);

    // 같은 그룹이면 기록하지 않음
    if (currentGroup === toGroup) {
      return;
    }

    // 여정 기록
    await prisma.customerJourney.create({
      data: {
        userId,
        fromGroup: currentGroup,
        toGroup,
        triggerType,
        triggerId: options?.triggerId || null,
        triggerDescription: options?.triggerDescription || null,
        metadata: options?.metadata || null,
      },
    });

    logger.log(`[Customer Journey] User ${userId}: ${currentGroup} → ${toGroup} (${triggerType})`);
  } catch (error) {
    logger.error(`[Customer Journey] Failed to record journey for user ${userId}:`, error);
    // 에러가 발생해도 메인 로직은 계속 진행
  }
}

/**
 * 고객 여정 히스토리 조회
 */
export async function getCustomerJourneyHistory(userId: number) {
  return await prisma.customerJourney.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * 그룹별 고객 수 조회
 * 성능 최적화: N+1 쿼리 문제 해결 - 이미 가져온 데이터로 직접 계산
 */
export async function getCustomerCountByGroup(): Promise<Record<string, number>> {
  const users = await prisma.user.findMany({
    where: {
      role: { not: 'admin' },
    },
    select: {
      id: true,
      customerStatus: true,
      customerSource: true,
      testModeStartedAt: true,
      role: true,
      mallUserId: true,
      Reservation: {
        select: { id: true },
        take: 1,
      },
    },
  });

  const counts: Record<string, number> = {
    'prospects': 0, // landing-page를 prospects로 매핑
    'trial': 0,
    'mall': 0,
    'purchase': 0,
    'refund': 0,
    'manager-customers': 0,
    'agent-customers': 0,
  };

  // 성능 최적화: getCurrentCustomerGroup를 호출하지 않고 이미 가져온 데이터로 직접 계산
  // 이렇게 하면 N+1 쿼리 문제를 해결할 수 있습니다
  for (const user of users) {
    let group: CustomerGroup | 'landing-page' | null = null;

    // getCurrentCustomerGroup 로직을 인라인으로 구현 (이미 데이터가 있으므로 추가 쿼리 불필요)
    // 1. 환불고객 (최우선)
    if (user.customerStatus === 'refunded') {
      group = 'refund';
    }
    // 2. 구매고객
    else if (user.customerStatus === 'purchase_confirmed' || (user.Reservation && user.Reservation.length > 0)) {
      group = 'purchase';
    }
    // 3. 3일 체험 고객
    else if (user.customerSource === 'test-guide' || user.testModeStartedAt) {
      group = 'trial';
    }
    // 4. 크루즈몰 고객 (정확한 조건: role이 'community'이고 customerSource가 'mall-signup')
    else if (user.role === 'community' && user.customerSource === 'mall-signup') {
      group = 'mall';
    }
    // 5. 랜딩페이지 고객
    else if (user.customerSource === 'landing-page') {
      group = 'landing-page';
    }

    // 그룹 카운트 증가
    if (group) {
      // landing-page는 prospects로 매핑
      if (group === 'landing-page') {
        counts['prospects'] = (counts['prospects'] || 0) + 1;
      } else if (counts.hasOwnProperty(group)) {
        counts[group] = (counts[group] || 0) + 1;
      }
    } else {
      // 그룹이 없으면 prospects로 분류
      counts['prospects'] = (counts['prospects'] || 0) + 1;
    }
  }

  return counts;
}
