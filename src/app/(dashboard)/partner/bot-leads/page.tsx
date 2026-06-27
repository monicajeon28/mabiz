"use client";

import { useState, useEffect, useCallback } from "react";
import { HOT_LEAD_MIN } from "@/lib/bot-flow";

interface Lead {
  id: string;
  status: string;
  fsmState: string;
  intentScore: number;
  closeAttempts: number;
  attributionSource: string | null;
  hasPhone: boolean;
  customerPhoneMasked: string | null;
  customerName: string | null;
  lastUserMessage: string | null;
  lastMessageAt: string;
  source?: string | null; // chat | button_gate
  qualifiers?: { when?: string; who?: string } | null; // 희망(시기·동행)
  objectionTags?: string[]; // 관심·걱정(반론)
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  HANDED_OFF: { text: "전화 요청", cls: "bg-emerald-100 text-emerald-800" },
  CONVERTED: { text: "구매", cls: "bg-blue-100 text-blue-800" },
  ACTIVE: { text: "상담 중", cls: "bg-slate-100 text-slate-700" },
  ABANDONED: { text: "이탈", cls: "bg-gray-100 text-gray-500" },
};

const DEFAULT_SMS =
  "안녕하세요, 크루즈닷 상담 담당자예요 😊 궁금하신 점 있으면 편하게 연락 주세요. 좋은 자리 있을 때 먼저 안내해 드릴게요!";

function intentStyle(score: number): { emoji: string; cls: string } {
  if (score >= HOT_LEAD_MIN) return { emoji: "🔥", cls: "bg-red-100 text-red-700" };
  if (score >= 40) return { emoji: "🌤️", cls: "bg-amber-100 text-amber-700" };
  return { emoji: "🌱", cls: "bg-slate-100 text-slate-600" };
}

export default function BotLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState<string | null>(null);
  const [smsText, setSmsText] = useState(DEFAULT_SMS);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/bot/leads");
      const data = await r.json();
      if (data?.ok) setLeads(data.leads);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const showToast = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(""), 2000);
  };

  const sendSms = async (id: string) => {
    if (!smsText.trim() || sending) return;
    setSending(true);
    try {
      const r = await fetch(`/api/bot/leads/${id}/sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: smsText.trim() }),
      });
      const data = await r.json();
      showToast(data?.message || (data?.ok ? "보냈어요" : "실패했어요"));
      if (data?.ok) {
        setComposing(null);
        setSmsText(DEFAULT_SMS);
      }
    } catch {
      showToast("연결이 불안정해요.");
    } finally {
      setSending(false);
    }
  };

  const hotCount = leads.filter((l) => l.intentScore >= HOT_LEAD_MIN).length;

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">내 봇이 잡은 손님</h1>
          <p className="mt-1 text-base text-slate-500">
            전체 {leads.length}명 · 🔥 지금 뜨거운 손님 {hotCount}명
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="min-h-[44px] rounded-xl border border-slate-300 px-4 text-base text-slate-700 active:scale-95"
        >
          새로고침
        </button>
      </div>

      {loading ? (
        <p className="mt-10 text-center text-base text-slate-400">불러오는 중…</p>
      ) : leads.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
          <div className="text-3xl">🤖</div>
          <p className="mt-2 text-base text-slate-600">
            아직 봇이 잡은 손님이 없어요.
            <br />내 봇 링크를 카톡·문자로 공유해 손님을 모아보세요.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {leads.map((l) => {
            const st = STATUS_LABEL[l.status] ?? STATUS_LABEL.ACTIVE;
            const is = intentStyle(l.intentScore);
            return (
              <div
                key={l.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`rounded-full px-3 py-1 text-base font-bold ${is.cls}`}>
                    {is.emoji} 구매의사 {l.intentScore}점
                  </span>
                  <span className={`rounded-full px-3 py-1 text-sm font-medium ${st.cls}`}>
                    {st.text}
                  </span>
                </div>

                <p className="mt-3 line-clamp-2 text-base text-slate-700">
                  💬 {l.lastUserMessage || "(버튼 신청 — 대화 없음)"}
                </p>

                {/* 핫DB 공략 설계도 — 희망(시기·동행) + 관심·걱정(반론). 콜 준비용. */}
                {((l.qualifiers && (l.qualifiers.when || l.qualifiers.who)) ||
                  (l.objectionTags && l.objectionTags.length > 0)) && (
                  <div className="mt-2 space-y-1">
                    {l.qualifiers && (l.qualifiers.when || l.qualifiers.who) && (
                      <p className="text-sm text-slate-700">
                        🎯 희망:{" "}
                        <span className="font-semibold">
                          {[l.qualifiers.when, l.qualifiers.who].filter(Boolean).join(" · ")}
                        </span>
                      </p>
                    )}
                    {l.objectionTags && l.objectionTags.length > 0 && (
                      <p className="flex flex-wrap items-center gap-1 text-sm text-slate-600">
                        💡 관심·걱정:
                        {l.objectionTags.map((t) => (
                          <span key={t} className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                            {t}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                  {l.customerName && <span>{l.customerName}</span>}
                  {l.customerPhoneMasked && <span>📞 {l.customerPhoneMasked}</span>}
                  <span>마지막 {new Date(l.lastMessageAt).toLocaleString("ko-KR")}</span>
                </div>

                {l.hasPhone ? (
                  composing === l.id ? (
                    <div className="mt-3 rounded-xl bg-slate-50 p-3">
                      <textarea
                        value={smsText}
                        onChange={(e) => setSmsText(e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-slate-300 p-3 text-base outline-none focus:border-[#2563EB]"
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => sendSms(l.id)}
                          disabled={sending}
                          className="min-h-[48px] flex-1 rounded-xl bg-[#2563EB] text-base font-bold text-white active:scale-95 disabled:opacity-50"
                        >
                          {sending ? "보내는 중…" : "문자 보내기"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setComposing(null)}
                          className="min-h-[48px] rounded-xl border border-slate-300 px-4 text-base text-slate-600 active:scale-95"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setComposing(l.id);
                        setSmsText(DEFAULT_SMS);
                      }}
                      className="mt-3 min-h-[48px] w-full rounded-xl bg-[#1E2D4E] text-base font-bold text-white active:scale-95"
                    >
                      📩 한 번 더 클로징 문자
                    </button>
                  )
                ) : (
                  <p className="mt-3 text-sm text-slate-400">
                    아직 손님이 연락처를 남기지 않았어요.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-xl bg-slate-900 px-5 py-3 text-base text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
