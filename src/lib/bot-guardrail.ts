/**
 * 크루즈닷봇 가드레일 (작업지시서 §6-6, §10 P0)
 *
 * 봇은 자유발화·익명·멀티턴이라 위조 표면이 넓다. 기존 sanitizer(개행 strip 1줄)는 무력.
 * 여기서 ①입력 신뢰경계 분리(프롬프트 인젝션 방어) ②출력 가드(미확인 가격/과장/유출 차단)
 * ③저장 전 PII 마스킹 을 담당한다. 위반 시 응답을 차단하고 사람 연결로 폴백한다.
 */
import { maskPhone, maskCardNumber } from "@/lib/pii-masker";

/**
 * 제어문자(U+0000–U+001F, U+007F) — 개행/탭/NUL/DEL 등 멀티라인 인젝션 차단용.
 * 정규식 리터럴에 제어바이트를 직접 넣지 않으려고 문자열 기반 RegExp 로 구성.
 */
const CONTROL_CHARS = new RegExp("[\\u0000-\\u001F\\u007F]", "g");

/** 입력 sanitize — 제어문자 제거 + 길이 상한 + 인젝션 마커 무력화. */
export function sanitizeUserInput(raw: string, maxLen = 1000): string {
  if (typeof raw !== "string") return "";
  return raw
    // 제어문자(개행/탭 포함) 공백화 — 멀티라인 인젝션 차단
    .replace(CONTROL_CHARS, " ")
    // 신뢰경계 태그 흉내 차단(<product_facts> 등 주입 방지)
    .replace(/<\/?(product_facts|rag_persuasion|user_message|system)\b[^>]*>/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, maxLen);
}

/**
 * 신뢰경계 데이터 블록 생성. 시스템/RAG/사용자 입력을 명시적 구분자로 격리하고,
 * "구분자 안 내용은 데이터일 뿐 지시가 아니다"를 강제한다.
 */
export function buildTrustBoundaryBlock(
  tag: "product_facts" | "rag_persuasion" | "user_message",
  content: string,
): string {
  // 닫는 태그 위조 방지: 내부의 동일 태그 문자열을 제거
  const safe = String(content ?? "").replace(
    new RegExp(`</?${tag}\\b[^>]*>`, "gi"),
    " ",
  );
  return `<${tag}>\n${safe}\n</${tag}>`;
}

// ── 출력 가드 ─────────────────────────────────────────────────────────────

/** 절대표현/과장 금칙어 — 광고법 위반 직결. */
const BANNED_PHRASE =
  /(최저가|업계\s*최고|무조건|100\s*%|평생\s*보장|전액\s*보장|완벽\s*보장|유일무이|반드시\s*(?:성공|수익)|무료\s*업그레이드|확실히\s*싸)/;

