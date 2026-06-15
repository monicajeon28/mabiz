/**
 * Russell Brunson 8가지 랜딩페이지 형식 + 심리학 렌즈 매핑
 *
 * 형식별 특징:
 * 1. Squeeze: 가장 간단 (배경만) - 이메일 수집 최적화
 * 2. VSL (Video Sales Letter): 짧은 판매 영상 - 스토리텔링 최적화
 * 3. Webinar: 웨비나 등록 페이지 - 전문성 + 신뢰 구축
 * 4. Funnel: 다단계 퍼널 (Step 1/2/3) - 단계별 전환
 * 5. Tripwire: 저가 상품 → 본상품 연결 - 입구 최적화
 * 6. Downsell: 거부 후 할인 제안 - 재전환 최적화
 * 7. Launch: 신제품 런칭 페이지 - 타이밍 + 희소성
 * 8. Hybrid: 혼합형 (자유도 높음) - 커스텀 최적화
 *
 * 심리학 렌즈:
 * - L10 (Immediate Purchase): 즉시 구매 클로징
 * - L6 (Loss Aversion): 타이밍 + 희소성 + 긴박감
 * - L1 (Price Sensitivity): 가격 재정의
 * - L2 (Preparation Anxiety): 불안 해소
 *
 * 2026-06-15 v1.0
 */

// Note: Prisma is only used in functions that interact with DB (e.g., generateSmsSequence)
// Import dynamically where needed to avoid issues with server-only modules

/**
 * Russell Brunson 8가지 형식
 */
export type PageFormat = "squeeze" | "vsl" | "webinar" | "funnel" | "tripwire" | "downsell" | "launch" | "hybrid";

/**
 * CTA 심리학 매핑
 * - default: 기본 (신뢰도)
 * - urgent: 긴박감 (L6 + 희소성)
 * - explore: 탐색 (호기심 + L3 경쟁 회피)
 * - reserve: 예약 (L10 + 확정 심리)
 */
export type CtaType = "default" | "urgent" | "explore" | "reserve";

/**
 * 이미지 필드 인터페이스
 *
 * 예시:
 * {
 *   fieldId: "hero-background",
 *   label: "배경 이미지",
 *   required: true,
 *   width: 1920,
 *   height: 1080,
 *   category: "hero",
 *   sortOrder: 1,
 *   description: "페이지 상단 배경 (1920×1080)",
 *   lens: "L10" // 심리학 렌즈
 * }
 */
export interface ImageField {
  fieldId: string;
  label: string;
  required: boolean;
  width: number;
  height?: number;
  category: "hero" | "product" | "testimonial" | "step" | "social-proof" | "custom";
  sortOrder: number;
  description?: string;
  lens?: string; // L0|L1|L2|L6|L10
}

/**
 * 형식별 이미지 필드 정의
 *
 * 각 형식별 필수/선택 이미지 필드 매핑
 * → CRM UI에서 드래그앤드롭 이미지 업로드 시 가이드
 */
