import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { rlIncr } from "@/lib/redis";

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

    // 렌즈·세그먼트 기반 카피 템플릿 (Claude API 미연동 환경 fallback)
    const LENS_COPY: Record<string, { headline: string; body: string; cta: string }> = {
      l6_timing:      { headline: `${mockProduct.title} — 오늘 마감!`, body: "지금 신청하지 않으면 내년 선착순 마감될 수 있습니다. 한정 기회를 놓치지 마세요.", cta: "오늘 바로 예약" },
      l10_immediate:  { headline: `${mockProduct.title} — 지금 결정하면 특별 혜택`, body: "오늘 바로 신청하시면 추가 선물 증정. 망설이지 마세요!", cta: "지금 신청하기" },
      l1_price_objection: { headline: `${mockProduct.title} — 가격 걱정 NO`, body: "월 소액으로 시작할 수 있습니다. 가격보다 훨씬 큰 가치를 경험하세요.", cta: "가격 확인하기" },
      l7_companion:   { headline: `${mockProduct.title} — 가족과 함께`, body: "소중한 가족과 평생 추억을 만드세요. 동반 혜택으로 더 특별하게.", cta: "가족 혜택 보기" },
      l9_medical:     { headline: `${mockProduct.title} — 전문가 추천`, body: "크루즈 전문 컨설턴트가 맞춤 상품을 안내합니다. 믿을 수 있는 서비스.", cta: "전문가 상담" },
    };
    const SEGMENT_BODY: Record<string, string> = {
      price_sensitive:  "가격 대비 최고의 혜택을 드립니다.",
      quality_focused:  "최상의 품질로 특별한 경험을 약속합니다.",
      family_decision:  "온 가족이 만족하는 프리미엄 서비스입니다.",
      experience_seeker: "새로운 경험과 설렘이 기다립니다.",
      group_planner:    "그룹 특별 혜택으로 더욱 경제적입니다.",
    };

    const lensTemplate = LENS_COPY[safeLensType] ?? LENS_COPY.l6_timing;
    const segmentBody = SEGMENT_BODY[safeSegment];
    const copy = {
      headline: lensTemplate.headline,
      body: segmentBody ? `${segmentBody} ${lensTemplate.body}` : lensTemplate.body,
      cta: lensTemplate.cta,
    };

    // 생성 기록 DB 저장 (AuditLog 재활용)
    await prisma.auditLog.create({
      data: {
        organizationId: ctx.organizationId ?? undefined,
        userId: ctx.userId,
        action: "COPY_GENERATED",
        resourceType: "CopyTool",
        resourceId: productId,
        status: "SUCCESS",
        purpose: safeLensType || undefined,
        reasonDescription: JSON.stringify({ segment: safeSegment, copy }),
      },
    }).catch(() => {}); // 로그 실패는 무시

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

    // AuditLog에서 최근 생성 내역 조회
    const logs = await prisma.auditLog.findMany({
      where: { userId: ctx.userId, action: "COPY_GENERATED" },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, resourceId: true, createdAt: true, reasonDescription: true },
    });

    const generations = logs.map((log) => {
      let copy = null;
      try { copy = JSON.parse(log.reasonDescription ?? "{}").copy ?? null; } catch {}
      return { id: log.id, productId: log.resourceId ?? "", createdAt: log.createdAt.toISOString(), copy };
    });

    return NextResponse.json({
      ok: true,
      generations,
    });

  } catch (err) {
    logger.error("[GET /api/tools/generate-copy] 오류", { err });
    return NextResponse.json(
      { ok: false },
      { status: 500 }
    );
  }
}