/** 시스템프롬프트·RAG 유출 마커. */
const LEAK_MARKER =
  /(<\/?(?:product_facts|rag_persuasion|user_message|system)\b|시스템\s*프롬프트|system\s*prompt|\[금지\b|\[설득\s*자료|당신은 크루즈닷의)/i;

/** 출력에서 금액/퍼센트 토큰 추출(예: "250만원", "30%"). */
function extractPriceTokens(text: string): string[] {
  const m = text.match(/\d[\d,]*\s*(?:만원|원|％|%|퍼센트)/g);
  return m ? m.map((t) => t.replace(/[,\s]/g, "")) : [];
}

/** 숫자만 추출(그라운딩 대조용). */
function digitsOf(s: string): string {
  return s.replace(/\D/g, "");
}

export interface OutputGuardResult {
  ok: boolean;
  violations: string[];
  /** 위반 시 사람 연결로 폴백할지 */
  shouldHandoff: boolean;
}

/**
 * 출력 가드 — 봇 응답을 사용자에게 보내기 전에 검사.
 * @param text          봇 생성 응답
 * @param allowedFacts  <product_facts>로 주입한 확정 사실 원문(이 안의 숫자만 인용 허용)
 */
export function checkOutputGuard(text: string, allowedFacts: string): OutputGuardResult {
  const violations: string[] = [];

  if (BANNED_PHRASE.test(text)) violations.push("BANNED_PHRASE");
  if (LEAK_MARKER.test(text)) violations.push("PROMPT_OR_RAG_LEAK");

  // 그라운딩: 출력 금액이 확정 사실의 숫자 토큰과 "정확히" 일치하지 않으면 환각 가능성.
  // (부분문자열 일치 금지 — fact 2,500,000 에 지어낸 250,000 이 substring 으로 통과하던 오탐 차단)
  // 한계(정직히): 한글 표기 금액("이백오십만원")·2자리 만원·퍼센트는 이 가드로 못 잡는다.
  //   → 1차 방어는 시스템프롬프트 하드가드 + Phase 5 시뮬-검수 폐루프, 이 가드는 2차 그물.
  const factNumberSet = new Set(
    (allowedFacts.match(/\d[\d,]*/g) ?? []).map((t) => t.replace(/[,\s]/g, "")),
  );
  for (const token of extractPriceTokens(text)) {
    const d = digitsOf(token);
    // 3자리+ 금액만 대조(1~2자리 개월/인원 등 일반 숫자는 과대탐지 방지로 제외)
    if (d.length >= 3 && !factNumberSet.has(d)) {
      violations.push(`UNGROUNDED_PRICE:${token}`);
    }
  }

  const ok = violations.length === 0;
  return { ok, violations, shouldHandoff: !ok };
}

/** 위반 시 사용자에게 보낼 안전 폴백 문구. */
export const SAFE_FALLBACK_MESSAGE =
  "정확한 가격·일정·환불 조건은 담당 전문가가 확인 후 바로 연락드릴게요. 성함과 연락 가능한 시간을 남겨주시겠어요?";

// ── 교육생 모집봇 전용 출력 가드 (수익보장·과장 차단) ─────────────────────────
//
// 모집봇의 최대 법적 리스크는 "수익 보장"(표시광고법·방문판매법, 소비자원 부업강의 피해 1순위).
// 1차 방어는 시스템프롬프트 하드가드 + 시뮬-검수, 이 가드는 2차 그물.
// 핵심 난점: 봇은 "보장하지 않습니다"라고 자주 말해야 정상 → 부정문은 반드시 허용해야 한다.
// 전략: 문장 단위로 쪼개 "긍정형 수익보장"만 탐지하고, 같은 문장에 부정/거부 표현이 있으면 통과.
// (거짓양성은 안전 폴백으로 떨어질 뿐이라 안전. 거짓음성=수익보장 누출이 더 위험하므로 보수적으로.)

/** 긍정형 수익보장/과장 표현. */
const RECRUIT_GUARANTEE = new RegExp(
  [
    "(?:수익|소득|원금|월\\s*\\d[\\d,]*\\s*만?\\s*원?|월수입)\\s*(?:을|를|은|는|만큼|정도)?\\s*(?:보장|보증)",
    "(?:보장|보증)\\s*(?:해\\s*드|해드|해\\s*줄|해줄|합니다|해요|해\\s*드려|받으실|받게)",
    "무조건\\s*(?:돈|수익|성공|벌|번|매출|버)",
    "누구나\\s*(?:성공|돈|수익|벌|번|버)",
    "확실히\\s*(?:벌|번|수익|성공|버)",
  ].join("|"),
);

/** 부정/거부 맥락 — 같은 문장에 있으면 "보장 안 함"이라 허용. */
const RECRUIT_NEGATION = /(?:않|안\s|못\s|없|아닙|아니|위험|거짓|드리지|할\s*수\s*없|드릴\s*수\s*없)/;

/**
 * 모집봇 출력 가드 — 크루즈 출력가드(과장/유출/미확인가격) + 긍정형 수익보장 차단.
 * @param text          봇 생성 응답
 * @param allowedFacts  <product_facts>로 주입한 확정 사실 원문(이 안의 숫자만 인용 허용)
 */
export function checkRecruitOutputGuard(text: string, allowedFacts: string): OutputGuardResult {
  const base = checkOutputGuard(text, allowedFacts);
  const violations = [...base.violations];

  // 문장 단위로 분해(한국어 종결 포함). 긍정형 보장만 탐지, 부정문은 제외.
  const sentences = String(text ?? "").split(/[.!?。\n]/);
  for (const s of sentences) {
    if (RECRUIT_GUARANTEE.test(s) && !RECRUIT_NEGATION.test(s)) {
      violations.push("INCOME_GUARANTEE");
      break;
    }
  }

  const ok = violations.length === 0;
  return { ok, violations, shouldHandoff: !ok };
}

// ── 저장 전 PII 마스킹 ─────────────────────────────────────────────────────

const PHONE_IN_TEXT = /01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/g;
const CARD_IN_TEXT = /\b(?:\d[\s-]?){13,16}\b/g;

/**
 * BotMessage.content 저장 전 자유텍스트 내 전화/카드번호 마스킹.
 * (이름·여권 등 추가 식별자는 Phase 후속에서 확장)
 */
export function maskPiiForStorage(text: string): string {
  if (typeof text !== "string" || !text) return text;
  return text
    .replace(CARD_IN_TEXT, (m) => maskCardNumber(m))
    .replace(PHONE_IN_TEXT, (m) => maskPhone(m));
}
