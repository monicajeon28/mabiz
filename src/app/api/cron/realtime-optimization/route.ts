/**
 * Real-Time Channel Optimization Cron Job
 *
 * Endpoint: POST /api/cron/realtime-optimization
 *
 * Runs every 30 minutes:
 * 1. Recalculate optimal channel mix (SMS/Kakao/Email)
 * 2. Update bandit probabilities
 * 3. Apply allocations to pending campaigns
 * 4. Log performance metrics
 *
 * Parameters:
 * - type: "full" | "quick"
 *   - full: 모든 조직의 최적화 계산 (5-10분)
 *   - quick: 활성 캠페인만 업데이트 (1-2분)
 *
 * Authentication: CRON_SECRET (environment variable)
 *
 * Response:
 * ```json
 * {
 *   "ok": true,
 *   "type": "full",
 *   "timestamp": "2026-05-27T10:30:00.000Z",
 *   "result": {
 *     "organizationsProcessed": 5,
 *     "channelMixesUpdated": 12,
 *     "banditUpdates": 248,
 *     "errors": [],
 *     "nextRunAt": "2026-05-27T11:00:00.000Z"
 *   }
 * }
 * ```
 */

export const dynamic = "force-dynamic";

import { NextResponse, NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { logger } from "@/lib/logger";
import RealtimeChannelOptimizer from "@/lib/services/realtime-channel-optimizer";
import BudgetAllocator from "@/lib/services/budget-allocator";
import prisma from "@/lib/prisma";

interface OptimizationResult {
  organizationsProcessed: number;
  channelMixesUpdated: number;
  banditUpdates: number;
  budgetRebalances: number;
  errors: Array<{ org: string; error: string }>;
  nextRunAt: Date;
}

export async function POST(req: NextRequest) {
  try {
    // Step 1: CRON_SECRET 검증
    const secret = process.env.CRON_SECRET;
    const auth = req.headers.get("authorization") ?? "";

    if (process.env.NODE_ENV === "production") {
      if (!secret) {
        logger.warn(
          "[Cron/RealtimeOptimization] CRON_SECRET 미설정"
        );
        return NextResponse.json(
          { ok: false, error: "Unauthorized" },
          { status: 500 }
        );
      }

      const expected = `Bearer ${secret}`;
      if (
        auth.length !== expected.length ||
        !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
      ) {
        logger.warn(
          "[Cron/RealtimeOptimization] 인증 실패"
        );
        return NextResponse.json(
          { ok: false, error: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    // Step 2: 요청 본문 파싱
    let body;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const type = body.type || "quick";

    if (!["full", "quick"].includes(type)) {
      return NextResponse.json(
        { ok: false, error: "Invalid type parameter" },
        { status: 400 }
      );
    }

    // Step 3: 최적화 실행
    const result = await runRealtimeOptimization(type);

    logger.log(
      "[Cron/RealtimeOptimization] 최적화 완료",
      {
        type,
        result,
      }
    );

    return NextResponse.json(
      {
        ok: true,
        type,
        timestamp: new Date(),
        result,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error(
      "[Cron/RealtimeOptimization] 실행 실패",
      { error }
    );

    return NextResponse.json(
      {
        ok: false,
        error: '서버 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}

/**
 * 실시간 최적화 실행
 */
async function runRealtimeOptimization(
  type: "full" | "quick"
): Promise<OptimizationResult> {
  const result: OptimizationResult = {
    organizationsProcessed: 0,
    channelMixesUpdated: 0,
    banditUpdates: 0,
    budgetRebalances: 0,
    errors: [],
    nextRunAt: new Date(Date.now() + 30 * 60 * 1000), // 30분 후
  };

  try {
    // 모든 조직 조회
    const organizations = await prisma.organization.findMany({
      select: { id: true, name: true },
    });

    logger.log(
      "[RealtimeOptimization] 조직 조회",
      { count: organizations.length }
    );

    for (const org of organizations) {
      try {
        // 1. 채널 최적화
        const optimizer = new RealtimeChannelOptimizer(org.id);
        const channelMix = await optimizer.getOptimalChannelMix();

        logger.log(
          "[RealtimeOptimization] 채널 최적화 완료",
          {
            org: org.name,
            allocation: channelMix.allocation,
          }
        );

        result.channelMixesUpdated += 1;

        // 2. 예산 재배분 (주간)
        const isWeeklyRebalance =
          new Date().getDay() === 1; // 월요일에만
        if (isWeeklyRebalance && type === "full") {
          // 평균 월간 예산 조회 (임시: $10,000)
          const budgetAllocator = new BudgetAllocator(org.id, 10000);
          const allocation = await budgetAllocator.allocateBudget();

          logger.log(
            "[RealtimeOptimization] 예산 재배분",
            {
              org: org.name,
              allocations: allocation.allocations.map((a) => ({
                channel: a.channel,
                amount: a.amount,
              })),
            }
          );

          result.budgetRebalances += 1;
        }

        // 3. 활성 캠페인에 최적 채널 적용
        // multiChannelCampaign 모델 미구현 — 빈 배열로 처리
        const activeCampaigns: Array<{ id: string }> = [];

        for (const campaign of activeCampaigns) {
          await optimizer.applyAllocationToCampaign(
            campaign.id,
            channelMix.allocation
          );

          result.banditUpdates += 1;
        }

        result.organizationsProcessed += 1;
      } catch (error) {
        logger.error(
          "[RealtimeOptimization] 조직 처리 실패",
          {
            org: org.name,
            error,
          }
        );

        result.errors.push({
          org: org.name,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // 결과 로깅
    logger.log(
      "[RealtimeOptimization] 완료",
      {
        result,
      }
    );

    return result;
  } catch (error) {
    logger.error(
      "[RealtimeOptimization] 전체 실행 실패",
      { error }
    );
    throw error;
  }
}

export async function GET(req: NextRequest) {
  // GET 요청도 지원 (test용)
  return POST(req);
}
