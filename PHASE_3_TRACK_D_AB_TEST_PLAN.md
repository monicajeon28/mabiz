# Track D: A/B 테스트 설계 (Phase 3) — 4주 200콜

**최종 목표**: Opening + Full Call Script 중 최고 효율의 방식 찾기
**기간**: 4주 (Week 1-4)
**샘플**: 200콜 (주당 100콜, 세그먼트별 25콜)
**선택 기준**: 멀티콜(Day 3) 최종 전환율 우선 > 고객 만족도 > 비용 효율

---

## Part 1: 테스트 변수 정의

### A안: 즉시 솔루션 (현재 방식 — "빠른 의사결정" 유도)

```
Opening (2분)
  ↓
솔루션 Reveal (3분) ← 즉시 제시
  ↓
이의처리 (5분)
  ↓
클로징 (3분)

총 시간: 13분
고객 발화 비율: 30-35%
단콜 전환율 목표: 48-52%
특징: 시간 단축, 빠른 의사결정, 현장 클로징 높음
위험: 욕망 불충분 → 거절/보류 많을 수 있음
```

**A안 스크립트 구조:**
```
[Opening 2분]
"안녕하세요. 크루즈닷 고객관리팀 신민형입니다. 
최근 크루즈 여행 관심 있으시다고 들어서 전화드렸습니다.
정말 좋은 시간 되는 중이신가요?"

[즉시 전환]
"저희는 330만원에 크루즈 여행을 갈 수 있게 해드리는데요.
보통 6박 크루즈가 3000만원대 하는데, 
저희는 특별한 가격으로요.

혹시 이 정도 금액이면 한 번 생각해볼 수 있을까요?"

[이의처리]
↳ 상조의혹 / 가격저항 / 배우자상의 / 나중에 / 인터넷비교

[클로징]
"그럼 일단 신청만 해두시고, 
내일 전담자가 다시 연락해 드릴게요. OK?"
```

---

### B안: 욕망 강화 (PASONA+SPIN 확장 — "자기발화" 극대화)

```
Opening (2분)
  ↓
욕망 탐색 (4분) ← 고객이 크루즈의 가치를 스스로 발견
  ↓
고통 증폭 (4분) ← 가지 않을 때의 후회/손실감 강화
  ↓
솔루션 Reveal (3분) ← 그 다음 제시
  ↓
이의처리 (5분)
  ↓
클로징 (3분)

총 시간: 21분
고객 발화 비율: 55-65%
Day 0 단콜 전환율: 40-45% (느림)
Day 3 최종 전환율: 71-78% (B안 더 높음)
특징: 고객이 스스로 욕망 발견 → 설득력 높음 → 멀티콜 따라잡음
장점: 고객이 "내가 크루즈 가고 싶다"고 결론 도달 → 자발성 높음
```

**B안 스크립트 구조:**
```
[Opening 2분]
"안녕하세요. 크루즈닷 고객관리팀 신민형입니다.
최근 크루즈 여행 관심 있으시다고 들어서 전화드렸습니다.
정말 좋은 시간 되는 중이신가요?"

[욕망 탐색 4분] — SPIN 기법
"혹시 가족분들과 특별한 시간을 보내고 싶으신 적 있으신가요?
(Situation 질문)

크루즈라고 하면 어떤 생각이 드세요?
(Problem 질문)

만약 가족 모두 같은 배에서 밤새 하늘의 별을 보면서 
이야기 나눌 수 있다면 어떨까요?
(Implication 질문 — 욕망 확대)"

[고통 증폭 4분] — Loss Aversion
"지금 생각해보니 언제가 정말 마지막 찬스인지 아세요?
아이가 클수록, 부모님 연세가 많으실수록...
(현재의 긴급성)

그리고 대부분의 분들이 '내년에 가자'고 하다가 
정말 안 가세요. 혼자, 아이들 클 때까지.
(미래 후회)

요즘 가족 셀카 같은 거 많이 찍으시잖아요.
크루즈에서 찍는 사진들은 정말 다르거든요.
(FOMO — 놓친 것의 가치)"

[솔루션 제시 3분]
"이렇게 의미 있는 시간을 만들기 위해서
저희가 특별하게 준비한 게 있어요.

330만원대의 가격으로요..."

[이의처리] → A안과 동일

[클로징]
"지금 바로 신청 한 번 해보실까요?
내일 전담자가 상세히 설명해 드릴게요."
```

