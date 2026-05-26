# CRM 심리학 Contact Lifecycle: 10렌즈 전체 여정 (2026-05-26)

## 📚 목표: Contact의 전체 생명주기에 10렌즈 심리학 자동 적용

---

## 🔄 Contact Lifecycle 5단계

### Stage 1: AWARENESS (인식)
**고객이 크루즈의 존재를 알게 되는 단계**

#### 적용 렌즈
- **L0 (부재고객 복구)**: 기존 고객 재활성화
- **L6 (타이밍 불안)**: "언제 가야 할지" 첫 접촉

#### CRM Trigger
```json
{
  "stage": "AWARENESS",
  "triggers": [
    "LANDING_PAGE_VISIT",
    "COLD_CALL_INITIATED",
    "EMAIL_OPENED",
    "SMS_RECEIVED"
  ],
  "crm_updates": {
    "stage": "AWARENESS",
    "leadScore": 10,
    "tag_add": ["WARM_LEAD", "L0_OR_L6_AWARENESS"]
  },
  "automation": {
    "type": "PASONA_P_PROBLEM",
    "template": "AWARENESS_PROBLEM_SETUP"
  }
}
```

#### SMS Flow (Day 0-1)
```
[PASONA P] "당신은 이런 상황 아니세요?"
[SPIN S] "가족 구성 어떻게 되세요?"
[Trigger L6] "당신의 여행 타이밍은?"
```

---

### Stage 2: CONSIDERATION (고려)
**고객이 크루즈를 구체적으로 검토하는 단계**

#### 적용 렌즈
- **L1 (가격이의)**: "너무 비싼데" 대응
- **L2 (준비복잡)**: "준비가 어려울 것 같아" 해결
- **L3 (차별성)**: "일반여행과 뭐가 다른데?" 설명

#### CRM Trigger
```json
{
  "stage": "CONSIDERATION",
  "conditions": {
    "website_visits": { "$gte": 2 },
    "price_calculator_used": true,
    "time_on_site_minutes": { "$gte": 5 }
  },
  "crm_updates": {
    "stage": "CONSIDERATION",
    "leadScore": 25,
    "tag_add": ["EVALUATING", "L1_OR_L2_OR_L3_OBJECTION"]
  },
  "automations": [
    {
      "trigger": "KEYWORD_PRICE_MENTION",
      "response": "L1_PRICE_OBJECTION_FLOW"
    },
    {
      "trigger": "KEYWORD_PREPARATION",
      "response": "L2_PREPARATION_FLOW"
    },
    {
      "trigger": "KEYWORD_DIFFERENCE",
      "response": "L3_DIFFERENTIATION_FLOW"
    }
  ]
}
```

#### SMS Flow (Day 2-4)
```
[PASONA A+S] "당신이 보내는 시간의 소중함" + "크루즈가 해결해요"
[L1 응답] "월 33K 멤버비는 따로" + "가족 할인"
[L2 응답] "짐만 싸면 끝" + "준비 0시간"
[L3 응답] "배 = 움직이는 리조트" + "호텔과의 차이"
```

---

### Stage 3: DECISION (결정)
**고객이 구매를 결정하는 직전 단계**

#### 적용 렌즈
- **L4 (멤버십저항)**: "약정이 부담스러워" 해소
- **L5 (자기투영)**: "나 같은 사람이 맞나?" 확인
- **L6 (타이밍)**: "지금 예약하면 제일 싼 가격"
- **L7 (동반자)**: "배우자/가족이 동의해야"
- **L10 (즉시구매)**: "마지막 고민" → 3중선택

#### CRM Trigger
```json
{
  "stage": "DECISION",
  "conditions": {
    "checkout_page_visited": true,
    "checkout_progress_pct": { "$gte": 50 },
    "or": [
      { "all_objections_addressed": true },
      { "days_in_consideration": { "$gte": 3 } }
    ]
  },
  "crm_updates": {
    "stage": "DECISION",
    "leadScore": 50,
    "status": "HOT_LEAD",
    "tag_add": ["READY_TO_BUY", "L4_L5_L6_L7_L10"]
  },
  "automations": [
    {
      "type": "REAL_TIME_L6_URGENCY",
      "trigger": "CHECKOUT_PROGRESS_DETECTED"
    },
    {
      "type": "L10_TRIPLE_CHOICE_CTA",
      "trigger": "READY_TO_BUY_SCORE_EXCEEDED"
    }
  ]
}
```

