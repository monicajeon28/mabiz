/**
 * 크루즈닷봇 상담 API (작업지시서 Phase 3)
 *
 * 비스트리밍 MVP: 요청 → 봇 응답 1회(클라이언트는 "작성 중…" 표시). 스트리밍은 후속 강화.
 * 두뇌 lib 6종을 배선한다: 모델 라우팅·FSM·RAG(사실/설득)·가드레일·귀속 보안.
 *
 * 보안/경쟁사 복제 방지:
 *  - 지식(시스템프롬프트·RAG·스크립트)은 **서버에서만** 사용, 클라엔 응답텍스트만 반환.
 *  - 입력 sanitize + 출력 가드(미확인 가격/과장/지식유출 차단).
 *  - anti-scraping: visitor/IP rate limit(대량 응답수집 reverse-engineering 차단).
 *  - 귀속: 클라 입력 불신, ShortLink 서버재조회 + HMAC 서명쿠키.
 */
import { NextResponse } from "next/server";
import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { checkOrigin } from "@/lib/origin-guard";
import { rlIncr } from "@/lib/redis";
import { getBotModel, resolveTurnModelRole, BOT_MAX_TOKENS } from "@/lib/bot-model";
import {
  nextFsmState,
  incrementsCloseAttempt,
  FSM_GOAL,
  FSM_NEXT_QUESTION,
  type BotFsmState,
  type FsmSignals,
} from "@/lib/bot-fsm";
import {
  sanitizeUserInput,
  buildTrustBoundaryBlock,
  checkOutputGuard,
  maskPiiForStorage,
  SAFE_FALLBACK_MESSAGE,
} from "@/lib/bot-guardrail";
import {
  getProductFactsByCodes,
  searchProductFacts,
  formatFactsForPrompt,
  getPersuasionPatterns,
  formatPersuasionForPrompt,
  buildSystemPrompt,
} from "@/lib/bot-rag";
import {
  resolveAttribution,
  signAttributionToken,
  type AttributionSource,
} from "@/lib/bot-attribution";

export const runtime = "nodejs"; // Prisma adapter-pg → Node 전용(Edge 금지)
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * 인메모리 폴백 rate limiter — redis(rlIncr) 가 null(미설정/장애)일 때 비용폭주 2차 방어.
 * 익명·유료LLM 공개 엔드포인트라 fail-open 금지. 인스턴스 로컬이지만 없는 것보다 훨씬 안전.
 * 바운드(만료 청소 + 하드캡 clear)로 메모리 누수 방지.
 */
const memBuckets = new Map<string, { count: number; resetAt: number }>();
const MEM_MAX_KEYS = 10000;

function memRateLimit(key: string, limit: number, windowSec: number): boolean {
  const now = Date.now();
  if (memBuckets.size > MEM_MAX_KEYS) {
    for (const [k, v] of memBuckets) if (v.resetAt <= now) memBuckets.delete(k);
    if (memBuckets.size > MEM_MAX_KEYS) memBuckets.clear();
  }
  const b = memBuckets.get(key);
  if (!b || b.resetAt <= now) {
    memBuckets.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return true;
  }
  b.count++;
  return b.count <= limit;
}

/** redis 정상이면 그 카운트로, null이면 인메모리 폴백으로 판정(fail-open 차단). */
async function withinRateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const n = await rlIncr(key, windowSec);
  return n !== null ? n <= limit : memRateLimit(key, limit, windowSec);
}

