/**
 * Landing Pages Phase 3 Constants
 * Russell Brunson 8가지 페이지 형식 + CTA 심리학 렌즈
 *
 * pageFormat: squeeze, vsl, webinar, funnel, tripwire, downsell, launch, hybrid
 * ctaType: default, urgent, explore, reserve
 */

/**
 * Russell Brunson 페이지 형식별 이미지 필드 설정
 * 각 형식이 필요로 하는 이미지 타입 정의
 */
export const IMAGE_FIELDS_BY_FORMAT: Record<string, Record<string, string>> = {
  squeeze: {
    // 이메일 수집 페이지 (짧은 폼)
    headerImage: "헤더 배너 (1200x400px 이상)",
    ctaImage: "CTA 버튼 위 설득 이미지",
  },
  vsl: {
    // VSL(Video Sales Letter) - 비디오 중심
    heroVideo: "메인 판매 비디오 썸네일",
    transcriptImage: "비디오 전사 시각화",
    ctaImage: "최종 구매 버튼 이미지",
  },
  webinar: {
    // 웨비나 등록 페이지
    speakerImage: "강사/전문가 사진 (원형 250x250px)",
    eventImage: "이벤트 배너 (1200x600px)",
    bonusImage: "특별 보너스 이미지",
  },
  funnel: {
    // 판매 퍼널 (다단계)
    stepImage1: "Step 1 설명 이미지",
    stepImage2: "Step 2 설명 이미지",
    stepImage3: "Step 3 설명 이미지",
    resultImage: "결과/성과 이미지",
  },
  tripwire: {
    // Tripwire (저가 오퍼) 페이지
    productImage: "상품 사진 (좌측 300x300px)",
    comparisonImage: "원래 가격 vs 할인가 비교표",
    guaranteeImage: "만족도 보증 배지",
  },
  downsell: {
    // Downsell (대안 상품) 페이지
    originalImage: "원래 상품 이미지",
    downsellImage: "대안 상품 이미지",
    testimonialImage: "고객 후기 증명사진",
  },
  launch: {
    // Launch (새 상품 출시) 페이지
    launchImage: "출시 배너 (1200x400px)",
    timelineImage: "제한된 시간 타이머/카운트다운",
    bonusImage: "초기 구매자 보너스 시각화",
  },
  hybrid: {
    // 하이브리드 (커스텀)
    heroImage: "헤로 섹션 배너",
    midImage: "중간 설득 이미지",
    ctaImage: "최종 행동 촉구 이미지",
  },
};

/**
 * CTA 유형별 심리학 렌즈 + 텍스트 매핑
 * Grant Cardone 10렌즈 + Russell Brunson 프레임워크 통합
 */
export const CTA_PSYCHOLOGY_MAP: Record<
  string,
  {
    lens: string;
    description: string;
    text: string;
    pasona_phase: string;
    urgency_level: "low" | "medium" | "high";
  }
> = {
  default: {
    // L0: 신규/기본 (신뢰 구축)
    lens: "L0_TRUST",
    description: "신뢰 구축 + 안내",
    text: "신청하기",
    pasona_phase: "A (Action)",
    urgency_level: "low",
  },
  urgent: {
    // L6: 타이밍/긴박감 (희소성 + 긴박감)
    lens: "L6_TIMING_URGENCY",
    description: "희소성 + 긴박감 + 손실회피",
    text: "지금 신청하기 (마지막 기회)",
    pasona_phase: "A (Action) + Urgency",
    urgency_level: "high",
  },
  explore: {
    // L3: 차별성/탐색 (호기심 + 차별화)
    lens: "L3_DIFFERENTIATION",
    description: "차별성 강조 + 호기심 유발",
    text: "더 알아보기",
    pasona_phase: "S (Solution)",
    urgency_level: "medium",
  },
  reserve: {
    // L1: 가치 재정의 (할부/예약)
    lens: "L1_AFFORDABILITY",
    description: "가치 재정의 + 접근성 강조",
    text: "지금 예약하기 (저렴한 가격)",
    pasona_phase: "O (Offer)",
    urgency_level: "medium",
  },
};

/**
 * 페이지 형식별 설명 + Russell Brunson 마케팅 심리학
 */
export const PAGE_FORMAT_DESCRIPTIONS: Record<
  string,
  {
    name: string;
    description: string;
    best_for: string;
    conversion_rate: string;
    setup_difficulty: "easy" | "medium" | "hard";
  }