#### SMS Flow (Day 5-7)
```
[L6 Real-time] "자리 3개 남았어요! 오늘 밤 12시까지"
[L10] "당신은 이미 결정했어요. 이 3가지 중 선택하세요"
[CTA] [스위트] [스탠다드 추천] [이코노미]
```

---

### Stage 4: PURCHASE (구매)
**고객이 결제하는 단계**

#### 적용 렌즈
- **L8 (재구매)**: "또 가고 싶어요" 심리 설정
- **L9 (건강/안전)**: "배멀미/건강 걱정 없어요" 안심
- **L10 (즉시구매)**: 최종 결정 실행

#### CRM Trigger
```json
{
  "stage": "PURCHASE",
  "conditions": {
    "payment_completed": true
  },
  "crm_updates": {
    "stage": "PURCHASED",
    "status": "CUSTOMER",
    "leadScore": 100,
    "purchasedAt": "NOW",
    "tag_add": ["CUSTOMER", "L10_CONVERTED"],
    "tag_remove": ["LEAD", "HOT_LEAD", "CONSIDERATION"]
  },
  "automations": {
    "immediate": [
      { "type": "SEND_CONFIRMATION_EMAIL" },
      { "type": "SCHEDULE_ONBOARDING_CALL" },
      { "type": "TRIGGER_UPSELL_SEQUENCE" }
    ],
    "delayed": [
      {
        "delay": 86400,
        "type": "SEND_PREPARATION_GUIDE",
        "template": "PURCHASE_PREP_L9_HEALTH_SAFETY"
      }
    ]
  }
}
```

#### SMS Flow (Day 7-14)
```
[Immediate] "예약 확정되었습니다! 🎉"
[+1day] "준비물 가이드" (L9: 배멀미 약 추천)
[+3days] "짐 꾸리기 체크리스트"
[+7days] "출발 1주일 전 최종 준비"
```

---

### Stage 5: RETENTION & LOYALTY (유지)
**고객이 재구매하고 추천하는 단계**

#### 적용 렌즈
- **L8 (재구매)**: "내년에 또 가고 싶어요" 욕망 유지
- **L0 (부재고객)**: 1년 뒤 자동 복구
- **전체 렌즈**: 멤버십 만족도 극대화

#### CRM Trigger
```json
{
  "stage": "RETENTION",
  "conditions": {
    "purchaseCompleted": true,
    "departure_date_approaching": "7_days",
    "or": [
      { "departure_date_passed": true },
      { "post_cruise_nps_received": true }
    ]
  },
  "automations": {
    "pre_departure": [
      {
        "delay": "7_days_before",
        "type": "SEND_EXCITEMENT_SMS",
        "template": "L8_REPURCHASE_EXCITEMENT"
      }
    ],
    "post_departure": [
      {
        "delay": "2_days_after",
        "type": "SEND_NPS_SURVEY"
      },
      {
        "delay": "7_days_after",
        "type": "SEND_PHOTO_ALBUM_REMINDER"
      },
      {
        "delay": "30_days_after",
        "type": "TRIGGER_L8_REPURCHASE_SEQUENCE",
        "template": "L8_REPURCHASE_NEXT_CRUISE"
      }
    ],
    "annual_reactivation": [
      {
        "trigger": "LAST_CONTACT_12_MONTHS_AGO",
        "type": "TRIGGER_L0_REACTIVATION",
        "template": "L0_ANNUAL_COMEBACK"
      }
    ]
  }
}
```

#### SMS Flow (출발 전 ~ 1년 후)
```
[출발 7일 전] "자, 이제 정말 간다! 가족 기대하나요?" (L8 재구매 심리)
[출발 2일 후] "크루즈는 어땠나요? 만족도 평가 부탁해요" (NPS)
[1개월 후] "사진 앨범 준비됐어요. 공유하기" (L8 추억 강화)
[3개월 후] "내년 여름 예약 시작했어요" (L8 재구매 유도)
[1년 후] "당신을 다시 초대합니다" (L0 복구)
```

