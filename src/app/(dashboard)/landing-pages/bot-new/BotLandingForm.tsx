"use client";

import { useState } from "react";

interface Product {
  productCode: string;
  packageName: string;
  cruiseLine: string;
  basePrice: number | null;
  nights: number;
  days: number;
}

interface Props {
  products: Product[];
}

const PERSONA_OPTIONS = [
  { key: "calm", label: "차분한 존댓말", desc: "천천히·공감 먼저 (기본 추천)" },
  { key: "friendly", label: "친근하고 다정한", desc: "옆집 자녀처럼 편안하게" },
  { key: "pro", label: "전문적이고 신뢰감", desc: "차분한 여행 전문가 느낌" },
];

const CRUISE_GREETING =
  "안녕하세요! 크루즈 여행 상담을 도와드릴게요. 무엇이든 편하게 물어보세요 😊";
const CRUISE_CHIPS = ["가격이 궁금해요", "어디로 가나요?", "상담받고 싶어요"];
const RECRUIT_GREETING =
  "안녕하세요! 부업·창업으로 크루즈 판매 파트너를 알아보고 계신가요? 무엇이든 편하게 물어보세요 😊";
const RECRUIT_CHIPS = ["수익이 어떻게 나나요?", "초보도 할 수 있나요?", "비용이 궁금해요"];

// 봇 종류 — 코드값은 cruise/recruit, 화면엔 한글만 노출(50대 친화).
const BOT_TYPE_OPTIONS = [
  { key: "cruise" as const, label: "🚢 크루즈 상담봇", desc: "손님에게 크루즈 여행을 상담·판매" },
  { key: "recruit" as const, label: "🎓 교육생 모집봇", desc: "부업·창업 파트너(교육생)를 정직하게 모집" },
];

const DEFAULT_GREETING = CRUISE_GREETING; // 미리보기 폴백용

function manwon(n: number | null): string {
  if (n == null) return "";
  return `약 ${Math.round(n / 10000).toLocaleString("ko-KR")}만원`;
}

