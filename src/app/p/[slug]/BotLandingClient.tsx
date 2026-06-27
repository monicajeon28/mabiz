"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { FLOW_V1, FLOW_V1_START, type FlowNode } from "@/lib/bot-flow";

interface Msg {
  role: "user" | "bot";
  text: string;
  /** 봇 응답에 함께 온 인라인 설득 이미지(크루즈 상담봇). 손님 화면에 사진으로 표시. */
  images?: { url: string; label?: string }[];
}

/**
 * 화면 단계(phase) — '가벼운 리드캡처 봇 플로우'.
 *  gate    : 가치 먼저(훅+신뢰+큰 버튼 1개). 버튼 누르면 성함·연락처 2칸 펼침.
 *  choice  : 리드 확정 후 두 갈래(전화로 상담받기 / 지금 바로 물어보기).
 *  chat    : 기존 채팅(send/이미지/handoff).
 *  endcta  : 종료(카톡에서 후기 보기 / 상품 구경하기).
 */
type Phase = "guide" | "gate" | "choice" | "chat" | "endcta";

// 버튼 A/B 플로우는 src/lib/bot-flow.ts FLOW_V1(서버 상수)에서 정의(콜 9대 반론·heat·컴플라이언스 카피).

interface Props {
  pageId: string;
  refCode?: string;
  brandTitle: string;
  greeting?: string;
  chips?: string[];
  /** 봇 종류(코드값). 화면엔 한글 표시명만 노출. */
  botType?: "cruise" | "recruit";
  /** "상품 구경하기" 버튼이 여는 어필리에이트 링크. 없으면 크루즈닷 메인. */
  homepageUrl?: string;
  /** "카톡에서 후기·소식 보기" 버튼이 여는 카톡 채널 링크. 없으면 회사 공용 채널 폴백(page.tsx에서 처리). */
  kakaoChannelUrl?: string;
  /** 시작 게이트 훅 문구(가치 한 줄). 없으면 봇 종류별 기본 문구. */
  hookText?: string;
  /** 후킹용 대표 상품(실데이터). 가이드 차별화 카드에 실제 가격·출발일·잔여 표시. 없으면 미표시. */
  featured?: {
    title: string;
    priceFrom: number;
    departOn: string | null;
    nights: number;
    days: number;
    availableSeats: number | null;
  };
  /** 라이브방송 후킹 — 접수 직후 노출할 링크·문구. 없으면 미표시. '30%' 등 표현은 운영자 단일 책임(문구). */
  live?: { url: string; label: string };
}

/** 출발일 ISO → "M월 D일" (50대 가독). 잘못된 값이면 빈 문자열. */
function formatDepart(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** 출발 D-day(긴박감, L6 손실회피) — 미래면 " · D-N", 아니면 빈 문자열. */
function ddayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  return diff > 0 ? ` · D-${diff}` : "";
}

const DEFAULT_HOMEPAGE_URL = "https://cruisedot.co.kr";

const CRUISE_GREETING =
  "안녕하세요! 크루즈 여행 상담을 도와드릴게요. 무엇이든 편하게 물어보세요 😊";
const CRUISE_CHIPS = ["가격이 궁금해요", "어디로 가나요?", "상담받고 싶어요"];
const RECRUIT_GREETING =
  "안녕하세요! 부업·창업으로 크루즈 판매 파트너를 알아보고 계신가요? 무엇이든 편하게 물어보세요 😊";
const RECRUIT_CHIPS = ["수익이 어떻게 나나요?", "초보도 할 수 있나요?", "비용이 궁금해요"];

// 시작 게이트 기본 훅 문구(봇 종류별). 크루즈만 가벼운 희소성, 모집봇은 비압박(법적).
const CRUISE_HOOK = "🚢 한국어 안내로 편하게 떠나는 크루즈 여행, 지금 자리부터 확인해 보세요";
const RECRUIT_HOOK = "🎓 부업·창업, 솔직하게 물어보고 천천히 결정하셔도 돼요";

