import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId, canManageSettings } from "@/lib/rbac";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/landing-pages/[id]/comments/seed — 샘플 문의(커뮤니티 Q&A) 자동 생성 (최대 10개)
 *   권한: 관리자(GLOBAL_ADMIN)·지사(OWNER) 전용 + 조직격리.
 *   생성방식: 외부 의존 0 — 큐레이션된 자연 Q&A 풀에서 랜덤 추출(LLM 미사용).
 *     · 별도 endpoint(/comments/generate)는 Anthropic 기반이나 API키 의존 + 가공 후기(허위후기) 리스크가 있어,
 *       이 seed는 "친절·사실 위주" FAQ만 사용(수익보장·허위후기·특정효능 표현 없음 = 표시광고법 안전).
 *     · 질문=방문자, 답글=운영자/방문자 혼합(authorRole 'operator'|'visitor') → 유튜브 댓글 같은 자연스러운 대화.
 *   멱등성: 한 페이지의 "자동생성 질문(최상위)" 총량을 10개로 상한 → 버튼 다발 클릭해도 무한 누적 안 됨.
 *     (이미 10개면 추가 생성 0 — 안전 스킵)
 */

// 큐레이션된 크루즈 여행 Q&A 풀 — 질문(방문자) + 답변(운영자 사실안내 / 방문자 공감).
// 광고법: 수익보장·허위후기·특정효능 금지. 운영자 답변은 사실 안내, 방문자 답글은 공감·궁금증 위주.
type SeedAnswer = { role: "operator" | "visitor"; text: string };
type SeedQA = { q: string; answers: SeedAnswer[] };

