/**
 * 크루즈닷 상품 교육 상수 — 실제 데이터 기반
 * 출처: www.cruisedot.co.kr 골드 멤버십 페이지 확인 완료
 */

export const CRUISE_PRODUCTS = {
  GOLD_A: {
    code: "GOLD_A",
    name: "골드 A플랜",
    emoji: "🇯🇵",
    type: "commitment" as const,
    commitmentMonths: 60,
    price: "33,000원/월 (하루 1,100원)",
    features: [
      "일본·대만·홍콩 크루즈 10~20% 할인",
      "출발 48시간 전 우선 예약 오픈",
      "KB헬스케어 포함",
      "60개월 VIP 멤버십 확정 (납입금 은행 안전 보관)",
      "단체 15명: 굿즈 증정 / 20명: 스탭 무료 / 30명: 인솔자+스탭 풀팀",
    ],
    recommendedSegments: ["A", "B"] as const,
    tagline: "일본·대만·홍콩 자주 가는 분들의 선택",
    description: "일본, 대만, 홍콩 크루즈를 자주 이용하는 분들을 위한 골드 멤버십. 월 33,000원으로 최대 20% 할인에 KB헬스케어까지 누리세요. 60개월 의무납입.",
    pasona: {
      problem: "일본·대만 크루즈를 자주 가고 싶은데 매번 정가를 내야 한다",
      affinity: "아시아 크루즈를 즐기는 분들",
      solution: "월 33,000원으로 10~20% 할인 + 48시간 전 우선 예약으로 좋은 방 선점",
      offer: "60개월 납입하시는 금액은 여행사에 사라지는 돈이 아니라 회원님 멤버십으로 은행에 안전하게 보관됩니다. 일본 크루즈 한 번에 42만원 절약이니, 납입금은 여행으로 고스란히 돌아옵니다",
    },
    topObjections: [
      {
        objection: "매달 33,000원씩 내면 손해 아닌가요?",
        response: "1회 여행에서 할인받는 금액이 33,000원을 훌쩍 넘습니다. 일본 크루즈 140만원짜리가 98만원이 되면, 한 번에 42만원 절약이에요.",
      },
      {
        objection: "매달 내는 돈이 그냥 없어지는 거 아닌가요?",
        response: "아닙니다. 여행사에 내고 사라지는 돈이 아니라, 회원님 멤버십으로 은행에 안전하게 보관됩니다. 그래서 더 안심하고 쓰실 수 있어요.",
      },
      {
        objection: "자주 못 가면 손해 아닌가요?",
        response: "매달 33,000원은 사라지는 게 아니라 은행에 안전하게 보관됩니다. 안 가시는 달에도 우선 예약 혜택이 유지되어, 좋은 방 나오면 바로 선점하실 수 있어요.",
      },
      {
        objection: "일본만 가는 건 아닌데요?",
        response: "A플랜도 크루즈닷 전 상품에 우선 예약이 적용됩니다. 다른 지역 가실 때는 B, C 플랜을 추가하거나 업그레이드하시면 더 많이 할인받으세요.",
      },
      {
        objection: "KB헬스케어가 뭔가요?",
        response: "의료상담, 병원 예약 대행, 검진 할인, 간병인 파견까지 10년 동안 지원해드리는 프리미엄 헬스케어 서비스입니다.",
      },
    ],
    keywords: ["일본", "대만", "홍콩", "아시아", "33000", "A플랜", "할인", "헬스케어"],
  },

  GOLD_B: {
    code: "GOLD_B",
    name: "골드 B플랜",
    emoji: "🌏",
    type: "commitment" as const,
    commitmentMonths: 60,
    price: "66,000원/월 (하루 2,200원)",
    features: [
      "동남아·싱가포르·말레이시아 크루즈 10~30% 할인",
      "출발 48시간 전 우선 예약 오픈",
      "KB헬스케어 포함",
      "60개월 VIP 멤버십 확정 (납입금 은행 안전 보관)",
      "단체 15명: 굿즈 증정 / 20명: 스탭 무료 / 30명: 인솔자+스탭 풀팀",
    ],
    recommendedSegments: ["A", "B", "C"] as const,
    tagline: "동남아 크루즈의 절대적 선택",
    description: "동남아, 싱가포르, 말레이시아 크루즈를 20~30% 할인받는 골드 B플랜. 싱가포르 3박4일 300만원 → 210만원으로 90만원 절약. 60개월 의무납입.",
    pasona: {
      problem: "동남아 크루즈는 비싸서 자주 못 간다",
      affinity: "동남아 크루즈를 즐기는 분들",
      solution: "월 66,000원으로 20~30% 할인. 싱가포르 한 번만 가도 본전",
      offer: "60개월 납입금은 여행사에 사라지는 돈이 아니라 회원님 멤버십으로 은행에 안전하게 보관됩니다. 싱가포르 한 번에 90만원, 말레이시아 한 번에 60만원 절약이니 납입금은 여행으로 충분히 돌아옵니다",
    },
    topObjections: [
      {
        objection: "66,000원은 좀 비싸지 않나요?",
        response: "싱가포르 3박4일 300만원이 210만원이 됩니다. 한 번만 가도 90만원 절약이에요. 66,000원은 첫 달만 내도 본전 훨씬 넘어요.",
      },
      {
        objection: "동남아 크루즈는 자주 못 가는데요.",
        response: "1년에 1번만 가셔도 충분해요. 싱가포르 300만원 → 210만원, 90만원 절약이면 1년 납입금(79만원)을 이미 넘어요. 60개월 납입금은 은행에 안전하게 보관됩니다.",
      },
      {
        objection: "할인이 항상 적용되나요?",
        response: "멤버십 유지 기간 동안 전 상품 무제한 적용됩니다.",
      },
    ],
    keywords: ["동남아", "싱가포르", "말레이시아", "66000", "B플랜", "20%", "30%"],
  },

  GOLD_C: {
    code: "GOLD_C",
    name: "골드 C플랜",
    emoji: "🌍",
    type: "commitment" as const,
    commitmentMonths: 60,
    price: "99,000원/월 (하루 3,300원)",
    features: [
      "유럽·미국·알래스카 크루즈 10~30% 할인",
      "출발 48시간 전 우선 예약 오픈",
      "KB헬스케어 포함",
      "60개월 VIP 멤버십 확정 (납입금 은행 안전 보관)",
      "최대 절감 1,230만원 이상 (10개 상품 기준)",
      "단체 15명: 굿즈 증정 / 20명: 스탭 무료 / 30명: 인솔자+스탭 풀팀",
    ],
    recommendedSegments: ["A", "C"] as const,
    tagline: "유럽·알래스카 꿈을 현실로",
    description: "유럽, 미국, 알래스카 크루즈를 20~30% 할인받는 프리미엄 플랜. 유럽 5박6일 460만원 → 320만원으로 140만원 절약. 60개월 의무납입.",
    pasona: {
      problem: "유럽·알래스카 크루즈는 너무 비싸서 엄두가 안 난다",
      affinity: "버킷리스트에 유럽 크루즈가 있는 분들",
      solution: "월 99,000원으로 20~30% 할인. 유럽 한 번만 가도 수백만원 절약",
      offer: "유럽 5박6일 460만원 → 320만원, 140만원 절약이면 C플랜 1년치(119만원)를 넘어요. 60개월 납입금은 여행사에 사라지는 게 아니라 회원님 멤버십으로 은행에 안전하게 보관됩니다",
    },
    topObjections: [
      {
        objection: "매달 99,000원은 부담돼요.",
        response: "유럽 한 번 가면 140만원 절약됩니다. C플랜 1년치가 119만원이에요. 한 번만 가도 훨씬 이득이에요.",
      },
      {
        objection: "유럽은 자주 못 가는데요.",
        response: "1번만 가셔도 됩니다. 유럽 460만원 → 320만원, 140만원 절약이면 1년치 납입금(119만원)보다 이득이에요. 60개월 납입금은 은행에 안전하게 보관됩니다.",
      },
      {
        objection: "알래스카도 포함인가요?",
        response: "네, 유럽·미국·알래스카 모두 C플랜 할인이 적용됩니다.",
      },
    ],
    keywords: ["유럽", "미국", "알래스카", "99000", "C플랜", "1230만원", "프리미엄"],
  },

  GOLD_BASIC: {
    code: "GOLD_BASIC",
    name: "골드 기본 (헬스케어)",
    emoji: "🏥",
    type: "subscription" as const,
    price: "27,000원/월",
    features: [
      "KB헬스케어 10년 보장",
      "의료상담·검진할인·병원예약·간병인 파견",
      "의무납입 없음",
      "원하는 달만 납부",
      "해지 위약금 없음",
    ],
    recommendedSegments: ["D", "E"] as const,
    tagline: "하루 900원으로 10년 건강 보장",
    description: "크루즈 할인 없이 KB헬스케어만 이용하는 기본 플랜. 월 27,000원으로 의료상담, 검진할인, 간병인 파견까지 10년 보장.",
    pasona: {
      problem: "나이 들면서 건강이 걱정되는데 의료비 부담이 크다",
      affinity: "건강을 소중히 여기는 현명한 분들",
      solution: "월 27,000원으로 KB헬스케어 10년. 병원비·간병비 걱정 덜기",
      offer: "의무납입 없고 해지 위약금도 없습니다. 부담 제로. 내신 돈도 여행사에 사라지는 게 아니라 회원님 멤버십으로 은행에 안전하게 보관되니 안심하세요",
    },
    topObjections: [
      {
        objection: "27,000원도 아깝은데요.",
        response: "KB헬스케어 하루 900원입니다. 병원 한 번 가면 수만원인데, 10년 의료상담과 간병인 파견이 27,000원이에요.",
      },
      {
        objection: "크루즈 안 가는데도 가입해야 하나요?",
        response: "크루즈 없이 헬스케어만 이용하셔도 됩니다. 나중에 크루즈 가고 싶으실 때 A/B/C 플랜으로 업그레이드하시면 돼요.",
      },
      {
        objection: "KB헬스케어는 뭘 해주나요?",
        response: "의료상담, 병원 예약 대행, 검진 할인, 간병인 파견까지 지원합니다. 혼자 사시는 부모님께 특히 안심이 되죠.",
      },
    ],
    keywords: ["헬스케어", "건강", "KB", "간병인", "27000", "기본", "의료상담", "검진"],
  },

  ABC_COURSE: {
    code: "ABC_COURSE",
    name: "ABC코스 (크루즈+가전렌탈)",
    emoji: "🏠",
    type: "subscription" as const,
    price: "A코스 33,000원/월 (B·C코스 상담)",
    features: [
      "크루즈 골드 멤버십 할인 포함",
      "A코스: TV50\"·오븐·김치냉장고·공기청정기·안마의자침대·청소기",
      "B코스: TV55\"·세탁기·안마의자·로봇청소기·에어드레서",
      "C코스: 냉장고·울트라안마의자·LG냉장고·세탁건조기·TV75\"",
      "크루즈 여행 할인 + 가전 렌탈 동시 혜택",
    ],
    recommendedSegments: ["A", "B", "C"] as const,
    tagline: "크루즈 여행 + 집 가전을 한 번에",
    description: "크루즈 골드 멤버십 할인과 고급 가전 렌탈을 함께 누리는 결합 상품. A/B/C 코스 중 선택, 생활 편의와 여행 혜택을 동시에.",
    pasona: {
      problem: "크루즈도 가고 싶고, 집에 좋은 가전도 필요한데 비용이 부담된다",
      affinity: "실용적이면서 여행도 즐기고 싶은 분들",
      solution: "크루즈 할인 + 가전 렌탈을 한 번의 월납으로 해결. A/B/C 코스로 필요에 맞게 선택",
      offer: "가전 렌탈 따로, 크루즈 따로보다 훨씬 경제적. 상담 후 최적 코스 추천",
    },
    topObjections: [
      {
        objection: "가전 렌탈을 왜 크루즈랑 같이 가입해야 하나요?",
        response: "따로 가입하면 더 비쌉니다. 번들로 묶어서 월납 부담을 줄이고, 여행 할인까지 챙기는 구조예요.",
      },
      {
        objection: "A/B/C 코스 차이가 뭔가요?",
        response: "A코스는 기본 가전(TV·오븐·김치냉장고 등), B코스는 생활 중심(세탁기·로봇청소기), C코스는 프리미엄(울트라 안마의자·대형 TV 등)입니다. 상담 후 가정 상황에 맞게 결정하세요.",
      },
      {
        objection: "집에 가전이 이미 있는데요.",
        response: "기존 가전 교체 시기가 됐거나, 업그레이드를 원하시는 분들께 추천드려요. 렌탈이라 초기 비용 없이 최신 가전 이용 가능합니다.",
      },
    ],
    keywords: ["ABC", "렌탈", "가전", "TV", "세탁기", "안마의자", "냉장고", "결합", "번들"],
  },

  FREE_TRAVEL: {
    code: "FREE_TRAVEL",
    name: "자유여행 (인솔자 없음)",
    emoji: "🗺️",
    type: "one_time" as const,
    price: "AI패키지 대비 10~20% 저렴",
    features: [
      "인솔자·스탭 없음 (완전 자유)",
      "AI패키지보다 10~20% 저렴",
      "와이파이 포함",
      "비상연락망 제공",
      "선상 모든 시설 자유 이용",
    ],
    recommendedSegments: ["B", "C"] as const,
    tagline: "내 방식대로, 내 속도로",
    description: "인솔자 없이 스스로 일정을 짜는 크루즈 여행. 스탭 비용이 없어서 AI패키지보다 저렴하고, 선상에서 원하는 것만 즐깁니다.",
    pasona: {
      problem: "가이드 따라다니기 싫고, 내 마음대로 여행하고 싶다",
      affinity: "자유를 즐기는 경험 많은 여행자",
      solution: "스탭 없이 자유롭게. 가격도 더 저렴",
      offer: "선상 프로그램과 시설 100% 자유 이용. 와이파이·비상연락망으로 안전 보장",
    },
    topObjections: [
      {
        objection: "인솔자 없으면 불안하지 않나요?",
        response: "배 안에서는 길을 잃을 일이 없어요. 와이파이, 비상연락망 다 있고, 선내 직원들이 항상 계세요.",
      },
      {
        objection: "혼자 가면 외롭지 않나요?",
        response: "선상 프로그램에 자동으로 사람들을 만나게 됩니다. 혼자 여행자도 많아요.",
      },
      {
        objection: "왜 AI패키지보다 저렴한 거죠?",
        response: "스탭 인건비가 없어서요. 그 비용을 고객님께 돌려드리는 거예요.",
      },
    ],
    keywords: ["자유여행", "인솔자없음", "스탭없음", "저렴", "자유", "혼자"],
  },

  AI_PACKAGE: {
    code: "AI_PACKAGE",
    name: "AI 패키지 (인솔자 동행)",
    emoji: "👨‍✈️",
    type: "one_time" as const,
    price: "자유여행 대비 10~20% 프리미엄",
    features: [
      "전문 인솔자·스탭 동행",
      "선상 투어 안내",
      "건강 케어 서비스",
      "와이파이 포함",
      "팁 포함",
      "단체 혜택 자동 적용",
    ],
    recommendedSegments: ["A", "B", "D", "E"] as const,
    tagline: "완벽한 여행, 스탭이 다 챙겨드립니다",
    description: "전문 인솔자와 스탭이 동행하여 투어, 건강, 비상상황 모두 책임지는 프리미엄 패키지. 처음 크루즈 가시는 분, 부모님 모시는 분께 강력 추천.",
    pasona: {
      problem: "처음 크루즈인데 뭘 어떻게 해야 할지 막막하다. 부모님 건강이 걱정된다",
      affinity: "안전하고 알찬 여행을 원하는 분들",
      solution: "스탭이 모든 것을 챙겨드리되, 회원님은 자유롭게 원하는 것만 골라 더 풍부하게 즐기시면 됩니다. 팁, 와이파이, 건강케어까지 다 해결되니 같은 배를 타도 혼자 패키지로 가는 것과 차원이 다른 경험이에요",
      offer: "60대 부모님과 함께해도 안심. 비상 상황 완벽 대처",
    },
    topObjections: [
      {
        objection: "스탭이 따라다니면 불편하지 않나요?",
        response: "강제로 따라다니는 게 아닙니다. 필요할 때만 도움받고, 자유롭게 다니셔도 돼요.",
      },
      {
        objection: "비싸지 않나요?",
        response: "혼자 계획하고 헤매는 시간 vs 스탭이 다 챙겨주는 시간, 여행 질이 달라요. 팁·와이파이 포함이라 추가 비용도 없고요.",
      },
      {
        objection: "60대 부모님과 가도 괜찮을까요?",
        response: "오히려 이 상품이 딱입니다! 건강 케어, 비상상황 대처, 뭘 해야 할지 안내까지 다 해드려요.",
      },
    ],
    keywords: ["AI패키지", "인솔자", "스탭", "동행", "부모님", "건강케어", "처음", "팁포함"],
  },
} as const;

