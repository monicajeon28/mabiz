/**
 * Images 폴더 배치 2/2 관리 패널
 * - 동기화 시작 버튼
 * - 진행률 표시
 * - 최종 통계
 * - 에러 처리
 */

'use client';

import React, { useState } from 'react';
import { useBatch2ImageSync } from '@/lib/hooks/useBatch2ImageSync';
import { BatchSyncResponse } from '@/types/batch-sync';

export function Batch2ImageSyncPanel() {
  const {
    isLoading,
    isComplete,
    error,
    progress,
    result,
    startSync,
    checkStatus,
    reset,
  } = useBatch2ImageSync();

  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl">
      {/* 헤더 */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          배치 2/2 이미지 동기화
        </h2>
        <p className="text-gray-600">
          Images 폴더의 나머지 이미지들을 Cloudinary에 병렬 업로드합니다.
        </p>
      </div>

      {/* 상태 표시 */}
      {!result ? (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-700">
            준비 완료. 아래 버튼을 클릭하여 시작하세요.
          </p>
        </div>
      ) : null}

      {/* 진행 중 */}
      {isLoading && (
        <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <p className="text-sm text-yellow-700 font-semibold mb-3">
            처리 중...
          </p>
          {progress && (
            <div>
              <div className="flex justify-between text-xs text-yellow-600 mb-2">
                <span>{progress.completed}/{progress.total}</span>
                <span>{progress.percent}%</span>
              </div>
              <div className="w-full bg-yellow-200 rounded-full h-2">
                <div
                  className="bg-yellow-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                <div>
                  <p className="text-yellow-600">성공: {progress.successCount}</p>
                </div>
                <div>
                  <p className="text-yellow-600">실패: {progress.failureCount}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 완료 */}
      {isComplete && result && (
        <div
          className={`mb-6 p-4 rounded-lg border ${
            result.failureCount === 0
              ? 'bg-green-50 border-green-200'
              : 'bg-orange-50 border-orange-200'
          }`}
        >
          <p
            className={`text-sm font-semibold mb-3 ${
              result.failureCount === 0
                ? 'text-green-700'
                : 'text-orange-700'
            }`}
          >
            ✅ 처리 완료!
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-600">총 이미지</p>
              <p className="text-xl font-bold">{result.totalImages}</p>
            </div>
            <div>
              <p className="text-gray-600">성공률</p>
              <p className="text-xl font-bold">{result.successRate}</p>
            </div>
            <div>
              <p className="text-gray-600">성공</p>
              <p className="text-lg font-semibold text-green-600">
                {result.successCount}
              </p>
            </div>
            <div>
              <p className="text-gray-600">실패</p>
              <p
                className={`text-lg font-semibold ${
                  result.failureCount > 0 ? 'text-red-600' : 'text-gray-600'
                }`}
              >
                {result.failureCount}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-gray-600">소요 시간</p>
              <p className="text-lg font-semibold">{result.durationSec}초</p>
            </div>
          </div>
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="text-sm font-semibold text-red-700 mb-2">❌ 오류</p>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* 실패 상세 정보 */}
      {result?.failedDetails && result.failedDetails.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
          >
            {showDetails ? '▼' : '▶'} 실패한 이미지 상세 ({result.failedDetails.length})
          </button>

          {showDetails && (
            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
              {result.failedDetails.map((item, idx) => (
                <div
                  key={idx}
                  className="p-2 bg-gray-50 rounded text-xs text-gray-700 border-l-2 border-red-500"
                >
                  <p className="font-semibold">{item.fileName}</p>
                  <p className="text-gray-600">폴더: {item.folder}</p>
                  <p className="text-red-600">오류: {item.error}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex gap-3">
        <button
          onClick={startSync}
          disabled={isLoading}
          className={`flex-1 h-14 px-4 rounded-lg font-semibold text-white transition-colors flex items-center justify-center ${
            isLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
          }`}
        >
          {isLoading ? '처리 중...' : '동기화 시작'}
        </button>

        {isComplete && (
          <button
            onClick={reset}
            className="flex-1 h-14 px-4 rounded-lg font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors flex items-center justify-center"
          >
            초기화
          </button>
        )}

        {!isLoading && (
          <button
            onClick={checkStatus}
            className="flex-1 h-14 px-4 rounded-lg font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors flex items-center justify-center"
          >
            상태 확인
          </button>
        )}
      </div>

      {/* 정보 */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg text-xs text-gray-600 space-y-1">
        <p>
          <strong>동시 업로드:</strong> 10개
        </p>
        <p>
          <strong>타임아웃:</strong> 5분
        </p>
        <p>
          <strong>메모리 제한:</strong> 85%
        </p>
        <p className="mt-2">
          이 작업은 Images 폴더의 모든 이미지를 Cloudinary에 업로드합니다.
          이미 동기화된 이미지는 자동으로 건너뜁니다.
        </p>
      </div>
    </div>
  );
}
