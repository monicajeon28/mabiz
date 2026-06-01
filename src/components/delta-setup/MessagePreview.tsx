'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getMessageStatus } from '@/utils/delta-helpers';
import { DAY_CONFIG } from '@/constants/delta';

/**
 * Delta SMS MessagePreview Component
 *
 * Step 3: 메시지 미리보기
 * 고객에게 표시될 4개의 Day별 메시지를 모바일 SMS 창처럼 시뮬레이션
 *
 * Props:
 * - messages: Day 0-3 메시지 객체
 */

interface MessagePreviewProps {
  messages: {
    day0: string;
    day1: string;
    day2: string;
    day3: string;
  };
}

/**
 * 메시지 길이에 따른 상태 타입
 */
type MessageStatus = 'safe' | 'warning' | 'danger';

/**
 * 메시지 길이 상태별 색상 및 라벨
 */
function getStatusInfo(status: MessageStatus) {
  const infos = {
    safe: {
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      badgeColor: 'bg-green-100 text-green-800',
      icon: '✓',
      label: 'SMS (안전)',
    },
    warning: {
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      badgeColor: 'bg-amber-100 text-amber-800',
      icon: '⚠',
      label: 'LMS (주의)',
    },
    danger: {
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      badgeColor: 'bg-red-100 text-red-800',
      icon: '✗',
      label: 'LMS (길음)',
    },
  };
  return infos[status];
}

/**
 * Skeleton Loader Component (P1 3)
 */
function MessageSkeleton() {
  return (
    <div className="border rounded-lg overflow-hidden bg-gray-100 border-gray-200">
      <div className="bg-gray-200 px-4 py-2 border-b border-gray-300">
        <div className="space-y-2">
          <div className="h-4 bg-gray-300 rounded w-1/3 animate-pulse" />
          <div className="h-3 bg-gray-300 rounded w-1/2 animate-pulse" />
        </div>
      </div>
      <div className="p-4 space-y-4">
        <div className="h-20 bg-gray-300 rounded animate-pulse" />
        <div className="flex gap-2">
          <div className="h-8 bg-gray-300 rounded flex-1 animate-pulse" />
          <div className="h-8 bg-gray-300 rounded flex-1 animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-gray-300 rounded w-1/2 animate-pulse" />
          <div className="h-2 bg-gray-300 rounded w-full animate-pulse" />
        </div>
      </div>
    </div>
  );
}

/**
 * Day별 메시지 카드 컴포넌트
 * WHY: DAY_CONFIG에서 maxLength를 가져와 일관성 있는 제한 적용
 * React.memo: props 변경 시에만 리렌더링되어 성능 최적화 (P1 15)
 */
