"use client";

import { ChevronRight } from "lucide-react";

interface QaItem {
  id: string;
  key: string;
  question: string;
  answer: string;
  category: string;
  source: string;
  type: string;
  keywords: string[];
  salesTone: {
    primary: string;
    secondary: string[];
    confidence: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface QaCardProps {
  item: QaItem;
  onClick: (item: QaItem) => void;
  highlight?: string;
}

const TONE_COLORS: Record<string, { bg: string; text: string; label: string }> =
  {
    neutral: { bg: "bg-gray-100", text: "text-gray-700", label: "중립" },
    friendly: { bg: "bg-blue-100", text: "text-blue-700", label: "친근" },
    urgent: { bg: "bg-red-100", text: "text-red-700", label: "긴급" },
    professional: {
      bg: "bg-green-100",
      text: "text-green-700",
      label: "전문",
    },
    empathetic: {
      bg: "bg-purple-100",
      text: "text-purple-700",
      label: "공감",
    },
    assertive: {
      bg: "bg-orange-100",
      text: "text-orange-700",
      label: "단호",
    },
  };

export function QaCard({ item, onClick, highlight }: QaCardProps) {
  const toneInfo =
    TONE_COLORS[item.salesTone.primary] || TONE_COLORS.neutral;

  const truncate = (text: string, length: number = 80) => {
    return text.length > length ? text.substring(0, length) + "..." : text;
  };

  return (
    <button
      onClick={() => onClick(item)}
      className="w-full text-left bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* 판매톤 뱃지 */}
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${toneInfo.bg} ${toneInfo.text} shrink-0`}
            >
              {toneInfo.label}
            </span>
            <span className="text-xs text-gray-500">{item.category}</span>
          </div>

          {/* 질문 */}
          <p className="text-sm font-medium text-gray-900 mb-1 line-clamp-2 group-hover:text-blue-600 transition-colors">
            {truncate(item.question, 90)}
          </p>

          {/* 답변 미리보기 */}
          <p className="text-sm text-gray-600 line-clamp-2 mb-2">
            {truncate(item.answer, 100)}
          </p>

          {/* 키워드 */}
          {item.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.keywords.slice(0, 3).map((kw, i) => (
                <span
                  key={i}
                  className="inline-block text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded"
                >
                  {kw}
                </span>
              ))}
              {item.keywords.length > 3 && (
                <span className="text-xs text-gray-500">
                  +{item.keywords.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 화살표 */}
        <ChevronRight className="w-5 h-5 text-gray-300 shrink-0 group-hover:text-blue-400 transition-colors mt-1" />
      </div>
    </button>
  );
}
