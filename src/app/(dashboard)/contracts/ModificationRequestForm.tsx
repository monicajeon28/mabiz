"use client";

import React, { useState } from "react";
import { ChevronDown, Send, AlertCircle, Loader } from "lucide-react";
import { SPIN_QUESTIONS } from "@/lib/types/contract-modification";

interface ModificationRequestFormProps {
  contractId: string;
  onSubmit: (data: {
    fieldName: string;
    newValue: string;
    reason?: string;
  }) => Promise<void>;
  onCancel: () => void;
}

interface FieldOption {
  value: string;
  label: string;
  emoji: string;
  placeholder: string;
  type: "text" | "date" | "email" | "number";
}

const FIELD_OPTIONS: FieldOption[] = [
  {
    value: "tripDate",
    label: "여행 날짜",
    emoji: "📅",
    placeholder: "YYYY-MM-DD",
    type: "date",
  },
  {
    value: "roomType",
    label: "객실 타입",
    emoji: "🏨",
    placeholder: "예: 발코니 스위트",
    type: "text",
  },
  {
    value: "roomCategory",
    label: "객실 카테고리",
    emoji: "🛏️",
    placeholder: "예: Suite, Interior",
    type: "text",
  },
  {
    value: "price",
    label: "가격",
    emoji: "💰",
    placeholder: "예: 3,500,000",
    type: "number",
  },
  {
    value: "passengerName",
    label: "탑승자명",
    emoji: "👤",
    placeholder: "성명을 입력하세요",
    type: "text",
  },
  {
    value: "passengerCount",
    label: "탑승자 수",
    emoji: "👥",
    placeholder: "예: 2",
    type: "number",
  },
  {
    value: "specialRequest",
    label: "특별 요청",
    emoji: "💬",
    placeholder: "예: 조용한 객실 요청",
    type: "text",
  },
  {
    value: "dietaryRestriction",
    label: "식이 제한",
    emoji: "🍽️",
    placeholder: "예: 채식주의자",
    type: "text",
  },
  {
    value: "pickupLocation",
    label: "픽업 위치",
    emoji: "📍",
    placeholder: "예: 인천공항",
    type: "text",
  },
  {
    value: "returnDate",
    label: "복귀 날짜",
    emoji: "🔄",
    placeholder: "YYYY-MM-DD",
    type: "date",
  },
];

export function ModificationRequestForm({
  contractId,
  onSubmit,
  onCancel,
}: ModificationRequestFormProps) {
  const [selectedField, setSelectedField] = useState<string>("");
  const [newValue, setNewValue] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  const selectedOption = FIELD_OPTIONS.find((opt) => opt.value === selectedField);

  // SPIN 질문 제시 (무작위 선택)
  const getSampleSpinQuestion = () => {
    if (!selectedField) return "";

    if (selectedField.includes("price")) {
      const questions = SPIN_QUESTIONS.problem;
      return questions[Math.floor(Math.random() * questions.length)];
    } else if (selectedField.includes("Date")) {
      const questions = SPIN_QUESTIONS.situation;
      return questions[Math.floor(Math.random() * questions.length)];
    } else {
      const questions = SPIN_QUESTIONS.need;
      return questions[Math.floor(Math.random() * questions.length)];
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedField || !newValue.trim()) {
      setError("필드와 새 값을 입력해주세요");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        fieldName: selectedField,
        newValue: newValue.trim(),
        reason: reason.trim() || undefined,
      });
      // Reset form on success
      setSelectedField("");
      setNewValue("");
      setReason("");
    } catch (err: any) {
      setError(err.message || "요청 생성 실패. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <h3 className="text-lg font-bold mb-1">📝 계약서 수정 요청</h3>
      <p className="text-sm text-gray-600 mb-4">
        계약서 내용을 수정해야 하는 경우, 아래 양식을 작성해주세요.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 필드 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            수정하고 싶은 항목 <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <select
              value={selectedField}
              onChange={(e) => {
                setSelectedField(e.target.value);
                setNewValue("");
                setReason("");
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white cursor-pointer"
            >
              <option value="">선택하세요</option>
              {FIELD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.emoji} {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* 새 값 입력 */}
        {selectedField && selectedOption && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              새로운 값 <span className="text-red-500">*</span>
            </label>
            <input
              type={selectedOption.type}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder={selectedOption.placeholder}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {getSampleSpinQuestion() && (
              <p className="text-xs text-blue-600 mt-2 italic leading-relaxed">
                💡 <span className="font-medium">생각해볼 점:</span> {getSampleSpinQuestion()}
              </p>
            )}
          </div>
        )}

        {/* 수정 이유 (선택사항) */}
        {selectedField && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              수정 이유 <span className="text-gray-400 text-xs">(선택사항)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.substring(0, 200))}
              placeholder="왜 이 항목을 수정하고 싶으신가요? (최대 200자)"
              maxLength={200}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={2}
            />
            <p className="text-xs text-gray-500 mt-1.5">
              {reason.length}/200자
            </p>
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* 유효기한 안내 */}
        {selectedField && (
          <div className="flex items-start gap-3 p-3.5 bg-blue-50 border border-blue-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700">
              📋 이 요청은 <strong>7일간</strong> 유효합니다. 관리자 검토 후 승인/거절/대안이 제시됩니다.
            </p>
          </div>
        )}

        {/* 버튼 */}
        <div className="flex gap-3 pt-4 border-t border-gray-100">
          <button
            type="submit"
            disabled={isSubmitting || !selectedField || !newValue}
            className={`flex-1 px-4 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
              isSubmitting || !selectedField || !newValue
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700 active:scale-95"
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                제출 중...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                수정 요청 제출
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
          >
            취소
          </button>
        </div>

        {/* 도움말 */}
        <p className="text-xs text-gray-500 text-center mt-4">
          💬 문제가 있으신가요?{" "}
          <a href="#contact-support" className="text-blue-600 hover:underline">
            고객 지원팀에 문의하세요
          </a>
        </p>
      </form>
    </div>
  );
}