> = {
  squeeze: {
    name: "Squeeze Page (짜기 페이지)",
    description:
      "이메일 주소만 수집. 가장 단순한 형식으로 최고의 진입율 달성. Russell Brunson의 '가장 강력한 페이지'",
    best_for: "리드 생성, 초기 리스트 구축, 무료 오퍼",
    conversion_rate: "20-40%",
    setup_difficulty: "easy",
  },
  vsl: {
    name: "VSL (Video Sales Letter)",
    description:
      "비디오 기반 판매 편지. 약 17분 영상으로 높은 신뢰도와 전환율 달성. Grant Cardone 이의 대응 + 스토리텔링 활용",
    best_for: "높은 가격 상품, 신뢰 구축 필요, 고관여 구매",
    conversion_rate: "5-15%",
    setup_difficulty: "hard",
  },
  webinar: {
    name: "Webinar Registration",
    description:
      "웨비나 등록 페이지. 전문가 신뢰성 + 교육 가치로 고품질 리드 생성. L9 (신뢰/권위성) 활용",
    best_for: "B2B 판매, 교육 상품, 고가 컨설팅",
    conversion_rate: "10-25%",
    setup_difficulty: "medium",
  },
  funnel: {
    name: "Funnel Page (다단계 퍼널)",
    description:
      "3-5단계 PASONA 프레임워크 시각화. 점진적 신뢰 구축 + 단계별 이의 대응. Russell Brunson의 핵심 전략",
    best_for: "복잡한 상품, 높은 가격, 이의 대응 필요",
    conversion_rate: "3-12%",
    setup_difficulty: "hard",
  },
  tripwire: {
    name: "Tripwire (초저가 오퍼)",
    description:
      "초저가 우선 상품 제안. 고객 획득 후 업셀 전략. L1 (가치 재정의) + L10 (즉시 구매) 활용",
    best_for: "신규 고객 확보, 타이트한 마케팅 예산",
    conversion_rate: "5-20%",
    setup_difficulty: "medium",
  },
  downsell: {
    name: "Downsell (대안 상품)",
    description:
      "거절 후 낮은 가격 대안 제시. 손실회피 심리 + 할부 강조. 최대 30% 추가 수익 창출",
    best_for: "고가 상품 거절 후 대체, 추가 수익",
    conversion_rate: "15-30%",
    setup_difficulty: "medium",
  },
  launch: {
    name: "Launch Page (신제품 출시)",
    description:
      "한정 시간/수량 강조. L6 (긴박감) + L1 (희소성) 최대 활용. 출시 기간 집중 마케팅용",
    best_for: "신제품 출시, 시즌 한정 상품, 초기 홍보",
    conversion_rate: "8-18%",
    setup_difficulty: "medium",
  },
  hybrid: {
    name: "Hybrid (커스텀)",
    description:
      "위 형식들을 자유롭게 조합. 조직의 고유한 마케팅 전략 반영. 최고의 유연성 제공",
    best_for: "맞춤형 캠페인, 여러 형식의 장점 결합",
    conversion_rate: "5-20% (설정에 따라 변동)",
    setup_difficulty: "hard",
  },
};

/**
 * pageFormat + ctaType 조합 권장 설정
 */
export const FORMAT_CTA_RECOMMENDATIONS: Record<
  string,
  Record<string, { recommended: boolean; reason: string }>
