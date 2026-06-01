"use client";

import { cn } from "@/lib/utils";

interface SegmentSelectorProps {
  category: string;
  selected: string;
  onSelect: (segment: string) => void;
}

const SEGMENT_MAP: Record<string, string[]> = {
  healthcare: ["신혼부부 (30-35세)", "자녀있는가정 (40-50세)", "시니어 (55세+)"],
  rental: ["초심자", "가격민감군", "신중한구매자"],
  product_new_db: ["모든 고객"],
  product_inactive_db: ["모든 고객"],
};

export function SegmentSelector({ category, selected, onSelect }: SegmentSelectorProps) {
  const segments = SEGMENT_MAP[category] || [];

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-900">고객 세그먼트</h3>
      <div className="space-y-1">
        {segments.map((segment) => (
          <button
            key={segment}
            onClick={() => onSelect(segment)}
            className={cn(
              "w-full px-3 py-2 rounded-lg text-sm text-left transition-colors",
              selected === segment
                ? "bg-blue-500 text-white font-medium"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            {segment}
          </button>
        ))}
      </div>
    </div>
  );
}
