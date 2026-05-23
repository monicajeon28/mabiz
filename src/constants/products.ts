/**
 * 크루즈닷 5개 상품 교육 상수
 * PASONA 프레임워크 + 거절 대응 포함
 */

export const CRUISE_PRODUCTS = {
  GOLD_MEMBERSHIP: {
    code: "GOLD_MEMBERSHIP",
    name: "크루즈닷 골드 회원쉽",
    emoji: "👑",
    type: "subscription" as const,
    features: ["렌탈 가능", "특별 상품 선계약"],
    recommendedSegments: ["A", "C"] as const,
    tagline: "자주 가는 사람들의 선택",
    description: "좋은 크루즈를 자주 가고 싶은 분들을 위한 구독형 상품",
    pasona: {
      problem: "좋은 크루즈를 자주 가고 싶은데 매번 비싸다",
      affinity: "여행을 사랑하고 품질을 아는 사람들",
      solution: "월정액으로 싼 가격 + 새로운 상품 먼저 제공",
      offer: "지금 가입하면 첫 달 50% 할인",
    },
    topObjections: [
      {
        objection: "매달 돈 내면서까지 가야해?",
        response: "1년에 3번 가신다면, 1회당 비용이 30% 저렴해져서 결국 절약됩니다!",
      },
      {
        objection: "잘못 구매하면?",
        response: "언제든 취소 가능하고, 안 가면 그냥 중단하세요!",
      },
      {
        objection: "다른 상품이랑 뭐가 다르네?",
        response: "렌탈도 되고, 남들 못 사는 한정판 상품이 있어요!",
      },
    ],
  },
  BASIC_PACKAGE: {
    code: "BASIC_PACKAGE",
    name: "크루즈닷 기본 패키지",
    emoji: "🏥",
    type: "subscription" as const,
    features: ["헬스케어 100회", "렌탈 불가", "의무납입 없음"],
    recommendedSegments: ["D", "E"] as const,
    tagline: "건강하게 여행하는 가장 저렴한 방법",
    description: "건강을 소중히 여기는 분들을 위한 저가형 구독 상품",
    pasona: {
      problem: "나이가 들면서 건강이 걱정되는데, 여행은 포기 못 한다",
      affinity: "건강을 소중히 여기는 현명한 분들",
      solution: "저렴하게 매달 헬스케어 100회 이용 가능",
      offer: "지금 가입하면 첫달 무료",
    },
    topObjections: [
      {
        objection: "27,000원도 비싼데?",
        response:
          "병원 건강검진이 최소 50만원인데, 이건 27,000원으로 100회를 써요!",
      },
      {
        objection: "100회도 안 쓸 것 같은데?",
        response: "안 쓰면 그냥 중단하면 돼요! 의무납입이 없거든요!",
      },
      {
        objection: "렌탈은 안 돼?",
        response: "차 따로, 크루즈 따로 예약하면 오히려 더 자유로워요!",
      },
    ],
  },
  ABC_COURSE: {
    code: "ABC_COURSE",
    name: "ABC코스",
    emoji: "🚗",
    type: "subscription" as const,
    features: ["크루즈+렌탈 세트", "의무납입 60회"],
    recommendedSegments: ["A", "B"] as const,
    tagline: "가족 여행은 이것만으로 완벽",
    description: "가족과 함께 크루즈와 렌탈을 한 번에 누릴 수 있는 패키지",
    pasona: {
      problem: "가족과 여행 가려면 크루즈도, 렌탈도 해야 하는데 복잡하다",
      affinity: "가족과의 추억을 소중히 여기는 분들",
      solution: "크루즈와 렌탈을 한 번에 묶어서 관리",
      offer: "60회를 꽉 쓰면 1인당 비용이 30% 저렴",
    },
    topObjections: [
      {
        objection: "60회를 다 써야 한다고?",
        response: "가족 4명이 함께 가면 2주에 한 번씩 3번 가도 충분합니다!",
      },
      {
        objection: "렌탈은 운전하기 힘든데?",
        response: "차가 필요 없으면 스킵해도 돼요! 크루즈만 써도 괜찮습니다!",
      },
      {
        objection: "너무 복잡해 보여",
        response: "앱 한 곳에서 크루즈도, 렌탈도 모두 관리됩니다!",
      },
    ],
  },
  FREE_TRAVEL: {
    code: "FREE_TRAVEL",
    name: "크루즈닷 자유여행",
    emoji: "🗺️",
    type: "one_time" as const,
    features: ["스탭 없음 (자유)", "AI패키지보다 10~20% 저렴"],
    recommendedSegments: ["B", "C"] as const,
    tagline: "나의 속도로 즐기는 여행",
    description: "스탭의 가이드 없이 자유로운 일정으로 여행하는 상품",
    pasona: {
      problem: "가이드 따라다니기 싫고, 혼자 자유롭게 여행하고 싶다",
      affinity: "자신의 취향을 아는 자유로운 영혼들",
      solution: "스탭 없이 자유로운 일정으로 여행",
      offer: "지금 예약하면 와인 무료 제공",
    },
    topObjections: [
      {
        objection: "스탭이 없으면 안 불안한가?",
        response:
          "와이파이, 비상연락망 다 있어요! 배 위 모든 시설이 open이라 전혀 문제 없습니다!",
      },
      {
        objection: "혼자 가기 불안해",
        response: "선상 프로그램이 많아서 자동으로 사람들을 만나게 됩니다!",
      },
      {
        objection: "왜 AI패키지보다 저렴하지?",
        response:
          "스탭의 도움이 없는 대신 비용을 아껴서, 자유를 원하는 분들이 더 저렴하게 이용할 수 있어요!",
      },
    ],
  },
  AI_PACKAGE: {
    code: "AI_PACKAGE",
    name: "크루즈닷 AI 패키지",
    emoji: "🤖",
    type: "one_time" as const,
    features: ["스탭 있음", "선상 투어", "건강관리", "와이파이", "팁 포함"],
    recommendedSegments: ["A", "B", "D", "E"] as const,
    tagline: "완벽한 여행은 스탭과 함께",
    description: "스탭이 함께 투어하고 건강을 챙기는 프리미엄 상품",
    pasona: {
      problem: "혼자 또는 가족과 가는데, 혹시 모를 상황이 불안하다",
      affinity: "안전과 품질을 모두 원하는 현명한 여행자들",
      solution: "스탭이 함께 투어하고, 건강/비상상황 모두 챙긴다",
      offer: "생일자에게는 특별한 깜짝 이벤트 제공",
    },
    topObjections: [
      {
        objection: "스탭이 따라다니면 불편하지 않나?",
        response: "강제로 따라다니는 게 아니라, 필요할 때만 도움주는 거예요!",
      },
      {
        objection: "비싸지 않나?",
        response:
          "혼자 계획하고 헤매는 것보다, 스탭이 있어서 시간을 정말 효율적으로 써요!",
      },
      {
        objection: "60대 부모님과 가는데 가능할까?",
        response:
          "오히려 이 상품이 딱입니다! 건강 문제도 챙기고, 배 위에서 뭘 할지도 안내받을 수 있거든요!",
      },
    ],
  },
} as const;