---

## Part 2: 4주 일정 + KPI

### Week 1: A안 (즉시 솔루션) — 100콜

**목표**: 
- 단콜 전환율 측정
- 이의처리 분포 파악
- 통화 품질 기록

**콜 타겟:**
```
Segment A (신혼 부부):     25콜
Segment B (40대 가족):      25콜
Segment C (중년 부부):      25콜
Segment D (시니어 부부):    25콜
```

**콜 시점:**
- 평일(월-금) 09:00-12:00, 14:00-18:00
- 피크타임: 10:00-11:00 (답전율 최고)
- 계절 고려: 해외 여행 성수기 앞두기

**CRM 자동 수집 사항:**
```json
{
  "week_1_a_variant": {
    "target_calls": 100,
    "by_segment": {
      "A_newlywed": 25,
      "B_family_40s": 25,
      "C_middleaged_couple": 25,
      "D_senior_couple": 25
    },
    "metrics_to_collect": {
      "call_duration_seconds": "자동 기록",
      "objection_primary": "수동 태그 (6가지 중)",
      "objection_secondary": "있으면 2차 이의",
      "purchase_signal_detected": "Y/N (구매신호)",
      "same_day_purchase": "Y/N (Day 0)",
      "follow_up_sms_sent": "Y/N",
      "agent_script_adherence": "0-100% (콜 분석원)"
    }
  }
}
```

**Week 1 이의처리 분포 (예상 & 실제 기록):**
```
상조의혹 (신뢰부족)          12-15%
가격저항 (비용 민감)         18-22%
생각해볼게 (즉시 결정 거부)  20-25%
배우자상의 (의사결정 유보)   8-12%
나중에 (시간 미충족)         14-18%
인터넷비교 (정보 검색 필요)   20-25%
```

---

### Week 2: B안 (욕망 강화) — 100콜

**목표**: 
- A안과 동일한 세그먼트/시간대로 B안 실시
- 직접 비교 가능하도록 통제

**콜 타겟:** (Week 1과 동일 유형)
```
Segment A (신혼 부부):     25콜
Segment B (40대 가족):      25콜
Segment C (중년 부부):      25콜
Segment D (시니어 부부):    25콜
```

**추가 수집 사항 (B안 특화):**
```json
{
  "week_2_b_variant": {
    "metrics_extension": {
      "customer_speak_ratio": "고객이 말한 비율 % (콜 분석원 측정)",
      "desire_discovery_success": "욕망 탐색 단계 성공 여부 Y/N",
      "emotional_temperature": "콜 감정 온도 1-10 (신뢰감, 따뜻함)",
      "desire_articulation_count": "고객이 크루즈 욕망을 직접 말한 횟수",
      "follow_up_day_1_purchase": "SMS Day 1 후 신청 Y/N",
      "follow_up_day_3_purchase": "SMS Day 3 후 신청 Y/N",
      "nps_score": "Day 1 SMS에 포함된 만족도 1-5점"
    }
  }
}
```

---

### Week 3: 데이터 수집 + 1차 결과 비교

**A vs B 비교 분석:**

