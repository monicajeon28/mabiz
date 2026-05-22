/**
 * PNR 페이지용 알림 박스 컴포넌트
 * error, success, info 3가지 타입 지원
 */

import React from 'react';

type AlertType = 'error' | 'success' | 'info';

interface AlertBoxProps {
  type: AlertType;
  message: string;
  onDismiss?: () => void;
}

/**
 * 알림 박스 컴포넌트
 * @param type 알림 타입 ('error' | 'success' | 'info')
 * @param message 알림 메시지
 * @param onDismiss 닫기 버튼 클릭 핸들러 (선택사항)
 */
export function AlertBox({ type, message, onDismiss }: AlertBoxProps) {
  const bgColor: Record<AlertType, string> = {
    error: 'bg-red-50',
    success: 'bg-green-50',
    info: 'bg-blue-50',
  };

  const textColor: Record<AlertType, string> = {
    error: 'text-red-700',
    success: 'text-green-700',
    info: 'text-blue-700',
  };

  const borderColor: Record<AlertType, string> = {
    error: 'border-red-200',
    success: 'border-green-200',
    info: 'border-blue-200',
  };

  return (
    <div
      className={`mb-6 rounded-lg ${bgColor[type]} p-4 border ${borderColor[type]} ${textColor[type]}`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center justify-between">
        <span>{message}</span>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="ml-4 text-sm font-semibold hover:opacity-70 transition-opacity"
            aria-label="알림 닫기"
          >
            닫기
          </button>
        )}
      </div>
    </div>
  );
}
