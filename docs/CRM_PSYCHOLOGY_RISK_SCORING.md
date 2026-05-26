# CRM 심리학 기반 위험 신호 자동 감지 (2026-05-26)

## 📚 10렌즈 기반 거래 실패 조기신호 (Deal Killer Detection)

---

## 🚨 거래 위험도 점수 시스템 (Deal Risk Score: 0-100)

### 위험도 레벨
- **0-20**: 🟢 안전 (SAFE) — 거래 진행 자신감
- **21-40**: 🟡 주의 (WARNING) — 모니터링 필요
- **41-60**: 🟠 경고 (ALERT) — 개입 필요
- **61-80**: 🔴 위기 (CRITICAL) — 즉시 대응
- **81-100**: ⚫ 폐기 (ABANDONED) — 거래 포기 또는 재전략

---

## 🔴 렌즈별 위험 신호 (10 Lens Risk Flags)

### L0 Risk: 부재고객의 재활성화 실패
```json
{
  "risk_name": "L0_REACTIVATION_FAILURE",
  "risk_signals": [
    {
      "signal": "NO_RESPONSE_TO_3_SMS",
      "weight": 15,
      "description": "3번의 SMS에 반응 없음",
      "trigger_score": "add_15_points"
    },
    {
      "signal": "NEGATIVE_RESPONSE",
      "weight": 25,
      "keywords": ["관심없어", "안 가", "시간없어"],
      "description": "명시적 거부 신호",
      "trigger_score": "add_25_points"
    },
    {
      "signal": "TIME_SINCE_LAST_CONTACT_GT_3YEARS",
      "weight": 20,
      "description": "3년 이상 연락 없음 → 신뢰도 극도로 낮음",
      "trigger_score": "add_20_points"
    },
    {
      "signal": "PURCHASED_COMPETITOR_PRODUCT",
      "weight": 30,
      "description": "경쟁사 상품 구매 확인",
      "trigger_score": "add_30_points"
    }
  ],
  "mitigation_actions": [
    {
      "score_gte": 40,
      "action": "ESCALATE_TO_SALES_MANAGER",
      "message": "강 개인 전화 개입 필요"
    },
    {
      "score_gte": 60,
      "action": "PAUSE_AUTOMATION",
      "message": "자동화 일시 중지, 재전략 필요"
    }
  ]
}
```

### L1 Risk: 가격 이의 해결 실패
```json
{
  "risk_name": "L1_PRICE_OBJECTION_UNRESOLVED",
  "risk_signals": [
    {
      "signal": "PRICE_REJECTION_AFTER_3_EXPLANATIONS",
      "weight": 20,
      "description": "3번의 설명 후에도 '비싸다'고 고집",
      "action_if_triggered": "OFFER_SPECIAL_DISCOUNT_OR_PAYMENT_PLAN"
    },
    {
      "signal": "COMPETITOR_PRICE_COMPARISON",
      "weight": 25,
      "keywords": ["OOO가 더 싼데", "다른 데가", "그게 뭐하는"],
      "description": "경쟁사와 직접 비교하며 거부",
      "action_if_triggered": "SEND_L3_DIFFERENTIATION_SEQUENCE"
    },
    {
      "signal": "PAYMENT_ATTEMPT_FAILED_TWICE",
      "weight": 30,
      "description": "결제 시도 2회 실패 (카드 거절, 한도 초과 등)",
      "action_if_triggered": "OFFER_FLEXIBLE_PAYMENT_PLAN"
    },
    {
      "signal": "PRICE_NO_LONGER_RELEVANT",
      "weight": 35,
      "keywords": ["지금은 아니고", "나중에", "이번 달은"],
      "description": "타이밍 문제로 변환된 가격 이의",
      "action_if_triggered": "TRIGGER_L6_TIMING_SEQUENCE"
    }
  ],
  "escalation_protocol": {
    "score_gte": 50,
    "action": "OFFER_VIP_NEGOTIATION",
    "message": "VIP 담당자가 맞춤 제안 (1:1 전화)"
  }
}
```

