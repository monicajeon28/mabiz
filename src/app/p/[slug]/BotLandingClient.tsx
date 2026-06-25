"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Msg {
  role: "user" | "bot";
  text: string;
}

interface Props {
  pageId: string;
  refCode?: string;
  brandTitle: string;
  greeting?: string;
  chips?: string[];
  /** 봇 종류(코드값). 화면엔 한글 표시명만 노출. */
  botType?: "cruise" | "recruit";
}

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

  const showChips = messages.length === 1 && !loading;
  const chipList = chips && chips.length > 0 ? chips : defaultChips;

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
          setMessages((m) => [...m, { role: "bot", text: data.reply }]);
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
            <div key={i} className="flex justify-start">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-base leading-relaxed text-slate-800 shadow-sm">
                {m.text}
              </div>
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
