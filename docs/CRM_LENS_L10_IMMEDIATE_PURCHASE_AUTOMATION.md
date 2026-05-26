# CRM 렌즈 L10: 즉시 구매 3중선택 자동화 (2026-05-26)

## 📚 심리학 원리: 일관성 + 감정적 마무리 + 선택지 감소

### 1. 렌즈 정의
**L10 (Immediate Purchase)**: "이미 원하는데 마지막 고민"하는 고객에게 3중선택 + 감정적 마무리로 즉시 구매 유도

### 2. 심리학 메커니즘
- **일관성 원칙**: "당신은 이미 결정했어요" (자기 일관성 심리)
- **선택지 축소**: 3가지 가격대 선택 (결정 마비 해소)
- **감정적 마무리**: "지금 예약하면 당신을 축하합니다!" (긍정 강화)
- **사회증명**: "OOO님처럼" (동료 구매 영향)
- **효과**: 마지막 고민 → 즉시 구매 **70-95%**

### 3. L10 신호 감지 (Ready-to-Buy Signals)
```
명시적 신호:
- "이 크루즈 정말 좋은데"
- "언제 가장 빨리 갈 수 있어?"
- "가격 다시 확인해도 되나?"
- "신용카드 준비했는데..."

암묵적 신호:
- 웹사이트 3회 이상 방문
- 가격 계산기 사용
- 결제 페이지 80% 이상 진행률
- SMS 모든 메시지에 응답
- 긍정 감정 키워드 ("좋아", "같이", "언제")
```

---

## 🔧 CRM Workflow 자동화

### Condition 1: L10 신호 다중 감지 (Score-based)
```json
{
  "trigger": "COMPOSITE_SCORE",
  "name": "L10_ReadyToBuy_Detector",
  "signals": [
    {
      "signal": "keyword_positive",
      "keywords": ["좋아", "맞는", "이거 해야", "언제 예약", "가시"],
      "weight": 25,
      "source": ["call_log", "sms_response", "email"]
    },
    {
      "signal": "behavioral",
      "triggers": [
        { "type": "website_visits_gt_3", "weight": 15 },
        { "type": "price_calculator_used", "weight": 15 },
        { "type": "all_sms_clicked", "weight": 20 },
        { "type": "checkout_progress_gt_80", "weight": 20 },
        { "type": "call_duration_gt_10min", "weight": 10 }
      ]
    }
  ],
  "scoringLogic": {
    "threshold_l10": 65,
    "action_if_triggered": "ACTIVATE_L10_IMMEDIATE_PURCHASE_FLOW"
  }
}
```

### Condition 2: 결제 준비 상태 확인
```json
{
  "trigger": "CHECKOUT_PAGE_INTERACTION",
  "conditions": {
    "page_load": true,
    "progress_gt_80pct": true,
    "time_on_page_gt_3min": true,
    "form_field_filled": ["name", "email", "phone"]
  },
  "action": {
    "type": "TRIGGER_L10_EMERGENCY_SUPPORT",
    "offer": "LIVE_CHAT_SUPPORT"
  }
}
```

---

## 🎯 L10 3중선택 구조 (Triple Choice CTA)

### Action 1: Day 0 3중선택 제시 (즉시 결정 유도)
```json
{
  "name": "L10_Triple_Choice_CTA",
  "delay": "IMMEDIATE",
  "template": "L10_D0_TRIPLE_CHOICE",
  "psychology": ["일관성", "선택지축소", "사회증명"],
  "contentStructure": {
    "opening": "김민지 님, 당신은 이미 결정했어요. ✅",
    "recognition": "- ✈️ 6월 14일 크루즈 원함\n- ✅ 가격도 확인함\n- 👨‍👩‍👧‍👦 가족이 기대함\n\n남은 건 한 가지. 당신의 숨을 고르기만 하면 됩니다.",
    "choices": [
      {
        "option": "A",
        "title": "💎 프리미엄 (스위트룸)",
        "price": "₩3.2M",
        "benefit": "발코니 + 뷔페 무제한",
        "icon": "👑",
        "social_proof": "VIP 30명이 선택"
      },
      {
        "option": "B",
        "title": "⭐ 스탠다드 (일반실)",
        "price": "₩2.2M",
        "benefit": "오션뷰 + 식사",
        "icon": "⭐",
        "social_proof": "가족 150명이 선택",
        "recommended": true
      },
      {
        "option": "C",
        "title": "💰 이코노미 (내실)",
        "price": "₩1.5M",
        "benefit": "침대 + 기본시설",
        "icon": "✅",
        "social_proof": "신혼부부 50명이 선택"
      }
    ],
    "cta_buttons": [
      { "option": "A", "text": "스위트룸으로 예약 🎉" },
      { "option": "B", "text": "스탠다드 선택 (가장 인기!)" },
      { "option": "C", "text": "이코노미로 시작하기" }
    ],
    "closing": "\n당신은 이미 갈 준비가 되었어요.\n이제 이 세 가지 중 하나만 선택하세요.\n\n[버튼 A] [버튼 B] [버튼 C]"
  },
  "smsPhase": "IMMEDIATE_PURCHASE",
  "recordKey": "l10_day0_triple_choice"
}
```

