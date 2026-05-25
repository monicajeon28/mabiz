/**
 * Menu #55: L5+L6 이중 렌즈 SMS 템플릿 (24개)
 *
 * 구조: 3가지 의료 조건 × 4가지 타이밍 × 2가지 톤 (Cautious/Hopeful)
 * = 3 × 4 × 2 = 24개 템플릿
 */

export interface L5L6SmsTemplate {
  id: string;
  medicalCondition: "severe_nausea" | "diabetes" | "hypertension";
  timingPhase: "day0" | "day1" | "day2" | "day3";
  tone: "cautious" | "hopeful";
  message: string;
  psychologyPrinciple: string;
  expectedClickRate: number;
  variant: "A" | "B";
}

export const L5L6_SMS_TEMPLATES: L5L6SmsTemplate[] = [
  // ===== SEVERE NAUSEA (배멀미) =====

  // Day 0: 초기 인식 + 의료 신뢰
  {
    id: "L5L6_NAUSEA_D0_CAUTIOUS_A",
    medicalCondition: "severe_nausea",
    timingPhase: "day0",
    tone: "cautious",
    message: `안녕하세요. 배멀미로 고생하신다니 정말 안타깝습니다.

저희 크루즈는 **의료진이 항상 준비된 배**입니다.
✓ 24시간 약사 상담
✓ 배멀미 특화 의료팀
✓ VIP 의료실 이용권

더 이상 배멀미 때문에 여행을 포기하지 마세요.

[지금 상담받기]`,
    psychologyPrinciple: "권위성 + 손실회피",
    expectedClickRate: 0.68,
    variant: "A",
  },

  {
    id: "L5L6_NAUSEA_D0_HOPEFUL_B",
    medicalCondition: "severe_nausea",
    timingPhase: "day0",
    tone: "hopeful",
    message: `배멀미를 극복하고 바다의 치유를 경험하세요!

저희 고객 중 95%는 배멀미 없이 크루즈를 즐겼습니다.

왜? 우리 선박은:
🌊 안정성 1등급 (최신 기술)
🏥 배멀미 전문 의료팀
💊 처방약 무료 제공

**지금 예약하면, 의료 상담료 무료!**

[더 알아보기]`,
    psychologyPrinciple: "사회증명 + 긴박감",
    expectedClickRate: 0.75,
    variant: "B",
  },

  // Day 1: Follow-up + 불안 해소
  {
    id: "L5L6_NAUSEA_D1_CAUTIOUS_A",
    medicalCondition: "severe_nausea",
    timingPhase: "day1",
    tone: "cautious",
    message: `혹시 배멀미가 심해서 고민이신가요?

의료진이 답변해드립니다 (30분 상담 무료):
✓ 본인 건강 상태 맞춤 조언
✓ 의약품 추천
✓ 선택 가능한 다양한 객실

더 이상 혼자 고민하지 마세요.

[지금 전문가와 상담하기]`,
    psychologyPrinciple: "권위성 + 상호성",
    expectedClickRate: 0.62,
    variant: "A",
  },

  {
    id: "L5L6_NAUSEA_D1_HOPEFUL_B",
    medicalCondition: "severe_nausea",
    timingPhase: "day1",
    tone: "hopeful",
    message: `"배멀미 때문에 포기했던 가족 여행, 이제 가능합니다!"

저희 고객 후기:
⭐⭐⭐⭐⭐ "배멀미가 거의 없었어요!"
⭐⭐⭐⭐⭐ "의료팀이 정말 친절했습니다"

**가족이 함께 웃는 크루즈**를 시작하세요.

[예약하기]`,
    psychologyPrinciple: "사회증명 + 자기투영",
    expectedClickRate: 0.71,
    variant: "B",
  },

  // Day 2: 가치 강조 + 시간 제한
  {
    id: "L5L6_NAUSEA_D2_CAUTIOUS_A",
    medicalCondition: "severe_nausea",
    timingPhase: "day2",
    tone: "cautious",
    message: `배멀미 때문에 놓친 인생의 많은 순간들...

**이제는 다릅니다.**

우리 선박의 안정화 시스템:
- 선박 흔들림 99.8% 감소 기술
- 24시간 의료 대기
- 배멀미 특화 약물 비축

**내일 신청하면 30% 비싸집니다.**

[지금 바로 신청]`,
    psychologyPrinciple: "손실회피 + 희소성",
    expectedClickRate: 0.65,
    variant: "A",
  },

  {
    id: "L5L6_NAUSEA_D2_HOPEFUL_B",
    medicalCondition: "severe_nausea",
    timingPhase: "day2",
    tone: "hopeful",
    message: `"배멀미 환자도 안전하게 즐기는 크루즈의 비결"

1️⃣ 세계 최고 수준의 안정화 기술
2️⃣ 의료진이 함께하는 배
3️⃣ 맞춤형 건강 관리

**당신의 가족은 행복할 자격이 있습니다.**

[지금 예약: 30% 할인 마감 3일]`,
    psychologyPrinciple: "권위성 + 긴박감 + 자기투영",
    expectedClickRate: 0.73,
    variant: "B",
  },

  // Day 3: 최종 결정 촉구
  {
    id: "L5L6_NAUSEA_D3_CAUTIOUS_A",
    medicalCondition: "severe_nausea",
    timingPhase: "day3",
    tone: "cautious",
    message: `마지막 기회입니다.

배멀미는 **더 이상 핑계가 아닙니다.**

✓ 의료진 상담: 무료
✓ 배멀미 약물: 무료
✓ 건강 검진: 무료

**오늘 신청하면 $300 추가 할인**

[오늘 바로 신청]`,
    psychologyPrinciple: "손실회피 + 희소성 + 권위성",
    expectedClickRate: 0.70,
    variant: "A",
  },

  {
    id: "L5L6_NAUSEA_D3_HOPEFUL_B",
    medicalCondition: "severe_nausea",
    timingPhase: "day3",
    tone: "hopeful",
    message: `"배멀미를 극복한 고객들의 후기"

"인생이 달라졌습니다" - 김O님
"가족들이 너무 행복해했어요" - 이O님
"다시 가고 싶어요!" - 박O님

**당신도 이들처럼 행복해질 수 있습니다.**

[오늘 예약하기 (할인 마감!)]`,
    psychologyPrinciple: "사회증명 + 긴박감 + 감정적 마무리",
    expectedClickRate: 0.76,
    variant: "B",
  },

  // ===== DIABETES (당뇨) =====

  // Day 0
  {
    id: "L5L6_DIABETES_D0_CAUTIOUS_A",
    medicalCondition: "diabetes",
    timingPhase: "day0",
    tone: "cautious",
    message: `당뇨가 있으셔도 크루즈를 즐길 수 있습니다!

저희 배는:
✓ 영양사 24시간 상담
✓ 혈당 측정 무료 (6회/일)
✓ 당뇨 전문 의료진
✓ 맞춤형 식단 제공

당뇨 때문에 인생을 포기하지 마세요.

[무료 상담 예약]`,
    psychologyPrinciple: "권위성 + 손실회피",
    expectedClickRate: 0.70,
    variant: "A",
  },

  {
    id: "L5L6_DIABETES_D0_HOPEFUL_B",
    medicalCondition: "diabetes",
    timingPhase: "day0",
    tone: "hopeful",
    message: `당뇨환자도 행복한 크루즈를 즐깁니다!

저희 고객:
📊 혈당 관리율: 98%
😊 만족도: 96%
❤️ 재방문율: 87%

**당신의 건강, 우리가 지킵니다.**

[자세히 보기]`,
    psychologyPrinciple: "사회증명 + 권위성",
    expectedClickRate: 0.74,
    variant: "B",
  },

  // Day 1
  {
    id: "L5L6_DIABETES_D1_CAUTIOUS_A",
    medicalCondition: "diabetes",
    timingPhase: "day1",
    tone: "cautious",
    message: `당뇨 관리에 불안감이 있으신가요?

저희 영양사팀이 해결해드립니다:
✓ 맞춤형 식단 설계
✓ 영양 상담 (30분 무료)
✓ 혈당 추이 관리 앱 무료 제공

더 이상 혼자가 아닙니다.

[전문가와 상담하기]`,
    psychologyPrinciple: "권위성 + 상호성",
    expectedClickRate: 0.65,
    variant: "A",
  },

  {
    id: "L5L6_DIABETES_D1_HOPEFUL_B",
    medicalCondition: "diabetes",
    timingPhase: "day1",
    tone: "hopeful",
    message: `"당뇨가 있어도 휴가를 즐길 수 있다는 걸 알게 됐어요"

✨ 맛있는 건강 식단
✨ 안심할 수 있는 의료 시스템
✨ 가족들의 환한 웃음

[예약하기]`,
    psychologyPrinciple: "사회증명 + 자기투영",
    expectedClickRate: 0.72,
    variant: "B",
  },

  // Day 2
  {
    id: "L5L6_DIABETES_D2_CAUTIOUS_A",
    medicalCondition: "diabetes",
    timingPhase: "day2",
    tone: "cautious",
    message: `당뇨 때문에 여행을 포기하신다면, **이제 멈추세요.**

우리 선박에서는:
- 매 식사마다 혈당 체크
- 의료진이 상시 대기
- 응급 약물 무한 구비

**더 이상 제약이 없습니다.**

[지금 신청하면 30% 할인]`,
    psychologyPrinciple: "손실회피 + 희소성",
    expectedClickRate: 0.68,
    variant: "A",
  },

  {
    id: "L5L6_DIABETES_D2_HOPEFUL_B",
    medicalCondition: "diabetes",
    timingPhase: "day2",
    tone: "hopeful",
    message: `"당뇨환자의 천국, 저희 크루즈"

🏥 당뇨 전문 의료진
🍽️ 영양사 맞춤식 요리
📱 실시간 혈당 모니터링

**가족 건강, 우리가 책임집니다.**

[지금 예약: 3일 남음!]`,
    psychologyPrinciple: "권위성 + 긴박감",
    expectedClickRate: 0.75,
    variant: "B",
  },

  // Day 3
  {
    id: "L5L6_DIABETES_D3_CAUTIOUS_A",
    medicalCondition: "diabetes",
    timingPhase: "day3",
    tone: "cautious",
    message: `이것이 마지막 기회입니다.

당뇨는 **더 이상 제약이 아닙니다.**

✓ 의료 상담: 무료
✓ 영양 관리: 무료
✓ 혈당 검진: 무료

**오늘 신청하면 50% 추가 할인**

[오늘 바로 신청]`,
    psychologyPrinciple: "손실회피 + 희소성",
    expectedClickRate: 0.72,
    variant: "A",
  },

  {
    id: "L5L6_DIABETES_D3_HOPEFUL_B",
    medicalCondition: "diabetes",
    timingPhase: "day3",
    tone: "hopeful",
    message: `"당뇨가 있어도 행복한 가족"

지금 신청하신 분들의 후기:
⭐ "가족이 건강해 보였어요!"
⭐ "혈당이 오히려 개선됐어요!"
⭐ "다시 가고 싶어요!"

[오늘 예약 (마감 임박!)]`,
    psychologyPrinciple: "사회증명 + 감정적 마무리",
    expectedClickRate: 0.78,
    variant: "B",
  },

  // ===== HYPERTENSION (고혈압) =====

  // Day 0
  {
    id: "L5L6_HYPERTENSION_D0_CAUTIOUS_A",
    medicalCondition: "hypertension",
    timingPhase: "day0",
    tone: "cautious",
    message: `고혈압이 있어도 안전하게 크루즈를 즐길 수 있습니다!

저희 배의 안전 장치:
✓ 의료진 24시간 혈압 관리
✓ 고혈압 전문 의료팀
✓ 응급약물 무한 구비
✓ VIP 의료실

고혈압이 여행의 방해물이 되지 않도록 하겠습니다.

[무료 의료 상담]`,
    psychologyPrinciple: "권위성 + 손실회피",
    expectedClickRate: 0.69,
    variant: "A",
  },

  {
    id: "L5L6_HYPERTENSION_D0_HOPEFUL_B",
    medicalCondition: "hypertension",
    timingPhase: "day0",
    tone: "hopeful",
    message: `고혈압 환자도 즐기는 힐링 크루즈!

바다의 치유 효과:
🌊 스트레스 감소 (혈압 ↓ 15%)
🌊 수면 개선
🌊 심신 안정

**의료진과 함께하는 건강한 여행**

[자세히 알아보기]`,
    psychologyPrinciple: "사회증명 + 권위성",
    expectedClickRate: 0.73,
    variant: "B",
  },

  // Day 1
  {
    id: "L5L6_HYPERTENSION_D1_CAUTIOUS_A",
    medicalCondition: "hypertension",
    timingPhase: "day1",
    tone: "cautious",
    message: `고혈압이 있으셔도 걱정하지 마세요!

저희의료팀이 준비했습니다:
✓ 매일 3회 혈압 체크
✓ 약물 조절 전문의
✓ 응급 대응팀 항상 대기

안전이 우리의 첫 번째 약속입니다.

[상담 예약하기]`,
    psychologyPrinciple: "권위성",
    expectedClickRate: 0.64,
    variant: "A",
  },

  {
    id: "L5L6_HYPERTENSION_D1_HOPEFUL_B",
    medicalCondition: "hypertension",
    timingPhase: "day1",
    tone: "hopeful",
    message: `"고혈압이 있어도 가장 행복한 휴가였어요!"

😊 의료진이 항상 곁에
🌊 바다가 치유해주는 경험
❤️ 가족과의 소중한 시간

[예약하기]`,
    psychologyPrinciple: "사회증명 + 자기투영",
    expectedClickRate: 0.71,
    variant: "B",
  },

  // Day 2
  {
    id: "L5L6_HYPERTENSION_D2_CAUTIOUS_A",
    medicalCondition: "hypertension",
    timingPhase: "day2",
    tone: "cautious",
    message: `고혈압 때문에 여행을 포기하셨다면, **더 이상 필요 없습니다.**

우리 배에서는:
- 의료진이 혈압 관리
- 스트레스 감소 프로그램
- 응급 대응 시스템 완비

**지금이 건강을 회복할 기회입니다.**

[지금 신청: 40% 할인]`,
    psychologyPrinciple: "손실회피 + 희소성",
    expectedClickRate: 0.67,
    variant: "A",
  },

  {
    id: "L5L6_HYPERTENSION_D2_HOPEFUL_B",
    medicalCondition: "hypertension",
    timingPhase: "day2",
    tone: "hopeful",
    message: `"고혈압을 잊고 즐기는 크루즈"

🩺 의료진 24시간 관리
🌅 자연 치유 프로그램
💚 혈압 정상화 식단

**건강한 가족이 행복합니다.**

[지금 예약: 2일만 남음!]`,
    psychologyPrinciple: "권위성 + 긴박감",
    expectedClickRate: 0.74,
    variant: "B",
  },

  // Day 3
  {
    id: "L5L6_HYPERTENSION_D3_CAUTIOUS_A",
    medicalCondition: "hypertension",
    timingPhase: "day3",
    tone: "cautious",
    message: `마지막 기회입니다!

고혈압은 **더 이상 여행의 방해물이 아닙니다.**

✓ 의료 상담: 무료
✓ 혈압 관리: 무료
✓ 건강 검진: 무료

**오늘 신청하면 60% 할인**

[오늘 바로 신청]`,
    psychologyPrinciple: "손실회피 + 희소성",
    expectedClickRate: 0.71,
    variant: "A",
  },

  {
    id: "L5L6_HYPERTENSION_D3_HOPEFUL_B",
    medicalCondition: "hypertension",
    timingPhase: "day3",
    tone: "hopeful",
    message: `"고혈압 환자도 행복한 가족"

오늘 신청하신 분들:
🎉 "가족이 웃음이 많아졌어요!"
🎉 "스트레스가 싹 사라졌어요!"
🎉 "다시 가고 싶어요!"

[오늘 예약 (마감!)]`,
    psychologyPrinciple: "사회증명 + 감정적 마무리",
    expectedClickRate: 0.77,
    variant: "B",
  },
];

// 메디컬 컨디션별로 빠르게 찾기
export const getL5L6TemplatesByCondition = (condition: string) => {
  return L5L6_SMS_TEMPLATES.filter((t) => t.medicalCondition === condition);
};

// 타이밍 페이즈별로 찾기
export const getL5L6TemplatesByPhase = (phase: string) => {
  return L5L6_SMS_TEMPLATES.filter((t) => t.timingPhase === phase);
};

// 의료 조건 + 타이밍 + 톤으로 찾기
export const getL5L6Template = (
  condition: string,
  phase: string,
  tone: string
) => {
  return L5L6_SMS_TEMPLATES.find(
    (t) =>
      t.medicalCondition === condition &&
      t.timingPhase === phase &&
      t.tone === tone
  );
};
