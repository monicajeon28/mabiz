/**
 * A/B 테스트 할당 알고리즘
 * Track D: 200콜 A/B 테스트 (12주)
 *
 * 기능:
 * 1. Block Randomization: 각 상담사가 A/B를 50:50으로 경험
 * 2. Stratification: 상담사 능력별로 A/B 균등 분배
 * 3. Crossover: 시간 효과 제어
 * 4. Monday.com 통합: 주간 태스크 자동 생성
 */

export interface CounselorProfile {
  id: string;
  name: string;
  historicalConversionRate: number; // 0-100 (%)
}

export interface BlockAssignment {
  counselorId: string;
  counselorName: string;
  blocks: string[][]; // 주당 블록 배열 [["A", "B", "A", "B"], ...]
  totalAssignments: number;
  aCount: number;
  bCount: number;
  stratum: "high" | "middle" | "low";
}

export interface CounselorStratum {
  stratumLevel: "high" | "middle" | "low";
  counselors: CounselorProfile[];
}

export interface AllocationSchedule {
  week: number;
  counselor: CounselorProfile;
  assignment: "A" | "B";
  callTarget: number;
}

/**
 * Block Randomization을 사용하여 A/B 할당
 * 각 상담사가 동일하게 A/B를 50:50으로 경험하도록 함
 *
 * @param numCounselors 상담사 수
 * @param blockSize 블록 크기 (기본값: 4)
 * @param numWeeks 주 수 (기본값: 12)
 * @returns Block 할당 결과
 */
export function generateBlockRandomization(
  numCounselors: number,
  strata: CounselorStratum[],
  blockSize: number = 4,
  numWeeks: number = 12
): BlockAssignment[] {
  const assignments: BlockAssignment[] = [];

  // 각 Stratum별로 상담사를 처리
  for (const stratum of strata) {
    for (const counselor of stratum.counselors) {
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
        totalA += block.filter((x) => x === "A").length;
        totalB += block.filter((x) => x === "B").length;
      }

      assignments.push({
        counselorId: counselor.id,
        counselorName: counselor.name,
        blocks,
        totalAssignments: totalA + totalB,
        aCount: totalA,
        bCount: totalB,
        stratum: stratum.stratumLevel,
      });
    }
  }

  return assignments;
}

/**
 * 기존 4주 데이터에서 상담사별 평균 전환율을 기반으로 Stratification
 *
 * @param counselors 상담사 프로필 (historicalConversionRate 포함)
 * @returns Stratum 분류 결과
 */
