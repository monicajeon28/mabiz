/**
 * Day 0-3 Email 템플릿 (v1 완성)
 *
 * PASONA 프레임워크 매핑:
 *   - Day 0: P(Problem) + A(Agitate) → 초기 신뢰 구축 (환영메시지)
 *   - Day 1: S(Solution) → Follow-up (해결책 제시)
 *   - Day 2: O(Offer) + N(Narrow) → 가치 강조 (사례+증명)
 *   - Day 3: A(Action) → 최종 클로징 (보증+결정촉구)
 *
 * SMS vs Email 심리학 분리:
 *   - SMS: L10(즉시), L6(긴박) - 160자 직설적
 *   - Email: L5(신뢰), L7(동반), L9(안전) - 800-1100자 narrative
 *
 * 동적 변수 지원:
 *   {{name}}, {{destination}}, {{price}}, {{monthlyPrice}}, {{discount}}
 *   {{managerName}}, {{managerPhone}}, {{daysLeft}}, {{remainingSeats}}
 *   {{bookingRef}}, {{daysUntilDeparture}}, {{managerTitle}}, {{guaranteeText}}
 */

import type { SmsSequence } from "@/lib/landing-sms-templates";

/**
 * 이메일 시퀀스 인터페이스
 * SMS와 유사하지만 text가 아니라 HTML 안전 문자열
 */
export interface EmailSequence {
  day0: string;  // 800-1000 chars
  day1: string;  // 900-1100 chars
  day2: string;  // 950-1150 chars
  day3: string;  // 850-1000 chars
}

/**
 * 이메일 제목 템플릿 (심리학 + 변수 포함)
 */
export interface EmailSubjects {
  day0: string;
  day1: string;
  day2: string;
  day3: string;
}

/**
 * L0: 신규 고객 (기본)
 * 심리학: L5(신뢰) + L7(동반자)
 */
export const L0_EMAIL_TEMPLATES: EmailSequence = {
  day0: `안녕하세요 {{name}}님! 🙌

{{destination}} 신청 감사합니다.

저는 크루즈닷의 수석 컨설턴트 {{managerName}}입니다.
지난 12년간 2,500명 이상의 고객분들께 안전한 해외여행을 준비해드렸습니다.

📍 당신의 여행 준비를 위해 저희팀은 지금 바로 움직이고 있습니다:
✅ 여행지 완벽 가이드 (출발 전 100% 준비)
✅ 베테랑 매니저 전담 (상담→예약→탑승까지)
✅ 24/7 긴급 연락처 (언제든 연락 가능)

{{managerPhone}}로 2시간 이내 연락 드리겠습니다.
혹시 급한 일이 생기면 카톡도 가능합니다.

당신의 {{destination}} 여행, 이제 시작이 아니라 확정입니다.

최선을 다하는 {{managerName}}이 함께합니다.`,

  day1: `어제는 신청 감사합니다, {{name}}님. 😊

상담 자료를 정리했습니다. 당신의 {{destination}} 준비를 위해
저희팀이 준비한 3가지 상품을 소개합니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎁 상품 1: 기본형 - {{price}}
베테랑 매니저 1명 + 기본가이드북

🌟 상품 2: 표준형 - 월 {{monthlyPrice}}
베테랑 2명 + 일일 컨시어지 서비스

💎 상품 3: 프리미엄 - 월 {{monthlyPrice}}+
전담 매니저 3명 + VIP 공항 라운지
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

당신의 여행 스타일에 맞는 상품을 추천해드리고 싶습니다.
3가지를 둘러보신 후 언제든 {{managerName}} 매니저께 물어보세요.

"이 상품이 맞나요?" → "당신의 경우라면 표준형이 딱입니다" 이렇게요.`,

  day2: `좋은 소식이 있습니다, {{name}}님! 💚

지난 6개월간 {{destination}}을 다녀간 고객 92%가
"다시 신청하고 싶다"고 말씀하셨어요.

실제 고객 후기들:

"처음엔 불안했는데 {{managerName}} 매니저가 하나하나 챙겨줘서
정말 편했어요. 이번엔 가족 모두 함께 신청하고 싶습니다."
- 이정훈님 (3박 4일)

"여행 중에도 매니저가 연락 주셔서 마음이 편했고,
귀국 후에도 사진 정리까지 도와주셨습니다!"
- 박미정님 (5박 6일)

"베테랑 가이드가 숨은 명소까지 소개해줘서
일반 패키지는 경험 못 하는 것들을 많이 봤습니다."
- 김철수님 (7박 8일)

────────────────────────────
이 마음들은 당신도 충분히 느낄 수 있습니다.
왜냐하면 당신도 그들처럼 {{managerName}} 매니저와 함께하니까요.

당신의 {{destination}}은 이미 준비되고 있습니다.`,

  day3: `{{name}}님께 당신의 {{destination}}은 이제 '계획'이 아니라 '확정'입니다. 🎉

지난 3일간 당신이 보여주신 관심이 바로
"이 여행이 정말 맞다"는 신호입니다.

마지막으로 당신을 위한 3가지 약속:

✅ 전액 환불 보장 (출발 30일 전까지)
✅ {{managerName}} 매니저 전담 (처음부터 끝까지)
✅ 24/7 긴급 연락처 (여행 중 언제든 지원)

이제 결정만 하면 됩니다.

"네, {{destination}} 신청하겠습니다"

그러면 오늘부터 우리팀의 5명이 당신의 여행 준비를 시작합니다.
여권, 비자, 항공권, 짐 준비까지 모두요.

{{managerPhone}}로 한 통의 전화면 모든 게 시작됩니다.`,
};

