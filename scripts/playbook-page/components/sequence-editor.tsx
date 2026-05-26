"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Save, X } from "lucide-react";
import { showError, showSuccess } from "@/components/ui/Toast";
import useSWR from "swr";
import { SequenceDetails, DayDetail, PsychologyLens, SequenceStatus } from "@/lib/types/sequence";

interface SequenceEditorProps {
  sequenceId: string | null;
  onBack: () => void;
  onSaved?: () => void;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const PSYCHOLOGY_LENSES: { value: PsychologyLens; label: string }[] = [
  { value: "L0", label: "L0 - 부재중 복원 (손실회피)" },
  { value: "L1", label: "L1 - 가격 이의 (가치 재정의)" },
  { value: "L2", label: "L2 - 준비 복잡 (불안 해소)" },
  { value: "L3", label: "L3 - 차별성 (경쟁사 구분)" },
  { value: "L4", label: "L4 - 피처 구조 (복합 설명)" },
  { value: "L5", label: "L5 - 자기투영 (의료/건강)" },
  { value: "L6", label: "L6 - 타이밍 (시간 부족)" },
  { value: "L7", label: "L7 - 동반자 설득 (배우자)" },
  { value: "L8", label: "L8 - 재구매 (습관화)" },
  { value: "L9", label: "L9 - 건강/신뢰 (의료)" },
  { value: "L10", label: "L10 - 즉시 구매 (클로징)" },
];

const PASONA_STAGES = [
  { stage: "P", label: "문제 + 긴급도", description: "Day 0" },
  { stage: "S", label: "해결책", description: "Day 1" },
  { stage: "O", label: "오퍼", description: "Day 2" },
  { stage: "N", label: "행동 촉구", description: "Day 3" },
];

interface DayForm extends DayDetail {
  isExpanded: boolean;
  unsavedChanges: boolean;
}

export function SequenceEditor({ sequenceId, onBack, onSaved }: SequenceEditorProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    productCode: "",
    psychologyLens: "L0" as PsychologyLens,
    status: "DRAFT" as SequenceStatus,
    day0Delay: 0,
    day1Delay: 1440,
    day2Delay: 2880,
    day3Delay: 4320,
  });

  const [days, setDays] = useState<DayForm[]>([
    { day: 0, delay: 0, message: "", psychology: "", lens: "", framework: "PASONA P+A", expectedOpenRate: "28-35%", expectedClickRate: "8-12%", variants: [], isExpanded: true, unsavedChanges: false },
    { day: 1, delay: 1440, message: "", psychology: "", lens: "", framework: "PASONA S", expectedOpenRate: "18-22%", expectedClickRate: "6-10%", variants: [], isExpanded: false, unsavedChanges: false },
    { day: 2, delay: 2880, message: "", psychology: "", lens: "", framework: "PASONA O", expectedOpenRate: "12-15%", expectedClickRate: "3-8%", variants: [], isExpanded: false, unsavedChanges: false },
    { day: 3, delay: 4320, message: "", psychology: "", lens: "", framework: "PASONA N", expectedOpenRate: "8-12%", expectedClickRate: "2-5%", variants: [], isExpanded: false, unsavedChanges: false },
  ]);

  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { data, isLoading } = useSWR(sequenceId ? `/api/tools/day0-3-sequences/${sequenceId}` : null, fetcher);

  // Load sequence data
  useEffect(() => {
    if (data?.sequence) {
      const seq = data.sequence;
      setFormData({
        name: seq.name || "",
        description: seq.description || "",
        productCode: seq.productCode || "",
        psychologyLens: seq.psychologyLens || "L0",
        status: seq.status || "DRAFT",
        day0Delay: seq.day0Delay || 0,
        day1Delay: seq.day1Delay || 1440,
        day2Delay: seq.day2Delay || 2880,
        day3Delay: seq.day3Delay || 4320,
      });

      if (seq.days && seq.days.length > 0) {
        setDays(
          seq.days.map((d: DayDetail, idx: number) => ({
            ...d,
            isExpanded: idx === 0,
            unsavedChanges: false,
          }))
        );
      }
    }
  }, [data]);

  const handleFormChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const handleDayChange = (dayIndex: number, field: string, value: any) => {
    setDays((prev) =>
      prev.map((d, idx) =>
        idx === dayIndex
          ? { ...d, [field]: value, unsavedChanges: true }
          : d
      )
    );
    setHasUnsavedChanges(true);
  };

  const toggleDayExpanded = (dayIndex: number) => {
    setDays((prev) =>
      prev.map((d, idx) =>
        idx === dayIndex ? { ...d, isExpanded: !d.isExpanded } : d
      )
    );
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showError("시퀀스 이름을 입력하세요.");
      return;
    }

    if (days.some((d) => !d.message.trim())) {
      showError("모든 Day의 메시지를 입력하세요.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        day0Delay: formData.day0Delay,
        day1Delay: formData.day1Delay,
        day2Delay: formData.day2Delay,
        day3Delay: formData.day3Delay,
        days: days.map((d) => ({
          day: d.day,
          delay: d.delay,
          message: d.message,
          psychology: d.psychology,
          lensName: d.lens,
          variants: d.variants || [],
        })),
      };

      const method = sequenceId ? "PUT" : "POST";
      const url = sequenceId
        ? `/api/tools/day0-3-sequences/${sequenceId}`
        : "/api/tools/day0-3-sequences";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to save sequence");

      showSuccess(sequenceId ? "시퀀스가 저장되었습니다." : "시퀀스가 생성되었습니다.");
      setHasUnsavedChanges(false);
      onSaved?.();
    } catch (err) {
      showError("시퀀스 저장 실패");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />;
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {sequenceId ? "시퀀스 편집" : "새 시퀀스 만들기"}
        </h2>
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="닫기"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Basic Info */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">기본 정보</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            시퀀스 이름 *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleFormChange("name", e.target.value)}
            placeholder="예: 신규 고객 Day 0-3 자동화"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            설명
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleFormChange("description", e.target.value)}
            placeholder="이 시퀀스의 목표와 대상을 설명하세요."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              상품 코드
            </label>
            <input
              type="text"
              value={formData.productCode}
              onChange={(e) => handleFormChange("productCode", e.target.value)}
              placeholder="예: NEARBY, ALASKA"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              심리학 렌즈
            </label>
            <select
              value={formData.psychologyLens}
              onChange={(e) =>
                handleFormChange("psychologyLens", e.target.value as PsychologyLens)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PSYCHOLOGY_LENSES.map((lens) => (
                <option key={lens.value} value={lens.value}>
                  {lens.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Day Configurations */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900">Day 0-3 메시지 설정</h3>

        {days.map((dayData, dayIndex) => (
          <div key={dayData.day} className="border border-gray-200 rounded-xl overflow-hidden">
            {/* Day Header */}
            <button
              onClick={() => toggleDayExpanded(dayIndex)}
              className="w-full px-6 py-4 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 flex items-center justify-between transition-colors"
              aria-expanded={dayData.isExpanded}
            >
              <div className="text-left">
                <div className="font-semibold text-gray-900">
                  Day {dayData.day} - {PASONA_STAGES[dayData.day].label}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {PASONA_STAGES[dayData.day].description}
                </div>
              </div>
              {dayData.isExpanded ? (
                <ChevronUp className="w-5 h-5 text-gray-600" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-600" />
              )}
            </button>

            {/* Day Content */}
            {dayData.isExpanded && (
              <div className="px-6 py-4 bg-white space-y-4 border-t border-gray-200">
                {/* Delay */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    발송 지연시간: {dayData.delay} 분 ({Math.round(dayData.delay / 60)} 시간)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="4320"
                    step="60"
                    value={dayData.delay}
                    onChange={(e) =>
                      handleDayChange(dayIndex, "delay", parseInt(e.target.value))
                    }
                    className="w-full"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    0 ~ 72시간 (4320분)
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    메시지 내용 *
                  </label>
                  <textarea
                    value={dayData.message}
                    onChange={(e) =>
                      handleDayChange(dayIndex, "message", e.target.value)
                    }
                    placeholder="Day 0-3 메시지를 입력하세요. 변수: {name}, {phone}, {product}"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {dayData.message.length} / 150 글자
                  </div>
                </div>

                {/* Framework Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-sm font-medium text-blue-900">
                    {dayData.framework}
                  </div>
                  <div className="text-xs text-blue-700 mt-1">
                    예상 오픈율: {dayData.expectedOpenRate} | 클릭율: {dayData.expectedClickRate}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Unsaved Warning */}
      {hasUnsavedChanges && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-900">저장하지 않은 변경사항이 있습니다.</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 sticky bottom-0 bg-white py-4 border-t border-gray-200">
        <button
          onClick={onBack}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
        >
          취소
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || !hasUnsavedChanges}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {isSaving ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}