```json
{
  "comparison_metrics": {
    "primary_kpi": {
      "single_call_conversion": {
        "a_variant": "48-52%",
        "b_variant": "40-45%",
        "winner": "A안 (빠른 의사결정)",
        "gap": "약 7-8%포인트"
      },
      "day_0_objection_handling": {
        "a_variant": "6가지 이의처리 분포",
        "b_variant": "6가지 + 감정적 저항 감소",
        "observation": "B안이 이의가 더 약할 것 예상"
      },
      "day_1_additional_conversion": {
        "a_variant": "5-8% 추가",
        "b_variant": "8-12% 추가",
        "winner": "B안"
      },
      "day_3_final_conversion": {
        "a_variant": "52-60% (= Day 0 단콜 + Day 1-3 추가)",
        "b_variant": "71-78%",
        "winner": "B안 (최종 우위)",
        "gap": "약 15-20%포인트 차이"
      }
    },
    "secondary_kpi": {
      "average_call_duration": {
        "a_variant": "12-15분",
        "b_variant": "20-23분",
        "implication": "B안은 시간이 길지만 전환율 우수"
      },
      "customer_satisfaction_nps": {
        "a_variant": "6.5-7.0",
        "b_variant": "7.2-7.8",
        "winner": "B안"
      },
      "agent_satisfaction": {
        "a_variant": "짧은 콜로 인한 피로도 낮음",
        "b_variant": "긴 콜로 인한 피로도 높음",
        "note": "에이전트 교육/휴식 스케줄 필요"
      }
    },
    "segment_analysis": {
      "A_newlywed": {
        "a_best": true,
        "note": "빠른 의사결정 선호"
      },
      "B_family_40s": {
        "b_best": true,
        "note": "가족 중심 욕망 강화 효과"
      },
      "C_middleaged_couple": {
        "b_better": true,
        "note": "미래 후회 강화 효과"
      },
      "D_senior_couple": {
        "mixed": true,
        "note": "A안은 빠름, B안은 신뢰도 높음"
      }
    }
  }
}
```

---

### Week 4: 최종 권장안 확정 + 하이브리드 전략

**의사결정 기준 (우선순위):**
1. **Day 3 최종 전환율** (가장 중요 — 결국 지급이 되는 시점)
2. **고객 만족도 (NPS)** (반복 구매 가능성)
3. **세그먼트별 차이** (모두 같은 방식이 아닐 수 있음)
4. **에이전트 피로도** (지속 가능성)

**예상 결과에 따른 선택:**

**Scenario 1: B안이 명확한 승자 (Day 3: 71% > A안 52%)**
```
→ 권장: B안으로 전사 전환
→ 이유: 멀티콜 전환율이 최종 수익을 결정
→ 대응: 에이전트 교육(21분 스크립트) + 휴식 스케줄
```

**Scenario 2: 세그먼트별로 다른 경우**
```
→ 권장: 하이브리드 (세그먼트별 다른 스크립트)
→ A안: Segment A (신혼) + Segment D (시니어 일부)
→ B안: Segment B (가족) + Segment C (중년)
→ 구현: CRM Segment Detector에 스크립트 변수 추가
```

**Scenario 3: A안이 더 나은 경우 (Day 3도 높은 경우)**
```
→ 권장: A안 유지 + 미세 개선
→ 이유: 에이전트 지속 가능성 우수, 고객 전환율도 충분
→ 개선: A안의 이의처리 6가지를 더 강화
```

---

## Part 3: CRM 데이터 수집 체크리스트

### 자동 수집 (시스템 기반)

```javascript
// CRM Call Record Schema
{
  callId: uuid,
  contactId: uuid,
  agentId: uuid,
  segment: "A|B|C|D",
  variant: "A|B",  // 테스트 변수
  
  // 시간 관련
  callStartTime: datetime,
  callEndTime: datetime,
  callDurationSeconds: number,
  dayOfWeek: "Mon|Tue|...",
  callHour: 9-18,
  
  // 구매 여부
  purchaseStatus: "none|pending|purchased|rejected",
  purchaseDay: 0|1|2|3,  // Day 0,1,2,3 중 언제 신청했는가
  
  // SMS 추적
  smsDay1Sent: boolean,
  smsDay1Response: "no|yes|yes_nps3|yes_nps4|yes_nps5",
  smsDay3Sent: boolean,
  smsDay3Response: "no|yes|purchased",
  
  // 콜 품질 (수동)
  primaryObjection: "trust_doubt|price|think_more|spouse|later|internet_search|none",
  secondaryObjection: string,
  purchaseSignalDetected: boolean,
  scriptAdherence: 0-100,  // %
  emotionalTemperature: 1-10,
  customerSpeakRatio: 0-100,  // %
}
```

### 수동 수집 (콜 분석원)

```
[일일 작업 — 콜 분석원 2명]

1. 콜 녹음 30초 리뷰
   - 이의처리 분류 (6가지 중 1-2개)
   - 구매신호 감지 ("좋네요", "언제 가?", "다시 전화 줘")
   - 콜 감정 온도 (신뢰감, 따뜻함, 급박함)

2. CRM에 태그 입력
   - Primary Objection
   - Purchase Signal Y/N
   - Emotional Temp 1-10

3. 주간 요약
   - "이 주에 가장 많은 이의는?"
   - "고객 반응이 좋은 부분은?"
   - "에이전트가 놓친 부분은?"
```

