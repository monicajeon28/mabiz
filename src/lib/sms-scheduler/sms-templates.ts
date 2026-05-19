/**
 * Menu #38 Phase 4 Step 5-3: 렌즈별 SMS 시퀀스 템플릿
 * 각 렌즈별 Day 0-3 SMS 메시지 (PASONA + 손실회피 심리학 적용)
 */

import { LensSequence } from './types';

/**
 * L1: 가격 오해형 (3일 시퀀스)
 * 핵심: 멤버비 vs 상품비 명확화 → 올인클루시브 가성비 입증 → 신규 선박 우선권
 */
export const L1_PRICE_RESISTANCE: LensSequence = {
  lensType: 'L1',
  lensName: 'L1_PRICE_RESISTANCE',
  description: '월 33,000원 광고 오해형 - 멤버비 vs 상품비 분리 설명',
  priority: 'MEDIUM',
  day0_delay_minutes: 10,
  templates: {
    day_0: {
      day: 0,
      template: `안녕하세요, {name}님!

크루즈닷입니다. 방금 통화해주셔서 감사해요.

확인차 다시 정리해드릴게요:

✓ 멤버비: 월 33,000원 (또는 66,000원)
✓ 크루즈비: 150~200만원 (4인 기준)

두 가지 모두 필요하지만,
'자유롭게 선택'할 수 있어요.

이달 가입하면 첫 달 10% 할인!

가입하러 가기: https://cruisedot.kr/join`,
      variables: ['name'],
      psychologyTag: 'Loss Aversion (손실 회피)',
    },
    day_1: {
      day: 1,
      template: `{name}님,

일반여행 vs 크루즈 비용을
계산해봤어요:

일반여행 (부부 3박):
✗ 비행기: 1,600,000원
✗ 호텔: 1,200,000원
✗ 식사: 450,000원
= 총 3,250,000원

크루즈 (부부 3박):
✓ 멤버: 33,000원
✓ 크루즈: 1,600,000원
= 총 1,633,000원

절약액: 1,617,000원!

당신은 이미 160만원을 절약하고 있어요.
가입 완료하고 예약하세요: https://cruisedot.kr/book`,
      variables: ['name'],
      psychologyTag: 'Scarcity (희소성)',
    },
    day_2: {
      day: 2,
      template: `{name}님,

당신이 올 수 있는 신규 선박들이에요:

🚢 Dream Cruises (5월 18일 출항)
- 객실: 7㎡ (기존 5㎡)
- 욕실: 욕조 추가

🚢 Paradise Class (6월 1일 출항)
- 스파 수영장 2개
- 극장 (3000명 수용)

멤버 우선 예약권으로
지금 선택할 수 있어요!

예약하러 가기: https://cruisedot.kr/ships`,
      variables: ['name'],
      psychologyTag: 'Social Proof (사회적 증명)',
    },
    day_3: {
      day: 3,
      template: `{name}님!

신규 선박 탑승이 남았어요.

🚢 Dream Cruises 6월 출항
- 멤버 우선 예약: {remaining_cabins}석 남음

멤버로 가입하신 분들은
일반 고객보다 먼저 예약할 수 있어요.

이 특권은 내일까지만!

지금 예약하세요: https://cruisedot.kr/urgent`,
      variables: ['name', 'remaining_cabins'],
      psychologyTag: 'Urgency (긴급성) + Scarcity',
    },
  },
};

/**
 * L2: 준비 부담형 (2일 시퀀스)
 * 핵심: 준비 과정 간단화 → 자동화 강조
 */
export const L2_PREPARATION_BURDEN: LensSequence = {
  lensType: 'L2',
  lensName: 'L2_PREPARATION_BURDEN',
  description: '준비 과정 복잡함 우려 - 간단한 절차 강조',
  priority: 'LOW',
  day0_delay_minutes: 10,
  templates: {
    day_0: {
      day: 0,
      template: `안녕하세요, {name}님!

크루즈닷입니다. 통화 감사합니다.

"준비가 복잡하지 않을까?"
하셨는데, 걱정하지 마세요!

우리는 준비 과정을 철저히 관리해드려요:

✓ 여권 사진 수집: 앱에서 간단히
✓ 비자 신청: 저희가 대행
✓ 수하물 사전 신고: 온라인 폼 작성

정말 간단합니다!

시작하기: https://cruisedot.kr/setup`,
      variables: ['name'],
      psychologyTag: 'Narrative Transportation (내러티브)',
    },
    day_1: {
      day: 1,
      template: `{name}님,

지난번 통화에서 고민하신 부분들:

❌ 여권 사진 수집 (5명)
→ 앱 이용하면 1시간 완료

❌ 비자 신청 (국가별)
→ 저희 전문가가 대행 (비용 포함)

❌ 선박 탑승 물품 확인
→ 체크리스트 자동 발송

실제로는 훨씬 쉬워요!

가입해서 시작하기: https://cruisedot.kr/join`,
      variables: ['name'],
      psychologyTag: 'Commitment (약속)',
    },
  },
};

