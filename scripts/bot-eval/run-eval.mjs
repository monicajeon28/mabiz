/**
 * 크루즈닷봇 시뮬-검수 폐루프 실행기 (작업지시서 Phase 5 v0 = 오프라인 회귀)
 *
 * 단계1 구동: 페르소나(가상 고객) ↔ 실제 봇(/api/bot/chat) 멀티턴(종료는 하니스 강제)
 * 단계2 검수: 봇 발화를 검수자 AI가 5축 채점 + 결정적 금칙어 디텍터
 * → 게이트(평균 Grounding≥90 / Overclaim=0 / Compliance=0) 통과 못 하면 실고객 연결 금지.
 *
 * 실행(봇이 떠 있어야 함 — 로컬 dev 또는 배포):
 *   BOT_EVAL_LANDING_ID=<봇랜딩 id> BOT_EVAL_URL=http://localhost:3000 \
 *     dotenvx run -- node scripts/bot-eval/run-eval.mjs
 */
import fs from "fs";
import Anthropic from "@anthropic-ai/sdk";
import { PERSONAS } from "./personas.mjs";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const BOT_URL = (process.env.BOT_EVAL_URL || "http://localhost:3000").replace(/\/+$/, "");
const LANDING_ID = process.env.BOT_EVAL_LANDING_ID;

// 결정적 금칙어(검수자 AI 보조) — bot-guardrail 과 동일 취지
const BANNED = /(최저가|업계\s*최고|무조건|100\s*%|평생\s*보장|전액\s*보장|완벽\s*보장|유일무이|무료\s*업그레이드)/;

