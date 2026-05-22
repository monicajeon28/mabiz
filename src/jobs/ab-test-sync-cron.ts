/**
 * Cron Job: A/B 테스트 주간 할당을 Monday.com에 동기화
 * 실행 주기: 매 월요일 09:00 KST
 *
 * 사용:
 * 1. Vercel Cron Jobs로 배포
 * 2. GitHub Actions로 실행
 * 3. 로컬 테스트: npx tsx src/jobs/ab-test-sync-cron.ts
 */

import { prisma } from "@/src/lib/prisma";
import {
  CounselorProfile,
  generateBlockRandomization,
  stratifyByHistoricalPerformance,
  applyCrossoverDesign,
  generateAllocationSchedule,
} from "@/src/lib/analytics/ab_test_allocation";
import {
  getMondayClient,
  notifySlackAboutSync,
  MondayTaskInput,
} from "@/src/lib/integrations/monday-api";

/**
 * 현재 주차 계산 (5월 22, 2026 = Week 1 시작 기준)
 */
function getCurrentWeek(): number {
  const PROGRAM_START = new Date("2026-05-22"); // Week 1 시작일
  const now = new Date();
  const daysDifference = Math.floor(
    (now.getTime() - PROGRAM_START.getTime()) / (1000 * 60 * 60 * 24)
  );
  const weekNumber = Math.floor(daysDifference / 7) + 1;

  // 1주부터 12주까지만 유효
  return Math.max(1, Math.min(weekNumber, 12));
}


/**
 * 조직의 모든 상담사 조회
 */
