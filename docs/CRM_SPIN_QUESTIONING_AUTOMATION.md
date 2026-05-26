# CRM SPIN 질문 자동화 (2026-05-26)

## 📚 SPIN Selling: 4단계 질문으로 고객 심리 파악

### 1. SPIN 정의
**SPIN** = Situation/Problem/Implication/Payoff = 4단계 질문법

```
S: Situation (상황) — 현재 상황 파악
P: Problem (문제) — 문제 인식 확인
I: Implication (함의) — 문제의 심각성 탐색
Payoff: Payoff (보상) — 해결책의 가치 강조
```

---

## 🔧 SPIN 4단계 → CRM Automation 매핑

### Stage 1: S (Situation) — 정보 수집
#### 목적: 고객의 현재 상황 파악
- "현재 여행 계획이 어떻게 되나요?"
- "가족 구성은 어떻게 되세요?"
- "지금까지 크루즈 경험은?"

#### CRM Trigger (Call/SMS)
```json
{
  "stage": "S_SITUATION",
  "trigger": "INITIAL_CALL_OR_LANDING_PAGE",
  "questions": [
    {
      "q": "가족 구성을 알려주실 수 있을까요?",
      "crm_field": "family_composition",
      "options": ["부부", "부부+아이", "3세대", "친구그룹"]
    },
    {
      "q": "지금까지 크루즈 경험은 있으신가요?",
      "crm_field": "cruise_experience",
      "options": ["처음", "1회", "2회+"]
    },
    {
      "q": "올해 여행 계획은 있으세요?",
      "crm_field": "travel_plan_timeline",
      "options": ["이미 결정", "계획 중", "아직 미정"]
    }
  ],
  "recordType": "SPIN_SITUATION_ASSESSMENT"
}
```

#### SMS 예시
```
"김민지 님, 몇 가지 질문해도 될까요?
이게 당신에게 딱 맞는 크루즈를 찾는 데 도움이 돼요.

1️⃣ 가족은 몇 명이세요?
   (1. 부부만 / 2. 아이 포함 / 3. 친구)

[숫자만 답하면 됩니다!]"
```

#### CRM Automation
```json
{
  "action": "SEND_INTERACTIVE_SMS",
  "templateId": "SPIN_S_SITUATION_FORM",
  "fields": [
    "family_composition",
    "cruise_experience",
    "travel_timeline"
  ],
  "responseHandling": "AUTO_CLASSIFY_SEGMENTS",
  "nextStage": "P_PROBLEM"
}
```

---

### Stage 2: P (Problem) — 문제 인식 유도
#### 목적: 고객이 자신의 문제를 인식하게 함
- "일반 여행 준비, 얼마나 번거로워요?"
- "가족들이 함께할 시간, 충분하신가요?"
- "매번 호텔 예약하는데, 신경 쓸 게 많지 않나요?"

#### CRM Trigger (Based on S stage response)
```json
{
  "stage": "P_PROBLEM",
  "trigger": "SITUATION_DATA_RECEIVED",
  "intelligence": {
    "if_family_with_kids": {
      "focus_problem": "가족시간_부족",
      "questions": [
        "아이들과 함께할 여유시간, 충분하신가요?",
        "여행 준비할 시간, 있으세요?",
        "모든 가족이 함께 즐길 수 있는 활동, 찾기 어렵지 않나요?"
      ]
    },
    "if_no_cruise_experience": {
      "focus_problem": "준비복잡",
      "questions": [
        "일반 여행 다니실 때, 몇 가지를 직접 예약하세요?",
        "그게 얼마나 스트레스 받으세요?",
        "비행기, 호텔, 식사... 다 다르게 예약하는 게 번거롭지 않나요?"
      ]
    }
  }
}
```

#### SMS 예시
```
"다음 질문들이 공감되나요?

✋ 아이들과 함께할 시간이 부족하다
✋ 여행 준비가 복잡하고 시간 걸린다
✋ 모든 가족이 즐길 수 있는 활동을 찾기 어렵다

이 중에 당신의 상황과 맞는 게 있나요?
모두 맞아요 (1) / 일부만 맞아요 (2) / 아니에요 (3)"
```

#### CRM Automation
```json
{
  "action": "SEND_CONDITIONAL_SMS",
  "templateId": "SPIN_P_PROBLEM_IDENTIFICATION",
  "conditionRules": {
    "if_family_with_kids": "PROBLEM_FAMILY_TIME",
    "if_no_experience": "PROBLEM_PREPARATION",
    "if_budget_conscious": "PROBLEM_COST"
  },
  "trackingField": "p_problem_identified",
  "nextStage": "I_IMPLICATION"
}
```