export default function BotLandingClient({
  pageId,
  refCode,
  brandTitle,
  greeting,
  chips,
  botType = "cruise",
  homepageUrl,
  kakaoChannelUrl,
  hookText,
  featured,
  live,
}: Props) {
  const isRecruit = botType === "recruit";
  const defaultGreeting = isRecruit ? RECRUIT_GREETING : CRUISE_GREETING;
  const defaultChips = isRecruit ? RECRUIT_CHIPS : CRUISE_CHIPS;

  // 단계 — 크루즈봇은 버튼 가이드(PASONA 4장)부터, 모집봇은 기존대로 게이트부터(무영향).
  const [phase, setPhase] = useState<Phase>(botType === "recruit" ? "gate" : "guide");
  // 버튼 A/B 플로우(FLOW_V1) — 현재 노드 + 클릭 경로(신청 시 서버가 heat 재계산)
  const [nodeId, setNodeId] = useState<string>(FLOW_V1_START);
  const [flowPath, setFlowPath] = useState<{ nodeId: string; choiceIndex: number }[]>([]);

  const [messages, setMessages] = useState<Msg[]>([
    { role: "bot", text: greeting || defaultGreeting },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const convoRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // 페이지 진입 시각 — register의 시간 방어(1.5초 미만 차단) 통과용
  const loadedAtRef = useRef<number>(Date.now());

  // 리드캡처(게이트) 상태
  const [showLeadForm, setShowLeadForm] = useState(false); // 게이트에서 큰 버튼 누르면 입력칸 펼침
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [leadError, setLeadError] = useState("");
  const [applied, setApplied] = useState(false); // register 성공(리드 확정) 여부
  // 동의(정보통신망법·개인정보보호법) — 기본 체크(자동동의). 손님이 해제해도 신청은 막지 않되,
  //   해제 상태를 그대로 기록해서 광고성 카톡/문자는 '거부한 분께는 발송 안 함'(거부 존중 = 합법).
  const [agreePrivacy, setAgreePrivacy] = useState(true);
  const [agreeAd, setAgreeAd] = useState(true);

  const showChips = phase === "chat" && messages.length === 1 && !loading;
  const chipList = chips && chips.length > 0 ? chips : defaultChips;

  // 크루즈봇: 어필리에이트 링크 없으면 크루즈닷 메인 폴백.
  // 모집봇: 어필리에이트 폴백 없음(상품 판매 아님) — 교육·모집 안내 링크가 없으면 버튼 자체를 숨김.
  const homeLink = isRecruit ? homepageUrl || "" : homepageUrl || DEFAULT_HOMEPAGE_URL;
  const gateHook = hookText || (isRecruit ? RECRUIT_HOOK : CRUISE_HOOK);

  // 버튼 A/B 플로우: 선택 → 다음 노드 / 게이트(신청) / 채팅(AI 비상구). 경로 누적(서버 heat용).
  const flowNode: FlowNode | null = phase === "guide" ? FLOW_V1[nodeId] ?? null : null;
  const onFlowChoice = (choiceIndex: number) => {
    const node = FLOW_V1[nodeId];
    const choice = node?.choices[choiceIndex];
    if (!choice) return;
    setFlowPath((p) => [...p, { nodeId, choiceIndex }]);
    if (choice.to === "lead") {
      setLeadError("");
      setShowLeadForm(true);
      setPhase("gate");
    } else if (choice.to === "chat") {
      setPhase("chat");
    } else {
      setNodeId(choice.to);
    }
  };
  const onFlowBack = () => {
    setFlowPath((p) => {
      if (p.length === 0) return p;
      setNodeId(p[p.length - 1].nodeId);
      return p.slice(0, -1);
    });
  };

  // 라이브방송 후킹 카드 — 접수 직후(choice/endcta)에만. 손님이 직접 누르는 오픈카톡 링크(자동발송 아님).
  const liveCard = live ? (
    <a
      href={live.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-[56px] flex-col items-center justify-center rounded-2xl bg-[#FEE500] px-5 py-3 text-center shadow-sm transition active:scale-[0.99]"
    >
      <span className="text-base font-bold text-[#191600]">🎁 {live.label}</span>
      <span className="mt-0.5 text-sm font-medium text-[#3C1E1E]/80">
        📺 라이브방송 보러가기 → 카톡이 열려요
      </span>
    </a>
  ) : null;

  // 게이트 리드 제출 → 기존 register API(그룹배정·퍼널·판매원 귀속) 재사용
  const submitLead = useCallback(async () => {
    setLeadError("");
    const name = leadName.trim();
    const phone = leadPhone.trim();
    if (!name) {
      setLeadError("성함을 입력해 주세요.");
      return;
    }
    if (!phone) {
      setLeadError("연락처를 입력해 주세요.");
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      const r = await fetch(`/api/landing-pages/${pageId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          loadedAt: loadedAtRef.current,
          metadata: {
            flow: "bot-gate",
            ref: refCode ?? null,
            // 동의 기록(정보통신망법) — 광고성 카톡/문자 발송 가부 판단 근거. ad=false면 광고 발송 금지.
            consent: { privacy: agreePrivacy, ad: agreeAd },
          },
        }),
      });
      const data = await r.json();
      if (data?.ok) {
        setApplied(true);
        setPhase("choice");
      } else {
        setLeadError(data?.message || "신청에 실패했어요. 잠시 후 다시 시도해 주세요.");
      }
    } catch {
      setLeadError("연결이 잠시 불안정해요. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }, [leadName, leadPhone, agreePrivacy, agreeAd, submitting, pageId, refCode]);

  useEffect(() => {
    if (phase !== "chat") return;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading, phase]);

  const send = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t || loading) return;
      setInput("");
      setMessages((m) => [...m, { role: "user", text: t }]);
      setLoading(true);
      try {
        const r = await fetch("/api/bot/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: convoRef.current,
            message: t,
            landingPageId: pageId,
            ref: refCode ?? null,
          }),
        });
        const data = await r.json();
        if (data?.ok) {
          convoRef.current = data.conversationId;
          const images = Array.isArray(data.images)
            ? (data.images as { url: string; label?: string }[])
            : undefined;
          setMessages((m) => [...m, { role: "bot", text: data.reply, images }]);
          if (data.handoff) setHandoff(true);
        } else {
          setMessages((m) => [
            ...m,
            { role: "bot", text: data?.message || "잠시 후 다시 시도해주세요." },
          ]);
        }
      } catch {
        setMessages((m) => [
          ...m,
          { role: "bot", text: "연결이 잠시 불안정해요. 다시 한번 보내주세요." },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, pageId, refCode],
  );

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-50">
      {/* 헤더 */}
      <header className="bg-[#1E2D4E] px-4 py-4 text-white shadow">
        <h1 className="text-lg font-bold">{brandTitle}</h1>
        <p className="mt-0.5 text-sm text-slate-200">
          {isRecruit ? "교육생 모집봇" : "크루즈 상담봇"} · 편하게 물어보세요
        </p>
      </header>

      {/* ── 0단계: 버튼 A/B 플로우 (사장님 스토리보드 · 콜 9대 반론 · AI 호출 0회) ── */}
      {phase === "guide" && flowNode && (
        <div className="flex flex-1 flex-col px-5 py-6">
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
            {/* 진행점 — 경로 깊이로 표시(그래프라 고정 길이 없음) */}
            <div className="mb-4 flex items-center justify-center gap-2">
              {Array.from({ length: Math.min(flowPath.length + 1, 6) }).map((_, i) => (
                <span
                  key={i}
                  className={`h-2.5 rounded-full transition-all ${
                    i === flowPath.length ? "w-6 bg-[#2563EB]" : "w-2.5 bg-slate-300"
                  }`}
                />
              ))}
            </div>
            <h2 className="text-xl font-bold leading-relaxed text-[#1E2D4E]">
              {flowNode.title}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-slate-600">{flowNode.body}</p>
            {/* 실데이터 후킹 — 오퍼 화면(price)에 실제 대표 상품 가격·출발일(지어내지 않음) */}
            {nodeId === "price" && featured && (
              <div className="mt-4 rounded-2xl border border-[#2563EB]/30 bg-[#EBF4FF] px-4 py-3">
                <p className="text-sm font-semibold text-[#2563EB]">지금 이런 일정이 있어요</p>
                <p className="mt-1 text-base font-bold leading-snug text-[#1E2D4E]">
                  {featured.title}
                </p>
                <p className="mt-1 text-base text-slate-700">
                  {featured.nights}박 {featured.days}일 ·{" "}
                  {featured.priceFrom.toLocaleString("ko-KR")}원부터
                </p>
                {/* 긴박감(출발 D-day)·희소성(잔여) — 실데이터 기반 L6 손실회피 */}
                {(featured.departOn ||
                  (featured.availableSeats !== null && featured.availableSeats > 0)) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {featured.departOn && (
                      <span className="rounded-full bg-[#FADBD8] px-2.5 py-1 text-sm font-semibold text-[#C0392B]">
                        🗓 {formatDepart(featured.departOn)} 출발{ddayLabel(featured.departOn)}
                      </span>
                    )}
                    {featured.availableSeats !== null &&
                      featured.availableSeats > 0 &&
                      featured.availableSeats <= 20 && (
                        <span className="rounded-full bg-[#FFF3CD] px-2.5 py-1 text-sm font-semibold text-[#B8860B]">
                          🔥 잔여 {featured.availableSeats}석
                        </span>
                      )}
                  </div>
                )}
                <p className="mt-1.5 text-xs text-slate-500">
                  정확한 가격·잔여 좌석은 담당 전문가가 확인해 드려요
                </p>
              </div>
            )}
            {/* 설득 사진 (사장님 스토리보드 — /public/bot) */}
            {flowNode.image && (
              <div className="mt-4">
                <img
                  src={flowNode.image}
                  alt={flowNode.title}
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                  style={{ minHeight: 180 }}
                  className="w-full rounded-2xl border border-slate-200 object-contain shadow-sm"
                />
              </div>
            )}
            {/* 버튼 — 첫 선택지=강조(초록), 나머지=보조(테두리). 50대: 48px+ · 16px+ · 동등 크기 */}
            <div className="mt-auto space-y-3 pt-6">
              {flowNode.choices.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onFlowChoice(i)}
                  className={
                    i === 0
                      ? "flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-[#27AE60] px-5 text-lg font-bold text-white shadow-sm transition active:scale-[0.99]"
                      : "flex min-h-[52px] w-full items-center justify-center rounded-2xl border-2 border-[#1E2D4E] px-5 text-base font-bold text-[#1E2D4E] transition active:scale-[0.99]"
                  }
                >
                  {c.label}
                </button>
              ))}
              {/* 이전 — 첫 화면이 아닐 때만 */}
              {flowPath.length > 0 && (
                <button
                  type="button"
                  onClick={onFlowBack}
                  className="flex min-h-[48px] w-full items-center justify-center rounded-2xl border border-slate-300 px-5 text-base font-medium text-slate-600 transition active:scale-[0.99]"
                >
                  ← 이전
                </button>
              )}
              {/* 작게 — 그냥 둘러보기(AI 채팅 비상구) */}
              <button
                type="button"
                onClick={() => setPhase("chat")}
                className="w-full text-center text-sm text-slate-400 underline underline-offset-4"
              >
                그냥 둘러볼게요
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 1단계: 시작 게이트 (가치 먼저, 입력 나중) ── */}
      {phase === "gate" && (
        <div className="flex flex-1 flex-col justify-center px-5 py-8">
          <div className="mx-auto w-full max-w-md">
            {/* 훅 문구(가치 한 줄) */}
            <p className="text-xl font-bold leading-relaxed text-[#1E2D4E]">{gateHook}</p>
            {/* 신뢰 한 줄 — 왜 안전한지 */}
            <p className="mt-3 text-base leading-relaxed text-slate-600">
              담당 전문가가 직접 연락드려요. 광고·스팸 문자는 보내지 않아요.
            </p>

            {!showLeadForm ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setLeadError("");
                    setShowLeadForm(true);
                  }}
                  className="mt-6 flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-[#27AE60] px-5 text-lg font-bold text-white shadow-sm transition active:scale-[0.99]"
                >
                  상담 받기
                </button>
                {/* 도피로 — 입력 없이 먼저 둘러보기(이탈자 회수) */}
                <button
                  type="button"
                  onClick={() => setPhase("chat")}
                  className="mt-4 w-full text-center text-sm text-slate-400 underline underline-offset-4"
                >
                  먼저 둘러볼게요
                </button>
              </>
            ) : (
              <div className="mt-6 rounded-2xl border-2 border-[#2563EB] bg-white px-4 py-4 shadow-sm">
                <p className="text-base font-bold text-[#1E2D4E]">상담 받기</p>
                <p className="mt-1 text-sm text-slate-500">
                  성함과 연락처를 남겨주시면 담당자가 곧 연락드려요.
                </p>
                <div className="mt-3 space-y-2">
                  <input
                    type="text"
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value)}
                    placeholder="성함 (예: 홍길동)"
                    aria-label="성함"
                    className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base text-slate-900 outline-none focus:border-[#2563EB]"
                  />
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={leadPhone}
                    onChange={(e) => setLeadPhone(e.target.value)}
                    placeholder="연락처 (예: 010-1234-5678)"
                    aria-label="연락처"
                    className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base text-slate-900 outline-none focus:border-[#2563EB]"
                  />
                </div>
                {/* 동의 — 기본 체크(자동), 해제해도 신청 가능. 광고수신은 해제 시 광고 발송 안 함. */}
                <div className="mt-3 space-y-2">
                  <label className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={agreePrivacy}
                      onChange={(e) => setAgreePrivacy(e.target.checked)}
                      aria-label="개인정보 수집·이용 동의"
                      className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 accent-[#2563EB]"
                    />
                    <span className="text-sm leading-relaxed text-slate-600">
                      상담을 위한 개인정보(성함·연락처) 수집·이용에 동의합니다.
                    </span>
                  </label>
                  <label className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={agreeAd}
                      onChange={(e) => setAgreeAd(e.target.checked)}
                      aria-label="카톡·문자 소식 받기 동의(선택)"
                      className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 accent-[#2563EB]"
                    />
                    <span className="text-sm leading-relaxed text-slate-600">
                      카톡·문자로 여행 소식·혜택 받기에 동의합니다.{" "}
                      <span className="text-slate-400">(선택 · 언제든 수신거부 가능)</span>
                    </span>
                  </label>
                </div>
                {leadError && <p className="mt-2 text-sm text-red-600">{leadError}</p>}
                <button
                  type="button"
                  onClick={submitLead}
                  disabled={submitting}
                  className="mt-3 h-12 w-full rounded-xl bg-[#2563EB] text-base font-bold text-white transition active:scale-95 disabled:opacity-50"
                >
                  {submitting ? "신청 중…" : "신청하기"}
                </button>
                <button
                  type="button"
                  onClick={() => setPhase("chat")}
                  className="mt-3 w-full text-center text-sm text-slate-400 underline underline-offset-4"
                >
                  먼저 둘러볼게요
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 2단계: 두 갈래 선택 (리드 확정 후) ── */}
      {phase === "choice" && (
        <div className="flex flex-1 flex-col justify-center px-5 py-8">
          <div className="mx-auto w-full max-w-md">
            {/* 즉시 피드백 — 접수 확인 */}
            <div
              role="status"
              aria-live="polite"
              className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-4 text-base leading-relaxed text-emerald-900"
            >
              ✅ 접수됐어요! 담당자가 곧 연락드릴게요 😊
            </div>
            {/* 접수 직후 보상 — 라이브방송 후킹(링크만 들고 이탈 방지 위해 여기서 처음 노출) */}
            {liveCard && <div className="mt-4">{liveCard}</div>}
            <div className="mt-5 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setPhase("endcta")}
                className="flex min-h-[52px] items-center justify-center rounded-2xl bg-[#27AE60] px-5 text-base font-bold text-white shadow-sm transition active:scale-[0.99]"
              >
                📞 전화로 상담받기
              </button>
              <p className="-mt-1 text-center text-sm text-slate-500">
                담당자가 곧 연락드려요
              </p>
              <button
                type="button"
                onClick={() => setPhase("chat")}
                className="flex min-h-[52px] items-center justify-center rounded-2xl border-2 border-[#2563EB] px-5 text-base font-bold text-[#2563EB] transition active:scale-[0.99]"
              >
                💬 지금 바로 물어보기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 3단계: 채팅 ── */}
      {phase === "chat" && (
        <>
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto px-4 py-5"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {messages.map((m, i) =>
              m.role === "bot" ? (
                <div key={i} className="flex flex-col items-start gap-2">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-base leading-relaxed text-slate-800 shadow-sm">
                    {m.text}
                  </div>
                  {m.images && m.images.length > 0 && (
                    <div className="flex max-w-[85%] flex-col gap-2">
                      {m.images.map((img, j) => (
                        <img
                          key={j}
                          src={img.url}
                          alt={img.label || "안내 사진"}
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                          style={{ aspectRatio: "4 / 3", minHeight: 160 }}
                          className="w-full max-w-full rounded-2xl border border-slate-200 object-cover shadow-sm"
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-[#2563EB] px-4 py-3 text-base leading-relaxed text-white shadow-sm">
                    {m.text}
                  </div>
                </div>
              ),
            )}

            {loading && (
              <div className="flex justify-start" role="status" aria-live="polite">
                <div className="rounded-2xl rounded-tl-sm bg-white px-4 py-3 shadow-sm">
                  <span className="inline-flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                  </span>
                  <span className="ml-2 align-middle text-sm text-slate-500">작성 중…</span>
                </div>
              </div>
            )}

            {handoff && (
              <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-base text-emerald-900">
                🙋 담당 전문가가 곧 연락드릴게요. 성함과 연락 가능한 시간을 남겨주시면 더 빠르게 도와드려요.
              </div>
            )}

            {/* 대화가 오갔거나 handoff면 종료로 넘어가는 안내 버튼 */}
            {!loading &&
              (handoff || messages.filter((m) => m.role === "user").length >= 1) && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setPhase("endcta")}
                    className="flex min-h-[48px] w-full items-center justify-center rounded-2xl border-2 border-[#1E2D4E] px-5 text-base font-bold text-[#1E2D4E] transition active:scale-[0.99]"
                  >
                    상담 마치고 둘러보기
                  </button>
                </div>
              )}

            {/* 첫 화면 선택칩 */}
            {showChips && (
              <div className="flex flex-wrap gap-2 pt-1">
                {chipList.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => send(c)}
                    className="min-h-[48px] rounded-full border-2 border-[#1E2D4E] bg-white px-5 text-base font-medium text-[#1E2D4E] transition active:scale-95"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 입력 영역 */}
          <div className="sticky bottom-0 flex items-end gap-2 border-t border-slate-200 bg-white px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="궁금한 점을 입력하세요"
              aria-label="메시지 입력"
              className="h-12 flex-1 rounded-full border border-slate-300 px-4 text-base text-slate-900 outline-none focus:border-[#2563EB]"
            />
            <button
              type="button"
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              className="h-12 min-w-[64px] rounded-full bg-[#2563EB] px-5 text-base font-bold text-white transition active:scale-95 disabled:opacity-40"
            >
              보내기
            </button>
          </div>
        </>
      )}

      {/* ── 4단계: 종료 (카톡에서 후기 보기 / 상품 구경하기) ── */}
      {phase === "endcta" && (
        <div className="flex flex-1 flex-col justify-center px-5 py-8">
          <div className="mx-auto w-full max-w-md">
            {applied && (
              <div
                role="status"
                aria-live="polite"
                className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-4 text-base leading-relaxed text-emerald-900"
              >
                ✅ 신청이 접수됐어요. 담당자가 곧 연락드릴게요. 감사합니다 😊
              </div>
            )}
            {/* 접수한 분께만 라이브방송 후킹(링크만 들고 이탈 방지) */}
            {applied && liveCard && <div className="mt-4">{liveCard}</div>}
            <p className="mt-5 text-base font-bold text-[#1E2D4E]">떠나기 전에, 이것도 보세요</p>
            <div className="mt-3 flex flex-col gap-3">
              {kakaoChannelUrl && (
                <a
                  href={kakaoChannelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[52px] flex-col items-center justify-center rounded-2xl bg-[#FEE500] px-5 py-2 text-base font-bold text-[#191600] shadow-sm transition active:scale-[0.99]"
                >
                  <span>📺 카톡에서 후기·소식 보기</span>
                  <span className="text-xs font-medium text-[#3C1E1E]/70">→ 카톡이 열려요</span>
                </a>
              )}
              {/* 크루즈봇: 항상 상품 구경(폴백 크루즈닷). 모집봇: 교육·모집 안내 링크가 있을 때만 표시(어필리에이트 폴백 없음). */}
              {homeLink && (
                <a
                  href={homeLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[52px] flex-col items-center justify-center rounded-2xl border-2 border-[#1E2D4E] px-5 py-2 text-base font-bold text-[#1E2D4E] transition active:scale-[0.99]"
                >
                  <span>{isRecruit ? "📚 교육·모집 안내 보기" : "🚢 상품 구경하기"}</span>
                  <span className="text-xs font-medium text-slate-500">
                    {isRecruit ? "→ 새 창에서 안내를 봐요" : "→ 새 창에서 상품을 봐요"}
                  </span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
