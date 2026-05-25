/**
 * L3 렌즈: 차별성 미인지형 고객 - 경쟁사 비교 데이터
 * Menu #49 구현
 */

export const COMPETITORS = {
  royal: {
    name: 'Royal Caribbean',
    code: 'royal',
    metrics: {
      shipSize: 'Large (4,000+ passengers)',
      cabinCount: '2,200+',
      targetAgeGroup: '40-65 (Average 55)',
      priceRange: '$1,200-$3,500',
      mainActivities: 'Theme parks onboard, slides, extreme sports',
      serviceStyle: 'Impersonal, queue-heavy',
      koreanFriendliness: 'Low (limited Korean staff)',
    },
    ourAdvantage: [
      'Service quality: Personal attention (Royal 5/10 vs us 9/10)',
      'Korean staff: 100% vs Royal <20%',
      'Value for money: 50-60% cheaper for same cabin quality',
      'Destination variety: Mediterranean, Caribbean, Asia focus',
    ],
  },
  msc: {
    name: 'MSC Cruises',
    code: 'msc',
    metrics: {
      shipSize: 'Medium (3,000+ passengers)',
      cabinCount: '1,800+',
      targetAgeGroup: '35-60 (Average 50)',
      priceRange: '$800-$2,500',
      mainActivities: 'Entertainment, comedy shows, casino',
      serviceStyle: 'European formality, less personal',
      koreanFriendliness: 'Very Low (minimal Korean support)',
    },
    ourAdvantage: [
      'Korean market expertise: Custom itineraries for Korean travelers',
      'Family-friendly: Better programs for kids vs MSC',
      'Price transparency: No hidden fees (MSC has resort credits)',
      'Asian destinations: Focus on regional ports',
    ],
  },
  disney: {
    name: 'Disney Cruise Line',
    code: 'disney',
    metrics: {
      shipSize: 'Medium (4,000+ passengers)',
      cabinCount: '2,000+',
      targetAgeGroup: 'Families with kids (25-55)',
      priceRange: '$2,000-$5,000',
      mainActivities: 'Character entertainment, shows, family activities',
      serviceStyle: 'High-touch, extremely polished',
      koreanFriendliness: 'Medium (limited Korean content)',
    },
    ourAdvantage: [
      'Affordability: $40-80 per person per night cheaper',
      'Adult experience: Disney focuses on families + kids',
      'Cultural immersion: Asian ports with local guides',
      'Customization: Romance packages without kids activities',
    ],
  },
} as const;

export type CompetitorCode = keyof typeof COMPETITORS;

export const COMPETITOR_LIST = [
  { code: 'royal' as CompetitorCode, displayName: 'Royal Caribbean' },
  { code: 'msc' as CompetitorCode, displayName: 'MSC Cruises' },
  { code: 'disney' as CompetitorCode, displayName: 'Disney Cruise Line' },
];

/**
 * L3 렌즈 핵심 메시지: 우리의 차별성
 */
export const L3_CORE_MESSAGE = {
  headline: '호텔+여행을 동시에, 리조트처럼 편한 크루즈',
  subheading: '호텔 여행의 편안함 + 매일 새로운 나라를 깨어나기',
  corePoints: [
    {
      point: '리조트처럼 편한 생활',
      detail: '호텔의 모든 편안함 + 짐 싸고 옮길 필요 없음 + 매일 아침 새로운 나라에서 깨어남',
    },
    {
      point: '가족 중심의 배려',
      detail: 'kids club, family programs, spousal care - 모든 가족 구성원이 즐기는 여행',
    },
    {
      point: '한국인을 위한 맞춤형',
      detail: '한국 스태프, 한국 음식, 한국인 맞춤 일정 - 언어/문화 걱정 없음',
    },
    {
      point: '가성비 최고',
      detail: '같은 가격에 호텔 3-4박 vs 크루즈 7박 + 이동 + 새로운 경험',
    },
  ],
} as const;

/**
 * L3 렌즈 자동 감지 키워드
 */
export const COMPETITOR_MENTION_KEYWORDS = {
  royal: [
    'royal',
    'royal caribbean',
    'rc',
    '카리브',
    '로얄',
    'oasis',
    'symphony',
    'wonder',
  ],
  msc: [
    'msc',
    'msc cruises',
    'mediterranean',
    'msc 크루즈',
    'msc가',
    'meraviglia',
    'seaview',
  ],
  disney: [
    'disney',
    'disney cruise',
    'dcl',
    '디즈니',
    'magic',
    'wonder',
    'fantasy',
    'dream',
  ],
} as const;

/**
 * L3 자동 분류: "호텔 경험 수준" 감지
 * 우리의 message를 어떻게 frame할지 결정
 */
