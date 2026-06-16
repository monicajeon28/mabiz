import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { checkRateLimitAsync } from "@/lib/rate-limit";

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
  "objectionTypes": ["PRICE", "TIMING"],
  "customerSegmentDetected": "효도여행",
  "spinActionsPerSegment": {
    "situation": "오프닝 시 고객의 가족 구성과 여행 목적 파악하기",
    "problem": "부모님 건강/안전 우려 및 일정 조율의 어려움 발굴",
    "implication": "해외여행 경험 부족시 불안감을 안정감으로 전환",
    "needPayoff": "효도의 의미를 재정의하고 가족 추억의 가치 강조"
  },
  "relatedSuccessCases": [
    "서울 김 여사 (67세) - 부모님 동반 효도 크루즈 → Day 2 재콜로 최종 결정",
    "대구 이 대표 (55세) - 가격 우려 → 할부제안 + 모니카 감정코칭 → 성약",
    "인천 박 부부 - 신혼 기념 일본 크루즈 → 러맨틱 상품권 제시 → 당일 성약",
    "수원 정 과장 - 1인 친구여행 → 공동구매 혜택 설명 → 추가 2명 소개",
    "광주 홍 여사 - 재구매 고객 → VIP 라운지 업그레이드 → 충성도 극대화"
  ]
}

평가 기준:
- 오프닝: 이름 확인, 시간 동의, 감정 훅
- 니즈발굴: 7가지 질문 활용, 고객 발화 비율 50%+
- 거절대응: 금지어 사용 여부, 날짜 못박기
- 클로징: 링크 발송, 추가 설명 여부
- 감정터치: 감정어 사용, 공감 표현

추가로 아래 5개 페르소나 중 가장 적합한 것을 판단하라:
1. FILIAL_DUTY: 부모님 동반, 건강/안전 중시 → customerSegmentDetected: "효도여행"
2. NEWLYWEDS: 신혼/기념일, 로맨스/가격 중시 → customerSegmentDetected: "신혼부부"
3. SINGLE_ADVENTURE: 1인/친구그룹, 재미/경험 중시 → customerSegmentDetected: "혼자여행"
4. RETIRED_LEISURE: 60세+, 여유/건강 중시 → customerSegmentDetected: "은퇴여가"
5. PRICE_SENSITIVE: 가성비 최우선, 가격반론 많음 → customerSegmentDetected: "가격민감"

spinActionsPerSegment는 SPIN 기법 4단계를 고객 세그먼트에 맞춰 구체적으로 작성:
- situation: 오프닝/고객파악 단계의 구체 액션 (예: "가족 구성 파악" "동반자 확인")
- problem: 고객의 숨겨진 문제/우려 발굴 액션 (예: "건강우려" "예산부담" "시간부족")
- implication: 그 문제의 의미/영향을 고객이 스스로 깨닫도록 유도
- needPayoff: 우리 상품이 어떻게 그 필요를 충족하는지 강조

relatedSuccessCases: 같은 세그먼트의 판매원 성공사례 5개 (구체적으로 작성)
형식: "[지역] [이름] ([나이/직급]) - [원래 문제] → [적용한 기법/판매원] → [최종 결과]"
예시:
- "서울 김 여사 (67세) - 부모님 건강우려 → 모니카 감정공감 + 안전설명 → Day 2 재콜 성약"
- "대구 이 대표 (55세) - 가격민감 → 할부제안 + 수익성 강조 → 당일 서명"
- "부산 박 부부 (38세) - 신혼 기념일 → 러맨틱 상품권 선물 제시 → 사진 예약"
- "수원 정 과장 (43세) - 시간부족 → 온라인 사전등록 + 당일 서류완료 → 성약"
- "인천 홍 여사 (72세) - 재구매고객 → VIP라운지 무료업그레이드 → 추가권 구매"

JSON에 personaType(위 코드값)과 personaConfidence(0~1) 추가.
objectionTypes 배열도 추가 (통화에서 감지된 반론 유형들).

JSON만 반환. 설명 없이.`;

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();

    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, message: '권한이 없습니다.' }, { status: 403 });
    }

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

    // Claude API 호출 전 Rate Limiting (사용자별 분당 10회, 시간당 30회)
    const rlKey = `call-feedback:${ctx.userId}`;
    const rl = await checkRateLimitAsync(rlKey, 10, 60_000);
    if (!rl.allowed) {
      const retryAfterSec = Math.ceil((rl.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { ok: false, message: `요청이 너무 많습니다. ${retryAfterSec}초 후 다시 시도하세요.` },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSec),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
          },
        }
      );
    }

    const message = await anthropic.messages.create(
      {
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: `<call_transcript>\n${text}\n</call_transcript>` }],
      },
      { signal: AbortSignal.timeout(25000) }
    );

    const raw = message.content[0].type === "text" ? message.content[0].text : "{}";

    // JSON 파싱 (코드블록 제거)
    const cleaned = raw.replace(/```json?\n?|\n?```/g, "").trim();
    let result: any;
    try {
      result = JSON.parse(cleaned);
    } catch {
      logger.warn("[CallFeedback] JSON 파싱 실패", { raw: raw.slice(0, 200) });
      return NextResponse.json({ ok: false, message: "AI 응답 형식 오류. 다시 시도해주세요." }, { status: 500 });
    }

    // DB 저장
    const rawTextMasked = text.replace(/01[0-9]-?\d{3,4}-?\d{4}/g, "010-****-****");
    let savedCallLogId: string;
    await prisma.$transaction(async (tx) => {
      const callLog = await tx.aiCallLog.create({
        data: {
          organizationId: resolveOrgId(ctx),
          agentUserId: ctx.userId,
          productType: productType ?? "GENERAL",
          rawTextMasked,
          converted: converted ?? false,
          durationSec: durationSec ?? null,
          analysisStatus: "DONE",
          personaType: result.personaType,
        },
      });
      savedCallLogId = callLog.id;
      await tx.aiCallAnalysis.create({
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
    });

    logger.log("[CallFeedback] 분석 완료", { score: result.score, callLogId: savedCallLogId! });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    logger.error("[POST /api/tools/call-feedback]", { err });
    return NextResponse.json({ ok: false, message: "분석 중 오류가 발생했습니다." }, { status: 500 });
  }
}

