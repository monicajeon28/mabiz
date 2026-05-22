# Track D: A/B 테스트 할당 알고리즘 설계서

**목표:** 상담사 무작위 할당 + 시간 교차 배치로 선택 편향 제거, 12주 × 200콜 A/B 테스트 준비

**기한:** 3.5일 (설계 + 구현)

---

## Phase 1: Block Randomization (1.5일)

### 원리

```
목표: 각 상담사가 A/B를 균등하게 경험하게 함
      (선택 편향 제거)

Block size = 4 (한 사이클에 A 2번, B 2번)
상담사 5명

예시:
상담사1: [A, B, A, B] (주당 4콜 단위 블록)
상담사2: [B, A, B, A]
상담사3: [A, A, B, B]
상담사4: [B, B, A, A]
상담사5: [A, B, B, A]

각 블록 내 A와 B의 순서는 Random
하지만 비율은 항상 50:50
```

### 알고리즘 구현

```typescript
/**
 * Block Randomization을 사용하여 A/B 할당
 * 각 상담사가 동일하게 A/B를 50:50으로 경험하도록 함
 */

export interface BlockAssignment {
  counselorId: string;
  counselorName: string;
  blocks: string[][]; // 주당 블록 배열 [["A", "B", "A", "B"], ...]
  totalAssignments: number;
  aCount: number;
  bCount: number;
}

export function generateBlockRandomization(
  numCounselors: number,
  blockSize: number = 4,
  numWeeks: number = 12
): BlockAssignment[] {
  const assignments: BlockAssignment[] = [];
  
  // 상담사별 할당
  for (let counselorIdx = 0; counselorIdx < numCounselors; counselorIdx++) {
    const blocks: string[][] = [];
    let totalA = 0;
    let totalB = 0;
    
    // 주별 블록 생성
    for (let week = 0; week < numWeeks; week++) {
      // 한 블록 생성 (A, B를 섞은 배열)
      const block: string[] = [];
      for (let i = 0; i < blockSize / 2; i++) {
        block.push("A");
      }
      for (let i = 0; i < blockSize / 2; i++) {
        block.push("B");
      }
      
      // 블록 내 순서 Random (Fisher-Yates shuffle)
      for (let i = block.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [block[i], block[j]] = [block[j], block[i]];
      }
      
      blocks.push(block);
      totalA += block.filter(x => x === "A").length;
      totalB += block.filter(x => x === "B").length;
    }
    
    assignments.push({
      counselorId: `counselor_${counselorIdx + 1}`,
      counselorName: `상담사${String.fromCharCode(64 + counselorIdx + 1)}`,
      blocks,
      totalAssignments: totalA + totalB,
      aCount: totalA,
      bCount: totalB,
    });
  }
  
  return assignments;
}

// 예시 출력:
// {
//   counselorName: "상담사A",
//   blocks: [
//     ["A", "B", "B", "A"], // Week 1
//     ["B", "A", "A", "B"], // Week 2
//     ["A", "B", "A", "B"], // Week 3
//     // ... 12주
//   ],
//   totalAssignments: 48, // 4콜/주 × 12주
//   aCount: 24,
//   bCount: 24
// }
```

---

## Phase 2: Stratification (1일)

### 원리

```
목표: 상담사의 "능력 차이"가 A/B 효과 추정을 오염하지 않게 함

상황: 만약 상담사A는 전환율 50%, 상담사B는 전환율 40%라면,
     A가 A안을 많이 하고 B가 B안을 많이 하면
     "A안이 좋다"고 잘못 결론 낼 수 있음

해결: 각 레이어(상위/중위/하위)에서 균등 분배
```

### 구현 방식