export const IMAGE_FIELDS_BY_FORMAT: Record<PageFormat, ImageField[]> = {
  // 1. Squeeze: 가장 간단 (배경만)
  squeeze: [
    {
      fieldId: "hero-background",
      label: "배경 이미지",
      required: true,
      width: 1920,
      height: 1080,
      category: "hero",
      sortOrder: 1,
      description: "페이지 전체 배경 (1920×1080)",
      lens: "L0"
    }
  ],

  // 2. VSL (Video Sales Letter): 히어로 + 상품 + 후기
  vsl: [
    {
      fieldId: "hero-background",
      label: "배경 이미지",
      required: true,
      width: 1920,
      height: 1080,
      category: "hero",
      sortOrder: 1,
      description: "페이지 상단 배경",
      lens: "L10"
    },
    {
      fieldId: "product-showcase",
      label: "상품 이미지",
      required: true,
      width: 600,
      height: 600,
      category: "product",
      sortOrder: 2,
      description: "메인 상품 쇼케이스",
      lens: "L10"
    },
    {
      fieldId: "testimonial-avatar",
      label: "고객 후기 아바타",
      required: false,
      width: 100,
      height: 100,
      category: "testimonial",
      sortOrder: 3,
      description: "실제 고객 프로필 사진",
      lens: "L6"
    }
  ],

  // 3. Webinar: 강사 + 상품 + 후기
  webinar: [
    {
      fieldId: "instructor-image",
      label: "강사 사진",
      required: true,
      width: 400,
      height: 400,
      category: "social-proof",
      sortOrder: 1,
      description: "전문가/강사 프로필 사진",
      lens: "L9" // 신뢰/권위성
    },
    {
      fieldId: "hero-background",
      label: "배경 이미지",
      required: true,
      width: 1920,
      height: 1080,
      category: "hero",
      sortOrder: 2,
      description: "페이지 배경 (웨비나 장면 권장)",
      lens: "L6"
    },
    {
      fieldId: "product-image",
      label: "상품/결과물 이미지",
      required: true,
      width: 600,
      height: 400,
      category: "product",
      sortOrder: 3,
      description: "웨비나 결과물 또는 상품",
      lens: "L10"
    },
    {
      fieldId: "testimonial-collage",
      label: "고객 후기 콜라주",
      required: false,
      width: 800,
      height: 600,
      category: "testimonial",
      sortOrder: 4,
      description: "여러 고객 후기/스크린샷",
      lens: "L6"
    }
  ],

  // 4. Funnel: step1/2/3 (다단계)
  funnel: [
    {
      fieldId: "step1-image",
      label: "Step 1 이미지",
      required: true,
      width: 600,
      height: 400,
      category: "step",
      sortOrder: 1,
      description: "1단계 설명 또는 실행 이미지",
      lens: "L0"
    },
    {
      fieldId: "step2-image",
      label: "Step 2 이미지",
      required: true,
      width: 600,
      height: 400,
      category: "step",
      sortOrder: 2,
      description: "2단계 결과 또는 진행 이미지",
      lens: "L2"
    },
    {
      fieldId: "step3-image",
      label: "Step 3 이미지",
      required: true,
      width: 600,
      height: 400,
      category: "step",
      sortOrder: 3,
      description: "3단계 최종 결과 또는 성공 이미지",
      lens: "L10"
    },
    {
      fieldId: "success-badge",
      label: "성공 배지/인증",
      required: false,
      width: 200,
      height: 200,
      category: "social-proof",
      sortOrder: 4,
      description: "상을 받은 이미지, 인증서 등",
      lens: "L9"
    }
  ],

  // 5. Tripwire: 저가 상품 + 메인 상품
  tripwire: [
    {
      fieldId: "tripwire-product",
      label: "Tripwire 상품 이미지",
      required: true,
      width: 500,
      height: 500,
      category: "product",
      sortOrder: 1,
      description: "저가 진입 상품 (19,900원 등)",
      lens: "L1"
    },
    {
      fieldId: "main-product",
      label: "메인 상품 이미지",
      required: true,
      width: 600,
      height: 600,
      category: "product",
      sortOrder: 2,
      description: "업셀 타겟 상품",
      lens: "L10"
    },
    {
      fieldId: "comparison-image",
      label: "비교표 또는 차이점 이미지",
      required: false,
      width: 800,
      height: 600,
      category: "custom",
      sortOrder: 3,
      description: "Tripwire vs Main 비교표",
      lens: "L6"
    }
  ],

  // 6. Downsell: 거부 후 할인 제안
  downsell: [
    {
      fieldId: "original-product",
      label: "원래 상품 이미지",
      required: true,
      width: 600,
      height: 600,
      category: "product",
      sortOrder: 1,
      description: "원래 제안한 상품",
      lens: "L10"
    },
    {
      fieldId: "downsell-product",
      label: "다운셀 상품 이미지",
      required: true,
      width: 600,
      height: 600,
      category: "product",
      sortOrder: 2,
      description: "더 저렴한 대안 상품",
      lens: "L1"
    },
    {
      fieldId: "urgency-badge",
      label: "긴박감 배지",
      required: false,
      width: 300,
      height: 200,
      category: "custom",
      sortOrder: 3,
      description: "할인 타이머, 남은 시간 등",
      lens: "L6"
    }
  ],

  // 7. Launch: 신제품 런칭 페이지
  launch: [
    {
      fieldId: "countdown-background",
      label: "카운트다운 배경",
      required: true,
      width: 1920,
      height: 1080,
      category: "hero",
      sortOrder: 1,
      description: "런칭까지 남은 시간 배경",
      lens: "L6"
    },
    {
      fieldId: "product-teaser",
      label: "상품 티저 이미지",
      required: true,
      width: 800,
      height: 600,
      category: "product",
      sortOrder: 2,
      description: "신제품 미리보기 이미지",
      lens: "L6"
    },
    {
      fieldId: "early-bird-badge",
      label: "얼리버드 배지",
      required: false,
      width: 400,
      height: 200,
      category: "custom",
      sortOrder: 3,
      description: "조기 구매자 특전 배지",
      lens: "L6"
    },
    {
      fieldId: "social-proof-wall",
      label: "예약 고객 벽",
      required: false,
      width: 800,
      height: 600,
      category: "social-proof",
      sortOrder: 4,
      description: "사전 예약자 이름/후기 벽",
      lens: "L7"
    }
  ],

  // 8. Hybrid: 혼합형 (자유도 높음)
  hybrid: [
    {
      fieldId: "hero-image",
      label: "히어로 이미지",
      required: true,
      width: 1920,
      height: 1080,
      category: "hero",
      sortOrder: 1,
      description: "페이지 상단 메인 이미지",
      lens: "L10"
    },
    {
      fieldId: "section2-image",
      label: "섹션 2 이미지",
      required: false,
      width: 800,
      height: 600,
      category: "custom",
      sortOrder: 2,
      description: "커스텀 이미지 1",
      lens: "L2"
    },
    {
      fieldId: "section3-image",
      label: "섹션 3 이미지",
      required: false,
      width: 800,
      height: 600,
      category: "custom",
      sortOrder: 3,
      description: "커스텀 이미지 2",
      lens: "L6"
    },
    {
      fieldId: "testimonial-image",
      label: "고객 후기 이미지",
      required: false,
      width: 600,
      height: 400,
      category: "testimonial",
      sortOrder: 4,
      description: "고객 성공 사례",
      lens: "L7"
    }
  ]
};