export const L0_EMAIL_SUBJECTS: EmailSubjects = {
  day0: "{{name}}님의 {{destination}} 여행 준비, 저희가 맡아드릴게요",
  day1: "{{name}}님을 위해 준비한 3가지 상품 소개",
  day2: "당신과 같은 고객 92%의 선택 이유",
  day3: "[최종 결정] {{destination}} 신청하시겠어요?",
};

/**
 * L1: 가격 민감 고객
 * 심리학: L1(가격비교) + L3(차별성)
 */
export const L1_EMAIL_TEMPLATES: EmailSequence = {
  day0: `안녕하세요, {{name}}님! 저예산 상담 감사합니다.

당신의 우려는 정확합니다. 일반 여행사는 {{destination}}을
1,890,000원에 판매합니다.

우리는 다릅니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 크루즈닷 가격: {{price}}
- 중개 수수료: 0원
- 환급 보증금: 0원
- 숨겨진 비용: 0원
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

할부도 가능합니다.
"월 {{monthlyPrice}} × 12개월 = {{price}}"

신은행 신규금융이라 금리도 0%입니다.

당신이 보는 가격이 곧 최종 가격입니다.
거짓말 없이, 명확합니다.

{{managerName}} 매니저가 당신의 '비용 최적화 방안'을
직접 제시해드리겠습니다.

그게 우리의 약속입니다.`,

  day1: `당신의 우려를 푸는 증거입니다, {{name}}님.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
비교 항목 | 크루즈닷 | A사 | B사
가격 | {{price}} | 1,890,000 | 1,950,000
환불 | 100% | 30% | 불가
수수료 | 0% | 5% | 7%
할부 금리 | 0% | 3.5% | 5.2%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

당신이 {A사}를 선택했다면, 환불은 559,000원(30%)만 받고,
수수료 94,500원을 더 내야 했습니다.

우리는 그렇지 않습니다.

할부 예상: 월 {{monthlyPrice}} × 12개월
(타 업체: 월 {{monthlyPrice}}+ + 수수료)

투명성. 그게 우리입니다.

더 궁금한 부분이 있으면 {{managerPhone}}로 연락주세요.
숨겨진 조건은 절대 없으니까요.`,

  day2: `좋은 소식입니다, {{name}}님. 💰

할부로 {{destination}}을 떠난 고객 89%가
"이게 최고의 선택"이라고 말합니다.

실제 사례들:

"월 {{monthlyPrice}}니까 부담 없이 신청했는데
여행이 정말 인생 최고였어요.
다음 달 또 다른 상품도 예약했습니다!"
- 강희만님 (월 35K × 12개월)

"회사 보너스로 갚으려고 12개월 할부를 선택했어요.
중간에 금리 올라도 0%니까 계획대로 갚을 수 있었습니다.
다른 금융사는 이렇게 못 해요."
- 정수진님 (월 42K × 12개월)

"초기 자금이 부족했는데 6개월로 나눌 수 있어서
정말 감사했습니다. 월 {{monthlyPrice}}×2 = 부담 적음!
여행도 대만족입니다!"
- 이순신님 (월 {{monthlyPrice}}×6개월)

────────────────────────────
당신도 이렇게 할 수 있습니다.

월 {{monthlyPrice}}는 커피값 정도입니다.
그 댓가로 당신은 {{destination}} 여행을 확보합니다.

금리 0%이니까 이 기회를 놓치면
다음 할인까지 3개월을 더 기다려야 합니다.

지금이 맞는 타이밍입니다.`,

  day3: `{{name}}님을 위해 특별한 계산을 했습니다.

오늘 신청 시 적용되는 할인:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
정가: {{price}}
└─ 얼리버드 할인(30%): -{{discount}}
└─ 신규 고객 추가 할인(10%): -{{discount}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

이 그림이 마음에 들면 이제 결정만 하면 됩니다.

"네, {{price}} 할부로 신청하겠습니다."

그러면 {{managerName}} 매니저가 바로 계약서를 준비합니다.
내일이 되면 이 할인은 사라집니다.

{{managerPhone}}로 "할부 신청"이라고 한 통만 주세요.`,
};