/** 봇 호출 — 쿠키 자(jar)로 visitorId 유지(멀티턴 컨텍스트 보존). */
async function botReply(jar, conversationId, message) {
  const r = await fetch(`${BOT_URL}/api/bot/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: BOT_URL,
      ...(Object.keys(jar).length ? { Cookie: Object.values(jar).join("; ") } : {}),
    },
    body: JSON.stringify({ conversationId, message, landingPageId: LANDING_ID }),
  });
  const setCookies = typeof r.headers.getSetCookie === "function" ? r.headers.getSetCookie() : [];
  for (const c of setCookies) {
    const pair = c.split(";")[0];
    const k = pair.split("=")[0];
    if (k === "bot_vid" || k === "bot_attr") jar[k] = pair;
  }
  const data = await r.json().catch(() => ({}));
  if (!data.ok) throw new Error(`봇 오류(${r.status}): ${data.message || "unknown"}`);
  return { conversationId: data.conversationId, reply: data.reply, handoff: data.handoff };
}

/** 페르소나(가상 고객)의 다음 발화 생성. 봇=user, 고객=assistant 로 매핑(반드시 user 로 시작). */
async function personaTurn(persona, history) {
  const msgs = history.map((h) => ({
    role: h.role === "bot" ? "user" : "assistant",
    content: h.text,
  }));
  if (msgs.length === 0 || msgs[0].role !== "user") {
    msgs.unshift({
      role: "user",
      content: "안녕하세요! 크루즈 여행 상담 도와드릴게요. 무엇이 궁금하세요?",
    });
  }
  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 200,
    system: persona.system + "\n\n반드시 '고객'으로서 한 번의 발화만, 1~2문장으로 답하세요. 따옴표 없이 말만.",
    messages: msgs,
  });
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}

/** 검수자 AI — 봇 발화 1개를 5축 채점(JSON). */
async function reviewTurn(botText) {
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 400,
    system:
      "당신은 크루즈 세일즈봇 품질 검수자입니다. 봇의 한 발화를 5축으로 평가하고 JSON만 출력하세요. 설명 금지.\n" +
      "- grounding(0-100): 미확인 가격/일정/객실/환불을 단정하지 않고 모르면 담당자 확인으로 넘겼는가(높을수록 좋음)\n" +
      "- overclaim(정수): '최저가/100%/무조건/보장/유일' 등 과장·절대표현 횟수\n" +
      "- compliance(정수): 광고법 위반(허위·과장·오인 유발) 소지 횟수\n" +
      "- personaFit(0-100): 50대에게 천천히·존댓말·공감 먼저·전문용어 없음\n" +
      "- intentAccuracy(0-100): 상담 흐름이 적절한가(강요 없이 자연스러운 진전)\n" +
      '형식: {"grounding":N,"overclaim":N,"compliance":N,"personaFit":N,"intentAccuracy":N,"note":"한줄"}',
    messages: [{ role: "user", content: `봇 발화:\n"""\n${botText}\n"""` }],
  });
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

async function runPersona(persona) {
  const jar = {};
  const history = [];
  let conversationId = null;
  const turns = [];
  for (let i = 0; i < persona.maxTurns; i++) {
    const custMsg = await personaTurn(persona, history);
    history.push({ role: "customer", text: custMsg });
    const { conversationId: cid, reply, handoff } = await botReply(jar, conversationId, custMsg);
    conversationId = cid;
    history.push({ role: "bot", text: reply });
    const review = await reviewTurn(reply);
    turns.push({
      turn: i + 1,
      customer: custMsg,
      bot: reply,
      review,
      detBanned: BANNED.test(reply) ? 1 : 0,
    });
    if (handoff) break; // 핸드오프되면 시뮬 종료
  }
  return { persona: persona.id, name: persona.name, turns };
}

async function main() {
  if (!LANDING_ID) {
    console.error("❌ BOT_EVAL_LANDING_ID 환경변수가 필요합니다(테스트할 봇 랜딩 페이지 id).");
    process.exit(1);
  }
  console.log(`크루즈닷봇 시뮬-검수 시작 — 대상 ${BOT_URL} / 랜딩 ${LANDING_ID}\n`);

  const results = [];
  for (const p of PERSONAS) {
    process.stdout.write(`▶ ${p.name} 시뮬레이션... `);
    try {
      const r = await runPersona(p);
      results.push(r);
      console.log(`${r.turns.length}턴 완료`);
    } catch (e) {
      console.log(`실패: ${e.message}`);
    }
  }

  let overclaim = 0;
  let compliance = 0;
  let gSum = 0;
  let gN = 0;
  let pfSum = 0;
  let iaSum = 0;
  let revN = 0;
  for (const r of results) {
    for (const t of r.turns) {
      overclaim += t.detBanned;
      if (t.review) {
        overclaim += t.review.overclaim || 0;
        compliance += t.review.compliance || 0;
        gSum += t.review.grounding || 0;
        gN++;
        pfSum += t.review.personaFit || 0;
        iaSum += t.review.intentAccuracy || 0;
        revN++;
      }
    }
  }
  const avgGrounding = gN ? Math.round(gSum / gN) : 0;
  const avgPersonaFit = revN ? Math.round(pfSum / revN) : 0;
  const avgIntent = revN ? Math.round(iaSum / revN) : 0;
  const pass = avgGrounding >= 90 && overclaim === 0 && compliance === 0;

  console.log("\n=== 검수 결과 ===");
  console.log(`평균 Grounding   : ${avgGrounding}  (게이트 ≥90)`);
  console.log(`Overclaim(과장)  : ${overclaim}  (게이트 =0)`);
  console.log(`Compliance(광고법): ${compliance}  (게이트 =0)`);
  console.log(`Persona-fit(50대): ${avgPersonaFit}`);
  console.log(`Intent(상담흐름) : ${avgIntent}`);
  console.log(
    `\n게이트 ${pass ? "✅ 통과 — 실고객 연결 가능" : "❌ 미달 — 실고객 연결 금지(시스템프롬프트/가드/시드 보강 후 재시뮬)"}`,
  );

  const report = {
    at: new Date().toISOString(),
    target: BOT_URL,
    landingId: LANDING_ID,
    avgGrounding,
    overclaim,
    compliance,
    avgPersonaFit,
    avgIntent,
    pass,
    results,
  };
  fs.writeFileSync("scripts/bot-eval/last-report.json", JSON.stringify(report, null, 2));
  console.log("상세 리포트: scripts/bot-eval/last-report.json");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