---

### Stage 3: I (Implication) — 함의 탐색 (문제의 심각성)
#### 목적: 문제를 방치할 경우의 부정적 결과 강조
- "이런 식으로 계속 가면?"
- "1년에 한 번 가족과 휴가도 못 가면?"
- "아이들이 이 시간을 놓치면 돌아오지 않지요?"

#### CRM Trigger
```json
{
  "stage": "I_IMPLICATION",
  "trigger": "P_PROBLEM_CONFIRMED",
  "logic": {
    "problem_family_time": {
      "implications": [
        "아이들이 자라면 더 이상 함께 여행 안 간다",
        "일정이 계속 바빠져 가족 시간이 더 줄어든다",
        "나중에 후회할 추억을 지금 만들 수 없다"
      ]
    },
    "problem_preparation": {
      "implications": [
        "매년 같은 번거로움 반복된다",
        "시간과 스트레스는 늘고 휴가 만족도는 떨어진다",
        "비용도 더 들고 시간도 더 걸린다"
      ]
    }
  }
}
```

#### SMS 예시
```
"한 가지 더 생각해보세요...

😔 매해 이런 식으로 가면?
   - 아이들이 자라서 부모와 여행 안 갈 때까지
   - 1년에 1번 가족여행도 못 간다면?
   - 당신의 아이들은 언제 휴가를 누리나요?

아이들이 자라기 전에,
지금 이 시간들이 가장 소중하지 않을까요?

[동의합니다 (1) / 다시 생각 (2)]"
```

#### CRM Automation
```json
{
  "action": "SEND_IMPLICATION_SMS",
  "templateId": "SPIN_I_IMPLICATION_CONSEQUENCE",
  "psychologyFocus": ["손실회피", "시간부족감", "자녀교육"],
  "trackingField": "i_implication_understood",
  "nextStage": "PAYOFF"
}
```

---

### Stage 4: Payoff (보상) — 해결책의 가치
#### 목적: 우리의 솔루션이 문제를 어떻게 해결하는지 강조
- "크루즈는 모든 게 준비되어 있어요"
- "짐만 싸면 나머지는 배가 해결해요"
- "가족 모두가 함께 즐길 수 있는 공간이에요"

#### CRM Trigger
```json
{
  "stage": "PAYOFF",
  "trigger": "I_IMPLICATION_ACKNOWLEDGED",
  "payoffLogic": {
    "problem_family_time": {
      "solution": "크루즈 = 가족시간 자동화",
      "payoffs": [
        "짐만 싸면 나머지는 배가 다 해줌 (준비 0시간)",
        "배 위에서 아이부터 어른까지 모두 할 수 있는 일 있음",
        "정해진 일정만 따르면 스트레스 없음",
        "이번 해 여름 방학, 이번이 기회입니다"
      ]
    },
    "problem_preparation": {
      "solution": "올인클루시브 = 준비 단순화",
      "payoffs": [
        "비행기, 호텔, 식사, 엔터 모두 포함",
        "따로 예약할 게 없음",
        "가격도 일반 여행보다 저렴"
      ]
    }
  }
}
```

#### SMS 예시
```
"✅ 크루즈는 모든 게 다릅니다!

🚢 당신의 문제들이 한 번에 해결돼요:

1️⃣ 준비? 짐만 싸면 끝
   → 비행기, 호텔, 식사 다 포함

2️⃣ 가족시간? 배 위에서 자동 생성
   → 아침부터 밤까지 가족 함께 하는 공간

3️⃣ 비용? 일반여행보다 저렴
   → ₩2.2M (호텔 + 식사 + 엔터 다 포함)

4️⃣ 안심? 모든 게 정해져 있음
   → 일정만 따르면 최고의 휴가

[이제 결정할 시간입니다]"
```

#### CRM Automation
```json
{
  "action": "SEND_PAYOFF_SMS",
  "templateId": "SPIN_PAYOFF_SOLUTION_VALUE",
  "contentStructure": {
    "acknowledgeProblem": true,
    "presentSolution": true,
    "highlight4Payoffs": true,
    "strongCTA": true
  },
  "trackingField": "payoff_presented",
  "nextStage": "CLOSING"
}
```

---

## 📊 SPIN 성과 메트릭

### KPI 정의
| 단계 | 메트릭 | 현재 | 목표 | 공식 |
|------|--------|------|------|------|
| **S** | 상황 파악율 | 52% | 80%+ | (S 단계 질문 응답 / 발송) |
| **P** | 문제 인식율 | 38% | 65%+ | (P 단계 동의 / S 완료) |
| **I** | 함의 이해율 | 28% | 55%+ | (I 단계 인식 / P 완료) |
| **Payoff** | 솔루션 가치 인식 | 35% | 60%+ | (Payoff SMS 클릭 / I 완료) |

