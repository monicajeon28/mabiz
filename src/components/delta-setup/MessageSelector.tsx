'use client';

import React, { useState, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { MESSAGE_INPUT_CONFIG } from '@/constants/delta';
import { getMessageStatus, getMessagePercent } from '@/utils/delta-helpers';

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
 * WHY: React.memo로 래핑하여 부모 리렌더링 시 불필요한 리렌더 방지 (P1 14)
 */
const MessageInput = React.memo(({
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
}) => {
  const length = value.length;
  // WHY: helper 함수로 추상화하여 로직 재사용 및 테스트 용이
  const status = getMessageStatus(length, maxLength);
  const percent = Math.min((length / maxLength) * 100, 100);
  const inputId = `message-input-${day}`;
  const descriptionId = `message-description-${day}`;

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block">
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium text-gray-900">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </span>
          <span className="text-sm text-gray-600">
            {length}/{maxLength}자
          </span>
        </div>
      </label>
      <p id={descriptionId} className="text-sm text-gray-600 mb-2">
        {description}
      </p>
      <textarea
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        placeholder={description}
        maxLength={maxLength}
        disabled={disabled}
        rows={3}
        aria-label={`${label} 입력 필드, 최대 ${maxLength}자`}
        aria-describedby={descriptionId}
        className={`w-full px-3 py-2 border rounded-lg text-sm ${
          disabled
            ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed'
            : 'bg-white border-gray-300 text-gray-900 hover:border-blue-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
        }`}
      />

      {/* 프로그레스 바 with smooth color transition (P1 4) */}
      <div
        className="h-2 rounded-full bg-gray-200 overflow-hidden"
        role="progressbar"
        aria-valuenow={length}
        aria-valuemin={0}
        aria-valuemax={maxLength}
        aria-label={`${label} 메시지 길이: ${length}/${maxLength}자`}
      >
        <motion.div
          className={`h-full transition-all duration-300 ${
            length <= maxLength * 0.8
              ? 'bg-green-500'
              : length <= maxLength * 0.95
              ? 'bg-amber-500'
              : 'bg-red-500'
          }`}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
  );
});

MessageInput.displayName = 'MessageInput';

export default function MessageSelector({
  triggerType,
  useDefault,
  onToggleDefault,
  messages,
  onMessageChange,
  defaultMessages,
}: MessageSelectorProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // WHY: 사용자가 입력한 데이터가 있으면 기본값 전환 시 확인 다이얼로그 표시
  // 사용자가 실수로 입력한 메시지를 잃지 않도록 보호
  const hasUserInput = Object.values(messages).some((msg) => msg.trim().length > 0);

  const handleToggleDefault = (newValue: boolean) => {
    // 기본값에서 직접입력으로 전환할 때만 확인
    if (newValue === false && !useDefault && hasUserInput) {
      // 이미 직접입력 모드이고 데이터가 있으면 전환 필요 없음
      return;
    }

    // 직접입력에서 기본값으로 전환하려고 하는데 입력된 메시지가 있을 때
    if (newValue === true && !useDefault && hasUserInput) {
      setShowConfirm(true);
      // 다음 렌더링 후 포커스 이동
      setTimeout(() => confirmButtonRef.current?.focus(), 0);
    } else {
      onToggleDefault(newValue);
    }
  };

  const handleConfirm = () => {
    onToggleDefault(true);
    setShowConfirm(false);
  };


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
            onChange={() => handleToggleDefault(true)}
            className="w-4 h-4 mt-1"
            aria-label="기본값 사용 (추천): 심리학 기반 최적화된 메시지"
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
            onChange={() => handleToggleDefault(false)}
            className="w-4 h-4 mt-1"
            aria-label="직접 입력: 브랜드에 맞게 메시지 커스터마이징"
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
      <div className={`space-y-4 transition-opacity duration-300 ${useDefault ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
        {MESSAGE_INPUT_CONFIG.map((config) => (
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
        <ul className="text-sm text-blue-800 space-y-1">
          <li>✓ <strong>Day 0-2</strong>: 심리학 기반 표준 메시지 (클릭율 45-60%)</li>
          <li>✓ <strong>Day 3</strong>: 마지막 기회 강조로 전환율 33% 향상</li>
          <li>⚠ <strong>90자 초과</strong>: LMS 요금이 추가될 수 있습니다</li>
        </ul>
      </div>

      {/* 확인 다이얼로그 */}
      <Dialog.Root open={showConfirm} onOpenChange={setShowConfirm}>
        <Dialog.Portal>
          <Dialog.Overlay
            className="fixed inset-0 bg-black/50 z-40"
            aria-hidden="true"
          />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg p-6 w-96 z-50 max-w-[90vw]"
            aria-labelledby="dialog-title"
            aria-describedby="dialog-description"
          >
            <div className="flex items-start justify-between mb-4">
              <Dialog.Title
                id="dialog-title"
                className="text-lg font-semibold text-gray-900"
              >
                ⚠️ 메시지 손실 경고
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                  aria-label="대화 창 닫기"
                >
                  <X size={20} />
                </button>
              </Dialog.Close>
            </div>

            <Dialog.Description
              id="dialog-description"
              className="text-sm text-gray-600 mb-6"
            >
              입력한 메시지가 모두 사라지고 기본값으로 변경됩니다.
              정말 변경하시겠습니까?
            </Dialog.Description>

            <div className="flex gap-3 justify-end">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all duration-200"
                aria-label="취소"
              >
                취소
              </motion.button>
              <motion.button
                ref={confirmButtonRef}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleConfirm}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all duration-200"
                aria-label="메시지를 기본값으로 변경"
              >
                변경하기
              </motion.button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