/**
 * 형식별 최소 이미지 개수
 *
 * 예: squeeze는 최소 1개, vsl은 최소 2개
 */
export const MIN_IMAGES_BY_FORMAT: Record<PageFormat, number> = {
  squeeze: 1,
  vsl: 2,
  webinar: 2,
  funnel: 3,
  tripwire: 2,
  downsell: 2,
  launch: 2,
  hybrid: 1
};

/**
 * 형식별 기대 전환율 (심리학 렌즈 기반)
 *
 * 데이터 출처: Russell Brunson + 크루즈닷 실제 데이터
 * - baseline: 렌즈 미적용 전환율
 * - optimized: 심리학 + SMS 자동화 적용 후
 * - lift: 증가율 (%)
 *
 * 예: squeeze baseline 2.8% → optimized 8.5% (203% 증가)
 */
export const EXPECTED_CONVERSION_BY_FORMAT: Record<PageFormat, {
  baseline: number;
  optimized: number;
  lift: number;
  primaryLens: string;
}> = {
  squeeze: {
    baseline: 2.8,
    optimized: 8.5, // L10 + L6 희소성
    lift: 203,
    primaryLens: "L10"
  },
  vsl: {
    baseline: 2.8,
    optimized: 5.6, // 스토리텔링 (L10 + 신뢰)
    lift: 100,
    primaryLens: "L10"
  },
  webinar: {
    baseline: 1.5,
    optimized: 4.2, // 전문성 (L9 신뢰 + L6 타이밍)
    lift: 180,
    primaryLens: "L9"
  },
  funnel: {
    baseline: 3.5,
    optimized: 9.8, // 단계별 전환 (L0→L2→L10)
    lift: 180,
    primaryLens: "L2"
  },
  tripwire: {
    baseline: 5.0,
    optimized: 15.2, // 저가 진입 (L1 + 업셀 L10)
    lift: 204,
    primaryLens: "L1"
  },
  downsell: {
    baseline: 8.0,
    optimized: 22.5, // 거부 후 재전환 (L1 할인 + L6 긴박감)
    lift: 181,
    primaryLens: "L1"
  },
  launch: {
    baseline: 2.0,
    optimized: 7.8, // 신제품 (L6 희소성 + L10 클로징)
    lift: 290,
    primaryLens: "L6"
  },
  hybrid: {
    baseline: 3.0,
    optimized: 6.5, // 혼합형 (렌즈 자유도)
    lift: 117,
    primaryLens: "L10"
  }
};

