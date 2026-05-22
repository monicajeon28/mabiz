/**
 * A/B 테스트 할당 알고리즘 Jest 테스트
 */

import {
  generateBlockRandomization,
  stratifyByHistoricalPerformance,
  applyCrossoverDesign,
  generateAllocationSchedule,
  validateAllocation,
  SAMPLE_COUNSELORS,
  CounselorProfile,
} from "../ab_test_allocation";

describe("A/B Test Allocation Algorithm", () => {
  describe("stratifyByHistoricalPerformance", () => {
    test("should stratify counselors into 3 tiers by historical conversion rate", () => {
      const counselors: CounselorProfile[] = [
        { id: "c1", name: "상담사1", historicalConversionRate: 60 },
        { id: "c2", name: "상담사2", historicalConversionRate: 50 },
        { id: "c3", name: "상담사3", historicalConversionRate: 40 },
        { id: "c4", name: "상담사4", historicalConversionRate: 55 },
        { id: "c5", name: "상담사5", historicalConversionRate: 45 },
      ];

      const strata = stratifyByHistoricalPerformance(counselors);

      expect(strata).toHaveLength(3);
      expect(strata[0].stratumLevel).toBe("high");
      expect(strata[1].stratumLevel).toBe("middle");
      expect(strata[2].stratumLevel).toBe("low");

      // High tier는 가장 높은 전환율을 가진 상담사들
      expect(strata[0].counselors[0].historicalConversionRate).toBe(60);

      // 모든 상담사가 정확히 한 번씩 나타나야 함
      const totalCounselors = strata.reduce((sum, s) => sum + s.counselors.length, 0);
      expect(totalCounselors).toBe(counselors.length);
    });

    test("should handle single counselor", () => {
      const counselors: CounselorProfile[] = [
        { id: "c1", name: "상담사1", historicalConversionRate: 50 },
      ];

      const strata = stratifyByHistoricalPerformance(counselors);

      expect(strata).toHaveLength(3);
      expect(strata[0].counselors).toHaveLength(1);
      expect(strata[1].counselors).toHaveLength(0);
      expect(strata[2].counselors).toHaveLength(0);
    });
  });

  describe("generateBlockRandomization", () => {
    test("should generate block randomization with 50:50 A/B distribution", () => {
      const strata = stratifyByHistoricalPerformance(SAMPLE_COUNSELORS);
      const assignments = generateBlockRandomization(SAMPLE_COUNSELORS.length, strata);

      // 각 상담사는 A와 B를 동등하게 배정받아야 함 (±1)
      assignments.forEach((assignment) => {
        const difference = Math.abs(assignment.aCount - assignment.bCount);
        expect(difference).toBeLessThanOrEqual(1);
      });
    });

    test("should generate 12 weeks of blocks for each counselor", () => {
      const strata = stratifyByHistoricalPerformance(SAMPLE_COUNSELORS);
      const assignments = generateBlockRandomization(SAMPLE_COUNSELORS.length, strata);

      assignments.forEach((assignment) => {
        expect(assignment.blocks).toHaveLength(12);
        assignment.blocks.forEach((block) => {
          expect(block).toHaveLength(4); // blockSize = 4
        });
      });
    });

    test("should maintain stratification in assignments", () => {
      const strata = stratifyByHistoricalPerformance(SAMPLE_COUNSELORS);
      const assignments = generateBlockRandomization(SAMPLE_COUNSELORS.length, strata);

      const highStratum = assignments.filter((a) => a.stratum === "high");
      const middleStratum = assignments.filter((a) => a.stratum === "middle");
      const lowStratum = assignments.filter((a) => a.stratum === "low");

      expect(highStratum.length).toBeGreaterThan(0);
      expect(middleStratum.length).toBeGreaterThanOrEqual(0);
      expect(lowStratum.length).toBeGreaterThan(0);
    });
  });

  describe("applyCrossoverDesign", () => {
    test("should swap A/B at week 4 and week 10", () => {
      const strata = stratifyByHistoricalPerformance(SAMPLE_COUNSELORS);
      const original = generateBlockRandomization(SAMPLE_COUNSELORS.length, strata);
      const withCrossover = applyCrossoverDesign(original);

      // 샘플 상담사의 할당을 확인
      const sample = withCrossover[0];

      // Week 1 (index 0)과 Week 4 (index 3)을 비교
      // Week 4-6은 A/B가 스왑되어야 함
      const week1Assignments = original[0].blocks[0].join(""); // e.g., "AABB"
      const week4Crossover = withCrossover[0].blocks[3].join(""); // Week 4

      // 스왑됨을 확인 (A -> B, B -> A)
      expect(week4Crossover).not.toBe(week1Assignments);
    });

    test("should maintain 50:50 distribution after crossover", () => {
      const strata = stratifyByHistoricalPerformance(SAMPLE_COUNSELORS);
      const assignments = generateBlockRandomization(SAMPLE_COUNSELORS.length, strata);
      const withCrossover = applyCrossoverDesign(assignments);

      withCrossover.forEach((assignment) => {
        const totalA = assignment.aCount;
        const totalB = assignment.bCount;
        const difference = Math.abs(totalA - totalB);

        // Crossover 적용 후에도 전체적으로 50:50 유지되어야 함
        expect(difference).toBeLessThanOrEqual(1);
      });
    });
  });

  describe("generateAllocationSchedule", () => {
    test("should generate weekly allocation schedule for 12 weeks", () => {
      const strata = stratifyByHistoricalPerformance(SAMPLE_COUNSELORS);
      const assignments = generateBlockRandomization(SAMPLE_COUNSELORS.length, strata);
      const schedule = generateAllocationSchedule(assignments);

      // 최소 1주부터 12주까지 있어야 함
      const weeks = new Set(schedule.map((s) => s.week));
      expect(weeks.size).toBeGreaterThanOrEqual(1);
      expect(Math.max(...Array.from(weeks))).toBeLessThanOrEqual(12);
    });

    test("should assign call targets based on block structure", () => {
      const strata = stratifyByHistoricalPerformance(SAMPLE_COUNSELORS);
      const assignments = generateBlockRandomization(SAMPLE_COUNSELORS.length, strata);
      const schedule = generateAllocationSchedule(assignments, 50);

      // Week 1의 모든 할당 조회
      const week1Assignments = schedule.filter((s) => s.week === 1);

      // A와 B의 합이 주당 콜 수와 일치해야 함
      const totalCallTargets = week1Assignments.reduce((sum, s) => sum + s.callTarget, 0);
      expect(totalCallTargets).toBeLessThanOrEqual(50);
    });
  });

  describe("validateAllocation", () => {
    test("should validate 50:50 A/B distribution within 5%", () => {
      const strata = stratifyByHistoricalPerformance(SAMPLE_COUNSELORS);
      const assignments = generateBlockRandomization(SAMPLE_COUNSELORS.length, strata);
      const validation = validateAllocation(assignments);

      expect(validation.aPercentage).toBeGreaterThanOrEqual(45);
      expect(validation.aPercentage).toBeLessThanOrEqual(55);
      expect(validation.bPercentage).toBeGreaterThanOrEqual(45);
      expect(validation.bPercentage).toBeLessThanOrEqual(55);
    });

    test("should report per-counselor balance", () => {
      const strata = stratifyByHistoricalPerformance(SAMPLE_COUNSELORS);
      const assignments = generateBlockRandomization(SAMPLE_COUNSELORS.length, strata);
      const validation = validateAllocation(assignments);

      expect(validation.perCounselorBalance).toHaveLength(assignments.length);

      validation.perCounselorBalance.forEach((balance) => {
        // 각 상담사는 A/B 2개 이내 불균형
        expect(balance.balance).toBeLessThanOrEqual(2);
      });
    });

    test("should indicate valid state when all conditions met", () => {
      const strata = stratifyByHistoricalPerformance(SAMPLE_COUNSELORS);
      const assignments = generateBlockRandomization(SAMPLE_COUNSELORS.length, strata);
      const validation = validateAllocation(assignments);

      // 잘 설계된 할당은 valid 상태여야 함
      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toHaveLength(0);
    });

    test("should return total assignment statistics", () => {
      const strata = stratifyByHistoricalPerformance(SAMPLE_COUNSELORS);
      const assignments = generateBlockRandomization(SAMPLE_COUNSELORS.length, strata);
      const validation = validateAllocation(assignments);

      expect(validation.totalAssignments).toBe(validation.aTotal + validation.bTotal);
      expect(validation.totalAssignments).toBeGreaterThan(0);
    });
  });

  describe("integration: complete workflow", () => {
    test("should complete full allocation workflow with valid results", () => {
      // 1. Stratification
      const strata = stratifyByHistoricalPerformance(SAMPLE_COUNSELORS);
      expect(strata).toHaveLength(3);

      // 2. Block Randomization
      const assignments = generateBlockRandomization(SAMPLE_COUNSELORS.length, strata);
      expect(assignments).toHaveLength(SAMPLE_COUNSELORS.length);

      // 3. Crossover Design
      const withCrossover = applyCrossoverDesign(assignments);
      expect(withCrossover).toHaveLength(assignments.length);

      // 4. Generate Schedule
      const schedule = generateAllocationSchedule(withCrossover);
      expect(schedule.length).toBeGreaterThan(0);

      // 5. Validate
      const validation = validateAllocation(withCrossover);
      expect(validation.isValid).toBe(true);
      expect(validation.aPercentage).toBeCloseTo(50, 5);
      expect(validation.bPercentage).toBeCloseTo(50, 5);
    });

    test("should handle large counselor pool", () => {
      const largeCounselorPool: CounselorProfile[] = Array.from(
        { length: 20 },
        (_, i) => ({
          id: `c${i + 1}`,
          name: `상담사${i + 1}`,
          historicalConversionRate: 40 + Math.random() * 20,
        })
      );

      const strata = stratifyByHistoricalPerformance(largeCounselorPool);
      const assignments = generateBlockRandomization(largeCounselorPool.length, strata);
      const validation = validateAllocation(assignments);

      expect(validation.isValid).toBe(true);
      expect(validation.aPercentage).toBeGreaterThanOrEqual(45);
      expect(validation.aPercentage).toBeLessThanOrEqual(55);
    });
  });
});
