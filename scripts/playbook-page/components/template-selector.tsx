"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { VariantCode } from "@/lib/types/sequence";

interface TemplateSelectorProps {
  day: number;
  value: VariantCode;
  onChange: (variant: VariantCode) => void;
  variants?: Array<{
    code: VariantCode;
    message: string;
    psychology?: string;
  }>;
  onCustomEdit?: () => void;
}

const PASONA_DESCRIPTIONS = {
  A: "PASONA A: 문제 + 긴급도 조성",
  B: "PASONA B: 감정 공감",
  C: "PASONA C: 해결책",
  D: "PASONA D: 오퍼/가치",
  E: "PASONA E: 행동 촉구",
};

export function TemplateSelector({
  day,
  value,
  onChange,
  variants = [],
  onCustomEdit,
}: TemplateSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredVariant, setHoveredVariant] = useState<VariantCode | null>(null);

  const selectedVariant = variants.find((v) => v.code === value);

  return (
    <div className="relative">
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white flex items-center justify-between text-left hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 text-sm">
              {value === "custom" ? "커스텀 템플릿" : `변형 ${value}`}
            </div>
            {selectedVariant && (
              <div className="text-xs text-gray-500 truncate mt-0.5">
                {selectedVariant.psychology || PASONA_DESCRIPTIONS[value as VariantCode]}
              </div>
            )}
          </div>
          <ChevronDown
            className={`w-4 h-4 text-gray-600 transition-transform ${
              isOpen ? "transform rotate-180" : ""
            }`}
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-10">
            {variants.map((variant) => (
              <button
                key={variant.code}
                onClick={() => {
                  onChange(variant.code);
                  setIsOpen(false);
                }}
                onMouseEnter={() => setHoveredVariant(variant.code)}
                onMouseLeave={() => setHoveredVariant(null)}
                className={`w-full text-left px-3 py-2.5 border-b border-gray-100 last:border-b-0 hover:bg-blue-50 transition-colors ${
                  value === variant.code ? "bg-blue-100" : ""
                }`}
              >
                <div className="font-medium text-gray-900 text-sm">
                  변형 {variant.code}
                </div>
                <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                  {variant.message}
                </div>
              </button>
            ))}

            {/* Custom Option */}
            <button
              onClick={() => {
                onCustomEdit?.();
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors`}
            >
              + 커스텀 작성
            </button>
          </div>
        )}
      </div>

      {/* Preview Tooltip */}
      {hoveredVariant && selectedVariant && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 text-white text-xs rounded-lg p-2 z-20">
          {selectedVariant.message}
        </div>
      )}
    </div>
  );
}
