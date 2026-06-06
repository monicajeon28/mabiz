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
import prisma from "@/lib/prisma";
import { getCache, setCache } from "@/lib/redis";
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
    if (!session?.organizationId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const organizationId = session.organizationId;

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
    try {
      const cached = await getCache<Record<string, unknown>>(cacheKey);
      if (cached) {
        const responseTime = Date.now() - startTime;
        logger.info(`[PlaybookRecommender] Cache hit for ${contactId} (${responseTime}ms)`);
        return NextResponse.json({ ...cached, cached: true, responseTime });
      }
    } catch (cacheError) {
      logger.warn(`[PlaybookRecommender] Cache read error: ${cacheError}`);
    }

    // 4. Contact 조회
    const contact = await prisma.contact.findUnique({
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
    const lensEngine = new LensDetectionEngine(prisma);
    const lensResult = await lensEngine.detectLens(contactId, organizationId);

    // 6. 모든 활성 스크립트 조회
    const allScripts = await prisma.salesPlaybook.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        title: true,
        content: true,
        type: true,
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

    // 7. 스크립트별 실제 성공률 조회 (ToolClickTracker / AuditLog 기반)
    //    클릭(사용) vs 성공 비율 → 실제 사용 데이터가 없으면 휴리스틱 폴백
    const usageStats = await getScriptUsageStats(organizationId, scriptIds(allScripts));

    const getSuccessRate = (script: typeof allScripts[0]): number => {
      const stat = usageStats.get(script.id);

      // 실측 데이터가 충분(클릭 3회+)하면 실제 성공률 사용
      if (stat && stat.clicks >= 3) {
        return Math.min(95, Math.max(5, stat.successRate));
      }

      // 데이터 부족 시 휴리스틱 폴백 (기본값 65%)
      let rate = 65;
      if (script.priority && script.priority > 5) rate += 5;
      const daysSinceUpdate =
        (Date.now() - script.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate < 30) rate += 3;
      if (script.type === "cold_call") rate += 2;
      if (script.type === "objection") rate += 5;
      if (script.type === "closing") rate += 8;

      return Math.min(95, rate);
    };

    // 8. 스크립트 점수 계산 및 정렬
    const scored = allScripts.map((script: (typeof allScripts)[0]) => {
      const successRate = getSuccessRate(script);
      const score = calculateScore(script, lensResult.primaryLens, null, successRate);
      const matchPercentage = calculateMatch(script.type || "", lensResult.primaryLens);
      const matchReason = generateMatchReason(
        lensResult.primaryLens,
        matchPercentage,
        successRate
      );

      return {
        id: script.id,
        title: script.title,
        category: script.type || "General",
        type: script.type || "script",
        psychology: script.psychology,
        successRate,
        usageCount: usageStats.get(script.id)?.clicks ?? 0,
        score,
        matchPercentage,
        matchReason,
        lastUsedAt: null,
        priority: script.priority,
      } as ScriptRecommendation;
    });

    // 점수 기준 내림차순 정렬
    const ranked = scored
      .sort((a: ScriptRecommendation, b: ScriptRecommendation) => b.score - a.score)
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
    try {
      await setCache(cacheKey, result, CACHE_TTL_SECONDS);
    } catch (cacheError) {
      logger.warn(`[PlaybookRecommender] Cache write error: ${cacheError}`);
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
        error: '서버 오류가 발생했습니다.',
        responseTime,
      },
      { status: 500 }
    );
  }
}

/** Contact 조회 select 결과에서 script id 배열 추출 */
function scriptIds(scripts: Array<{ id: string }>): string[] {
  return scripts.map((s) => s.id);
}

/**
 * 스크립트별 실측 사용 통계 (ToolClickTracker / AuditLog 기반)
 * action=TOOL_CLICK, resourceType=PlaybookScript, reasonDescription=click|success
 */
async function getScriptUsageStats(
  organizationId: string,
  ids: string[]
): Promise<Map<string, { clicks: number; success: number; successRate: number }>> {
  const result = new Map<
    string,
    { clicks: number; success: number; successRate: number }
  >();

  if (ids.length === 0) return result;

  try {
    const [clickGroups, successGroups] = await Promise.all([
      prisma.auditLog.groupBy({
        by: ["resourceId"],
        where: {
          organizationId,
          action: "TOOL_CLICK",
          resourceType: "PlaybookScript",
          reasonDescription: "click",
          resourceId: { in: ids },
        },
        _count: { resourceId: true },
      }),
      prisma.auditLog.groupBy({
        by: ["resourceId"],
        where: {
          organizationId,
          action: "TOOL_CLICK",
          resourceType: "PlaybookScript",
          reasonDescription: "success",
          resourceId: { in: ids },
        },
        _count: { resourceId: true },
      }),
    ]);

    const successMap = new Map<string, number>();
    for (const g of successGroups) {
      if (g.resourceId) successMap.set(g.resourceId, g._count.resourceId);
    }

    for (const g of clickGroups) {
      if (!g.resourceId) continue;
      const clicks = g._count.resourceId;
      const success = successMap.get(g.resourceId) || 0;
      result.set(g.resourceId, {
        clicks,
        success,
        successRate: clicks > 0 ? Math.round((success / clicks) * 100) : 0,
      });
    }
  } catch (error) {
    logger.warn(`[PlaybookRecommender] Usage stats error: ${error}`);
  }

  return result;
}

/**
 * 추천 로그 기록 (비동기, 실패해도 영향 없음)
 * 미니멀 로깅: AuditLog에 추천 이벤트만 기록(PII 없음)
 */
async function logRecommendation(
  contactId: string,
  organizationId: string,
  lens: LensType,
  recommendations: ScriptRecommendation[]
): Promise<void> {
  try {
    const topScriptId = recommendations[0]?.id;
    await prisma.auditLog.create({
      data: {
        organizationId,
        action: "PLAYBOOK_RECOMMEND",
        resourceType: "PlaybookScript",
        resourceId: topScriptId ?? null,
        status: "SUCCESS",
        purpose: lens, // 감지된 렌즈(L0-L10) — PII 아님
        reasonDescription: `top:${topScriptId ?? "none"} count:${recommendations.length}`,
        piiFieldsAccessed: [],
      },
    });

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
