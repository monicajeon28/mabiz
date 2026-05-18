/**
 * Menu #38 Phase 4 Track 1: 렌탈 발송 추적 헬퍼
 * Delta SMS 3일 시퀀스 구현을 위한 utilities
 *
 * 역할:
 * - 렌탈 상품 판별 (isRentalProduct)
 * - 고객 세그먼트 변형 결정 (getSegmentVariation)
 * - SendingHistory 생성 시 필드 자동 채우기
 */

import { Contact, CrmMarketingCampaign } from '@prisma/client';

/**
 * 캠페인이 렌탈 상품 발송인지 판별
 *
 * 판별 기준:
 * 1. CrmMarketingCampaign.category === 'RENTAL'
 * 2. title에 '렌탈' 또는 'rental' 문자열 포함 (case-insensitive)
 *
 * @param campaign 마케팅 캠페인 객체
 * @returns boolean true = 렌탈 상품, false = 비렌탈
 */
export function isRentalProduct(campaign: CrmMarketingCampaign | { title: string; category?: string }): boolean {
  // category 필드가 있으면 우선 사용
  if ('category' in campaign && campaign.category === 'RENTAL') {
    return true;
  }

  // title에서 '렌탈' 문자열 검색 (case-insensitive)
  const titleLower = campaign.title.toLowerCase();
  return titleLower.includes('렌탈') || titleLower.includes('rental');
}

/**
 * 고객의 세그먼트 변형 결정 (A/B/C)
 *
 * 매핑:
 * - A: 자유여행 (FIT, 개별여행)
 * - B: 크루즈 투어
 * - C: 호텔 패키지
 *
 * 현재 구현: Contact.tags 배열에서 키워드 검색
 * 향후: travelStyle, productType 등 필드 추가 가능
 *
 * @param contact 고객 객체
 * @returns string 세그먼트 코드 ('A' | 'B' | 'C'), 기본값 'A'
 */
export function getSegmentVariation(contact: Contact | { tags?: string[] }): string {
  const tags = contact.tags || [];
  const tagLower = tags.join('|').toLowerCase();

  // B: 크루즈 태그 검색
  if (tagLower.includes('cruise') || tagLower.includes('크루즈')) {
    return 'B';
  }

  // C: 호텔 태그 검색
  if (tagLower.includes('hotel') || tagLower.includes('호텔')) {
    return 'C';
  }

  // 기본값: A (자유여행)
  return 'A';
}

/**
 * SendingHistory 레코드를 위한 렌탈 발송 정보 생성
 *
 * @param campaign 마케팅 캠페인
 * @param contact 수신 고객
 * @returns 렌탈 발송 관련 필드
 */
export function getRentalSendingData(
  campaign: CrmMarketingCampaign | { title: string; category?: string },
  contact: Contact | { tags?: string[] }
): {
  isRentalPurchase: boolean;
  isDeltaSmsEligible: boolean;
  deltaDay: number;
  segmentVariation: string;
} {
  const isRental = isRentalProduct(campaign);

  return {
    isRentalPurchase: isRental,
    isDeltaSmsEligible: isRental,  // 렌탈 = Delta SMS 3일 시퀀스 대상
    deltaDay: 0,  // 초기값: 발송일 (향후 Step 4에서 0/1/2로 업데이트)
    segmentVariation: getSegmentVariation(contact),
  };
}

/**
 * Delta Day 기반 다음 재시도 일정 계산
 *
 * Delta SMS 3일 시퀀스:
 * - Day 0: 구매 후 즉시 (Message 1)
 * - Day 1: +1일 후 (Message 2)
 * - Day 2: +2일 후 (Message 3)
 *
 * @param baseDate 기준 날짜
 * @param deltaDay 델타 일수 (0/1/2)
 * @returns Date 예정 발송 시간
 */
export function calculateDeltaScheduleTime(baseDate: Date, deltaDay: number): Date {
  const scheduled = new Date(baseDate);
  scheduled.setDate(scheduled.getDate() + deltaDay);
  return scheduled;
}

/**
 * 렌탈 발송 통계 필터링 쿼리 생성
 *
 * @param organizationId 조직 ID
 * @param includeNonRental 비렌탈 발송 포함 여부
 * @returns Prisma where 조건
 */
export function getRentalSendingHistoryFilter(
  organizationId: string,
  includeNonRental: boolean = false
) {
  const baseWhere = {
    organizationId,
    isDeltaSmsEligible: true,
  };

  if (!includeNonRental) {
    return {
      ...baseWhere,
      isRentalPurchase: true,
    };
  }

  return baseWhere;
}

/**
 * 세그먼트별 렌탈 발송 통계
 *
 * 렌탈 캠페인 발송을 세그먼트(A/B/C)별로 집계
 * - organizationId 필터: 해당 조직의 발송만
 * - isDeltaSmsEligible 필터: 렌탈 발송만
 * - 그룹핑: segmentVariation (A/B/C) + status
 *
 * 응답 구조:
 * [
 *   { segmentVariation: 'A', status: 'SENT', _count: { id: 123 } },
 *   { segmentVariation: 'A', status: 'FAILED', _count: { id: 5 } },
 *   { segmentVariation: 'B', status: 'SENT', _count: { id: 89 } },
 *   ...
 * ]
 *
 * @param organizationId 조직 ID
 * @returns 세그먼트별 발송 건수 집계 (groupBy 응답)
 */
export async function getRentalSendingStatsBySegment(organizationId: string) {
  const { db } = await import('@/lib/db');

  const stats = await db.sendingHistory.groupBy({
    by: ['segmentVariation', 'status'],
    where: {
      organizationId,
      isDeltaSmsEligible: true,  // 렌탈 발송만 필터
    },
    _count: {
      id: true,  // 발송 건수
    },
  });

  return stats;
}