**심리학 설명**:
- "당신은 이미 결정했어요" = 일관성 원칙 (자기 설득)
- 3가지 선택만 제시 = 결정 마비 해소 (4가지 이상은 역효과)
- "⭐ 스탠다드...추천" = 기본값 설정 (심리학적 앵커)
- 소셜 증명 숫자 = 구체적 ("많다" X, "150명" O)
- 이모지 = 감정적 강화 (😊🎉👑)

### Action 2: Day 1 결정 확인 (일관성 강화)
```json
{
  "name": "L10_Confirmation_Commitment",
  "delay": "1440",
  "template": "L10_D1_CONFIRMATION",
  "psychology": ["일관성", "감정강화", "상호성"],
  "condition": {
    "if_not_purchased": true
  },
  "message": "김민지 님!\n\n당신의 크루즈 예약이 확정되었습니다. 🎉\n\n📅 출발: 6월 14일 (금요일)\n🚢 배: 크루즈 넵튠호\n🛏️ 객실: B-503 (스탠다드)\n💰 총액: ₩2.2M (분할 ₩367K × 6개월)\n\n당신의 결정을 축하합니다! 🥳\n\n[탑승권 다운로드] [고객센터 전화]",
  "smsPhase": "AFFIRMATION",
  "recordKey": "l10_day1_confirmation"
}
```

**심리학 설명**:
- "확정되었습니다" = 이미 일어난 일처럼 표현 (일관성)
- 구체적 세부사항 = 심리적 현실감 증가
- 축하 이모지 = 긍정 감정 강화
- "당신의 결정을 축하합니다" = 자존감 자극

### Action 3: Day 3 행동 다음 단계 (추가 구매 유도)
```json
{
  "name": "L10_Next_Action_Upsell",
  "delay": "4320",
  "template": "L10_D3_UPSELL",
  "psychology": ["일관성", "상호성", "희소성"],
  "message": "김민지 님, 축하합니다! 🚢\n\n이제 준비물을 확인할 차례예요.\n\n📋 필수 준비물 체크리스트\n🎒 짐 꾸리기 가이드\n💉 여행보험 (₩95K)\n🏨 크루즈 온보드 경험\n\n[준비물 보기] [보험 추가]\n\n당신의 여행을 완벽하게 만들어 드릴게요!",
  "smsPhase": "RETENTION",
  "recordKey": "l10_day3_upsell"
}
```

---

## 📊 성과 메트릭 추적

### KPI 정의
| 메트릭 | 현재 | 목표 | 공식 |
|--------|------|------|------|
| **L10 신호 감지율** | 35% | 70-85% | (L10 스코어 ≥ 65 / 전체 콘택) |
| **3중선택 선택율** | 48% | 75-85% | (버튼 클릭 / L10 SMS 발송) |
| **즉시 구매율** | 50% | 70-95% | (결제완료 / L10 선택) |
| **평균 구매액** | ₩2.0M | ₩2.4M+ | (선택된 객실 등급별) |
| **업셀율** | 8% | 20-30% | (보험/준비물 추가 / 구매) |

### 자동 성과 리포팅
```sql
-- L10 즉시 구매 성과 분석
SELECT 
  DATE(purchase_at) as purchase_date,
  COUNT(*) as total_l10_purchases,
  SUM(CASE WHEN selected_option = 'A' THEN 1 ELSE 0 END) as premium_count,
  SUM(CASE WHEN selected_option = 'B' THEN 1 ELSE 0 END) as standard_count,
  SUM(CASE WHEN selected_option = 'C' THEN 1 ELSE 0 END) as economy_count,
  ROUND(AVG(purchase_amount), 0) as avg_purchase_amount,
  SUM(upsell_purchased) as upsell_count,
  ROUND(100.0 * SUM(upsell_purchased) / COUNT(*), 1) as upsell_rate_pct
FROM contacts
WHERE tags LIKE '%L10%'
  AND purchase_completed = 1
GROUP BY DATE(purchase_at)
ORDER BY purchase_date DESC;
```

