import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// 캐시 10분 (실데이터 기반이라 자주 갱신)
const CACHE_DURATION = 600;

type RecCategory = "scripts" | "playbook" | "training";
type Rec = {
  toolId: string;
  title: string;
  category: RecCategory;
  reason: string;      // 실제 건수 기반 근거 (하드코딩 문구 아님)
  relevance: number;   // 실제 데이터량에 비례한 점수
};

// 세그먼트 코드 → 50대도 이해하는 한글 라벨
function segLabel(seg: string): string {
  const map: Record<string, string> = {
    hyodo: "효도 여행", honeymoon: "신혼", family: "가족", senior: "시니어",
    repurchase: "재구매", couple: "부부", friends: "친구", solo: "혼자",
    price_sensitive: "가격 민감", general: "일반",
  };
  return map[seg] ?? seg; // 이미 한글이면 그대로
}

/**
 * GET /api/tools/recommended
 * 실제 데이터 기반 추천 (하드코딩 더미 제거)
 *  1) 최근 7일 본인 거절·이의 콜 건수 → 거절 대응 스크립트
 *  2) 출발 임박(7일 내) 고객 수 → 클로징 스크립트
 *  3) 가장 많은 고객 세그먼트 → 해당 페르소나 스크립트
 *  데이터 없으면 기본 안내로 폴백
 */
export async function GET() {
  try {
    const ctx = await getAuthContext();
    const userId = ctx.userId;
    const orgId = ctx.organizationId;

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const recs: Rec[] = [];

    // ── 1. 최근 7일 본인 거절·이의 콜 ───────────────────────────
    const objectionCount = await prisma.callLog.count({
      where: {
        userId,
        createdAt: { gte: weekAgo },
        OR: [
          { customerReaction: "negative" },
          { result: { in: ["REJECTED", "거절", "PENDING", "보류"] } },
          { objectionId: { not: null } },
        ],
      },
    });
    if (objectionCount > 0) {
      recs.push({
        toolId: "rec-objection",
        title: "거절·이의 대응 스크립트",
        category: "scripts",
        reason: `이번 주 거절·이의 ${objectionCount}건`,
        relevance: Math.min(98, 70 + objectionCount * 3),
      });
    }

    // ── 2. 출발 임박(7일 이내) 고객 ─────────────────────────────
    let departingCount = 0;
    if (orgId) {
      departingCount = await prisma.contact.count({
        where: {
          organizationId: orgId,
          deletedAt: null,
          departureDate: { gte: now, lte: in7days },
        },
      });
    }
    if (departingCount > 0) {
      recs.push({
        toolId: "rec-closing",
        title: "출발 임박 클로징 스크립트",
        category: "playbook",
        reason: `출발 임박 고객 ${departingCount}명`,
        relevance: Math.min(96, 65 + departingCount * 4),
      });
    }

    // ── 3. 가장 많은 고객 세그먼트 ──────────────────────────────
    if (orgId) {
      const segCounts = await prisma.contact.groupBy({
        by: ["autoSegment"],
        where: {
          organizationId: orgId,
          deletedAt: null,
          autoSegment: { not: null },
        },
        _count: { autoSegment: true },
        orderBy: { _count: { autoSegment: "desc" } },
        take: 1,
      });
      const top = segCounts[0];
      if (
        top?.autoSegment &&
        top.autoSegment !== "unclassified" &&
        top._count.autoSegment > 0
      ) {
        const label = segLabel(top.autoSegment);
        recs.push({
          toolId: "rec-persona",
          title: `${label} 고객 페르소나 스크립트`,
          category: "scripts",
          reason: `${label} 고객이 ${top._count.autoSegment}명으로 가장 많아요`,
          relevance: 80,
        });
      }
    }

    // ── 폴백: 실데이터 추천이 하나도 없으면 기본 안내 ───────────
    if (recs.length === 0) {
      recs.push(
        {
          toolId: "rec-default-scripts",
          title: "콜 스크립트 둘러보기",
          category: "scripts",
          reason: "통화 기록이 쌓이면 맞춤 추천을 드려요",
          relevance: 60,
        },
        {
          toolId: "rec-default-training",
          title: "상품 교육 자료",
          category: "training",
          reason: "기본 상품 지식부터 시작하세요",
          relevance: 55,
        },
      );
    }

    recs.sort((a, b) => b.relevance - a.relevance);

    const response = NextResponse.json({
      ok: true,
      recommendations: recs,
      generatedAt: now.toISOString(),
    });
    response.headers.set("Cache-Control", `private, max-age=${CACHE_DURATION}`);
    return response;
  } catch (error) {
    logger.error("Error fetching recommendations:", error as object);
    return NextResponse.json(
      { ok: false, message: "추천 도구 로드 실패" },
      { status: 500 },
    );
  }
}
