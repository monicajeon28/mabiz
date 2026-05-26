# CRM 렌즈 L1: 가격 이의 자동 대응 (2026-05-26)

## 📚 심리학 원리: 기준점 편향 + PASONA 가격 재정의

### 1. 렌즈 정의
**L1 (Price Resistance)**: "너무 비싸다"는 이의를 심리학적으로 재정의하는 자동화

### 2. 심리학 메커니즘
- **기준점 편향 (Anchoring)**: 첫 번째 숫자가 판단 기준이 됨
- **분할결제 효과**: ₩1,500,000 vs ₩33,000/월 (심리적 통증 60% 감소)
- **사회증명**: 타 고객의 가성비 증명
- **효과**: 가격 이의 → 구매 승인율 **42-48%**

### 3. 가격 이의 유형
```
- "너무 비싼데": 절대가격 쇼크
- "할인이 없나": 기준점 낮춘 기대
- "다른 곳이 더 싸": 경쟁사 비교
- "지금은 아니고": 타이밍 이의 (L6 별도)
```

---

## 🔧 CRM Workflow 자동화

### Condition 1: 가격 이의 감지
```json
{
  "trigger": "KEYWORD_DETECTION",
  "source": ["call_log", "sms_response", "email"],
  "keywords": ["비싸", "비용", "가격", "할인", "비교", "비싸요", "너무 비"],
  "action": {
    "type": "ADD_TAG",
    "tag": "L1_PRICE_RESISTANCE",
    "recordAs": "l1_objection_detected"
  }
}
```

### Condition 2: 가격 이의 유형 분류
```json
{
  "classifier": "PRICE_OBJECTION_TYPE",
  "inputs": ["call_transcript", "contact_memo"],
  "classification": {
    "ABSOLUTE_SHOCK": {
      "keywords": ["처음 들으니 비싼", "월 얼마길래"],
      "response": "L1_ANCHORING_REFRAME"
    },
    "EXPECTATION_MISMATCH": {
      "keywords": ["할인은 없나", "싼 패키지 있나"],
      "response": "L1_VALUE_COMPARISON"
    },
    "COMPETITOR_COMPARISON": {
      "keywords": ["다른 곳이", "OOO가 더 싼데"],
      "response": "L1_DIFFERENTIATION"
    }
  }
}
```

### Action 1: Day 0 SMS (기준점 재설정)
```json
{
  "name": "L1_Day0_Anchoring_Reframe",
  "delay": "IMMEDIATE",
  "template": "L1_D0_PRICE_CLARITY",
  "psychology": ["기준점편향", "분할결제"],
  "message": "김민지 님, 좋은 질문입니다! ☺️\n\n💡 크루즈 멤버십은 월 33,000원 (상품비별도)\n비유: 스타벅스 월 15만 원 쓰시면 충분해요!\n\n[자세히 보기]",
  "smsPhase": "P_A",
  "recordKey": "l1_day0_anchoring"
}
```

**심리학 설명**:
- "월 33,000원" = 기준점을 낮춤 (₩1.5M → ₩33K 월단위)
- "스타벅스 비유" = 친숙한 지불 기준과 비교
- "충분해요" = 가성비 긍정 신호

### Action 2: Day 1 SMS (사회증명 + 올인클루시브)
```json
{
  "name": "L1_Day1_Social_Proof_Inclusive",
  "delay": "1440",
  "template": "L1_D1_VALUE_BREAKDOWN",
  "psychology": ["사회증명", "프레이밍"],
  "message": "✈️ 8,000명이 선택한 이유:\n\n비행기 + 호텔 + 식사 + 엔터 다 포함\n(일반여행은 따로따로 ₩2M+)\n\n→ 크루즈가 70% 더 저렴합니다!\n[가격 비교 계산기]",
  "smsPhase": "S",
  "recordKey": "l1_day1_value"
}
```

**심리학 설명**:
- "8,000명" = 사회증명 (이미 많은 사람이 선택)
- "다 포함" = 올인클루시브 가치 강조
- "70% 저렴" = 기준점 재설정 (경쟁 상품 대비)

