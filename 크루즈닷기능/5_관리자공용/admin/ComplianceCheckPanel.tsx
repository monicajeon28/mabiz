'use client';

import { useMemo } from 'react';
import {
  ComplianceCheckResult,
  getComplianceStatusColor,
  getCategoryLabel,
} from '@/lib/legal-compliance';

interface ComplianceCheckPanelProps {
  results: ComplianceCheckResult[];
  title?: string;
  compact?: boolean;
}

export default function ComplianceCheckPanel({
  results,
  title = '법률 컴플라이언스 체크',
  compact = false,
}: ComplianceCheckPanelProps) {
  // 상태별 개수 계산
  const stats = useMemo(() => {
    return {
      pass: results.filter(r => r.status === 'pass').length,
      warning: results.filter(r => r.status === 'warning').length,
      fail: results.filter(r => r.status === 'fail').length,
      info: results.filter(r => r.status === 'info').length,
    };
  }, [results]);

  // 전체 상태 결정
  const overallStatus = useMemo(() => {
    if (stats.fail > 0) return 'fail';
    if (stats.warning > 0) return 'warning';
    return 'pass';
  }, [stats]);

  const overallColor = getComplianceStatusColor(overallStatus);

  if (results.length === 0) {
    return null;
  }

  // Compact 모드
  if (compact) {
    return (
      <div className={`${overallColor.bg} border border-gray-200 rounded-lg p-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>{overallColor.icon}</span>
            <span className={`font-medium ${overallColor.text}`}>
              {title}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {stats.pass > 0 && (
              <span className="text-green-600">✅ {stats.pass}</span>
            )}
            {stats.warning > 0 && (
              <span className="text-amber-600">⚠️ {stats.warning}</span>
            )}
            {stats.fail > 0 && (
              <span className="text-red-600">❌ {stats.fail}</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Full 모드
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* 헤더 */}
      <div className={`px-4 py-3 ${overallColor.bg} border-b border-gray-200`}>
        <div className="flex items-center justify-between">
          <h3 className={`font-semibold ${overallColor.text} flex items-center gap-2`}>
            <span>⚖️</span>
            {title}
          </h3>
          <div className="flex items-center gap-3 text-sm">
            {stats.pass > 0 && (
              <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">
                통과 {stats.pass}
              </span>
            )}
            {stats.warning > 0 && (
              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-medium">
                주의 {stats.warning}
              </span>
            )}
            {stats.fail > 0 && (
              <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-medium">
                필수 {stats.fail}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 체크 결과 목록 */}
      <div className="divide-y divide-gray-100">
        {results.map((result) => {
          const color = getComplianceStatusColor(result.status);
          return (
            <div key={result.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start gap-3">
                {/* 상태 아이콘 */}
                <div className={`w-8 h-8 rounded-lg ${color.bg} flex items-center justify-center flex-shrink-0`}>
                  <span>{color.icon}</span>
                </div>

                {/* 내용 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {getCategoryLabel(result.category)}
                    </span>
                    <h4 className="font-medium text-gray-900">{result.item}</h4>
                  </div>
                  <p className={`text-sm ${color.text}`}>{result.message}</p>
                  {result.action && (
                    <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                      <span>💡</span> {result.action}
                    </p>
                  )}
                  {result.reference && (
                    <p className="text-xs text-gray-400 mt-1">
                      참고: {result.reference}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 면책 조항 */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          * 본 체크 결과는 참고용입니다. 중요한 결정 전 반드시 전문가와 상담하세요.
        </p>
      </div>
    </div>
  );
}
