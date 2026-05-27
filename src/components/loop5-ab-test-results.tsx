'use client';

import { useState } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';

interface CTA_Test {
  variant: string;
  clicks: number;
  total: number;
  rate: number;
  confidence?: number;
  winner?: boolean;
}

interface SMS_Test {
  day: number;
  version: string;
  clicks: number;
  total: number;
  rate: number;
  recommended?: boolean;
}

interface Loop5ABTestResultsProps {
  ctaTests: CTA_Test[];
  smsTests: SMS_Test[];
  loading?: boolean;
}

function getConfidenceColor(confidence: number) {
  if (confidence >= 95) return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
  if (confidence >= 80) return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
  return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
}

function SkeletonRow() {
  return (
    <tr className="border-b dark:border-gray-800">
      {[...Array(5)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-16"></div>
        </td>
      ))}
    </tr>
  );
}

export function Loop5ABTestResults({
  ctaTests,
  smsTests,
  loading,
}: Loop5ABTestResultsProps) {
  const [activeTab, setActiveTab] = useState<'cta' | 'sms'>('cta');

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="p-6 border-b dark:border-gray-800">
          <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-40 animate-pulse"></div>
        </div>
        <table className="w-full">
          <tbody>
            {[...Array(3)].map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b dark:border-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          A/B 테스트 결과
        </h3>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('cta')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'cta'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            CTA 변형
          </button>
          <button
            onClick={() => setActiveTab('sms')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'sms'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            SMS 메시지
          </button>
        </div>
      </div>

      {/* CTA Tests Table */}
      {activeTab === 'cta' && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                  CTA 변형
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                  클릭수
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                  클릭율(%)
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                  신뢰도
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                  상태
                </th>
              </tr>
            </thead>
            <tbody>
              {ctaTests.map((test, idx) => (
                <tr
                  key={idx}
                  className={`border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                    test.winner ? 'bg-green-50 dark:bg-green-900/20' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    {test.variant}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {test.clicks.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                    {test.rate.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {test.confidence ? `${test.confidence}%` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {test.winner ? (
                      <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">우승자</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SMS Tests Table */}
      {activeTab === 'sms' && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Day
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                  메시지 버전
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                  클릭수
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                  클릭율(%)
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                  추천도
                </th>
              </tr>
            </thead>
            <tbody>
              {smsTests.map((test, idx) => (
                <tr
                  key={idx}
                  className={`border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                    test.recommended ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    Day {test.day}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {test.version.toUpperCase()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {test.clicks.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                    {test.rate.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3">
                    {test.recommended ? (
                      <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">⭐</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Info Box */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-t dark:border-gray-800 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
            통계 신뢰도 95% 이상일 때 우승자 결정
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
            표본이 충분할 때까지 지속적으로 A/B 테스트 실행 권장
          </p>
        </div>
      </div>
    </div>
  );
}
