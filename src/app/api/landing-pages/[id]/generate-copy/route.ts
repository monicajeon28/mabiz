import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type Params = { params: Promise<{ id: string }> };

// POST /api/landing-pages/[id]/generate-copy
// body: { productName: string, targetAudience: string, tone?: string }
export async function POST(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    requireOrgId(ctx);
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ ok: false, message: "페이지 ID가 없습니다." }, { status: 400 });
    }

    const body = await req.json();
    const { productName, targetAudience, tone } = body as {
      productName: string;
      targetAudience: string;
      tone?: string;
    };

    if (!productName?.trim() || !targetAudience?.trim()) {
      return NextResponse.json(
        { ok: false, message: "상품명과 타겟 고객을 입력하세요." },
        { status: 400 }
      );
    }

    const toneDesc = tone?.trim()
      ? `말투/톤: ${tone}`
      : "말투/톤: 친근하고 신뢰감 있는 한국어";

    const prompt = `크루즈 관광 상품 랜딩페이지 HTML 카피를 PASONA 공식으로 작성해주세요.
상품명: ${productName}, 타겟: ${targetAudience}
${toneDesc}

P(문제) → A(공감/자극) → S(해결책) → O(제안) → N(범위좁히기) → A(행동촉구)
섹션별 헤더 + 본문 포함, HTML 형태로 반환

요구사항:
- 인라인 CSS 스타일만 사용 (외부 CSS 없음)
- Navy(#1E2D4E) + Gold(#C9A84C) 컬러 사용
- 모바일 최적화 (max-width: 480px 기준)
- 각 PASONA 섹션은 <section> 태그로 구분
- 한국어 카피라이팅
- P(문제): 타겟의 현재 고통/불편 묘사
- A(공감/자극): 그 문제가 얼마나 심각한지 공감 + 자극
- S(해결책): 이 크루즈 상품이 해결책임을 제시
- O(제안): 구체적인 상품 혜택과 가치 제안
- N(범위좁히기): 한정된 기간/인원/특별 조건으로 범위 좁히기
- A(행동촉구): 지금 당장 신청해야 하는 이유와 CTA 버튼

완전한 HTML 섹션 코드만 반환하세요 (<!DOCTYPE html> 불필요, <body> 내부 코드만).`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const htmlContent =
      message.content[0].type === "text" ? message.content[0].text.trim() : "";

    if (!htmlContent) {
      return NextResponse.json(
        { ok: false, message: "AI 응답이 비어있습니다." },
        { status: 500 }
      );
    }

    logger.log("[POST /api/landing-pages/[id]/generate-copy]", {
      landingPageId: id,
      productName,
      targetAudience,
    });

    return NextResponse.json({ ok: true, htmlContent });
  } catch (err) {
    logger.error("[POST /api/landing-pages/[id]/generate-copy]", { err });
    return NextResponse.json({ ok: false, message: "카피 생성에 실패했습니다." }, { status: 500 });
  }
}