export const L1_EMAIL_SUBJECTS: EmailSubjects = {
  day0: "{{price}} vs 1,890,000원 | 숨겨진 비용 0원",
  day1: "당신이 몰랐던 '숨겨진 비용' 4가지",
  day2: "월 {{monthlyPrice}}로 {{destination}} 떠난 89%의 후기",
  day3: "[한정 할인] 오늘 신청 시 추가 {{discount}}원 더 절감",
};

/**
 * L2: 준비 불안 고객
 * 심리학: L2(준비불안감소) + L9(안전감)
 */
export const L2_EMAIL_TEMPLATES: EmailSequence = {
  day0: `안녕하세요, {{name}}님! 준비가 걱정되시네요? 그건 정상입니다.

여권, 비자, 항공권... 생각만 해도 복잡하죠.

하지만 {{managerName}} 매니저는 이런 일을 2,400번 했습니다.

우리의 역할은 당신의 불안을 0으로 만드는 것입니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 당신의 준비 5단계:

1️⃣ 여권/비자 (매니저가 전담)
2️⃣ 건강검진 (무료 장소 안내)
3️⃣ 짐 준비 (체크리스트 제공)
4️⃣ 항공편 (할인 항공권 선제공)
5️⃣ 출발 (매니저 직접 동반)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

당신은 '신청'만 하면 됩니다.
나머지는 모두 매니저가 챙깁니다.

지난 12년간 준비 때문에 여행을 포기한 사람은 없습니다.
당신도 그럴 것입니다.

불안함이 신뢰감으로 바뀌는 순간까지 함께합니다.

{{managerPhone}} - 언제든 연락 가능합니다.`,

  day1: `준비 계획을 정리했습니다, {{name}}님.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗓️ {{destination}} 준비 타임라인

[D-45] 지금: 여권/비자 신청 → 매니저가 안내서 보냄
[D-30] 건강검진 예약 → 무료 병원 리스트 제공
[D-21] 항공편 결정 → 할인 항공권 3개사 비교제시
[D-14] 짐 준비 시작 → PDF 체크리스트 제공
[D-7]  출발 가이드 → 최종 확인 연락
[D-1]  공항 집결 → 매니저가 직접 픽업
[D+0] 여행 시작! → 24/7 긴급연락처 활성화
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

각 단계마다 매니저가 연락해서
"다음은 이걸 하세요"라고 알려줍니다.

복잡한 일은 없습니다.
당신은 매니저의 지시만 따르면 됩니다.

이 계획서가 맞다면, 오늘 신청하세요.
내일부터 준비가 시작됩니다.`,

  day2: `좋은 소식, {{name}}님! 💝

이미 {{destination}}을 준비한 89명의 체크리스트를 보여드립니다.

성공한 여행자들의 공통점:
✅ 여권 신청: 평균 D-38에 완료
✅ 비자 대행: 매니저에게 맡김 (평균 D-25)
✅ 항공편: 크루즈닷 추천 (평균 절감액 45,000원)
✅ 짐 준비: PDF 체크리스트 활용 (누락률 0%)
✅ 건강검진: 무료 병원 이용 (평균 비용 0원)

당신도 이 89명처럼 할 수 있습니다.

실제 고객 후기:

"여권 따로, 비자 따로 하려다가 헷갈릴 뻔했는데
매니저가 하나하나 챙겨줘서 정말 편했습니다.
불안함도 금방 사라졌어요."
- 임영희님

"처음엔 준비가 많다고 생각했는데
체크리스트를 받으니까 되돌아갈 일이 없었습니다.
예상보다 훨씬 쉬웠어요!"
- 조윤희님

────────────────────────────
당신의 {{destination}}은 이미 성공한 89명의 경로를 따릅니다.

불안은 필요 없습니다.
매니저가 있으니까요.

오늘 신청하면 내일부터 준비가 시작됩니다.`,

  day3: `{{name}}님, 이제 준비의 마지막 단계입니다. 📋

당신의 {{destination}} 여행은 이미 80% 완성되었습니다.

남은 것은:
✅ 서명 1장 (신청서)
✅ 전화 1통 ({{managerPhone}})

그러면 {{managerName}} 매니저가 나머지 20%를 완성합니다.

────────────────────────────
⏰ 최종 준비 스케줄

[지금] 신청 → 계약서 이메일 발송
[1시간] 서명 → 매니저 확인 전화
[D-45] 여권/비자 → 매니저 대행 신청
[D-30] 항공편 선택 → 예약 완료
[D-14] 짐 준비 → 체크리스트 제공
[D-1] 최종 확인 → 출발 안내

당신이 해야 할 일: 0개
매니저가 해야 할 일: 11개

────────────────────────────

이 계획이 좋으면 오늘 결정하세요.

"네, {{destination}} 준비하겠습니다."

그러면 {{managerName}} 매니저가 지금 바로 움직입니다.
여권부터, 비자부터, 항공권부터...

모든 것이 연쇄적으로 준비됩니다.

당신의 준비 걱정은 이제 끝입니다.

{{managerPhone}}로 신청해주세요.`,
};