/**
 * CTA 버튼 심리학 매핑
 *
 * 렌즈별 최적 CTA 텍스트 + 이모지 + 심리학 기법
 *
 * 예:
 * {
 *   "지금 신청하기": {
 *     text: "지금 신청하기",
 *     lens: "L10",
 *     psychology: "즉시 구매 클로징",
 *     emoji: "⚡",
 *     urgency: 9
 *   }
 * }
 */
export interface CtaPsychology {
  text: string;
  lens: string; // L0|L1|L2|L6|L7|L9|L10
  psychology: string;
  emoji: string;
  urgency: number; // 1-10 scale
  format?: PageFormat[]; // 권장 형식
}

export const CTA_PSYCHOLOGY_MAP: Record<string, CtaPsychology> = {
  // 기본형: L0 신뢰도
  "신청하기": {
    text: "신청하기",
    lens: "L0",
    psychology: "신뢰 구축 + 기본 행동",
    emoji: "✅",
    urgency: 3,
    format: ["hybrid", "webinar"]
  },

  // 긴박감형: L6 희소성 + 타이밍
  "지금 신청하기": {
    text: "지금 신청하기",
    lens: "L6",
    psychology: "긴박감 + 타이밍 손실회피",
    emoji: "⚡",
    urgency: 8,
    format: ["squeeze", "launch", "downsell"]
  },

  "남은 자리 예약하기": {
    text: "남은 자리 예약하기",
    lens: "L6",
    psychology: "희소성 (남은 자리) + 예약",
    emoji: "🔥",
    urgency: 9,
    format: ["funnel", "launch"]
  },

  "오늘 신청 (한정)": {
    text: "오늘 신청 (한정)",
    lens: "L6",
    psychology: "시간 한정 + 희소성",
    emoji: "⏰",
    urgency: 9,
    format: ["squeeze", "tripwire"]
  },

  // 탐색형: L2 호기심 + 불안 해소
  "자세히 알아보기": {
    text: "자세히 알아보기",
    lens: "L2",
    psychology: "호기심 유발 + 저압력",
    emoji: "👀",
    urgency: 4,
    format: ["webinar", "vsl", "hybrid"]
  },

  "무료 상담받기": {
    text: "무료 상담받기",
    lens: "L2",
    psychology: "불안 해소 (무료) + 신뢰",
    emoji: "💬",
    urgency: 5,
    format: ["webinar", "funnel"]
  },

  "가이드 다운로드": {
    text: "가이드 다운로드",
    lens: "L2",
    psychology: "준비도구 제공 + 불안 해소",
    emoji: "📥",
    urgency: 3,
    format: ["webinar", "hybrid"]
  },

  // 예약형: L10 클로징 + 확정
  "예약 확정하기": {
    text: "예약 확정하기",
    lens: "L10",
    psychology: "즉시 클로징 + 확정",
    emoji: "✨",
    urgency: 8,
    format: ["vsl", "squeeze", "launch"]
  },

  "네, 신청 원합니다": {
    text: "네, 신청 원합니다",
    lens: "L10",
    psychology: "이진 선택 + 긍정 확정",
    emoji: "👍",
    urgency: 7,
    format: ["squeeze", "downsell"]
  },

  // 가격 렌즈: L1 가치 재정의
  "할인가 확인하기": {
    text: "할인가 확인하기",
    lens: "L1",
    psychology: "가격 재정의 + 가치 강조",
    emoji: "💰",
    urgency: 6,
    format: ["tripwire", "downsell", "hybrid"]
  },

  "월 결제 계산기": {
    text: "월 결제 계산기",
    lens: "L1",
    psychology: "가격 비용 최소화 (월 단위)",
    emoji: "💳",
    urgency: 4,
    format: ["tripwire", "funnel", "hybrid"]
  },

  // 신뢰형: L9 권위성 + 신뢰
  "전문가 상담 신청": {
    text: "전문가 상담 신청",
    lens: "L9",
    psychology: "권위성 (전문가) + 신뢰",
    emoji: "🎯",
    urgency: 5,
    format: ["webinar", "hybrid"]
  },

  "인증서 확인하기": {
    text: "인증서 확인하기",
    lens: "L9",
    psychology: "신뢰성 증명 + 권위성",
    emoji: "🏆",
    urgency: 2,
    format: ["webinar", "hybrid"]
  }
};