> = {
  squeeze: {
    default: { recommended: true, reason: "신뢰 구축 최우선" },
    urgent: { recommended: false, reason: "과도한 압박감" },
    explore: { recommended: true, reason: "추가 정보 호기심" },
    reserve: { recommended: false, reason: "형식 불일치" },
  },
  vsl: {
    default: { recommended: false, reason: "너무 약함" },
    urgent: { recommended: true, reason: "강한 마무리 필요" },
    explore: { recommended: true, reason: "비디오 시청 후 탐색" },
    reserve: { recommended: true, reason: "스토리 후 예약 강조" },
  },
  webinar: {
    default: { recommended: true, reason: "교육적 신뢰감" },
    urgent: { recommended: true, reason: "자리 한정성 강조" },
    explore: { recommended: false, reason: "웨비나는 이미 탐색" },
    reserve: { recommended: false, reason: "형식 불일치" },
  },
  funnel: {
    default: { recommended: false, reason: "약한 마무리" },
    urgent: { recommended: true, reason: "마지막 단계에서 긴박감" },
    explore: { recommended: true, reason: "단계별 탐색" },
    reserve: { recommended: true, reason: "최종 예약 강조" },
  },
  tripwire: {
    default: { recommended: false, reason: "저가 강점을 못 살림" },
    urgent: { recommended: true, reason: "한정 수량 강조" },
    explore: { recommended: false, reason: "형식 불일치" },
    reserve: { recommended: true, reason: "초저가 예약 강조" },
  },
  downsell: {
    default: { recommended: false, reason: "약한 구조" },
    urgent: { recommended: true, reason: "마지막 기회 강조" },
    explore: { recommended: false, reason: "형식 불일치" },
    reserve: { recommended: true, reason: "대안 상품 예약" },
  },
  launch: {
    default: { recommended: false, reason: "출시 기한 불표현" },
    urgent: { recommended: true, reason: "제한 시간 강조" },
    explore: { recommended: false, reason: "형식 불일치" },
    reserve: { recommended: true, reason: "초기 신청 강조" },
  },
  hybrid: {
    default: { recommended: true, reason: "유연한 기본값" },
    urgent: { recommended: true, reason: "긴박감 추가 가능" },
    explore: { recommended: true, reason: "탐색 단계 추가 가능" },
    reserve: { recommended: true, reason: "예약 마무리 가능" },
  },
};

/**
 * PASONA 프레임워크를 pageFormat + ctaType에 매핑
 */
export const PASONA_FRAMEWORK_MAPPING: Record<
  string,
  {
    phase: string;
    description: string;
    key_lens: string;
  }
> = {
  "squeeze:default": {
    phase: "P (Problem) + A (Agitate)",
    description: "문제 인식 + 감정 자극 후 간단한 신청",
    key_lens: "L0 (신뢰) + L2 (불안 해소)",
  },
  "squeeze:explore": {
    phase: "P + A + S (Solution hint)",
    description: "문제 → 감정 → 해결책 미리보기",
    key_lens: "L0 + L3 (차별화)",
  },
  "vsl:urgent": {
    phase: "모든 PASONA 풀 스토리 + N (Narrow) + A (마지막 긴박감)",
    description: "17분 전체 스토리 후 한정성 강조",
    key_lens: "L6 (긴박감) + L10 (즉시 구매)",
  },
  "vsl:explore": {
    phase: "P → A → S → O → 탐색",
    description: "가장 기본적인 마케팅 스토리 구조",
    key_lens: "L3 (차별화) + L5 (자기투영)",
  },
  "funnel:urgent": {
    phase: "각 단계마다 PASONA 미니 + 최종 N + A",
    description: "다단계 PASONA 반복 + 최종 긴박감",
    key_lens: "L6 (단계별 긴박감) + L10",
  },
  "funnel:explore": {
    phase: "단계별 S → O → 사용자 선택",
    description: "단계별 해결책 제시",
    key_lens: "L3 + L4 (자율성)",
  },
  "tripwire:urgent": {
    phase: "O (저가 오퍼) + N (한정) + A (지금)",
    description: "초저가 + 한정성 + 즉시 구매",
    key_lens: "L6 (희소성) + L1 (가치)",
  },
  "tripwire:reserve": {
    phase: "O (저가) + N (수량 한정) + A (예약)",
    description: "저가 오퍼로 신규 고객 확보",
    key_lens: "L1 (가격) + L10 (구매 용이성)",
  },
  "webinar:default": {
    phase: "P + 전문가 신뢰 + A (등록)",
    description: "전문가 권위성으로 신뢰 구축",
    key_lens: "L9 (신뢰/권위성) + L0",
  },
  "webinar:urgent": {
    phase: "P + 전문가 + N (자리 한정) + A",
    description: "전문가 신뢰 + 자리 한정성",
    key_lens: "L9 + L6 (한정성)",
  },
  "launch:urgent": {
    phase: "O (신제품) + N (기간/수량 한정) + A (지금)",
    description: "신제품 기한 강조 + 즉시 구매",
    key_lens: "L6 (시간 한정) + L1 (새로움)",
  },
  "downsell:urgent": {
    phase: "대체 O (낮은 가격) + N (거절 후 마지막) + A",
    description: "거절 후 손실회피로 대체 상품 판매",
    key_lens: "L6 (손실회피) + L1 (가격)",
  },
};