### L2 Risk: 준비복잡 불안 미해결
```json
{
  "risk_name": "L2_PREPARATION_ANXIETY_UNRESOLVED",
  "risk_signals": [
    {
      "signal": "REPEATED_PREPARATION_QUESTIONS",
      "weight": 20,
      "description": "준비에 대해 4회 이상 질문 (명시적 불안)",
      "action_if_triggered": "SEND_DETAILED_PREPARATION_GUIDE_PDF"
    },
    {
      "signal": "CALL_DURATION_VERY_LONG",
      "weight": 15,
      "condition": "call_duration_minutes > 30",
      "description": "전화 통화 30분 이상 (끝을 못 내는 불안)",
      "action_if_triggered": "SCHEDULE_FOLLOW_UP_CLARIFICATION_CALL"
    },
    {
      "signal": "MULTIPLE_CONCERNS_NOT_RESOLVED",
      "weight": 25,
      "description": "여러 우려사항이 동시에 나열됨 (스트레스)",
      "action_if_triggered": "SEND_CHECKLIST_VIDEO_TUTORIAL"
    }
  ],
  "critical_intervention": {
    "score_gte": 55,
    "action": "ASSIGN_PERSONAL_TRAVEL_CONCIERGE",
    "message": "전담 여행 컨시어지 배정 (SMS/전화 24/7)"
  }
}
```

### L3 Risk: 차별성 미인지 계속
```json
{
  "risk_name": "L3_DIFFERENTIATION_NOT_UNDERSTOOD",
  "risk_signals": [
    {
      "signal": "CONFUSION_BOAT_VS_HOTEL",
      "weight": 25,
      "keywords": ["호텔이랑 뭐가 다르나", "그냥 배 아니야", "그게 왜 특별한데"],
      "description": "크루즈 vs 호텔 개념 혼동",
      "action_if_triggered": "SEND_VISUAL_COMPARISON_VIDEO"
    },
    {
      "signal": "STILL_THINKS_BOAT_IS_TRANSPORT",
      "weight": 30,
      "keywords": ["배 타고 가는 거지?", "이동수단", "빨리 가나"],
      "description": "배를 이동수단으로만 인식",
      "action_if_triggered": "SEND_ONBOARD_EXPERIENCE_HIGHLIGHTS"
    }
  ],
  "escalation": {
    "score_gte": 45,
    "action": "SEND_CUSTOMER_VIDEO_TESTIMONIAL",
    "message": "실제 탑승객 후기 영상 (Before/After)"
  }
}
```

### L6 Risk: 타이밍 결정 미루기
```json
{
  "risk_name": "L6_TIMING_DECISION_PROCRASTINATION",
  "risk_signals": [
    {
      "signal": "INDEFINITE_TIMING_RESPONSE",
      "weight": 20,
      "keywords": ["언제 모르겠어요", "아직 모르겠어", "나중에 생각"],
      "description": "명확한 타이밍 없음",
      "action_if_triggered": "OFFER_MULTIPLE_DATE_OPTIONS"
    },
    {
      "signal": "MULTIPLE_DATE_INQUIRIES",
      "weight": 25,
      "description": "같은 고객이 5회 이상 다른 날짜 물어봄",
      "action_if_triggered": "PROVIDE_BOOKING_FLEXIBILITY"
    },
    {
      "signal": "DEADLINE_PASSED_NO_ACTION",
      "weight": 35,
      "description": "긴박감 SMS 후 48시간 경과, 반응 없음",
      "action_if_triggered": "SEND_FINAL_OPPORTUNITY_SMS"
    }
  ],
  "intervention": {
    "score_gte": 55,
    "action": "OFFER_FLEXIBLE_REFUND",
    "message": "마음이 바뀌어도 100% 환불 가능 (심리적 진입장벽 제거)"
  }
}
```

### L7 Risk: 동반자 설득 실패
```json
{
  "risk_name": "L7_COMPANION_PERSUASION_FAILURE",
  "risk_signals": [
    {
      "signal": "SPOUSE_OBJECTION_MENTIONED",
      "weight": 25,
      "keywords": ["남편이 싫어해", "아내가 안 된대", "배우자가 관심"],
      "description": "배우자/동반자 반대 명시",
      "action_if_triggered": "SEND_COUPLE_BENEFIT_SMS"
    },
    {
      "signal": "CONSULTATION_WITH_FAMILY_NEEDED",
      "weight": 20,
      "keywords": ["가족이랑 상의", "남편한테 물어봐", "애기 아빠 의견"],
      "description": "의사결정 다른 사람에게 위임",
      "action_if_triggered": "OFFER_FAMILY_GROUP_PRESENTATION"
    },
    {
      "signal": "SECOND_CONTACT_NOT_RESPONSIVE",
      "weight": 30,
      "description": "배우자 포함 콜 스케줄링 후 불응",
      "action_if_triggered": "ESCALATE_TO_COUPLES_SPECIALIST"
    }
  ],
  "critical_action": {
    "score_gte": 60,
    "action": "INVITE_COUPLE_FOR_FREE_ONBOARD_TOUR",
    "message": "실제 배 둘러보기 (심리적 신뢰도 극대화)"
  }
}
```