---

## 📊 Lifecycle별 렌즈 매핑 매트릭스

| Stage | 렌즈 | 심리학 | SMS 주제 | 목표 전환율 |
|-------|------|--------|---------|-----------|
| **AWARENESS** | L0, L6 | 문제 인식 + 타이밍 | 현황 파악 | 15-20% |
| **CONSIDERATION** | L1, L2, L3 | 이의 대응 | 가격/준비/차별성 | 35-45% |
| **DECISION** | L4, L5, L6, L7, L10 | 최종 결정 | 3중선택 + 긴박감 | 55-70% |
| **PURCHASE** | L9, L10 | 건강/안전 + 즉시구매 | 구매 확정 | 70-95% |
| **RETENTION** | L8, L0 | 재구매 + 복구 | 추억 + 초대 | 45-65% |

---

## 🔄 전체 Contact Lifecycle Workflow JSON

```json
{
  "workflowId": "CONTACT_LIFECYCLE_10LENS_MASTER",
  "name": "Contact 생명주기 10렌즈 전체 자동화",
  "enabled": true,
  "stages": [
    {
      "stage": "AWARENESS",
      "stageOrder": 1,
      "description": "고객이 크루즈를 알게 되는 단계",
      "lenses": ["L0", "L6"],
      "dayRange": "0-2",
      "targetConversionRate": "15-20%",
      "automations": ["PASONA_P", "SPIN_S", "L6_TIMING_AWARENESS"]
    },
    {
      "stage": "CONSIDERATION",
      "stageOrder": 2,
      "description": "고객이 구체적으로 검토하는 단계",
      "lenses": ["L1", "L2", "L3"],
      "dayRange": "3-6",
      "targetConversionRate": "35-45%",
      "objectionDetection": {
        "L1": "keyword_price",
        "L2": "keyword_preparation",
        "L3": "keyword_difference"
      }
    },
    {
      "stage": "DECISION",
      "stageOrder": 3,
      "description": "고객이 구매를 결정하는 직전 단계",
      "lenses": ["L4", "L5", "L6", "L7", "L10"],
      "dayRange": "7-10",
      "targetConversionRate": "55-70%",
      "triggers": [
        "CHECKOUT_PROGRESS_GTE_50",
        "ALL_OBJECTIONS_ADDRESSED",
        "DAYS_IN_CONSIDERATION_GTE_3"
      ]
    },
    {
      "stage": "PURCHASE",
      "stageOrder": 4,
      "description": "고객이 결제하는 단계",
      "lenses": ["L9", "L10"],
      "dayRange": "11-14",
      "targetConversionRate": "70-95%",
      "actions": [
        "SEND_CONFIRMATION",
        "SCHEDULE_ONBOARDING",
        "TRIGGER_UPSELL"
      ]
    },
    {
      "stage": "RETENTION",
      "stageOrder": 5,
      "description": "고객이 재구매하고 추천하는 단계",
      "lenses": ["L8", "L0"],
      "dayRange": "15+ (3개월~1년)",
      "targetConversionRate": "45-65%",
      "triggers": [
        "DEPARTURE_7_DAYS_BEFORE",
        "POST_CRUISE_30_DAYS",
        "ANNUAL_ANNIVERSARY"
      ]
    }
  ],
  "globalRules": {
    "lensDetection": "REAL_TIME",
    "automationTiming": "SMART_SCHEDULING",
    "metricsTracking": "REAL_TIME_DASHBOARD"
  }
}
```

---

## 💡 실전 예시: 한 명의 고객 완전 여정 (14일)

### 김민지 고객 (가족 3명, 크루즈 첫경험)

#### Day 0 (AWARENESS)
```
09:00 - Landing Page 방문 (가족여행)
CRM: awareness_stage = true, L0_or_L6_signal_detected

10:00 - SMS 발송
"김민지 님, 안녕하세요! 가족과 함께 특별한 시간 있으세요?" (PASONA P + L6)

14:00 - 클릭 응답
CRM: sms_clicked = true, response_time = 4h

15:00 - 다음 SMS (SPIN S)
"가족 구성이 어떻게 되세요? (부부만/아이 포함/다대)" 
응답: "아이 2명"

→ Segment: FAMILY_WITH_KIDS, leadScore: 20
```