```typescript
/**
 * 기존 4주 데이터에서 상담사별 평균 전환율 계산
 */
export interface CounselorStratum {
  stratumLevel: "high" | "middle" | "low";
  counselors: {
    id: string;
    name: string;
    historicalConversionRate: number; // 0-100
  }[];
}

export function stratifyByHistoricalPerformance(
  counselors: {
    id: string;
    name: string;
    historicalConversionRate: number;
  }[]
): CounselorStratum[] {
  // 1. 상담사를 전환율 순으로 정렬
  const sorted = [...counselors].sort(
    (a, b) => b.historicalConversionRate - a.historicalConversionRate
  );
  
  // 2. 3개 레이어로 나누기 (상위 1-2명, 중위 1-2명, 하위 1-2명)
  const layerSize = Math.ceil(sorted.length / 3);
  
  const strata: CounselorStratum[] = [
    {
      stratumLevel: "high",
      counselors: sorted.slice(0, layerSize),
    },
    {
      stratumLevel: "middle",
      counselors: sorted.slice(layerSize, layerSize * 2),
    },
    {
      stratumLevel: "low",
      counselors: sorted.slice(layerSize * 2),
    },
  ];
  
  return strata;
}

// 예시 (5명 상담사):
// HIGH (상위 2명):
//   - 상담사A: 55% 전환율
//   - 상담사B: 52% 전환율
// MIDDLE (중위 1명):
//   - 상담사C: 48% 전환율
// LOW (하위 2명):
//   - 상담사D: 45% 전환율
//   - 상담사E: 42% 전환율
```

### 할당 규칙

```
규칙: 각 레이어에서 A와 B를 균등 배치

예시 (12주):
HIGH 레이어 (상담사A, B):
  - 상담사A: Week 1-3 (A), Week 4-6 (B), Week 7-9 (A), Week 10-12 (B)
  - 상담사B: Week 1-3 (B), Week 4-6 (A), Week 7-9 (B), Week 10-12 (A)
  → 각자 A 6주, B 6주 (균등)

MIDDLE 레이어 (상담사C):
  - 상담사C: Week 1-6 (A), Week 7-12 (B)
  → A 6주, B 6주 (균등)

LOW 레이어 (상담사D, E):
  - 상담사D: Week 1-3 (B), Week 4-6 (A), Week 7-9 (B), Week 10-12 (A)
  - 상담사E: Week 1-3 (A), Week 4-6 (B), Week 7-9 (A), Week 10-12 (B)
  → 각자 A 6주, B 6주 (균등)

결과: 상담사의 능력 차이가 A/B 효과에 영향을 주지 않음
```

---

## Phase 3: 시간 교차 배치(Crossover) (1일)

### 원리

```
목표: "시간 효과"(Week 1 vs Week 12의 시장 변화) 제어

문제: 만약 Week 1-6은 상담사A=A안, 상담사B=B안이면
     "A안이 좋다" 결론이 상담사A의 능력 때문일 수도 있음

해결: 같은 상담사가 교대로 A/B를 경험하게 함 (Crossover)
```

### 구현 방식

```typescript
/**
 * Crossover 적용 예시 (상담사A, B)
 */
export interface CrossoverAssignment {
  period: "period1" | "period2" | "period3" | "period4";
  weeks: string;
  counselorA_assignment: "A" | "B";
  counselorB_assignment: "A" | "B";
}

export const CROSSOVER_SCHEDULE: CrossoverAssignment[] = [
  {
    period: "period1",
    weeks: "Week 1-3",
    counselorA_assignment: "A",
    counselorB_assignment: "B",
  },
  {
    period: "period2",
    weeks: "Week 4-6",
    counselorA_assignment: "B",
    counselorB_assignment: "A",
  },
  {
    period: "period3",
    weeks: "Week 7-9",
    counselorA_assignment: "A",
    counselorB_assignment: "B",
  },
  {
    period: "period4",
    weeks: "Week 10-12",
    counselorA_assignment: "B",
    counselorB_assignment: "A",
  },
];

// 결과: 같은 상담사가 A와 B를 모두 경험
//       시간 효과와 상담사 능력을 분리할 수 있음
```

---

## Phase 4: Monday.com 통합 (1.5일)

### API 연동 구조

