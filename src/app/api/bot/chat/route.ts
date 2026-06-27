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
import { NextResponse, after } from "next/server";
import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { checkOrigin } from "@/lib/origin-guard";
import { rlIncr } from "@/lib/redis";
import { getBotModel, resolveTurnModelRole, BOT_MAX_TOKENS } from "@/lib/bot-model";
import {
  nextFsmState,
  incrementsCloseAttempt,
  getFsmProfile,
  FSM_GOAL,
  FSM_NEXT_QUESTION,
  type BotFsmState,
  type FsmSignals,
} from "@/lib/bot-fsm";
import {
  sanitizeUserInput,
  buildTrustBoundaryBlock,
  checkOutputGuard,
  checkRecruitOutputGuard,
  maskPiiForStorage,
  SAFE_FALLBACK_MESSAGE,
} from "@/lib/bot-guardrail";
import {
  getProductFactsByCodes,
  searchProductFacts,
  formatFactsForPrompt,
  getPersuasionPatterns,
  formatPersuasionForPrompt,
  recordPersuasionLeadConversion,
  searchGuideAnswers,
  formatGuideAnswersForPrompt,
  buildSystemPrompt,
} from "@/lib/bot-rag";
import {
  buildRecruitSystemPrompt,
  RECRUIT_OFFER_FACTS,
  RECRUIT_FSM_GOAL,
  RECRUIT_FSM_NEXT_QUESTION,
  type BotType,
} from "@/lib/bot-recruit";
import {
  resolveAttribution,
  signAttributionToken,
  type AttributionSource,
} from "@/lib/bot-attribution";
import { notifyAgentHotLead } from "@/lib/bot-handoff";
import { resolveBotImages, type ResolvedBotImage } from "@/lib/bot-images";

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

/**
 * 봇 reply에서 `[IMG:키]` 마커를 뽑아 표시 이미지로 변환하고, 손님에게 보일 텍스트에선 마커를 제거한다.
 * 크루즈 상담봇 전용(모집봇 미적용). 모르는 키는 resolveBotImages가 무시한다.
 */
