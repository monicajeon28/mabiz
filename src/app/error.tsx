'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { logger } from '@/lib/logger';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error for debugging
    logger.error('Application error boundary triggered', {
      message: error.message,
      digest: error.digest,
      stack: error.stack?.substring(0, 500),
    });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-navy-900 mb-4">오류가 발생했습니다</h1>
        <p className="text-gray-600 mb-8">
          요청을 처리하는 중에 예상치 못한 오류가 발생했습니다.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => reset()}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            다시 시도
          </button>

          <Link
            href="/dashboard"
            className="block px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors"
          >
            대시보드로 이동
          </Link>
        </div>

        {process.env.NODE_ENV === 'development' && error.message && (
          <div className="mt-8 p-4 bg-gray-100 rounded-lg text-left">
            <p className="text-sm font-mono text-gray-700 break-words">{error.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