/**
 * L3: 차별성 미인지형 (3일 시퀀스)
 * 핵심: 크루즈 경험 차별성 강조 (음식, 엔터, 포트)
 */
export const L3_DIFFERENTIATION: LensSequence = {
  lensType: 'L3',
  lensName: 'L3_DIFFERENTIATION',
  description: '크루즈 vs 일반여행 차별성 미인지 - 경험 강조',
  priority: 'MEDIUM',
  day0_delay_minutes: 10,
  templates: {
    day_0: {
      day: 0,
      template: `안녕하세요, {name}님!

"일반 여행과 뭐가 달라요?"
하셨던 부분 설명해드릴게요.

크루즈는 '배 탔다'가 아니라:

✓ 매일 다른 나라 (이동 0분)
✓ 식사 5번/일 (식당 10곳)
✓ 밤마다 공연 (극장 4곳)
✓ 수영장, 짐 이동 X

"호텔이 계속 옮겨다니는 것"

가입해서 경험하세요: https://cruisedot.kr/experience`,
      variables: ['name'],
      psychologyTag: 'Narrative Transportation',
    },
    day_1: {
      day: 1,
      template: `{name}님,

크루즈 고객들이 가장 만족하는 부분 Top 3:

1️⃣ 음식 (별점 4.9/5.0)
- 셀러드 15가지
- 한국식당, 이탈리안, 일식 5곳
- 24시간 룸서비스

2️⃣ 엔터테인먼트 (별점 4.8/5.0)
- 매일 밤 공연 (브로드웨이 수준)
- 코미디쇼, 뮤지컬, 라이브밴드

3️⃣ 여행 경험 (별점 4.9/5.0)
- 3일에 3개 나라
- 호텔 체크인/아웃 0번

고객 후기 보기: https://cruisedot.kr/reviews`,
      variables: ['name'],
      psychologyTag: 'Social Proof',
    },
    day_2: {
      day: 2,
      template: `{name}님,

"선실에 얼마나 있을까?" 걱정하셨죠?

실제 크루즈 이용 고객들 (100명 조사):
- 선실: 4시간 (수면 포함)
- 데크: 8시간 (해양 경험)
- 실내: 8시간 (쇼, 카지노, 라운지)
- 상륙: 4시간 (포트 여행)

왜 배에만 있을까요?
선실이 아니라 배 전체가 목적지!

확인해보세요: https://cruisedot.kr/itinerary`,
      variables: ['name'],
      psychologyTag: 'Priming (프라이밍)',
    },
  },
};

/**
 * L6: 타이밍 미결형 (4일 시퀀스 - HIGH 우선도)
 * 핵심: 손실 앵커 + 긴급성 강조
 */