export const HOTEL_EXPERIENCE_LEVELS = {
  none: {
    code: 'none',
    label: '호텔 여행 경험 없음',
    framingStrategy: 'new_world_discovery',
    message:
      '호텔 여행과 다른 완전히 새로운 경험을 드릴게요. 리조트에서 휴식하는 것처럼 편하면서도, 매일 새로운 나라를 깨어나실 수 있어요.',
  },
  basic: {
    code: 'basic',
    label: '가끔 호텔 여행',
    framingStrategy: 'familiar_upgraded',
    message:
      '호텔 여행의 좋은 점은 그대로 유지하면서, 더 나은 경험을 드릴 수 있어요. 새 호텔로 이동하는 번거로움 없이, 매일 새로운 나라를 방문하실 수 있습니다.',
  },
  frequent: {
    code: 'frequent',
    label: '자주 호텔 여행 다니심',
    framingStrategy: 'evolution_of_travel',
    message:
      '호텔 여행의 전문가이신 분이라면, 다음 단계를 경험하실 차례예요. 우리 크루즈는 호텔 여행을 "진화"시킨 형태로, 훨씬 더 효율적이고 풍부한 경험을 줍니다.',
  },
  regular: {
    code: 'regular',
    label: '매년 호텔 여행 다니심',
    framingStrategy: 'next_evolution',
    message:
      '여행을 많이 다니시는 분이라면, 이제 질적으로 다른 경험을 원하실 거예요. 우리 크루즈는 단순한 숙박이 아니라, 여행 자체가 하나의 경험이 되는 생활 방식입니다.',
  },
} as const;

export type HotelExperienceLevel = keyof typeof HOTEL_EXPERIENCE_LEVELS;

/**
 * L3 렌즈 자동 발송 SMS 템플릿
 * Day 0-3 시퀀스
 */
export const L3_SMS_TEMPLATES = {
  day0_competitor_mention: {
    day: 0,
    body: `안녕하세요! [{name}]님이 {competitor}와 비교해주셨군요. 같은 가격에 Royal은 1박, 우리는 7박입니다.

호텔의 편안함 + 매일 새로운 나라를 깨어나는 경험, 한 번 비교해보시겠어요? [링크]`,
    psychologyLens: 'L3_differentiation',
  },
  day1_structure_comparison: {
    day: 1,
    body: `{name}님, 간단한 비교표를 보내드렸어요.

호텔 여행: 매일 같은 호텔 + 짐 싸기 + 새 호텔 체크인 (피로도 ⬆️)
우리 크루즈: 한 번만 짐 싸기 + 배가 당신을 다음 나라로 옮김 + 리조트처럼 편함

더 자세한 설명이 필요하신가요? 짧은 전화로 설명해드릴게요.`,
    psychologyLens: 'L3_structure_visualization',
  },
  day2_lifestyle_promise: {
    day: 2,
    body: `{name}님의 가족 구성(성인{adults}명, 아이{kids}명)을 고려한 맞춤 패키지를 준비했어요.

🏖️ 호텔 풀장 vs 우리 배 풀장 (+워터슬라이드+액티비티)
🍽️ 호텔 1가지 음식 vs 우리 배 10가지 레스토랑
👨‍👩‍👧‍👦 호텔에선 혼자 vs 우리 배선 매일 함께하는 가족프로그램

지금 예약하면 [{discount}%] 할인 가능합니다!`,
    psychologyLens: 'L3_lifestyle_value',
  },
  day3_final_comparison: {
    day: 3,
    body: `{name}님, 마지막 비교입니다.

Royal $3,000 x 1박 = $3,000 (혼자만 여행)
우리 크루즈 $1,500 x 7박 = 1박당 $214 (가족 모두 즐김)

결정하세요: 호텔에서 쉬실까요? 아니면 리조트처럼 편한 배에서 새로운 세상을 여행할까요?

지금 바로 예약하기 → [링크]`,
    psychologyLens: 'L3_price_value_closing',
  },
} as const;

/**
 * L3 Risk Flag 자동 생성 로직
 */
export const L3_RISK_FLAGS = [
  {
    flag: 'competitor_price_obsession',
    trigger: 'competitor mentioned + asks about price twice',
    severity: 'HIGH',
    autoResponse: 'Send comparison table + value message (Day 0)',
  },
  {
    flag: 'hotel_frame_locked',
    trigger: '"호텔이랑 뭐가 달라" mentioned 3+ times',
    severity: 'CRITICAL',
    autoResponse: 'Escalate to 1:1 call with sales script',
  },
  {
    flag: 'no_response_to_differentiation',
    trigger: 'Differentiation message sent but no click for 48h',
    severity: 'MEDIUM',
    autoResponse: 'Send Day 2 lifestyle comparison message',
  },
  {
    flag: 'competitor_booking_imminent',
    trigger: '"이미 Royal로 예약했어", "MSC 예약 고민중"',
    severity: 'CRITICAL',
    autoResponse: 'Immediate 1:1 call + special offer',
  },
] as const;

/**
 * L3 렌즈 성공 KPI
 */
export const L3_TARGET_KPI = {
  conversionRate: {
    current: 0,
    target: 0.45, // 40-50% 목표 (Template #1 기준)
  },
  smsClickRate: {
    current: 0,
    target: 0.35,
  },
  differentiationUnderstanding: {
    current: 0,
    target: 80, // 0-100 점수
  },
} as const;