export const L2_EMAIL_SUBJECTS: EmailSubjects = {
  day0: "{{destination}} 준비 5단계 | 우리가 처음부터 끝까지",
  day1: "{{destination}} 준비, 이 순서대로만 하면 끝",
  day2: "준비가 완벽한 고객 89명의 공통점",
  day3: "[최종] {{destination}} 준비 100% 완성하기",
};

/**
 * L6: 시간/긴박감 고객 (희소성+손실회피)
 * 심리학: L6(손실회피) + L6(희소성) + L10(즉시행동)
 */
export const L6_EMAIL_TEMPLATES: EmailSequence = {
  day0: `🚨 긴급 공지, {{name}}님!

{{destination}} 남은 자리: {{remainingSeats}}석

이 기회를 아세요?

지난 3개월간:
- 월 1회차: 3일 만에 마감
- 월 2회차: 5일 만에 마감
- 월 3회차: 2일 만에 마감

지금 신청하면: 평생 30% 할인 확정
내일 신청하면: 15% 할인으로 내려감
3일 뒤: 할인 종료

────────────────────────────
당신이 '생각하는 동안'

이 자리를 원하는 사람은 매 시간 늘어납니다.

{{remainingSeats}}석이 {{remainingSeats}}-5석으로.
그다음 {{remainingSeats}}-10석으로.

마지막 1석이 남은 후엔 예비 대기자 등록만 가능합니다.

────────────────────────────

당신은 선택해야 합니다.

지금 {{destination}}을 확보할 것인가?
아니면 3개월 뒤를 기다릴 것인가?

{{managerPhone}}로 지금 신청하세요.
"자리 예약 부탁합니다"라는 한 통이면 됩니다.

늦기 전에.`,

  day1: `{{name}}님, 어제 후 상황이 바뀌었습니다. ⏰

{{destination}} 현재 남은 자리: {{remainingSeats}}석
(어제 9:00am: 15석 → 오늘 9:00am: {{remainingSeats}}석)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
당신이 이 메일을 읽는 동안:
- 평균 1명씩 신청 중 (시간당 {{remainingSeats}})
- 자리가 평균 2시간마다 1석씩 줄어듦
- {{remainingSeats}}석 → 0석까지: 약 {{remainingSeats}}시간
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

이것은 '유명 여행지'가 아니라 '한정 상품'입니다.

당신의 생각 시간이 누군가의 신청 기간이 됩니다.

────────────────────────────
당신이 기다린다면:

내일 오전 10시: {{remainingSeats}}-3석
내일 오후 3시: {{remainingSeats}}-5석
모레 오전: {{remainingSeats}}-8석

당신도 알겠지요. 이건 시간 싸움입니다.

{{managerPhone}}로 지금 신청하세요.
"자리 우선 예약 부탁합니다"

이 문장 하나가 당신의 {{destination}}을 확보합니다.`,

  day2: `🔥 이제 72시간만 남았습니다, {{name}}님.

{{destination}} 남은 자리: {{remainingSeats}}석

당신이 결정하지 않는 동안:

▶ 어제 오후 1시: 12석
▶ 어제 저녁 6시: 10석
▶ 오늘 오전 9시: {{remainingSeats}}석

패턴은 명확합니다.
72시간 뒤면 0석입니다.

────────────────────────────
만약 당신이 못 신청한다면?

당신은 다음달까지 3개월을 기다려야 합니다.

그 동안:
- 가격은 올라갑니다 (평균 +250,000원)
- 할인은 없습니다 (5% 정도 남음)
- 같은 시기 친구들은 이미 다녀옵니다

지금 신청한 사람과의 차이: 3개월 + 가격 상승

────────────────────────────
실제 사례:

"미루다가 결국 못 신청했어요.
다음달 기다렸는데 가격이 올라있었고,
친구는 이미 다녀왔어요.
그때 정말 후회했습니다."
- 허민영님 ({{destination}} 작년)

"'내일 신청하자'고 생각했다가 오늘 보니 매진이었어요.
정말 아쉽습니다. 다음 기회는 6개월 뒤래요."
- 박준호님 ({{destination}} 지난달)

────────────────────────────

당신이 해야 할 일:

{{managerPhone}}로 전화 한 통.
"{{destination}} 신청 부탁합니다"

이것이 당신의 {{destination}}을 확보하는 유일한 방법입니다.

72시간. 그게 전부입니다.`,

  day3: `{{name}}님께 최후 통첩입니다.

📢 {{destination}} 최종 공고

남은 자리: {{remainingSeats}}석 (마지막)
남은 시간: 24시간 (정오 마감)

────────────────────────────
당신의 선택지:

[ 1 ] 지금 신청 → 평생 30% 할인 + 다음 3개월 선예약권
[ 2 ] 1시간 뒤 신청 → 15% 할인만 적용
[ 3 ] 내일 신청 → 예비 대기자만 등록 가능 (확정 불가)
[ 4 ] 3개월 대기 → 가격 상승 + 친구들 이미 다녀옴

────────────────────────────

당신이 '내일'을 선택한다면:

"죄송합니다. {{destination}}은 매진되었습니다.
예비 대기자로 등록되시겠어요?"

그 문장을 들을 준비가 되었나요?

당신이 '3개월 뒤'를 선택한다면:

가격 인상: +250,000원
할인 추가: 없음
당신의 친구: 이미 다녀옴

그 상황을 받아들일 준비가 되었나요?

────────────────────────────

아니라면 지금입니다.

{{managerPhone}}로 "{{destination}} 최종 신청"이라고 말하세요.

{{managerName}} 매니저가 지금 바로 당신의 예약을 확정합니다.

다음 기회는 3개월 뒤입니다.`,
};

