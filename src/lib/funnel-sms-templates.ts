/**
 * Day 0-3 SMS 템플릿 (v2 재정의)
 *
 * PASONA 프레임워크 매핑:
 *   - Day 0: P(Problem) + A(Agitate) → 초기 액션 (문제 인식)
 *   - Day 1: S(Solution) → Follow-up (해결책 제시)
 *   - Day 2: O(Offer) + N(Narrow) → 가치 강조 (한정 제안)
 *   - Day 3: A(Action) → 긴박감 + 최종 클로징 (결정 촉구)
 *
 * 동적 변수 지원:
 *   {{name}}, {{destination}}, {{price}}, {{discount}}, {{managerName}}, {{managerPhone}}, {{days}}, {{remainingSeats}}
 *   - 렌즈별 기본 템플릿에 포함
 *   - Contact/Product 정보로 자동 치환
 *   - renderSmsTemplate() 호출로 변수 렌더링
 *
 * 사용 예시:
 *   const template = SMS_BASE_TEMPLATES.day0;
 *   const contactVars = getContactVariables(contact);
 *   const productVars = getProductVariables(product);
 *   const message = renderSmsTemplate(template, mergeVariables(contactVars, productVars));
 */

import { SmsSequence } from "@/lib/landing-sms-templates";

/**
 * 기본 Day 0-3 템플릿 (렌즈 비적용, 통용)
 *
 * 동적 변수:
 *   {{name}} = 고객 이름 (기본값: "고객님")
 *   {{destination}} = 여행지 (기본값: "선택 여행지")
 *   {{price}} = 가격 (기본값: "정상가")
 *   {{managerPhone}} = 매니저 번호 (기본값: "1800-CRUISE")
 */
export const SMS_BASE_TEMPLATES = {
  day0: `안녕하세요 {{name}}님! 🙌 크루즈닷입니다.
오늘 {{destination}} 문의해주셨네요! 감사합니다.

베테랑 인솔자와 함께하는 안전한 크루즈 여행을 준비해드릴게요.

📱 매니저가 2시간 내 연락 드릴 예정입니다.
문의사항: {{managerPhone}} (카톡 상담도 가능)`,

  day1: `{{name}}님, 어제는 신청 감사합니다! 😊

**3가지 인기 상품 소개:**
✅ {{destination}} ({{price}}) - 가성비 최고
✅ 프리미엄 패키지 - 베테랑 동반
✅ 가족 여행 - 특별 할인 중

👉 [상품 보러가기]`,

  day2: `좋은 소식! 💚 {{name}}님
**실제 고객들의 반응:**
- 만족도 78점
- 재구매율 92%
- {{destination}} 다녀온 분들 강력 추천

👉 [고객후기 보기]`,

  day3: `마지막 기회! 🔥 {{name}}님
**{{remainingSeats}}석 남았습니다!**
지금 {{destination}}에 신청하면
평생 30% 할인 받으시고,
매니저가 바로 여행 계획을 도와드릴게요.

👉 [신청 완료하기]`,
};

/**
 * 렌즈별 Day 0-3 템플릿
 *
 * 각 렌즈별로 심리학 프레임워크 적용:
 * - L0: 신뢰 구축 (기본)
 * - L1: 가격 민감 (할부, 할인 강조)
 * - L2: 준비 불안 (가이드, 안심 강조)
 * - L6: 타이밍/긴박감 (희소성, 시간 강조)
 * - L10: 클로징/즉시 (축하, 다음 단계 강조)
 */

export const L0_SMS_TEMPLATES: SmsSequence = {
  day0: `안녕하세요! 🙌 {{name}}님, 크루즈닷입니다.
오늘 {{destination}} 신청해주셨네요! 감사합니다.
베테랑 인솔자와 함께하는 안전한 크루즈 여행을 준비해드릴게요.

📱 매니저가 2시간 내 연락 드릴 예정입니다.
문의사항: {{managerPhone}} (카톡 상담도 가능)`,

  day1: `{{name}}님, 어제는 신청 감사합니다. 😊
**3가지 상품 소개:**
✅ {{destination}} (월 {{price}}) - 국내 최저가
✅ 일본 크루즈 (월 53K) - 베테랑 동반
✅ 동남아 (월 44K) - 프리미엄 경험

👉 [상품 보러가기]`,

  day2: `좋은 소식! 💚 {{name}}님
**실제 고객들의 반응:**
- 만족도 78점
- 재구매율 92%
- 다녀온 사람들 강력 추천

👉 [고객후기 보기]`,

  day3: `마지막 기회! 🔥 {{name}}님
**10석 남았습니다!**
지금 신청하면 평생 30% 할인 받으시고,
매니저가 바로 여행 계획을 도와드릴게요.

👉 [신청 완료하기]`,
};

export const L1_SMS_TEMPLATES: SmsSequence = {
  day0: `안녕하세요! {{name}}님, 크루즈닷입니다. 😊
저예산 {{destination}} 문의 감사합니다!
**월 {{price}}부터 시작 가능합니다.**

✅ 할부 수수료 0원
✅ 은행 계좌 투명 관리
✅ 여행 취소 시 100% 환급

📞 매니저가 비용 절감 방법을 상담해드립니다.`,

  day1: `{{name}}님, 어제는 저희 메시지 봐주셨네요! 📊
**크루즈닷의 가격 우위:**
- {{destination}}: {{price}} (타 업체: 185만원)
- 환불 100% 보장 (타 업체: 불가)
- 할부 금리 0% (신은행 신규금융)

👉 [비용 비교표 확인]`,

  day2: `좋은 소식! 💰 {{name}}님
**할부 가능 상품:**
- {{destination}} {{price}} × 12개월
- 프리미엄 66K × 12개월 = 79만원

신은행 신규금융이라 **금리 0%**입니다!`,

  day3: `🎁 오늘 신청하시는 {{name}}님께:
**평생 30% 할인** + **초기 2개월 할인**
합산 약 **40% 할인** 적용!

예) {{price}} → **월 20K**로 시작 가능 💚
👉 [지금 신청하기]`,
};

