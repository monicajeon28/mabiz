/**
 * 8가지 상황별 콜 플레이북 — 오프닝 라인 + 심리학 렌즈 매핑
 * @date 2026-06-02
 * @description
 *  거장단 토론 결론(Phase 1-2) 반영:
 *   - 퍼널거장: 4 Core(MUST) + 4 Growth(NICE) 상황, 각 shortened funnel
 *   - 심리학거장(Grant Cardone): 각 상황별 오프닝 3개 + 심리학 렌즈 명시
 *   - TS아키텍트: enum 기반 타입 안전 + 렌즈 ONE-TIME 일관성
 *
 *  PlaybookRecommender(렌즈 L0-L10) → 이 라이브러리(상황별 스크립트)로 연결.
 *  렌즈는 Contact당 ONE-TIME 감지, 상황은 통화 시점에 상담사가 선택.
 */

import type { LensType } from "@/lib/types/lens";

/**
 * 8가지 콜 상황 (Core 4 + Growth 4)
 */
export type CallSituation =
  // === Core (MUST) ===
  | "PRICE_OBJECTION" // 가격 이의
  | "HEALTH_CONCERN" // 건강 이슈
  | "REFUND_REQUEST" // 환불 요청
  | "COMPLAINT" // 불만 처리
  // === Growth (NICE) ===
  | "FOOD_CONSULTATION" // 음식 상담
  | "UPSELL" // 업셀
  | "REBOOKING" // 추가/재예약
  | "CONTRACT_RENEWAL"; // 재계약

export type SituationTier = "CORE" | "GROWTH";

/** Russell Brunson shortened funnel 단계 (2-4단계) */
export type FunnelStep =
  | "HOOK"
  | "STORY"
  | "OFFER"
  | "OBJECTION"
  | "URGENCY"
  | "CLOSE";

/**
 * 심리학 오프닝 라인 (Grant Cardone 렌즈 기반)
 */
export interface OpeningLine {
  text: string;
  /** 적용 심리학 렌즈 */
  lens: LensType;
  /** 렌즈 한글 라벨 */
  lensLabel: string;
  /** 왜 효과적인지 (상담사 코칭용) */
  rationale: string;
}

export interface CallSituationScript {
  situation: CallSituation;
  tier: SituationTier;
  label: string;
  emoji: string;
  /** 이 상황과 가장 잘 맞는 렌즈 (PlaybookRecommender 연동용) */
  primaryLens: LensType;
  /** shortened funnel 단계 (2-4) */
  funnelSteps: FunnelStep[];
  /** 심리학 기법 3개 (오프닝 라인) */
  openingLines: [OpeningLine, OpeningLine, OpeningLine];
  /** 핵심 이의 대응 한 줄 */
  rebuttal: string;
}

/**
 * 8가지 상황별 스크립트 정의
 * 거장단 합의 매핑표(시스템 프롬프트) 그대로 코드화
 */
