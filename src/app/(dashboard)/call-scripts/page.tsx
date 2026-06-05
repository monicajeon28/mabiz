"use client";

import { useState } from "react";
import { CALL_SCRIPTS, type CallScriptCategory, type ScriptPhase } from "./scripts-data";

// ─── 색상 맵 ────────────────────────────────────────────────────────────────
const COLOR_MAP: Record<
  string,
  {
    tab: string;
    tabActive: string;
    tabBorder: string;
    badge: string;
    header: string;
    stepBadge: string;
    arrow: string;
  }
> = {
  blue: {
    tab: "text-blue-600",
    tabActive: "border-b-2 border-blue-600 text-blue-700 bg-blue-50",
    tabBorder: "border-blue-600",
    badge: "bg-blue-100 text-blue-700",
    header: "bg-blue-600",
    stepBadge: "bg-blue-100 text-blue-700",
    arrow: "text-blue-400",
  },
  green: {
    tab: "text-green-600",
    tabActive: "border-b-2 border-green-600 text-green-700 bg-green-50",
    tabBorder: "border-green-600",
    badge: "bg-green-100 text-green-700",
    header: "bg-green-600",
    stepBadge: "bg-green-100 text-green-700",
    arrow: "text-green-400",
  },
  red: {
    tab: "text-red-600",
    tabActive: "border-b-2 border-red-600 text-red-700 bg-red-50",
    tabBorder: "border-red-600",
    badge: "bg-red-100 text-red-700",
    header: "bg-red-600",
    stepBadge: "bg-red-100 text-red-700",
    arrow: "text-red-400",
  },
  purple: {
    tab: "text-purple-600",
    tabActive: "border-b-2 border-purple-600 text-purple-700 bg-purple-50",
    tabBorder: "border-purple-600",
    badge: "bg-purple-100 text-purple-700",
    header: "bg-purple-600",
    stepBadge: "bg-purple-100 text-purple-700",
    arrow: "text-purple-400",
  },
};

// ─── 아코디언 단계 컴포넌트 ──────────────────────────────────────────────────
function PhaseAccordion({
  phase,
  isOpen,
  onToggle,
  colors,
  index,
}: {
  phase: ScriptPhase;
  isOpen: boolean;
  onToggle: () => void;
  colors: (typeof COLOR_MAP)[string];
  index: number;
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* 헤더 (클릭 토글) */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        {/* 단계 번호 */}
        <span
          className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${colors.stepBadge}`}
        >
          {index + 1}
        </span>

        {/* 제목 + 메타 */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-900 text-sm">{phase.title}</span>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {phase.duration}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${colors.badge}`}>
              {phase.pasonaPhase}
            </span>
          </div>
        </div>

        {/* 화살표 */}
        <svg
          className={`flex-shrink-0 w-5 h-5 transition-transform ${colors.arrow} ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 내용 */}
      {isOpen && (
        <div className="border-t border-gray-100 bg-white divide-y divide-gray-50">
          {/* 스크립트 멘트 */}
          <div className="p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              스크립트
            </p>
            <pre className="whitespace-pre-wrap text-gray-800 text-sm leading-relaxed font-sans">
              {phase.content}
            </pre>
          </div>

          {/* 팁 */}
          {phase.tips.length > 0 && (
            <div className="p-4 bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                💡 통화 팁
              </p>
              <ul className="space-y-1">
                {phase.tips.map((tip, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 이의 처리 */}
          {phase.objections && phase.objections.length > 0 && (
            <div className="p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                ⚡ 이의 처리
              </p>
              <div className="space-y-3">
                {phase.objections.map((obj, i) => (
                  <div key={i} className="rounded-lg border border-orange-100 overflow-hidden">
                    <div className="bg-orange-50 px-3 py-2">
                      <span className="text-xs font-medium text-orange-700">고객: {obj.trigger}</span>
                    </div>
                    <div className="px-3 py-2 bg-white">
                      <span className="text-sm text-gray-800">{obj.response}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────
export default function CallScriptsPage() {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("free_travel");
  const [openPhases, setOpenPhases] = useState<Set<number>>(new Set([0]));
  const [isAllOpen, setIsAllOpen] = useState(false);

  const selectedCategory: CallScriptCategory | undefined = CALL_SCRIPTS.find(
    (c) => c.id === selectedCategoryId
  );

  const colors = COLOR_MAP[selectedCategory?.color ?? "blue"] ?? COLOR_MAP.blue;

  // 카테고리 변경 시 아코디언 초기화
  const handleCategoryChange = (id: string) => {
    setSelectedCategoryId(id);
    setOpenPhases(new Set([0]));
    setIsAllOpen(false);
  };

  // 단계 토글
  const togglePhase = (index: number) => {
    setOpenPhases((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // 전체 펼치기 / 접기
  const handleToggleAll = () => {
    if (isAllOpen) {
      setOpenPhases(new Set());
      setIsAllOpen(false);
    } else {
      const allIndices = selectedCategory
        ? new Set(selectedCategory.phases.map((_, i) => i))
        : new Set<number>();
      setOpenPhases(allIndices);
      setIsAllOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 페이지 헤더 */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 pt-5 pb-0">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">콜 스크립트</h1>
        <p className="text-gray-500 text-sm mt-1 mb-4">
          상품별 10단계 통화 스크립트. 단계를 클릭해 스크립트와 팁을 확인하세요.
        </p>

        {/* 카테고리 탭 */}
        <div className="flex overflow-x-auto gap-0 -mb-px">
          {CALL_SCRIPTS.map((cat) => {
            const c = COLOR_MAP[cat.color] ?? COLOR_MAP.blue;
            const isActive = cat.id === selectedCategoryId;
            return (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? c.tabActive
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-b-2 border-transparent"
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6">
        {selectedCategory ? (
          <>
            {/* 스크립트 설명 + 전체 펼치기 */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {selectedCategory.emoji} {selectedCategory.label}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">{selectedCategory.description}</p>
              </div>
              <button
                onClick={handleToggleAll}
                className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
              >
                {isAllOpen ? "전체 접기" : "전체 펼치기"}
              </button>
            </div>

            {/* 아코디언 목록 */}
            <div className="space-y-2">
              {selectedCategory.phases.map((phase, index) => (
                <PhaseAccordion
                  key={phase.id}
                  phase={phase}
                  isOpen={openPhases.has(index)}
                  onToggle={() => togglePhase(index)}
                  colors={colors}
                  index={index}
                />
              ))}
            </div>

            {/* 단계 수 요약 */}
            <p className="text-xs text-gray-400 text-center mt-6">
              총 {selectedCategory.phases.length}단계 | {openPhases.size}개 펼침
            </p>
          </>
        ) : (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-sm">카테고리를 선택하세요</p>
          </div>
        )}
      </div>
    </div>
  );
}