export const L2_SMS_TEMPLATES: SmsSequence = {
  day0: `안녕하세요! {{name}}님, 크루즈닷입니다. 🙌
{{destination}}, 준비가 걱정되시네요?
**안심하세요! 우리가 처음부터 끝까지 함께합니다.**

✅ 여권 발급 안내
✅ 비자 신청 대행
✅ 짐 준비 체크리스트

📱 매니저가 상세 가이드를 보내드립니다.`,

  day1: `{{name}}님, 준비 걱정 끝!
**크루즈닷 {{destination}} 준비 5단계:**
1️⃣ 여권/비자 (매니저가 안내)
2️⃣ 건강검진 (무료)
3️⃣ 짐 준비 (체크리스트)
4️⃣ 항공 예약 (할인권 제공)
5️⃣ 탑승 (매니저 동반)`,

  day2: `특별 혜택! 💝 {{name}}님
신청하신 분들 위해 준비했어요:
✅ {{destination}} 크루즈 가이드 PDF
✅ 항공편 팁 영상
✅ 짐 준비 체크리스트 (출력 가능)

👉 [무료 자료 다운로드]`,

  day3: `마지막 격려! 💪 {{name}}님
**혼자 준비 안 하셔도 됩니다.**
베테랑 매니저가 출발부터 귀국까지
**24/7 함께하니까요!**

👉 [지금 신청하고 안심하세요]`,
};

export const L6_SMS_TEMPLATES: SmsSequence = {
  day0: `🚨 긴급 공지! {{name}}님
**{{remainingSeats}}석 남았습니다!**
{{destination}} 시간이 정말 빠르게 돌아가고 있어요.

✅ 지금 신청 = 평생 30% 할인 확정
✅ 내일 신청 = 15% 할인으로 내려감
✅ 2일 후 = 할인 종료

지금이 맞는 시간입니다! ⏰`,

  day1: `⏰ {{name}}님, 어제보다 6석 줄었어요!
**현재 {{remainingSeats}}석만 남았습니다.**

{{destination}} 이 기회를 놓치면 다음은 3개월 뒤입니다.
시간이 정말 빨라요...

👉 [지금 신청하기]`,

  day2: `🔥 이건 정말 마지막입니다! {{name}}님
**{{remainingSeats}}석 남았어요!**

신청한 142명 중 당신도 포함되길 원해요.
하지만 기다리면... 떨어질 수도 있어요.

👉 [지금 신청 (마지막 기회)]`,

  day3: `아쉽습니다... 😔 {{name}}님
{{destination}} 석수가 모두 마감되었어요.

하지만 우리 매니저에게 연락 주시면
**예비 대기자 등록** 가능합니다.
다음 달 좋은 상품 우선 안내해드릴게요.

📞 {{managerPhone}}`,
};

export const L10_SMS_TEMPLATES: SmsSequence = {
  day0: `축하합니다! 🎉 {{name}}님
{{destination}} 신청 완료되셨습니다!

당신은 **142명 중 100위** 안에 들었어요.
평생 30% 할인 혜택도 자동 적용!

매니저가 2시간 내 최종 확정 연락을 드릴 예정입니다. ✨`,

  day1: `좋은 소식! 💚 {{name}}님
**{{destination}} 예약 확정되셨습니다!**

여행 기간: {{days}}일
할인율: 평생 30%
첫 결제: {{price}}

매니저: {{managerName}}
📞 {{managerPhone}}`,

  day2: `다음 단계! 📋 {{name}}님
**{{destination}} 여행 준비 가이드:**
✅ 여권 확인 (신청 기한)
✅ 비자 준비 (대행 가능)
✅ 건강검진 예약 (무료)
✅ 항공편 선택

매니저가 모든 걸 안내해드립니다.`,

  day3: `🎊 정말 축하합니다! {{name}}님
당신의 {{destination}} 크루즈 여행이 현실이 되었어요.

**앞으로 {{days}}일간의 준비 과정도**
**베테랑 매니저와 함께 합니다.**

📱 카톡으로 언제든 연락주세요!
이제 정말 시작이에요! 🚀`,
};

/**
 * 렌즈별 템플릿 통합 맵
 */
export const LENS_SMS_TEMPLATES_V2: Record<string, SmsSequence> = {
  L0: L0_SMS_TEMPLATES,
  L1: L1_SMS_TEMPLATES,
  L2: L2_SMS_TEMPLATES,
  L6: L6_SMS_TEMPLATES,
  L10: L10_SMS_TEMPLATES,
};

/**
 * 렌즈 또는 포맷별로 최적 Day 0-3 템플릿 선택
 *
 * @param lens 심리학 렌즈 (L0~L10)
 * @returns SmsSequence (day0, day1, day2, day3)
 */
export function selectFunnelSmsTemplate(lens: string = "L0"): SmsSequence {
  return LENS_SMS_TEMPLATES_V2[lens] || L0_SMS_TEMPLATES;
}

/**
 * Day별 단일 템플릿 추출
 *
 * @param lens 심리학 렌즈
 * @param day 회차 (0, 1, 2, 3)
 * @returns 해당 day의 SMS 템플릿 문자열
 */
export function getFunnelSmsTemplateByDay(lens: string, day: 0 | 1 | 2 | 3): string {
  const sequence = selectFunnelSmsTemplate(lens);
  const dayKey = `day${day}` as keyof SmsSequence;
  return sequence[dayKey] || "";
}
