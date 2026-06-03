import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// 캐시 설정: 30분 (AI 추천은 자주 변함)
const CACHE_DURATION = 1800;

// GET /api/tools/recommended
// AI 기반 추천: 고객 상태, 최근 활동, 심리학 렌즈 기반
export async function GET(req: Request) {
  try {
    const context = await getAuthContext();
    const userId = context.userId;

    // 사용자의 최근 활동 데이터 수집 (향후 DB 연동)
    // - 최근 본 고객의 심리학 렌즈
    // - 통화 패턴
    // - 성공률 메트릭

    // 현재는 기본 추천 규칙 사용
    const recommendations = [
      {
        toolId: "rec-1",
        title: "효도 여행 고객 스크립트",
        category: "scripts" as const,
        reason: "요즘 효도 여행 문의가 늘어나고 있어요",
        relevance: 92,
      },
      {
        toolId: "rec-2",
        title: "가격 민감 고객 대응 가이드",
        category: "playbook" as const,
        reason: "최근 가격 이의 고객 3건",
        relevance: 87,
      },
      {
        toolId: "rec-3",
        title: "일본 크루즈 상품교육",
        category: "training" as const,
        reason: "성수기 일본 문의 증가",
        relevance: 84,
      },
      {
        toolId: "rec-4",
        title: "클로징 기법 플레이북",
        category: "playbook" as const,
        reason: "전환율 개선 노하우",
        relevance: 78,
      },
      {
        toolId: "rec-5",
        title: "재구매 고객 콜스크립트",
        category: "scripts" as const,
        reason: "기존 고객 재구매 유도",
        relevance: 75,
      },
    ];

    const response = NextResponse.json({
      ok: true,
      recommendations,
      generatedAt: new Date().toISOString(),
    });

    // HTTP 캐싱 헤더 추가 (30분)
    response.headers.set('Cache-Control', `private, max-age=${CACHE_DURATION}, stale-while-revalidate=${CACHE_DURATION}`);
    response.headers.set('CDN-Cache-Control', `max-age=${CACHE_DURATION}`);

    return response;
  } catch (error) {
    logger.error("Error fetching recommendations:", error as object);
    return NextResponse.json(
      { ok: false, message: "추천 도구 로드 실패" },
      { status: 500 }
    );
  }
}
