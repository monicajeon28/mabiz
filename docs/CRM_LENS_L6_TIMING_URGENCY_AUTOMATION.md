# CRM 렌즈 L6: 타이밍 기반 긴박감 자동화 (2026-05-26)

## 📚 심리학 원리: 손실회피 + 희소성 + 긴박감

### 1. 렌즈 정의
**L6 (Timing Uncertainty)**: "언제 가야 할지 모름"을 긴박감 + 실시간 재고 기반으로 즉시 결정 유도

### 2. 심리학 메커니즘
- **손실회피**: "지금 예약 안 하면 못 간다" (Prospect Theory)
- **희소성**: 실시간 남은 자리수 표시
- **긴급성**: 카운트다운 타이머 (심리학적 불안감 30% 증가)
- **시간기반 가격**: 조기예약 할인 (타이밍이 중요함을 강조)
- **효과**: 타이밍 불안 → 즉시 구매 **52-71%**

### 3. 타이밍 신호 감지 (Real-time Triggers)
```
- "언제 가는 게 좋나": 명시적 타이밍 질문
- "6월에 갈 수 있나": 구체적 월 언급
- "자리가 남았나": 재고 확인 신호
- "추석에 가고 싶은데": 명절 기반 시간
- "가격이 내려갈까": 가격 타이밍 기대
```

---

## 🔧 CRM Workflow 자동화

### Condition 1: 타이밍 신호 감지 (Real-time NLP)
```json
{
  "trigger": "KEYWORD_DETECTION",
  "source": ["call_log", "sms_response", "landing_page_interaction"],
  "nlpKeywords": [
    "언제", "몇 월", "추석", "명절", "휴가", "어느 때",
    "자리", "남은", "곧", "빨리", "언제쯤"
  ],
  "action": {
    "type": "TRIGGER_L6_FLOW",
    "tag": "L6_TIMING_SIGNAL_DETECTED"
  }
}
```

### Condition 2: 실시간 재고 통합
```json
{
  "trigger": "INVENTORY_CHECK",
  "source": ["booking_system", "third_party_api"],
  "inventory": {
    "field": "available_seats",
    "threshold": "CHECK_REAL_TIME",
    "update_frequency": "EVERY_HOUR"
  },
  "logic": {
    "LOW_INVENTORY": {
      "threshold": "< 5 seats",
      "urgency_level": "CRITICAL"
    },
    "MEDIUM_INVENTORY": {
      "threshold": "5-20 seats",
      "urgency_level": "HIGH"
    },
    "NORMAL_INVENTORY": {
      "threshold": "> 20 seats",
      "urgency_level": "MEDIUM"
    }
  }
}
```

### Action 1: Countdown Timer SMS (Loss Aversion)
```json
{
  "name": "L6_Countdown_Stock_Urgency",
  "delay": "IMMEDIATE",
  "template": "L6_COUNTDOWN_TIMER",
  "psychology": ["손실회피", "희소성", "긴박감"],
  "contentRules": {
    "if_low_inventory": "⏰ 남은 자리: [숫자]개 (3시간 내 마감 예상)",
    "if_medium_inventory": "⏰ 남은 자리: [숫자]개 (오늘 안 완매 가능)",
    "if_normal_inventory": "⏰ 6월 크루즈 수요 급증 (내일부터 가격인상)"
  },
  "message": "김민지 님!\n\n🚢 당신이 원하던 6월 크루즈\n⏰ 남은 자리: 2개\n💰 조기예약가: ₩2.2M (내일부터 ₩2.5M)\n\n[지금 예약하기]",
  "smsPhase": "P_A",
  "recordKey": "l6_day0_countdown"
}
```

**심리학 설명**:
- "2개 남은 자리" = 희소성 (구체적 숫자 > 추상적 "거의 다 찼다")
- "내일부터 가격인상" = 손실회피 (돈 잃을 위험)
- "3시간 마감 예상" = 긴박감 (시간이 정말 없음)
- 이모지 🚢⏰💰 = 시각적 강조

### Action 2: Day 1 Timeline 제시 (결정 촉구)
```json
{
  "name": "L6_Timeline_Decision_Framework",
  "delay": "1440",
  "template": "L6_TIMELINE_OPTIONS",
  "psychology": ["한정된 선택지", "일관성", "손실회피"],
  "message": "김민지 님, 여행 일정을 어떻게 잡으실건가요?\n\n📅 6월 14-20일 (금~목): 조기예약 ₩2.2M ✅\n📅 6월 21-27일 (금~목): 정가 ₩2.5M\n📅 7월 크루즈: 아직 미오픈 (최대 ₩3M)\n\n가장 빠른 6월 14일로 갈까요?\n👉 [예약하기]",
  "smsPhase": "S",
  "recordKey": "l6_day1_timeline"
}
```

