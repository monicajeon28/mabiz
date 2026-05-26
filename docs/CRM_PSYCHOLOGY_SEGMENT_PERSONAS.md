# CRM 심리학 세그먼트 페르소나 자동화 (2026-05-26)

## 📚 10렌즈 기반 세그먼트별 심리 페르소나 매핑

---

## 🎯 세그먼트 자동 분류 (AI 기반)

### Segmentation Logic (Contact 생성 시 자동 분석)
```json
{
  "segmentationEngine": "PSYCHOLOGY_PERSONA_CLASSIFIER",
  "triggers": ["NEW_CONTACT", "LANDING_PAGE_FORM", "CALL_INTAKE"],
  "analyzeFields": [
    "family_composition",
    "age_group",
    "cruise_experience",
    "budget_range",
    "travel_frequency",
    "call_transcript",
    "landing_page_behavior"
  ],
  "outputSegments": [
    "NEWLYWED_ADVENTURER",
    "FAMILY_QUALITY_TIME",
    "RETIREE_LEISURE",
    "BUDGET_CONSCIOUS_EXPERIENCE",
    "HEALTH_CONCERNED_SAFETY_FIRST"
  ]
}
```

---

## 🧑‍🤝‍🧑 세그먼트 1: 신혼부부 모험가 (Newlywed Adventurer)

### 페르소나
- **나이**: 25-35세
- **가족**: 부부만 (아이 없음)
- **특성**: 감정적, 경험 중심, SNS 활발
- **주요 불안**: 비용, 준비 복잡, 배우자 동의

### 심리 렌즈 매핑
| 렌즈 | 문제 | 심리학 기법 | SMS 주제 | 예상 효과 |
|------|------|-----------|---------|---------|
| L1 | "비싸잖아" | 분할결제 강조 | "월 33K, 신혼특가" | +25% 전환 |
| L2 | "준비가..." | 올인클루시브 | "짐만 싸면 끝" | +30% 전환 |
| L6 | "언제가 좋나" | 허니문시즌 | "신혼 적기는 지금!" | +35% 전환 |
| L7 | "배우자 동의" | 로맨스 강조 | "둘이 함께 만드는 추억" | +20% 전환 |
| L10 | "최종 결정" | 감정적 마무리 | "당신들의 시작입니다" | +70% 전환 |

### CRM Automation
```json
{
  "segmentId": "NEWLYWED_ADVENTURER",
  "detectionRules": {
    "age_range": [25, 35],
    "family_composition": "couple_only",
    "keywords": ["신혼", "둘이", "허니문", "로맨스"]
  },
  "smsTemplates": {
    "awareness": {
      "templateId": "NEWLYWED_ROMANTIC_PROBLEM",
      "message": "신혼부부만 느낄 수 있는 특별한 경험이 있어요 💕",
      "lenses": ["L6_romance", "L7_couple_bonding"]
    },
    "consideration": {
      "templateId": "NEWLYWED_ADVENTURE_DISCOVERY",
      "message": "세상에서 가장 로맨틱한 크루즈 여행 ✨",
      "lenses": ["L2_preparation_simple", "L3_differentiation"]
    },
    "decision": {
      "templateId": "NEWLYWED_MEMORY_CREATION",
      "message": "당신들의 첫 여행을 함께 만들어요",
      "lenses": ["L10_emotional_closing", "L6_timing"]
    }
  },
  "callScript": {
    "opening": "신혼부부분들이 가장 많이 선택하시는 크루즈가 있어요",
    "objectionHandling": {
      "L1_price": "신혼 특가로 50% 할인해드립니다",
      "L7_spouse": "둘이 함께 결정할 수 있게, 정보를 더 드릴게요"
    }
  },
  "expectedMetrics": {
    "conversion_rate": "50-65%",
    "average_purchase_value": "₩2.5M",
    "lensAppealRate": ["L10: 85%", "L6: 75%", "L7: 70%"]
  }
}
```

---

## 👨‍👩‍👧‍👦 세그먼트 2: 가족 품질시간 (Family Quality Time)

