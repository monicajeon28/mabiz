'use client';

import { useCallback } from 'react';

/**
 * Toast 알림 타입
 */
export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'destructive' | 'warning';
  duration?: number;
}

/**
 * Toast 알림을 표시하는 콜백 함수
 */
type ToastCallback = (toast: Omit<Toast, 'id'>) => void;

/**
 * 전역 Toast 이벤트 리스너들
 */
const toastListeners = new Set<ToastCallback>();

/**
 * Toast 표시 함수
 * @param toast Toast 옵션
 */
export function showToast(toast: Omit<Toast, 'id'>) {
  const id = Math.random().toString(36).substr(2, 9);
  toastListeners.forEach((listener) =>
    listener({ ...toast, id })
  );
}

/**
 * useToast Hook
 * Toast 알림을 프로그래밍 방식으로 표시합니다.
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { toast } = useToast();
 *
 *   const handleClick = () => {
 *     toast({
 *       title: '성공',
 *       description: '데이터가 저장되었습니다.',
 *       variant: 'success',
 *     });
 *   };
 *
 *   return <button onClick={handleClick}>저장</button>;
 * }
 * ```
 */
export function useToast() {
  const toast = useCallback(
    (options: Omit<Toast, 'id'>) => {
      showToast(options);
    },
    []
  );

  return { toast };
}

/**
 * Toast 리스너 등록 (내부용)
 * ToastProvider 컴포넌트에서 사용합니다.
 */
export function addToastListener(listener: ToastCallback) {
  toastListeners.add(listener);
  return () => toastListeners.delete(listener);
}