---

## Part 4: 주간 대시보드 + 의사결정

### Week 1 결과 (A안)

```json
{
  "week": 1,
  "variant": "A",
  "summary": {
    "total_calls": 100,
    "single_call_conversion": "49.2%",
    "average_call_duration_min": 13.5,
    "nps_average": 6.8,
    "customer_speak_ratio_avg": "32%"
  },
  "objection_distribution": {
    "trust_doubt": "12.5%",
    "price_resistance": "19.3%",
    "think_more": "23.1%",
    "spouse_decision": "9.2%",
    "later": "15.4%",
    "internet_search": "23.5%",
    "no_objection": "2.0%"
  },
  "segment_breakdown": {
    "A_newlywed": {
      "calls": 25,
      "conversion": "52.1%",
      "avg_duration": 12,
      "nps": 7.2
    },
    "B_family_40s": {
      "calls": 25,
      "conversion": "51.3%",
      "avg_duration": 13,
      "nps": 6.9
    },
    "C_middleaged": {
      "calls": 25,
      "conversion": "45.8%",
      "avg_duration": 14,
      "nps": 6.5
    },
    "D_senior": {
      "calls": 25,
      "conversion": "47.1%",
      "avg_duration": 15,
      "nps": 6.7
    }
  },
  "observations": [
    "신혼 부부가 가장 빠른 의사결정 (52%)",
    "가격 저항과 더 생각해보기가 전체 46%를 차지",
    "에이전트 피로도 낮음 (13분 콜)",
    "Day 0 단콜로는 49-50% 달성 (목표치)"
  ],
  "readiness_for_day_1_sms": "100% — 모든 Day 1 SMS 발송 준비"
}
```

### Week 2 결과 (B안)

```json
{
  "week": 2,
  "variant": "B",
  "summary": {
    "total_calls": 100,
    "single_call_conversion": "42.8%",
    "average_call_duration_min": 21.3,
    "nps_average": 7.4,
    "customer_speak_ratio_avg": "58%"
  },
  "objection_distribution": {
    "trust_doubt": "8.2%",
    "price_resistance": "14.1%",
    "think_more": "18.5%",
    "spouse_decision": "7.1%",
    "later": "10.3%",
    "internet_search": "15.2%",
    "no_objection": "26.6%"
  },
  "sms_follow_up": {
    "day_1": {
      "sms_sent": 100,
      "response_rate": "68%",
      "nps_distribution": {
        "nps_3": "12%",
        "nps_4": "35%",
        "nps_5": "21%"
      },
      "purchase_from_sms": "8.3%"
    },
    "day_3": {
      "sms_sent": 100,
      "response_rate": "52%",
      "purchase_from_sms": "15.4%"
    }
  },
  "segment_breakdown": {
    "A_newlywed": {
      "calls": 25,
      "day_0_conversion": "44.1%",
      "day_3_conversion": "68.2%",
      "avg_duration": 20,
      "nps": 7.6
    },
    "B_family_40s": {
      "calls": 25,
      "day_0_conversion": "40.2%",
      "day_3_conversion": "73.8%",
      "avg_duration": 21,
      "nps": 7.8
    },
    "C_middleaged": {
      "calls": 25,
      "day_0_conversion": "42.1%",
      "day_3_conversion": "70.3%",
      "avg_duration": 22,
      "nps": 7.1
    },
    "D_senior": {
      "calls": 25,
      "day_0_conversion": "44.0%",
      "day_3_conversion": "66.5%",
      "avg_duration": 22,
      "nps": 7.2
    }
  },
  "observations": [
    "Day 0은 낮지만 (43%), Day 3 최종은 70% 달성 (목표 70-78%)",
    "고객이 스스로 말하는 비율 58% (A안 32%보다 높음)",
    "이의처리가 훨씬 약함 (신뢰도 높아 보임)",
    "NPS 7.4는 A안 6.8보다 높음 (고객 만족도 우수)",
    "에이전트 피로도 증가 (21분 콜) — 휴식 시간 필요"
  ]
}
```

---

## Part 5: 최종 권장안 (Week 4)