### L10 Risk: 최종 결정 기한 초과
```json
{
  "risk_name": "L10_DECISION_DEADLINE_EXPIRED",
  "risk_signals": [
    {
      "signal": "NO_ACTION_AFTER_TRIPLE_CHOICE_SMS",
      "weight": 30,
      "description": "3중선택 SMS 48시간 이상 미응답",
      "action_if_triggered": "SEND_LIVE_SALES_SUPPORT_OFFER"
    },
    {
      "signal": "CHECKOUT_ABANDONED",
      "weight": 40,
      "description": "결제 페이지 진입 후 이탈 (cart abandonment)",
      "action_if_triggered": "TRIGGER_ABANDONED_CART_RECOVERY_SEQUENCE"
    },
    {
      "signal": "FINAL_OBJECTION_RAISED_LATE",
      "weight": 35,
      "keywords": ["마지막인데", "이거 확실한가", "환불되나"],
      "description": "결제 직전 새로운 이의 제기",
      "action_if_triggered": "IMMEDIATE_PHONE_CALL_WITH_GUARANTEE"
    }
  ],
  "last_resort_action": {
    "score_gte": 70,
    "action": "OFFER_MONEY_BACK_GUARANTEE",
    "message": "출발 1주일 전까지 100% 환불 가능 (최고의 신뢰 신호)"
  }
}
```

---

## 📊 Deal Risk Score 자동 계산 (Real-time)

```json
{
  "riskScoringEngine": {
    "trigger": "CONTINUOUS_MONITORING",
    "updateFrequency": "REAL_TIME",
    "baseScore": 0,
    "maxScore": 100,
    "riskFactors": [
      {
        "category": "BEHAVIORAL",
        "factors": [
          { "factor": "l0_no_response_3_sms", "points": 15 },
          { "factor": "l1_price_rejection_after_3x", "points": 20 },
          { "factor": "l2_repeated_prep_questions", "points": 20 },
          { "factor": "l6_indefinite_timing", "points": 20 },
          { "factor": "l7_spouse_objection", "points": 25 },
          { "factor": "l10_checkout_abandoned", "points": 40 }
        ]
      },
      {
        "category": "TEMPORAL",
        "factors": [
          { "factor": "days_in_pipeline_gte_30", "points": 10 },
          { "factor": "no_response_48h_after_urgent_sms", "points": 15 },
          { "factor": "missed_scheduled_call", "points": 20 }
        ]
      },
      {
        "category": "EXTERNAL",
        "factors": [
          { "factor": "competitor_product_purchased", "points": 30 },
          { "factor": "competitor_mentioned_in_call", "points": 15 },
          { "factor": "negative_review_google", "points": 20 }
        ]
      }
    ],
    "riskReductionFactors": [
      { "factor": "sms_clicked", "reduction": -5 },
      { "factor": "call_positive_sentiment", "reduction": -10 },
      { "factor": "positive_objection_resolution", "reduction": -15 },
      { "factor": "payment_attempt_made", "reduction": -20 }
    ]
  }
}
```

---

## 🎯 위험도별 자동 대응 (Automated Intervention)

### Score 40-60: WARNING (주의 단계)
```json
{
  "intervention": {
    "scoreRange": [40, 60],
    "actions": [
      {
        "type": "SEND_REASSURANCE_SMS",
        "template": "CONCERN_ACKNOWLEDGMENT_OFFER"
      },
      {
        "type": "ASSIGN_SALES_MANAGER_MONITORING",
        "frequency": "DAILY_CHECK"
      },
      {
        "type": "OFFER_EXTENDED_SUPPORT",
        "message": "모든 질문에 답변할 준비가 됐습니다"
      }
    ]
  }
}
```