export const L6_EMAIL_SUBJECTS: EmailSubjects = {
  day0: "🚨 [긴급] {{destination}} {{remainingSeats}}석 남음 | 지금 신청 시 30% 할인",
  day1: "{{name}}님, {{remainingSeats}}석 → {{remainingSeats}} (12시간 새)",
  day2: "⏰ {{name}}님, 72시간 남음 | {{remainingSeats}}석 마지막 기회",
  day3: "[최후 통첩] {{destination}} 24시간 내 신청해야 합니다",
};

/**
 * L10: 즉시 구매 고객 (확정됨)
 * 심리학: L10(축하) + L5(자기투영) + L7(동반자) + L8(재구매)
 */
export const L10_EMAIL_TEMPLATES: EmailSequence = {
  day0: `축하합니다! 🎉 {{name}}님

{{destination}} 신청이 완료되었습니다.

당신은 이달 신청자 142명 중 상위 100명에 들었습니다.

이것은 무엇을 의미하는가?

✅ 당신의 판단이 정확하다는 뜻
✅ 당신이 놓친 기회를 만회한다는 뜻
✅ 당신의 {{destination}}이 이제 '확정'이라는 뜻

평생 30% 할인은 자동으로 적용되었습니다.

────────────────────────────

이제 당신의 역할은 '기다리는 것'입니다.

{{managerName}} 매니저가 다음 2시간 내 전화합니다.

그 전화에서:
- 최종 예약 확정
- 여행 일정 확정
- 준비 계획 수립

당신이 해야 할 것: 전화만 받으면 됩니다.

당신의 {{destination}}은 이제 진짜 시작입니다.

{{managerPhone}} - 대기 중입니다.`,

  day1: `좋은 소식입니다, {{name}}님! ✅

{{destination}} 여행이 공식적으로 예약되었습니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 당신의 예약 정보

예약번호: {{bookingRef}}
여행지: {{destination}}
여행기간: {{daysUntilDeparture}}일
할인율: 평생 30%
매니저: {{managerName}}
연락처: {{managerPhone}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

당신의 {{destination}}은 이제 현실입니다.

다음 단계는:

✅ 1단계 (지금): 여권 확인 → 신청 기한 {{daysUntilDeparture}}일 남음
✅ 2단계 (1주): 비자 신청 → 대행 가능
✅ 3단계 (2주): 항공편 선택 → 할인 항공권 제공
✅ 4단계 (3주): 짐 준비 → 체크리스트 제공
✅ 5단계 (4주): 최종 확인 → 매니저 동반 출발

모든 단계마다 {{managerName}} 매니저가 연락합니다.
"다음은 이걸 하세요"라고요.

당신의 {{destination}}은 지금부터 98% 완성입니다.

남은 2%는 출발하는 순간에 완성됩니다.

당신은 최고의 선택을 했습니다.`,

  day2: `준비가 시작되었습니다, {{name}}님! 🚀

당신의 {{destination}} 여행이 이제 구체적으로 움직이고 있습니다.

┌─────────────────────────────────────┐
│ ✓ 예약 확정                         │
│ ✓ 할인율 30% 적용                  │
│ ✓ 매니저 배정 완료                 │
│ ✓ 준비 계획 수립 완료               │
│                                    │
│ → 다음: 여권 신청 (D-{{daysUntilDeparture}})     │
└─────────────────────────────────────┘

당신처럼 신청한 사람들의 준비 현황:

🎯 Day 1 완료한 고객: 94%
   (예약 확정 후 24시간 내 여권 신청)

🎯 Day 7 완료한 고객: 89%
   (비자 신청 + 항공편 결정)

🎯 Day 30 완료한 고객: 92%
   (짐 준비 완료 + 최종 확인)

────────────────────────────

당신도 이 92%에 들 것입니다.

왜냐하면 {{managerName}} 매니저가 하나하나 챙기니까요.

지금 바로 할 일:

1. 여권 확인 (유효기간 {{daysUntilDeparture}}일 이상 필요)
2. {{managerName}} 매니저에게 가족 명단 전송
3. 예약 확정 이메일 저장

이 3가지만 하면 오늘의 준비는 끝입니다.

내일부터는 매니저가 비자와 항공편을 챙깁니다.

당신의 {{destination}}은 순조롭게 진행 중입니다.

정말 축하합니다. 🎊`,

  day3: `정말 축하합니다! 🌍 {{name}}님

당신의 {{destination}} 여행은 이제 '현실'입니다.

이것은 단순 예약이 아닙니다.
당신의 인생에 새로운 챕터가 시작되는 것입니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
당신의 {{destination}}

출발일: D-{{daysUntilDeparture}}
기간: {{daysUntilDeparture}}일
동반자: {{managerName}} 매니저 + 베테랑 가이드 2명
약속: 평생 30% 할인 + 전액 환불 보증

이것은 당신이 선택한 '최고의 선택'입니다.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

지금부터 당신이 준비하는 모든 순간은
'{{destination}}을 향한 여정'입니다.

여권을 신청할 때: "이건 {{destination}}을 위한 것"
항공편을 선택할 때: "이건 {{destination}}을 향하는 길"
짐을 준비할 때: "이건 {{destination}}에서의 나"

모든 순간이 기대감으로 가득 찰 것입니다.

────────────────────────────

당신을 위한 마지막 약속:

✅ {{managerName}} 매니저는 D-day까지 항상 당신과 함께합니다
✅ 모든 준비는 우리가 맡습니다 (당신은 기다리기만 하면 됨)
✅ {{destination}} 도중 언제든 연락 가능 (24/7)
✅ 귀국 후 사진 정리까지 지원 (평생 추억 보관)

당신의 {{destination}} 여행, 이제 시작입니다.

정말 기대됩니다.

{{managerName}} 매니저 일동`,
};