```typescript
/**
 * Monday.com으로 자동 태스크 생성
 * CRM에서 매주 자동으로 상담사 할당 태스크 생성
 */

export interface MondayTask {
  title: string; // "[A/B Test - Week 1] 상담사A: A안 목표 50콜"
  boardId: string; // Monday.com board ID
  groupId: string; // "a_b_test" 그룹
  assignee: {
    id: string;
    name: string;
  };
  status: "Pending" | "In Progress" | "Done";
  week: number;
  variant: "A" | "B";
  targetCalls: number; // 50
  currentCalls: number; // 0
  dueDate: string; // 주말 날짜
}

/**
 * Week별로 Monday.com 태스크 자동 생성
 */
export async function createWeeklyMondayTasks(
  week: number,
  assignments: BlockAssignment[]
) {
  const mondayBoardId = process.env.MONDAY_AB_TEST_BOARD_ID;
  const tasks: MondayTask[] = [];
  
  for (const assignment of assignments) {
    const weekBlock = assignment.blocks[week - 1];
    
    // 이 주에 A와 B 할당을 추출
    // 각 콜별로 태스크는 아니고, 주당 1-2개 태스크만 (A안 목표, B안 목표)
    const aCallsThisWeek = weekBlock.filter(x => x === "A").length;
    const bCallsThisWeek = weekBlock.filter(x => x === "B").length;
    
    // A안 태스크
    if (aCallsThisWeek > 0) {
      tasks.push({
        title: `[A/B Test - Week ${week}] ${assignment.counselorName}: A안 목표 ${aCallsThisWeek}콜`,
        boardId: mondayBoardId,
        groupId: "a_b_test",
        assignee: {
          id: assignment.counselorId,
          name: assignment.counselorName,
        },
        status: "Pending",
        week,
        variant: "A",
        targetCalls: aCallsThisWeek,
        currentCalls: 0,
        dueDate: getWeekEndDate(week),
      });
    }
    
    // B안 태스크
    if (bCallsThisWeek > 0) {
      tasks.push({
        title: `[A/B Test - Week ${week}] ${assignment.counselorName}: B안 목표 ${bCallsThisWeek}콜`,
        boardId: mondayBoardId,
        groupId: "a_b_test",
        assignee: {
          id: assignment.counselorId,
          name: assignment.counselorName,
        },
        status: "Pending",
        week,
        variant: "B",
        targetCalls: bCallsThisWeek,
        currentCalls: 0,
        dueDate: getWeekEndDate(week),
      });
    }
  }
  
  // Monday.com API 호출
  for (const task of tasks) {
    await createMondayItem(task);
  }
  
  return tasks;
}

/**
 * Monday.com REST API 호출 (실제 구현)
 */
async function createMondayItem(task: MondayTask) {
  const mutation = `
    mutation {
      create_item(
        board_id: ${task.boardId},
        group_id: "${task.groupId}",
        item_name: "${task.title}",
        column_values: "{\\"status\\": \\"${task.status}\\", \\"week\\": \\"${task.week}\\", \\"variant\\": \\"${task.variant}\\", \\"target_calls\\": \\"${task.targetCalls}\\", \\"due_date\\": \\"${task.dueDate}\\"}"
      ) {
        id
      }
    }
  `;
  
  const response = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: process.env.MONDAY_API_KEY || "",
    },
    body: JSON.stringify({ query: mutation }),
  });
  
  return response.json();
}
```

---

## Phase 5: 12주 할당 일정 (Day 4)

### 상담사 5명 × 12주 할당 표

```
상담사 능력 (기존 데이터):
- 상담사A: 55% 전환율 (HIGH)
- 상담사B: 52% 전환율 (HIGH)
- 상담사C: 48% 전환율 (MIDDLE)
- 상담사D: 45% 전환율 (LOW)
- 상담사E: 42% 전환율 (LOW)

12주 할당 일정 (Block Random + Crossover):

┌─────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│Week │ 상담사A │ 상담사B │ 상담사C │ 상담사D │ 상담사E │
├─────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│  1  │  A, B   │  B, A   │    A    │  B, A   │  A, B   │
│  2  │  B, A   │  A, B   │    A    │  A, B   │  B, A   │
│  3  │  A, B   │  B, A   │    A    │  B, A   │  A, B   │
│  4  │  B, A   │  A, B   │    B    │  A, B   │  B, A   │ (Crossover)
│  5  │  A, B   │  B, A   │    B    │  B, A   │  A, B   │
│  6  │  B, A   │  A, B   │    B    │  A, B   │  B, A   │
│  7  │  A, B   │  B, A   │    A    │  B, A   │  A, B   │ (Period 3)
│  8  │  B, A   │  A, B   │    A    │  A, B   │  B, A   │
│  9  │  A, B   │  B, A   │    A    │  B, A   │  A, B   │
│ 10  │  B, A   │  A, B   │    B    │  A, B   │  B, A   │ (Crossover)
│ 11  │  A, B   │  B, A   │    B    │  B, A   │  A, B   │
│ 12  │  B, A   │  A, B   │    B    │  A, B   │  B, A   │
└─────┴─────────┴─────────┴─────────┴─────────┴─────────┘

통계:
- 각 상담사의 A 할당: 24-26회 (약 50%)
- 각 상담사의 B 할당: 22-24회 (약 50%)
- 총 콜: 200콜 (주당 50콜 × 12주) ÷ 5명 = 상담사당 40콜
  주당 4콜 정도 (2A + 2B, 또는 다양한 조합)
```

