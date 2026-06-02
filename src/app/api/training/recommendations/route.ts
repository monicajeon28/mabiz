import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

export interface Recommendation {
  courseId: string;
  title: string;
  reason: string;
  priority: "high" | "medium" | "low";
  estimatedTime: string;
}

/**
 * GET /api/training/recommendations — 지능형 학습 경로 추천
 *
 * 로직:
 * 1. 사용자의 학습 진행도 분석
 * 2. 완료하지 않은 강의 중 우선순위 계산
 * 3. 성과 메트릭(클로징율, 평균주문액) 기반 추천
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path");

    // 추천 로직 (현재 mock)
    const recommendations: Recommendation[] = [];

    if (path === "beginner") {
      recommendations.push(
        {
          courseId: "beginner-1",
          title: "크루즈 상품 5가지 마스터",
          reason: "기초 완성을 위해 가장 중요한 강의입니다. 5개 상품의 차이점을 명확히 알아야 고객 제안이 정확합니다.",
          priority: "high",
          estimatedTime: "15분",
        },
        {
          courseId: "beginner-2",
          title: "고객 심리 기본 (L6-L10)",
          reason: "심리학 렌즈를 이해하면 거절율이 급락합니다. 초급 때부터 50대 심리를 파악하세요.",
          priority: "high",
          estimatedTime: "12분",
        },
        {
          courseId: "beginner-3",
          title: "첫 통화 스크립트 Day 0",
          reason: "첫인상이 전부입니다. Day 0 스크립트로 신뢰 관계를 즉시 구축하세요.",
          priority: "medium",
          estimatedTime: "10분",
        },
        {
          courseId: "beginner-4",
          title: "PASONA 프레임워크 입문",
          reason: "모든 판매 대사의 기초가 PASONA입니다. 문제→자극→해결→오퍼→행동 흐름을 몸에 배이세요.",
          priority: "medium",
          estimatedTime: "18분",
        }
      );
    } else if (path === "intermediate") {
      recommendations.push(
        {
          courseId: "intermediate-1",
          title: "5가지 이의 대응 마스터",
          reason: "80% 고객이 거절합니다. 5가지 주요 거절의 정확한 대응으로 클로징율을 2배 올리세요.",
          priority: "high",
          estimatedTime: "20분",
        },
        {
          courseId: "intermediate-2",
          title: "클로징 기법 5가지",
          reason: "마지막 일격이 중요합니다. 5가지 클로징 기법으로 우유부단한 고객도 결정하게 하세요.",
          priority: "high",
          estimatedTime: "15분",
        },
        {
          courseId: "intermediate-3",
          title: "세그먼트별 메시지 (A-E)",
          reason: "고객 세그먼트별로 말투와 강조점이 달라야 합니다. 신민형 vs 모니카형 대화 전략을 배우세요.",
          priority: "medium",
          estimatedTime: "16분",
        },
        {
          courseId: "intermediate-4",
          title: "실제 통화 사례 분석",
          reason: "이론보다는 실제 성공 사례입니다. 5개 성공 통화를 분석해서 당신의 스타일을 만드세요.",
          priority: "medium",
          estimatedTime: "25분",
        }
      );
    } else if (path === "advanced") {
      recommendations.push(
        {
          courseId: "advanced-1",
          title: "심리학 10렌즈 마스터",
          reason: "L0-L10 렌즈 완벽 이해가 리더 조건입니다. 신입 코칭도 렌즈 기반으로 하세요.",
          priority: "high",
          estimatedTime: "45분",
        },
        {
          courseId: "advanced-2",
          title: "업셀/크로스셀 전략",
          reason: "신규 고객 10명보다 기존 고객 1명의 업셀이 더 효율적입니다. 수익 2배 전략을 배우세요.",
          priority: "high",
          estimatedTime: "18분",
        },
        {
          courseId: "advanced-3",
          title: "데이터 분석 & KPI 읽기",
          reason: "직감이 아닌 데이터로 결정하세요. 당신의 클로징율, LTV, CPA를 분석하고 개선 목표를 세우세요.",
          priority: "medium",
          estimatedTime: "20분",
        },
        {
          courseId: "advanced-4",
          title: "팀 리더 트레이닝",
          reason: "팀을 이끄는 리더로 성장하세요. 신입 코칭, 성과 관리, 팀 빌딩 노하우를 배우세요.",
          priority: "medium",
          estimatedTime: "30분",
        }
      );
    }

    logger.log("[TrainingRecommendationsAPI]", {
      action: "get-recommendations",
      userId: ctx.userId,
      path,
      count: recommendations.length,
    });

    return NextResponse.json({
      success: true,
      recommendations,
      total: recommendations.length,
      message: `현재 ${path} 단계에 맞는 ${recommendations.length}개 강의를 추천합니다.`,
    });
  } catch (err) {
    logger.error("[TrainingRecommendationsAPI]", {
      action: "get-recommendations",
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json(
      { error: "Failed to fetch recommendations" },
      { status: 500 }
    );
  }
}
