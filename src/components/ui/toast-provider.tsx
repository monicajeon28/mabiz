'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { addToastListener } from '@/lib/api/use-toast';
import type { Toast } from '@/lib/api/use-toast';

/**
 * ToastProvider 컴포넌트
 * 전역 Toast 알림을 관리합니다.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Toast) => {
    setToasts((prev) => [...prev, toast]);

    // 자동 제거 (기본 3초)
    const duration = toast.duration ?? 3000;
    const timer = setTimeout(() => {
      removeToast(toast.id);
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const unsubscribe = addToastListener((toast) => {
      addToast({
        ...toast,
        id: crypto.randomUUID(),
      } as Toast);
    });
    return () => { unsubscribe(); };
  }, [addToast]);

  return (
    <>
      {children}
      {/* Toast 컨테이너 */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </>
  );
}

/**
 * 개별 Toast 알림 컴포넌트
 */
function ToastItem({
  toast,
  onClose,
}: {
  toast: Toast;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, toast.duration ?? 3000);
    return () => clearTimeout(timer);
  }, [toast.duration, onClose]);

  const baseClasses =
    'px-4 py-3 rounded-lg shadow-lg text-sm font-medium pointer-events-auto transition-all animate-in fade-in slide-in-from-bottom-2 duration-200';

  const variantClasses = {
    default: 'bg-slate-900 text-white',
    success: 'bg-green-500 text-white',
    destructive: 'bg-red-500 text-white',
    warning: 'bg-yellow-500 text-white',
  };

  const variantClass = variantClasses[toast.variant ?? 'default'];

  return (
    <div className={`${baseClasses} ${variantClass}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1">
          {toast.title && (
            <div className="font-semibold">{toast.title}</div>
          )}
          {toast.description && (
            <div className="text-xs opacity-90 mt-1">
              {toast.description}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 text-lg leading-none opacity-70 hover:opacity-100 transition-opacity"
        >
          ×
        </button>
      </div>
    </div>
  );
}
