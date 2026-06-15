"use client";

import React from "react";
import { AlertCircle, CheckCircle, Eye } from "lucide-react";

interface ModificationSummaryProps {
  modification: {
    id: string;
    fieldName: string;
    currentValue: string;
    newValue: string;
    reason?: string;
    appliedLenses: string[];
  };
  contractData?: {
    currentPdf?: string; // URL or base64
    amendedPdf?: string; // URL or base64
  };
  onViewPdf?: (type: "current" | "amended") => void;
}

export function ModificationSummary({
  modification,
  contractData,
  onViewPdf,
}: ModificationSummaryProps) {
  const fieldLabels: Record<string, string> = {
    tripDate: "📅 여행 날짜",
    roomType: "🏨 객실 타입",
    roomCategory: "🛏️ 객실 카테고리",
    price: "💰 가격",
    passengerName: "👤 탑승자명",
    passengerCount: "👥 탑승자 수",
    specialRequest: "💬 특별 요청",
    dietaryRestriction: "🍽️ 식이 제한",
    pickupLocation: "📍 픽업 위치",
    returnDate: "🔄 복귀 날짜",
  };

  const fieldEmoji = (field: string): string => {
    const map: Record<string, string> = {
      tripDate: "📅",
      roomType: "🏨",
      roomCategory: "🛏️",
      price: "💰",
      passengerName: "👤",
      passengerCount: "👥",
      specialRequest: "💬",
      dietaryRestriction: "🍽️",
      pickupLocation: "📍",
      returnDate: "🔄",
    };
    return map[field] || "📝";
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* 헤더 */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-900 mb-2">
          ✏️ 변경 사항 확인
        </h3>
        <p className="text-sm text-gray-600">
          다음 항목이 수정되었습니다. 확인 후 재서명해주세요.
        </p>
      </div>

      {/* 변경 사항 카드 */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg mb-6">
        <div className="flex items-start gap-4">
          <span className="text-3xl">{fieldEmoji(modification.fieldName)}</span>
          <div className="flex-1">
            <h4 className="font-bold text-gray-900 mb-3">
              {fieldLabels[modification.fieldName] || modification.fieldName}
            </h4>

            {/* 현재값 → 새값 */}
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-600 mb-1">현재 값:</p>
                <code className="bg-white px-3 py-2 rounded border border-gray-300 block text-sm text-gray-700">
                  {modification.currentValue}
                </code>
              </div>

              {/* 화살표 */}
              <div className="flex justify-center">
                <div className="text-2xl text-blue-600">↓</div>
              </div>

              <div>
                <p className="text-xs text-gray-600 mb-1">새로운 값:</p>
                <code className="bg-green-100 px-3 py-2 rounded border border-green-300 block text-sm font-bold text-green-800">
                  {modification.newValue}
                </code>
              </div>
            </div>

            {/* 변경 이유 */}
            {modification.reason && (
              <div className="mt-4 pt-4 border-t border-blue-200">
                <p className="text-xs text-gray-600 mb-1">변경 이유:</p>
                <p className="text-sm text-gray-700 italic">
                  "{modification.reason}"
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 심리학 렌즈 표시 (Grant Cardone) */}
      {modification.appliedLenses && modification.appliedLenses.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-600 mb-2 uppercase">
            🎯 이 변경의 의미:
          </p>
          <div className="flex flex-wrap gap-2">
            {modification.appliedLenses.map((lens) => {
              const lensDescriptions: Record<string, string> = {
                L2_LOW_COMPLEXITY: "복잡도 낮음 (간단한 변경)",
                L6_LOSS_AVERSION: "신중한 결정 필요",
                L7_COMPANION: "함께 결정하는 순간",
                L10_URGENCY: "시간이 중요합니다",
              };
              return (
                <span
                  key={lens}
                  className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1.5 rounded-full border border-gray-300"
                >
                  {lensDescriptions[lens] || lens}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* PDF 미리보기 (선택사항) */}
      {contractData?.currentPdf && contractData?.amendedPdf && (
        <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <p className="text-xs font-semibold text-gray-600 mb-3 uppercase">
            📄 계약서 비교:
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onViewPdf?.("current")}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
            >
              <Eye className="w-4 h-4" />
              현재 계약서
            </button>
            <button
              onClick={() => onViewPdf?.("amended")}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
            >
              <Eye className="w-4 h-4" />
              수정된 계약서
            </button>
          </div>
        </div>
      )}

      {/* 체크리스트 (확인 단계) */}
      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
        <p className="text-xs font-semibold text-green-700 mb-3 uppercase">
          ✅ 재서명 전 확인:
        </p>
        <ul className="space-y-2">
          <li className="flex items-start gap-2 text-sm text-gray-700">
            <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
            <span>위의 변경 사항이 맞습니다</span>
          </li>
          <li className="flex items-start gap-2 text-sm text-gray-700">
            <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
            <span>다른 변경 사항은 없습니다</span>
          </li>
          <li className="flex items-start gap-2 text-sm text-gray-700">
            <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
            <span>재서명할 준비가 되었습니다</span>
          </li>
        </ul>
      </div>

      {/* 유효기한 경고 */}
      <div className="mt-6 flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
        <p className="text-sm text-yellow-800">
          <strong>⏰ 중요:</strong> 이 재서명 요청은 <strong>7일간 유효</strong>합니다.
          지금 바로 재서명하시기를 권장합니다.
        </p>
      </div>
    </div>
  );
}