/**
 * 형식별 CTA 타입 권장사항
 *
 * 각 형식에 가장 잘 맞는 CTA 타입
 */
export const CTA_TYPE_BY_FORMAT: Record<PageFormat, CtaType[]> = {
  squeeze: ["urgent", "reserve"], // 긴박감 + 확정
  vsl: ["reserve", "default"], // 확정 + 신뢰
  webinar: ["explore", "default"], // 탐색 + 신뢰
  funnel: ["default", "explore"], // 단계적 전환
  tripwire: ["urgent", "reserve"], // 저가 + 긴박감
  downsell: ["urgent", "reserve"], // 재전환 + 할인
  launch: ["urgent", "reserve"], // 런칭 타이밍
  hybrid: ["default", "explore", "urgent", "reserve"] // 자유도 높음
};

/**
 * Day 0-3 SMS 스케줄 정의
 *
 * 각 형식별 SMS 발송 시간 설정
 * 포맷: "+Xd HH:mm" (X일 후 시간:분)
 */
export const SMS_SCHEDULE_BY_FORMAT: Record<PageFormat, Record<number, string>> = {
  // Squeeze: 신청 직후 즉시 (Day 0만)
  squeeze: {
    0: "+0d 09:00"
  },

  // VSL: Day 0-3 풀 시퀀스 (PASONA)
  vsl: {
    0: "+0d 09:00", // P+A: 문제 + 자극
    1: "+1d 10:00", // S: 해결책
    2: "+2d 18:00", // O+N: 오퍼 + 한정
    3: "+3d 09:00" // A: 행동
  },

  // Webinar: Day 0-3 풀 시퀀스 (신뢰도 강조)
  webinar: {
    0: "+0d 09:00",
    1: "+1d 10:00",
    2: "+2d 18:00",
    3: "+3d 09:00"
  },

  // Funnel: Day 0-3 풀 시퀀스 (단계별)
  funnel: {
    0: "+0d 09:00",
    1: "+1d 10:00",
    2: "+2d 18:00",
    3: "+3d 09:00"
  },

  // Tripwire: 저가 제안 + Day 1-3 업셀
  tripwire: {
    0: "+0d 09:00", // 저가 제안
    1: "+1d 10:00", // 메인 상품 소개
    2: "+2d 18:00", // 비교 + 가치
    3: "+3d 09:00" // 긴박감
  },

  // Downsell: Day 0-3 (할인 강조)
  downsell: {
    0: "+0d 09:00", // 다운셀 제안
    1: "+1d 10:00", // 할인율 강조
    2: "+2d 18:00", // 한정 + 긴박감
    3: "+3d 09:00" // 최종 결정
  },

  // Launch: Day 0-3 (카운트다운)
  launch: {
    0: "+0d 09:00", // 런칭 공지
    1: "+1d 10:00", // 카운트다운
    2: "+2d 18:00", // 얼리버드 한정
    3: "+3d 09:00" // 런칭 확정
  },

  // Hybrid: Day 0-3 (자유도)
  hybrid: {
    0: "+0d 09:00",
    1: "+1d 10:00",
    2: "+2d 18:00",
    3: "+3d 09:00"
  }
};

