'use client';

import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastProps {
  toast: ToastMessage;
  onClose: (id: string) => void;
}

function Toast({ toast, onClose }: ToastProps) {
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const duration = toast.duration || 4000;
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(() => onClose(toast.id), 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  const colors: Record<ToastType, string> = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  return (
    <div
      className={`max-w-sm w-full rounded-lg shadow-lg border p-4 transition-all duration-300 ${colors[toast.type]} ${isLeaving ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          {toast.title && <p className="font-semibold mb-1">{toast.title}</p>}
          <p className="text-sm">{toast.message}</p>
        </div>
        <button
          onClick={() => {
            setIsLeaving(true);
            setTimeout(() => onClose(toast.id), 300);
          }}
          className="text-gray-400 hover:text-gray-600 flex-shrink-0 text-lg leading-none"
          aria-label="닫기"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export function ToastContainer({
  toasts,
  onClose,
}: {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}) {
  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-2 pointer-events-none">
      <div className="pointer-events-auto space-y-2">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onClose={onClose} />
        ))}
      </div>
    </div>
  );
}

let listeners: ((toasts: ToastMessage[]) => void)[] = [];
let list: ToastMessage[] = [];

export function addToast(toast: Omit<ToastMessage, 'id'>) {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  list = [...list, { ...toast, id }];
  listeners.forEach((l) => l(list));
  return id;
}

export function removeToast(id: string) {
  list = list.filter((t) => t.id !== id);
  listeners.forEach((l) => l(list));
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  useEffect(() => {
    const listener = (t: ToastMessage[]) => setToasts(t);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);
  return { toasts, removeToast };
}

export function showSuccess(message: string, title?: string) {
  return addToast({ type: 'success', message, title });
}

export function showError(message: string, title?: string) {
  return addToast({ type: 'error', message, title });
}

export function showWarning(message: string, title?: string) {
  return addToast({ type: 'warning', message, title });
}

export function showInfo(message: string, title?: string) {
  return addToast({ type: 'info', message, title });
}
