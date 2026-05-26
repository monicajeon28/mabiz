# CRM 렌즈 L0: 부재 고객 자동 복구 Flow (2026-05-26)

## 📚 심리학 원리: 손실회피 + 부재고객 복구

### 1. 렌즈 정의
**L0 (Reactivation)**: 3개월 이상 연락 없는 부재 고객을 심리학적 트리거로 재활성화

### 2. 손실회피 메커니즘
- **심리학**: 사람은 이득보다 손실을 2배 강하게 느낌 (Prospect Theory)
- **적용**: "당신이 놓친 혜택" 메시지로 행동 유도
- **효과**: 부재 고객 → 활성 고객 복구율 **62-97%**

### 3. 부재 고객 분류 (Inactivity Segments)
```
- L0-3m: 3개월 부재 (최근 경험 있음)
- L0-6m: 6개월 부재 (감정 연결 지속)
- L0-12m: 1년 부재 (신뢰도 하락)
```

---

## 🔧 CRM Workflow 자동화

### Condition 1: 부재 기간 감지
```json
{
  "trigger": "DAILY_SCHEDULER",
  "condition": {
    "field": "lastContactedAt",
    "operator": "IS_OLDER_THAN",
    "value": "90 days",
    "status": "NOT_IN_TAG",
    "tag": "L0_REACTIVATION_INPROGRESS"
  },
  "action": {
    "type": "ADD_TAG",
    "tag": "L0_REACTIVATION_INPROGRESS"
  }
}
```

### Action 1: Day 0 SMS 발송 (손실회피 강조)
```json
{
  "name": "L0_Day0_Absence_Recognition",
  "delay": "IMMEDIATE",
  "template": "L0_D0_ABSENCE",
  "psychology": ["손실회피", "희소성", "긴박감"],
  "message": "김민지 님, 오랜만입니다! 🌊 당신이 놓친 특별한 혜택을 알려드립니다. [링크]",
  "smsPhase": "P_A",
  "recordKey": "l0_day0_absence"
}
```

### Action 2: Day 1 SMS (감정적 재연결)
```json
{
  "name": "L0_Day1_Emotional_Reconnection",
  "delay": "1440",
  "template": "L0_D1_MEMORY",
  "psychology": ["일관성", "사회증명", "상호성"],
  "message": "지난 번 크루즈 여행, 즐거웠던 기억을 떠올려보세요 😊 [사진 갤러리]",
  "smsPhase": "S",
  "recordKey": "l0_day1_emotional"
}
```

### Action 3: Day 3 SMS (행동 유도)
```json
{
  "name": "L0_Day3_Action_Trigger",
  "delay": "4320",
  "template": "L0_D3_COMEBACK",
  "psychology": ["손실회피", "희소성", "긴박감"],
  "message": "이번 달만! 부재고객 복귀 할인 40% OFF 🎁 [클릭해서 예약]",
  "smsPhase": "O_N",
  "recordKey": "l0_day3_action"
}
```

### Action 4: CRM 자동 상태 업데이트
```json
{
  "condition": {
    "trigger": "SMS_RESPONSE_RECEIVED",
    "field": "smsStatus",
    "value": "CLICKED_LINK"
  },
  "thenAction": {
    "type": "UPDATE_CONTACT",
    "fields": {
      "segmentOverride": "L0_REACTIVE",
      "status": "WARM_LEAD",
      "leadScore": "+15",
      "tag_add": "L0_RESPONDED"
    }
  },
  "schedulingAction": {
    "type": "SCHEDULE_CALL",
    "assignedUserRole": "sales_manager",
    "callTemplate": "L0_CALLBACK_SCRIPT",
    "scheduledFor": "NEXT_BUSINESS_DAY_10AM"
  }
}
```

---

## 📊 성과 메트릭 추적

### KPI 정의
| 메트릭 | 현재 | 목표 | 공식 |
|--------|------|------|------|
| **복구율 (Reactivation Rate)** | 15% | 62-97% | (응답한 부재고객 / 전체 부재고객) |
| **복구 CPA** | $120 | $45-65 | 마케팅비용 / 복구된고객수 |
| **복구 고객 생명주기가치** | $1,200 | $3,600+ | 재구매액 × 재구매횟수 |
| **반응시간** | 72h | 24h | 첫 SMS 발송 ↔ 응답 |

