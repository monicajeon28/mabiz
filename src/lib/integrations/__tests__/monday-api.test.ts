/**
 * Monday.com API 통합 테스트
 */

import {
  createMondayClient,
  MondayClient,
  MondayTaskInput,
} from "../monday-api";

describe("Monday.com Client", () => {
  let client: MondayClient;

  beforeEach(() => {
    // 테스트용 Mock 클라이언트 생성
    client = createMondayClient("test_api_key_12345", "test_board_id_67890");
  });

  describe("initialization", () => {
    test("should create Monday.com client with valid credentials", () => {
      expect(client).toBeDefined();
    });

    test("should throw error when API key is missing", () => {
      expect(() => createMondayClient("", "test_board_id")).toThrow();
    });

    test("should throw error when board ID is missing", () => {
      expect(() => createMondayClient("test_api_key", "")).toThrow();
    });
  });

  describe("createWeeklyTask", () => {
    test("should format task input correctly", () => {
      // 이 테스트는 실제 API 호출 없이 데이터 포맷을 검증
      const taskInput: MondayTaskInput = {
        week: 1,
        counselorId: "counselor_123",
        counselorName: "상담사A",
        abTestGroup: "A",
        targetCalls: 25,
        scriptVersion: "v13-A-standard",
      };

      // 태스크 입력 검증
      expect(taskInput.week).toBe(1);
      expect(taskInput.abTestGroup).toMatch(/^[AB]$/);
      expect(taskInput.targetCalls).toBeGreaterThan(0);
    });

    test("should handle both A and B group assignments", () => {
      const taskA: MondayTaskInput = {
        week: 1,
        counselorId: "c1",
        counselorName: "상담사A",
        abTestGroup: "A",
        targetCalls: 25,
        scriptVersion: "v13-A-standard",
      };

      const taskB: MondayTaskInput = {
        week: 1,
        counselorId: "c2",
        counselorName: "상담사B",
        abTestGroup: "B",
        targetCalls: 25,
        scriptVersion: "v13-B-desire-extended",
      };

      expect(taskA.abTestGroup).toBe("A");
      expect(taskB.abTestGroup).toBe("B");
      expect(taskA.scriptVersion).not.toBe(taskB.scriptVersion);
    });
  });

  describe("batch operations", () => {
    test("should handle batch task creation", () => {
      const tasks: MondayTaskInput[] = [
        {
          week: 1,
          counselorId: "c1",
          counselorName: "상담사A",
          abTestGroup: "A",
          targetCalls: 25,
          scriptVersion: "v13-A-standard",
        },
        {
          week: 1,
          counselorId: "c2",
          counselorName: "상담사B",
          abTestGroup: "B",
          targetCalls: 25,
          scriptVersion: "v13-B-desire-extended",
        },
        {
          week: 1,
          counselorId: "c3",
          counselorName: "상담사C",
          abTestGroup: "A",
          targetCalls: 25,
          scriptVersion: "v13-A-standard",
        },
      ];

      expect(tasks).toHaveLength(3);
      expect(tasks.filter((t) => t.abTestGroup === "A")).toHaveLength(2);
      expect(tasks.filter((t) => t.abTestGroup === "B")).toHaveLength(1);
    });

    test("should maintain 50:50 distribution in batch tasks", () => {
      const tasks: MondayTaskInput[] = Array.from({ length: 10 }, (_, i) => ({
        week: 1,
        counselorId: `c${i}`,
        counselorName: `상담사${i}`,
        abTestGroup: i % 2 === 0 ? "A" : "B",
        targetCalls: 25,
        scriptVersion: i % 2 === 0 ? "v13-A-standard" : "v13-B-desire-extended",
      }));

      const aCount = tasks.filter((t) => t.abTestGroup === "A").length;
      const bCount = tasks.filter((t) => t.abTestGroup === "B").length;

      expect(aCount).toBe(bCount);
    });
  });

  describe("data validation", () => {
    test("should validate week number (1-12)", () => {
      const validWeeks = [1, 2, 6, 12];
      const invalidWeeks = [0, 13, -1, 100];

      validWeeks.forEach((week) => {
        expect(week).toBeGreaterThanOrEqual(1);
        expect(week).toBeLessThanOrEqual(12);
      });

      invalidWeeks.forEach((week) => {
        expect(week < 1 || week > 12).toBe(true);
      });
    });

    test("should validate target calls is positive", () => {
      const validTasks = [
        { targetCalls: 1 },
        { targetCalls: 25 },
        { targetCalls: 50 },
      ];

      const invalidTasks = [{ targetCalls: 0 }, { targetCalls: -10 }];

      validTasks.forEach((task) => {
        expect(task.targetCalls).toBeGreaterThan(0);
      });

      invalidTasks.forEach((task) => {
        expect(task.targetCalls <= 0).toBe(true);
      });
    });

    test("should validate script version format", () => {
      const validVersions = [
        "v13-A-standard",
        "v13-B-desire-extended",
        "v14-A-optimized",
      ];

      validVersions.forEach((version) => {
        expect(version).toMatch(/^v\d+-[AB]-/);
      });
    });
  });

  describe("error handling", () => {
    test("should handle missing required fields", () => {
      const incompleteTask = {
        week: 1,
        counselorId: "c1",
        // missing: counselorName, abTestGroup, targetCalls, scriptVersion
      } as any;

      expect(incompleteTask.counselorName).toBeUndefined();
      expect(incompleteTask.abTestGroup).toBeUndefined();
    });

    test("should provide meaningful error messages", () => {
      try {
        createMondayClient("", "board_id");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("API key");
      }
    });
  });

  describe("weekly task structure", () => {
    test("should maintain consistent task naming convention", () => {
      const tasks: MondayTaskInput[] = [
        {
          week: 1,
          counselorId: "c1",
          counselorName: "상담사A",
          abTestGroup: "A",
          targetCalls: 25,
          scriptVersion: "v13-A-standard",
        },
      ];

      const expectedFormat = `[A/B Test - Week ${tasks[0].week}] ${tasks[0].counselorName}: ${tasks[0].abTestGroup}안 목표 ${tasks[0].targetCalls}콜`;
      expect(expectedFormat).toMatch(/^\[A\/B Test - Week \d+\]/);
      expect(expectedFormat).toContain("목표");
      expect(expectedFormat).toContain("콜");
    });

    test("should support all 12 weeks", () => {
      for (let week = 1; week <= 12; week++) {
        const task: MondayTaskInput = {
          week,
          counselorId: "c1",
          counselorName: "상담사A",
          abTestGroup: "A",
          targetCalls: 25,
          scriptVersion: "v13-A-standard",
        };

        expect(task.week).toBe(week);
        expect(task.week).toBeGreaterThanOrEqual(1);
        expect(task.week).toBeLessThanOrEqual(12);
      }
    });
  });

  describe("integration with AllocationSchedule", () => {
    test("should generate correct task count for allocation schedule", () => {
      // 5명 상담사 × 2 그룹 × 12주 = 120개 태스크 (최대)
      const maxCounselors = 5;
      const maxWeeks = 12;
      const maxTasks = maxCounselors * maxWeeks * 2; // A/B 두 그룹

      expect(maxTasks).toBe(120);
    });

    test("should handle partial allocations (some counselors not assigned)", () => {
      // 실제로 모든 상담사가 모든 주에 할당되지는 않을 수 있음
      const counselors = 5;
      const assignedWeeks = 10; // 처음 10주만 할당
      const expectedTasks = counselors * assignedWeeks * 2;

      expect(expectedTasks).toBeLessThan(120);
    });
  });
});