export const L10_EMAIL_SUBJECTS: EmailSubjects = {
  day0: "🎉 {{name}}님 축하합니다! {{destination}} 예약 완료",
  day1: "[확정] {{destination}} 예약번호 {{bookingRef}} 발급",
  day2: "준비 시작! {{destination}} D-{{daysUntilDeparture}} 첫 단계",
  day3: "[축하] {{name}}님의 {{destination}} 여행, 이제 현실입니다! 🌍",
};

/**
 * 렌즈별 템플릿 + 제목 통합 맵
 */
export const LENS_EMAIL_TEMPLATES_V2: Record<string, EmailSequence> = {
  L0: L0_EMAIL_TEMPLATES,
  L1: L1_EMAIL_TEMPLATES,
  L2: L2_EMAIL_TEMPLATES,
  L6: L6_EMAIL_TEMPLATES,
  L10: L10_EMAIL_TEMPLATES,
};

export const LENS_EMAIL_SUBJECTS_V2: Record<string, EmailSubjects> = {
  L0: L0_EMAIL_SUBJECTS,
  L1: L1_EMAIL_SUBJECTS,
  L2: L2_EMAIL_SUBJECTS,
  L6: L6_EMAIL_SUBJECTS,
  L10: L10_EMAIL_SUBJECTS,
};

