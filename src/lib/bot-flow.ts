/**
 * 크루즈 세일즈봇 버튼 A/B 플로우 정본 (작업지시서 2026-06-28 Phase B)
 *
 * 🔑 해자(moat): 이 플로우 그래프(카피·분기·heat)는 **서버 코드 상수**다. 손님 클라이언트엔
 *   "현재 노드 + 선택지 라벨"만 내려가고, heat 계산·다음 노드 결정은 서버에서만 한다.
 *   → 경쟁사가 퍼널 로직을 통째로 베낄 수 없다.
 *
 * 🔥 핫DB: 버튼마다 명시적 intentDelta(heat)+signalTag(콜 9대 반론)를 둔다(자유텍스트 regex 의존 폐기).
 *   "가격궁금·비용부담·진짜믿어?" 같은 ⓑ는 콜드가 아니라 **고관여 신중형(cautiousHighIntent)** 으로
 *   별도 태그한다(팩트 확인 후 사는 최우량 세그먼트). 클릭 경로 → 누적 heat·반론태그 → 신청 시
 *   BotConversation 으로 올려 기존 핫리드 SMS·heat 정렬 대시보드에 합류.
 *
 * ⚖️ 컴플라이언스: 카피에 절대표현(100%보장·최저가·무조건) 0, 수익·부업·모집 언급 0,
 *   환불은 조건·기간 명시. (버튼 카피는 AI 가드 밖이므로 카피 자체가 합법이어야 — 정적 린트 대상)
 *
 * 이미지: /public/bot/guide-*.webp (사장님 스토리보드, ASCII 안정경로).
 */

/** 핫리드 단일 임계값 — SMS 알림 🔥·대시보드 빨강·hotCount 공용(표류 방지). */
export const HOT_LEAD_MIN = 70;
/** BotConversation.source 값 — 오타 1글자면 멱등 깨짐(매직스트링 상수화). */
export const BOT_SOURCE = { CHAT: "chat", BUTTON_GATE: "button_gate" } as const;

export type FlowTarget = string | "lead" | "chat"; // 노드 id | 신청 게이트 | AI 채팅(비상구)

export interface FlowChoice {
  label: string;
  to: FlowTarget;
  /** heat 가산(서버에서만 적용, 0~100 클램프). 구매의향↑ = 양수, 정보탐색 = 소폭, 이탈 = 음수 */
  intentDelta: number;
  /** 콜 9대 반론/신호 태그 — 신청 시 누적 저장(판매원 공략 설계도) */
  signalTag?: ObjectionTag;
  /** ⓑ 고관여 신중형(가격·신뢰·직접질문) — 콜드 아님, 별도 큐 */
  cautiousHighIntent?: boolean;
}

export type ObjectionTag =
  | "가격" | "시간" | "신뢰" | "가족" | "기항지"
  | "건강" | "연기" | "경쟁사" | "환불" | "구매의향" | "임박";

export interface FlowNode {
  id: string;
  image?: string;
  title: string;
  body: string;
  /** story=서사(A/B 2개), qualify=자격검증(3~4개 단일선택) */
  kind: "story" | "qualify";
  choices: FlowChoice[];
}

export const FLOW_V1_START = "hook";

/**
 * 플로우 그래프. PASONA + 콜 심리:
 * hook(후킹) → picture(미래페이싱) → problem(문제·자극) → solution(해결+건강안심)
 * → trust(신뢰+가족선제) → price(오퍼) / doubt(의심반박) → qualify_when→qualify_who → lead.
 * 모든 경로는 lead(신청)로 수렴. 이탈출구는 doubt의 chat(AI 비상구) 하나.
 */
