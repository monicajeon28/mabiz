'use client';

import { useState } from 'react';
import { logger } from '@/lib/logger';

interface Props {
  open: boolean;
  logId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ResendConfirmDialog({ open, logId, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResend = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/messages/${logId}/resend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.ok) {
        logger.debug('[RESEND_DIALOG] 재발송 성공', {
          logId,
          status: data.data?.status,
        });
        onSuccess();
      } else {
        setError(data.error || '재발송에 실패했습니다');
        logger.warn('[RESEND_DIALOG] 재발송 실패', {
          logId,
          error: data.error,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류';
      setError(message);
      logger.error('[RESEND_DIALOG] 재발송 오류', {
        logId,
        error: message,
      });
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* 다이얼로그 */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 safe-area-inset">
        <div className="bg-white rounded-lg shadow-lg max-w-sm w-full animate-in fade-in zoom-in-95">
          {/* 헤더 */}
          <div className="px-4 md:px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg md:text-xl font-bold text-gray-900">메시지 재발송</h2>
          </div>

          {/* 본문 */}
          <div className="px-4 md:px-6 py-4 md:py-6">
            <p className="text-gray-700 text-sm md:text-base mb-4">
              이 메시지를 다시 발송하시겠습니까?
            </p>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs md:text-sm">
                {error}
              </div>
            )}
          </div>

          {/* 푸터 */}
          <div className="px-4 md:px-6 py-4 border-t border-gray-200 flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 md:py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm md:text-base font-medium h-10 flex items-center justify-center"
            >
              취소
            </button>
            <button
              onClick={handleResend}
              disabled={loading}
              className="flex-1 px-4 py-2 md:py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm md:text-base font-medium h-10 flex items-center justify-center"
            >
              {loading ? '처리 중...' : '재발송'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