export default function BotLandingForm({ products }: Props) {
  const [title, setTitle] = useState("");
  const [botType, setBotType] = useState<"cruise" | "recruit">("cruise");
  const [persona, setPersona] = useState("calm");
  const [greeting, setGreeting] = useState(CRUISE_GREETING);
  const [chips, setChips] = useState<string[]>(CRUISE_CHIPS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ url: string } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const toggleProduct = (code: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(code)) n.delete(code);
      else n.add(code);
      return n;
    });
  };

  // 봇 종류 바꾸면 그 종류에 맞는 기본 인사말/질문으로 초기화
  const chooseBotType = (t: "cruise" | "recruit") => {
    setBotType(t);
    setGreeting(t === "recruit" ? RECRUIT_GREETING : CRUISE_GREETING);
    setChips(t === "recruit" ? RECRUIT_CHIPS : CRUISE_CHIPS);
    if (t === "recruit") setSelected(new Set()); // 모집봇은 상품 미사용
  };

  const setChip = (i: number, v: string) => {
    setChips((c) => c.map((x, idx) => (idx === i ? v : x)));
  };

  const create = async () => {
    setError("");
    if (!title.trim()) {
      setError("봇 랜딩 이름을 적어주세요. (예: 지중해 크루즈 상담)");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/landing-pages/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botType,
          title: title.trim(),
          persona,
          greeting: greeting.trim() || undefined,
          chips: chips.map((c) => c.trim()).filter(Boolean),
          productCodes: botType === "recruit" ? [] : Array.from(selected),
        }),
      });
      const data = await res.json();
      if (data?.ok) setResult({ url: data.url });
      else setError(data?.message || "만들기에 실패했어요. 다시 시도해주세요.");
    } catch {
      setError("연결이 불안정해요. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  // 완료 화면
  if (result) {
    return (
      <div className="mx-auto max-w-xl p-5">
        <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-6 text-center">
          <div className="text-2xl">✅</div>
          <h2 className="mt-2 text-xl font-bold text-emerald-900">봇 랜딩이 만들어졌어요!</h2>
          <p className="mt-1 text-base text-emerald-800">
            아래 링크로 들어가면 봇이 손님을 상담해요.
          </p>
          <div className="mt-4 break-all rounded-xl bg-white px-4 py-3 text-base text-slate-800 shadow-sm">
            {result.url}
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="min-h-[48px] rounded-xl bg-[#1E2D4E] text-base font-bold text-white active:scale-95"
            >
              {copied ? "복사됐어요 ✓" : "링크 복사하기"}
            </button>
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-[#1E2D4E] text-base font-bold text-[#1E2D4E] active:scale-95"
            >
              봇 미리 써보기
            </a>
            <a
              href="/landing-pages"
              className="flex min-h-[48px] items-center justify-center text-base text-slate-500"
            >
              목록으로
            </a>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-500">
            이 봇 랜딩을 <b>지사장·대리점장에게 공유</b>하면, 각자 “복사해서 쓰기”로
            자기 링크를 만들어 마케팅에 쓸 수 있어요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-5">
      <h1 className="text-xl font-bold text-slate-900">봇 랜딩 만들기</h1>
      <p className="mt-1 text-base text-slate-500">
        봇 종류와 인사말만 정하면, 손님을 알아서 상담하는 봇 페이지가 만들어져요.
      </p>

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        {/* 왼쪽: 입력 */}
        <div className="space-y-6">
          {/* 0. 어떤 봇? */}
          <section>
            <span className="block text-base font-bold text-slate-800">0. 어떤 봇을 만드시겠어요?</span>
            <p className="mb-2 text-sm text-slate-500">목적에 맞게 골라주세요. (가장 중요해요)</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {BOT_TYPE_OPTIONS.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => chooseBotType(b.key)}
                  className={`flex min-h-[64px] flex-col items-start justify-center rounded-xl border-2 px-4 py-2 text-left active:scale-[0.99] ${
                    botType === b.key
                      ? "border-[#2563EB] bg-blue-50 text-[#1E2D4E]"
                      : "border-slate-200 text-slate-700"
                  }`}
                >
                  <span className="text-base font-bold">{b.label}</span>
                  <span className="text-sm font-normal text-slate-500">{b.desc}</span>
                </button>
              ))}
            </div>
          </section>

          {/* 1. 이름 */}
          <section>
            <label className="block text-base font-bold text-slate-800">
              1. 봇 랜딩 이름
            </label>
            <p className="mb-2 text-sm text-slate-500">
              나만 보는 이름이에요. (예:{" "}
              {botType === "recruit" ? "부업·크루즈 파트너 모집" : "지중해 크루즈 상담"})
            </p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={botType === "recruit" ? "예: 부업·크루즈 파트너 모집" : "예: 지중해 크루즈 상담"}
              className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base outline-none focus:border-[#2563EB]"
            />
          </section>

          {/* 2. 말투 */}
          <section>
            <span className="block text-base font-bold text-slate-800">2. 봇 말투</span>
            <div className="mt-2 space-y-2">
              {PERSONA_OPTIONS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPersona(p.key)}
                  className={`flex min-h-[48px] w-full items-center justify-between rounded-xl border-2 px-4 text-left text-base active:scale-[0.99] ${
                    persona === p.key
                      ? "border-[#2563EB] bg-blue-50 font-bold text-[#1E2D4E]"
                      : "border-slate-200 text-slate-700"
                  }`}
                >
                  <span>
                    {p.label}
                    <span className="ml-2 text-sm font-normal text-slate-500">{p.desc}</span>
                  </span>
                  {persona === p.key && <span className="text-[#2563EB]">✓</span>}
                </button>
              ))}
            </div>
          </section>

          {/* 3. 인사말 */}
          <section>
            <label className="block text-base font-bold text-slate-800">3. 첫 인사말</label>
            <p className="mb-2 text-sm text-slate-500">손님이 들어오면 봇이 처음 하는 말이에요.</p>
            <textarea
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-300 p-4 text-base leading-relaxed outline-none focus:border-[#2563EB]"
            />
          </section>

          {/* 4. 빠른 질문 */}
          <section>
            <span className="block text-base font-bold text-slate-800">4. 빠른 질문 버튼 (3개)</span>
            <p className="mb-2 text-sm text-slate-500">손님이 누르기만 해도 대화가 시작돼요.</p>
            <div className="space-y-2">
              {chips.map((c, i) => (
                <input
                  key={i}
                  value={c}
                  onChange={(e) => setChip(i, e.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base outline-none focus:border-[#2563EB]"
                />
              ))}
            </div>
          </section>

          {/* 5. 상품 (크루즈 상담봇만 사용 — 모집봇은 확정 오퍼 안내) */}
          {botType === "cruise" && (
          <section>
            <span className="block text-base font-bold text-slate-800">5. 상담할 상품 (선택)</span>
            <p className="mb-2 text-sm text-slate-500">
              고른 상품만 봇이 안내해요. <b>안 고르면 모든 상품</b>을 안내해요.
            </p>
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-2">
              {products.length === 0 && (
                <p className="p-3 text-sm text-slate-400">등록된 상품이 없어요.</p>
              )}
              {products.map((p) => (
                <label
                  key={p.productCode}
                  className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 ${
                    selected.has(p.productCode)
                      ? "border-[#2563EB] bg-blue-50"
                      : "border-slate-200"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(p.productCode)}
                    onChange={() => toggleProduct(p.productCode)}
                    className="h-6 w-6 shrink-0 accent-[#2563EB]"
                  />
                  <span className="text-base text-slate-800">
                    {p.packageName}
                    <span className="ml-1 text-sm text-slate-500">
                      · {p.cruiseLine} · {p.nights}박{p.days}일{" "}
                      {p.basePrice != null && `· ${manwon(p.basePrice)}`}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </section>
          )}
        </div>

        {/* 오른쪽: 미리보기 */}
        <div className="md:sticky md:top-5 md:self-start">
          <span className="block text-base font-bold text-slate-800">미리보기</span>
          <p className="mb-2 text-sm text-slate-500">손님에게 이렇게 보여요.</p>
          <div className="mx-auto w-full max-w-sm overflow-hidden rounded-3xl border-4 border-slate-800 bg-slate-50 shadow-lg">
            <div className="bg-[#1E2D4E] px-4 py-3 text-white">
              <div className="text-base font-bold">{title.trim() || "봇 랜딩 이름"}</div>
              <div className="text-xs text-slate-200">
                {botType === "recruit" ? "교육생 모집봇" : "크루즈 상담봇"}
              </div>
            </div>
            <div className="min-h-[320px] space-y-3 p-4">
              <div className="flex justify-start">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-base leading-relaxed text-slate-800 shadow-sm">
                  {greeting.trim() || DEFAULT_GREETING}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {chips
                  .filter((c) => c.trim())
                  .map((c, i) => (
                    <span
                      key={i}
                      className="rounded-full border-2 border-[#1E2D4E] bg-white px-4 py-2 text-sm font-medium text-[#1E2D4E]"
                    >
                      {c}
                    </span>
                  ))}
              </div>
            </div>
            <div className="flex items-center gap-2 border-t border-slate-200 bg-white px-3 py-3">
              <div className="h-11 flex-1 rounded-full border border-slate-300 px-4 text-base leading-[2.75rem] text-slate-400">
                궁금한 점을 입력하세요
              </div>
              <div className="flex h-11 min-w-[60px] items-center justify-center rounded-full bg-[#2563EB] px-4 text-base font-bold text-white">
                보내기
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-base text-red-700">{error}</p>
      )}

      {/* 만들기 */}
      <div className="sticky bottom-0 mt-6 -mx-5 border-t border-slate-200 bg-white px-5 py-4">
        <button
          type="button"
          onClick={create}
          disabled={saving}
          className="min-h-[52px] w-full rounded-2xl bg-[#1E2D4E] text-lg font-bold text-white active:scale-[0.99] disabled:opacity-50"
        >
          {saving ? "만드는 중…" : "봇 랜딩 만들기"}
        </button>
      </div>
    </div>
  );
}