### 자동 성과 리포팅
```sql
-- SPIN Stage별 성과 분석
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_interactions,
  SUM(CASE WHEN spin_stage >= 'S' THEN 1 ELSE 0 END) as s_stage,
  SUM(CASE WHEN spin_stage >= 'P' THEN 1 ELSE 0 END) as p_stage,
  SUM(CASE WHEN spin_stage >= 'I' THEN 1 ELSE 0 END) as i_stage,
  SUM(CASE WHEN spin_stage >= 'PAYOFF' THEN 1 ELSE 0 END) as payoff_stage,
  SUM(CASE WHEN purchased = 1 THEN 1 ELSE 0 END) as conversions,
  ROUND(100.0 * SUM(CASE WHEN purchased = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) as conversion_rate
FROM contacts
WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## 🔄 전체 SPIN Workflow JSON

```json
{
  "workflowId": "SPIN_QUESTIONING_MASTER",
  "name": "SPIN 4단계 질문 자동화",
  "enabled": true,
  "stages": [
    {
      "stage": "S_SITUATION",
      "order": 1,
      "trigger": "INITIAL_CONTACT",
      "questions": [
        {
          "text": "가족 구성은?",
          "field": "family_composition",
          "type": "MULTIPLE_CHOICE"
        },
        {
          "text": "크루즈 경험?",
          "field": "cruise_experience",
          "type": "MULTIPLE_CHOICE"
        },
        {
          "text": "올해 여행 계획?",
          "field": "travel_timeline",
          "type": "MULTIPLE_CHOICE"
        }
      ],
      "segmentationRules": true
    },
    {
      "stage": "P_PROBLEM",
      "order": 2,
      "trigger": "SITUATION_DATA_RECEIVED",
      "conditionalQuestions": {
        "if_family_with_kids": "가족시간_부족",
        "if_no_experience": "준비_복잡",
        "if_busy": "스트레스_과다"
      }
    },
    {
      "stage": "I_IMPLICATION",
      "order": 3,
      "trigger": "P_PROBLEM_CONFIRMED",
      "focusAreas": ["손실회피", "시간부족", "아이성장"],
      "emphasizeConsequence": true
    },
    {
      "stage": "PAYOFF",
      "order": 4,
      "trigger": "I_IMPLICATION_ACKNOWLEDGED",
      "presentSolution": {
        "preparation_zero": true,
        "family_time_automatic": true,
        "price_comparison": true,
        "peace_of_mind": true
      }
    }
  ]
}
```

---

## 💡 SPIN + PASONA 통합 사례

### 실제 고객 여정 (7일)

#### Day 0 (S+P+A): 상황 파악 + 문제 인식 + 자극
```
[SMS] "가족 구성 알려주실래요?" (S)
[응답] "아이 2명"
[SMS] "아이들과 충분히 시간 보내세요?" (P)
[응답] "요즘 바빠서 못 해요"
[SMS] "아이들 자라면 못 간단 거, 알죠?" (A - 자극)
```

#### Day 1 (I+S): 함의 + 해결책 소개
```
[SMS] "당신의 상황, 계속 가면?" (I)
[응답] "그런 거 같아요"
[SMS] "크루즈는 모든 게 포함돼 있어요" (S)
```

#### Day 2 (O): 구체적 제안
```
[SMS] "6월 14-20일, 스탠다드 ₩2.2M" (O)
[대시보드] 자리 3개, 오늘 밤까지
```

#### Day 3 (N+A): 범위 한정 + 행동
```
[SMS] "자리 2개 남았어요! 지금 예약하기" (N+A)
```

---

## 🎯 체크리스트: SPIN Automation 구현

- [ ] S_SITUATION 다지선다형 질문 SMS (가족/경험/일정)
- [ ] P_PROBLEM 인식 질문 (세그먼트별)
- [ ] I_IMPLICATION 함의 탐색 (손실회피 심리)
- [ ] PAYOFF 해결책 가치 강조 SMS
- [ ] Segment Auto-Classification (S 응답 기반)
- [ ] Conditional Logic (문제 유형별 경로 분기)
- [ ] SPIN_STAGE 필드 자동 업데이트
- [ ] Daily KPI 리포팅 (4단계 진행율)
- [ ] SPIN + PASONA 통합 매핑 테스트
- [ ] A/B 테스트: 질문 형식 (객관식 vs 주관식)

---

**파일 참고**: [[spin_selling_complete]] / [[shinmintype_5step_complete_script]] / [[psychology_theories_master]]