const QA_POOL: SeedQA[] = [
  {
    q: "50대 부부도 무리 없이 다녀올 수 있을까요?",
    answers: [
      { role: "operator", text: "네, 50~60대 부부 손님이 가장 많은 편이세요. 일정이 여유롭게 구성되어 있어 천천히 즐기시기 좋습니다. 궁금한 점은 편하게 문의 주세요." },
      { role: "visitor", text: "저도 같은 게 궁금했어요. 답변 감사합니다!" },
    ],
  },
  {
    q: "멀미가 걱정되는데 배가 많이 흔들리나요?",
    answers: [
      { role: "operator", text: "대형 크루즈선은 흔들림이 크지 않은 편입니다. 멀미가 걱정되시면 객실 위치와 준비물도 함께 안내해 드릴게요." },
      { role: "visitor", text: "저도 멀미를 잘하는 편이라 이 부분이 제일 궁금했네요." },
    ],
  },
  {
    q: "영어를 못해도 여행하는 데 괜찮을까요?",
    answers: [
      { role: "operator", text: "한국어 안내가 함께 진행되어 영어를 못하셔도 불편함 없이 다니실 수 있습니다." },
      { role: "visitor", text: "이게 제일 걱정이었는데 다행이네요." },
    ],
  },
  {
    q: "방(객실) 종류는 어떻게 다른가요?",
    answers: [
      { role: "operator", text: "객실은 크게 내측·외측·발코니·스위트로 나뉘고, 전망과 크기에 따라 가격이 달라집니다. 예산에 맞춰 안내해 드릴게요." },
      { role: "visitor", text: "발코니랑 외측이 어떻게 다른지 저도 궁금했어요." },
    ],
  },
  {
    q: "혼자 가도 어색하지 않은 분위기인가요?",
    answers: [
      { role: "operator", text: "혼자 오시는 분들도 많으세요. 동행 일정이 있어 자연스럽게 어울리실 수 있습니다." },
      { role: "visitor", text: "혼자라 망설였는데 용기가 나네요." },
    ],
  },
  {
    q: "식사는 포함되어 있나요? 입맛에 맞을지 걱정돼요.",
    answers: [
      { role: "operator", text: "선내 기본 식사는 일정에 포함되어 있고, 한식 메뉴도 마련되어 있어 입맛 걱정은 덜으셔도 됩니다." },
      { role: "visitor", text: "한식이 있다니 부모님 모시고 가기 좋겠네요." },
    ],
  },
  {
    q: "짐은 얼마나 챙겨야 할까요?",
    answers: [
      { role: "operator", text: "일정과 계절에 맞춘 짐 준비 안내문을 따로 보내드립니다. 무겁지 않게 준비하시도록 도와드릴게요." },
      { role: "visitor", text: "짐 싸는 게 늘 고민이었는데 안내문이 있으면 편하겠어요." },
    ],
  },
  {
    q: "예약하려면 어떻게 시작하면 되나요?",
    answers: [
      { role: "operator", text: "성함과 연락처만 남겨주시면 일정·객실·금액을 차근차근 안내해 드립니다. 부담 없이 문의 주세요." },
      { role: "visitor", text: "문의부터 한번 해봐야겠어요." },
    ],
  },
  {
    q: "체력이 아주 좋은 편은 아닌데 일정이 빡빡한가요?",
    answers: [
      { role: "operator", text: "일정은 여유롭게 짜여 있어 무리하지 않으셔도 됩니다. 신경 쓰이는 부분을 미리 알려주시면 맞춰 안내해 드릴게요." },
      { role: "visitor", text: "체력이 약한 편이라 이 부분이 궁금했어요." },
    ],
  },
  {
    q: "비용은 보통 어느 정도 생각하면 될까요?",
    answers: [
      { role: "operator", text: "일정·객실·출발 시기에 따라 차이가 있어, 원하시는 조건을 알려주시면 정확한 금액을 안내해 드립니다." },
      { role: "visitor", text: "대략이라도 알 수 있어서 좋네요." },
    ],
  },
  {
    q: "출발 전에 준비해야 할 서류가 있나요?",
    answers: [
      { role: "operator", text: "여권은 꼭 필요하고, 일정에 따라 추가 서류가 있을 수 있습니다. 필요한 서류는 체크리스트로 미리 안내해 드려요." },
      { role: "visitor", text: "여권 유효기간부터 확인해야겠네요." },
    ],
  },
  {
    q: "일행과 함께 가는데 객실 배치가 가까이 될까요?",
    answers: [
      { role: "operator", text: "동반 예약 시 가능한 한 가까운 객실로 배치해 드립니다. 인원과 희망 사항을 알려주세요." },
      { role: "visitor", text: "친구들이랑 가려고 했는데 잘됐네요." },
    ],
  },
  {
    q: "취소하거나 일정을 바꿔야 하면 어떻게 되나요?",
    answers: [
      { role: "operator", text: "변경·취소 규정은 출발일과 시기에 따라 달라집니다. 예약 전에 자세히 안내해 드리니 확인 후 결정하셔도 됩니다." },
      { role: "visitor", text: "규정을 미리 알려주신다니 안심이네요." },
    ],
  },
  {
    q: "처음이라 뭐부터 알아봐야 할지 모르겠어요.",
    answers: [
      { role: "operator", text: "처음이신 분들이 대부분이세요. 일정·객실·금액 순서로 하나씩 안내해 드리니 천천히 정하시면 됩니다." },
      { role: "visitor", text: "저도 완전 처음이라 막막했는데 도움이 되네요." },
    ],
  },
  {
    q: "선내에서 와이파이나 연락은 가능한가요?",
    answers: [
      { role: "operator", text: "선내 와이파이 이용이 가능하며, 이용 방법은 탑승 후 안내해 드립니다." },
      { role: "visitor", text: "가족이랑 연락이 돼야 해서 궁금했어요." },
    ],
  },
  {
    q: "기항지에서는 자유롭게 다닐 수 있나요?",
    answers: [
      { role: "operator", text: "기항지에서는 자유 관광과 선택 관광 모두 가능합니다. 원하시는 스타일대로 안내해 드릴게요." },
      { role: "visitor", text: "자유롭게 다닐 수 있다니 좋네요." },
    ],
  },
];

// 방문자 닉네임 풀 — 캐주얼하게 다양하게. 운영자는 "운영자"로 통일(공개 렌더에서 운영자 뱃지 표시).
const VISITOR_NAMES = [
  "여행조아", "바다사랑", "부산댁", "제주맘", "은퇴부부", "꽃중년",
  "느긋한오후", "두번째인생", "여유로운날", "행복한하루", "솔솔바람",
  "단풍여행", "설레는맘", "바람따라", "조용한바다", "처음이지만",
  "김**", "이**", "박**", "최**",
];
const OPERATOR_NAME = "운영자";

const MAX_SEED_QUESTIONS = 10; // 페이지당 자동생성 질문 상한 (멱등성)

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
// Fisher–Yates 셔플 후 앞에서 n개
function sampleN<T>(arr: T[], n: number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.max(0, n));
}