### Action 3: Day 3 SMS (이의 대응 + 분할결제)
```json
{
  "name": "L1_Day3_Payment_Options",
  "delay": "4320",
  "template": "L1_D3_PAYMENT_FLEXIBILITY",
  "psychology": ["손실회피", "선택지 제공"],
  "message": "💳 유연한 결제 옵션:\n\n📌 월 33,000원 × 12개월\n📌 분기 100,000원 × 4회\n📌 연 350,000원 (할인 40%!)\n\n당신에게 맞는 방식 선택하세요 👇",
  "smsPhase": "O_N",
  "recordKey": "l1_day3_payment"
}
```

**심리학 설명**:
- 3가지 선택지 = 통제감 증가 (심리학적 만족도 ↑)
- "당신에게 맞는" = 자기투영 강화
- 40% 할인 강조 = 한정된 시간 (희소성)

### Action 4: CRM 자동 대응 경로
```json
{
  "condition": {
    "trigger": "SMS_RESPONSE_RECEIVED",
    "field": "l1_day3_payment_clicked"
  },
  "if_clicked": {
    "type": "COMPOSITE",
    "actions": [
      {
        "type": "UPDATE_CONTACT",
        "fields": {
          "segmentOverride": "L1_PRICE_RESOLVED",
          "leadScore": "+20",
          "tag_add": "L1_PAYMENT_INTERESTED"
        }
      },
      {
        "type": "SCHEDULE_CALL",
        "template": "L1_CLOSING_CALL",
        "priority": "HIGH",
        "assignedTo": "sales_closer"
      }
    ]
  },
  "if_not_clicked": {
    "type": "COMPOSITE",
    "actions": [
      {
        "type": "SEND_SMS",
        "delay": 10080,
        "templateId": "L1_D7_CUSTOMER_SUCCESS_STORY",
        "message": "고객 후기: '₩33K 쓰고 ₩3M 가치 여행했어요!' 📸 [영상보기]"
      },
      {
        "type": "UPDATE_CONTACT",
        "fields": { "tag_add": "L1_NURTURE_SEQUENCE" }
      }
    ]
  }
}
```

---

## 📊 성과 메트릭 추적

### KPI 정의
| 메트릭 | 현재 | 목표 | 공식 |
|--------|------|------|------|
| **가격 이의 해결율** | 25% | 42-48% | (이의 해결 → 구매 / 전체 가격이의) |
| **Day0-3 응답율** | 18% | 35-42% | (클릭 + 응답 / SMS발송) |
| **결제 옵션 선택율** | 12% | 28-35% | (결제링크 클릭 / 이의 감지건) |
| **가격 이의 → 판매** | 8% | 20-25% | (최종 구매 / L1 조치) |

