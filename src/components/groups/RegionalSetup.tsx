'use client';

import { Loader2 } from 'lucide-react';

interface RegionalSetupProps {
  loading: boolean;
  setupMsg: string | null;
  onSetup: () => void;
}

export function RegionalSetup({ loading, setupMsg, onSetup }: RegionalSetupProps) {
  return (
    <div className="mb-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
      <p className="text-sm font-semibold text-blue-800 mb-1">📍 지역별 관심 그룹 자동 설정</p>
      <p className="text-sm text-blue-600 mb-3">8개 지역 그룹 + 12주 SMS 퍼널을 한 번에 생성합니다</p>
      <button
        onClick={onSetup}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {loading ? '생성 중...' : '🚀 지역 그룹 초기화'}
      </button>
      {setupMsg && (
        <p
          className={`text-sm mt-2 ${
            setupMsg.includes('이미')
              ? 'text-gray-500'
              : setupMsg.includes('실패') || setupMsg.includes('오류')
                ? 'text-red-600'
                : 'text-green-600'
          }`}
        >
          {setupMsg}
        </p>
      )}
    </div>
  );
}
