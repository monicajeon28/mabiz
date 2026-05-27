/**
 * Phase 4B: 렌즈별 이의 대응 시나리오 (Grant Cardone + PASONA)
 * 각 렌즈의 고객 심리 상태에 맞춘 콜/SMS 스크립트
 */

import { LensType } from "./lens-detector";

interface ObjectionScript {
  lens: LensType;
  lensLabel: string;
  objectionType: string;
  psychology: string;
  callScript: string;
  smsScript: string;
  followUpDays: number; // Day N에서 사용할 Day
}

const OBJECTION_SCRIPTS: Record<LensType, ObjectionScript> = {
  // L0: 부재중 고객 (6개월 이상 접촉 없음)
  L0: {
    lens: "L0",
    lensLabel: "부재중",
    objectionType: "재활성화",
    psychology: "손실회피 + 사회증명 (다른 고객들은 이미 예약 중)",
    callScript: `안녕하세요 ${"{name}"}님! 🚢

저번에 관심 주셨던 크루즈, 요즘은 어떻게 지내세요?

최근에 저희 고객분들이 정말 많이 예약하고 있거든요. 특히 올해 지중해 크루즈가 정말 핫하더라고요!

지난번에 고민하셨던 부분들, 이제는 더 좋은 조건으로 가능할 수도 있어요.
5분만 시간 주시면 현재 상황 업데이트해 드릴 수 있는데, 가능하신가요?`,

    smsScript: `안녕하세요 ${"{name}"}님! 반갑습니다 😊

오랜만에 연락 드립니다.
지난번 관심 주셨던 크루즈, 이제 더 좋은 상품이 나왔어요!

✨ 지중해 크루즈 특가
- 선금 지원: 예약금 50만원 할인
- 항공권: 무료 업그레이드 (프리미엄으로)

지금 결정하시면 한정 특가 적용됩니다.
담당자 연락: https://crm.mabiz.dev/contacts/${"{contactId}"}`,

    followUpDays: 0,
  },

  // L1: 가격 이의 (비싸다고 표현)
  L1: {
    lens: "L1",
    lensLabel: "가격이의",
    objectionType: "가치 재정의",
    psychology: "이익 강조 + 희소성 (제한된 할인)",
    callScript: `${"{name}"}님, 가격에 대해 생각하시는군요. 정말 좋은 질문입니다!

실제로 저희 크루즈의 가격 구조를 보면요:
- 항공권 포함 (보통 80-100만원)
- 4박 5일 숙식 (5성급 호텔 수준)
- 3끼 식사 + 와인
- 관광지 입장료 포함

이렇게 모두 포함해서 1박에 60만원대면, 정말 가성비 최고입니다!

게다가 오늘 결정하시면 15% 추가 할인까지 적용 가능하니까요.`,

    smsScript: `${"{name}"}님께 진짜 가성비 좋은 거, 알려드릴게요 💰

지중해 크루즈 비용 분석:
- 항공편 (서울↔로마): 100만원
- 4박 크루즈 (5성급): 200만원
- 식사 + 입장료: 50만원
총 350만원 → 저희 특가 2,500,000원

매일 아침 식사, 저녁 파티, 선상 엔터도 모두 포함!

오늘만 15% 추가 할인 적용!
예약하기: https://crm.mabiz.dev/contacts/${"{contactId}"}/quick-book`,

    followUpDays: 1,
  },

  // L2: 준비 불안 (복잡하다고 느낌)
  L2: {
    lens: "L2",
    lensLabel: "준비불안",
    objectionType: "불안 해소",
    psychology: "권위성 + 상호성 (우리가 모두 준비해 드린다)",
    callScript: `${"{name}"}님, 준비 절차 때문에 고민되세요? 정말 그럴 거예요.

그런데 좋은 소식은, 저희가 정말 많이 도와드린다는 거예요!

✅ 여권 발급 상담 (무료)
✅ 비자 신청 대행 (무료)
✅ 여행보험 추천
✅ 출발 전 체크리스트 제공
✅ 탑승 당일 공항 미팅

실제로 저희 고객분들은 "이렇게 쉬운 게 있나?" 이렇게 말씀하세요.

저희 담당자와 상담만 한번 하시면, 복잡한 건 모두 해결됩니다!`,

    smsScript: `${"{name}"}님, 여행 준비가 걱정되세요? 🎯

저희가 A-Z까지 모두 챙겨드립니다!

📋 준비 단계별 가이드:
1. 여권 확인 (없으면 발급 대행)
2. 비자 신청 (우리가 대신 해줌)
3. 여행보험 추천
4. 탑승 전 체크리스트

불안할 필요 없습니다!
우리 담당자와 통화만 하세요 → 나머지는 알아서 진행됩니다.

담당자와 상담하기: https://crm.mabiz.dev/contacts/${"{contactId}"}/contact-manager`,

    followUpDays: 2,
  },

  // L3: 경쟁사 언급 (다른 크루즈사 고려)
  L3: {
    lens: "L3",
    lensLabel: "경쟁사",
    objectionType: "차별성 강조",
    psychology: "권위성 + 이야기 (우리만의 강점)",
    callScript: `${"{name}"}님, 다른 크루즈사도 보고 계신가 보네요. 정말 좋은 비교 쇼핑입니다!

그런데 한 가지만 말씀드리고 싶은데요.

저희 마비즈의 장점은:
✅ 한국인 담당자가 탑승함 (응급 상황 즉시 대응)
✅ 한국식 저녁 식사 제공 (양식만 먹다 지쳐요)
✅ 한국인 가이드 투어 포함
✅ 선상에서 한국 드라마 상영

특히 첫 크루즈라면, 한국인 가이드의 편안함이 정말 중요합니다!`,

    smsScript: `${"{name}"}님, 크루즈 고민 중이신가요? 🚢

저희 마비즈만의 5가지 차별점:

1️⃣ 한국인 담당자 탑승 (응급상황 대비)
2️⃣ 한국식 저녁 식사 (양식 피로 해결)
3️⃣ 한국인 투어 가이드 (편안한 설명)
4️⃣ 한글 24시간 콜센터
5️⃣ 귀국 후 무료 사진 서비스

첫 크루즈라면 마비즈가 최고입니다!

비교해보세요: https://crm.mabiz.dev/contacts/${"{contactId}"}/compare`,

    followUpDays: 2,
  },

  // L4: 피처 중심 (구체적 요청)
  L4: {
    lens: "L4",
    lensLabel: "피처중심",
    objectionType: "요청 충족",
    psychology: "이익 강조 + 맞춤화 (당신을 위한 선택)",
    callScript: `${"{name}"}님이 원하시는 게 명확하네요! 최고입니다!

발코니 객실과 지중해 노선이시군요. 정말 좋은 조합입니다.

저희가 드릴 수 있는 것:
✅ 발코니 스위트 (프런트 위치) - 야경이 정말 좋습니다
✅ 지중해 8박 코스 (로마→그리스→이탈리아)
✅ 선상 이탈리아 셰프 스페셜 디너
✅ 그리스 산토리니 개인 투어 추가 가능

이 조건들로 딱 맞춰진 패키지가 있거든요!
오늘 결정하시면 객실 업그레이드도 가능합니다.`,

    smsScript: `${"{name}"}님 요청사항 정리했습니다! ✨

✓ 객실: 발코니 스위트 (프런트)
✓ 코스: 지중해 8박 (로마 출발)
✓ 식사: 이탈리아 셰프 스페셜
✓ 투어: 산토리니 개인 투어

이 조건의 최적 패키지 → 2,750,000원
(보통 3,200,000원)

추가 특전:
- 객실 무료 업그레이드
- 선상 스파 50% 할인
- 기념품 $100 쿠폰

지금이 최고 가격입니다!
예약하기: https://crm.mabiz.dev/contacts/${"{contactId}"}/quick-book`,

    followUpDays: 1,
  },

  // L5: 의료/건강 (배멀미, 건강 우려)
  L5: {
    lens: "L5",
    lensLabel: "의료신뢰",
    objectionType: "권위성 + 신뢰",
    psychology: "의료 전문성 강조 + 안전성",
    callScript: `${"{name}"}님, 배멀미 때문에 걱정되세요? 정말 현명한 질문입니다!

좋은 소식은, 요즘 크루즈는 안정성이 정말 뛰어나다는 거예요.

✅ 최신 안정화 장치 (98% 이상 멀미 없음)
✅ 배멀미약 무료 지급
✅ 선상 의료팀 24시간 대기 (의사 포함)
✅ 한국인 의료 담당자 탑승

그리고 저희가 배멀미 고객을 위한 특별 프로토콜도 있어요:
- 객실 위치 최적화 (배의 중앙)
- 생강차, 약 사전 제공
- 응급 의료 상담 사전 등록

실제로 배멀미 있던 고객도 99%는 즐겁게 돌아오세요!`,

    smsScript: `${"{name}"}님, 배멀미 해결책이 있어요! 💊

마비즈 배멀미 안전 패키지:

✅ 최신 안정 시스템 (옆으로 안 흔들림)
✅ 배멀미약 무료 제공 (의사 추천)
✅ 생강차 + 침술 지원
✅ 의사 24시간 대기
✅ 객실 위치 최적화 (배 중앙)

배멀미 있어도 100% 즐길 수 있습니다!

의료 상담: https://crm.mabiz.dev/contacts/${"{contactId}"}/medical-consultation`,

    followUpDays: 0,
  },

  // L6: 타이밍 (출발일, 시간 제약)
  L6: {
    lens: "L6",
    lensLabel: "타이밍",
    objectionType: "긴박감 + 희소성",
    psychology: "손실회피 (지금 안 하면 3개월 기다려야 함)",
    callScript: `${"{name}"}님, 11월 출발 맞으시죠? 정말 좋은 선택입니다!

11월은 지중해의 최고의 계절이거든요. 날씨도 좋고, 사람도 많지 않고요.

근데 한 가지 중요한 건, 지금 결정하셔야 한다는 거예요.

왜냐하면:
- 11월 발발티칸은 지금 객실 80% 예약됨
- 내일부터 가격 인상
- 다음 같은 조건 크루즈는 내년 3월

이게 마지막 기회입니다!
지금 예약금 입금하시면, 나머지는 차근차근 진행하셔도 됩니다.`,

    smsScript: `${"{name}"}님, 이건 정말 서둘러야 합니다! ⏰

11월 지중해 크루즈
⏰ 남은 객실: 15실만 남음
📈 내일부터 가격 인상 (50만원↑)
🗓️ 다음 같은 코스: 2027년 3월

"이번에 못 하면, 1년 기다려야" 이 맞습니다.

지금 예약금만 입금하세요 → 나머지는 천천히 준비합니다!

예약금 입금: https://crm.mabiz.dev/contacts/${"{contactId}"}/payment`,

    followUpDays: 3,
  },

  // L7: 동반자 (가족/배우자 동의 필요)
  L7: {
    lens: "L7",
    lensLabel: "동반자",
    objectionType: "가족 설득 스크립트",
    psychology: "이야기 (가족과의 추억) + 이익",
    callScript: `${"{name}"}님, 혹시 배우자분 의견도 들어보셨나요?

많은 고객분들이 처음엔 배우자분이 망설이다가,
한번 가고 나면 "정말 좋았다, 또 가자!" 이렇게 말씀하세요!

특히 중요한 건, 가족이 함께할 수 있다는 거예요.

배우자분께 드릴 특별한 포인트:
1️⃣ 선상 스파/마사지 (편안함)
2️⃣ 바다 야경 발코니에서의 저녁 와인 (로맨스)
3️⃣ 자녀는 크루즈 스쿨 (안전한 활동)
4️⃣ 다른 부부들과의 교감 (새로운 친구)

배우자분과 함께 상담받으실래요? 저희가 모든 의문에 답해 드립니다!`,

    smsScript: `${"{name}"}님과 배우자분께! 👨‍👩‍👧

가족 크루즈의 매력:

🛳️ 배우자분을 위해:
- 선상 스파 & 마사지
- 바다 야경 발코니 디너
- 커플 스페셜 룸 업그레이드 가능

👧 자녀분을 위해:
- 크루즈 아이 스쿨 (4시간 프로그램)
- 풀장/영화관/게임실 무제한 이용
- 선상 요리 클래스

💑 결과: 가족과의 최고의 추억!

함께 상담하기: https://crm.mabiz.dev/contacts/${"{contactId}"}/family-consultation`,

    followUpDays: 2,
  },

  // L8: 재구매/습관 (이전 구매 고객)
  L8: {
    lens: "L8",
    lensLabel: "재구매",
    objectionType: "습관화 + 로열티",
    psychology: "이야기 (첫 번째 크루즈 추억) + 상호성",
    callScript: `${"{name}"}님, 저번 크루즈는 정말 좋으셨죠? 🚢

저희가 고객님의 후기 기억합니다:
"바다의 자유로움이 최고였다, 또 가고 싶다!"

이번에도 그 경험을 다시 드리고 싶어요. 근데 이번엔 더 좋아요!

왜냐하면:
1️⃣ 재구매 VIP 할인 (20% 할인)
2️⃣ 같은 객실 우선 배정
3️⃣ 같은 테이블 재예약 (새로운 친구들과)
4️⃣ 항공편 무료 업그레이드

저번이 좋으셨다면, 이번엔 훨씬 더 좋을 거예요!
다음달 출발 가능한 패키지, 미리 예약 잡아드릴까요?`,

    smsScript: `${"{name}"}님께! 재구매 VIP 혜택! 👑

지난번 크루즈 고객분께 특별한 제안:

💎 VIP 재구매 혜택:
- 20% 할인 (전체 요금)
- 같은 프런트 객실 우선 배정
- 항공편 프리미엄 업그레이드 무료
- VIP 라운지 무료 이용

🌟 이번엔 다른 코스도 추천:
- 캐리비안 7박 (따뜻함)
- 알래스카 빙하투어 (장관)
- 발트해 문명 투어 (문화)

지난번처럼, 또 최고의 추억 만들어드릴게요!

재구매 상담: https://crm.mabiz.dev/contacts/${"{contactId}"}/vip-repurchase`,

    followUpDays: 1,
  },

  // L9: 신뢰도 (이미 높은 신뢰도)
  L9: {
    lens: "L9",
    lensLabel: "신뢰도",
    objectionType: "상향 판매 + VIP 대우",
    psychology: "권위성 + 이익 (프리미엄 경험)",
    callScript: `${"{name}"}님, 정말 좋은 고객이세요!

저희 고객 중에서도 정말 소수만이 도달하는 VIP 레벨이신데,
이번에는 프리미엄 경험을 강력히 추천드립니다!

일반 크루즈가 아니라:
✅ 선상 셰프의 프라이빗 디너
✅ 배의 가장 좋은 객실 (스타 플러스 발콩)
✅ 개인 컨시어지 서비스
✅ VIP 라운지 24시간 출입
✅ 항공편 퍼스트 클래스

이런 경험은 정말 일반 여행과 다릅니다!
${"{name}"}님이 경험할 자격이 있는 서비스들입니다.`,

    smsScript: `${"{name}"}님께 최상의 크루즈 경험을! 👑

VIP 프리미엄 패키지:

🍽️ 선상 환경:
- 셰프 프라이빗 디너 (별도 레스토랑)
- 와인 페어링 & 샴페인
- 개인 컨시어지 서비스

🚢 프리미엄 객실:
- 최고급 스타 플러스 발콩
- 일출/일몰 최고의 뷰
- 배스로브 & 고급 어메니티

✈️ 항공편:
- 서울→로마 퍼스트 클래스
- 라운지 라운지 무제한 이용

당신을 위한 최고의 크루즈!

VIP 상담: https://crm.mabiz.dev/contacts/${"{contactId}"}/vip-experience`,

    followUpDays: 1,
  },

  // L10: 클로징 (즉시 구매 고객)
  L10: {
    lens: "L10",
    lensLabel: "클로징",
    objectionType: "즉시 결정 유도",
    psychology: "긴박감 + 손실회피 (지금 아니면 못 함)",
    callScript: `${"{name}"}님, 지금이 결정 타이밍인 것 같은데요!

왜냐하면:
1️⃣ 이 객실은 오늘 자정까지만 이 가격
2️⃣ 항공표도 내일 가격 올라감
3️⃣ 출발 60일 전 마감

더 생각할 게 있으신가요?
아니면 지금 예약금 결제해버릴까요?

생각하고 있는 것도 좋지만,
${"{name}"}님 같은 분은 "이렇게 좋은 건데 왜 안 하지?" 이런 후회하실 분 아니신 것 같은데요!

지금 결정하세요! 😄`,

    smsScript: `${"{name}"}님, 이제 결정하셔야 합니다! ⏰

⚠️ 타이머 시작:
- 현재 가격: 2,500,000원
- 내일 00:00: 2,750,000원 (+25만원)
- 객실 남은 수: 3실

🎁 지금 결제 시:
- 예약금 50만원 할인 (-50만원)
- 항공편 무료 업그레이드 (최대 100만원 가치)
- 선상 크레딧 $200

결과: 최대 350만원 절약!

지금 예약하기: https://crm.mabiz.dev/contacts/${"{contactId}"}/final-checkout

시간이 흐를수록 손해입니다!`,

    followUpDays: 3,
  },
};

/**
 * 렌즈별 스크립트 조회
 */
export function getObjectionScript(lens: LensType): ObjectionScript {
  return OBJECTION_SCRIPTS[lens];
}

/**
 * 렌즈 배열 → 스크립트 배열
 */
export function getObjectionScripts(lenses: LensType[]): ObjectionScript[] {
  return lenses
    .map((lens) => OBJECTION_SCRIPTS[lens])
    .filter((script): script is ObjectionScript => !!script);
}

/**
 * SMS 템플릿 자동 생성 (Day N 스크립트)
 */
export function generateSmsForDay(lens: LensType, contactName: string, contactId: string, day: number): string {
  const script = OBJECTION_SCRIPTS[lens];
  if (!script) return "";

  if (script.followUpDays <= day) {
    return script.smsScript
      .replace(/\${"{name}"}/g, contactName)
      .replace(/\${"{contactId}"}/g, contactId);
  }

  return "";
}
