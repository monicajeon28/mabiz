import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";

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
  },
  "personaType": "FILIAL_DUTY",
  "personaConfidence": 0.85,
  "objectionTypes": ["PRICE", "TIMING"]
}

평가 기준:
- 오프닝: 이름 확인, 시간 동의, 감정 훅
- 니즈발굴: 7가지 질문 활용, 고객 발화 비율 50%+
- 거절대응: 금지어 사용 여부, 날짜 못박기
- 클로징: 링크 발송, 추가 설명 여부
- 감정터치: 감정어 사용, 공감 표현

추가로 아래 5개 페르소나 중 가장 적합한 것을 판단하라:
1. FILIAL_DUTY: 부모님 동반, 건강/안전 중시
2. NEWLYWEDS: 신혼/기념일, 로맨스/가격 중시
3. SINGLE_ADVENTURE: 1인/친구그룹, 재미/경험 중시
4. RETIRED_LEISURE: 60세+, 여유/건강 중시
5. PRICE_SENSITIVE: 가성비 최우선, 가격반론 많음

JSON에 personaType(위 코드값)과 personaConfidence(0~1) 추가.
objectionTypes 배열도 추가 (통화에서 감지된 반론 유형들).

JSON만 반환. 설명 없이.`;

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const body = await req.json();
    const { text, converted, productType, durationSec } = body as {
      text: string;
      converted?: boolean;
      productType?: "GOLD" | "GENERAL";
      durationSec?: number;
    };

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

    // DB 저장
    const rawTextMasked = text.replace(/01[0-9]-?\d{3,4}-?\d{4}/g, "010-****-****");
    const callLog = await prisma.aiCallLog.create({
      data: {
        organizationId: ctx.organizationId!,
        agentUserId: ctx.userId,
        productType: productType ?? "GENERAL",
        rawTextMasked,
        converted: converted ?? false,
        durationSec: durationSec ?? null,
        analysisStatus: "DONE",
        personaType: result.personaType,
      },
    });
    await prisma.aiCallAnalysis.create({
      data: {
        callLogId: callLog.id,
        personaDetected: result.personaType ?? "UNKNOWN",
        personaConfidence: result.personaConfidence ?? 0,
        scores: result.details ?? {},
        keyPhrases: result.strengths ?? [],
        strengths: result.strengths ?? [],
        weaknesses: result.improvements ?? [],
        objectionTypes: result.objectionTypes ?? [],
        goldValueScore: productType === "GOLD" ? result.convictionScore : null,
      },
    });

    logger.log("[CallFeedback] 분석 완료", { score: result.score, callLogId: callLog.id });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    logger.error("[POST /api/tools/call-feedback]", { err });
    return NextResponse.json({ ok: false, message: "분석 중 오류가 발생했습니다." }, { status: 500 });
  }
}
