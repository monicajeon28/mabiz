"use client";

import { cn } from "@/lib/utils";

interface ScriptPhaseNavProps {
  selected: string;
  onSelect: (phase: string) => void;
}

const PHASES = [
  { id: "1", name: "인사 + 신뢰감", time: "0-2분", icon: "👋" },
  { id: "2", name: "욕구 발굴", time: "2-5분", icon: "💭" },
  { id: "3", name: "패키지 설명", time: "5-10분", icon: "🎁" },
  { id: "4", name: "가격 + 기대감", time: "10-13분", icon: "💰" },
  { id: "5", name: "클로징", time: "13-15분", icon: "🎯" },
];

export function ScriptPhaseNav({ selected, onSelect }: ScriptPhaseNavProps) {
  return (
    <div className="space-y-1">
      {PHASES.map((phase) => (
        <button
          key={phase.id}
          onClick={() => onSelect(phase.id)}
          className={cn(
            "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors",
            selected === phase.id
              ? "bg-blue-500 text-white font-medium"
              : "text-gray-700 hover:bg-gray-100"
          )}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">{phase.icon}</span>
            <div className="flex-1">
              <div className="font-medium">{phase.name}</div>
              <div className="text-sm opacity-75">{phase.time}</div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