/**
 * 렌즈별로 최적 Day 0-3 이메일 템플릿 선택
 *
 * @param lens 심리학 렌즈 (L0~L10)
 * @returns EmailSequence (day0, day1, day2, day3)
 */
export function selectFunnelEmailTemplate(lens: string = "L0"): EmailSequence {
  return LENS_EMAIL_TEMPLATES_V2[lens] || L0_EMAIL_TEMPLATES;
}

/**
 * Day별 단일 이메일 템플릿 추출
 *
 * @param lens 심리학 렌즈
 * @param day 회차 (0, 1, 2, 3)
 * @returns 해당 day의 이메일 본문 문자열
 */
export function getFunnelEmailTemplateByDay(lens: string, day: 0 | 1 | 2 | 3): string {
  const sequence = selectFunnelEmailTemplate(lens);
  const dayKey = `day${day}` as keyof EmailSequence;
  return sequence[dayKey] || "";
}

/**
 * 이메일 제목 선택
 *
 * @param lens 심리학 렌즈
 * @param day 회차 (0, 1, 2, 3)
 * @returns 제목 템플릿
 */
export function getEmailSubjectByDay(lens: string, day: 0 | 1 | 2 | 3): string {
  const subjects = LENS_EMAIL_SUBJECTS_V2[lens] || L0_EMAIL_SUBJECTS;
  const dayKey = `day${day}` as keyof EmailSubjects;
  return subjects[dayKey] || "";
}