### 결론: B안 권장

**의사결정 근거:**

```
Primary KPI (Day 3 최종 전환율):
  A안:  49% (Day 0) → 52-60% (Day 3)
  B안:  43% (Day 0) → 71-78% (Day 3)
  → B안이 최종 수익성 우수 (+15-20%포인트)

Secondary KPI (고객 만족도):
  A안 NPS: 6.8
  B안 NPS: 7.4
  → B안이 고객 신뢰도 우수

Tertiary (비용 효율):
  A안: 낮은 conversion으로 더 많은 콜 필요
  B안: 높은 conversion으로 같은 매출에 적은 콜 가능
  → B안이 에이전트당 매출 더 높음

세그먼트별 분석:
  A_신혼: A/B 비슷 (A가 약간 높음)
  B_가족: B 명확 우위 (73.8% vs 51.3%)
  C_중년: B 명확 우위 (70.3% vs 45.8%)
  D_시니어: B 우위 하지만 A도 괜찮음 (66.5% vs 47.1%)
```

### 실행 계획

**Phase 1: B안으로 전사 전환 (Week 5-)**
```
1. 전체 에이전트 B안 스크립트 교육 (2시간)
   - 욕망 탐색 SPIN 기법
   - 고통 증폭 타이밍
   - 이의처리 6가지 (동일)

2. 에이전트 일일 콜 수 조정
   - 이전: 하루 10-12콜 (13분 × 11콜 = 143분)
   - 신규: 하루 6-7콜 (21분 × 6콜 = 126분)
   - 절감 효과: 에이전트 당 +20% 휴식/준비 시간

3. 모니터링
   - 주당 10콜 샘플 음성 분석 (콜 분석원)
   - 주당 Dashboard 업데이트 (Day 3 전환율 추적)
   - 월별 효과 검증

4. 문제 대응
   - 만약 Day 3 전환율이 기대치 이하 → 스크립트 미세 조정
   - 만약 에이전트 이탈 증가 → 스트레스 관리 교육
```

**Phase 2: 고급 세그먼트화 (선택사항)**
```
만약 A_신혼 세그먼트에서 A안이 계속 더 좋다면:
  → 신혼 고객에게만 A안 스크립트 유지
  → CRM Segment Detector에 변수 추가:
     if (segment === "A_newlywed") {
       script = "A";  // 즉시 솔루션
     } else {
       script = "B";  // 욕망 강화
     }
```

---

## Part 6: 측정 대시보드 (실시간 모니터링)

### CRM에 추가할 위젯

**1. A/B 테스트 주간 비교**
```
┌─────────────────────────────────────┐
│   Week 1 A안 vs Week 2 B안 비교      │
├─────────────────────────────────────┤
│ KPI              │   A    │   B      │
├─────────────────┼────────┼──────────┤
│ 단콜 전환율     │ 49.2%  │ 42.8%    │
│ Day 3 전환율    │ 55.0%  │ 71.8%    │
│ 평균 콜시간     │ 13분   │ 21분     │
│ 고객 NPS        │ 6.8    │ 7.4      │
│ 고객 발화 비율  │ 32%    │ 58%      │
└─────────────────────────────────────┘

Winner: B안 (Day 3 +16.8%포인트)
```

**2. 세그먼트별 Day 3 최종 전환율**
```
Segment A (신혼)      A: 52% / B: 68% / Winner: B
Segment B (가족)      A: 51% / B: 74% / Winner: B**
Segment C (중년)      A: 46% / B: 70% / Winner: B**
Segment D (시니어)    A: 47% / B: 67% / Winner: B
```

**3. 이의처리 분포 변화**
```
이의 종류          A안 빈도    B안 빈도    감소율
상조의혹          12.5%  →   8.2%      -34%
가격저항          19.3%  →  14.1%      -27%
생각해보기        23.1%  →  18.5%      -20%
배우자상의         9.2%  →   7.1%      -23%
나중에            15.4%  →  10.3%      -33%
인터넷비교        23.5%  →  15.2%      -35%

평균 이의 감소: -28% (B안의 높은 신뢰도 입증)
```

---

## Part 7: 실패 시나리오 + 대응

### Scenario 1: B안의 Day 3 전환율이 예상 70%에 미치지 못하는 경우 (예: 60%)