/**
 * 형식 설명 및 메타데이터
 */
export interface PageFormatMetadata {
  format: PageFormat;
  name: string;
  description: string;
  bestFor: string;
  primaryLens: string;
  minImages: number;
  expectedConversion: number;
  complexity: "simple" | "medium" | "complex";
  estimatedBuildTime: string; // "30분" | "1-2시간" | "2-4시간"
}

export const PAGE_FORMAT_METADATA: Record<PageFormat, PageFormatMetadata> = {
  squeeze: {
    format: "squeeze",
    name: "Squeeze Page",
    description: "가장 간단한 형식 - 배경만 있고 이메일 폼에 집중. 전환율 최고.",
    bestFor: "이메일 리스트 수집, 웨비나 등록",
    primaryLens: "L10 (즉시 구매)",
    minImages: 1,
    expectedConversion: 8.5,
    complexity: "simple",
    estimatedBuildTime: "30분"
  },
  vsl: {
    format: "vsl",
    name: "VSL (Video Sales Letter)",
    description: "영상 기반 판매 페이지. 스토리텔링으로 감정 유발.",
    bestFor: "고가 상품, 장시간 설득 필요",
    primaryLens: "L10 (신뢰 기반 클로징)",
    minImages: 2,
    expectedConversion: 5.6,
    complexity: "medium",
    estimatedBuildTime: "1-2시간"
  },
  webinar: {
    format: "webinar",
    name: "Webinar Registration",
    description: "웨비나 등록 페이지. 전문성과 신뢰도 강조.",
    bestFor: "교육 상품, 컨설팅, 고객 신뢰 구축",
    primaryLens: "L9 (신뢰/권위성)",
    minImages: 2,
    expectedConversion: 4.2,
    complexity: "medium",
    estimatedBuildTime: "1-2시간"
  },
  funnel: {
    format: "funnel",
    name: "Funnel (Multi-step)",
    description: "3단계 이상의 퍼널. 각 단계별 전환 최적화.",
    bestFor: "복잡한 여행 상품, 단계별 설득",
    primaryLens: "L2 (준비 불안 해소)",
    minImages: 3,
    expectedConversion: 9.8,
    complexity: "complex",
    estimatedBuildTime: "2-4시간"
  },
  tripwire: {
    format: "tripwire",
    name: "Tripwire (Low-ticket Entry)",
    description: "저가 상품으로 진입 → 메인 상품 업셀.",
    bestFor: "신규 고객 확보, 가격 민감층",
    primaryLens: "L1 (가격 재정의)",
    minImages: 2,
    expectedConversion: 15.2,
    complexity: "medium",
    estimatedBuildTime: "1-2시간"
  },
  downsell: {
    format: "downsell",
    name: "Downsell (Rejection Recovery)",
    description: "거부 고객을 저가 대안으로 재전환.",
    bestFor: "높은 거절율 상황 복구",
    primaryLens: "L1 (할인가 재제안)",
    minImages: 2,
    expectedConversion: 22.5,
    complexity: "medium",
    estimatedBuildTime: "1-2시간"
  },
  launch: {
    format: "launch",
    name: "Product Launch Page",
    description: "신제품 런칭. 카운트다운 + 얼리버드.",
    bestFor: "신제품 론칭, 재출시",
    primaryLens: "L6 (희소성 + 긴박감)",
    minImages: 2,
    expectedConversion: 7.8,
    complexity: "medium",
    estimatedBuildTime: "1-2시간"
  },
  hybrid: {
    format: "hybrid",
    name: "Hybrid (Custom)",
    description: "혼합형. 자유도 높음. 모든 요소 조합 가능.",
    bestFor: "커스텀 디자인, 브랜드 특화",
    primaryLens: "L10 (클로징)",
    minImages: 1,
    expectedConversion: 6.5,
    complexity: "complex",
    estimatedBuildTime: "2-4시간"
  }
};