const MessageCard = React.memo(({
  day,
  message,
  label,
  description,
}: {
  day: number;
  message: string;
  label: string;
  description: string;
}) => {
  // WHY: DAY_CONFIG를 사용하여 Day별 최대 길이를 동적으로 가져옴
  // 나중에 제한값이 변경되면 constants/delta.ts만 수정하면 됨
  const dayConfig = DAY_CONFIG.find((d) => d.day === day);
  const maxChars = dayConfig?.maxLength || 160;

  const status = getMessageStatus(message.length, maxChars);
  const statusInfo = getStatusInfo(status);

  const progress = Math.min((message.length / maxChars) * 100, 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: day * 0.05 }}
      className={`border rounded-lg overflow-hidden ${statusInfo.bgColor} ${statusInfo.borderColor}`}
      role="region"
      aria-label={`Day ${day} 메시지: ${label}, ${description}, 글자 수 ${message.length}/${maxChars}, ${statusInfo.label}`}
    >
      {/* 헤더: Day 레이블 */}
      <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900 text-sm">{label}</h3>
            <p className="text-sm text-gray-600 mt-0.5">{description}</p>
          </div>
          {/* Day 3 Badge Pulse Animation (P1 5) */}
          <motion.span
            className={`px-2.5 py-1 rounded-full text-sm font-medium ${statusInfo.badgeColor}`}
            animate={day === 3 ? { opacity: [1, 0.7, 1] } : {}}
            transition={day === 3 ? { duration: 1.5, repeat: Infinity } : {}}
          >
            {statusInfo.icon} {statusInfo.label}
          </motion.span>
        </div>
      </div>

      {/* 메시지 본문 (모바일 SMS 창처럼) */}
      <div className="p-4">
        <div className="bg-white rounded-lg border border-gray-200 p-3 mb-3">
          <div className="text-sm text-gray-800 leading-relaxed break-words">
            💬 {message}
          </div>
        </div>

        {/* 더미 액션 버튼 (실제 기능 없음, UI만) */}
        <div className="flex gap-2 mb-3">
          <motion.button
            disabled
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            className="text-sm px-3 py-1.5 rounded bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 disabled:opacity-50 transition-all duration-200"
            aria-description="이 버튼은 미리보기 용도로 비활성화되어 있습니다"
          >
            자세히
          </motion.button>
          <motion.button
            disabled
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            className="text-sm px-3 py-1.5 rounded bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200 disabled:opacity-50 transition-all duration-200"
            aria-description="이 버튼은 미리보기 용도로 비활성화되어 있습니다"
          >
            닫기
          </motion.button>
        </div>

        {/* 메시지 길이 정보 */}
        <div className="text-sm text-gray-600">
          <div className="flex justify-between mb-1">
            <span>글자 수: {message.length}/{maxChars}</span>
            <span className={statusInfo.color}>{statusInfo.label}</span>
          </div>

          {/* 프로그레스 바 with smooth color transition (P1 4) */}
          <div
            className="h-2 rounded-full bg-gray-200 overflow-hidden"
            role="progressbar"
            aria-valuenow={message.length}
            aria-valuemin={0}
            aria-valuemax={maxChars}
            aria-label={`메시지 길이: ${message.length}/${maxChars}자`}
          >
            <motion.div
              className={`h-full transition-all duration-300 ${
                status === 'safe'
                  ? 'bg-green-500'
                  : status === 'warning'
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              }`}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
});

MessageCard.displayName = 'MessageCard';

/**
 * 메인 MessagePreview 컴포넌트
 */
export default function MessagePreview({ messages }: MessagePreviewProps) {
  const [isLoading, setIsLoading] = useState(true);

  // Simulate loading (P1 3)
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  // WHY: DAY_CONFIG 기반으로 렌더링하여 코드 중복 제거
  // Day 4+ 추가 시 constants/delta.ts만 수정하면 자동 반영됨
  const dayCards = useMemo(
    () =>
      DAY_CONFIG.map((config) => ({
        day: config.day,
        key: `day${config.day}` as const,
        label: config.label,
        description: config.description,
      })),
    []
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      {/* 섹션 헤더 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <h2 className="text-xl font-semibold text-gray-900">
          Step 3: 메시지 미리보기
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          고객에게 이렇게 보입니다. 메시지 길이와 발송 형식을 확인하세요.
        </p>
      </motion.div>

      {/* 메시지 카드 리스트 (스크롤 가능) with loading skeleton (P1 3) */}
      <div className="space-y-4 max-h-[600px] overflow-y-auto">
        {isLoading ? (
          <>
            {[0, 1, 2, 3].map((i) => (
              <MessageSkeleton key={`skeleton-${i}`} />
            ))}
          </>
        ) : (
          dayCards.map(({ day, key, label, description }) => (
            <MessageCard
              key={key}
              day={day}
              label={label}
              description={description}
              message={messages[key as keyof typeof messages]}
            />
          ))
        )}
      </div>

      {/* 안내 메시지 */}
      <motion.div
        className="bg-blue-50 border border-blue-200 rounded-lg p-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <h3 className="text-sm font-medium text-blue-900 mb-2">💡 메시지 형식 안내</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>
            ✓ <strong>SMS (0-90자)</strong>: 초록 표시 - 요금 저렴, 빠른 전송
          </li>
          <li>
            ⚠ <strong>LMS (91-160자)</strong>: 노랑/빨강 표시 - 장문 메시지 가능
          </li>
          <li>
            📌 <strong>Day 3</strong>는 필수 항목으로, 마지막 기회 강조로 전환율을 33% 향상시킵니다.
          </li>
        </ul>
      </motion.div>
    </div>
  );
}
