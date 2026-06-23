"use client";

/**
 * ContactLensTab — 심리렌즈 L0-L10 표시
 * - 주요 렌즈 1개 + 차순위 3개 표시
 * - 컴팩트 버전 (높이 200px)
 * - 각 렌즈: 이름 + 설명 + 점수 진행바
 */

import React from "react";
import { Contact } from "@/types/contact";

const LENS_INFO = [
  { id: "L0", name: "부재중 고객", description: "3-6/6-12/1년+ 미접촉" },
  { id: "L1", name: "가격 민감도", description: "할부/할인 관심" },
  { id: "L2", name: "준비 복잡도", description: "서류·예약 우려" },
  { id: "L3", name: "경쟁사 비교", description: "다른 회사와 비교 중" },
  { id: "L4", name: "가족 설득", description: "배우자·자녀 동의 필요" },
  { id: "L5", name: "자기투영", description: "본인 경험치 강조" },
  { id: "L6", name: "타이밍·손실", description: "지금 안 사면 후회 심함" },
  { id: "L7", name: "동반자·가족", description: "함께할 사람 중요" },
  { id: "L8", name: "재구매·습관", description: "과거 이용 경험 있음" },
  { id: "L9", name: "건강·안전", description: "의료·건강 신뢰도 중요" },
  { id: "L10", name: "즉시 구매", description: "지금 바로 결정하려 함" },
];

export default function ContactLensTab({ contact }: { contact: Contact }) {
  // lensInfo가 없으면 빈 객체 사용
  const lensScores = contact.lensInfo || {};

  // 모든 렌즈 점수를 배열로 변환 후 정렬
  const sortedLenses = LENS_INFO
    .map(lens => ({
      ...lens,
      score: lensScores[lens.id] ?? 0,
    }))
    .sort((a, b) => b.score - a.score);

  // 상위 4개만 표시 (주요 1개 + 차순위 3개)
  const topLenses = sortedLenses.slice(0, 4);

  return (
    <div className="space-y-3">
      {topLenses.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">
          아직 심리렌즈 데이터가 없습니다.
        </p>
      ) : (
        topLenses.map((lens, idx) => (
          <div
            key={lens.id}
            className="bg-white border border-gray-200 rounded-lg p-3"
          >
            {/* 헤더: 순위 + 이름 */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {idx === 0 ? (
                    <span className="text-lg font-bold text-amber-500">⭐</span>
                  ) : (
                    <span className="text-xs font-semibold text-gray-400">
                      #{idx + 1}
                    </span>
                  )}
                  <p className="text-sm font-semibold text-gray-900">
                    {lens.name}
                  </p>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {lens.description}
                </p>
              </div>
              {/* 점수 표시 */}
              <div className="text-right">
                <p className="text-sm font-bold text-blue-600">
                  {lens.score}
                </p>
                <p className="text-xs text-gray-400">/100</p>
              </div>
            </div>

            {/* 진행바 */}
            <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(2, lens.score)}%` }}
              />
            </div>
          </div>
        ))
      )}

      {/* 하단 안내 */}
      {topLenses.length > 0 && (
        <p className="text-xs text-gray-400 text-center pt-2 border-t border-gray-100">
          상위 4개 심리렌즈 표시 (⭐ 가장 높은 점수)
        </p>
      )}
    </div>
  );
}
