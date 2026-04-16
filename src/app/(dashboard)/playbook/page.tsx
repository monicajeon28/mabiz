"use client";
import { useState, useEffect } from "react";
import { showError } from "@/components/ui/Toast";

const PERSONAS = [
  { key: "ALL",              label: "전체",        color: "gray"   },
  { key: "FILIAL_DUTY",      label: "효도·부모님", color: "purple" },
  { key: "NEWLYWEDS",        label: "신혼부부",    color: "pink"   },
  { key: "SINGLE_ADVENTURE", label: "싱글·1인",   color: "sky"    },
  { key: "RETIRED_LEISURE",  label: "리타이어60+", color: "green"  },
  { key: "PRICE_SENSITIVE",  label: "가격민감",    color: "orange" },
];

const CATEGORIES = ["전체", "OPENING", "EMPATHY", "VALUE", "OBJECTION", "CLOSING"];

type Pattern = {
  id: string;
  personaType: string;
  category: string;
  objectionType: string | null;
  patternText: string;
  exampleCall: string | null;
  conversionRate: number;
  status: string;
};

export default function PlaybookPage() {
  const [persona, setPersona] = useState("ALL");
  const [category, setCategory] = useState("전체");
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (persona !== "ALL") params.set("persona", persona);
    if (category !== "전체") params.set("category", category);
    fetch(`/api/tools/patterns?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setPatterns(d.patterns);
      })
      .catch(() => showError("패턴 로드 실패"))
      .finally(() => setLoading(false));
  }, [persona, category]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">페르소나별 플레이북</h1>
      <p className="text-sm text-gray-500 mb-6">실제 성약 통화에서 추출된 고효율 멘트 모음</p>

      {/* 페르소나 탭 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {PERSONAS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPersona(p.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors
              ${
                persona === p.key
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-gray-200 text-gray-600 hover:border-blue-300"
              }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* 카테고리 필터 */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-3 py-1 rounded text-xs border ${
              category === c
                ? "bg-gray-800 text-white"
                : "border-gray-200 text-gray-500"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* 패턴 목록 */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : patterns.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">아직 추출된 패턴이 없습니다</p>
          <p className="text-sm mt-1">통화 피드백을 10건 이상 쌓으면 패턴이 자동 생성됩니다</p>
        </div>
      ) : (
        <div className="space-y-4">
          {patterns.map((p) => (
            <div key={p.id} className="border rounded-xl p-4 bg-white shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  {p.category}
                </span>
                {p.objectionType && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                    반론: {p.objectionType}
                  </span>
                )}
                {p.conversionRate > 0 && (
                  <span className="text-xs text-gray-400 ml-auto">
                    성약률 {Math.round(p.conversionRate * 100)}%
                  </span>
                )}
              </div>
              <p className="text-gray-800 leading-relaxed">&ldquo;{p.patternText}&rdquo;</p>
              {p.exampleCall && (
                <p className="text-xs text-gray-400 mt-2 italic">{p.exampleCall}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