export async function POST(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    // 권한: 관리자(GLOBAL_ADMIN)·지사(OWNER) 전용
    if (!canManageSettings(ctx)) {
      return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
    }
    const orgId = resolveOrgId(ctx);
    const { id } = await params;

    // 조직격리 — 내 조직 소속 페이지만
    const page = await prisma.crmLandingPage.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
      select: { id: true },
    });
    if (!page) return NextResponse.json({ ok: false, message: "페이지를 찾을 수 없습니다." }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const requested = Math.min(10, Math.max(1, parseInt(String(body.count ?? "5"), 10) || 5));

    // 작성 기간 — 생성 댓글의 createdAt을 이 범위에 랜덤 분산(오래전부터 쌓인 것처럼 자연스럽게).
    const nowMs = Date.now();
    const parseYmd = (s: unknown, fallback: number): number => {
      const t = Date.parse(String(s ?? ""));
      return Number.isNaN(t) ? fallback : t;
    };
    let fromMs = parseYmd(body.dateFrom, nowMs - 45 * 86_400_000); // 기본 45일 전
    let toMs = Math.min(parseYmd(body.dateTo, nowMs), nowMs);      // 미래 날짜 방지
    if (fromMs > toMs) fromMs = toMs;
    const randInRange = (loMs: number) =>
      new Date(loMs + Math.floor(Math.random() * Math.max(1, toMs - loMs + 1)));

    // ── 멱등성: 이미 쌓인 자동생성 질문(최상위) 수를 세어 총 10개로 상한 ──
    const existingQuestions = await prisma.crmLandingComment.count({
      where: { landingPageId: page.id, parentId: null, isAutoGenerated: true },
    });
    const remaining = Math.max(0, MAX_SEED_QUESTIONS - existingQuestions);
    const toCreate = Math.min(requested, remaining);

    if (toCreate <= 0) {
      return NextResponse.json({
        ok: true,
        seeded: 0,
        comments: [],
        message: `이미 샘플 문의가 충분히 있습니다(최대 ${MAX_SEED_QUESTIONS}개). 추가 생성하지 않았습니다.`,
      });
    }

    const chosen = sampleN(QA_POOL, toCreate);
    const usedVisitorNames = new Set<string>();
    const nextVisitorName = (): string => {
      // 가능하면 중복 닉네임 회피
      for (let i = 0; i < 8; i++) {
        const n = pickRandom(VISITOR_NAMES);
        if (!usedVisitorNames.has(n)) { usedVisitorNames.add(n); return n; }
      }
      return pickRandom(VISITOR_NAMES);
    };

    const created = await prisma.$transaction(async (tx) => {
      const out: Array<{ id: string; authorName: string; content: string; authorRole: string; createdAt: Date }> = [];
      for (const qa of chosen) {
        const qDate = randInRange(fromMs);
        const question = await tx.crmLandingComment.create({
          data: {
            landingPageId: page.id,
            authorName: nextVisitorName(),
            content: qa.q,
            isAutoGenerated: true,
            authorRole: "visitor",
            parentId: null,
            createdAt: qDate,
            likeCount: Math.floor(Math.random() * 13), // 0~12
          },
          select: { id: true, authorName: true, content: true, authorRole: true, createdAt: true },
        });
        out.push(question);

        // 답글 1~2개(운영자/방문자 혼합). 대화 흐름: 질문 → 운영자 안내(우선·뱃지) → 방문자 공감.
        const operatorAns = qa.answers.filter((a) => a.role === "operator");
        const visitorAns = qa.answers.filter((a) => a.role === "visitor");
        const wantTwo = Math.random() < 0.6; // 60%는 운영자+방문자 두 답글
        const replies: SeedAnswer[] = [];
        if (operatorAns.length) replies.push(pickRandom(operatorAns)); // 운영자 답변 우선 포함
        if ((wantTwo || replies.length === 0) && visitorAns.length) replies.push(pickRandom(visitorAns));
        for (const ans of replies) {
          const reply = await tx.crmLandingComment.create({
            data: {
              landingPageId: page.id,
              authorName: ans.role === "operator" ? OPERATOR_NAME : nextVisitorName(),
              content: ans.text,
              isAutoGenerated: true,
              authorRole: ans.role,
              parentId: question.id,
              createdAt: randInRange(qDate.getTime()), // 답글은 질문 이후~기간끝 사이
              likeCount: Math.floor(Math.random() * 9), // 0~8
            },
            select: { id: true, authorName: true, content: true, authorRole: true, createdAt: true },
          });
          out.push(reply);
        }
      }
      return out;
    });

    logger.log("[POST /api/landing-pages/[id]/comments/seed]", {
      landingPageId: id, questions: toCreate, total: created.length, orgId,
    });

    return NextResponse.json({
      ok: true,
      seeded: toCreate,
      comments: created,
      message: `샘플 문의 ${toCreate}개(답글 포함 ${created.length}개)를 생성했습니다.`,
    });
  } catch (err) {
    logger.error("[POST /api/landing-pages/[id]/comments/seed]", { err });
    return NextResponse.json({ ok: false, message: "생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}
