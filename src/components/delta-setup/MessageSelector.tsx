'use client';

import { useEffect } from 'react';

/**
 * Delta SMS MessageSelector Component
 *
 * Step 2: 메시지 내용 선택 및 수정
 * 기본값 사용 또는 직접 입력 중 선택
 */

interface MessageSelectorProps {
  triggerType: 'PURCHASE' | 'ABANDONED';
  useDefault: boolean;
  onToggleDefault: (value: boolean) => void;
  messages: {
    day0: string;
    day1: string;
    day2: string;
    day3: string;
  };
  onMessageChange: (day: 'day0' | 'day1' | 'day2' | 'day3', content: string) => void;
  defaultMessages: {
    day0: string;
    day1: string;
    day2: string;
    day3: string;
  };
}

/**
 * 메시지 입력 필드 컴포넌트
 */
function MessageInput({
  day,
  label,
  description,
  value,
  maxLength,
  onChange,
  disabled,
  required,
}: {
  day: 'day0' | 'day1' | 'day2' | 'day3';
  label: string;
  description: string;
  value: string;
  maxLength: number;
  onChange: (content: string) => void;
  disabled: boolean;
  required: boolean;
}) {
  const length = value.length;
  const percent = Math.min((length / maxLength) * 100, 100);

  return (
    <div className="space-y-2">
      <label className="block">
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium text-gray-900">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </span>
          <span className="text-xs text-gray-600">
            {length}/{maxLength}자
          </span>
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
          placeholder={description}
          maxLength={maxLength}
          disabled={disabled}
          rows={3}
          className={`w-full px-3 py-2 border rounded-lg text-sm ${
            disabled
              ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-white border-gray-300 text-gray-900 hover:border-blue-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
          }`}
        />
      </label>

      {/* 프로그레스 바 */}
      <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
        <div
          className={`h-full transition-all ${
            length <= maxLength * 0.8
              ? 'bg-green-500'
              : length <= maxLength * 0.95
              ? 'bg-amber-500'
              : 'bg-red-500'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export default function MessageSelector({
  triggerType,
  useDefault,
  onToggleDefault,
  messages,
  onMessageChange,
  defaultMessages,
}: MessageSelectorProps) {
  const dayConfigs = [
    {
      day: 'day0' as const,
      label: '📲 Day 0: 구매 직후',
      description: '구매 당일 오전 - 불안감 해소 + 문제인식',
      maxLength: 90,
      required: true,
    },
    {
      day: 'day1' as const,
      label: '📤 Day 1: +1일',
      description: '구매 다음날 - 사회적 증거 + 구체적 수치',
      maxLength: 160,
      required: true,
    },
    {
      day: 'day2' as const,
      label: '⏰ Day 2: +2일',
      description: '구매 3일 후 - 긴급성 + 희소성 + 보상',
      maxLength: 160,
      required: true,
    },
    {
      day: 'day3' as const,
      label: '🚨 Day 3: +3일',
      description: '구매 4일 후 - 최종 긴급성 + 손실회피',
      maxLength: 160,
      required: true,
    },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      {/* 헤더 */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          Step 2: 메시지 설정
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          메시지를 어떻게 설정할까요? 4개 메시지 모두 필수입니다.
        </p>
      </div>

      {/* 모드 선택 */}
      <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            checked={useDefault}
            onChange={() => onToggleDefault(true)}
            className="w-4 h-4 mt-1"
          />
          <div>
            <h3 className="font-medium text-gray-900">기본값 사용 (추천)</h3>
            <p className="text-sm text-gray-600 mt-0.5">
              심리학 기반으로 최적화된 메시지를 사용합니다. (변경 불가)
            </p>
          </div>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            checked={!useDefault}
            onChange={() => onToggleDefault(false)}
            className="w-4 h-4 mt-1"
          />
          <div>
            <h3 className="font-medium text-gray-900">직접 입력</h3>
            <p className="text-sm text-gray-600 mt-0.5">
              내 브랜드에 맞게 메시지를 커스터마이징합니다.
            </p>
          </div>
        </label>
      </div>

      {/* 메시지 입력 */}
      <div className="space-y-4">
        {dayConfigs.map((config) => (
          <MessageInput
            key={config.day}
            {...config}
            value={useDefault ? defaultMessages[config.day] : messages[config.day]}
            onChange={(content) => onMessageChange(config.day, content)}
            disabled={useDefault}
          />
        ))}
      </div>

      {/* 안내 메시지 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 mb-2">💡 메시지 선택 팁</h3>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>✓ <strong>Day 0-2</strong>: 심리학 기반 표준 메시지 (클릭율 45-60%)</li>
          <li>✓ <strong>Day 3</strong>: 마지막 기회 강조로 전환율 33% 향상</li>
          <li>⚠ <strong>90자 초과</strong>: LMS 요금이 추가될 수 있습니다</li>
        </ul>
      </div>
    </div>
  );
}