### 페르소나
- **나이**: 35-55세
- **가족**: 부부 + 아이 (1-2명)
- **특성**: 책임감 있음, 시간 부족, 가족 중심
- **주요 불안**: 시간 부족, 아이 적응, 건강 우려

### 심리 렌즈 매핑
| 렌즈 | 문제 | 심리학 기법 | SMS 주제 | 예상 효과 |
|------|------|-----------|---------|---------|
| L0 | "그동안 못 했다" | 손실회피 | "지금이 마지막 기회" | +30% 전환 |
| L2 | "준비가 복잡" | 스트레스 해소 | "준비 0시간, 즐거움 100%" | +40% 전환 |
| L5 | "우리 아이는?" | 자기투영 | "모든 연령 즐거운 활동" | +35% 전환 |
| L8 | "다시 가고 싶다" | 재구매 욕망 | "가족 습관 만들기" | +50% 전환 |
| L9 | "건강 걱정" | 신뢰 강화 | "의료시설 완비, 안심하세요" | +45% 전환 |

### CRM Automation
```json
{
  "segmentId": "FAMILY_QUALITY_TIME",
  "detectionRules": {
    "age_range": [35, 55],
    "family_composition": "couple_with_children",
    "keywords": ["아이", "가족", "아이들과", "아이 동반"]
  },
  "childrenAgeSegmentation": {
    "toddlers_0_5": {
      "mainConcerns": ["배멀미", "식사", "수면"],
      "lensMapping": ["L5_suitability", "L9_health", "L2_preparation"]
    },
    "kids_6_12": {
      "mainConcerns": ["활동 다양성", "친구 사귀기", "배움"],
      "lensMapping": ["L5_suitability", "L3_differentiation", "L8_habitual"]
    },
    "teens_13_plus": {
      "mainConcerns": ["독립성", "새로운 경험", "가족 시간"],
      "lensMapping": ["L7_companion", "L6_timing", "L8_memory"]
    }
  },
  "smsTemplates": {
    "pre_purchase": {
      "toddlers": "아기와 함께 안심하고 갈 수 있는 크루즈",
      "kids": "아이들이 하루종일 즐거운 활동",
      "teens": "가족이 함께할 마지막 시간들"
    }
  },
  "healthConcernHandling": {
    "trigger_keywords": ["배멀미", "약", "의료", "건강", "지병"],
    "response_template": "FAMILY_HEALTH_ASSURANCE",
    "message": "의료진 24시간 대기, 배멀미약 무료 제공"
  },
  "expectedMetrics": {
    "conversion_rate": "45-60%",
    "average_purchase_value": "₩2.2M (가족할인)",
    "repeat_purchase_rate": "50-65%"
  }
}
```

---

## 👴👵 세그먼트 3: 은퇴 여유생활 (Retiree Leisure)

### 페르소나
- **나이**: 55-75세
- **가족**: 부부, 종종 손자손녀 동반
- **특성**: 여유, 건강 관심, 경험 중심
- **주요 불안**: 건강 위험, 안전, 체력

### 심리 렌즈 매핑
| 렌즈 | 문제 | 심리학 기법 | SMS 주제 | 예상 효과 |
|------|------|-----------|---------|---------|
| L6 | "지금이 때" | 시간 소중함 | "남은 인생, 함께 보내세요" | +40% 전환 |
| L8 | "또 가고 싶다" | 추억 강화 | "매년 해야 할 일" | +55% 전환 |
| L9 | "건강 우려" | 의료신뢰 | "의료 24시간, 휠체어 배리어프리" | +50% 전환 |
| L0 | "이전에 좋았다" | 감정 재연결 | "그때의 즐거움 다시" | +45% 전환 |