export type ProductCode = keyof typeof CRUISE_PRODUCTS;
export type ProductType = (typeof CRUISE_PRODUCTS)[ProductCode];

export const PRODUCT_CODES = Object.keys(CRUISE_PRODUCTS) as ProductCode[];
export type ProductCodeType = ProductCode;

/**
 * 전화 중 즉석 검색용 — 모든 상품의 검색 가능한 항목 flat 리스트
 */
export type SearchItem = {
  productCode: ProductCode;
  productName: string;
  emoji: string;
  type: "feature" | "objection" | "response" | "pasona" | "price";
  label: string;
  content: string;
  keywords: string[];
};

export function buildSearchIndex(): SearchItem[] {
  const items: SearchItem[] = [];

  for (const [code, product] of Object.entries(CRUISE_PRODUCTS)) {
    const pCode = code as ProductCode;

    // 가격
    if ("price" in product) {
      items.push({
        productCode: pCode,
        productName: product.name,
        emoji: product.emoji,
        type: "price",
        label: "가격",
        content: (product as { price: string }).price,
        keywords: ["가격", "얼마", "비용", "월", ...(product.keywords ?? [])],
      });
    }

    // 기능/특징
    product.features.forEach((f) => {
      items.push({
        productCode: pCode,
        productName: product.name,
        emoji: product.emoji,
        type: "feature",
        label: "특징",
        content: f,
        keywords: [f, ...(product.keywords ?? [])],
      });
    });

    // PASONA
    Object.entries(product.pasona).forEach(([key, value]) => {
      const labelMap: Record<string, string> = {
        problem: "문제 (Problem)",
        affinity: "공감 (Affinity)",
        solution: "해결 (Solution)",
        offer: "제안 (Offer)",
      };
      items.push({
        productCode: pCode,
        productName: product.name,
        emoji: product.emoji,
        type: "pasona",
        label: labelMap[key] ?? key,
        content: value,
        keywords: [key, ...(product.keywords ?? [])],
      });
    });

    // 거절 대응
    product.topObjections.forEach((obj) => {
      items.push({
        productCode: pCode,
        productName: product.name,
        emoji: product.emoji,
        type: "objection",
        label: "거절",
        content: obj.objection,
        keywords: ["거절", "이의", ...(product.keywords ?? [])],
      });
      items.push({
        productCode: pCode,
        productName: product.name,
        emoji: product.emoji,
        type: "response",
        label: "대응 스크립트",
        content: obj.response,
        keywords: ["대응", "답변", "스크립트", ...(product.keywords ?? [])],
      });
    });
  }

  return items;
}

/**
 * 세그먼트별 색상
 */
export const SEGMENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  B: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  C: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  D: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  E: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
};

/**
 * PASONA 단계별 색상
 */
export const PASONA_COLORS = {
  problem: { bg: "bg-red-50", accent: "border-l-4 border-red-500", emoji: "⚠️", label: "Problem" },
  affinity: { bg: "bg-blue-50", accent: "border-l-4 border-blue-500", emoji: "🤝", label: "Affinity" },
  solution: { bg: "bg-green-50", accent: "border-l-4 border-green-500", emoji: "💡", label: "Solution" },
  offer: { bg: "bg-purple-50", accent: "border-l-4 border-purple-500", emoji: "🎁", label: "Offer" },
};

export const SEGMENTS = [
  { code: "A", label: "30대 커플", description: "신혼부부, 자주 여행" },
  { code: "B", label: "40대 가족", description: "자녀 동반, 패키지형 선호" },
  { code: "C", label: "중년 부부", description: "안정적 소비, 품질 중시" },
  { code: "D", label: "50-60대", description: "건강 관심, 저가형" },
  { code: "E", label: "60대+", description: "여가 활동, 매우 저가형" },
];