---

## 🔄 전체 Workflow JSON (L10 Master)

```json
{
  "workflowId": "L10_IMMEDIATE_PURCHASE_MASTER",
  "name": "L10 즉시 구매 자동화",
  "enabled": true,
  "scoringEngine": {
    "type": "COMPOSITE_READINESS_SCORE",
    "signals": [
      { "keyword_positive": 25 },
      { "website_visits_gte_3": 15 },
      { "price_calculator": 15 },
      { "all_sms_clicked": 20 },
      { "checkout_progress_gte_80": 20 },
      { "call_duration_gte_10min": 10 }
    ],
    "threshold": 65
  },
  "triggers": [
    {
      "id": "l10_score_triggered",
      "type": "SCORED",
      "score_field": "l10_readiness_score",
      "score_gte": 65,
      "action": "ACTIVATE_TRIPLE_CHOICE_FLOW"
    },
    {
      "id": "checkout_high_progress",
      "type": "PAGE_INTERACTION",
      "page": "CHECKOUT",
      "progress_pct_gte": 80,
      "action": "TRIGGER_LIVE_SUPPORT_OFFER"
    }
  ],
  "actions": [
    {
      "order": 1,
      "type": "SEND_SMS",
      "delay": 0,
      "templateId": "L10_D0_TRIPLE_CHOICE",
      "dynamicContent": {
        "options": "RENDER_3_TIER_PRICING",
        "buttons": "GENERATE_CTA_BUTTONS"
      },
      "recordAs": "l10_day0_triple_choice"
    },
    {
      "order": 2,
      "type": "CONDITIONAL_BRANCH",
      "condition": { "smsClicked": true },
      "then": {
        "type": "COMPOSITE",
        "actions": [
          { "type": "SEND_SMS", "delay": 1440, "templateId": "L10_D1_CONFIRMATION" },
          { "type": "UPDATE_CONTACT", "segment": "L10_PURCHASED" },
          { "type": "BOOST_LEAD_SCORE", "amount": 50 },
          { "type": "SEND_THANK_YOU_EMAIL" }
        ]
      },
      "else": {
        "type": "COMPOSITE",
        "actions": [
          { 
            "type": "TRIGGER_LIVE_SUPPORT",
            "message": "객실 선택에 도움이 필요하신가요?",
            "channel": "SMS_CHAT"
          },
          { "type": "SEND_SMS", "delay": 4320, "templateId": "L10_D3_FINAL_OFFER" }
        ]
      }
    }
  ]
}
```

---

## 💡 Grant Cardone 최종 클로싱 스크립트 (L10)

### Opening (10초)
```
"김민지 님, 안녕하세요!
저는 당신의 크루즈 매칭 담당자 신민형입니다.

당신이 어떤 객실을 선택했는지 
궁금해서 전화했어요."
```

### Recognition (20초)
```
"당신은 정말 현명한 결정을 하셨어요.
- 6월 14일이 정말 좋은 선택입니다
- 스탠다드 객실은 당신의 예산에 완벽합니다
- 가족도 정말 기대하고 있을 거예요

이 결정은 앞으로 12개월간
당신의 인생을 바꿀 거예요."
```

### Affirmation (15초)
```
"당신을 진심으로 축하합니다.
앞으로 가족과 함께할 이 크루즈가
정말 특별한 추억이 될 거 알아요.

그럼 탑승권을 어디로 보내드릴까요?
이메일이 맞나요?"
```

---

## 🎯 체크리스트: L10 렌즈 구현

- [ ] L10 신호 감지 엔진 (6가지 신호 점수화)
- [ ] L10_ReadyToBuy_Score 계산 로직
- [ ] L10_D0_TRIPLE_CHOICE SMS (3가지 객실 선택지)
- [ ] 3중선택 CTA 버튼 UI 컴포넌트
- [ ] L10_D1_CONFIRMATION SMS (예약 확정)
- [ ] L10_D3_UPSELL SMS (추가 상품)
- [ ] CRM 자동 세그먼트 (L10_PURCHASED)
- [ ] 구매 후 자동 감사 이메일
- [ ] KPI 대시보드 (객실 선택율, 평균 금액, 업셀율)
- [ ] A/B 테스트: D0 (3선택지 vs 2선택지)

---

**파일 참고**: [[l10_immediate_purchase_closing]] / [[grant_cardone_closing]] / [[psychology_theories_master]]