**심리학 설명**:
- 3가지 타이밍 옵션 제시 = 선택지 느낌 (실제론 1가지가 최고)
- "조기예약 ✅" = 체크마크 = 권장
- 가격 단계별 표시 = 비교를 통한 손실회피 강화

### Action 3: Day 3 최후 긴박감 (NOW or NEVER)
```json
{
  "name": "L6_Final_Urgency_Close",
  "delay": "4320",
  "template": "L6_FINAL_COUNTDOWN",
  "psychology": ["손실회피", "희소성", "부족성"],
  "contentRules": {
    "update_inventory_real_time": true,
    "countdown_timer": true,
    "stock_gauge": "[████████░░] 85% 매진"
  },
  "message": "⏰ 긴급!\n\n6월 14-20일 크루즈\n[████████░░] 85% 매진 (자리 1개만!)\n💰 지금가: ₩2.2M\n⏰ 남은 시간: 6시간 32분\n\n더 이상 기다릴 수 없습니다!\n👉 [지금 예약] vs [다음 기회]",
  "smsPhase": "O_N",
  "recordKey": "l6_day3_final"
}
```

**심리학 설명**:
- 실시간 재고 게이지 = 시각적 손실회피 (85% 이미 누군가 선택함)
- "자리 1개만" = 극한의 희소성
- "6시간 32분" = 실시간 카운트다운 = 최고의 긴박감
- 두 가지 선택지: 긍정(예약) vs 부정(다음 기회) = 결정 강제

### Action 4: CRM 즉시 상태 업데이트
```json
{
  "condition": {
    "trigger": "COUNTDOWN_CLICK_RECEIVED",
    "field": "sms_status"
  },
  "then": {
    "type": "COMPOSITE",
    "actions": [
      {
        "type": "UPDATE_CONTACT",
        "fields": {
          "segmentOverride": "L6_URGENT_INTENT",
          "status": "HOT_LEAD",
          "leadScore": "+30",
          "tag_add": "L6_COUNTDOWN_RESPONDED"
        }
      },
      {
        "type": "IMMEDIATE_CALL",
        "target_role": "sales_closer_premium",
        "template": "L6_PHONE_CLOSE",
        "note": "HOT LEAD - 6시간 내 결정 필요",
        "call_priority": "CRITICAL"
      },
      {
        "type": "SCHEDULE_PAYMENT",
        "auto_retry": "EVERY_30MIN",
        "timeout": "6_HOURS"
      }
    ]
  }
}
```

---

## 📊 실시간 KPI 추적 (Real-time Dashboard)

### KPI 정의
| 메트릭 | 현재 | 목표 | 공식 |
|--------|------|------|------|
| **긴박감 인지율** | 22% | 52-71% | (SMS 클릭 / 발송) |
| **타이밍 결정율** | 18% | 40-52% | (타이밍 선택 / 긴박감 감지) |
| **즉시 구매율** | 12% | 28-35% | (구매 / 긴박감 접촉) |
| **구매까지 시간** | 4-5일 | 1-2시간 | (Contact 접촉 ↔ 결제 완료) |

### 실시간 모니터링 대시보드
```sql
-- Real-time L6 Countdown Performance
SELECT 
  contact_id,
  phone,
  l6_countdown_sent_at,
  TIMESTAMPDIFF(MINUTE, l6_countdown_sent_at, NOW()) as minutes_since_send,
  inventory_available,
  CASE 
    WHEN inventory_available < 5 THEN 'CRITICAL'
    WHEN inventory_available < 20 THEN 'HIGH'
    ELSE 'NORMAL'
  END as urgency_level,
  sms_clicked,
  call_received,
  purchase_completed,
  CASE 
    WHEN purchase_completed = 1 THEN TIMESTAMPDIFF(MINUTE, l6_countdown_sent_at, purchase_at)
    ELSE NULL
  END as minutes_to_purchase
FROM contacts
WHERE tags LIKE '%L6_COUNTDOWN%'
  AND l6_countdown_sent_at > NOW() - INTERVAL 24 HOUR
ORDER BY urgency_level DESC, inventory_available ASC;
```

---

