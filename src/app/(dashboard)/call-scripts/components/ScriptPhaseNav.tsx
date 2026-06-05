"use client";

import { cn } from "@/lib/utils";

interface ScriptPhaseNavProps {
  selected: string;
  onSelect: (phase: string) => void;
  availablePhases?: string[];
}

const PHASES = [
  { id: "1", name: "인사 + 신뢰감", time: "0-2분", icon: "👋" },
  { id: "2", name: "욕구 발굴", time: "2-5분", icon: "💭" },
  { id: "3", name: "패키지 설명", time: "5-10분", icon: "🎁" },
  { id: "4", name: "가격 + 기대감", time: "10-13분", icon: "💰" },
  { id: "5", name: "클로징", time: "13-15분", icon: "🎯" },
];

// 카테고리 + 세그먼트 조합별 사용 가능한 페이즈 목록
// 데이터가 준비되지 않은 세그먼트는 ["1"]만 포함
export const AVAILABLE_PHASES_MAP: Record<string, Record<string, string[]>> = {
  healthcare: {
    "신혼부부 (30-35세)": ["1", "2", "3", "4", "5"],
    "자녀있는가정 (40-50세)": ["1"],
    "시니어 (55세+)": ["1"],
  },
  rental: {
    "초심자": ["1"],
    "가격민감군": ["1"],
    "신중한구매자": ["1"],
  },
  product_new_db: {
    "모든 고객": ["1"],
  },
  product_inactive_db: {
    "모든 고객": ["1"],
  },
};

export function ScriptPhaseNav({ selected, onSelect, availablePhases }: ScriptPhaseNavProps) {
  return (
    <div className="space-y-1">
      {PHASES.map((phase) => {
        const isAvailable = !availablePhases || availablePhases.includes(phase.id);
        return (
          <button
            key={phase.id}
            onClick={() => isAvailable && onSelect(phase.id)}
            disabled={!isAvailable}
            title={!isAvailable ? "준비 중" : undefined}
            className={cn(
              "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors",
              selected === phase.id && isAvailable
                ? "bg-blue-500 text-white font-medium"
                : isAvailable
                ? "text-gray-700 hover:bg-gray-100"
                : "opacity-40 text-gray-400 cursor-not-allowed pointer-events-none"
            )}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{phase.icon}</span>
              <div className="flex-1">
                <div className="font-medium">{phase.name}</div>
                <div className="text-sm opacity-75">
                  {isAvailable ? phase.time : "준비 중"}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