export function stratifyByHistoricalPerformance(
  counselors: CounselorProfile[]
): CounselorStratum[] {
  // 1. 상담사를 전환율 순으로 정렬 (높은 순서대로)
  const sorted = [...counselors].sort(
    (a, b) => b.historicalConversionRate - a.historicalConversionRate
  );

  // 2. 3개 레이어로 나누기
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

/**
 * Crossover 적용: 같은 상담사가 여러 기간에서 A/B를 교대로 경험
 *
 * @param assignments Block Randomization 결과
 * @returns Crossover 적용된 할당
 */
export function applyCrossoverDesign(
  assignments: BlockAssignment[]
): BlockAssignment[] {
  // Crossover 기간 정의 (4개 기간, 3주씩)
  const CROSSOVER_PERIODS = [
    { start: 0, end: 3, swapPeriod: 2 }, // Period 1-2: Week 1-6
    { start: 3, end: 6, swapPeriod: 1 }, // Period 2 swap at week 4
    { start: 6, end: 9, swapPeriod: 2 }, // Period 3-4: Week 7-12
    { start: 9, end: 12, swapPeriod: 1 },
  ];

  const crossoverAssignments = assignments.map((assignment) => {
    const newBlocks = [...assignment.blocks];

    // Crossover 적용: Period 2와 Period 4에서 A/B 스왑
    for (let week = 3; week < 6; week++) {
      // Week 4-6 (Period 2)
      newBlocks[week] = newBlocks[week].map((x) => (x === "A" ? "B" : "A"));
    }
    for (let week = 9; week < 12; week++) {
      // Week 10-12 (Period 4)
      newBlocks[week] = newBlocks[week].map((x) => (x === "A" ? "B" : "A"));
    }

    return {
      ...assignment,
      blocks: newBlocks,
    };
  });

  return crossoverAssignments;
}

/**
 * 12주 할당 일정 생성
 *
 * @param assignments Block Randomization 결과
 * @param callsPerWeek 주당 콜 수 (기본값: 50)
 * @returns 주별 할당 일정
 */
export function generateAllocationSchedule(
  assignments: BlockAssignment[],
  callsPerWeek: number = 50
): AllocationSchedule[] {
  const schedule: AllocationSchedule[] = [];
  const numCounselors = assignments.length;
  const callsPerCounselor = callsPerWeek / numCounselors;

  // 주별 반복
  for (let week = 0; week < 12; week++) {
    // 상담사별 반복
    for (const assignment of assignments) {
      const blockForWeek = assignment.blocks[week];

      // 이 주에 A와 B 비율 계산
      const aCount = blockForWeek.filter((x) => x === "A").length;
      const bCount = blockForWeek.filter((x) => x === "B").length;

      // A 할당
      if (aCount > 0) {
        schedule.push({
          week: week + 1,
          counselor: {
            id: assignment.counselorId,
            name: assignment.counselorName,
            historicalConversionRate: 0, // 실제 값은 DB에서 로드
          },
          assignment: "A",
          callTarget: Math.round((callsPerCounselor * aCount) / 4),
        });
      }

      // B 할당
      if (bCount > 0) {
        schedule.push({
          week: week + 1,
          counselor: {
            id: assignment.counselorId,
            name: assignment.counselorName,
            historicalConversionRate: 0,
          },
          assignment: "B",
          callTarget: Math.round((callsPerCounselor * bCount) / 4),
        });
      }
    }
  }

  return schedule;
}

/**
 * 할당 결과의 균형 검증
 *
 * @param assignments Block Randomization 결과
 * @returns 검증 결과
 */
export interface AllocationValidation {
  isValid: boolean;
  totalAssignments: number;
  aTotal: number;
  bTotal: number;
  aPercentage: number;
  bPercentage: number;
  perCounselorBalance: {
    counselorName: string;
    aCount: number;
    bCount: number;
    balance: number;
  }[];
  warnings: string[];
}

export function validateAllocation(
  assignments: BlockAssignment[]
): AllocationValidation {
  const totalA = assignments.reduce((sum, a) => sum + a.aCount, 0);
  const totalB = assignments.reduce((sum, a) => sum + a.bCount, 0);
  const total = totalA + totalB;

  const perCounselorBalance = assignments.map((a) => ({
    counselorName: a.counselorName,
    aCount: a.aCount,
    bCount: a.bCount,
    balance: Math.abs(a.aCount - a.bCount),
  }));

  const warnings: string[] = [];

  // A/B 비율 검증 (50:50 ±5%)
  const aPercentage = (totalA / total) * 100;
  if (Math.abs(aPercentage - 50) > 5) {
    warnings.push(`전체 A/B 비율이 50:50에서 벗어남 (A: ${aPercentage.toFixed(1)}%)`);
  }

  // 상담사별 균형 검증 (±2)
  for (const balance of perCounselorBalance) {
    if (balance.balance > 2) {
      warnings.push(
        `${balance.counselorName}의 A/B 불균형: A${balance.aCount}, B${balance.bCount}`
      );
    }
  }

  return {
    isValid: warnings.length === 0,
    totalAssignments: total,
    aTotal: totalA,
    bTotal: totalB,
    aPercentage: (totalA / total) * 100,
    bPercentage: (totalB / total) * 100,
    perCounselorBalance,
    warnings,
  };
}

/**
 * 테스트용 기본 데이터
 */
export const SAMPLE_COUNSELORS: CounselorProfile[] = [
  { id: "counselor_1", name: "상담사A", historicalConversionRate: 55 },
  { id: "counselor_2", name: "상담사B", historicalConversionRate: 52 },
  { id: "counselor_3", name: "상담사C", historicalConversionRate: 48 },
  { id: "counselor_4", name: "상담사D", historicalConversionRate: 45 },
  { id: "counselor_5", name: "상담사E", historicalConversionRate: 42 },
];

/**
 * 실행 예시
 */
export function exampleExecution() {
  console.log("=== A/B Test Allocation Algorithm ===\n");

  // 1. Stratification
  const strata = stratifyByHistoricalPerformance(SAMPLE_COUNSELORS);
  console.log("1. Stratification 결과:");
  strata.forEach((stratum) => {
    console.log(`   ${stratum.stratumLevel.toUpperCase()}:`);
    stratum.counselors.forEach((c) => {
      console.log(`     - ${c.name}: ${c.historicalConversionRate}% 전환율`);
    });
  });

  // 2. Block Randomization
  const assignments = generateBlockRandomization(
    SAMPLE_COUNSELORS.length,
    strata
  );
  console.log("\n2. Block Randomization 결과 (Week 1-3 예시):");
  assignments.slice(0, 2).forEach((a) => {
    console.log(
      `   ${a.counselorName}: [${a.blocks[0].join(", ")}] (Week 1)`
    );
  });

  // 3. Crossover 적용
  const withCrossover = applyCrossoverDesign(assignments);
  console.log("\n3. Crossover 적용 결과 (Week 1-6 예시):");
  const sample = withCrossover[0];
  console.log(
    `   ${sample.counselorName}: Week 1-3 ${sample.blocks[0].join("")}, Week 4-6 ${sample.blocks[3].join("")}`
  );

  // 4. 검증
  const validation = validateAllocation(withCrossover);
  console.log("\n4. 균형 검증:");
  console.log(`   전체: A${validation.aTotal}, B${validation.bTotal}`);
  console.log(`   비율: A ${validation.aPercentage.toFixed(1)}%, B ${validation.bPercentage.toFixed(1)}%`);
  console.log(`   상태: ${validation.isValid ? "✓ 균형 잡힘" : "✗ 문제 있음"}`);

  // 5. 일정 생성
  const schedule = generateAllocationSchedule(withCrossover);
  console.log("\n5. 12주 할당 일정 (Week 1 예시):");
  schedule
    .filter((s) => s.week === 1)
    .forEach((s) => {
      console.log(
        `   Week 1: ${s.counselor.name} - ${s.assignment}안 목표 ${s.callTarget}콜`
      );
    });
}
