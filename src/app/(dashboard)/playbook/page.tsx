"use client";
import { useState, useEffect } from "react";
import { showError } from "@/components/ui/Toast";
import { ChevronDown, ChevronUp } from "lucide-react";

// 탭 구분
type ScriptTab = "GOLD" | "GENERAL";

// 상품 목록
const PRODUCTS = [
  { code: "ALL",            label: "전체" },
  { code: "NEARBY",         label: "🇯🇵 근거리" },
  { code: "SOUTHEAST_ASIA", label: "🌏 동남아" },
  { code: "MEDITERRANEAN",  label: "🇪🇺 지중해" },
  { code: "ALASKA",         label: "🏔 알래스카" },
  { code: "GOLD_EVENT",     label: "⭐ 골드기획" },
];

// 페르소나 (골드 탭용)
const PERSONAS = [
  { key: "ALL",              label: "전체" },
  { key: "FILIAL_DUTY",      label: "효도·부모님" },
  { key: "NEWLYWEDS",        label: "신혼부부" },
  { key: "SINGLE_ADVENTURE", label: "싱글·1인" },
  { key: "RETIRED_LEISURE",  label: "리타이어60+" },
  { key: "PRICE_SENSITIVE",  label: "가격민감" },
];

// 단계 (일반 탭용)
const STAGES = ["전체", "INTRO", "NEEDS", "OBJECTION", "CLOSE"];

type PlaybookItem = {
  id: string; type: string; title: string; content: string;
  scriptTab: string; productCode: string; sectionOrder: number;
};
type Pattern = {
  id: string; personaType: string; category: string;
  objectionType: string | null; patternText: string;
  exampleCall: string | null; conversionRate: number;
  status: string; productCode: string;
};

// 아코디언 카드
function ScriptCard({ item, isPattern }: { item: PlaybookItem | Pattern; isPattern: boolean }) {
  const [open, setOpen] = useState(false);
  const isObjection = isPattern
    ? (item as Pattern).category === "OBJECTION"
    : (item as PlaybookItem).type === "OBJECTION";
  const title   = isPattern ? (item as Pattern).patternText.substring(0, 60) + "..." : (item as PlaybookItem).title;
  const content = isPattern ? (item as Pattern).patternText : (item as PlaybookItem).content;
  const subtext = isPattern ? (item as Pattern).exampleCall : null;

  return (
    <div className={`border rounded-xl bg-white shadow-sm overflow-hidden
      ${isObjection ? "border-l-4 border-l-red-400" : "border-gray-100"}`}>
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left min-h-[80px]">
        <div className="flex items-center gap-2 flex-1">
          {isObjection && <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full shrink-0">🚨 반론</span>}
          {isPattern && <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full shrink-0">AI</span>}
          <span className="text-sm font-medium text-gray-800 line-clamp-2">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-gray-50 pt-3">
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{content}</p>
          {subtext && <p className="text-xs text-gray-400 mt-2 italic">{subtext}</p>}
        </div>
      )}
    </div>
  );
}

export default function PlaybookPage() {
  const [tab,      setTab]      = useState<ScriptTab>("GOLD");
  const [persona,  setPersona]  = useState("ALL");
  const [product,  setProduct]  = useState("ALL");
  const [stage,    setStage]    = useState("전체");
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [scripts,  setScripts]  = useState<PlaybookItem[]>([]);
  const [loading,  setLoading]  = useState(false);

  // 골드 탭 — AI 패턴
  useEffect(() => {
    if (tab !== "GOLD") return;
    setLoading(true);
    const params = new URLSearchParams();
    if (persona !== "ALL") params.set("persona", persona);
    fetch(`/api/tools/patterns?${params}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setPatterns(d.patterns ?? []); })
      .catch(() => showError("패턴 로드 실패"))
      .finally(() => setLoading(false));
  }, [tab, persona]);

  // 일반 탭 — 스크립트
  useEffect(() => {
    if (tab !== "GENERAL") return;
    setLoading(true);
    const params = new URLSearchParams({ scriptTab: "GENERAL" });
    if (product !== "ALL") params.set("productCode", product);
    if (stage !== "전체") params.set("type", stage);
    fetch(`/api/tools/playbook?${params}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setScripts(d.items ?? []); })
      .catch(() => showError("스크립트 로드 실패"))
      .finally(() => setLoading(false));
  }, [tab, product, stage]);

  // 반론 카드 상단 정렬
  const sortedPatterns = [...patterns].sort((a, b) =>
    (a.category === "OBJECTION" ? -1 : 1) - (b.category === "OBJECTION" ? -1 : 1));
  const sortedScripts  = [...scripts].sort((a, b) =>
    (a.type === "OBJECTION" ? -1 : 1) - (b.type === "OBJECTION" ? -1 : 1));

  return (
    <div className="max-w-2xl mx-auto">
      {/* 최상위 세그먼트 — sticky */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 pt-4 pb-3">
        <div className="flex rounded-xl border border-gray-200 overflow-hidden mb-3">
          <button onClick={() => setTab("GOLD")}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors
              ${tab === "GOLD" ? "bg-yellow-400 text-white" : "bg-white text-gray-500"}`}>
            ⭐ 골드회원
          </button>
          <button onClick={() => setTab("GENERAL")}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors
              ${tab === "GENERAL" ? "bg-blue-600 text-white" : "bg-white text-gray-500"}`}>
            🚢 일반여행상담
          </button>
        </div>

        {/* 2차 필터 */}
        {tab === "GOLD" && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {PERSONAS.map((p) => (
              <button key={p.key} onClick={() => setPersona(p.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors
                  ${persona === p.key ? "bg-yellow-400 text-white border-yellow-400" : "border-gray-200 text-gray-500"}`}>
                {p.label}
              </button>
            ))}
          </div>
        )}
        {tab === "GENERAL" && (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {PRODUCTS.map((p) => (
                <button key={p.code} onClick={() => setProduct(p.code)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors
                    ${product === p.code ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-500"}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2 overflow-x-auto pb-1 scrollbar-hide">
              {STAGES.map((s) => (
                <button key={s} onClick={() => setStage(s)}
                  className={`px-3 py-1 rounded text-xs border transition-colors
                    ${stage === s ? "bg-gray-800 text-white border-gray-800" : "border-gray-200 text-gray-400"}`}>
                  {s}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 콘텐츠 */}
      <div className="px-4 py-4 space-y-3">
        {loading ? (
          [1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)
        ) : tab === "GOLD" ? (
          sortedPatterns.length === 0
            ? <div className="text-center py-16 text-gray-400 text-sm">통화 피드백을 쌓으면 AI 패턴이 생성됩니다</div>
            : sortedPatterns.map((p) => <ScriptCard key={p.id} item={p} isPattern={true} />)
        ) : (
          sortedScripts.length === 0
            ? <div className="text-center py-16 text-gray-400 text-sm">스크립트를 불러오는 중이거나 아직 없습니다</div>
            : sortedScripts.map((s) => <ScriptCard key={s.id} item={s} isPattern={false} />)
        )}
      </div>
    </div>
  );
}