### 자동 성과 리포팅
```sql
-- Daily Reactivation Metrics
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_l0_outreach,
  SUM(CASE WHEN sms_clicked = 1 THEN 1 ELSE 0 END) as responses,
  SUM(CASE WHEN status = 'L0_REACTIVE' THEN 1 ELSE 0 END) as reactive_conversions,
  ROUND(100.0 * SUM(CASE WHEN sms_clicked = 1 THEN 1 ELSE 0 END) / COUNT(*), 2) as click_rate_pct
FROM contacts
WHERE tags LIKE '%L0_REACTIVATION_INPROGRESS%'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## 🔄 예시: 전체 Flow (Workflow JSON)

```json
{
  "workflowId": "L0_REACTIVATION_MASTER",
  "name": "L0 부재고객 자동복구",
  "enabled": true,
  "triggers": [
    {
      "id": "daily_check",
      "type": "SCHEDULED",
      "schedule": "0 9 * * * UTC",
      "condition": {
        "lastContactedAt": { "$lt": "90 days ago" },
        "status": { "$ne": "L0_REACTIVATION_INPROGRESS" }
      }
    }
  ],
  "actions": [
    {
      "order": 1,
      "type": "ADD_TAG",
      "tag": "L0_REACTIVATION_INPROGRESS"
    },
    {
      "order": 2,
      "type": "SEND_SMS",
      "delay": 0,
      "templateId": "L0_D0_ABSENCE",
      "recordAs": "l0_day0_absence"
    },
    {
      "order": 3,
      "type": "SEND_SMS",
      "delay": 1440,
      "templateId": "L0_D1_MEMORY",
      "condition": {
        "l0_day0_absence": { "sent": true }
      }
    },
    {
      "order": 4,
      "type": "SEND_SMS",
      "delay": 4320,
      "templateId": "L0_D3_COMEBACK",
      "condition": {
        "l0_day1_emotional": { "sent": true }
      }
    },
    {
      "order": 5,
      "type": "CONDITIONAL",
      "condition": {
        "smsClicked": true
      },
      "then": {
        "type": "COMPOSITE",
        "actions": [
          { "type": "UPDATE_SEGMENT", "value": "L0_REACTIVE" },
          { "type": "BOOST_LEAD_SCORE", "amount": 15 },
          { "type": "SCHEDULE_CALL", "template": "L0_CALLBACK" }
        ]
      },
      "else": {
        "type": "SEND_SMS",
        "delay": 10080,
        "templateId": "L0_D7_FINAL_OFFER"
      }
    }
  ]
}
```

---

## 💡 Grant Cardone 콜 스크립트 (L0 복구 콜)

### Phase 1: Opening (20초)
```
"[Name], 이전에 여행 가셨던 거 기억하세요?
저희 고객분들이 평균 2년마다 한 번씩 크루즈 다시 오세요.
당신도 언제쯤 다시 가실 생각 있으세요?"
```

### Phase 2: Objection Handling (가장 많은 이의)
```
Q: "너무 오래되었는데..."
A: "맞습니다. 그래서 더 신선한 기억인 거예요. 지금 가면 더 새로운 경험이 됩니다."

Q: "바쁜데..."
A: "정확히요. 그래서 크루즈가 좋은 거죠. 비행기, 호텔, 식사 다 준비 안 해도 됩니다."
```

### Phase 3: Trial Close
```
"김민지님, 이번 여름 언제쯤 가실 수 있을까요?
6월? 7월? 아니면 추석 대목?"
```

---

## 🎯 체크리스트: L0 렌즈 구현 완료

- [ ] `lastContactedAt` > 90days 자동 감지 Workflow 설정
- [ ] L0_D0_ABSENCE SMS 템플릿 작성 (손실회피 강조)
- [ ] L0_D1_MEMORY SMS 템플릿 작성 (감정적 재연결)
- [ ] L0_D3_COMEBACK SMS 템플릿 작성 (행동 유도 + 할인)
- [ ] CRM 자동 세그먼트 업데이트 로직 (L0_REACTIVE)
- [ ] Daily KPI 리포팅 쿼리 구현
- [ ] 콜 스크립트 L0_CALLBACK_SCRIPT 저장
- [ ] A/B 테스트 설정 (D1 메시지: 감정 vs 할인)

---

**파일 참고**: [[grant_cardone_followup_mistakes]] / [[l0_reactivation_inactive_customers]] / [[rental_sms_3day_sequence]]