#### Day 1-2 (CONSIDERATION - L2 준비복잡)
```
SMS: "아이들과 여행 준비할 시간, 있으세요?" (PASONA A - 자극)
응답: "준비가 복잡할 것 같아요" (L2 신호 감지)

CRM: l2_preparation_burden = true

다음 SMS: "크루즈는 짐만 싸면 끝! 나머지는 배가 다 해줍니다" (L2 해결)
```

#### Day 3 (CONSIDERATION - L1 가격이의)
```
웹사이트 방문: 가격 페이지, 계산기 사용
CRM: consideration_stage = true, price_interest = true

전화 통화: "가격이 좀 비싼 거 같은데요"
CRM: l1_price_resistance = true (자동 감지)

SMS: "월 33,000원은 멤버비고, 상품비는 따로입니다" (L1 기준점 재설정)
+ "스타벅스 월 15만원 드시면 충분해요" (L1 비유)

응답: SMS 클릭 → 더 알아보기
CRM: leadScore: 35
```

#### Day 4-5 (DECISION)
```
다시 웹사이트 방문: 장시간 머무름 (checkout 80% 진행)
CRM: decision_stage = true, l10_readiness_score = 78 (즉시구매 준비)

실시간 SMS (L6 타이밍):
"자리 5개 남았어요! 조기예약가 ₩2.2M (내일부터 ₩2.5M)"
[남은 시간: 8시간]

응답: SMS 클릭 (매우 긍정적)
CRM: status = HOT_LEAD, leadScore: 60
```

#### Day 6 (DECISION - L10 3중선택)
```
최종 SMS (L10 Triple Choice):
"김민지 님, 당신은 이미 결정했어요!
이 세 가지 중 선택하세요:

1️⃣ 프리미엄 (스위트) ₩3.2M 👑
2️⃣ 스탠다드 (오션뷰) ₩2.2M ⭐추천
3️⃣ 이코노미 (내실) ₩1.5M"

응답: 옵션 2 (스탠다드) 선택
```

#### Day 7 (PURCHASE)
```
자동으로 결제 페이지 열림
결제 완료!

CRM 자동 업데이트:
- status = CUSTOMER
- stage = PURCHASED
- leadScore = 100
- purchasedAt = 2026-05-26
- tag_add = CUSTOMER, L10_CONVERTED

자동 이메일: "예약 확정되었습니다! 🎉"
자동 전화: 온보딩 콜 스케줄링
```

#### Day 8-30 (POST-PURCHASE)
```
Day 8: SMS "여행 준비 가이드" (L9: 배멀미 약 추천)
Day 10: SMS "짐 꾸리기 체크리스트"
Day 15: SMS "비자, 여권 확인했나요?"
Day 30: SMS "내일이 출발일이에요! 설렜어요?" (L8 기대감)
```

#### Day 35+ (POST-DEPARTURE & RETENTION)
```
Day 35: SMS "크루즈는 어땠나요? 만족도 평가 부탁" (NPS)
Day 60: SMS "가족 사진 앨범 준비됐어요" (L8 추억 강화)
Day 120: SMS "내년 여름 예약 시작했어요! 다시 가보실까요?" (L8)
Day 365: SMS "당신을 다시 초대합니다" (L0 annual reactivation)
```

---

## 🎯 체크리스트: Contact Lifecycle 전체 구현

- [ ] 5 Stage 별 CRM Status 필드 정의
- [ ] AWARENESS: L0+L6 자동화
- [ ] CONSIDERATION: L1+L2+L3 객관 감지 및 자동 대응
- [ ] DECISION: L4+L5+L6+L7+L10 다중 경로 분기
- [ ] PURCHASE: 결제 자동화 + 온보딩
- [ ] RETENTION: L8+L0 1년 주기 자동화
- [ ] Stage별 leadScore 자동 계산
- [ ] Daily Lifecycle Progress 대시보드
- [ ] 각 stage 별 conversion rate 추적
- [ ] Sankey 다이어그램 (단계별 이탈율 시각화)

---

**파일 참고**: [[crm_lens_l0]] ~ [[crm_lens_l10]] / [[pasona_framework_complete]] / [[spin_selling_complete]]
