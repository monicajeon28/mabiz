import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { rlIncr } from "@/lib/rate-limit";

/**
 * POST /api/tools/generate-copy
 * 심리학 기반 카피 생성 (PASONA + Grant Cardone 10렌즈)
 *
 * Body:
 *   - productId: string (상품 ID)
 *   - tone: string (말투/톤, 예: "긴박감, 희소성")
 *   - segment: string (세그먼트, 예: "price_sensitive", "quality_focused")
 *   - lensType: string (렌즈 타입, 예: "l6_timing", "l10_immediate")
 *
 * Response:
 *   - ok: boolean
 *   - copy: { headline, body, cta } | null
 *   - message?: string
 */
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();

    // 요청 본문 파싱
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, message: "유효한 JSON 형식이 아닙니다" },
        { status: 400 }
      );
    }

    const { productId, tone, segment, lensType } = body;

    // 필수 입력값 검증
    if (!productId || typeof productId !== "string") {
      return NextResponse.json(
        { ok: false, message: "productId는 필수이며 문자열이어야 합니다" },
        { status: 400 }
      );
    }

    // ✅ P1-3.1: Rate Limit 원자성 검증
    // 사용자당 1시간에 3회까지만 생성 가능
    const rateLimitKey = `copy-gen:${ctx.userId}`;
    const count = await rlIncr(rateLimitKey, 3600);

    // rlIncr이 null을 반환하면 원자성 오류 (서버 오류)
    if (count === null) {
      logger.error('[POST /api/tools/generate-copy] Rate limit 원자성 실패', { userId: ctx.userId });
      return NextResponse.json(
        { ok: false, message: "요청 처리 중 오류가 발생했습니다" },
        { status: 500 }
      );
    }

    // 생성 횟수 초과 검증
    if (count > 3) {
      return NextResponse.json(
        { ok: false, message: `생성 횟수를 초과했습니다 (1시간당 3회 제한). 다시: ${Math.ceil((count - 3) / 1)} 분 후` },
        { status: 429 }
      );
    }

    // ✅ P1-3.2: 프롬프트 인젝션 방지
    // tone 파라미터에서 개행 문자 제거 + 길이 제한
    const safeTone = (tone ?? "")
      .slice(0, 50)  // 최대 50자
      .replace(/[\n\r\t]/g, " ")  // 개행, 탭 제거
      .replace(/\s+/g, " ")  // 연속 공백 정규화
      .trim();

    // segment 파라미터 검증 (화이트리스트)
    const validSegments = new Set([
      "price_sensitive",
      "quality_focused",
      "family_decision",
      "experience_seeker",
      "group_planner",
    ]);
    const safeSegment = (segment ?? "").toLowerCase();
    if (safeSegment && !validSegments.has(safeSegment)) {
      return NextResponse.json(
        { ok: false, message: `유효하지 않은 segment: ${segment}` },
        { status: 400 }
      );
    }

    // lensType 파라미터 검증 (화이트리스트)
    const validLensTypes = new Set([
      "l0_absent",
      "l1_price_objection",
      "l2_complexity",
      "l3_differentiation",
      "l4_feature_structure",
      "l5_self_projection",
      "l6_timing",
      "l7_companion",
      "l8_habitual",
      "l9_medical",
      "l10_immediate",
    ]);
    const safeLensType = (lensType ?? "").toLowerCase();
    if (safeLensType && !validLensTypes.has(safeLensType)) {
      return NextResponse.json(
        { ok: false, message: `유효하지 않은 lensType: ${lensType}` },
        { status: 400 }
      );
    }

    // NOTE: Product table does not exist in schema
    // Using mock product data for demonstration
    const mockProduct = {
      id: productId,
      title: `상품 ${productId}`,
      description: "상품 설명",
      price: 100000,
    };

    // 카피 생성 프롬프트 구성 (안전하게)
    const toneDesc = safeTone ? `말투/톤: ${safeTone}` : "중립적 톤";
    const segmentDesc = safeSegment ? `세그먼트: ${safeSegment}` : "";
    const lensDesc = safeLensType ? `심리학 렌즈: ${safeLensType}` : "";

    const prompt = [
      `상품명: ${mockProduct.title}`,
      `가격: ${mockProduct.price}`,
      `설명: ${mockProduct.description || "없음"}`,
      toneDesc,
      segmentDesc,
      lensDesc,
      "",
      "다음 JSON 형식으로 카피를 생성하세요:",
      '{ "headline": "...", "body": "...", "cta": "..." }',
      "",
      "요구사항:",
      "- headline: 한국어, 30자 이내, 감정적 임팩트",
      "- body: 한국어, 80자 이내, PASONA 프레임워크 적용",
      "- cta: 한국어, 15자 이내, 강력한 행동 촉구",
      "- JSON만 반환 (설명 없음)",
    ].join("\n");

    // Claude API 호출 (또는 캐시된 템플릿 사용)
    // 주의: 실제 구현에서는 Anthropic SDK 사용
    // const copy = await generateWithClaude(prompt);

    // 임시: 템플릿 기반 응답 (프로덕션에서는 실제 API 호출)
    const copy = {
      headline: `${mockProduct.title} - 지금만 ${Math.floor(Math.random() * 30) + 10}% 할인`,
      body: "한정된 시간 동안만 이 특별한 가격을 제공합니다. 지금 바로 예약하세요.",
      cta: "지금 예약하기",
    };

    // 생성 로그 기록
    logger.info("[POST /api/tools/generate-copy] 카피 생성 성공", {
      userId: ctx.userId,
      productId,
      segment: safeSegment,
      lensType: safeLensType,
    });

    return NextResponse.json({
      ok: true,
      copy,
      rateLimitRemaining: 3 - count,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    logger.error("[POST /api/tools/generate-copy] 오류", { err });
    return NextResponse.json(
      { ok: false, message: "카피 생성 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// GET: 생성 내역 조회 (선택)
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "10", 10), 100);

    // 사용자의 최근 생성 내역 조회 (선택사항)
    // 실제 구현에서는 DB에서 로그 조회
    const recentGenerations = [
      // { id: "...", productId: "...", createdAt: "...", copy: {...} }
    ];

    return NextResponse.json({
      ok: true,
      generations: recentGenerations,
    });

  } catch (err) {
    logger.error("[GET /api/tools/generate-copy] 오류", { err });
    return NextResponse.json(
      { ok: false },
      { status: 500 }
    );
  }
}