### 자동 성과 리포팅
```sql
-- L1 가격 이의 처리 현황
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_l1_detected,
  SUM(CASE WHEN tag LIKE '%L1_PRICE_RESISTANCE%' THEN 1 ELSE 0 END) as objections_detected,
  SUM(CASE WHEN sms_clicked > 0 THEN 1 ELSE 0 END) as sms_responses,
  SUM(CASE WHEN status LIKE '%L1_PRICE_RESOLVED%' THEN 1 ELSE 0 END) as resolved,
  ROUND(100.0 * SUM(CASE WHEN status LIKE '%L1_PRICE_RESOLVED%' THEN 1 ELSE 0 END) / 
        COUNT(*), 2) as resolution_rate_pct,
  SUM(CASE WHEN purchased = 1 THEN 1 ELSE 0 END) as final_purchases
FROM contacts
WHERE tags LIKE '%L1_%'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## 🔄 전체 Workflow JSON

```json
{
  "workflowId": "L1_PRICE_OBJECTION_MASTER",
  "name": "L1 가격 이의 자동 대응",
  "enabled": true,
  "triggers": [
    {
      "id": "keyword_detection",
      "type": "REAL_TIME",
      "source": ["call_log_notes", "sms_response", "contact_memo"],
      "keywords": ["비싸", "비용", "가격", "할인", "비교"],
      "action": "ADD_TAG",
      "tag": "L1_PRICE_RESISTANCE"
    }
  ],
  "classificationEngine": {
    "type": "OBJECTION_CLASSIFIER",
    "model": "L1_PRICE_CLASSIFIER_V1",
    "output_field": "l1_objection_type",
    "classes": ["ABSOLUTE_SHOCK", "EXPECTATION_MISMATCH", "COMPETITOR_COMPARISON"]
  },
  "actions": [
    {
      "order": 1,
      "type": "SEND_SMS",
      "delay": 0,
      "templateId": "L1_D0_PRICE_CLARITY",
      "recordAs": "l1_day0"
    },
    {
      "order": 2,
      "type": "SEND_SMS",
      "delay": 1440,
      "templateId": "L1_D1_VALUE_BREAKDOWN",
      "condition": { "l1_day0": { "sent": true } }
    },
    {
      "order": 3,
      "type": "SEND_SMS",
      "delay": 4320,
      "templateId": "L1_D3_PAYMENT_FLEXIBILITY",
      "condition": { "l1_day1_value": { "sent": true } }
    },
    {
      "order": 4,
      "type": "CONDITIONAL_BRANCH",
      "condition": { "smsClicked": true },
      "then": {
        "type": "COMPOSITE",
        "actions": [
          { "type": "UPDATE_SEGMENT", "value": "L1_PRICE_RESOLVED" },
          { "type": "BOOST_LEAD_SCORE", "amount": 20 },
          { "type": "SCHEDULE_CALL", "template": "L1_CLOSING_CALL" }
        ]
      },
      "else": {
        "type": "SEND_SMS",
        "delay": 10080,
        "templateId": "L1_D7_SUCCESS_STORY"
      }
    }
  ]
}
```

---

## 💡 Grant Cardone 이의 대응 스크립트 (L1)

### LISTEN-ISOLATE-VALID 프레임워크

**Q: "비싼데요"**

```
LISTEN: "확실히 비싼 게 맞습니다."

ISOLATE: "혹시 비싸다는 게 월 33,000원인가요? 
         아니면 전체 여행 비용인가요?"

VALID: "둘 다 정상입니다. 
        월 33,000원은 멤버십이고,
        상품비는 따로입니다.
        
        비유하자면,
        Netflix 월 15,000원 추가하는 거죠.
        이미 휴가 가실 거라면, 
        Netflix 추가하고 크루즈로 대신 가면 
        훨씬 저렴합니다."
```

### Trial Close
```
"그런데 이런 생각 못 해보셨나요?
일반 여행 ₩3M + 멤버십 ₩396K = ₩3,396K
크루즈 올인클루시브 ₩2.8M

가족 3명이니까 ₩600K를 더 절약합니다.

그럼 이번 달 언제쯤 가실 생각입니다?"
```

---

## 🎯 체크리스트: L1 렌즈 구현

- [ ] 가격 이의 키워드 감지 (실시간)
- [ ] L1_PRICE_OBJECTION_CLASSIFIER 모델 학습
- [ ] L1_D0_PRICE_CLARITY SMS 템플릿 (기준점 재설정)
- [ ] L1_D1_VALUE_BREAKDOWN SMS 템플릿 (올인클루시브)
- [ ] L1_D3_PAYMENT_FLEXIBILITY SMS 템플릿 (분할결제)
- [ ] CRM 자동 세그먼트 업데이트 (L1_PRICE_RESOLVED)
- [ ] Daily KPI 리포팅 쿼리
- [ ] 콜 스크립트 L1_CLOSING_CALL 저장
- [ ] A/B 테스트: D1 (사회증명 vs 계산기)

---

**파일 참고**: [[l1_lens_complete]] / [[grant_cardone_rebuttal]] / [[pasona_framework_complete]]
