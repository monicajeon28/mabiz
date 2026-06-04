/**
 * 세그먼트별 상품 추천 로직
 * segment-detector.ts의 detectSegment() 결과 활용
 */

import { CRUISE_PRODUCTS, ProductCode } from "@/constants/products";
import type { Segment } from "@/lib/segment-detector";

export interface ProductRecommendation {
  productCode: ProductCode;
  reason: string;
  rank: "primary" | "secondary";
}

/**
 * 고객 세그먼트별 상품 추천 로직
 *
 * A: 30대 커플 → AI_PACKAGE (특별한 경험) + GOLD_MEMBERSHIP (자주 이용)
 * B: 40대 가족 → AI_PACKAGE (가족 안전) + FREE_TRAVEL (자유로운 일정)
 * C: 중년 부부 → GOLD_MEMBERSHIP (자주 가면 저렴) + AI_PACKAGE (특별한 기념일)
 * D: 50-60대 → BASIC_PACKAGE (가성비) + AI_PACKAGE (건강 관리)
 * E: 60대+ → AI_PACKAGE (안전/스탭) + ABC_COURSE (렌탈 필요)
 */
export function recommendProducts(segment: Segment): ProductRecommendation[] {
  const recommendations: Record<Segment, ProductRecommendation[]> = {
    A: [
      {
        productCode: "AI_PACKAGE",
        reason: "스탭과 함께 특별한 경험을 원하는 30대 커플에게 최고의 선택",
        rank: "primary",
      },
      {
        productCode: "GOLD_A",
        reason: "자주 여행 가신다면 구독으로 매번 저렴하게",
        rank: "secondary",
      },
    ],
    B: [
      {
        productCode: "AI_PACKAGE",
        reason: "40대 가족의 안전과 편의를 위해 스탭 동반 추천",
        rank: "primary",
      },
      {
        productCode: "FREE_TRAVEL",
        reason: "가족이 원하는 자유로운 일정으로 자신감 있게",
        rank: "secondary",
      },
    ],
    C: [
      {
        productCode: "GOLD_A",
        reason: "중년 부부의 꾸준한 여행 취향에 최적화된 구독형",
        rank: "primary",
      },
      {
        productCode: "AI_PACKAGE",
        reason: "특별한 기념일에는 스탭 서비스로 럭셔리하게",
        rank: "secondary",
      },
    ],
    D: [
      {
        productCode: "GOLD_BASIC",
        reason: "50-60대의 건강 관리와 가성비를 모두 챙김",
        rank: "primary",
      },
      {
        productCode: "AI_PACKAGE",
        reason: "혹시 모를 상황에 대비해 스탭 서비스 고려",
        rank: "secondary",
      },
    ],
    E: [
      {
        productCode: "AI_PACKAGE",
        reason: "60대 이상이라면 안전이 최고 우선 — 스탭이 있습니다",
        rank: "primary",
      },
      {
        productCode: "GOLD_C",
        reason: "가족과 함께라면 렌탈까지 필요할 수 있음",
        rank: "secondary",
      },
    ],
  };

  return recommendations[segment] || [];
}

/**
 * 추천 이유를 자연어 문장으로
 * Contact 상세 페이지의 배너에서 사용
 */
export function getRecommendationMessage(segment: Segment): string {
  const messages: Record<Segment, string> = {
    A: "30대 커플, 특별한 추억이 필요하신가요? AI 패키지로 완벽한 여행을 준비하세요!",
    B: "40대 가족, 아이들과 안전한 여행을 원하신다면 AI 패키지가 정답입니다!",
    C: "중년 부부의 꾸준한 여행 파트너, 골드 회원쉽으로 매번 저렴하게 즐기세요!",
    D: "50-60대, 건강 관리와 함께 여행하는 기본 패키지를 추천합니다!",
    E: "60대 이상이시라면 스탭과 함께하는 AI 패키지로 안심하고 즐기세요!",
  };

  return messages[segment] || "";
}

/**
 * 세그먼트별 추천 요점 (3줄 요약)
 */
export function getRecommendationSummary(segment: Segment): string {
  const summaries: Record<Segment, string> = {
    A: "1순위: AI 패키지 (특별함)\n2순위: 골드 멤버십 (자주 가기)\n이유: 신혼부부라면 스탭이 있어서 더욱 로맨틱",
    B: "1순위: AI 패키지 (가족 안전)\n2순위: 자유 여행권 (자율성)\n이유: 아이들 때문에 스탭이 있으면 정말 편함",
    C: "1순위: 골드 멤버십 (저렴함)\n2순위: AI 패키지 (특별한 날)\n이유: 자주 가면 구독이 가장 경제적",
    D: "1순위: 기본 패키지 (가성비)\n2순위: AI 패키지 (건강안심)\n이유: 건강 관리를 하면서 여행 즐기기",
    E: "1순위: AI 패키지 (안전)\n2순위: ABC 렌탈코스 (가족함께)\n이유: 스탭 있으면 혼자가 아니라 안심",
  };

  return summaries[segment] || "";
}

/**
 * 추천 이유 컬러 (배지용)
 */
export const RECOMMENDATION_COLORS = {
  primary: "bg-blue-500 text-white border-blue-600",
  secondary: "bg-white border border-gray-300 text-gray-700",
} as const;

/**
 * 세그먼트별 추천 상품의 전체 정보 (상품 객체 포함)
 * recommend-banner.tsx 등에서 사용
 */
export function getRecommendedProductsWithDetails(segment: Segment) {
  const recommendations = recommendProducts(segment);
  return recommendations.map((rec) => ({
    ...rec,
    product: CRUISE_PRODUCTS[rec.productCode],
  }));
}