function extractInlineImages(reply: string): { text: string; images: ResolvedBotImage[] } {
  const re = /\[IMG:\s*([a-zA-Z0-9_]+)\s*\]/g;
  const keys: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(reply)) !== null) keys.push(m[1]);
  if (keys.length === 0) return { text: reply, images: [] };
  // 마커 제거 후 마커로 인해 생긴 빈 줄/공백 정리(손님에겐 마커 안 보이게).
  const text = reply
    .replace(re, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, images: resolveBotImages(keys) };
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

    // 손님이 남긴 연락처(있으면) — 핸드오프 알림에만 포함(저장은 마스킹). raw 에서 추출.
    const phoneMatch = String(body.message).match(/01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/);
    const customerPhone = phoneMatch ? phoneMatch[0].replace(/[-.\s]/g, "") : null;

    // 대화 로드(있으면) — 방문자 불일치 시 탈취 방지로 새 대화 취급
    let convo = conversationId
      ? await prisma.botConversation.findUnique({ where: { id: conversationId } })
      : null;
    if (convo && convo.visitorId !== visitorId) convo = null;

    let issuedAttribution: { agentId: string | null; source: AttributionSource; org: string | null } | null = null;

    if (!convo) {
      // 페이지 조직을 권위로 먼저 확정 → 귀속 폴백을 그 org 로 가둬 크로스조직 오귀속 차단(Phase A).
      const page = landingPageId
        ? await prisma.crmLandingPage.findUnique({
            where: { id: landingPageId },
            select: { id: true, organizationId: true, pageType: true },
          })
        : null;
      const organizationId = page?.organizationId ?? null;
      if (!organizationId || (page && page.pageType !== "bot")) {
        return NextResponse.json({ ok: false, message: "상담을 시작할 수 없습니다." }, { status: 400 });
      }
      const resolved = await resolveAttribution({ shortLinkCode: refCode, visitToken, pageOrganizationId: organizationId });
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
      botType?: string;
    };
    // 봇 종류(코드값). 'recruit'=교육생 모집봇 / 그 외=크루즈 상담봇.
    const botType: BotType = botConfig.botType === "recruit" ? "recruit" : "cruise";

    const signals = detectSignals(message);

    // RAG — 봇 종류별 분기:
    //  · 크루즈 상담봇: 상품(CruiseProduct) 사실 + 승인 스크립트(ScriptPattern) 설득.
    //  · 교육생 모집봇: 확정 오퍼(330/540/750·환불) 고정 사실. 설득은 모집 시스템프롬프트 내장.
    let factsText: string;
    let persuasionText = "";
    let qaKnowledgeText = ""; // 100문100답 상담지식(크루즈 봇 전용 — 전환엔진)
    // 데이터 플라이휠: 이번 턴에 주입한 ScriptPattern id(들). assistant 메시지의 ragSourceIds 에
    // 기록하고, 핸드오프(리드확보) 시 conversionRate/useCount 갱신에 쓴다. recruit 봇은 비움(무영향).
    let citedPatternIds: string[] = [];
    if (botType === "recruit") {
      factsText = RECRUIT_OFFER_FACTS;
    } else {
      const productCodes = Array.isArray(botConfig.productCatalogIds)
        ? botConfig.productCatalogIds.filter((c): c is string => typeof c === "string")
        : [];
      let facts = productCodes.length ? await getProductFactsByCodes(productCodes) : [];
      if (facts.length === 0) facts = await searchProductFacts(message);
      factsText = formatFactsForPrompt(facts);
      // 공개(가벼운) 봇 — 깊은 플레이북을 다 주입하지 않는다(=응답으로 새어 카피되는 것 방지).
      // 상위 1개 가벼운 안심 멘트만. 깊은 클로징·이의대응은 사람(상담원)에게 남긴다.
      const persuasion = await getPersuasionPatterns({
        organizationId: convo.organizationId,
        objectionType: signals.objectionType,
        take: 1,
      });
      persuasionText = formatPersuasionForPrompt(persuasion);
      citedPatternIds = persuasion.map((p) => p.id);
      // 100문100답 상담지식 — 손님 발화 기반 활성 지식 top-N 주입(신뢰·궁금증→신청 전환엔진).
      // 원본은 서버에만(프롬프트가 그대로 인용 금지) = 카피 불가 해자.
      const guideAnswers = await searchGuideAnswers(message);
      qaKnowledgeText = formatGuideAnswersForPrompt(guideAnswers);
    }

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
    // botType별 FSM 강도 — cruise(공개)는 클로징을 빨리 줄이고 사람 연결로 더 일찍 넘긴다.
    // recruit는 기존 프로파일(무영향).
    const newState = nextFsmState(fsmSignals, getFsmProfile(botType));
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

    const systemPrompt =
      botType === "recruit"
        ? buildRecruitSystemPrompt({
            persona: botConfig.persona || "부업·창업을 진지하게 고민하는 분께 정직하게 안내",
            fsmState: newState,
            fsmGoal: RECRUIT_FSM_GOAL[newState],
            nextQuestion: RECRUIT_FSM_NEXT_QUESTION[newState],
          })
        : buildSystemPrompt({
            persona: botConfig.persona || "신중한 50대 고객을 위한 따뜻하고 차분한 상담",
            fsmState: newState,
            fsmGoal: FSM_GOAL[newState],
            nextQuestion: FSM_NEXT_QUESTION[newState],
            factsText,
            persuasionText,
            qaKnowledge: qaKnowledgeText,
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

    // 출력 가드 — 위반 시 안전 폴백 + 사람 연결.
    // 모집봇은 수익보장(표시광고법) 차단 가드를 추가로 적용.
    let handoff = newState === "HANDOFF";
    const guard =
      botType === "recruit"
        ? checkRecruitOutputGuard(reply, factsText)
        : checkOutputGuard(reply, factsText);
    if (!guard.ok) {
      logger.warn("[bot/chat] output guard 위반", {
        violations: guard.violations,
        convoId: convo.id,
      });
      reply = SAFE_FALLBACK_MESSAGE;
      handoff = true;
    }
    if (!reply) reply = SAFE_FALLBACK_MESSAGE;

    // 인라인 설득 이미지(크루즈 상담봇 전용) — 가드 통과 후, 사용자 반환 직전에 마커 추출·제거.
    // 마커 제거된 텍스트를 저장·반환에 함께 써서 손님에겐 마커가 보이지 않게 한다.
    let inlineImages: ResolvedBotImage[] = [];
    if (botType === "cruise") {
      const extracted = extractInlineImages(reply);
      if (extracted.images.length > 0) {
        reply = extracted.text || SAFE_FALLBACK_MESSAGE;
        inlineImages = extracted.images;
      }
    }

    const wasHandedOff = convo.status === "HANDED_OFF"; // 이번 턴 전이 판정용

    // 데이터 플라이휠 — ragSourceIds 에 기록할 ScriptPattern id(들).
    // 가드 위반으로 폴백 응답이 나간 턴은 멘트가 실제로 쓰이지 않았으므로 크레딧하지 않는다.
    const recordedPatternIds = guard.ok ? citedPatternIds : [];

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
          // 어떤 승인 멘트가 이 응답에 쓰였는지 추적(사후 감사 + 플라이휠 피드백 소스).
          ...(recordedPatternIds.length > 0 ? { ragSourceIds: recordedPatternIds } : {}),
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
          // 손님 연락처 1회 저장(첫 번호 보존, 후속 클로징 SMS용)
          ...(customerPhone && !convo.customerPhone ? { customerPhone } : {}),
        },
      }),
    ]);

    // 핫리드 핸드오프 알림 — 이번 턴 처음 HANDED_OFF 가 됐을 때만 1회.
    //   ⚡ 응답 후(after)로 분리: SMS(~1-2초)·플라이휠이 손님 응답을 지연시키지 않게 한다.
    //   Fluid Compute가 응답 반환 후에도 after 콜백 완료를 보장(graceful shutdown)하므로 알림 유실 없음.
    if (handoff && !wasHandedOff) {
      after(async () => {
        await notifyAgentHotLead({
          conversationId: convo.id,
          organizationId: convo.organizationId,
          attributedAgentId: convo.attributedAgentId,
          intentScore: newIntent,
          customerPhone,
        }).catch((e) => logger.error("[bot/chat] 핸드오프 알림 실패", { e: String(e) }));

        // ── 데이터 플라이휠: 리드 확보(=전환 신호) 시 인용 멘트 가중치 갱신 ──────────
        // 가벼운 봇의 전환은 구매가 아니라 "사람 연결(핸드오프)=리드캡처". 이번 대화에서 인용된
        // 모든 승인 멘트(이전 턴 ragSourceIds + 이번 턴)를 모아 useCount+1·conversionRate EMA 갱신
        // → conversionRate desc 정렬을 통해 '리드에 기여한 멘트'가 다음 대화 상위로 올라온다.
        // recruit 봇은 멘트 주입이 없어 자연히 무영향(citedPatternIds 비어 있음).
        // 전체를 try/catch — 실패해도 챗 응답·핸드오프·귀속은 절대 안 깨지게(플라이휠은 부가기능).
        try {
          const priorMsgs = await prisma.botMessage.findMany({
            where: {
              conversationId: convo.id,
              role: "assistant",
              ragSourceIds: { not: Prisma.JsonNull },
            },
            select: { ragSourceIds: true },
          });
          const idSet = new Set<string>(recordedPatternIds);
          for (const m of priorMsgs) {
            const v = m.ragSourceIds;
            if (Array.isArray(v)) {
              for (const x of v) if (typeof x === "string" && x) idSet.add(x);
            }
          }
          if (idSet.size > 0) {
            const updated = await recordPersuasionLeadConversion({
              organizationId: convo.organizationId,
              patternIds: Array.from(idSet),
            });
            logger.info("[bot/chat] 플라이휠 갱신", { convoId: convo.id, updated });
          }
        } catch (e) {
          logger.error("[bot/chat] 플라이휠 갱신 실패(무시)", { e: String(e) });
        }
      });
    }

    const res = NextResponse.json({
      ok: true,
      conversationId: convo.id,
      reply,
      handoff,
      ...(inlineImages.length > 0 ? { images: inlineImages } : {}),
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