export const L6_TIMING_UNCERTAINTY: LensSequence = {
  lensType: 'L6',
  lensName: 'L6_TIMING_UNCERTAINTY',
  description: '여행 시기 미정 - 손실 앵커 + 우선권 기한 강조',
  priority: 'HIGH',
  day0_delay_minutes: 10,
  templates: {
    day_0: {
      day: 0,
      template: `안녕하세요, {name}님!

"타이밍이 미결정이라..."고 하셨는데,
이게 실은 기회비용이에요.

지금 멤버가 되면:
✓ 신규 선박 우선 예약 (일반고객 -3개월)
✓ 얼리버드 할인 20% (일반고객 0%)
✓ 포인트 선물 (100,000포인트)

그런데 이 특권은 내일까지!

"내가 언제 갈지 정하기 전에
이미 손해를 본 거"

멤버가 되세요: https://cruisedot.kr/vip`,
      variables: ['name'],
      psychologyTag: 'Loss Aversion + Scarcity',
    },
    day_1: {
      day: 1,
      template: `{name}님,

어릴 적 생각해보세요.

"나중에 가면 되겠지" 하다가...
"더 비싸졌네?" 한 적 있어요?

크루즈도 마찬가지:
- 올해 5월: 150만원 (신규배 우선)
- 6월 이후: 170만원 (일반 예약)
- 내년: 200만원 (상품 가격 인상)

가격은 매달 3% 상승합니다.
(지난 5년 평균)

기한: 내일 자정까지 얼리버드 적용
https://cruisedot.kr/deadline`,
      variables: ['name'],
      psychologyTag: 'Anchoring + Loss Aversion',
    },
    day_2: {
      day: 2,
      template: `{name}님,

"언제 갈지 정한 후 가입하겠다"
이 생각, 이미 늦었어요.

왜냐하면:

📌 신규 선박 우선 예약
→ 내일 자정 + 48시간 = 2일 남음

📌 얼리버드 할인 20%
→ 내일 자정 + 1시간 = 1시간 남음 🚨

📌 환영 포인트 100,000원
→ 내일 자정 + 0분

{name}님이 "언제 갈지 정하기"를
기다리는 동안,
다른 사람들은 이미 예약했어요.

가입: https://cruisedot.kr/urgent`,
      variables: ['name'],
      psychologyTag: 'FOMO (Fear of Missing Out)',
    },
    day_3: {
      day: 3,
      template: `{name}님!

마지막 기회입니다.

🚢 Dream Cruises (5월 18일 출항)
- 멤버 우선 예약: {remaining_cabins}석
- 얼리버드 20%: 00:00까지만

만약 지금 가입하지 않으면:
❌ 다른 사람이 선택
❌ 가격 +20만원 (일반 요금)
❌ 기다림 (+3개월 예약 대기)

결정하세요: https://cruisedot.kr/final`,
      variables: ['name', 'remaining_cabins'],
      psychologyTag: 'Urgency + Loss Aversion (최종)',
    },
  },
};

/**
 * L9: 건강/안전 불안형 (4일 시퀀스 - CRITICAL 우선도)
 * 핵심: 의료 팀 강조 + 안전 보증
 */
export const L9_HEALTH_SAFETY: LensSequence = {
  lensType: 'L9',
  lensName: 'L9_HEALTH_SAFETY',
  description: '건강/안전 불안 - 의료팀 + 안전 보증 강조',
  priority: 'CRITICAL',
  day0_delay_minutes: 10,
  templates: {
    day_0: {
      day: 0,
      template: `안녕하세요, {name}님!

"멀미가 심해서..."라고 하셨는데,
크루즈 고객 중 40%가 같은 걱정 합니다.

하지만 대부분 아무 문제 없어요.

왜냐하면:

✓ 배의 크기 (150,000톤 = 건물처럼 흔들림 적음)
✓ 의료팀 24시간 (의사, 간호사 상주)
✓ 멀미약 무료 제공 (선실 배송)
✓ 환불 보장 (3일 이상 멀미 = 100% 환불)

걱정을 떨쳐내세요.
당신은 준비되어 있어요.

가입하기: https://cruisedot.kr/health`,
      variables: ['name'],
      psychologyTag: 'Trust Building (신뢰 구축)',
    },
    day_1: {
      day: 1,
      template: `{name}님,

크루즈 의료팀이 정말 어떤 수준인지
알려드릴게요:

🏥 배 위의 병원 (4층 규모)
- 응급실 (24시간)
- 주사실 (멀미약, 감기약)
- 의사 (내과, 외과, 산부인과)
- 간호사 (20명 상주)

의료비: 포함 (기본 진료비)
약값: 무료 (멀미약, 감기약)

"배 위에서도 서울 삼성병원 수준"

의료팀 소개: https://cruisedot.kr/medical`,
      variables: ['name'],
      psychologyTag: 'Narrative Transportation',
    },
    day_2: {
      day: 2,
      template: `{name}님,

아이 안전 걱정도 있으셨죠?

크루즈의 안전 수준:

🔒 침몰률: 0.00001% (일반 항공사 사고율보다 낮음)
🔒 아이용 풀: 얕이 + 감시원 상주
🔒 응급 상황: 헬리콥터 구조 (3시간 안에)
🔒 보험: 자동 포함 (사망 최대 50만불)

"일반 비행기보다 훨씬 안전해요"

안전 정보: https://cruisedot.kr/safety`,
      variables: ['name'],
      psychologyTag: 'Authority (권위)',
    },
    day_3: {
      day: 3,
      template: `{name}님!

마지막으로 한 가지만.

지난 20년간 크루즈닷 고객 중:
- 심한 멀미로 하차: 0명
- 의료 응급: 총 3명 (모두 회복)
- 만족도: 4.8/5.0

{name}님은 준비가 되어 있어요.

두려움을 떨쳐내고
크루즈를 경험하세요.

예약하기: https://cruisedot.kr/book

(의료팀이 당신을 지켜줄 거예요)`,
      variables: ['name'],
      psychologyTag: 'Reassurance (재보증)',
    },
  },
};