### CRM Automation
```json
{
  "segmentId": "RETIREE_LEISURE",
  "detectionRules": {
    "age_range": [55, 75],
    "keywords": ["은퇴", "여유", "시간 많다", "할 일 많다"]
  },
  "healthConcernFocus": {
    "commonConcerns": [
      "관절염",
      "고혈압",
      "당뇨",
      "심장",
      "배멀미"
    ],
    "responseStrategy": {
      "trigger": "HEALTH_KEYWORD_DETECTED",
      "action": "SEND_L9_HEALTH_ASSURANCE_SMS",
      "message": "당신의 건강을 먼저 생각합니다. 의료진이 24시간 대기합니다."
    }
  },
  "accessibilityFeatures": {
    "highlight": [
      "엘리베이터 (계단 불필요)",
      "휠체어 배리어프리",
      "안마사 서비스",
      "의료시설",
      "약사 상담"
    ]
  },
  "smsTemplates": {
    "emotional": {
      "message": "남은 인생, 가장 소중한 사람과 가장 특별한 곳에서 보내세요 💕"
    },
    "health_assurance": {
      "message": "배멀미? 관절? 건강? 모두 우리가 해결합니다. 의료진 상시대기 🏥"
    },
    "repeat_purchase": {
      "message": "올해도 가실 건가요? 내년 같은 방으로 예약 완료했어요"
    }
  },
  "expectedMetrics": {
    "conversion_rate": "55-70%",
    "average_purchase_value": "₩2.4M",
    "repeat_purchase_rate": "60-75%",
    "nps_score": "85-95"
  }
}
```

---

## 💰 세그먼트 4: 예산 의식 경험추구 (Budget-Conscious Experiencer)

### 페르소나
- **나이**: 25-65세 (전체)
- **특성**: 가성비 중심, 비용 세심, 계획적
- **주요 불안**: 가격, 숨은 비용, 환불

### 심리 렌즈 매핑
| 렌즈 | 문제 | 심리학 기법 | SMS 주제 | 예상 효과 |
|------|------|-----------|---------|---------|
| L1 | "비싼데" | 가성비 증명 | "일반여행 vs 크루즈 비용 비교" | +45% 전환 |
| L4 | "약정 부담" | 자유도 강조 | "원할 때만, 멈출 수 있다" | +40% 전환 |
| L6 | "가격 변동" | 최저가 보장 | "지금이 최저가, 내일부터 인상" | +50% 전환 |

### CRM Automation
```json
{
  "segmentId": "BUDGET_CONSCIOUS",
  "detectionRules": {
    "behaviors": [
      "price_calculator_used",
      "multiple_option_comparison",
      "long_consideration_period"
    ],
    "keywords": ["비싸", "비용", "가성비", "할인", "비교"]
  },
  "pricingStrategy": {
    "transparencyFirst": true,
    "breakdownCosts": {
      "membershipFee": "월 33,000원 (멤버비)",
      "productPrice": "별도 (상품비)",
      "inclusives": ["비행기", "호텔", "식사", "엔터", "수영장"]
    },
    "priceComparison": {
      "show_vs": "일반여행",
      "message": "크루즈 ₩2.2M (올인클) > 일반여행 ₩2.5M (분산)"
    }
  },
  "smsTemplates": {
    "value_proof": {
      "message": "당신 같은 분들이 선택하는 이유: 월 33K만 들고 ₩3M 가치 경험 📊"
    },
    "no_hidden_cost": {
      "message": "숨은 비용 0원. 모든 게 처음부터 명시돼 있어요. 투명합니다."
    }
  },
  "expectedMetrics": {
    "conversion_rate": "40-55%",
    "average_purchase_value": "₩1.8M-2.2M",
    "objection_resolution_rate": "75-85%"
  }
}
```

---

## 🏥 세그먼트 5: 건강 우려 안전 최우선 (Health-Concerned Safety-First)

### 페르소나
- **나이**: 40-75세 (특히 기저질환 있는 분)
- **특성**: 신중, 정보 요청 많음, 신뢰 중심
- **주요 불안**: 배멀미, 지병 악화, 응급상황, 약물 호환성

### 심리 렌즈 매핑
| 렌즈 | 문제 | 심리학 기법 | SMS 주제 | 예상 효과 |
|------|------|-----------|---------|---------|
| L9 | "배멀미가..." | 의료신뢰 | "배멀미약 무료, 의료진 24h" | +60% 전환 |
| L5 | "나한테 맞나" | 자기투영 | "당신 같은 분들도 잘 다녀갑니다" | +50% 전환 |