## 🔄 전체 Workflow JSON (Real-time)

```json
{
  "workflowId": "L6_TIMING_URGENCY_MASTER",
  "name": "L6 타이밍 긴박감 자동화",
  "enabled": true,
  "realTimeProcessing": true,
  "inventoryIntegration": {
    "type": "REAL_TIME_API",
    "source": "booking_system",
    "updateFrequency": "EVERY_30MIN",
    "field": "available_seats"
  },
  "triggers": [
    {
      "id": "timing_signal_detection",
      "type": "REAL_TIME",
      "source": ["call_log_notes", "sms_response", "landing_page"],
      "nlpKeywords": ["언제", "월", "자리", "추석", "휴가"],
      "action": "TRIGGER_L6_FLOW"
    },
    {
      "id": "inventory_critical",
      "type": "CONDITIONAL",
      "condition": { "available_seats": { "$lt": 5 } },
      "action": "ESCALATE_URGENCY_TO_CRITICAL"
    }
  ],
  "actions": [
    {
      "order": 1,
      "type": "REAL_TIME_SMS",
      "delay": 0,
      "templateId": "L6_COUNTDOWN_TIMER",
      "dynamicContent": {
        "available_seats": "FETCH_REAL_TIME",
        "countdown_hours": "CALCULATE_DYNAMIC"
      },
      "recordAs": "l6_day0_countdown"
    },
    {
      "order": 2,
      "type": "SEND_SMS",
      "delay": 1440,
      "templateId": "L6_TIMELINE_OPTIONS",
      "recordAs": "l6_day1_timeline"
    },
    {
      "order": 3,
      "type": "REAL_TIME_SMS",
      "delay": 4320,
      "templateId": "L6_FINAL_COUNTDOWN",
      "dynamicContent": {
        "available_seats": "FETCH_REAL_TIME",
        "inventory_gauge": "RENDER_VISUAL",
        "countdown_timer": "LIVE_UPDATE_EVERY_MINUTE"
      },
      "recordAs": "l6_day3_final"
    },
    {
      "order": 4,
      "type": "CONDITIONAL_BRANCH",
      "condition": { "smsClicked": true },
      "then": {
        "type": "COMPOSITE",
        "actions": [
          { "type": "UPDATE_SEGMENT", "value": "L6_URGENT_INTENT" },
          { "type": "BOOST_LEAD_SCORE", "amount": 30 },
          { "type": "IMMEDIATE_PHONE_CALL" },
          { "type": "SHOW_PAYMENT_BUTTON", "auto_retry": true }
        ]
      }
    }
  ]
}
```

---

## 💡 Grant Cardone 전화 클로싱 스크립트 (L6 Hot Lead)

### Opening (10초)
```
"김민지 님, 안녕하세요!
저는 크루즈 판매 담당 신민형입니다.

지금 바쁘신가요? 
1분만 시간 내셔도 될까요?"
```

### Urgency Emphasis (20초)
```
"지금 전화 드린 이유는 간단합니다.
6월 14일 크루즈가 자리가 1개 남았거든요.

당신이 지금 결정하지 않으면,
다음 달 크루즈는 ₩500K 더 비싸집니다.

그런데 당신은 이미 결정했더라고요, 맞죠?
언제 예약하실 생각이세요?"
```

### Trial Close (15초)
```
"좋습니다! 그럼 신용카드 끝 4자리만 불러주세요.
지금 결제 진행할게요."
```

---

## 🎯 체크리스트: L6 렌즈 구현

- [ ] 타이밍 신호 NLP 키워드 감지 (실시간)
- [ ] 재고 시스템 API 통합 (30분 주기 업데이트)
- [ ] L6_COUNTDOWN_TIMER SMS (재고 + 카운트다운)
- [ ] L6_TIMELINE_OPTIONS SMS (타이밍 선택지)
- [ ] L6_FINAL_COUNTDOWN SMS (긴박감 극대화 + 실시간 게이지)
- [ ] 실시간 재고 게이지 UI 컴포넌트
- [ ] CRM 즉시 상태 업데이트 (L6_URGENT_INTENT)
- [ ] IMMEDIATE_CALL 트리거 (click → 5분 내 전화)
- [ ] Real-time KPI 대시보드 (자리 수, 시간, 클릭율)
- [ ] A/B 테스트: D3 (카운트다운 vs 가격인상)

---

**파일 참고**: [[l6_timing_loss_aversion]] / [[grant_cardone_deal_killer]] / [[psychology_theories_master]]