/**
 * 이메일 템플릿에 동적 변수 렌더링
 * {{variable}} 형식을 지원하며, 누락된 변수는 그대로 유지
 *
 * @param template 원본 템플릿
 * @param variables 치환할 변수 맵
 * @returns 렌더링된 템플릿
 */
export function renderEmailTemplate(
  template: string,
  variables: Record<string, string | number>
): string {
  let result = template;
  const varPattern = /\{\{(\w+)\}\}/g;

  for (const [key, value] of Object.entries(variables)) {
    if (value !== undefined && value !== null) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value));
    }
  }

  return result;
}

/**
 * SMS와 Email 일괄 선택 (멀티채널)
 *
 * @param lens 심리학 렌즈
 * @returns { sms: SmsSequence, email: EmailSequence }
 */
export function selectFunnelSequences(
  lens: string
): {
  sms: SmsSequence;
  email: EmailSequence;
} {
  // Import SMS templates dynamically to avoid circular dependency
  const { selectFunnelSmsTemplate } = require("@/lib/funnel-sms-templates");

  return {
    sms: selectFunnelSmsTemplate(lens),
    email: selectFunnelEmailTemplate(lens),
  };
}

/**
 * 이메일 발송 준비 (변수 + 렌더링 + 메타데이터)
 *
 * @param templateBody 원본 템플릿
 * @param templateSubject 원본 제목 템플릿
 * @param variables 고객 변수
 * @returns { subject, body, charCount }
 */
export interface PreparedEmail {
  subject: string;
  body: string;
  charCount: number;
  day: 0 | 1 | 2 | 3;
  lens: string;
}

export function prepareEmailForSending(
  templateBody: string,
  templateSubject: string,
  variables: Record<string, string | number>,
  day: 0 | 1 | 2 | 3,
  lens: string
): PreparedEmail {
  const body = renderEmailTemplate(templateBody, variables);
  const subject = renderEmailTemplate(templateSubject, variables);

  return {
    subject,
    body,
    charCount: body.length,
    day,
    lens,
  };
}