### CRM Automation
```json
{
  "segmentId": "HEALTH_CONCERNED",
  "detectionRules": {
    "keywords": [
      "배멀미",
      "약",
      "의료",
      "건강",
      "지병",
      "고혈압",
      "당뇨",
      "관절",
      "척추"
    ]
  },
  "healthConcernDatabase": {
    "seasickness": {
      "concern": "배멀미",
      "response": "배멀미약 무료 제공, 예방약 4가지 선택",
      "reassurance": "8000명 중 98%가 배멀미 없음"
    },
    "high_blood_pressure": {
      "concern": "고혈압",
      "response": "의료진 상시 모니터링, 혈압계 무료 제공",
      "reassurance": "고혈압 있는 고객 많음, 안전해요"
    },
    "diabetes": {
      "concern": "당뇨",
      "response": "당뇨식 24시간 제공, 영양사 상담",
      "reassurance": "당뇨 고객 전담 스태프 있음"
    }
  },
  "smsFlow": {
    "health_keyword_detected": {
      "immediate": "당신의 건강 우려, 완벽히 해결합니다. 어떤 문제인가요? 1) 배멀미 2) 약물 3) 지병 4) 기타"
    },
    "post_selection": {
      "seamless_flow": "선택지에 따른 맞춤 안심 메시지"
    }
  },
  "expectedMetrics": {
    "health_concern_resolution_rate": "85-95%",
    "conversion_rate": "50-70%",
    "nps_score": "88-95",
    "testimonial_collection_rate": "80%"
  }
}
```

---

## 📊 세그먼트별 렌즈 효과도 (Impact Matrix)

```
                L0   L1   L2   L3   L4   L5   L6   L7   L8   L9
NEWLYWED       [  ] [■■] [■■■][■  ] [  ] [■  ] [■■■][■■■][■  ] [■  ]
FAMILY         [■■] [■■] [■■■][■■ ] [■  ] [■■■][■■ ] [■■ ] [■■■][■■■]
RETIREE        [■■■][  ] [■  ] [■  ] [  ] [■  ] [■■■][  ] [■■■][■■■]
BUDGET         [■  ] [■■■][■■ ] [■■ ] [■■■][  ] [■■ ] [  ] [■  ] [  ]
HEALTH         [■  ] [■  ] [■■ ] [■  ] [■  ] [■■■][■  ] [  ] [■  ] [■■■]

범례: ■ = 효과 약, ■■ = 효과 중, ■■■ = 효과 강
```

---

## 🔄 세그먼트 자동 재분류 (Dynamic Segmentation)

```json
{
  "dynamicSegmentation": {
    "trigger": "CONTINUOUS_MONITORING",
    "frequency": "REAL_TIME",
    "rules": [
      {
        "signal": "health_concern_mentioned",
        "then": "ADD_SEGMENT_HEALTH_CONCERNED"
      },
      {
        "signal": "price_comparison_multiple_times",
        "then": "ADD_SEGMENT_BUDGET_CONSCIOUS"
      },
      {
        "signal": "family_with_kids_signal",
        "then": "REPLACE_SEGMENT_FAMILY_QUALITY_TIME"
      },
      {
        "signal": "age_detected_over_60",
        "then": "ADD_SEGMENT_RETIREE"
      }
    ]
  }
}
```

---

## 🎯 체크리스트: 세그먼트 페르소나 구현

- [ ] 5가지 세그먼트별 CRM classification 필드 정의
- [ ] AI 분류 모델 학습 데이터 수집 (500+ 예시)
- [ ] 각 세그먼트별 SMS 템플릿 20개 이상 작성
- [ ] 세그먼트별 렌즈 매핑 매트릭스 구현
- [ ] 건강 우려 DB 및 자동 응답 로직
- [ ] 세그먼트별 콜 스크립트 5가지 이상
- [ ] Dynamic Segmentation 자동 업데이트 로직
- [ ] 세그먼트별 KPI 대시보드
- [ ] 세그먼트별 A/B 테스트 프레임워크
- [ ] 월별 세그먼트 분포 리포팅

---

**파일 참고**: [[psychology_theories_master]] / [[l5_suitability_self_projection]] / [[l9_health_safety_medical_trust]]
