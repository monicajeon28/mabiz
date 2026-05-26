# CRM PASONA 6단계 Workflow 매핑 (2026-05-26)

## 📚 PASONA Framework: 문제→해결→제안→행동

### 1. PASONA 정의
**PASONA** = 일본식 광고 카피 프레임워크, CRM 자동화에 완벽히 매핑 가능

```
P: Problem (문제) — 고객의 현재 상태
A: Agitate (자극) — 문제의 심각성 강조
S: Solution (해결책) — 우리의 솔루션 제시
O: Offer (제안) — 구체적인 제안
N: Narrow (한정) — 희소성/긴박감
A: Action (행동) — 즉시 결정 촉구
```

---

## 🔧 PASONA 6단계 → CRM Workflow 매핑

### Phase 1: P (Problem) — 현재 상태 인식
#### 심리학: 문제 활성화 (Problem Awareness)
- 고객이 자신의 문제를 명확히 인식하게 함
- "당신은 이런 상황이죠?"

#### CRM Trigger
```json
{
  "phase": "P_PROBLEM",
  "trigger": "INITIAL_CONTACT",
  "goal": "PROBLEM_RECOGNITION",
  "conditions": {
    "contact_status": ["NEW", "WARM_LEAD"],
    "interaction_type": ["LANDING_PAGE", "COLD_CALL", "SMS"]
  },
  "crm_fields_to_update": {
    "pasona_phase": "P_PROBLEM",
    "problem_identified": true
  }
}
```

#### SMS 예시 (Day 0)
```
"김민지 님, 안녕하세요!

🤔 이런 상황 아니세요?
- 가족과 함께 특별한 시간 부족
- 여행은 가고 싶은데 준비가 복잡
- 일상의 스트레스에서 벗어나고 싶음

이런 느낌 맞다면, 다음 메시지 꼭 봐주세요."
```

#### CRM Automation
```json
{
  "action": "SEND_SMS",
  "delay": 0,
  "template": "PASONA_P_PROBLEM_AWARENESS",
  "nextPhase": "A_AGITATE",
  "phaseTracking": {
    "record": "pasona_phase_p_completed",
    "trigger_next_at": "24 hours"
  }
}
```

---

### Phase 2: A (Agitate) — 문제 심각성 강조
#### 심리학: 손실회피 + 긴박감 (Fear + Loss)
- 현재 상태가 계속되면 발생할 손실 강조
- "이대로 가면..."

#### CRM Trigger
```json
{
  "phase": "A_AGITATE",
  "trigger": "SMS_CLICKED_OR_CALL_RECEIVED",
  "goal": "AMPLIFY_PAIN",
  "conditions": {
    "previous_phase": "P_PROBLEM",
    "response_received": true
  }
}
```

#### SMS 예시 (Day 1)
```
"😔 그런데 알아두세요...

✈️ 가족과 함께할 수 있는 시간은 제한적입니다.
   아이들이 크면 함께 여행하기 어려워져요.

💰 매년 같은 자리, 같은 호텔로 예약하면
   가격은 계속 올라갑니다. (지난해 5%, 올해 8%)

😞 지금 행동하지 않으면,
   다음 해엔 더 비싼 가격에 더 못 찬 자리만 남아요.

[다음 단계: 해결책 알아보기]"
```

#### CRM Automation
```json
{
  "action": "SEND_SMS",
  "delay": 1440,
  "template": "PASONA_A_AGITATE_LOSS_AVERSION",
  "psychologyTriggers": [
    "손실회피 심리",
    "희소성",
    "가족시간의_한정성"
  ],
  "nextPhase": "S_SOLUTION"
}
```

---

### Phase 3: S (Solution) — 해결책 제시
#### 심리학: 권위성 + 사회증명 (Authority + Social Proof)
- 우리의 솔루션이 문제를 해결함을 증명
- "크루즈는 이 모든 것을 해결합니다"

#### CRM Trigger
```json
{
  "phase": "S_SOLUTION",
  "trigger": "2_DAYS_INTO_CAMPAIGN",
  "goal": "INTRODUCE_SOLUTION",
  "conditions": {
    "previous_phase_completed": true,
    "response_rate_gte": 0
  }
}
```

#### SMS 예시 (Day 2-3)
```
"✅ 좋은 소식이 있어요!

🚢 크루즈는 모든 게 포함되어 있습니다:
  ✈️ 비행기: 포함
  🏨 호텔: 포함 (매일 다른 도시)
  🍽️ 식사: 24시간 뷔페
  🎭 엔터테인먼트: 매일 쇼/공연
  👨‍👩‍👧‍👦 가족할인: 아이 50% OFF

📊 이미 8,000명 이상이 이걸 선택했어요.
   (올해 3월~5월 데이터)

[비유: 호텔 예약 vs 크루즈]
일반여행: 비행기 ₩500K + 호텔 ₩1.5M + 식사 ₩500K = ₩2.5M
크루즈: 올인클루시브 ₩2.2M (₩300K 절약!)

[자세히 알아보기]"
```