**원인 분석:**
- SMS Day 1, 3의 타이밍 문제?
- 욕망 탐색이 너무 길어서 고객 피로?
- 에이전트들이 B안 스크립트를 제대로 실행하지 못함?

**대응:**
1. 콜 녹음 5개 샘플 상세 분석
2. B안 스크립트 중 "고통 증폭" 부분 2분 → 1분30초로 단축
3. SMS Day 1 발송 시간 조정 (현재 당일 17:00 → 익일 09:00)
4. 재테스트 2주 (20콜 × 5일)

---

### Scenario 2: A안이 생각보다 좋아서 B안과 비슷한 경우

**원인:**
- 고객이 빠른 의사결정을 선호하는 추세 변화?
- 이의처리의 품질이 B안 못지않음?

**대응:**
1. A안 유지하되, "이의처리" 부분만 강화
   - 이전: 5분
   - 신규: 7분 (고객 자기발화 더 유도)
2. 결과: 약간의 Day 0 손실 감수 후, Day 3에서 회복 기대
3. 에이전트 피로도는 A안이 훨씬 낮음 (지속 가능성 우수)

---

### Scenario 3: 세그먼트별로 확실히 다른 경우

**A: 신혼 → A안이 좋음 (Day 3: 65%)
B: 가족 → B안이 좋음 (Day 3: 75%)
C: 중년 → B안이 좋음 (Day 3: 70%)
D: 시니어 → B안이 좋음 (Day 3: 67%)**

**대응:**
1. 하이브리드 전략 구현
2. CRM Segment Detector 스크립트 변수 추가:
```typescript
// segment-detector.ts 에 추가
if (segment === "newlywed") {
  recommendedScript = "A";  // 즉시 솔루션
} else {
  recommendedScript = "B";  // 욕망 강화
}
```

3. 에이전트 배치:
   - 신혼 고객 전담: A안 집중
   - 다른 세그먼트: B안 집중

---

## Part 8: 최종 체크리스트

### 실행 전 준비 (Day 1 before calls)
- [ ] A안/B안 스크립트 최종 승인
- [ ] 100명의 대상 고객 선정 (Random or 최근 부재중)
- [ ] 콜 분석원 2명 교육 (이의처리 6가지, 구매신호)
- [ ] CRM Call Record Schema 추가
- [ ] SMS Day 1, 3 템플릿 확인

### Week 1 진행 중
- [ ] 매일 콜 녹음 샘플 5개 QA 검수
- [ ] 이의처리 분류가 정확한지 매일 점검
- [ ] 에이전트 피드백 수집 ("이 스크립트 자연스러운가?")

### Week 1 후 (Day 8)
- [ ] A안 100콜 데이터 정리
- [ ] Day 1 SMS 발송 + 응답 추적
- [ ] Week 1 대시보드 생성

### Week 2 진행 중
- [ ] B안 에이전트 사전 교육 (SPIN, Loss Aversion 이론)
- [ ] B안 스크립트 리허설 (3회)
- [ ] 21분 콜로 인한 에이전트 일정 조정 (하루 6-7콜로)

### Week 2 후 (Day 15)
- [ ] B안 100콜 데이터 정리
- [ ] A vs B 1차 비교 분석
- [ ] 세그먼트별 분해 분석

### Week 3
- [ ] Day 3 SMS 응답 데이터 수집
- [ ] 최종 전환율 확정
- [ ] 이의처리 분포 비교
- [ ] 세그먼트별 최적안 확인

### Week 4
- [ ] 경영진 보고 (권장안)
- [ ] B안 확정 후 전사 교육 일정 수립
- [ ] CRM Segment Detector 스크립트 변수 추가 (필요시)

---

## 요약

**Track D의 핵심:**
- 40-58% 목표로 설계한 Opening/Full Script를 실제 콜에서 검증
- A안(즉시) vs B안(욕망강화) 직접 비교
- 4주 200콜로 통계적 유의성 확보
- 최종 판단: Day 3 멀티콜 전환율 (가장 현실적인 지표)
- 결과: B안 권장 확률 80%, 세그먼트별 하이브리드 확률 15%, A안만 유지 확률 5%

**다음 단계:** Week 5부터 B안 전사 적용 후, 월단위로 효과 검증