/**
 * L10: 즉시 구매형 (즉시 발송 - CRITICAL 우선도)
 * 핵심: "이미 결정했다" → 신민형 5STEP 삼중선택
 */
export const L10_IMMEDIATE_PURCHASE: LensSequence = {
  lensType: 'L10',
  lensName: 'L10_IMMEDIATE_PURCHASE',
  description: '즉시 구매 의사 고객 - 신민형 5STEP 삼중선택 강조',
  priority: 'CRITICAL',
  day0_delay_minutes: 2,  // 즉시 발송 (2분)
  templates: {
    day_0: {
      day: 0,
      template: `{name}님!

"더 이상 고민 안 하겠습니다"
그 말씀이 정말 기뻐요.

당신의 선택에 3가지 옵션이 있어요:

1️⃣ 플랜 A (월 33,000원)
→ 연 1-2회 예상
→ 할인 20% (신규 할인 추가 10%)

2️⃣ 플랜 B (월 66,000원)
→ 연 3-4회 예상
→ 할인 15% (신규 할인 추가 10%)

3️⃣ 플랜 C (월 99,000원)
→ 연 5회 이상 예상
→ 할인 10% (신규 할인 추가 10%)

당신은? ↓

A: https://cruisedot.kr/plan-a
B: https://cruisedot.kr/plan-b
C: https://cruisedot.kr/plan-c`,
      variables: ['name'],
      psychologyTag: 'Commitment + Choice Architecture',
    },
    day_1: {
      day: 1,
      template: `{name}님,

선택해주셨나요?

만약 아직 선택 중이라면,
이 팁이 도움될 거예요:

"당신이 연 몇 회 타고 싶은가"

→ 1-2회: 플랜 A (월 33,000)
→ 3-4회: 플랜 B (월 66,000) ⭐ 최인기
→ 5+회: 플랜 C (월 99,000)

대부분은 플랜 B를 선택했어요.
왜냐하면:
- 월 66,000은 "커피값"
- 1년에 3-4번 가는 게 최적

당신도 플랜 B로 가보세요: https://cruisedot.kr/plan-b`,
      variables: ['name'],
      psychologyTag: 'Social Proof + Framing',
    },
    day_2: {
      day: 2,
      template: `{name}님!

연 3-4회 크루즈를 탄다면:

📅 5월: 싱가포르 (3박)
📅 8월: 홍콩 (4박)
📅 11월: 일본 (3박)
📅 2월: 대만 (2박)

= 연 2-3회 / 연 12박 = 행복

그런데 이걸 일반여행으로 하려면?
→ 연 1,800만원 (항공료, 호텔, 식사)

크루즈는?
→ 멤버 792,000 + 상품 4,800,000 = 5,592,000

"연 1,200만원 절약"

이정도면... 결정하셔야 하지 않을까요?

지금 가입: https://cruisedot.kr/final`,
      variables: ['name'],
      psychologyTag: 'Comparison + Value Messaging',
    },
  },
};

/**
 * 렌즈별 SMS 템플릿 맵
 */
export const LENS_SEQUENCE_MAP: Record<string, LensSequence> = {
  L1: L1_PRICE_RESISTANCE,
  L2: L2_PREPARATION_BURDEN,
  L3: L3_DIFFERENTIATION,
  L6: L6_TIMING_UNCERTAINTY,
  L9: L9_HEALTH_SAFETY,
  L10: L10_IMMEDIATE_PURCHASE,
};

/**
 * 템플릿 없는 렌즈 (L4, L5, L7, L8은 아직 정의 대기)
 * 향후 Step 5-3-B에서 구현 예정
 */
export const LENS_PLACEHOLDER_MESSAGE =
  '안녕하세요, {name}님! 크루즈닷입니다. 더 많은 정보는 담당자에게 문의해주세요. https://cruisedot.kr/support';
