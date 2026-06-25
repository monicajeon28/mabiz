/**
 * 크루즈닷봇 모델 라우팅 SSoT (작업지시서 §6-1)
 *
 * 기존 5개 라우트가 모델지정을 env(1)·하드코딩최신(3)·날짜스냅샷(1)로 혼재시켰던 문제를
 * 봇 도메인에서는 이 단일 헬퍼로 통일한다. **날짜 스냅샷 suffix(예: -20251001) 답습 금지** —
 * 별칭(alias) 또는 env override만 사용한다.
 */

export type BotModelRole = "chat" | "closing";

/** 기본 모델(별칭). env override 우선. */
const DEFAULT_MODELS: Record<BotModelRole, string> = {
  // 인사·FAQ·라포·SPIN 질문: 응답속도=전환율(50대 0.2초), 대량 트래픽 비용 최적
  chat: "claude-haiku-4-5",
  // 클로징·이의대응·심리렌즈 멘트: 설득 품질=매출 직결
  closing: "claude-sonnet-4-6",
};

/** 역할별 모델 id 해결 (env > 기본 별칭). */
export function getBotModel(role: BotModelRole): string {
  if (role === "closing") {
    return process.env.BOT_CLOSING_MODEL || DEFAULT_MODELS.closing;
  }
  return process.env.BOT_CHAT_MODEL || DEFAULT_MODELS.chat;
}

/** 역할별 max_tokens 상한 (무한 상향 금지 — 비용/지연 통제). */
export const BOT_MAX_TOKENS: Record<BotModelRole, number> = {
  chat: 1024,
  closing: 2048,
};

/** haiku → sonnet 에스컬레이션을 부르는 이의 유형(설득 난이도 高). */
const HEAVY_OBJECTION_TYPES = ["가격", "의료", "건강", "가족"] as const;

/**
 * 에스컬레이션 판단(작업지시서 §6-1): 기본은 haiku 유지하고, 아래 조건일 때만 sonnet 1회.
 *  ① 무거운 이의 감지(가격/의료/건강/가족)
 *  ② 사용자가 구매/계약/예약 의사 표현
 *  ③ FSM이 클로징/이의 루프 단계
 *  ④ N턴 이상 미전환
 */
export function shouldEscalateToClosing(input: {
  objectionType?: string | null;
  turnCount: number;
  purchaseIntentSignal: boolean;
  fsmState?: string;
}): boolean {
  if (
    input.objectionType &&
    (HEAVY_OBJECTION_TYPES as readonly string[]).includes(input.objectionType)
  ) {
    return true;
  }
  if (input.purchaseIntentSignal) return true;
  if (input.fsmState === "TRIAL_CLOSE" || input.fsmState === "OBJECTION_LOOP") {
    return true;
  }
  if (input.turnCount >= 6) return true;
  return false;
}

/** 현재 턴에 사용할 역할 결정 — 에스컬레이션이면 closing, 아니면 chat. */
export function resolveTurnModelRole(input: {
  objectionType?: string | null;
  turnCount: number;
  purchaseIntentSignal: boolean;
  fsmState?: string;
}): BotModelRole {
  return shouldEscalateToClosing(input) ? "closing" : "chat";
}