#### CRM Automation
```json
{
  "action": "SEND_SMS",
  "delay": 3600,
  "template": "PASONA_S_SOLUTION_PROOF",
  "contentRules": {
    "show_social_proof": true,
    "show_price_comparison": true,
    "show_customer_testimonials": 3
  },
  "nextPhase": "O_OFFER"
}
```

---

### Phase 4: O (Offer) — 구체적 제안
#### 심리학: 한정성 + 선택지 (Scarcity + Choice)
- 구체적이고 제한된 제안 제시
- "지금 이 가격에..." (앞으로는 올라갈 것)

#### CRM Trigger
```json
{
  "phase": "O_OFFER",
  "trigger": "SOLUTION_EXPLAINED",
  "goal": "PRESENT_CONCRETE_OFFER",
  "inventory_integration": true,
  "dynamic_pricing": true
}
```

#### SMS 예시 (Day 3)
```
"🎁 특별 제안이 있습니다!

📅 6월 14-20일 크루즈
🛏️ 스탠다드 객실 (오션뷰)
💰 통상가 ₩2.5M → 조기예약가 ₩2.2M (₩300K 절약!)

📊 남은 자리: 3개 (오늘 기준)

[세 가지 선택:]
1️⃣ 프리미엘 (스위트) ₩3.2M
2️⃣ 스탠다드 (오션뷰) ₩2.2M ⭐ 추천
3️⃣ 이코노미 (내실) ₩1.5M

이 가격은 오늘 밤 12시까지만 유효합니다.

[지금 예약하기]"
```

#### CRM Automation
```json
{
  "action": "SEND_SMS",
  "delay": 5400,
  "template": "PASONA_O_OFFER_CONCRETE",
  "dynamicContent": {
    "available_inventory": "REAL_TIME",
    "offer_expiry": "TODAY_MIDNIGHT",
    "pricing_tier": "SHOW_3_OPTIONS"
  },
  "nextPhase": "N_NARROW"
}
```

---

### Phase 5: N (Narrow) — 범위 한정
#### 심리학: 긴박감 + 희소성 (Urgency + Scarcity)
- 제안의 시간 제한 명확히
- "오늘, 이 시간만..."

#### CRM Trigger
```json
{
  "phase": "N_NARROW",
  "trigger": "OFFER_PRESENTED",
  "goal": "ENFORCE_TIME_LIMIT",
  "scarcity_engine": {
    "inventory_limit": true,
    "time_limit": true,
    "countdown": true
  }
}
```

#### SMS 예시 (Day 3-4, 실시간 업데이트)
```
"⏰ 긴급! 시간 제한 상품!

남은 자리: 2개 (1시간 전 3개)
⏱️ 남은 시간: 12시간 34분

이 제안은:
📌 오늘 밤까지만 유효
📌 ₩2.2M 가격은 더 이상 나올 수 없습니다
📌 내일부터 ₩2.5M (정가)로 인상

당신의 결정 시간입니다.

[지금 예약] vs [다음 기회]"
```

#### CRM Automation
```json
{
  "action": "SEND_SMS",
  "delay": 7200,
  "template": "PASONA_N_NARROW_URGENCY",
  "dynamicContent": {
    "countdown_timer": "REAL_TIME_UPDATE_EVERY_HOUR",
    "inventory_gauge": "UPDATE_REAL_TIME",
    "price_escalation": "SHOW_TOMORROW_PRICE"
  },
  "nextPhase": "A_ACTION"
}
```

---

### Phase 6: A (Action) — 행동 촉구
#### 심리학: 명확한 CTA + 일관성 (Clear Call + Commitment)
- 지금 바로 할 한 가지 행동 명시
- "지금 이 버튼을 눌러주세요"

#### CRM Trigger
```json
{
  "phase": "A_ACTION",
  "trigger": "NARROW_PHASE_COMPLETED",
  "goal": "IMMEDIATE_ACTION",
  "cta_channel": ["SMS", "CALL", "EMAIL", "PUSH_NOTIFICATION"]
}
```

#### SMS 예시 (Day 4)
```
"최후의 기회입니다. ⏰

더 이상 기다릴 수 없습니다.
이 메시지를 받은 순간이 당신의 결정 시간입니다.

하나의 버튼만 눌러주세요:

👇 [지금 예약하기] 👇

또는 전화로:
📞 1577-CRUISE (한국어 상담원)

당신을 기다리고 있습니다. 🚢"
```

