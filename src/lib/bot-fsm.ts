/**
 * 크루즈닷봇 대화 상태머신(FSM) — "파는 봇"의 골격 (작업지시서 §6-5)
 *
 * OPENING(라포) → SPIN_S(상황) → SPIN_P(문제) → SPIN_I(함의)
 *   → VALUE(가치제시) → TRIAL_CLOSE(가정 클로징)
 *       ├ 긍정        → CTA → (CONVERTED)
 *       ├ 이의        → OBJECTION_LOOP (최대 N회 재클로징)
 *       └ 강한거부/N회초과 → GRACEFUL_EXIT (Day0-3 SMS 퍼널 이양)
 *   핫리드 신호(예약금/날짜확정/특실/고가복잡) → HANDOFF(대리점장 핸드오프)
 *
 * 봇은 "예열·자격검증·1차 이의대응 + 핫리드 핸드오프"까지만 한다(사용자 확정: 단독결제 ❌).
 * 따라서 CTA는 "담당 전문가 연결/예약 안내"이고, 실제 클로징은 사람이 닫는다.
 */

export type BotFsmState =
  | "OPENING"
  | "SPIN_S"
  | "SPIN_P"
  | "SPIN_I"
  | "VALUE"
  | "TRIAL_CLOSE"
  | "OBJECTION_LOOP"
  | "CTA"
  | "HANDOFF"
  | "GRACEFUL_EXIT";

export const MAX_CLOSE_ATTEMPTS = 3;
/** intentScore 가 이 값을 넘으면 핫리드로 보고 사람에게 핸드오프 */
export const HOT_LEAD_INTENT = 70;

/** 각 단계의 목표(시스템프롬프트에 주입). */
export const FSM_GOAL: Record<BotFsmState, string> = {
  OPENING: "따뜻하게 인사하고 공감으로 라포를 형성한다. 아직 팔지 않는다.",
  SPIN_S: "고객의 현재 상황(누구와, 언제, 어떤 여행 경험)을 가볍게 묻는다.",
  SPIN_P: "지금 여행에서 불편/고민/걱정(준비·비용·건강·동행)을 끌어낸다.",
  SPIN_I: "그 고민을 방치하면 생기는 아쉬움(놓치는 기회·시기)을 부드럽게 비춘다.",
  VALUE: "확정 상품정보를 근거로 크루즈가 그 고민을 어떻게 해결하는지 가치를 제시한다.",
  TRIAL_CLOSE: "부담 없는 가정 클로징으로 의향을 떠본다(\"이 일정 한번 잡아드려 볼까요?\").",
  OBJECTION_LOOP: "이의의 진짜 이유를 캐고 ScriptPattern 근거로 1차 대응한다. 강요 금지.",
  CTA: "담당 전문가 연결/예약 안내로 자연스럽게 넘긴다(봇은 결제를 단정하지 않는다).",
  HANDOFF: "구매 임박 핫리드. 담당자가 곧 연락드린다고 안심시키고 연락 정보를 정중히 확인한다.",
  GRACEFUL_EXIT: "강요 없이 마무리하고, 원하시면 다음에 또 돕겠다고 여운을 남긴다.",
};

/** 각 단계에서 던질 다음 질문(예시 — 프롬프트 가이드). */
export const FSM_NEXT_QUESTION: Record<BotFsmState, string> = {
  OPENING: "혹시 크루즈 여행은 처음이신가요, 아니면 다녀와 보신 적 있으신가요?",
  SPIN_S: "이번에는 어떤 분과 함께 생각하고 계세요?",
  SPIN_P: "여행 준비하실 때 가장 신경 쓰이는 부분이 어떤 거예요?",
  SPIN_I: "그 부분이 해결되면 마음이 한결 가벼우시겠죠?",
  VALUE: "이 일정은 그 걱정을 덜어드릴 수 있는데, 어떤 점이 제일 궁금하세요?",
  TRIAL_CLOSE: "괜찮으시면 이 일정으로 자리 한번 알아봐 드려도 될까요?",
  OBJECTION_LOOP: "어떤 점이 가장 망설여지시는지 편하게 말씀해 주세요.",
  CTA: "담당 전문가가 자세히 안내드리도록 연결해 드릴까요?",
  HANDOFF: "성함과 연락 가능한 시간만 알려주시면 담당자가 바로 연락드릴게요.",
  GRACEFUL_EXIT: "오늘은 여기까지 보셔도 괜찮아요. 더 궁금하시면 언제든 다시 찾아주세요.",
};

