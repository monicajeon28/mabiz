import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { checkOrigin } from "@/lib/origin-guard";
import { rlIncr } from "@/lib/redis";
import { sanitizeHtml } from "@/lib/html-sanitizer";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type Params = { params: Promise<{ id: string }> };

// 버그4: 프롬프트 인젝션 방지용 sanitizer
const sanitize = (s: string, max: number) => s.replace(/[\r\n]/g, ' ').trim().slice(0, max);

// POST /api/landing-pages/[id]/generate-copy
// body: { productName: string, targetAudience: string, tone?: string }
export async function POST(req: Request, { params }: Params) {
  try {
    // 버그1: CSRF 검증
    if (!checkOrigin(req, 'GenerateCopy')) {
      return NextResponse.json(
        { ok: false, message: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ ok: false, message: "페이지 ID가 없습니다." }, { status: 400 });
    }

    // 버그2: 소유권 검증
    const page = await prisma.crmLandingPage.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    });
    if (!page) {
      return NextResponse.json({ ok: false, message: '랜딩페이지를 찾을 수 없습니다.' }, { status: 404 });
    }

    // P0-3: Rate limit — 원자적 INCR (getCache/setCache 비원자적 패턴 제거)
    const rateLimitKey = `landing:generate-copy:${orgId}`;
    const count = await rlIncr(rateLimitKey, 3600);
    if (count !== null && count > 3) {
      logger.warn('[POST /api/landing-pages/[id]/generate-copy] Rate limit exceeded', { orgId, count });
      return NextResponse.json(
        { ok: false, message: '생성 횟수 초과' },
        { status: 429 }
      );
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

    // 버그4: 입력값 sanitize (프롬프트 인젝션 방지)
    const safeProductName = sanitize(productName, 100);
    const safeTargetAudience = sanitize(targetAudience, 200);
    const safeTone = tone ? sanitize(tone, 50) : '';

    const toneDesc = safeTone
      ? `말투/톤: ${safeTone}`
      : "말투/톤: 친근하고 신뢰감 있는 한국어";

    const prompt = `크루즈 관광 상품 랜딩페이지 HTML 카피를 PASONA 공식으로 작성해주세요.
상품명: ${safeProductName}, 타겟: ${safeTargetAudience}
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

    // 버그5: 모델명 환경변수화, max_tokens 2048로 조정
    const anthropicModel =
      process.env.ANTHROPIC_COPY_MODEL ?? process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001';

    const message = await anthropic.messages.create({
      model: anthropicModel,
      max_tokens: 2048,
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
      orgId,
      productName: safeProductName,
      targetAudience: safeTargetAudience,
      model: anthropicModel,
    });

    // P0-6: AI 생성 HTML sanitize 후 반환
    return NextResponse.json({ ok: true, htmlContent: sanitizeHtml(htmlContent) });
  } catch (err) {
    logger.error("[POST /api/landing-pages/[id]/generate-copy]", { err });
    return NextResponse.json({ ok: false, message: "카피 생성에 실패했습니다." }, { status: 500 });
  }
}