export const CALL_SITUATIONS: Record<CallSituation, CallSituationScript> = {
  // ============ CORE ============
  PRICE_OBJECTION: {
    situation: "PRICE_OBJECTION",
    tier: "CORE",
    label: "가격 이의",
    emoji: "💰",
    primaryLens: "L1",
    funnelSteps: ["OBJECTION", "STORY", "OFFER", "CLOSE"],
    openingLines: [
      {
        text: "사실 이 가격은 선사와 직접 연결되어 있어서 가능한 거예요.",
        lens: "L10",
        lensLabel: "권위(직결)",
        rationale: "중간 마진이 없다는 권위 프레임으로 '비싸다'를 '오히려 싸다'로 전환",
      },
      {
        text: "지금 안 하시면 이 특가는 사라지는데, 그게 가장 아까운 손실이에요.",
        lens: "L6",
        lensLabel: "손실회피",
        rationale: "이익보다 손실을 2배 크게 인지하는 심리 활용 — 가격이 아니라 기회비용으로 재정의",
      },
      {
        text: "월 33,000원 수준으로 나눠 보면, 하루 커피 한 잔 값이에요.",
        lens: "L1",
        lensLabel: "가치 재정의",
        rationale: "총액을 일/월 단위로 분해해 인지된 부담을 낮춤(앵커링 역전)",
      },
    ],
    rebuttal: "가격을 깎는 게 아니라 '가치당 비용'을 보여드립니다 — 7박 1박당 비용 vs 호텔 1박당 비용.",
  },

  HEALTH_CONCERN: {
    situation: "HEALTH_CONCERN",
    tier: "CORE",
    label: "건강 이슈",
    emoji: "⚕️",
    primaryLens: "L9",
    funnelSteps: ["STORY", "OFFER", "CLOSE"],
    openingLines: [
      {
        text: "부모님 건강이 제일 최우선이시죠? 그래서 더 안심하셔야 해요.",
        lens: "L9",
        lensLabel: "신뢰(공감)",
        rationale: "고객의 최우선 가치(건강)를 먼저 인정해 방어 해제 후 신뢰 제시",
      },
      {
        text: "출발 전 건강검진을 무료로 도와드리는데, 직접 받아보시면 마음이 놓이실 거예요.",
        lens: "L5",
        lensLabel: "자기투영",
        rationale: "본인이 직접 경험(검진)하게 만들어 안전을 스스로 확인하도록 유도",
      },
      {
        text: "선상 의료팀과 미리 협의해두면, 평소 드시는 약까지 다 챙겨드려요.",
        lens: "L9",
        lensLabel: "신뢰(권위)",
        rationale: "24시간 의료진·응급지원 등 구체적 권위 신호로 의료 불안 제거",
      },
    ],
    rebuttal: "고혈압·당뇨도 국제 수준 의료시설로 안전합니다 — 24시간 의료진 + 응급 헬기 지원.",
  },

  REFUND_REQUEST: {
    situation: "REFUND_REQUEST",
    tier: "CORE",
    label: "환불 요청",
    emoji: "↩️",
    primaryLens: "L3",
    funnelSteps: ["STORY", "OFFER"],
    openingLines: [
      {
        text: "환불 정책을 정확히 안내드릴게요. 저희는 숨기는 게 하나도 없어요.",
        lens: "L3",
        lensLabel: "차별(투명성)",
        rationale: "투명성을 차별점으로 제시해 불신을 신뢰로 전환",
      },
      {
        text: "100% 투명하게, 어떤 조건에서 얼마가 돌아오는지 그대로 말씀드려요.",
        lens: "L10",
        lensLabel: "권위(투명)",
        rationale: "정확한 수치 제시로 권위·신뢰 확보 — 막연한 불안 차단",
      },
      {
        text: "처리는 최대한 빠르게 해드릴게요. 기다리시게 하지 않겠습니다.",
        lens: "L6",
        lensLabel: "긴박(신속)",
        rationale: "신속 처리 약속으로 고객의 통제감 회복 → 관계 유지(재구매 여지)",
      },
    ],
    rebuttal: "환불은 권리입니다. 다만 '왜' 환불하시는지 먼저 들어드리면, 더 나은 대안이 보일 때도 많아요.",
  },

  COMPLAINT: {
    situation: "COMPLAINT",
    tier: "CORE",
    label: "불만 처리",
    emoji: "😟",
    primaryLens: "L0",
    funnelSteps: ["STORY", "OFFER", "CLOSE"],
    openingLines: [
      {
        text: "정말 답답하셨겠어요. 그 마음 충분히 이해합니다.",
        lens: "L0",
        lensLabel: "공감(재활성화)",
        rationale: "먼저 감정을 100% 인정해야 해결책이 들립니다 — 방어 해제의 핵심",
      },
      {
        text: "그래서 저희는 다른 곳과 달라요. 끝까지 책임지고 해결해드립니다.",
        lens: "L3",
        lensLabel: "차별",
        rationale: "공감 직후 차별점(책임)으로 전환해 신뢰 회복",
      },
      {
        text: "이번엔 제가 직접 챙길게요. 다음번은 분명 다르실 거예요.",
        lens: "L8",
        lensLabel: "재구매",
        rationale: "관계 지속(다음번) 프레임으로 이탈을 재구매 기회로 전환",
      },
    ],
    rebuttal: "사과보다 '구체적 해결책 + 담당자 직접 책임'이 불만을 충성으로 바꿉니다.",
  },

  // ============ GROWTH ============
  FOOD_CONSULTATION: {
    situation: "FOOD_CONSULTATION",
    tier: "GROWTH",
    label: "음식 상담",
    emoji: "🍚",
    primaryLens: "L7",
    funnelSteps: ["HOOK", "STORY"],
    openingLines: [
      {
        text: "한국인이라서 역시 밥맛이 중요하시죠?",
        lens: "L7",
        lensLabel: "공감(동반자)",
        rationale: "한국인 입맛이라는 공통 정체성에 공감해 친밀감 형성",
      },
      {
        text: "저희 인솔자가 현지 한식 맛집까지 다 알고 있어요.",
        lens: "L8",
        lensLabel: "재구매(전문성)",
        rationale: "인솔자 노하우(재방문 가치)를 강조해 신뢰·재구매 유도",
      },
      {
        text: "건강한 식단도 미리 안내해드리니 식사 걱정은 안 하셔도 돼요.",
        lens: "L9",
        lensLabel: "신뢰",
        rationale: "건강 식단 안내로 안전·배려 신호 제공",
      },
    ],
    rebuttal: "선상에 한식 옵션 + 인솔자 현지 맛집 안내가 있어 '음식 때문에 못 간다'는 걱정은 없습니다.",
  },

  UPSELL: {
    situation: "UPSELL",
    tier: "GROWTH",
    label: "업셀",
    emoji: "⬆️",
    primaryLens: "L5",
    funnelSteps: ["HOOK", "OFFER", "URGENCY", "CLOSE"],
    openingLines: [
      {
        text: "이왕 가시는 거, 조금만 더 하면 훨씬 더 좋은 경험이 돼요.",
        lens: "L8",
        lensLabel: "재구매(가치확장)",
        rationale: "이미 결정한 고객에게 점진적 가치 확장 제안(앵커 활용)",
      },
      {
        text: "프리미엄 혜택은 딱 고객님 같은 분들을 위한 거예요.",
        lens: "L5",
        lensLabel: "자기투영",
        rationale: "'당신 같은 분' 프레임으로 자기 이미지에 부합하는 선택 유도",
      },
      {
        text: "이 업그레이드 한정 오퍼는 오늘만 가능해요.",
        lens: "L6",
        lensLabel: "희소성",
        rationale: "한정·기한 프레임으로 즉시 결정 촉진",
      },
    ],
    rebuttal: "업셀은 '더 비싸게'가 아니라 '이미 가는 여행을 더 가치 있게' 만드는 제안입니다.",
  },

  REBOOKING: {
    situation: "REBOOKING",
    tier: "GROWTH",
    label: "추가/재예약",
    emoji: "🔁",
    primaryLens: "L8",
    funnelSteps: ["HOOK", "OFFER", "URGENCY"],
    openingLines: [
      {
        text: "또 가고 싶으셨죠? 이번엔 더 좋은 일정으로 모실게요.",
        lens: "L8",
        lensLabel: "재구매",
        rationale: "재구매 욕구를 직접 자극하고 더 나은 경험을 약속",
      },
      {
        text: "이번 특가 상품은 자리가 얼마 안 남았어요.",
        lens: "L6",
        lensLabel: "희소성",
        rationale: "잔여 좌석 희소성으로 빠른 결정 유도",
      },
      {
        text: "지금 바로 잡아두시면 좋은 자리 확보해드릴게요.",
        lens: "L6",
        lensLabel: "긴박감",
        rationale: "즉시 행동 시 혜택(좋은 자리) 강조",
      },
    ],
    rebuttal: "재예약 고객에게는 최상급 할인 + 우선 탑승 — 충성도를 혜택으로 보상합니다.",
  },

  CONTRACT_RENEWAL: {
    situation: "CONTRACT_RENEWAL",
    tier: "GROWTH",
    label: "재계약",
    emoji: "📝",
    primaryLens: "L8",
    funnelSteps: ["STORY", "OFFER", "CLOSE"],
    openingLines: [
      {
        text: "올 한 해 여행 계획, 미리 짜두시면 훨씬 알뜰해요.",
        lens: "L8",
        lensLabel: "재구매(습관화)",
        rationale: "연간 계획 프레임으로 반복 구매를 습관으로 정착",
      },
      {
        text: "저희와 오래 함께하신 분들께는 평생 할인이 적용돼요.",
        lens: "L10",
        lensLabel: "권위(특권)",
        rationale: "장기 고객 특권(평생 할인)으로 이탈 방지",
      },
      {
        text: "다음 여행은 고객님께 딱 맞는 코스로 준비해뒀어요.",
        lens: "L5",
        lensLabel: "자기투영",
        rationale: "맞춤 코스 제안으로 개인화·소속감 강화",
      },
    ],
    rebuttal: "재계약은 '한 번 더'가 아니라 '평생 여행 파트너'로 관계를 격상하는 단계입니다.",
  },
};

