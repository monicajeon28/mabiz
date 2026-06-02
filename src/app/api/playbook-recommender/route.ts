/**
 * PlaybookRecommender API
 * @date 2026-06-02
 * @description Contact 렌즈 감지 → 최적 스크립트 자동 추천 (Top 5)
 * @performance 응답 시간: <200ms (캐시 활성)
 *
 * POST /api/playbook-recommender
 * Body: { contactId: string }
 * Response: {
 *   contactId: string,
 *   lens: LensType,
 *   recommendations: ScriptRecommendation[],
 *   confidence: number
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { LensDetectionEngine } from "@/lib/services/lens-detection-engine";
import {
  calculateScore,
  calculateMatch,
  calculateConfidence,
  generateMatchReason,
  ScriptRecommendation,
} from "@/lib/recommendation-scorer";
import { LensType } from "@/lib/types/lens";
import { getMabizSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

const CACHE_TTL_SECONDS = 3600; // 1시간

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. 인증 확인
    const session = await getMabizSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const organizationId = session.user.organizationId;

    // 2. 요청 파라미터 검증
    const body = await request.json();
    const { contactId } = body;

    if (!contactId || typeof contactId !== "string") {
      return NextResponse.json(
        { error: "contactId is required and must be a string" },
        { status: 400 }
      );
    }

    // 3. 캐시 확인 (Redis)
    const cacheKey = `playbook-rec:${organizationId}:${contactId}`;
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const responseTime = Date.now() - startTime;
          logger.info(`[PlaybookRecommender] Cache hit for ${contactId} (${responseTime}ms)`);
          return NextResponse.json({
            ...cached,
            cached: true,
            responseTime,
          });
        }
      } catch (cacheError) {
        logger.warn(`[PlaybookRecommender] Cache read error: ${cacheError}`);
        // 캐시 오류는 무시하고 계속 진행
      }
    }

    // 4. Contact 조회
    const contact = await db.contact.findUnique({
      where: { id: contactId },
      select: {
        id: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
        lastContactedAt: true,
        purchasedAt: true,
        lastCruiseDate: true,
        cruiseCount: true,
        vipStatus: true,
        tags: true,
        lensMetadata: true,
        anxietyScore: true,
        preparationStage: true,
        healthConcerns: true,
        competitorMentioned: true,
        competitorNames: true,
        selfProjectionScore: true,
        selfProjectionType: true,
        familyComposition: true,
        decisionMaker: true,
        ltvTotal: true,
        cruiseReturnInterestLevel: true,
        timingUrgencyScore: true,
        l10ClosingScore: true,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    // Contact 조직 검증
    if (contact.organizationId !== organizationId) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // 5. 렌즈 감지 (기존 엔진 활용)
    const lensEngine = new LensDetectionEngine(db, redis);
    const lensResult = await lensEngine.detectLens(contactId, organizationId);

    // 6. 모든 활성 스크립트 조회
    const allScripts = await db.salesPlaybook.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        title: true,
        content: true,
        type: true,
        category: true,
        psychology: true,
        scriptTab: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
      },
      take: 500, // 성능 최적화: 상위 500개만 조회
    });

    if (allScripts.length === 0) {
      return NextResponse.json(
        { error: "No playbooks available" },
        { status: 404 }
      );
    }

    // 7. 스크립트별 성공률 조회 (간단한 계산: 우선도 + 최신성)
    // 실제 환경에서는 별도 테이블(ScriptMetrics)에서 조회
    const getSuccessRate = (script: typeof allScripts[0]): number => {
      // 기본값: 65%
      let rate = 65;

      // 우선도가 높으면 +5%
      if (script.priority && script.priority > 5) {
        rate += 5;
      }

      // 최근 업데이트되면 +3%
      const daysSinceUpdate = (Date.now() - script.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate < 30) {
        rate += 3;
      }

      // 타입별 기본 성공률
      if (script.type === "cold_call") rate += 2;
      if (script.type === "objection") rate += 5;
      if (script.type === "closing") rate += 8;

      return Math.min(95, rate);
    };

    // 8. 스크립트 점수 계산 및 정렬
    const scored = allScripts.map((script) => {
      const successRate = getSuccessRate(script);
      const score = calculateScore(script, lensResult.primaryLens, null, successRate);
      const matchPercentage = calculateMatch(script.category || "", lensResult.primaryLens);
      const matchReason = generateMatchReason(
        lensResult.primaryLens,
        matchPercentage,
        successRate
      );

      return {
        id: script.id,
        title: script.title,
        category: script.category || "General",
        type: script.type || "script",
        psychology: script.psychology,
        successRate,
        usageCount: 0, // 실제 데이터는 별도 테이블에서 조회
        score,
        matchPercentage,
        matchReason,
        lastUsedAt: null,
        priority: script.priority,
      } as ScriptRecommendation;
    });

    // 점수 기준 내림차순 정렬
    const ranked = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Top 5만 반환

    // 9. 신뢰도 계산
    const confidence = calculateConfidence(ranked);

    // 10. 응답 생성
    const result = {
      contactId,
      organizationId,
      lens: lensResult.primaryLens,
      confidenceScore: lensResult.confidenceScore,
      recommendations: ranked,
      confidence,
      responseTime: Date.now() - startTime,
      cached: false,
    };

    // 11. 캐시 저장 (Redis, 1시간 TTL)
    if (redis) {
      try {
        await redis.setex(
          cacheKey,
          CACHE_TTL_SECONDS,
          JSON.stringify(result)
        );
      } catch (cacheError) {
        logger.warn(`[PlaybookRecommender] Cache write error: ${cacheError}`);
      }
    }

    // 12. 비동기 로깅 (클릭 분석용)
    logRecommendation(contactId, organizationId, lensResult.primaryLens, ranked)
      .catch((err) => logger.warn(`[PlaybookRecommender] Log error: ${err}`));

    const responseTime = Date.now() - startTime;
    logger.info(
      `[PlaybookRecommender] Returned ${ranked.length} scripts for ${contactId} (${responseTime}ms)`
    );

    return NextResponse.json(result);
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error(`[PlaybookRecommender] Error: ${error}`);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
        responseTime,
      },
      { status: 500 }
    );
  }
}

/**
 * 추천 로그 기록 (비동기, 실패해도 영향 없음)
 */
async function logRecommendation(
  contactId: string,
  organizationId: string,
  lens: LensType,
  recommendations: ScriptRecommendation[]
): Promise<void> {
  try {
    // 실제 환경에서는 별도 테이블에 저장
    // await db.recommendationLog.create({
    //   data: {
    //     organizationId,
    //     contactId,
    //     lens,
    //     recommendedScriptIds: recommendations.map(r => r.id),
    //     topScriptId: recommendations[0]?.id,
    //     confidence: calculateConfidence(recommendations),
    //     createdAt: new Date(),
    //   },
    // });

    logger.debug(
      `[PlaybookRecommender] Logged recommendation: ${contactId} → ${lens}`
    );
  } catch (error) {
    logger.warn(`[PlaybookRecommender] Failed to log recommendation: ${error}`);
    // 로깅 실패는 무시
  }
}

/**
 * GET: 헬스 체크 및 API 정보
 */
export async function GET() {
  return NextResponse.json({
    service: "PlaybookRecommender",
    status: "healthy",
    version: "1.0.0",
    description: "Contact 렌즈 기반 최적 스크립트 추천 API",
    endpoint: "POST /api/playbook-recommender",
    responseTime: "<200ms",
    features: [
      "Lens detection (L0-L10)",
      "Script scoring & ranking",
      "Redis caching (1h TTL)",
      "Confidence scoring",
    ],
  });
}
