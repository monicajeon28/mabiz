import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `당신은 크루즈 여행 세일즈 콜 전문 코치입니다.
통화 내용을 분석해서 다음 형식으로 JSON만 반환하세요:

{
  "score": 75,
  "grade": "B",
  "summary": "한 줄 요약",
  "strengths": ["잘한 점 1", "잘한 점 2", "잘한 점 3"],
  "improvements": ["개선할 점 1", "개선할 점 2", "개선할 점 3"],
  "convictionScore": 6,
  "nextAction": "다음에 해야 할 행동",
  "followUpSms": "추천 후속 문자 내용 (100자 이내)",
  "details": {
    "opening": { "score": 80, "comment": "오프닝 코멘트" },
    "needsDiscovery": { "score": 70, "comment": "니즈발굴 코멘트" },
    "objectionHandling": { "score": 75, "comment": "거절대응 코멘트" },
    "closing": { "score": 60, "comment": "클로징 코멘트" },
    "emotionalTouch": { "score": 85, "comment": "감정터치 코멘트" }
  }
}

평가 기준:
- 오프닝: 이름 확인, 시간 동의, 감정 훅
- 니즈발굴: 7가지 질문 활용, 고객 발화 비율 50%+
- 거절대응: 금지어 사용 여부, 날짜 못박기
- 클로징: 링크 발송, 추가 설명 여부
- 감정터치: 감정어 사용, 공감 표현

JSON만 반환. 설명 없이.`;

export async function POST(req: Request) {
  try {
    await getAuthContext();
    const body     = await req.json();
    const { text } = body;

    if (!text?.trim()) {
      return NextResponse.json({ ok: false, message: "통화 내용을 입력하세요." }, { status: 400 });
    }

    if (text.length > 20000) {
      return NextResponse.json({ ok: false, message: "내용이 너무 깁니다. 20,000자 이내로 입력하세요." }, { status: 400 });
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `통화 내용:\n${text}` }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "{}";

    // JSON 파싱 (코드블록 제거)
    const cleaned = raw.replace(/```json?\n?|\n?```/g, "").trim();
    const result  = JSON.parse(cleaned);

    logger.log("[ColFeedback] 분석 완료", { score: result.score });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    logger.error("[POST /api/tools/call-feedback]", { err });
    return NextResponse.json({ ok: false, message: "분석 중 오류가 발생했습니다." }, { status: 500 });
  }
}
