"use client";

/**
 * FunnelWizardModal — 5단계 자동메시지 마법사
 *
 * 구조:
 *   Step 1: 렌즈 선택 (라디오 버튼 × 10, L0-L10)
 *   Step 2: 전략 선택 (카드 × 3, 각 렌즈별 권장 전략)
 *   Step 3: 메시지 편집 (Day 0-3 텍스트 필드, PASONA)
 *   Step 4: 스케줄 선택 (시작일 + 기간 + 시간)
 *   Step 5: 최종 확인 & 저장 (미리보기 + 저장 버튼)
 *
 * UI 규칙 (Steve Jobs 50대 친화):
 *   - 제목: 20px (진검정 #1A1A1A)
 *   - 본문: 16px+ (검정 #333333)
 *   - 라벨: 14px (진회색 #666666)
 *   - 버튼: 48px × 48px (최소)
 *   - 라디오/체크박스: 48px × 48px
 *   - 섹션 간: 24px, 요소 간: 16px
 *   - 렌즈별 색상: L0(보라) L1(황금) L3(파랑) L6(빨강) L10(초록)
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertCircle,
  Loader,
  Eye,
  CalendarIcon,
  Clock,
} from "lucide-react";
import { useToast } from "@/lib/api/use-toast";
import { logger } from "@/lib/logger";
import type {
  PsychologyLens,
  FunnelWizardState,
  DayMessage,
  PasonaStage,
} from "@/types/funnel-wizard";
import { LENS_DETAILS, VARIABLES } from "@/types/funnel-wizard";

// ─────────────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────────────

export interface FunnelWizardModalProps {
  contactId: string;
  contactName: string;
  open: boolean;
  onClose: () => void;
  onSave: (data: FunnelWizardState & { messages?: Record<0 | 1 | 2 | 3, string> }) => Promise<void>;
}

interface StepComponentProps {
  state: FunnelWizardState;
  setState: React.Dispatch<React.SetStateAction<FunnelWizardState>>;
  error: string;
  setError: (msg: string) => void;
}

// ─────────────────────────────────────────────────────────────
// 렌즈별 색상 맵
// ─────────────────────────────────────────────────────────────

const LENS_COLORS: Record<PsychologyLens, { bg: string; border: string; text: string; badge: string }> = {
  L0: { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-900", badge: "bg-purple-100 text-purple-700" },
  L1: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-900", badge: "bg-yellow-100 text-yellow-700" },
  L2: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-900", badge: "bg-orange-100 text-orange-700" },
  L3: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-900", badge: "bg-blue-100 text-blue-700" },
  L4: { bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-900", badge: "bg-indigo-100 text-indigo-700" },
  L5: { bg: "bg-pink-50", border: "border-pink-200", text: "text-pink-900", badge: "bg-pink-100 text-pink-700" },
  L6: { bg: "bg-red-50", border: "border-red-200", text: "text-red-900", badge: "bg-red-100 text-red-700" },
  L7: { bg: "bg-green-50", border: "border-green-200", text: "text-green-900", badge: "bg-green-100 text-green-700" },
  L8: { bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-900", badge: "bg-teal-100 text-teal-700" },
  L9: { bg: "bg-cyan-50", border: "border-cyan-200", text: "text-cyan-900", badge: "bg-cyan-100 text-cyan-700" },
  L10: { bg: "bg-green-50", border: "border-green-200", text: "text-green-900", badge: "bg-green-100 text-green-700" },
};

// ─────────────────────────────────────────────────────────────
// Step 1: 렌즈 선택
// ─────────────────────────────────────────────────────────────

function Step1LensSelection({ state, setState, error }: StepComponentProps) {
  const lensesArray = Object.entries(LENS_DETAILS).map(([key, value]) => ({
    lens: key as PsychologyLens,
    ...value,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Step 1: 고객 심리 유형 선택
        </h2>
        <p className="text-base text-gray-600">
          이 고객이 가장 가까운 심리 상태를 선택하세요.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-base text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {lensesArray.map(({ lens, name, description, strategies }) => {
          const colors = LENS_COLORS[lens];
          const isSelected = state.selectedLens === lens;

          return (
            <label
              key={lens}
              className={`flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                isSelected
                  ? `${colors.bg} ${colors.border} border-2`
                  : "bg-white border-gray-200 hover:border-gray-300"
              }`}
            >
              {/* 라디오 버튼 48px */}
              <input
                type="radio"
                name="lens"
                value={lens}
                checked={isSelected}
                onChange={() => {
                  setState({ ...state, selectedLens: lens, selectedStrategy: undefined });
                }}
                className="w-6 h-6 mt-1 flex-shrink-0 cursor-pointer accent-blue-600"
              />

              {/* 텍스트 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm font-bold px-2 py-1 rounded-full ${colors.badge}`}>
                    {lens}
                  </span>
                  <h3 className="text-base font-semibold text-gray-900">
                    {name}
                  </h3>
                </div>
                <p className="text-sm text-gray-600 mb-2">{description}</p>
                <div className="flex flex-wrap gap-2">
                  {strategies.map((strategy, idx) => (
                    <span
                      key={idx}
                      className={`text-xs px-3 py-1 rounded-full ${colors.badge}`}
                    >
                      {strategy}
                    </span>
                  ))}
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 2: 전략 선택
// ─────────────────────────────────────────────────────────────

function Step2StrategySelection({ state, setState, error }: StepComponentProps) {
  const selectedLens = state.selectedLens;
  if (!selectedLens) return <div>렌즈를 먼저 선택하세요.</div>;

  const lensInfo = LENS_DETAILS[selectedLens];
  const colors = LENS_COLORS[selectedLens];
  const strategies = lensInfo.strategies;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Step 2: 메시지 전략 선택
        </h2>
        <p className="text-base text-gray-600">
          <span className={`font-semibold ${colors.text}`}>{lensInfo.name}</span>
          {" "}고객에게 가장 효과적인 메시지 전략을 선택하세요.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-base text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {strategies.map((strategy, idx) => {
          const isSelected = state.selectedStrategy === strategy;

          return (
            <label
              key={idx}
              className={`flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                isSelected
                  ? `${colors.bg} ${colors.border} border-2`
                  : "bg-white border-gray-200 hover:border-gray-300"
              }`}
            >
              {/* 라디오 버튼 48px */}
              <input
                type="radio"
                name="strategy"
                value={strategy}
                checked={isSelected}
                onChange={() =>
                  setState({ ...state, selectedStrategy: strategy })
                }
                className="w-6 h-6 flex-shrink-0 cursor-pointer accent-blue-600"
              />

              {/* 전략명 */}
              <span className="text-base font-semibold text-gray-900">
                {strategy}
              </span>
            </label>
          );
        })}
      </div>

      {/* 선택한 전략 설명 */}
      {state.selectedStrategy && (
        <div className={`p-4 ${colors.bg} border-2 ${colors.border} rounded-xl`}>
          <p className="text-sm text-gray-700">
            <span className="font-semibold">선택 전략:</span> {state.selectedStrategy}
          </p>
          <p className="text-xs text-gray-600 mt-2">
            이 전략은 Day 0-3 메시지에 자동으로 적용됩니다.
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 3: 메시지 편집
// ─────────────────────────────────────────────────────────────

const PASONA_STAGES: Record<0 | 1 | 2 | 3, { stage: PasonaStage; description: string }> = {
  0: { stage: "PROBLEM", description: "문제 인식 + 자극 (Day 0)" },
  1: { stage: "SOLUTION", description: "해결책 제시 (Day 1)" },
  2: { stage: "OFFER", description: "오퍼 + 한정 제안 (Day 2)" },
  3: { stage: "ACTION", description: "긴박감 + 최종 행동 촉구 (Day 3)" },
};

function Step3MessageEditing({ state, setState, error, setError }: StepComponentProps) {
  const selectedLens = state.selectedLens;
  if (!selectedLens) return <div>렌즈를 먼저 선택하세요.</div>;

  const lensInfo = LENS_DETAILS[selectedLens];
  const colors = LENS_COLORS[selectedLens];

  const handleMessageChange = (day: 0 | 1 | 2 | 3, content: string) => {
    const customMessages: Record<0 | 1 | 2 | 3, string> = (state.customMessages || {}) as any;
    setState({
      ...state,
      customMessages: { ...customMessages, [day]: content },
    });
    setError("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Step 3: 메시지 편집
        </h2>
        <p className="text-base text-gray-600">
          Day 0-3 메시지를 편집하세요. PASONA 프레임워크가 자동 적용됩니다.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-base text-red-700">{error}</p>
        </div>
      )}

      {/* 사용 가능한 변수 */}
      <div className={`p-4 ${colors.bg} border-2 ${colors.border} rounded-xl`}>
        <h4 className="text-sm font-semibold text-gray-900 mb-2">
          💡 사용 가능한 변수 (자동 치환됨)
        </h4>
        <div className="flex flex-wrap gap-2">
          {Object.entries(VARIABLES).map(([key, value]) => (
            <code
              key={key}
              className="text-xs px-2.5 py-1.5 bg-white border border-gray-200 rounded font-mono text-gray-700"
            >
              {value}
            </code>
          ))}
        </div>
      </div>

      {/* Day 0-3 메시지 편집 */}
      <div className="space-y-4">
        {(Object.entries(PASONA_STAGES) as Array<[string, any]>).map(
          ([day, { description }]) => {
            const dayNum = parseInt(day) as 0 | 1 | 2 | 3;
            const content = state.customMessages?.[dayNum] || "";

            return (
              <div key={dayNum} className="space-y-2">
                <label className="block text-sm font-semibold text-gray-900">
                  {description}
                </label>
                <textarea
                  value={content}
                  onChange={(e) => handleMessageChange(dayNum, e.target.value)}
                  placeholder={`Day ${dayNum} 메시지를 입력하세요...`}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500">
                  {content.length} / 1000 자
                </p>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 4: 스케줄 선택
// ─────────────────────────────────────────────────────────────

function Step4ScheduleSelection({ state, setState, error, setError }: StepComponentProps) {
  const defaultSchedule = {
    startDate: new Date().toISOString().split("T")[0],
    duration: 3 as const,
    hour: 12 as const,
  };
  const schedule = state.schedule || defaultSchedule;

  const handleScheduleChange = (field: string, value: any) => {
    const newSchedule = { ...schedule, [field]: value };
    setState({ ...state, schedule: newSchedule as any });
    setError("");
  };

  const safeStartDate = (schedule as any).startDate || defaultSchedule.startDate;
  const safeDuration = (schedule as any).duration || defaultSchedule.duration;
  const safeHour = (schedule as any).hour || defaultSchedule.hour;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Step 4: 발송 스케줄
        </h2>
        <p className="text-base text-gray-600">
          메시지 발송 일정을 설정하세요.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-base text-red-700">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {/* 시작 날짜 */}
        <div className="space-y-2">
          <label className="block text-base font-semibold text-gray-900">
            <CalendarIcon className="w-4 h-4 inline mr-2" />
            시작 날짜
          </label>
          <input
            type="date"
            value={safeStartDate}
            onChange={(e) => handleScheduleChange("startDate", e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 기간 (3 / 7 / 14일) */}
        <div className="space-y-2">
          <label className="block text-base font-semibold text-gray-900">
            메시지 발송 기간
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[3, 7, 14].map((duration) => (
              <button
                key={duration}
                onClick={() => handleScheduleChange("duration", duration)}
                className={`px-4 py-3 rounded-xl font-semibold text-base transition-all ${
                  safeDuration === duration
                    ? "bg-blue-600 text-white border-2 border-blue-600"
                    : "bg-white text-gray-900 border-2 border-gray-200 hover:border-blue-300"
                }`}
              >
                {duration}일
              </button>
            ))}
          </div>
          <p className="text-sm text-gray-600">
            Day 0부터 Day {Math.min(safeDuration - 1, 3)}까지 자동 발송
          </p>
        </div>

        {/* 발송 시간 */}
        <div className="space-y-2">
          <label className="block text-base font-semibold text-gray-900">
            <Clock className="w-4 h-4 inline mr-2" />
            매일 발송 시간
          </label>
          <select
            value={safeHour}
            onChange={(e) => handleScheduleChange("hour", parseInt(e.target.value))}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={8}>08:00 (아침)</option>
            <option value={10}>10:00</option>
            <option value={12}>12:00 (정오)</option>
            <option value={14}>14:00</option>
            <option value={16}>16:00</option>
            <option value={18}>18:00 (저녁)</option>
            <option value={20}>20:00</option>
          </select>
        </div>
      </div>

      {/* 일정 미리보기 */}
      <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">
          예상 발송 일정:
        </h4>
        <div className="space-y-2 text-sm text-gray-700">
          {[0, 1, 2, 3].map((day) => {
            if (day > safeDuration - 1) return null;
            const sendDate = new Date(safeStartDate);
            sendDate.setDate(sendDate.getDate() + day);
            const dayName = ["월", "화", "수", "목", "금", "토", "일"];
            const dayOfWeek = dayName[sendDate.getDay()];

            return (
              <div key={day} className="flex items-center gap-2">
                <span className="font-semibold">Day {day}:</span>
                <span>
                  {sendDate.toLocaleDateString("ko-KR")} ({dayOfWeek})
                  {" "}
                  {String(safeHour).padStart(2, "0")}:00
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 5: 최종 확인
// ─────────────────────────────────────────────────────────────

function Step5FinalConfirm({ state }: StepComponentProps) {
  const selectedLens = state.selectedLens;
  if (!selectedLens) return <div>데이터를 확인할 수 없습니다.</div>;

  const lensInfo = LENS_DETAILS[selectedLens];
  const colors = LENS_COLORS[selectedLens];
  const defaultSchedule = {
    startDate: new Date().toISOString().split("T")[0],
    duration: 3 as const,
    hour: 12 as const,
  };
  const schedule = state.schedule || defaultSchedule;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Step 5: 최종 확인
        </h2>
        <p className="text-base text-gray-600">
          설정한 내용을 확인하고 저장하세요.
        </p>
      </div>

      {/* 요약 카드들 */}
      <div className="grid grid-cols-1 gap-4">
        {/* 렌즈 */}
        <div className={`p-4 ${colors.bg} border-2 ${colors.border} rounded-xl`}>
          <h4 className="text-sm font-semibold text-gray-600 mb-1">심리 유형</h4>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold px-3 py-1 rounded-full ${colors.badge}`}>
              {selectedLens}
            </span>
            <span className="text-base font-semibold text-gray-900">
              {lensInfo.name}
            </span>
          </div>
        </div>

        {/* 전략 */}
        {state.selectedStrategy && (
          <div className={`p-4 ${colors.bg} border-2 ${colors.border} rounded-xl`}>
            <h4 className="text-sm font-semibold text-gray-600 mb-1">메시지 전략</h4>
            <p className="text-base font-semibold text-gray-900">
              {state.selectedStrategy}
            </p>
          </div>
        )}

        {/* 스케줄 */}
        <div className={`p-4 ${colors.bg} border-2 ${colors.border} rounded-xl`}>
          <h4 className="text-sm font-semibold text-gray-600 mb-2">발송 스케줄</h4>
          <div className="space-y-1 text-sm text-gray-900">
            <div>
              <span className="font-semibold">시작:</span> {(schedule as any).startDate || defaultSchedule.startDate}
            </div>
            <div>
              <span className="font-semibold">기간:</span> {(schedule as any).duration || defaultSchedule.duration}일
            </div>
            <div>
              <span className="font-semibold">시간:</span> 매일{" "}
              {String((schedule as any).hour || defaultSchedule.hour).padStart(2, "0")}:00
            </div>
          </div>
        </div>

        {/* 메시지 미리보기 */}
        <div className={`p-4 ${colors.bg} border-2 ${colors.border} rounded-xl space-y-3`}>
          <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Eye className="w-4 h-4" />
            메시지 미리보기
          </h4>
          <div className="space-y-2">
            {[0, 1, 2, 3].map((day) => {
              const content = state.customMessages?.[day as 0 | 1 | 2 | 3];
              if (!content && day > (state.schedule?.duration || 3) - 1) return null;

              return (
                <div
                  key={day}
                  className="p-3 bg-white border border-gray-200 rounded-lg"
                >
                  <div className="text-xs font-semibold text-gray-600 mb-1">
                    Day {day}
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-2 whitespace-pre-wrap">
                    {content || "(메시지 미입력)"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 체크리스트 */}
      <div className="p-4 bg-green-50 border-2 border-green-200 rounded-xl">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">
          ✓ 저장 전 확인
        </h4>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            심리 유형 선택됨
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            메시지 전략 선택됨
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            Day 0-3 메시지 입력됨
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            발송 스케줄 설정됨
          </li>
        </ul>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 진행 바
// ─────────────────────────────────────────────────────────────

function ProgressBar({ currentStep }: { currentStep: number }) {
  const steps = [
    { number: 1, label: "렌즈 선택" },
    { number: 2, label: "전략 선택" },
    { number: 3, label: "메시지 편집" },
    { number: 4, label: "스케줄" },
    { number: 5, label: "최종 확인" },
  ];

  return (
    <div className="px-6 py-6 border-b border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between mb-4">
        {steps.map((step, idx) => (
          <div
            key={step.number}
            className="flex flex-col items-center"
            style={{ flex: 1 }}
          >
            {/* 원형 버튼 */}
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                step.number <= currentStep
                  ? "bg-blue-600 text-white"
                  : "bg-gray-300 text-gray-600"
              }`}
            >
              {step.number <= currentStep ? <Check className="w-5 h-5" /> : step.number}
            </div>

            {/* 라벨 */}
            <p className="text-xs text-gray-600 mt-2 text-center whitespace-nowrap">
              {step.label}
            </p>

            {/* 연결선 */}
            {idx < steps.length - 1 && (
              <div
                className={`absolute h-1 transition-all ${
                  step.number < currentStep ? "bg-blue-600" : "bg-gray-300"
                }`}
                style={{
                  width: "100%",
                  top: "25px",
                  left: `calc(50% + 20px)`,
                  zIndex: -1,
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 메인 모달
// ─────────────────────────────────────────────────────────────

export default function FunnelWizardModal({
  contactId,
  contactName,
  open,
  onClose,
  onSave,
}: FunnelWizardModalProps) {
  const { toast } = useToast();

  const [state, setState] = useState<FunnelWizardState>({
    step: 1,
  });

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // 유효성 검사
  const canProceedToNext = useCallback(() => {
    switch (state.step) {
      case 1:
        if (!state.selectedLens) {
          setError("심리 유형을 선택하세요.");
          return false;
        }
        break;
      case 2:
        if (!state.selectedStrategy) {
          setError("메시지 전략을 선택하세요.");
          return false;
        }
        break;
      case 3:
        // 최소 1개의 메시지는 필수
        const hasMessage =
          Object.values(state.customMessages || {}).some((m) => m?.trim());
        if (!hasMessage) {
          setError("최소 1개의 메시지를 입력하세요.");
          return false;
        }
        break;
      case 4:
        if (!state.schedule?.startDate) {
          setError("시작 날짜를 선택하세요.");
          return false;
        }
        break;
    }
    return true;
  }, [state]);

  const handleNext = () => {
    if (canProceedToNext()) {
      setError("");
      setState({ ...state, step: (state.step + 1) as any });
    }
  };

  const handlePrev = () => {
    setError("");
    setState({ ...state, step: (state.step - 1) as any });
  };

  const handleSave = async () => {
    if (!canProceedToNext()) return;

    setSaving(true);
    try {
      await onSave(state);
      toast({
        title: "성공",
        description: "자동 메시지가 등록되었습니다!",
      });
      onClose();
    } catch (err) {
      logger.error("Funnel wizard save error:", err);
      setError(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  };

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.2 } },
    exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.15 } },
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <motion.div
          className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col overflow-hidden"
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                자동 메시지 마법사
              </h1>
              <p className="text-sm text-gray-600 mt-0.5">
                고객: {contactName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-600" />
            </button>
          </div>

          {/* 진행 바 */}
          <ProgressBar currentStep={state.step} />

          {/* 콘텐츠 */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {state.step === 1 && (
              <Step1LensSelection state={state} setState={setState} error={error} setError={setError} />
            )}
            {state.step === 2 && (
              <Step2StrategySelection state={state} setState={setState} error={error} setError={setError} />
            )}
            {state.step === 3 && (
              <Step3MessageEditing state={state} setState={setState} error={error} setError={setError} />
            )}
            {state.step === 4 && (
              <Step4ScheduleSelection state={state} setState={setState} error={error} setError={setError} />
            )}
            {state.step === 5 && (
              <Step5FinalConfirm state={state} setState={setState} error={error} setError={setError} />
            )}
          </div>

          {/* 바닥 버튼 */}
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-3 bg-gray-50">
            <button
              onClick={handlePrev}
              disabled={state.step === 1}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-base text-gray-900 bg-white border-2 border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
              이전
            </button>

            {state.step < 5 ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 ml-auto px-6 py-3 rounded-xl font-semibold text-base text-white bg-blue-600 hover:bg-blue-700 transition-all"
              >
                다음
                <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 ml-auto px-6 py-3 rounded-xl font-semibold text-base text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-all"
              >
                {saving ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    저장 및 시작
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