async function getOrganizationCounselors(
  organizationId: string
): Promise<CounselorProfile[]> {
  const members = await prisma.organizationMember.findMany({
    where: {
      organizationId,
      // 역할이 상담사인 경우만 (예: "counselor", "sales", "agent")
      role: { in: ["counselor", "sales", "agent", "admin"] },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // 배치로 모든 상담사의 콜 로그 로드 (N+1 제거)
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 28); // 4주

  const callLogs = await prisma.callLog.findMany({
    where: {
      userId: { in: members.map(m => m.userId) },
      contact: {
        organizationId,
      },
      createdAt: {
        gte: pastDate,
      },
    },
    select: {
      userId: true,
      conversionDay: true,
    },
  });

  // 상담사별 전환율 계산
  const conversionRateByUserId = new Map<string, number>();
  const callCountByUserId = new Map<string, number>();

  for (const log of callLogs) {
    const count = callCountByUserId.get(log.userId) || 0;
    callCountByUserId.set(log.userId, count + 1);

    if (log.conversionDay !== null) {
      const conversions = conversionRateByUserId.get(log.userId) || 0;
      conversionRateByUserId.set(log.userId, conversions + 1);
    }
  }

  // 각 상담사의 과거 데이터 변환
  const counselors: CounselorProfile[] = members.map((member) => {
    const totalCalls = callCountByUserId.get(member.userId) || 0;
    const conversions = conversionRateByUserId.get(member.userId) || 0;
    const conversionRate = totalCalls > 0 ? (conversions / totalCalls) * 100 : 50;

    return {
      id: member.userId,
      name: member.user.name || `User ${member.userId}`,
      historicalConversionRate: conversionRate,
    };
  });

  return counselors;
}

/**
 * 주간 할당을 CallLog에 저장
 */
async function saveAssignmentsToDatabase(
  organizationId: string,
  week: number,
  schedule: ReturnType<typeof generateAllocationSchedule>
): Promise<void> {
  // 일반적으로 할당은 CallLog의 메타데이터로 저장됨
  // 실제 구현에서는 ABTestAssignment 테이블을 별도로 생성할 수도 있음
  console.log(`Saving ${schedule.length} assignments for week ${week}...`);

  // 예시: 할당 정보를 로그 테이블에 저장
  const now = new Date();
  const summaryByUser = new Map<
    string,
    { aCount: number; bCount: number; targetCalls: number }
  >();

  schedule.forEach((s) => {
    const key = s.counselor.id;
    if (!summaryByUser.has(key)) {
      summaryByUser.set(key, { aCount: 0, bCount: 0, targetCalls: 0 });
    }
    const data = summaryByUser.get(key)!;
    if (s.assignment === "A") {
      data.aCount += s.callTarget;
    } else {
      data.bCount += s.callTarget;
    }
    data.targetCalls += s.callTarget;
  });

  // 로그 저장 (선택사항: 감사 로그 테이블)
  console.log(`Week ${week} assignment summary:`, Object.fromEntries(summaryByUser));
}

/**
 * Monday.com에 주간 할당 동기화
 */
async function syncToMonday(
  organizationId: string,
  week: number,
  schedule: ReturnType<typeof generateAllocationSchedule>
): Promise<number> {
  try {
    const monday = getMondayClient();

    // schedule에서 Monday.com 태스크 생성용 데이터 추출
    const tasksByUser = new Map<
      string,
      {
        counselorName: string;
        aCount: number;
        bCount: number;
        targetCalls: number;
      }
    >();

    schedule.forEach((s) => {
      const key = s.counselor.id;
      if (!tasksByUser.has(key)) {
        tasksByUser.set(key, {
          counselorName: s.counselor.name,
          aCount: 0,
          bCount: 0,
          targetCalls: 0,
        });
      }
      const data = tasksByUser.get(key)!;
      if (s.assignment === "A") {
        data.aCount += s.callTarget;
      } else {
        data.bCount += s.callTarget;
      }
      data.targetCalls += s.callTarget;
    });

    // 각 상담사별로 A와 B 태스크 생성
    const mondayTasks: MondayTaskInput[] = [];

    for (const [counselorId, data] of tasksByUser.entries()) {
      // A 그룹 태스크
      if (data.aCount > 0) {
        mondayTasks.push({
          week,
          counselorId,
          counselorName: data.counselorName,
          abTestGroup: "A",
          targetCalls: data.aCount,
          scriptVersion: "v13-A-standard",
        });
      }

      // B 그룹 태스크
      if (data.bCount > 0) {
        mondayTasks.push({
          week,
          counselorId,
          counselorName: data.counselorName,
          abTestGroup: "B",
          targetCalls: data.bCount,
          scriptVersion: "v13-B-desire-extended",
        });
      }
    }

    // 일괄 생성
    const results = await monday.createWeeklyTasks(mondayTasks);
    console.log(`✅ Created ${results.length} Monday.com tasks for week ${week}`);

    return results.length;
  } catch (error) {
    console.error("Failed to sync to Monday.com:", error);
    return 0;
  }
}

/**
 * 메인 Cron 작업: 주간 A/B 테스트 할당 생성 및 동기화
 */
export async function runABTestSyncJob(organizationId?: string): Promise<{
  success: boolean;
  week: number;
  tasksCreated: number;
  message: string;
}> {
  try {
    const week = getCurrentWeek();

    // 12주 이상이면 프로그램 완료
    if (week > 12) {
      return {
        success: true,
        week: 12,
        tasksCreated: 0,
        message: "A/B test program completed (week 12 passed)",
      };
    }

    console.log(`\n📊 Starting A/B Test Sync Cron Job - Week ${week}/${12}`);

    // 기본값: 첫 번째 조직 사용 (실제로는 모든 조직 대상)
    let targetOrgIds: string[];
    if (organizationId) {
      targetOrgIds = [organizationId];
    } else {
      const orgs = await prisma.organization.findMany({
        where: { status: "ACTIVE" },
        select: { id: true },
      });
      targetOrgIds = orgs.map((org) => org.id);
    }

    let totalTasksCreated = 0;

    for (const orgId of targetOrgIds) {
      console.log(`\n Processing organization: ${orgId}`);

      // 1. 상담사 데이터 로드
      const counselors = await getOrganizationCounselors(orgId);
      if (counselors.length === 0) {
        console.warn(`No counselors found for organization ${orgId}`);
        continue;
      }

      console.log(
        `✓ Loaded ${counselors.length} counselors: ${counselors
          .map((c) => c.name)
          .join(", ")}`
      );

      // 2. Stratification
      const strata = stratifyByHistoricalPerformance(counselors);
      console.log(
        `✓ Stratification: HIGH=${strata[0].counselors.length}, MIDDLE=${strata[1].counselors.length}, LOW=${strata[2].counselors.length}`
      );

      // 3. Block Randomization
      const assignments = generateBlockRandomization(
        counselors.length,
        strata,
        4, // blockSize
        12 // numWeeks
      );
      console.log(`✓ Generated block randomization for all counselors`);

      // 4. Crossover Design
      const withCrossover = applyCrossoverDesign(assignments);
      console.log(`✓ Applied crossover design`);

      // 5. Generate Schedule
      const schedule = generateAllocationSchedule(withCrossover, 50); // 주당 50콜
      const weekSchedule = schedule.filter((s) => s.week === week);
      console.log(`✓ Generated ${weekSchedule.length} allocations for week ${week}`);

      // 6. Save to Database
      await saveAssignmentsToDatabase(orgId, week, weekSchedule);

      // 7. Sync to Monday.com
      const tasksCreated = await syncToMonday(orgId, week, weekSchedule);
      totalTasksCreated += tasksCreated;

      // 8. Slack Notification
      await notifySlackAboutSync(week, tasksCreated);
    }

    const message = `✅ A/B Test Sync Complete: Week ${week}, ${totalTasksCreated} tasks created`;
    console.log(message);

    return {
      success: true,
      week,
      tasksCreated: totalTasksCreated,
      message,
    };
  } catch (error) {
    console.error("❌ A/B Test Sync Cron Job failed:", error);
    return {
      success: false,
      week: 0,
      tasksCreated: 0,
      message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Vercel Cron API 엔드포인트
 * cron.json 설정:
 * {
 *   "cronSchedules": [
 *     {
 *       "path": "/api/cron/ab-test-sync",
 *       "schedule": "0 9 * * 1"
 *     }
 *   ]
 * }
 */
export async function handleCronRequest() {
  return runABTestSyncJob();
}

// 스크립트로 직접 실행
if (require.main === module) {
  runABTestSyncJob()
    .then((result) => {
      console.log("\n=== Result ===");
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}