export const FLOW_V1: Record<string, FlowNode> = {
  hook: {
    id: "hook",
    image: "/bot/guide-01-hook.webp",
    title: "부산에서 떠나는 일본·동남아 크루즈 ✨",
    body: "티켓만 받는 자유여행, 막막하지 않으세요? 크루즈닷은 인솔자가 처음부터 끝까지 함께해요.",
    kind: "story",
    choices: [
      { label: "네, 자유여행이 좀 걱정돼요", to: "picture", intentDelta: 5, signalTag: "시간" },
      { label: "가격부터 보고 싶어요", to: "price", intentDelta: 15, signalTag: "가격", cautiousHighIntent: true },
    ],
  },
  picture: {
    id: "picture",
    image: "/bot/guide-02.webp",
    title: "갑판 위에서 노을 보며, 따뜻한 차 한 잔 🌅",
    body: "손주에게 보낼 사진도 한가득. 크루즈는 '준비'보다 '즐기는' 여행이에요.",
    kind: "story",
    choices: [
      { label: "상상만 해도 좋네요", to: "problem", intentDelta: 10 },
      { label: "근데 저는 좀 걱정이…", to: "problem", intentDelta: 5 },
    ],
  },
  problem: {
    id: "problem",
    image: "/bot/guide-05.webp",
    title: "크루즈항에서 '도와주세요!' 정말 많이 들어요 😢",
    body: "짐을 다른 배에 넣거나, 객실을 못 찾거나, 영어가 안 통하거나, 비행기 연착으로 배를 놓칠 뻔하거나…",
    kind: "story",
    choices: [
      { label: "맞아요, 그게 걱정이에요", to: "solution", intentDelta: 10, signalTag: "시간" },
      { label: "영어가 특히 걱정돼요", to: "solution", intentDelta: 10, signalTag: "기항지" },
    ],
  },
  solution: {
    id: "solution",
    image: "/bot/guide-08.webp",
    title: "그래서 인솔자가 여행 전·중·후 함께해요",
    body: "짐·객실·길·통역까지 챙기고, 엘리베이터·의료진 있는 큰 배라 무릎 불편하셔도 편하게 다니세요. (실제 손님과 나눈 대화예요)",
    kind: "story",
    choices: [
      { label: "오, 든든하네요", to: "trust", intentDelta: 10 },
      { label: "비용이 부담돼요", to: "price", intentDelta: 12, signalTag: "가격", cautiousHighIntent: true },
    ],
  },
  trust: {
    id: "trust",
    image: "/bot/guide-review.webp",
    title: "다녀오신 분들이 가장 좋았다고 하세요 ⭐",
    body: "'생애 첫 크루즈, 좋은 추억 담아간다'고요. 처음엔 가족이 말렸는데 다녀와서 제일 좋아하셨대요. 결제는 신한은행 안심결제로 진행돼요.",
    kind: "story",
    choices: [
      { label: "저도 상담받고 싶어요", to: "qualify_when", intentDelta: 20, signalTag: "구매의향" },
      { label: "진짜 믿어도 되나요?", to: "doubt", intentDelta: 8, signalTag: "신뢰", cautiousHighIntent: true },
    ],
  },
  price: {
    id: "price",
    image: "/bot/guide-10.webp",
    title: "부담 안 가지셔도 돼요 😊",
    body: "먼저 33,000원 크루즈닷 골드회원으로 시작하시면 인솔자가 맞춤 크루즈 정보를 챙겨드려요. 정확한 가격·할인은 담당 전문가가 안내해 드립니다.",
    kind: "story",
    choices: [
      { label: "좋아요, 신청할게요", to: "qualify_when", intentDelta: 25, signalTag: "구매의향" },
      { label: "무료 정보부터 받아볼래요", to: "qualify_when", intentDelta: 15 },
    ],
  },
  doubt: {
    id: "doubt",
    image: "/bot/guide-12.webp",
    title: "걱정되시는 마음, 당연해요",
    body: "크루즈닷은 정식 등록 여행사예요. 신한은행 안심결제로 진행되고, 골드회원은 결제 후 7일 이내(콘텐츠 미이용 시) 청약철회·환불이 됩니다.",
    kind: "story",
    choices: [
      { label: "안심돼요, 상담받을래요", to: "qualify_when", intentDelta: 18, signalTag: "신뢰" },
      { label: "궁금한 걸 직접 물어볼래요", to: "chat", intentDelta: 10 },
    ],
  },
  // ── 자격검증(BANT) — 큰 단일선택, 입력창 없이 클릭만. "맞춤 정보를 챙겨드리려고요" 프레임 ──
  qualify_when: {
    id: "qualify_when",
    title: "언제쯤 떠나고 싶으세요?",
    body: "맞춤 정보를 정확히 챙겨드리려고요. 편하게 골라 주세요.",
    kind: "qualify",
    choices: [
      { label: "올해 안에", to: "qualify_who", intentDelta: 25, signalTag: "임박" },
      { label: "내년 봄쯤", to: "qualify_who", intentDelta: 12 },
      { label: "천천히 보는 중", to: "qualify_who", intentDelta: 3, signalTag: "연기" },
    ],
  },
  qualify_who: {
    id: "qualify_who",
    title: "누구와 함께 가고 싶으세요?",
    body: "함께 가실 분에 맞춰 안내해 드릴게요.",
    kind: "qualify",
    choices: [
      { label: "부부 둘이", to: "lead", intentDelta: 8 },
      { label: "부모님 효도여행", to: "lead", intentDelta: 10, signalTag: "가족" },
      { label: "친구·모임과", to: "lead", intentDelta: 6 },
      { label: "혼자서", to: "lead", intentDelta: 5 },
    ],
  },
};

// ── 서버 전용 heat·태그 계산 (클라가 보낸 점수 불신 — 경로만 받아 서버가 재계산) ──────────

