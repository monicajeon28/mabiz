"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Msg {
  role: "user" | "bot";
  text: string;
  /** 봇 응답에 함께 온 인라인 설득 이미지(크루즈 상담봇). 손님 화면에 사진으로 표시. */
  images?: { url: string; label?: string }[];
}

interface Props {
  pageId: string;
  refCode?: string;
  brandTitle: string;
  greeting?: string;
  chips?: string[];
  /** 봇 종류(코드값). 화면엔 한글 표시명만 노출. */
  botType?: "cruise" | "recruit";
  /** "홈페이지 보기" 버튼이 여는 어필리에이트 링크. 없으면 크루즈닷 메인. */
  homepageUrl?: string;
}

const DEFAULT_HOMEPAGE_URL = "https://cruisedot.co.kr";

const CRUISE_GREETING =
  "안녕하세요! 크루즈 여행 상담을 도와드릴게요. 무엇이든 편하게 물어보세요 😊";
const CRUISE_CHIPS = ["가격이 궁금해요", "어디로 가나요?", "상담받고 싶어요"];
const RECRUIT_GREETING =
  "안녕하세요! 부업·창업으로 크루즈 판매 파트너를 알아보고 계신가요? 무엇이든 편하게 물어보세요 😊";
const RECRUIT_CHIPS = ["수익이 어떻게 나나요?", "초보도 할 수 있나요?", "비용이 궁금해요"];

export default function BotLandingClient({
  pageId,
  refCode,
  brandTitle,
  greeting,
  chips,
  botType = "cruise",
  homepageUrl,
}: Props) {
  const isRecruit = botType === "recruit";
  const defaultGreeting = isRecruit ? RECRUIT_GREETING : CRUISE_GREETING;
  const defaultChips = isRecruit ? RECRUIT_CHIPS : CRUISE_CHIPS;
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

  // 종료 CTA 신청 폼 상태
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [applyName, setApplyName] = useState("");
  const [applyPhone, setApplyPhone] = useState("");
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [applyError, setApplyError] = useState("");

  const showChips = messages.length === 1 && !loading;
  const chipList = chips && chips.length > 0 ? chips : defaultChips;

  // 대화가 어느 정도 오갔거나(손님 발화 1회+) handoff면 종료 CTA 노출
  const userTurns = messages.filter((m) => m.role === "user").length;
  const showEndCta = handoff || userTurns >= 1;

  const homeLink = homepageUrl || DEFAULT_HOMEPAGE_URL;

  const submitApply = useCallback(async () => {
    setApplyError("");
    const name = applyName.trim();
    const phone = applyPhone.trim();
    if (!name) {
      setApplyError("성함을 입력해 주세요.");
      return;
    }
    if (!phone) {
      setApplyError("연락처를 입력해 주세요.");
      return;
    }
    if (applying) return;
    setApplying(true);
    try {
      const r = await fetch(`/api/landing-pages/${pageId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          loadedAt: loadedAtRef.current,
        }),
      });
      const data = await r.json();
      if (data?.ok) {
        setApplied(true);
        setShowApplyForm(false);
      } else {
        setApplyError(data?.message || "신청에 실패했어요. 잠시 후 다시 시도해 주세요.");
      }
    } catch {
      setApplyError("연결이 잠시 불안정해요. 다시 시도해 주세요.");
    } finally {
      setApplying(false);
    }
  }, [applyName, applyPhone, applying, pageId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

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

      {/* 대화 영역 */}
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
                      className="w-full max-w-full rounded-2xl border border-slate-200 shadow-sm"
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
          <div className="flex justify-start">
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

        {/* 종료 CTA — 상담 신청하기 / 홈페이지 보기 */}
        {showEndCta && !loading && (
          <div className="pt-2">
            {applied ? (
              <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-4 text-base leading-relaxed text-emerald-900">
                ✅ 신청이 접수됐어요. 담당자가 곧 연락드릴게요. 감사합니다 😊
              </div>
            ) : showApplyForm ? (
              <div className="rounded-2xl border-2 border-[#2563EB] bg-white px-4 py-4 shadow-sm">
                <p className="text-base font-bold text-[#1E2D4E]">상담 신청하기</p>
                <p className="mt-1 text-sm text-slate-500">
                  성함과 연락처를 남겨주시면 담당자가 곧 연락드려요.
                </p>
                <div className="mt-3 space-y-2">
                  <input
                    type="text"
                    value={applyName}
                    onChange={(e) => setApplyName(e.target.value)}
                    placeholder="성함 (예: 홍길동)"
                    aria-label="성함"
                    className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base text-slate-900 outline-none focus:border-[#2563EB]"
                  />
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={applyPhone}
                    onChange={(e) => setApplyPhone(e.target.value)}
                    placeholder="연락처 (예: 010-1234-5678)"
                    aria-label="연락처"
                    className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base text-slate-900 outline-none focus:border-[#2563EB]"
                  />
                </div>
                {applyError && (
                  <p className="mt-2 text-sm text-red-600">{applyError}</p>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={submitApply}
                    disabled={applying}
                    className="h-12 flex-1 rounded-xl bg-[#2563EB] text-base font-bold text-white transition active:scale-95 disabled:opacity-50"
                  >
                    {applying ? "신청 중…" : "신청하기"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowApplyForm(false)}
                    disabled={applying}
                    className="h-12 min-w-[80px] rounded-xl border-2 border-slate-300 text-base font-medium text-slate-600 transition active:scale-95"
                  >
                    닫기
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setApplyError("");
                    setShowApplyForm(true);
                  }}
                  className="flex min-h-[52px] items-center justify-center rounded-2xl bg-[#27AE60] px-5 text-base font-bold text-white shadow-sm transition active:scale-[0.99]"
                >
                  📞 상담 신청하기
                </button>
                <a
                  href={homeLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[52px] items-center justify-center rounded-2xl border-2 border-[#1E2D4E] px-5 text-base font-bold text-[#1E2D4E] transition active:scale-[0.99]"
                >
                  🏠 홈페이지 보기
                </a>
              </div>
            )}
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
    </div>
  );
}