export interface FsmSignals {
  /** 현재 단계 */
  state: BotFsmState;
  /** 누적 클로징 시도 횟수 */
  closeAttempts: number;
  /** 구매의사 점수 0-100 */
  intentScore: number;
  /** 핫리드 신호(예약금/날짜확정/특실/고가복잡) 감지 */
  hotLeadSignal: boolean;
  /** 이번 턴 이의 감지 */
  objectionDetected: boolean;
  /** 이번 턴 긍정/진전 신호(가정 클로징 수락 등) */
  positiveSignal: boolean;
  /** 강한 거부(그만/관심없음/싫어요) */
  strongRefusal: boolean;
}

/**
 * 다음 상태 결정. 핫리드/강한거부는 어느 단계에서든 우선 분기.
 * 봇은 끝까지 밀어붙이지 않는다 — N회 초과 또는 강한 거부면 우아하게 빠진다.
 */
export function nextFsmState(s: FsmSignals): BotFsmState {
  // 0) 우선 분기 — 어느 단계에서든
  if (s.strongRefusal) return "GRACEFUL_EXIT";
  if (s.hotLeadSignal || s.intentScore >= HOT_LEAD_INTENT) return "HANDOFF";
  if (s.state === "HANDOFF" || s.state === "CTA" || s.state === "GRACEFUL_EXIT") {
    return s.state; // 종착 상태 유지
  }

  // 1) 이의 처리 루프
  if (s.objectionDetected) {
    if (s.closeAttempts >= MAX_CLOSE_ATTEMPTS) return "GRACEFUL_EXIT";
    return "OBJECTION_LOOP";
  }

  // 2) 정상 진행
  switch (s.state) {
    case "OPENING":
      return "SPIN_S";
    case "SPIN_S":
      return "SPIN_P";
    case "SPIN_P":
      return "SPIN_I";
    case "SPIN_I":
      return "VALUE";
    case "VALUE":
      return "TRIAL_CLOSE";
    case "TRIAL_CLOSE":
      return s.positiveSignal ? "CTA" : "OBJECTION_LOOP";
    case "OBJECTION_LOOP":
      if (s.positiveSignal) return "CTA";
      if (s.closeAttempts >= MAX_CLOSE_ATTEMPTS) return "GRACEFUL_EXIT";
      return "TRIAL_CLOSE"; // 한 번 더 가정 클로징
    default:
      return s.state;
  }
}

/**
 * 클로징/이의대응 "밀어붙임" 1회 카운트 여부.
 *
 * 🔴 라이브락 방지: 호출자는 이 값이 true면 closeAttempts 를 +1 한 뒤 그 값을 다음 턴
 * nextFsmState(signals.closeAttempts) 로 반드시 넘겨야 한다. 그래야 이의가 계속될 때
 * closeAttempts 가 누적되어 MAX_CLOSE_ATTEMPTS 초과 시 GRACEFUL_EXIT 가 발동한다.
 * TRIAL_CLOSE 또는 OBJECTION_LOOP 로 들어갈 때마다(머무를 때 포함) 1회 시도로 센다.
 */
export function incrementsCloseAttempt(_from: BotFsmState, to: BotFsmState): boolean {
  return to === "TRIAL_CLOSE" || to === "OBJECTION_LOOP";
}