/** 정렬된 상황 목록 (Core 먼저, Growth 다음) */
export const CALL_SITUATION_ORDER: CallSituation[] = [
  "PRICE_OBJECTION",
  "HEALTH_CONCERN",
  "REFUND_REQUEST",
  "COMPLAINT",
  "FOOD_CONSULTATION",
  "UPSELL",
  "REBOOKING",
  "CONTRACT_RENEWAL",
];

/** 렌즈 → 가장 적합한 상황 추천 (PlaybookRecommender 연동) */
export function suggestSituationsForLens(lens: LensType): CallSituation[] {
  return CALL_SITUATION_ORDER.filter(
    (s) => CALL_SITUATIONS[s].primaryLens === lens
  );
}

/** 상황 스크립트 조회 (안전) */
export function getSituationScript(
  situation: string
): CallSituationScript | null {
  if (situation in CALL_SITUATIONS) {
    return CALL_SITUATIONS[situation as CallSituation];
  }
  return null;
}

/** 모든 상황 목록 반환 (CALL_SITUATION_ORDER 순서) */
export function getAllSituations(): CallSituation[] {
  return [...CALL_SITUATION_ORDER];
}

/** 상황 한글 라벨 반환 */
export function getSituationLabel(situation: CallSituation): string {
  return CALL_SITUATIONS[situation]?.label ?? situation;
}

/**
 * 렌즈 기반 콜 상황 추천 — suggestSituationsForLens의 확장 버전
 * - primaryLens 일치 상황을 먼저, 나머지는 tier(CORE → GROWTH) 순으로 추가
 * - callStage === 'COMPLAINT' 이면 COMPLAINT 최우선 배치
 */
export function suggestCallSituations(
  lens: LensType,
  callStage?: string
): CallSituation[] {
  const primary = CALL_SITUATION_ORDER.filter(
    (s) => CALL_SITUATIONS[s].primaryLens === lens
  );
  const rest = CALL_SITUATION_ORDER.filter(
    (s) => CALL_SITUATIONS[s].primaryLens !== lens
  );
  const result = [...primary, ...rest];

  // 불만 처리 콜 시 COMPLAINT 최우선
  if (callStage === "COMPLAINT" && !result[0].includes("COMPLAINT")) {
    const idx = result.indexOf("COMPLAINT");
    if (idx > 0) {
      result.splice(idx, 1);
      result.unshift("COMPLAINT");
    }
  }

  return result;
}
