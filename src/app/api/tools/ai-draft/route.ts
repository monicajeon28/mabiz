import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  try {
    await getAuthContext();
    const { prompt } = await req.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ ok: false, message: "프롬프트를 입력하세요." }, { status: 400 });
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `당신은 크루즈 여행사 마케팅 랜딩페이지 HTML 전문가입니다.

아래 설명을 기반으로 완성된 HTML 랜딩페이지를 작성하세요.

요구사항:
- 완전한 HTML (<!DOCTYPE html> 포함)
- 인라인 CSS 스타일 사용 (외부 스타일시트 없음)
- 모바일 반응형 (viewport meta 포함)
- Navy(#1E2D4E) + Gold(#C9A84C) 컬러 사용
- 섹션: 히어로 → 특징/혜택 → CTA → 신청폼
- 한국어로 작성
- 이미지는 [이미지URL] 플레이스홀더 사용

랜딩페이지 설명: ${prompt}

HTML 코드만 반환하세요. 설명 없이 코드만.`,
        },
      ],
    });

    const html =
      message.content[0].type === "text" ? message.content[0].text : "";

    logger.log("[AI Draft] 생성 완료", { promptLen: prompt.length });
    return NextResponse.json({ ok: true, html });
  } catch (err) {
    logger.error("[POST /api/tools/ai-draft]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