/**
 * 렌즈별 권장 페이지 형식
 *
 * 주어진 렌즈에서 가장 효과적인 형식 추천
 */
export const RECOMMENDED_FORMAT_BY_LENS: Record<string, PageFormat[]> = {
  L0: ["webinar", "hybrid", "squeeze"],
  L1: ["tripwire", "downsell", "hybrid"],
  L2: ["funnel", "webinar", "hybrid"],
  L6: ["launch", "squeeze", "downsell"],
  L7: ["webinar", "funnel", "hybrid"],
  L9: ["webinar", "vsl", "hybrid"],
  L10: ["squeeze", "vsl", "launch", "hybrid"]
};

/**
 * 형식별 권장 텍스트 길이 가이드
 */
export const TEXT_LENGTH_GUIDELINES: Record<PageFormat, {
  headline: string;
  subheading: string;
  bodyText: string;
  cta: string;
}> = {
  squeeze: {
    headline: "5-8단어 (40자)",
    subheading: "한 줄 (50자)",
    bodyText: "2-3줄 (100자)",
    cta: "3-5단어 (15자)"
  },
  vsl: {
    headline: "6-10단어 (50자)",
    subheading: "2줄 (80자)",
    bodyText: "5-10줄 (300자)",
    cta: "3-5단어 (15자)"
  },
  webinar: {
    headline: "8-12단어 (60자)",
    subheading: "2-3줄 (100자)",
    bodyText: "8-15줄 (400자)",
    cta: "4-6단어 (20자)"
  },
  funnel: {
    headline: "6-10단어 (50자) × 3단계",
    subheading: "2줄 (80자) × 3단계",
    bodyText: "5-10줄 (300자) × 3단계",
    cta: "3-5단어 (15자)"
  },
  tripwire: {
    headline: "6-8단어 (50자)",
    subheading: "2줄 (80자)",
    bodyText: "5-8줄 (250자)",
    cta: "3-5단어 (15자)"
  },
  downsell: {
    headline: "6-8단어 (50자)",
    subheading: "2줄 (80자)",
    bodyText: "5-8줄 (250자)",
    cta: "4-6단어 (20자)"
  },
  launch: {
    headline: "6-10단어 (50자)",
    subheading: "2-3줄 (100자)",
    bodyText: "5-10줄 (300자)",
    cta: "4-6단어 (20자)"
  },
  hybrid: {
    headline: "자유 (40-80자)",
    subheading: "자유 (50-150자)",
    bodyText: "자유 (200-500자)",
    cta: "자유 (10-30자)"
  }
};

/**
 * Utility: 형식별 정보 조회
 */
export function getFormatInfo(format: PageFormat): PageFormatMetadata {
  return PAGE_FORMAT_METADATA[format];
}

/**
 * Utility: 형식별 필요 이미지 필드 조회
 */
export function getImageFields(format: PageFormat): ImageField[] {
  return IMAGE_FIELDS_BY_FORMAT[format];
}

/**
 * Utility: 형식별 권장 CTA 버튼 조회
 */
export function getRecommendedCtas(format: PageFormat): CtaPsychology[] {
  const ctaType = CTA_TYPE_BY_FORMAT[format];
  return Object.values(CTA_PSYCHOLOGY_MAP).filter(cta =>
    ctaType.some(t =>
      t === "urgent" && cta.urgency >= 7 ||
      t === "reserve" && cta.lens === "L10" ||
      t === "explore" && cta.urgency <= 5 ||
      t === "default" && cta.urgency >= 3 && cta.urgency <= 6
    )
  );
}

/**
 * Utility: 형식별 기대 전환율 조회
 */
export function getExpectedConversion(format: PageFormat): number {
  return EXPECTED_CONVERSION_BY_FORMAT[format].optimized;
}

/**
 * Utility: 렌즈 기반 형식 추천
 */
export function getRecommendedFormats(lens: string): PageFormat[] {
  return RECOMMENDED_FORMAT_BY_LENS[lens] || ["hybrid"];
}
