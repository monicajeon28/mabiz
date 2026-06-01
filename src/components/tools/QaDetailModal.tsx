"use client";

import { X, Copy, Check, ExternalLink } from "lucide-react";
import { useState } from "react";

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

interface QaDetailModalProps {
  item: QaItem;
  isOpen: boolean;
  onClose: () => void;
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

export function QaDetailModal({ item, isOpen, onClose }: QaDetailModalProps) {
  const [copied, setCopied] = useState<string | null>(null);

  if (!isOpen) return null;

  const copy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const toneInfo = TONE_COLORS[item.salesTone.primary] || TONE_COLORS.neutral;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center">
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-2xl md:max-h-[80vh] overflow-y-auto shadow-xl md:shadow-2xl">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex-1">
            <span
              className={`inline-block px-2 py-1 rounded-full text-sm font-semibold ${toneInfo.bg} ${toneInfo.text} mb-2`}
            >
              {toneInfo.label}
            </span>
            <h3 className="font-bold text-gray-900 text-base md:text-lg">
              {item.question.substring(0, 100)}
              {item.question.length > 100 ? "..." : ""}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg shrink-0"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="p-4 md:p-6 space-y-4">
          {/* 판매톤 정보 */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-gray-600 mb-2">판매톤</p>
            <div className="flex flex-wrap gap-2">
              <span
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${toneInfo.bg} ${toneInfo.text}`}
              >
                {toneInfo.label}
                {item.salesTone.confidence > 0 && (
                  <span className="text-sm">({Math.round(item.salesTone.confidence * 100)}%)</span>
                )}
              </span>
              {item.salesTone.secondary.map((s) => {
                const info = TONE_COLORS[s] || TONE_COLORS.neutral;
                return (
                  <span
                    key={s}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${info.bg} ${info.text}`}
                  >
                    {info.label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* 질문 */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">질문</h4>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {item.question}
              </p>
            </div>
          </div>

          {/* 답변 */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">답변</h4>
            <div className="bg-green-50 rounded-lg p-3 border border-green-200">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {item.answer}
              </p>
            </div>
          </div>

          {/* 복사 버튼 */}
          <div className="flex gap-2">
            <button
              onClick={() => copy("question", item.question)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium transition-colors"
            >
              {copied === "question" ? (
                <>
                  <Check className="w-4 h-4" /> 질문 복사됨
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> 질문 복사
                </>
              )}
            </button>
            <button
              onClick={() => copy("answer", item.answer)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-sm font-medium transition-colors"
            >
              {copied === "answer" ? (
                <>
                  <Check className="w-4 h-4" /> 답변 복사됨
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> 답변 복사
                </>
              )}
            </button>
          </div>

          {/* 메타 정보 */}
          <div className="border-t border-gray-200 pt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">카테고리</p>
              <p className="text-sm font-medium text-gray-900">{item.category}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">유형</p>
              <p className="text-sm font-medium text-gray-900">{item.type}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-gray-500 mb-1">출처</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900">{item.source}</p>
                <ExternalLink className="w-3.5 h-3.5 text-gray-600" />
              </div>
            </div>
            {item.keywords.length > 0 && (
              <div className="col-span-2">
                <p className="text-sm text-gray-500 mb-2">키워드</p>
                <div className="flex flex-wrap gap-1">
                  {item.keywords.slice(0, 5).map((kw, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm"
                    >
                      {kw}
                    </span>
                  ))}
                  {item.keywords.length > 5 && (
                    <span className="px-2 py-1 text-gray-500 text-sm">
                      +{item.keywords.length - 5}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div className="border-t border-gray-200 p-4 md:p-6 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-800 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