function readCookie(header: string, name: string): string | null {
  const m = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function newVisitorId(): string {
  return crypto.randomBytes(16).toString("hex");
}

/** MVP 신호 감지(키워드 휴리스틱) — Phase 5 검수루프로 정밀화. */
function detectSignals(msg: string) {
  const objectionMap: Array<[string, RegExp]> = [
    ["가격", /비싸|가격|얼마|할인|부담|저렴|비용/],
    ["시간", /시간|바쁘|일정|언제|날짜/],
    ["신뢰", /믿|사기|진짜|불안|의심|보증/],
    ["가족", /남편|아내|와이프|가족|상의|자식|아들|딸/],
    ["기항지", /어디|기항|항구|도시|코스/],
    ["건강", /건강|아프|몸|약|병|체력|멀미/],
    ["연기", /나중|다음에|천천히|고민|생각.?좀/],
    ["경쟁사", /다른\s*곳|비교|타사|딴\s*데/],
    ["환불", /환불|취소|못\s*가|변경/],
  ];
  let objectionType: string | null = null;
  for (const [t, re] of objectionMap) {
    if (re.test(msg)) {
      objectionType = t;
      break;
    }
  }
  const purchaseIntent = /예약|구매|계약|신청|할게|하고\s*싶|가고\s*싶|결제/.test(msg);
  const hotLead = /예약금|계약|지금\s*바로|결제|당장/.test(msg) || purchaseIntent;
  const positive = /(^|\s)(네|예|좋아|그래|응|맞아|알겠|할게)/.test(msg);
  const refusal = /안\s*할|안\s*해|관심\s*없|그만|싫|됐어|필요\s*없/.test(msg);
  let intentDelta = 0;
  if (purchaseIntent) intentDelta += 30;
  if (positive) intentDelta += 10;
  if (hotLead) intentDelta += 20;
  if (refusal) intentDelta -= 30;
  return { objectionType, purchaseIntent, hotLead, positive, refusal, intentDelta };
}

export async function POST(req: Request) {
  try {
    if (!checkOrigin(req, "BotChat")) {
      return NextResponse.json({ ok: false, message: "잘못된 접근입니다." }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body.message !== "string") {
      return NextResponse.json({ ok: false, message: "메시지가 없습니다." }, { status: 400 });
    }
    const conversationId: string | null =
      typeof body.conversationId === "string" ? body.conversationId : null;
    const landingPageId: string | null =
      typeof body.landingPageId === "string" ? body.landingPageId : null;
    const refCode: string | null = typeof body.ref === "string" ? body.ref : null;

    const cookieHeader = req.headers.get("cookie") ?? "";
    const visitorId = readCookie(cookieHeader, "bot_vid") || newVisitorId();
    const visitToken = readCookie(cookieHeader, "visitToken");

    // anti-scraping rate limit (visitor 분당 + IP 분당)
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const vidOk = await withinRateLimit(`bot:msg:vid:${visitorId}`, 15, 60);
    const ipOk = await withinRateLimit(`bot:msg:ip:${ip}`, 30, 60);
    if (!vidOk || !ipOk) {
      return NextResponse.json(
        { ok: false, message: "잠시 후 다시 시도해주세요." },
        { status: 429 },
      );
    }

    const message = sanitizeUserInput(body.message, 1000);
    if (!message) {
      return NextResponse.json({ ok: false, message: "메시지를 입력해주세요." }, { status: 400 });
    }

    // 대화 로드(있으면) — 방문자 불일치 시 탈취 방지로 새 대화 취급
    let convo = conversationId
      ? await prisma.botConversation.findUnique({ where: { id: conversationId } })
      : null;
    if (convo && convo.visitorId !== visitorId) convo = null;

    let issuedAttribution: { agentId: string | null; source: AttributionSource; org: string | null } | null = null;

    if (!convo) {
      const resolved = await resolveAttribution({ shortLinkCode: refCode, visitToken });
      const page = landingPageId
        ? await prisma.crmLandingPage.findUnique({
            where: { id: landingPageId },
            select: { id: true, organizationId: true, pageType: true },
          })
        : null;
      const organizationId = resolved.organizationId ?? page?.organizationId ?? null;
      if (!organizationId || (page && page.pageType !== "bot")) {
        return NextResponse.json({ ok: false, message: "상담을 시작할 수 없습니다." }, { status: 400 });
      }
      convo = await prisma.botConversation.create({
        data: {
          organizationId,
          landingPageId: page?.id ?? landingPageId ?? null,
          attributedAgentId: resolved.attributedAgentId,
          attributionSource: resolved.attributionSource,
          shortLinkCode: resolved.shortLinkCode,
          visitorId,
          channel: "bot_landing",
          status: "ACTIVE",
          fsmState: "OPENING",
        },
      });
      issuedAttribution = {
        agentId: resolved.attributedAgentId,
        source: resolved.attributionSource,
        org: organizationId,
      };
    }

    // botConfig 로드(상품 카탈로그·페르소나)
    const page = convo.landingPageId
      ? await prisma.crmLandingPage.findUnique({
          where: { id: convo.landingPageId },
          select: { botConfig: true },
        })
      : null;
    const botConfig = (page?.botConfig ?? {}) as {
      productCatalogIds?: string[];
      persona?: string;
    };

    // RAG — 사실(상품) / 설득(스크립트) 분리
    const productCodes = Array.isArray(botConfig.productCatalogIds)
      ? botConfig.productCatalogIds.filter((c): c is string => typeof c === "string")
      : [];
    let facts = productCodes.length ? await getProductFactsByCodes(productCodes) : [];
    if (facts.length === 0) facts = await searchProductFacts(message);
    const factsText = formatFactsForPrompt(facts);

    const signals = detectSignals(message);
    const persuasion = await getPersuasionPatterns({
      organizationId: convo.organizationId,
      objectionType: signals.objectionType,
    });
    const persuasionText = formatPersuasionForPrompt(persuasion);

    // FSM 전이
    const prevState = convo.fsmState as BotFsmState;
    const fsmSignals: FsmSignals = {
      state: prevState,
      closeAttempts: convo.closeAttempts,
      intentScore: convo.intentScore,
      hotLeadSignal: signals.hotLead,
      objectionDetected: !!signals.objectionType,
      positiveSignal: signals.positive,
      strongRefusal: signals.refusal,
    };
    const newState = nextFsmState(fsmSignals);
    const newCloseAttempts =
      convo.closeAttempts + (incrementsCloseAttempt(prevState, newState) ? 1 : 0);
    const newIntent = Math.max(0, Math.min(100, convo.intentScore + signals.intentDelta));

    const userTurns = await prisma.botMessage.count({
      where: { conversationId: convo.id, role: "user" },
    });
    const role = resolveTurnModelRole({
      objectionType: signals.objectionType,
      turnCount: userTurns + 1,
      purchaseIntentSignal: signals.purchaseIntent,
      fsmState: newState,
    });

    const systemPrompt = buildSystemPrompt({
      persona: botConfig.persona || "신중한 50대 고객을 위한 따뜻하고 차분한 상담",
      fsmState: newState,
      fsmGoal: FSM_GOAL[newState],
      nextQuestion: FSM_NEXT_QUESTION[newState],
      factsText,
      persuasionText,
    });

    // 히스토리 + 현재 발화(신뢰경계 블록)
    const history = await prisma.botMessage.findMany({
      where: { conversationId: convo.id, status: "complete", role: { in: ["user", "assistant"] } },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { role: true, content: true },
    });
    const messages: Anthropic.MessageParam[] = [
      ...history.map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      })),
      { role: "user", content: buildTrustBoundaryBlock("user_message", message) },
    ];

    // 모델 호출(비스트리밍)
    const completion = await anthropic.messages.create({
      model: getBotModel(role),
      max_tokens: BOT_MAX_TOKENS[role],
      system: systemPrompt,
      messages,
    });
    let reply = completion.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    // 출력 가드 — 위반 시 안전 폴백 + 사람 연결
    let handoff = newState === "HANDOFF";
    const guard = checkOutputGuard(reply, factsText);
    if (!guard.ok) {
      logger.warn("[bot/chat] output guard 위반", {
        violations: guard.violations,
        convoId: convo.id,
      });
      reply = SAFE_FALLBACK_MESSAGE;
      handoff = true;
    }
    if (!reply) reply = SAFE_FALLBACK_MESSAGE;

    // 영속화(PII 마스킹) + 대화 상태 갱신
    await prisma.$transaction([
      prisma.botMessage.create({
        data: {
          conversationId: convo.id,
          role: "user",
          content: maskPiiForStorage(message),
          status: "complete",
        },
      }),
      prisma.botMessage.create({
        data: {
          conversationId: convo.id,
          role: "assistant",
          content: maskPiiForStorage(reply),
          status: "complete",
          modelUsed: role,
          objectionType: signals.objectionType ?? null,
          tokensIn: completion.usage?.input_tokens ?? null,
          tokensOut: completion.usage?.output_tokens ?? null,
        },
      }),
      prisma.botConversation.update({
        where: { id: convo.id },
        data: {
          fsmState: handoff ? "HANDOFF" : newState,
          closeAttempts: newCloseAttempts,
          intentScore: newIntent,
          lastMessageAt: new Date(),
          status: handoff ? "HANDED_OFF" : convo.status,
        },
      }),
    ]);

    const res = NextResponse.json({
      ok: true,
      conversationId: convo.id,
      reply,
      handoff,
    });
    res.cookies.set("bot_vid", visitorId, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 86400,
      path: "/",
    });
    if (issuedAttribution) {
      const token = signAttributionToken({
        v: visitorId,
        a: issuedAttribution.agentId,
        o: issuedAttribution.org,
        s: issuedAttribution.source,
      });
      if (token) {
        res.cookies.set("bot_attr", token, {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          maxAge: 86400,
          path: "/",
        });
      }
    }
    return res;
  } catch (err) {
    logger.error("[POST /api/bot/chat]", { err: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      { ok: false, message: "잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  }
}