export type ProductCode = keyof typeof CRUISE_PRODUCTS;
export type ProductType = (typeof CRUISE_PRODUCTS)[ProductCode];

// PRODUCT_CODES 배열 - playbook-viewer에서 사용
export const PRODUCT_CODES = Object.keys(CRUISE_PRODUCTS) as ProductCode[];
export type ProductCodeType = ProductCode;

/**
 * 세그먼트별 색상 지정 (배지용)
 */
export const SEGMENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  A: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
  },
  B: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
  },
  C: {
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
  },
  D: {
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    border: "border-yellow-200",
  },
  E: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
  },
};

/**
 * PASONA 단계별 색상
 */
export const PASONA_COLORS = {
  problem: {
    bg: "bg-red-50",
    accent: "border-l-4 border-red-500",
    emoji: "⚠️",
    label: "Problem",
  },
  affinity: {
    bg: "bg-blue-50",
    accent: "border-l-4 border-blue-500",
    emoji: "🤝",
    label: "Affinity",
  },
  solution: {
    bg: "bg-green-50",
    accent: "border-l-4 border-green-500",
    emoji: "💡",
    label: "Solution",
  },
  offer: {
    bg: "bg-purple-50",
    accent: "border-l-4 border-purple-500",
    emoji: "🎁",
    label: "Offer",
  },
};

/**
 * 세그먼트 정보
 */
export const SEGMENTS = [
  { code: "A", label: "30대 커플", description: "신혼부부, 자주 여행" },
  { code: "B", label: "40대 가족", description: "자녀 동반, 패키지형 선호" },
  { code: "C", label: "중년 부부", description: "안정적 소비, 품질 중시" },
  { code: "D", label: "50-60대", description: "건강 관심, 저가형" },
  { code: "E", label: "60대+", description: "여가 활동, 매우 저가형" },
];