### Monday.com 대시보드 예시

```
[ A/B Test - Week 1 ]

┌─────────────────────────────────────┬────────┬────────┐
│ 태스크                              │ 진행도 │ 기한   │
├─────────────────────────────────────┼────────┼────────┤
│ [A/B Test - W1] 상담사A: A안 2콜   │ 1/2    │ 5/25   │
│ [A/B Test - W1] 상담사A: B안 2콜   │ 2/2    │ 5/25   │
│ [A/B Test - W1] 상담사B: B안 2콜   │ 0/2    │ 5/25   │
│ [A/B Test - W1] 상담사B: A안 2콜   │ 1/2    │ 5/25   │
│ [A/B Test - W1] 상담사C: A안 4콜   │ 3/4    │ 5/25   │
│ [A/B Test - W1] 상담사D: B안 2콜   │ 2/2    │ 5/25   │
│ [A/B Test - W1] 상담사D: A안 2콜   │ 1/2    │ 5/25   │
│ [A/B Test - W1] 상담사E: A안 2콜   │ 0/2    │ 5/25   │
│ [A/B Test - W1] 상담사E: B안 2콜   │ 1/2    │ 5/25   │
└─────────────────────────────────────┴────────┴────────┘

주간 요약:
- Week 1 진행도: 13/20 (65%)
- A안 콜: 10 / B안 콜: 10
- 예상 완료: 5월 25일
```

---

## Phase 6: 성공 기준

✅ Block Randomization 공식 검증
  - 각 상담사가 A 24-26회, B 22-24회 할당 (±1회 오차)

✅ Stratification 적용 확인
  - HIGH/MIDDLE/LOW 레이어별로 A/B 균등 분배
  - 상담사 능력과 A/B 효과의 correlation = 0 (이상적)

✅ Crossover 스케줄 확인
  - 같은 상담사가 A와 B를 모두 경험
  - 시간 효과 제어 가능

✅ Monday.com API 통합
  - Week 1 태스크 10개 자동 생성 성공
  - 상담사별 진행도 추적 가능

✅ 12주 할당 일정 확정
  - 모든 상담사의 A/B 비율 50:50 달성
  - Week 2부터 배포 준비 완료

---

## 타임라인

- **Day 1-2 (5월 22-23):** Block Randomization + Stratification 구현
- **Day 2-3 (5월 23-24):** Crossover 설계 + 12주 일정 생성
- **Day 3-4 (5월 24-25):** Monday.com API 테스트 + Week 1 배포
- **Day 5 이후 (5월 26+):** 주간 태스크 자동 생성 + 진행도 모니터링

---

## 참고 자료

### 통계 용어 설명

```
Block Randomization: 
  - 블록 단위로 무작위 배치하되, 각 블록 내에서 비율 고정
  - 선택 편향(Selection Bias) 제거

Stratification:
  - 사전 정보(상담사 능력)를 기반으로 층화
  - 교락 변수(Confounding Variable) 제어

Crossover Design:
  - 같은 피험자가 여러 조건을 경험
  - 개인 간 변동성(Between-subject variance) 제거
  - 더 정확한 효과 추정
```

### 예상 통계 파워

```
설정:
- 샘플 크기: 200콜
- 각 상담사별: 40콜
- 각 조건별: 100콜 (A 또는 B)

기대 효과:
- A안 전환율: 65%
- B안 전환율: 58%
- 효과 크기: Cohen's h = 0.15 (작은 효과)

통계 파워:
- α = 0.05 (신뢰도 95%)
- 파워 = 0.80 (80%)
- 필요 샘플: 약 160-200콜 ✓ (충분함)

결론: 200콜로 통계적으로 유의한 차이 감지 가능
```