### Score 61-80: CRITICAL (위기 단계)
```json
{
  "intervention": {
    "scoreRange": [61, 80],
    "actions": [
      {
        "type": "IMMEDIATE_PHONE_CALL",
        "delay": "within_1_hour",
        "assignedTo": "sales_closer_premium"
      },
      {
        "type": "ESCALATE_TO_MANAGER",
        "message": "고객 위기 상황, 개인화된 전략 필요"
      },
      {
        "type": "OFFER_SPECIAL_INCENTIVE",
        "options": ["추가할인", "업그레이드", "부대서비스"]
      }
    ]
  }
}
```

### Score 81-100: ABANDONED (포기 단계)
```json
{
  "intervention": {
    "scoreRange": [81, 100],
    "decision": "PAUSE_ACTIVE_OUTREACH",
    "actions": [
      {
        "type": "MARK_AS_NURTURE",
        "status": "LONG_TERM_NURTURE",
        "message": "3개월 후 재접근"
      },
      {
        "type": "ANALYZE_FAILURE_REASON",
        "analysis": "왜 실패했는가? (후속 개선)"
      }
    ]
  }
}
```

---

## 📈 위험도 대시보드 (Daily Risk Report)

```sql
-- Daily Deal Risk Distribution
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_contacts,
  SUM(CASE WHEN risk_score <= 20 THEN 1 ELSE 0 END) as safe_count,
  SUM(CASE WHEN risk_score BETWEEN 21 AND 40 THEN 1 ELSE 0 END) as warning_count,
  SUM(CASE WHEN risk_score BETWEEN 41 AND 60 THEN 1 ELSE 0 END) as alert_count,
  SUM(CASE WHEN risk_score BETWEEN 61 AND 80 THEN 1 ELSE 0 END) as critical_count,
  SUM(CASE WHEN risk_score >= 81 THEN 1 ELSE 0 END) as abandoned_count,
  ROUND(AVG(risk_score), 1) as avg_risk_score,
  SUM(CASE WHEN risk_intervention_triggered = 1 THEN 1 ELSE 0 END) as interventions_performed,
  SUM(CASE WHEN purchased = 1 AND risk_score_at_purchase >= 40 THEN 1 ELSE 0 END) as high_risk_conversions
FROM contacts
WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## 🔄 전체 Risk Scoring Workflow JSON

```json
{
  "workflowId": "DEAL_RISK_SCORING_MASTER",
  "name": "거래 위험도 자동 감지 및 개입",
  "enabled": true,
  "scoringEngine": "REAL_TIME",
  "risks": [
    {
      "riskId": "L0_REACTIVATION_FAILURE",
      "lensId": "L0",
      "maxPoints": 30
    },
    {
      "riskId": "L1_PRICE_OBJECTION_UNRESOLVED",
      "lensId": "L1",
      "maxPoints": 35
    },
    {
      "riskId": "L2_PREPARATION_ANXIETY",
      "lensId": "L2",
      "maxPoints": 25
    },
    {
      "riskId": "L6_TIMING_PROCRASTINATION",
      "lensId": "L6",
      "maxPoints": 35
    },
    {
      "riskId": "L7_COMPANION_FAILURE",
      "lensId": "L7",
      "maxPoints": 30
    },
    {
      "riskId": "L10_DECISION_EXPIRED",
      "lensId": "L10",
      "maxPoints": 40
    }
  ],
  "interventionRules": [
    {
      "scoreRange": [40, 60],
      "intervention": "MONITORING_AND_SUPPORT"
    },
    {
      "scoreRange": [61, 80],
      "intervention": "IMMEDIATE_ESCALATION"
    },
    {
      "scoreRange": [81, 100],
      "intervention": "PAUSE_NURTURE"
    }
  ]
}
```

---

## 🎯 체크리스트: Risk Scoring 구현

- [ ] 10렌즈별 위험 신호 DB 구축 (최소 30개 신호)
- [ ] Real-time Risk Score 계산 엔진
- [ ] 자동 위험도 레이블링 (🟢🟡🟠🔴⚫)
- [ ] Score 40이상: Sales Manager 자동 alert
- [ ] Score 61이상: 1시간 내 immediate call
- [ ] Score 81이상: 자동화 중단 + 재전략
- [ ] Daily Risk Dashboard (7일 추세)
- [ ] Risk → Conversion 분석 (위기 상황에서도 성약한 %?)
- [ ] Risk Reduction 액션 추적
- [ ] Monthly Risk Analysis Report

---

**파일 참고**: [[grant_cardone_deal_killer]] / [[psychology_theories_master]] / [[contact_auto_classification]]
