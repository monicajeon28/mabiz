"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";

interface DayTemplate {
  day: number;
  pasona: string;
  template: string;
  psychology: string;
}

interface LensTemplate {
  lens: string;
  title: string;
  description: string;
  days: DayTemplate[];
}

const LENSES = [
  { id: "L0", label: "L0: 신규 고객 (신뢰)", korean: "신규 고객", emoji: "🤝" },
  { id: "L1", label: "L1: 가격 민감 (손실회피)", korean: "가격 민감", emoji: "💰" },
  { id: "L2", label: "L2: 준비 불안 (복잡도)", korean: "준비 불안", emoji: "❓" },
  { id: "L3", label: "L3: 경쟁사 비교 (차별성)", korean: "경쟁사 비교", emoji: "🏆" },
  { id: "L6", label: "L6: 타이밍 (긴박감)", korean: "타이밍", emoji: "⏱️" },
  { id: "L10", label: "L10: 즉시 구매 (마감)", korean: "즉시 구매", emoji: "🎯" },
];

/**
 * 렌즈별 Day 0-3 템플릿 프리뷰
 * - Grant Cardone 10렌즈 기반
 * - PASONA 프레임워크 통합
 * - Day 0-3 자동화 시퀀스
 */
export function SmsLensPreview() {
  const [selectedLens, setSelectedLens] = useState("L6");
  const [templates, setTemplates] = useState<DayTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLensPreview = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/sms/lens-preview?lens=${selectedLens}`);
        if (!res.ok) {
          throw new Error("렌즈 템플릿을 불러올 수 없습니다");
        }
        const data = await res.json();
        setTemplates(data.days || defaultTemplates);
      } catch (err) {
        setError(err instanceof Error ? err.message : "오류 발생");
        setTemplates(defaultTemplates);
      } finally {
        setLoading(false);
      }
    };

    fetchLensPreview();
  }, [selectedLens]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-purple-600" />
        <h3 className="font-bold text-lg">렌즈별 Day 0-3 템플릿</h3>
      </div>

      {/* 렌즈 선택 버튼 */}
      <div className="flex flex-wrap gap-2 mb-6">
        {LENSES.map((lens) => (
          <button
            key={lens.id}
            onClick={() => setSelectedLens(lens.id)}
            className={`px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${
              selectedLens === lens.id
                ? "bg-purple-600 text-white shadow-md scale-105"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm"
            }`}
            title={lens.label}
          >
            <span className="text-lg">{lens.emoji}</span>
            <span className="text-sm whitespace-nowrap">{lens.korean}</span>
          </button>
        ))}
      </div>

      {/* 로딩 상태 */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
          <p className="ml-2 text-gray-600">템플릿 로딩 중...</p>
        </div>
      )}

      {/* 에러 상태 */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded mb-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Day 0-3 카드 */}
      {!loading && templates.length > 0 && (
        <div className="space-y-3">
          {templates.map((t) => (
            <div
              key={`day-${t.day}`}
              className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* 헤더 */}
              <div className="bg-gradient-to-r from-purple-100 to-purple-50 px-4 py-2 border-b border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-purple-700 uppercase tracking-wide">
                      Day {t.day}
                    </p>
                    <p className="text-xs text-purple-600">{t.pasona}</p>
                  </div>
                  <div className="text-xs font-semibold text-purple-700 bg-purple-200 px-2 py-1 rounded">
                    {t.day === 0 ? "초기액션" : t.day === 1 ? "이의대응" : t.day === 2 ? "가치강조" : "긴박감"}
                  </div>
                </div>
              </div>

              {/* 내용 */}
              <div className="p-4">
                <p className="text-sm text-gray-800 mb-3 leading-relaxed whitespace-pre-wrap">
                  {t.template}
                </p>
                <div className="flex items-start gap-2 pt-3 border-t border-gray-100">
                  <span className="text-xs font-semibold text-gray-600 flex-shrink-0 mt-0.5">
                    💡
                  </span>
                  <p className="text-xs text-gray-600 italic">{t.psychology}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 빈 상태 */}
      {!loading && templates.length === 0 && !error && (
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">템플릿이 없습니다</p>
        </div>
      )}
    </div>
  );
}

// 기본 템플릿 (API 실패 시)
const defaultTemplates: DayTemplate[] = [
  {
    day: 0,
    pasona: "P(Problem) + A(Agitate)",
    template: "안녕하세요 {{name}}님! {{destination}}으로의 여행을 계획 중이신가요?",
    psychology: "L6 손실회피: 지금이 특가 기간이라는 긴박감",
  },
  {
    day: 1,
    pasona: "S(Solution)",
    template: "{{name}}님처럼 많은 분들이 저희 {{product}}로 가족과의 특별한 추억을 만들고 계세요.",
    psychology: "L1/L7: 사회증명 + 동반자설득",
  },
  {
    day: 2,
    pasona: "O(Offer) + N(Narrow)",
    template: "오늘까지만! {{discount}}% 특가 + 무료 여행보험 포함. 더 이상 미루지 마세요.",
    psychology: "L6 손실회피 + L10 즉시구매: 마감시간 강조",
  },
  {
    day: 3,
    pasona: "A(Action)",
    template: "{{name}}님의 예약을 확정하려면 지금 바로 결제하세요. 남은 좌석이 {{seats}}개뿐입니다!",
    psychology: "L10 즉시구매 + 희소성 극대화",
  },
];