export interface FlowPathStep {
  nodeId: string;
  choiceIndex: number;
}

export interface FlowHeatResult {
  /** 0~100 누적 의향 점수 (BotConversation.intentScore 로 적재) */
  heat: number;
  /** 누적 반론/신호 태그(중복 제거) — 판매원 공략 설계도 */
  tags: ObjectionTag[];
  /** 고관여 신중형 경로 여부(별도 큐) */
  cautious: boolean;
  /** 자격검증 응답(시기·동행) — qualifiers 로 적재 */
  qualifiers: { when?: string; who?: string };
}

/** 클릭 경로 → 서버 재계산. 유효하지 않은 엣지는 무시(조작 방어). */
export function computeFlowHeat(path: FlowPathStep[]): FlowHeatResult {
  let heat = 0;
  const tags = new Set<ObjectionTag>();
  let cautious = false;
  const qualifiers: { when?: string; who?: string } = {};
  // 경로 연결성 검증: 시작은 hook, 이후 step은 직전 choice.to 와 일치해야 함.
  //   → 조작된 비연결 경로(임의 고득점 노드 나열)로 heat 부풀리기 차단(서버 재계산 신뢰성).
  let expected: string | null = FLOW_V1_START;

  for (const step of path) {
    if (expected === null || step.nodeId !== expected) break; // 끊긴/위조 경로 → 중단
    const node: FlowNode | undefined = FLOW_V1[step.nodeId];
    if (!node) break;
    const choice: FlowChoice | undefined = node.choices[step.choiceIndex];
    if (!choice) break;
    heat += choice.intentDelta;
    if (choice.signalTag) tags.add(choice.signalTag);
    if (choice.cautiousHighIntent) cautious = true;
    if (node.id === "qualify_when") qualifiers.when = choice.label;
    if (node.id === "qualify_who") qualifiers.who = choice.label;
    expected = choice.to === "lead" || choice.to === "chat" ? null : choice.to;
  }

  return {
    heat: Math.max(0, Math.min(100, heat)),
    tags: Array.from(tags),
    cautious,
    qualifiers,
  };
}

/**
 * 그래프 무결성 검증(개발/테스트용) — 고아 타깃·미도달 노드 탐지.
 * @returns 문제 목록(빈 배열이면 정상)
 */
export function validateFlow(flow: Record<string, FlowNode> = FLOW_V1): string[] {
  const problems: string[] = [];
  const ids = new Set(Object.keys(flow));
  const terminals = new Set<FlowTarget>(["lead", "chat"]);
  // 1) 모든 choice.to 가 존재하는 노드 or 터미널
  for (const node of Object.values(flow)) {
    if (node.choices.length < 2) problems.push(`${node.id}: 선택지 2개 미만`);
    for (const c of node.choices) {
      if (!terminals.has(c.to) && !ids.has(c.to as string)) {
        problems.push(`${node.id} → '${c.to}' (존재하지 않는 노드)`);
      }
    }
  }
  // 2) 시작 노드에서 도달 가능한 노드 집합(고립 노드 탐지)
  const reachable = new Set<string>();
  const stack = [FLOW_V1_START];
  while (stack.length) {
    const cur = stack.pop()!;
    if (reachable.has(cur)) continue;
    reachable.add(cur);
    const node = flow[cur];
    if (!node) continue;
    for (const c of node.choices) {
      if (!terminals.has(c.to) && ids.has(c.to as string)) stack.push(c.to as string);
    }
  }
  for (const id of ids) if (!reachable.has(id)) problems.push(`${id}: 시작에서 도달 불가(고아)`);
  return problems;
}

// ── 정적 카피 린트 (Phase E) — 버튼 카피는 AI 출력가드 밖이므로 카피 자체가 합법이어야 ───────
// 절대표현(표시광고법) + 수익·부업·모집(다단계 오인) 금지. 위반 목록 반환(빈 배열=정상).
const BANNED_COPY =
  /(최저가|무조건|업계\s*최고|유일무이|평생\s*보장|전액\s*보장|완벽\s*보장|100\s*%\s*(?:보장|환불|성공|만족|책임)|반드시\s*(?:성공|수익)|수익\s*보장|부업|돈\s*벌|투자\s*수익|파트너\s*모집|월\s*\d+\s*만\s*원\s*수익)/;

export function validateFlowCopy(flow: Record<string, FlowNode> = FLOW_V1): string[] {
  const hits: string[] = [];
  for (const node of Object.values(flow)) {
    const text = `${node.title} ${node.body} ${node.choices.map((c) => c.label).join(" ")}`;
    const m = text.match(BANNED_COPY);
    if (m) hits.push(`${node.id}: 금지표현 '${m[0]}'`);
  }
  return hits;
}
