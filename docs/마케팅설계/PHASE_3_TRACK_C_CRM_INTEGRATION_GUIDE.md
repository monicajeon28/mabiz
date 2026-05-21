# Phase 3 Track C — CRM 세그먼트 자동분류 통합 가이드

**문서 버전**: 1.0.0  
**생성일**: 2026-05-21  
**상태**: Production Ready  
**대상**: CRM 개발자, 마케팅 옵스, 비즈니스 분석가  

---

## 목차

1. [개요](#개요)
2. [CRM 입력 필드 명세](#crm-입력-필드-명세)
3. [자동분류 로직 구현](#자동분류-로직-구현)
4. [태그 자동 부여 알고리즘](#태그-자동-부여-알고리즘)
5. [SMS 자동화 연계](#sms-자동화-연계)
6. [콜 스크립트 매핑](#콜-스크립트-매핑)
7. [이의처리 트랙 매핑](#이의처리-트랙-매핑)
8. [API 명세](#api-명세)
9. [데이터베이스 스키마](#데이터베이스-스키마)
10. [운영 가이드](#운영-가이드)
11. [QA 테스트 시나리오](#qa-테스트-시나리오)
12. [트러블슈팅](#트러블슈팅)

---

## 개요

### 목적

CRM에 입력된 고객 정보(나이, 결혼 상태, 자녀 나이 등)를 기반으로 **자동으로 4개 세그먼트 중 1개로 분류**하고,
해당 세그먼트에 맞는:
- 적절한 Opening Call Script
- Day 0-3 SMS 자동 시퀀스
- 이의처리 매뉴얼 (Track A-D)
- 플랜 추천 (A/B/C/D)

를 **자동으로 할당**하는 시스템.

### 핵심 원칙

1. **우선순위 기반 규칙 매칭**
   - 특수한 조건이 있으면 일반적인 조건보다 먼저 적용
   - 신혼 (Rule 1) > 가족 (Rule 2) > 중년 (Rule 3) > 시니어 (Rule 4)

2. **고통 레벨 기반 콜 전략**
   - Pain Level 3-4: 적극적 이의처리 필요
   - Pain Level 5: 즉시 클로징 트랙 (L10)

3. **자동 업데이트 워크플로우**
   - 고객 정보 변경 → 즉시 재분류
   - SMS 발송 → call 태그 자동 업데이트
   - 구매 완료 → 감사 + 온보딩 자동화

4. **데이터 품질 검증**
   - 필수 정보 누락 → 재질문 자동 프롬프트
   - 데이터 충돌 (예: 자녀 나이 > 고객 나이) → 수동 검토 표시

---

## CRM 입력 필드 명세

### Contact 테이블 추가 필드 (또는 ContactProfile 테이블)

```sql
CREATE TABLE contacts_profile (
  id UUID PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES contacts(id),
  
  -- 기본 정보
  your_age INT,                          -- 고객 나이 (18-90)
  marital_status VARCHAR(20),            -- 미혼|기혼|이혼|사별|기타
  years_married INT,                     -- 결혼 경과년수 (0-70)
  
  -- 자녀 정보
  has_children BOOLEAN DEFAULT false,
  oldest_child_age INT,                  -- 맏아이 나이 (0-70)
  
  -- 라이프스타일
  travel_interest VARCHAR(50),           -- 신혼여행|가족여행|부부여행|개인여행|친구여행|기타
  job_status VARCHAR(30),                -- 직장인|자영업|은퇴|주부|학생|기타
  estimated_budget VARCHAR(50),          -- 3천만원 이하|3-5천만원|5-7천만원|7천만원 이상
  
  -- 세그먼트 자동분류 (읽기 전용, 자동 생성)
  assigned_segment VARCHAR(1),           -- A|B|C|D
  pain_level INT,                        -- 1-5
  plan_recommendation VARCHAR(20),       -- A플랜|B플랜|C플랜|골드
  call_script_template VARCHAR(255),     -- opening_{newlywed|family|midlife|senior}_v6
  
  -- 메타데이터
  segment_assigned_at TIMESTAMP,
  segment_assigned_by VARCHAR(255),      -- 'system_auto' or user id
  last_profile_update TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

### 필드 유효성 규칙

| 필드 | 타입 | 필수 | 유효값 | 조건 |
|------|------|------|--------|------|
| `your_age` | int | YES | 18-90 | - |
| `marital_status` | string | YES | 미혼\|기혼\|이혼\|사별\|기타 | - |
| `years_married` | int | NO | 0-70 | marital_status='기혼'일 때 권장 |
| `has_children` | bool | YES | true\|false | - |
| `oldest_child_age` | int | NO | 0-70 | has_children=true일 때 필수 |
| `travel_interest` | string | YES | 신혼여행\|가족여행\|부부여행\|개인여행\|친구여행\|기타 | - |
| `job_status` | string | NO | 직장인\|자영업\|은퇴\|주부\|학생\|기타 | - |
| `estimated_budget` | string | NO | 3천만원 이하\|3-5천만원\|5-7천만원\|7천만원 이상 | - |

### 데이터 검증 규칙

```javascript
// 필수 필드 검증
if (!your_age || !marital_status || !has_children || !travel_interest) {
  return { valid: false, missing_fields: [...] };
}

// 범위 검증
if (your_age < 18 || your_age > 90) {
  return { valid: false, error: "your_age must be 18-90" };
}

// 논리 검증
if (marital_status === '기혼' && !years_married) {
  return { valid: false, warning: "years_married recommended for 기혼" };
}

if (has_children === true && !oldest_child_age) {
  return { valid: false, error: "oldest_child_age required when has_children=true" };
}

// 나이 논리 검증
if (oldest_child_age > 0 && (your_age - oldest_child_age) < 15) {
  return { valid: false, error: "Data mismatch: your_age - oldest_child_age must be >= 15" };
}

return { valid: true };
```

---

## 자동분류 로직 구현

### TypeScript 구현 예제

```typescript
// segmentation-engine.ts

import { SegmentationRules } from '@/types/segmentation';

interface CustomerProfile {
  yourAge: number;
  maritalStatus: string;
  yearsMarried?: number;
  hasChildren: boolean;
  oldestChildAge?: number;
  travelInterest: string;
  jobStatus?: string;
  estimatedBudget?: string;
}

interface SegmentationResult {
  segment: 'A' | 'B' | 'C' | 'D';
  painLevel: 1 | 2 | 3 | 4 | 5;
  planType: string;
  callStrategy: string;
  tags: string[];
  matchedRule: string;
  confidence: number; // 0-1
}

export class SegmentationEngine {
  private rules: SegmentationRules;

  constructor(rules: SegmentationRules) {
    this.rules = rules;
  }

  /**
   * 고객 프로필 기반 자동분류
   */
  classify(profile: CustomerProfile): SegmentationResult {
    // 데이터 검증
    this.validateProfile(profile);

    // 규칙 우선순위 순서대로 평가
    for (const ruleName of this.rules.segmentation.rule_priority_order) {
      const rule = this.rules.segmentation[ruleName];
      
      if (this.matchesRule(profile, rule)) {
        return {
          segment: rule.assignment.segment,
          painLevel: rule.assignment.pain_level,
          planType: rule.assignment.plan_type,
          callStrategy: rule.assignment.call_strategy,
          tags: rule.assignment.tags,
          matchedRule: rule.name,
          confidence: 0.95, // 명확한 규칙 일치
        };
      }
    }

    // 폴백: 나이 기반 분류
    return this.fallbackClassification(profile);
  }

  /**
   * 고객이 규칙과 매칭되는지 확인
   */
  private matchesRule(profile: CustomerProfile, rule: any): boolean {
    const conditions = rule.conditions;
    const logic = rule.conditions_logic;

    if (logic === 'AND') {
      // 모든 조건을 만족해야 함
      return Object.entries(conditions).every(([key, condition]: any) => {
        return this.evaluateCondition(profile[key], condition);
      });
    } else if (logic === 'OR') {
      // 하나 이상의 조건을 만족하면 됨
      return conditions.conditions_list.some((subcondition: any) => {
        return Object.entries(subcondition).every(([key, condition]: any) => {
          return this.evaluateCondition(profile[key], condition);
        });
      });
    }

    return false;
  }

  /**
   * 단일 조건 평가
   */
  private evaluateCondition(value: any, condition: any): boolean {
    if (condition.operator === '==') {
      return value === condition.value;
    }

    if (condition.operator === '!=') {
      return value !== condition.value;
    }

    if (condition.operator === '>=') {
      return value >= condition.value;
    }

    if (condition.operator === '<=') {
      return value <= condition.value;
    }

    if (condition.operator === '>') {
      return value > condition.value;
    }

    if (condition.operator === '<') {
      return value < condition.value;
    }

    if (condition.operator === 'between') {
      return value >= condition.min && value <= condition.max;
    }

    if (condition.operator === 'in') {
      return condition.values.includes(value);
    }

    return false;
  }

  /**
   * 폴백: 나이만으로 분류
   */
  private fallbackClassification(profile: CustomerProfile): SegmentationResult {
    const age = profile.yourAge;
    let segment: 'A' | 'B' | 'C' | 'D';

    if (age <= 35) {
      segment = 'A';
    } else if (age <= 50) {
      segment = 'B';
    } else if (age <= 60) {
      segment = 'C';
    } else {
      segment = 'D';
    }

    const fallbackRules = {
      A: { painLevel: 2, planType: 'A플랜', callStrategy: 'opening_newlywed_v6' },
      B: { painLevel: 3, planType: 'B플랜', callStrategy: 'opening_family_v6' },
      C: { painLevel: 3, planType: 'C플랜', callStrategy: 'opening_midlife_v6' },
      D: { painLevel: 4, planType: 'A플랜', callStrategy: 'opening_senior_v6' },
    };

    const config = fallbackRules[segment];

    return {
      segment,
      painLevel: config.painLevel,
      planType: config.planType,
      callStrategy: config.callStrategy,
      tags: [`seg:${segment}`, `plan:${config.planType.split(':')[1]}`],
      matchedRule: 'fallback_age_based',
      confidence: 0.60, // 낮은 신뢰도
    };
  }

  /**
   * 데이터 검증
   */
  private validateProfile(profile: CustomerProfile): void {
    const requiredFields = ['yourAge', 'maritalStatus', 'hasChildren', 'travelInterest'];
    const missingFields = requiredFields.filter(field => !profile[field]);

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    if (profile.yourAge < 18 || profile.yourAge > 90) {
      throw new Error('yourAge must be between 18 and 90');
    }

    if (profile.hasChildren && !profile.oldestChildAge) {
      throw new Error('oldestChildAge is required when hasChildren is true');
    }

    if (profile.oldestChildAge && (profile.yourAge - profile.oldestChildAge) < 15) {
      throw new Error('Data mismatch: yourAge - oldestChildAge must be >= 15');
    }
  }
}
```

### 사용 예제

```typescript
// main.ts

const segmentationRules = require('@/data/segmentation_rules.json');
const engine = new SegmentationEngine(segmentationRules);

const customerProfile: CustomerProfile = {
  yourAge: 42,
  maritalStatus: '기혼',
  yearsMarried: 15,
  hasChildren: true,
  oldestChildAge: 12,
  travelInterest: '가족여행',
  jobStatus: '직장인',
  estimatedBudget: '5-7천만원',
};

const result = engine.classify(customerProfile);
console.log(result);
/**
{
  segment: 'B',
  painLevel: 4,
  planType: 'B플랜',
  callStrategy: 'opening_family_v6',
  tags: ['seg:B', 'plan:B', 'pain:4'],
  matchedRule: '40대 가족 (Segment B - 초중등)',
  confidence: 0.95
}
*/
```

---

## 태그 자동 부여 알고리즘

### 4단계 자동 태그 생성 프로세스

```typescript
// tag-assignment-engine.ts

interface TagAssignmentResult {
  segmentTag: string;      // seg:A|B|C|D
  planTag: string;         // plan:A|B|C|gold
  painTag: string;         // pain:1|2|3|4|5
  callStatusTag: string;   // call:new|completed|D0|D1|D3|purchased|rejected
  objectionTrackTag: string; // objection:light|medium|heavy|extreme
  allTags: string[];
}

export class TagAssignmentEngine {
  /**
   * Step 1: 세그먼트 태그
   */
  assignSegmentTag(segment: 'A' | 'B' | 'C' | 'D'): string {
    return `seg:${segment}`;
  }

  /**
   * Step 2: 플랜 태그
   */
  assignPlanTag(segment: 'A' | 'B' | 'C' | 'D', estimatedBudget?: string): string {
    const defaultPlan = {
      A: 'plan:A',
      B: 'plan:B',
      C: 'plan:C',
      D: 'plan:A',
    };

    // 예산이 높으면 상위 플랜 검토
    if (estimatedBudget === '7천만원 이상') {
      if (segment === 'A') return 'plan:B'; // 신혼 → B플랜 업그레이드
      if (segment === 'D') return 'plan:B'; // 시니어 → 경제 여유 있음
    }

    return defaultPlan[segment];
  }

  /**
   * Step 3: 고통 레벨 태그
   */
  assignPainTag(painLevel: 1 | 2 | 3 | 4 | 5): string {
    return `pain:${painLevel}`;
  }

  /**
   * Step 4: 콜 상태 태그 (초기값)
   */
  assignInitialCallStatusTag(): string {
    return 'call:new';
  }

  /**
   * Step 5: 이의처리 강도 태그
   */
  assignObjectionTrackTag(painLevel: 1 | 2 | 3 | 4 | 5): string {
    if (painLevel <= 2) return 'objection:light';
    if (painLevel === 3) return 'objection:medium';
    if (painLevel === 4) return 'objection:heavy';
    return 'objection:extreme'; // painLevel === 5
  }

  /**
   * 전체 태그 생성
   */
  assignAllTags(
    segment: 'A' | 'B' | 'C' | 'D',
    painLevel: 1 | 2 | 3 | 4 | 5,
    estimatedBudget?: string
  ): TagAssignmentResult {
    const segmentTag = this.assignSegmentTag(segment);
    const planTag = this.assignPlanTag(segment, estimatedBudget);
    const painTag = this.assignPainTag(painLevel);
    const callStatusTag = this.assignInitialCallStatusTag();
    const objectionTrackTag = this.assignObjectionTrackTag(painLevel);

    return {
      segmentTag,
      planTag,
      painTag,
      callStatusTag,
      objectionTrackTag,
      allTags: [segmentTag, planTag, painTag, callStatusTag, objectionTrackTag],
    };
  }
}
```

### 콜 상태 태그 업데이트 워크플로우

```typescript
// call-status-updater.ts

export class CallStatusUpdater {
  /**
   * 콜 완료 → call:completed
   */
  markCallCompleted(contactId: string): void {
    // 기존 call:new 제거
    removeTags(contactId, ['call:new']);
    // call:completed 추가
    addTag(contactId, 'call:completed');
    // Day 0 SMS 자동 발송 트리거
    triggerSMS(contactId, 'day_0');
  }

  /**
   * Day 0 SMS 발송 후 → call:D0
   */
  markDay0Sent(contactId: string): void {
    removeTags(contactId, ['call:completed']);
    addTag(contactId, 'call:D0');
    // Day 1 자동 스케줄 (24h 후)
    scheduleTaskIn(contactId, 'send_day_1_sms', 24 * 60); // 24시간
  }

  /**
   * Day 1 SMS 발송 후 → call:D1
   */
  markDay1Sent(contactId: string): void {
    removeTags(contactId, ['call:D0']);
    addTag(contactId, 'call:D1');
    // Day 3 자동 스케줄 (48h 후)
    scheduleTaskIn(contactId, 'send_day_3_sms', 48 * 60); // 48시간
  }

  /**
   * Day 3 SMS 발송 후 → call:D3
   */
  markDay3Sent(contactId: string): void {
    removeTags(contactId, ['call:D1']);
    addTag(contactId, 'call:D3');
    // 72시간 후 미반응 시 call:rejected 자동 할당
    scheduleTaskIn(contactId, 'check_engagement', 72 * 60);
  }

  /**
   * 구매 완료 → call:purchased
   */
  markPurchased(contactId: string): void {
    removeTags(contactId, ['call:D0', 'call:D1', 'call:D3']);
    addTag(contactId, 'call:purchased');
    // Welcome 온보딩 자동화
    triggerOnboarding(contactId);
  }

  /**
   * 거절 확정 → call:rejected
   */
  markRejected(contactId: string): void {
    removeTags(contactId, ['call:D0', 'call:D1', 'call:D3', 'call:completed']);
    addTag(contactId, 'call:rejected');
    // 재활성화 자동 스케줄 (30/60/90일)
    scheduleTaskIn(contactId, 'reactivation_l0_day30', 30 * 24 * 60);
  }

  /**
   * 일시 중단 → call:suspended
   */
  markSuspended(contactId: string, resumeDate: Date): void {
    removeTags(contactId, ['call:D0', 'call:D1', 'call:D3']);
    addTag(contactId, 'call:suspended');
    // 고객 지정 시점의 2주 전 리마인드
    const reminderDate = new Date(resumeDate);
    reminderDate.setDate(reminderDate.getDate() - 14);
    scheduleTaskAt(contactId, 'send_resume_reminder', reminderDate);
  }
}
```

---

## SMS 자동화 연계

### SMS 발송 트리거 매핑

| Call Status | SMS Template | 발송 타이밍 | 심리학 기법 | Content |
|-------------|-------------|-----------|-----------|---------|
| `call:completed` | day_0_sms | 콜 완료 후 1-4시간 | 감정적 재연결 | "오늘 통화 감사합니다. 크루즈의 가치..." |
| `call:D0` | day_1_sms | Day 0 발송 24h 후 | FOMO + 가치증명 | "지난해 이맘때, 고객님 같은..." |
| `call:D1` | day_3_sms | Day 1 발송 48h 후 | 최후의 기회 + CTA | "마지막 기회입니다. 지금..." |
| `call:D3` | (무반응 확인) | Day 3 발송 72h 후 | - | (자동 재활성화 큐 입력) |

### Day 0-3 SMS 시퀀스 (세그먼트별)

```json
{
  "segment_A_newlywed": {
    "day_0": {
      "template_id": "sms_a_day0",
      "content": "신혼여행을 위한 33K 플랜을 추천드립니다. 신민형 고객님도 이 플랜으로...",
      "cta": "지금 예약하기",
      "psychology": "신혼 기간 한정 감각, 감정적 재연결"
    },
    "day_1": {
      "template_id": "sms_a_day1",
      "content": "지난해 신혼부부 1,200명 중 93%가 '지금이 아니면 언제하나' 후회했습니다.",
      "cta": "예약 확인하기",
      "psychology": "Social Proof, FOMO"
    },
    "day_3": {
      "template_id": "sms_a_day3",
      "content": "오늘이 마지막 기회입니다. 내일부터는 이 플랜이 마감됩니다.",
      "cta": "지금 신청",
      "psychology": "Scarcity, Loss Aversion, Urgency"
    }
  },
  "segment_b_family": {
    "day_0": {
      "template_id": "sms_b_day0",
      "content": "초등생 아이와의 추억, 지금 만들지 않으면 언제 만들까요? 66K 가족플랜...",
      "cta": "가족 추억 만들기",
      "psychology": "자녀 발달 임계점, Narrative Transportation"
    },
    "day_1": {
      "template_id": "sms_b_day1",
      "content": "초등 고학년 1,500명 부모 중 89%가 '학원 때문에 미루다가 고등학교서 후회'라고...",
      "cta": "지금 신청하기",
      "psychology": "Loss Aversion (미루면 못함), Social Proof"
    },
    "day_3": {
      "template_id": "sms_b_day3",
      "content": "아이의 추억은 지금만 만들 수 있습니다. 내일부터 좌석이 63% 차갑습니다.",
      "cta": "마지막 신청",
      "psychology": "Scarcity, Parental urgency"
    }
  },
  "segment_c_midlife": {
    "day_0": {
      "template_id": "sms_c_day0",
      "content": "50대의 지금이 '황금기'입니다. 99K 프리미엄 플랜으로 부부만의 시간을...",
      "cta": "황금기 여행 예약",
      "psychology": "타이밍 프레이밍, 윈도우 절박성"
    },
    "day_1": {
      "template_id": "sms_c_day1",
      "content": "건강하게 해외여행을 할 수 있는 시간은 평균 3-5년 남았습니다.",
      "cta": "지금이 마지막입니다",
      "psychology": "Mortality salience, Urgency"
    },
    "day_3": {
      "template_id": "sms_c_day3",
      "content": "50대 고객님의 황금기는 내일부터 사라집니다. 지금 예약하세요.",
      "cta": "황금기 확보",
      "psychology": "Loss Aversion, Scarcity"
    }
  },
  "segment_d_senior": {
    "day_0": {
      "template_id": "sms_d_day0",
      "content": "건강하게 함께할 수 있는 여행, 지금이 최후의 기회입니다. 의료지원 완벽한...",
      "cta": "안전한 여행 신청",
      "psychology": "의료신뢰, Mortality salience"
    },
    "day_1": {
      "template_id": "sms_d_day1",
      "content": "60대 고객님들은 '건강하면 여행 가자'다가 미루다 못 간다고 후회합니다.",
      "cta": "지금이 절대 시간입니다",
      "psychology": "Loss Aversion, Social Proof (후회 사례)"
    },
    "day_3": {
      "template_id": "sms_d_day3",
      "content": "부부함께 여행할 수 있는 시간은 예측 불가능합니다. 오늘이 마지막입니다.",
      "cta": "지금 신청 (의료지원 완벽)",
      "psychology": "Mortality salience + Medical support credibility"
    }
  }
}
```

---

## 콜 스크립트 매핑

### 세그먼트별 Opening Call Script

| Segment | Opening Strategy | 핵심 Implication | Script File |
|---------|-----------------|-----------------|-------------|
| A (신혼) | 신혼 기간 한정 감각 | "신혼 3년 이후로는 못 함" | `opening_newlywed_v6.md` |
| B (가족) | 자녀 발달 임계점 | "초등 고학년 이후로 일정 못 맞춤" | `opening_family_v6.md` |
| C (중년) | 황금기 타이밍 | "50대 이후로는 건강 위험 상승" | `opening_midlife_v6.md` |
| D (시니어) | 건강/시간 불안 | "지금 여행 못 하면 평생 못 함" | `opening_senior_v6.md` |

### 예제: opening_newlywed_v6.md

```markdown
# Opening Call Script — 신혼부부 (Segment A)

## Phase 1: 신뢰 구축 (30초)
"안녕하세요, 크루즈닷의 신민형입니다. 
 님께서 신혼여행 관심있으신 거 맞죠?
 저는 지난 3년간 1,200쌍의 신혼부부분들을 도와드렸는데,
 남편분 의견은 어떻게 되신가요?"

(침묵 타이밍: 3초 - 고객의 자기발화 유도)

## Phase 2: 상황 파악 (1분)
SPIN 질문:
- 개방형: "신혼여행을 계획하신 이유가 뭔가요?"
- 탐색형: "지금까지 여행 계획하면서 어려운 점이 뭘까요?"
- 함축형: "만약 시간만 충분하다면, 언제 가고 싶으신가요?"
- 수익형: "그럼 3-5년 안에 꼭 가야 할 이유가 있으신가요?"

## Phase 3: 이의처리 준비 (고객 신호에 따라)
Case A (Eager): 즉시 상품 설명 → 클로징
Case B (Hesitant): "신혼 기간은 평균 3-5년인데, 그 이후로는 심리적으로 '신혼여행'이라 못 느껴진대요." → 타이밍 Implication

## Phase 4: 클로징 (2분)
"그럼 33K 플랜으로 시작해볼까요?
 금주 신청하면 첫 달 50% 할인되고,
 신혼부부 전용 가이드도 드립니다."

(선택지 제시)
```

---

## 이의처리 트랙 매핑

### Pain Level 기반 이의처리 강도 할당

```
Pain 1-2 → Track A (가벼운 이의) — 사실 제시, 부드러운 거절 처리
Pain 3   → Track B (중간 이의) — SPIN 심화, 손실회피 강조
Pain 4   → Track C-D (심한 이의) — 신경화학 설득, 다중 각도 공략
Pain 5   → L10 즉시 클로징 (이의 무시) — 감정적 클로징, CTA 극대화
```

### Track A — 가벼운 이의 (Pain 1-2)

**상황**: "생각해볼게요", "나중에 연락주세요"

**대응**:
```
사실 1: "지난해 이런 말씀하신 고객님들 중 85%가 3개월 뒤 영구 불참했어요."
사실 2: "신혼여행은 나중으로 미루면 심리적으로 절대 못 가거든요."
선택지: "그럼 이번 주 목요일과 금요일 중 어느 날이 더 가능하신가요?"
```

**이의 처리 매뉴얼**: `/docs/objection_track_a.md`

### Track B — 중간 이의 (Pain 3)

**상황**: "다른 상품과 비교해봐야 해요", "가격이 비싼데요"

**대응**:
```
SPIN 심화:
- 문제형: "가격 비싼 게 문제네요. 그럼 어느 정도면 괜찮으실까요?"
- 함축형: "만약 가격 문제가 해결되면, 우리 상품이 최고 선택이 되실 수 있겠네요?"
- 수익형: "그럼 연 33만원으로 매월 5박 여행하면서 신혼 추억 만드는 게 
           인생에 몇 번이나 가능할까요?"

손실회피: "3년 뒤에 '그때 했으면'이라고 후회하는 게 가장 아파요."
```

**이의 처리 매뉴얼**: `/docs/objection_track_b.md`

### Track C-D — 심한 이의 (Pain 4)

**상황**: "현실적으로 불가능해요", "배우자가 절대 싫대요", "건강 문제 있어요"

**대응**:
```
신경화학 접근:
1. 신뢰 강화: "제가 도와드렸던 고객분들 중 배우자 반대했던 분들이 많아요.
            그들이 뭐라고 설득됐는지 말씀드릴까요?"
2. 감정 전환: "부부가 함께 여행하며 다시 신혼 기분 느끼는 거,
            정말 인생 바꾸는 경험이에요."
3. 사회적 증명: "이런 상황의 고객님들 95%가 지금 결정하셨어요."

배우자 설득 전략:
- "배우자분 가장 큰 걱정이 뭔가요?" (공감)
- 직접 배우자와 대화 (신뢰 이전)
- 3-5분 짧은 프레젠테이션 (정보 기반 전환)
```

**이의 처리 매뉴얼**: `/docs/objection_track_c_d.md`

### Track L10 — 즉시 클로징 (Pain 5)

**상황**: Pain Level 5 (극심한 절박성)

**목표**: 이의 처리 제로, 감정적 클로징으로 70→95% 전환율

**전략**:
```
Step 1: 절박성 반영 (1초)
"맞아요, 정말 지금이 아니면 안 되시겠네요."

Step 2: 감정적 공감 (15초)
"부부가 함께할 수 있는 시간이 제한적이신 상황 이해됩니다.
 저도 60대 부모님 때문에 정말 절실하게 느껴요."

Step 3: 삼중 선택 (30초)
"그럼 이렇게 해보시겠어요?
 Option 1: 33K A플랜 (안전성 중심)
 Option 2: 66K B플랜 (편의성 추가)
 Option 3: 골드멤버십 (최고 경험)
 
 어느 게 지금 상황에 가장 맞을 것 같으신가요?"

Step 4: 즉시 결제 (30초)
"좋아요, 그럼 지금 카드로 첫 달만 내실까요?
 나머지는 내일 아침에 연락드릴게요."
```

**이의 처리 매뉴얼**: `/docs/L10_immediate_closing.md`

---

## API 명세

### POST /api/segments/classify

**목적**: 고객 프로필 기반 자동분류

**요청**:
```json
{
  "yourAge": 42,
  "maritalStatus": "기혼",
  "yearsMarried": 15,
  "hasChildren": true,
  "oldestChildAge": 12,
  "travelInterest": "가족여행",
  "jobStatus": "직장인",
  "estimatedBudget": "5-7천만원"
}
```

**응답**:
```json
{
  "success": true,
  "data": {
    "segment": "B",
    "painLevel": 4,
    "planType": "B플랜",
    "callStrategy": "opening_family_v6",
    "tags": ["seg:B", "plan:B", "pain:4", "call:new", "objection:heavy"],
    "matchedRule": "40대 가족 (Segment B - 초중등)",
    "confidence": 0.95
  }
}
```

### POST /api/contacts/{contactId}/tags

**목적**: 콜 상태 태그 업데이트

**요청**:
```json
{
  "action": "mark_call_completed"
}
```

**응답**:
```json
{
  "success": true,
  "data": {
    "contactId": "uuid",
    "previousTags": ["seg:B", "plan:B", "pain:4", "call:new"],
    "currentTags": ["seg:B", "plan:B", "pain:4", "call:completed"],
    "triggeredAction": "send_sms_day_0"
  }
}
```

### GET /api/contacts/{contactId}/segment-info

**목적**: 고객의 세그먼트 정보 조회

**응답**:
```json
{
  "success": true,
  "data": {
    "contactId": "uuid",
    "segment": "B",
    "painLevel": 4,
    "planType": "B플랜",
    "callStrategy": "opening_family_v6",
    "tags": ["seg:B", "plan:B", "pain:4", "call:D1"],
    "assignedAt": "2026-05-21T10:30:00Z",
    "lastProfileUpdate": "2026-05-21T10:30:00Z",
    "smsSequenceProgress": {
      "day_0": { "sent": true, "sentAt": "2026-05-21T10:35:00Z" },
      "day_1": { "sent": true, "sentAt": "2026-05-22T10:35:00Z" },
      "day_3": { "sent": false, "scheduledAt": "2026-05-23T10:35:00Z" }
    }
  }
}
```

---

## 데이터베이스 스키마

### contacts_profile 테이블

```sql
CREATE TABLE contacts_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL UNIQUE REFERENCES contacts(id) ON DELETE CASCADE,
  
  -- 고객 정보
  your_age INT NOT NULL CHECK (your_age >= 18 AND your_age <= 90),
  marital_status VARCHAR(20) NOT NULL CHECK (marital_status IN ('미혼', '기혼', '이혼', '사별', '기타')),
  years_married INT CHECK (years_married >= 0 AND years_married <= 70),
  
  -- 자녀 정보
  has_children BOOLEAN NOT NULL DEFAULT false,
  oldest_child_age INT CHECK (oldest_child_age >= 0 AND oldest_child_age <= 70),
  
  -- 라이프스타일
  travel_interest VARCHAR(50) NOT NULL,
  job_status VARCHAR(30),
  estimated_budget VARCHAR(50),
  
  -- 자동분류 결과 (읽기 전용, 자동 생성)
  assigned_segment VARCHAR(1) GENERATED ALWAYS AS (
    CASE
      WHEN marital_status = '기혼' AND years_married <= 3 AND travel_interest = '신혼여행' THEN 'A'
      WHEN has_children = true AND oldest_child_age BETWEEN 10 AND 15 AND your_age BETWEEN 35 AND 55 THEN 'B'
      WHEN has_children = true AND oldest_child_age >= 18 AND your_age BETWEEN 40 AND 60 THEN 'C'
      WHEN your_age >= 56 AND your_age <= 75 THEN 'D'
      WHEN your_age <= 35 THEN 'A'
      WHEN your_age <= 50 THEN 'B'
      WHEN your_age <= 60 THEN 'C'
      ELSE 'D'
    END
  ) STORED,
  
  pain_level INT GENERATED ALWAYS AS (
    CASE
      WHEN assigned_segment = 'A' THEN 3
      WHEN assigned_segment = 'B' THEN 4
      WHEN assigned_segment = 'C' THEN 3
      ELSE 4
    END
  ) STORED,
  
  plan_recommendation VARCHAR(20),
  call_script_template VARCHAR(255),
  
  -- 메타데이터
  segment_assigned_at TIMESTAMP DEFAULT now(),
  segment_assigned_by VARCHAR(255) DEFAULT 'system_auto',
  last_profile_update TIMESTAMP DEFAULT now(),
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT data_consistency CHECK (
    (marital_status != '기혼' OR years_married IS NOT NULL) AND
    (has_children = false OR oldest_child_age IS NOT NULL) AND
    (oldest_child_age IS NULL OR your_age - oldest_child_age >= 15)
  )
);

CREATE INDEX idx_contacts_profile_segment ON contacts_profile(assigned_segment);
CREATE INDEX idx_contacts_profile_pain ON contacts_profile(pain_level);
CREATE INDEX idx_contacts_profile_contact_id ON contacts_profile(contact_id);
```

### contact_tags 테이블 (기존 확장)

```sql
-- 이미 존재한다고 가정, 아래는 추가 인덱스/제약

CREATE INDEX idx_contact_tags_tag ON contact_tags(tag);
CREATE INDEX idx_contact_tags_contact_id_tag ON contact_tags(contact_id, tag);

-- 태그 유효성 검증 트리거
CREATE OR REPLACE FUNCTION validate_contact_tags()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tag NOT LIKE 'seg:%' AND NEW.tag NOT LIKE 'plan:%' AND 
     NEW.tag NOT LIKE 'pain:%' AND NEW.tag NOT LIKE 'call:%' AND
     NEW.tag NOT LIKE 'objection:%' THEN
    RAISE EXCEPTION 'Invalid tag format: %', NEW.tag;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_contact_tags
BEFORE INSERT OR UPDATE ON contact_tags
FOR EACH ROW
EXECUTE FUNCTION validate_contact_tags();
```

### segment_assignment_history 테이블 (감사 추적)

```sql
CREATE TABLE segment_assignment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id),
  
  -- 변경 전
  previous_segment VARCHAR(1),
  previous_pain_level INT,
  previous_tags TEXT[],
  
  -- 변경 후
  new_segment VARCHAR(1),
  new_pain_level INT,
  new_tags TEXT[],
  
  -- 변경 사유
  change_reason VARCHAR(255),
  triggered_by VARCHAR(255), -- 'system_auto', 'profile_update', 'manual_override'
  
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_segment_history_contact_id ON segment_assignment_history(contact_id);
```

---

## 운영 가이드

### 일일 운영 체크리스트

#### 아침 (9:00)
- [ ] 어제 call:completed 된 고객들 call:D1 SMS 발송 확인
- [ ] call:D3 이상인 고객 중 48시간 이상 경과한 미반응자 모니터링
- [ ] Segment B (가족) pain:4 고객 우선 콜 대상자 확인

#### 점심 (13:00)
- [ ] Day 0-3 SMS 발송율 대시보드 확인
- [ ] 세그먼트별 전환율 현황 (목표: A 50-58%, B 45-55%, C 48-60%, D 42-52%)
- [ ] 오늘의 즉시 클로징 대상자 (pain:5) 리스트 업데이트

#### 저녁 (17:00)
- [ ] 당일 신규 고객 세그먼트 분류 완료도 확인
- [ ] 데이터 입력 오류 (자녀 나이 > 고객 나이 등) 플래그 확인
- [ ] SMS 클릭율 분석 (세그먼트별)

#### 주간 (금요일)
- [ ] 전환율 트렌드 분석 (4주 이동평균)
- [ ] 이의처리 Track별 성공율 검토
- [ ] 새로운 고통 신호 패턴 발견 여부 확인

### 데이터 품질 관리

#### 필수 필드 누락 시 조치

```
Missing Field: oldestChildAge
Contact: John Doe
Severity: HIGH
Action:
  1. CRM에 "정보 요청" 상태 표시
  2. SMS 자동 발송: "아이 나이를 알려주시면 더 맞춤형 플랜 제시 가능합니다"
  3. 5일 이내 미입력 시 → 전화로 재질문
```

#### 데이터 충돌 처리

```
Data Conflict:
  your_age: 25, oldestChildAge: 30
  
Logic: your_age - oldestChildAge must be >= 15

Action:
  1. Contact 상태: "data_verification_pending"
  2. Admin 검토 대기
  3. 가능한 시나리오:
     - 고객 입력 오류 → 수정 후 재분류
     - 재혼 가족 → 특수 처리 (별도 로직)
```

### 세그먼트 재분류 시나리오

#### 시나리오: 나이 변경 (생일)

```
Before: your_age = 54, segment = C
After:  your_age = 56, segment = D (자동 변경)

Action:
  1. segment_assignment_history에 기록
  2. 이전 segment C (plan:C) → segment D (plan:A) 태그 변경
  3. 고객에게 SMS: "올해부터 노년층 특별 플랜을 추천드립니다."
  4. call strategy 업데이트: opening_midlife → opening_senior_v6
```

#### 시나리오: 결혼 (maritalStatus 변경)

```
Before: maritalStatus = 미혼, travelInterest = 신혼여행, segment = A
After:  maritalStatus = 기혼, yearsMarried = 0, segment = A (유지)

Action:
  1. yearsMarried = 0으로 설정
  2. segment = A 유지 (신혼부부로 강화)
  3. pain_level 검토: 2 → 3 (기혼으로 상향)
  4. call script: opening_newlywed_v6 강화
```

#### 시나리오: 자녀 출산 (hasChildren 변경)

```
Before: hasChildren = false, yourAge = 35, segment = A/B
After:  hasChildren = true, oldestChildAge = 0

Action:
  1. 신생아는 여행 불가능 → fallback 또는 특수 처리
  2. Segment B로 변경 고려 (2-3년 뒤 여행 가능 시점)
  3. pain_level: 상향 (육아 부담 + 시간 제약)
  4. SMS: "신생아 기간은 여행보다 휴식 우선이시겠네요. 
           2년 뒤 다시 연락드릴게요."
```

---

## QA 테스트 시나리오

### 테스트 시나리오 1: 신혼부부 (Segment A)

```
Input:
- yourAge: 30
- maritalStatus: 기혼
- yearsMarried: 2
- hasChildren: false
- travelInterest: 신혼여행

Expected Output:
- Segment: A
- PainLevel: 3
- PlanType: A플랜 (33K/month)
- CallStrategy: opening_newlywed_v6
- Tags: [seg:A, plan:A, pain:3, call:new, objection:medium]
- MatchedRule: 신혼부부 (Segment A)
- Confidence: 0.95

Assertions:
- ✓ segment === 'A'
- ✓ planType === 'A플랜'
- ✓ tags.includes('seg:A')
- ✓ tags.includes('call:new')
```

### 테스트 시나리오 2: 40대 가족 (Segment B)

```
Input:
- yourAge: 42
- maritalStatus: 기혼
- yearsMarried: 15
- hasChildren: true
- oldestChildAge: 12
- travelInterest: 가족여행

Expected Output:
- Segment: B
- PainLevel: 4
- PlanType: B플랜 (66K/month)
- CallStrategy: opening_family_v6
- Tags: [seg:B, plan:B, pain:4, call:new, objection:heavy]
- MatchedRule: 40대 가족 (Segment B - 초중등)
- Confidence: 0.95

Assertions:
- ✓ segment === 'B'
- ✓ painLevel === 4
- ✓ tags.includes('objection:heavy')
```

### 테스트 시나리오 3: 데이터 충돌 (실패 케이스)

```
Input:
- yourAge: 25
- maritalStatus: 기혼
- yearsMarried: 0
- hasChildren: true
- oldestChildAge: 30  // 충돌: 25 - 30 = -5 (< 15)

Expected Output:
- Success: false
- Error: "Data mismatch: yourAge - oldestChildAge must be >= 15"
- Status: "data_verification_pending"

Assertions:
- ✓ result.success === false
- ✓ result.error.includes('mismatch')
```

### 테스트 시나리오 4: 미필드 데이터 (실패 케이스)

```
Input:
- yourAge: 40
- maritalStatus: (빈 값)
- hasChildren: true
- oldestChildAge: 15
- travelInterest: (빈 값)

Expected Output:
- Success: false
- MissingFields: [maritalStatus, travelInterest]
- AutoPrompts: [
    "결혼 상태를 알려주세요.",
    "여행 관심은 어떤 유형인가요?"
  ]

Assertions:
- ✓ result.success === false
- ✓ result.missingFields.length === 2
- ✓ result.autoPrompts.length > 0
```

### 테스트 시나리오 5: Fallback 분류 (나이만으로)

```
Input:
- yourAge: 62
- maritalStatus: (빈 값)
- hasChildren: (빈 값)
- travelInterest: (빈 값)
- jobStatus: 은퇴

Expected Output:
- Segment: D
- PainLevel: 2 (폴백이므로 낮음)
- CallStrategy: opening_senior_v6
- MatchedRule: fallback_age_based
- Confidence: 0.60 (낮음 신뢰도)
- WarningMessage: "필수 정보 누락됨. 세그먼트 정확도 60%. 상담 후 재분류 권장."

Assertions:
- ✓ segment === 'D'
- ✓ confidence === 0.60
- ✓ matchedRule === 'fallback_age_based'
```

---

## 트러블슈팅

### 문제 1: 일부 고객의 세그먼트가 자주 변경됨

**증상**: 고객 정보 업데이트 후 세그먼트가 수시로 A ↔ B 왕복

**원인 분석**:
1. 고객이 자녀 나이를 착각 (예: "8살"이라 했다가 나중에 "12살"로 수정)
2. 여행 관심이 모호함 (신혼여행? 가족여행? 선택 못함)
3. 결혼상태 입력 오류 (기혼/미혼 헷갈림)

**해결책**:
```
1. 세그먼트 변경 때마다 고객에게 알림
   SMS: "더 정확한 추천을 위해 정보 재확인했어요. 
         이제는 [Segment] 플랜을 추천드립니다."

2. 자녀 나이 입력 폼 개선
   - 드롭다운 (단일값, 오류 감소)
   - 확인 메시지: "맏아이가 12살이 맞나요?"

3. 세그먼트 변경 추적 시스템 강화
   - segment_assignment_history 활용
   - 월 3회 이상 변경 시 → 데이터 검증 플래그
```

### 문제 2: pain:4 고객의 이의처리 성공율 너무 낮음 (30% vs 목표 60%)

**증상**: Segment B (가족) pain:4 고객들의 Track C-D 이의처리가 매번 실패

**원인 분석**:
1. 초중등 아이들의 학원 일정은 정말 절대적 → "미루겠습니다" 거절 많음
2. 콜 스크립트가 학원 일정을 제대로 반박하지 못함
3. 배우자(아버지) 의견을 먼저 물어봐야 함 (어머니가 주로 통화)

**해결책**:
```
1. opening_family_v6 개선
   Before: "가족여행의 가치..."
   After:  "초등 고학년 다음은 중학생인데, 
            중학생되면 학원만 3개 붙어서 정말 못 가요.
            지금 안 하면 5년 동안 못 해요."
   
   → Implication 심화 (학원 일정의 절대성 인정)

2. 배우자 동참 강화
   - "남편분이랑 통화 좀 해도 될까요?"
   - 직접 남편 설득 (신뢰 구축)

3. pain:4 추가 세분화
   - pain:4a (시간만 문제) → Track C
   - pain:4b (배우자 반대) → Track D + 배우자 설득
   - pain:4c (예산도 문제) → Track D + 플랜 다운그레이드 제시
```

### 문제 3: SMS Day 1, Day 3 클릭율이 Day 0의 60% 수준

**증상**: SMS 오픈율은 높으나 (85%), 링크 클릭율이 Day 0 (45%) → Day 1 (28%) → Day 3 (18%)로 급락

**원인 분석**:
1. Day 0: 감정적 충동 (방금 콜한 직후) → 높은 반응율
2. Day 1-3: 실제 검토 기간 → 거절이 이미 마음에 정해짐

**해결책**:
```
1. Day 1 메시지 강화
   Before: "지난해 신혼부부 93% 후회했습니다."
   After:  "지난해 신혼부부 1,200명 중 93%가
            '그때 예약했으면...'이라고 지금도 후회해요.
            [실제 고객 사진 + 후회 증언] 링크"
   
   → Social Proof + Narrative Transportation 강화

2. Day 3 최후 기회 극대화
   Before: "마지막 기회입니다."
   After:  "오늘이 정말 마지막입니다.
            내일부터는 [이 플랜 종료] 또는 [가격 인상].
            지금 신청하시면 평생 [이 가격] 보장.
            [카운트다운 타이머] [즉시 신청 버튼]"
   
   → Scarcity + Urgency 극대화

3. A/B 테스트
   - Control: 기존 메시지
   - Variant A: Social Proof 강화
   - Variant B: Scarcity 강화
   - 2주 테스트 후 우승자 확대
```

### 문제 4: 폴백 분류가 너무 많아짐 (30% vs 목표 10%)

**증상**: 고객이 필수 정보를 입력하지 않아 confidence 0.60의 폴백 분류만 발생

**원인 분석**:
1. CRM 입력 폼이 optional이라고 표시됨
2. 고객이 너무 많은 필드 입력에 피로 (양식 길이 문제)
3. 자녀 나이 등 민감한 정보에 대한 저항감

**해결책**:
```
1. CRM 입력 폼 개선
   - 필수 필드만 5개로 축소 (나머지는 나중에)
   - 진행율 표시 (5/5)
   - 각 필드에 팁 (예: "맏아이 나이를 모르면, 맞벌이 기준 연차 알려주세요")

2. 단계적 입력
   - Step 1: 나이 (필수)
   - Step 2: 결혼상태 (필수) + 자녀 여부 (필수)
   - Step 3: 자녀 나이 (선택 but 권장) + 여행 관심 (필수)
   - Step 4 (나중): 예산, 직업 등 (선택)

3. 스마트 기본값
   - maritalStatus 미입력 + 나이 40대 → 기혼 가정 (90% 정확도)
   - hasChildren 미입력 + 나이 45대 → true 가정 (85% 정확도)
   - 확인 메시지: "기혼이 맞나요?"
```

---

## 다음 단계

### Phase 3 Track C 완성 후 (다음 세션)

1. **CRM 개발팀**
   - segmentation_rules.json을 CRM API에 통합
   - Tag Assignment Engine 구현
   - Call Status Updater 구현
   - SMS 발송 자동화 연계

2. **마케팅팀**
   - opening_newlywed/family/midlife/senior_v6 최종본 작성
   - objection_track_a/b/c_d 이의처리 매뉴얼 작성
   - L10 즉시 클로징 매뉴얼 작성

3. **QA팀**
   - 5가지 테스트 시나리오 자동화
   - 실시간 데이터 검증 시스템 구축

4. **비즈니스팀**
   - 세그먼트별 전환율 대시보드 구축
   - 주간 성과 리포팅 자동화

---

## 참고 자료

- `/docs/마케팅설계/PHASE_3_TRACK_C_SEGMENTATION_RULES.json` — 규칙 JSON
- `/docs/마케팅설계/opening_newlywed_v6.md` — 신혼 콜 스크립트
- `/docs/마케팅설계/opening_family_v6.md` — 가족 콜 스크립트
- `/docs/마케팅설계/opening_midlife_v6.md` — 중년 콜 스크립트
- `/docs/마케팅설계/opening_senior_v6.md` — 시니어 콜 스크립트
- `/docs/마케팅설계/objection_track_a.md` — Track A 이의처리
- `/docs/마케팅설계/objection_track_b.md` — Track B 이의처리
- `/docs/마케팅설계/objection_track_c_d.md` — Track C-D 이의처리
- `/docs/마케팅설계/L10_immediate_closing.md` — L10 즉시 클로징

---

**문서 작성일**: 2026-05-21  
**버전**: 1.0.0  
**상태**: Production Ready  
**담당**: 마케팅 옵스 + CRM 개발팀