#### CRM Automation
```json
{
  "action": "COMPOSITE",
  "actions": [
    {
      "type": "SEND_SMS",
      "delay": 8600,
      "template": "PASONA_A_ACTION_FINAL"
    },
    {
      "type": "CONDITIONAL_BRANCH",
      "condition": { "smsClicked": true },
      "then": {
        "type": "IMMEDIATE_ACTIONS",
        "actions": [
          { "type": "CHARGE_PAYMENT" },
          { "type": "SEND_CONFIRMATION_EMAIL" },
          { "type": "SCHEDULE_ONBOARDING_CALL" }
        ]
      },
      "else": {
        "type": "ESCALATE_TO_SALES_TEAM"
      }
    }
  ]
}
```

---

## 📊 PASONA 성과 메트릭

### KPI 정의
| 단계 | 메트릭 | 현재 | 목표 | 공식 |
|------|--------|------|------|------|
| **P** | 문제 인식율 | 45% | 75%+ | (P 단계 SMS 클릭 / 발송) |
| **A** | 자극 반응율 | 28% | 50%+ | (A 단계 응답 / P 완료) |
| **S** | 해결책 이해율 | 35% | 60%+ | (S 단계 클릭 / A 완료) |
| **O** | 제안 선택율 | 22% | 45%+ | (O 단계 클릭 / S 완료) |
| **N** | 시간제한 인식 | 18% | 40%+ | (N 단계 SMS 클릭 / O 완료) |
| **A** | 즉시 행동율 | 12% | 30%+ | (구매 / N 완료) |

### 자동 성과 리포팅
```sql
-- PASONA Phase별 성과 분석
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_contacts,
  SUM(CASE WHEN pasona_phase >= 'P' THEN 1 ELSE 0 END) as p_count,
  SUM(CASE WHEN pasona_phase >= 'A' THEN 1 ELSE 0 END) as a_count,
  SUM(CASE WHEN pasona_phase >= 'S' THEN 1 ELSE 0 END) as s_count,
  SUM(CASE WHEN pasona_phase >= 'O' THEN 1 ELSE 0 END) as o_count,
  SUM(CASE WHEN pasona_phase >= 'N' THEN 1 ELSE 0 END) as n_count,
  SUM(CASE WHEN pasona_phase >= 'A' AND purchased = 1 THEN 1 ELSE 0 END) as a_purchases,
  ROUND(100.0 * SUM(CASE WHEN purchased = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) as overall_conversion_pct
FROM contacts
WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## 🔄 전체 PASONA Workflow JSON

```json
{
  "workflowId": "PASONA_MASTER_6PHASE",
  "name": "PASONA 6단계 전체 자동화",
  "enabled": true,
  "phases": [
    {
      "phase": "P_PROBLEM",
      "order": 1,
      "delay": 0,
      "template": "PASONA_P_PROBLEM_AWARENESS",
      "nextTrigger": "SMS_RESPONSE_RECEIVED"
    },
    {
      "phase": "A_AGITATE",
      "order": 2,
      "delay": 1440,
      "template": "PASONA_A_AGITATE_LOSS",
      "psychologyFocus": ["손실회피", "희소성"],
      "nextTrigger": "DAILY_SCHEDULE"
    },
    {
      "phase": "S_SOLUTION",
      "order": 3,
      "delay": 3600,
      "template": "PASONA_S_SOLUTION_PROOF",
      "dynamicContent": {
        "social_proof": true,
        "price_comparison": true,
        "testimonials_count": 3
      }
    },
    {
      "phase": "O_OFFER",
      "order": 4,
      "delay": 5400,
      "template": "PASONA_O_OFFER_CONCRETE",
      "dynamicContent": {
        "real_time_inventory": true,
        "offer_expiry": "TODAY_MIDNIGHT"
      }
    },
    {
      "phase": "N_NARROW",
      "order": 5,
      "delay": 7200,
      "template": "PASONA_N_NARROW_URGENCY",
      "realTimeUpdates": {
        "countdown": true,
        "inventory": true
      }
    },
    {
      "phase": "A_ACTION",
      "order": 6,
      "delay": 8600,
      "template": "PASONA_A_ACTION_FINAL",
      "multiChannelCTA": ["SMS", "CALL", "EMAIL"],
      "conversionTracking": true
    }
  ]
}
```

---

## 🎯 체크리스트: PASONA Workflow 구현

- [ ] P_PROBLEM 인식 SMS (Day 0)
- [ ] A_AGITATE 손실회피 SMS (Day 1)
- [ ] S_SOLUTION 증명 SMS with 사회증명 (Day 2)
- [ ] O_OFFER 구체적 제안 SMS (Day 3 AM)
- [ ] N_NARROW 긴박감 SMS with 실시간 카운트다운 (Day 3 PM)
- [ ] A_ACTION 최종 행동 SMS (Day 4)
- [ ] PASONA_PHASE 필드 자동 업데이트 로직
- [ ] Daily KPI 리포팅 (6단계 진행율)
- [ ] 각 단계별 A/B 테스트 설정
- [ ] SMS 응답율 추적 대시보드

---

**파일 참고**: [[pasona_framework_complete]] / [[rental_sms_3day_sequence]] / [[psychology_theories_master]]
