'use client';

import { useState, useEffect } from 'react';
import {
  getUpcomingDeadlines,
  getTaxDeadlineIcon,
  getSeverityColor,
  formatDaysUntil,
  TaxDeadline,
} from '@/lib/tax-calendar';

interface TaxAlertWidgetProps {
  compact?: boolean;
}

export default function TaxAlertWidget({ compact = false }: TaxAlertWidgetProps) {
  const [deadlines, setDeadlines] = useState<TaxDeadline[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const upcoming = getUpcomingDeadlines();
    setDeadlines(upcoming);
  }, []);

  if (deadlines.length === 0) {
    return null;
  }

  // 가장 긴급한 알림
  const mostUrgent = deadlines[0];
  const urgentColor = getSeverityColor(mostUrgent.severity);

  // Compact 모드 (상단 배너)
  if (compact) {
    return (
      <div
        className={`${urgentColor.bg} ${urgentColor.border} border rounded-lg p-3 flex items-center justify-between`}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{getTaxDeadlineIcon(mostUrgent.type)}</span>
          <div>
            <span className={`font-medium ${urgentColor.text}`}>
              {mostUrgent.title}
            </span>
            <span className={`ml-2 text-sm ${urgentColor.text} opacity-80`}>
              ({formatDaysUntil(mostUrgent.daysUntil)})
            </span>
          </div>
        </div>
        {deadlines.length > 1 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`text-sm ${urgentColor.text} hover:underline`}
          >
            {isExpanded ? '접기' : `+${deadlines.length - 1}개 더보기`}
          </button>
        )}
      </div>
    );
  }

  // Full 모드 (카드형)
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* 헤더 */}
      <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <span>📅</span>
            세무 일정 알림
          </h3>
          <span className="text-xs text-gray-500">
            {deadlines.length}개 일정
          </span>
        </div>
      </div>

      {/* 알림 목록 */}
      <div className="divide-y divide-gray-100">
        {deadlines.map((deadline) => {
          const color = getSeverityColor(deadline.severity);
          return (
            <div
              key={deadline.id}
              className={`p-4 hover:bg-gray-50 transition-colors`}
            >
              <div className="flex items-start gap-3">
                {/* 아이콘 */}
                <div
                  className={`w-10 h-10 rounded-lg ${color.bg} flex items-center justify-center flex-shrink-0`}
                >
                  <span className="text-xl">
                    {getTaxDeadlineIcon(deadline.type)}
                  </span>
                </div>

                {/* 내용 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-gray-900 truncate">
                      {deadline.title}
                    </h4>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${color.bg} ${color.text}`}
                    >
                      {formatDaysUntil(deadline.daysUntil)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-1">
                    {deadline.description}
                  </p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-gray-500">
                      기한: {deadline.deadline.toLocaleDateString('ko-KR')}
                    </span>
                    {deadline.actionUrl && (
                      <a
                        href={deadline.actionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        홈택스 바로가기 →
                      </a>
                    )}
                  </div>
                </div>

                {/* 심각도 표시 */}
                {deadline.severity === 'critical' && (
                  <div className="flex-shrink-0">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-red-100 rounded-full">
                      <span className="text-red-600 text-sm">!</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 푸터 안내 */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          * 세무 일정은 참고용입니다. 정확한 기한은 국세청(홈택스)에서 확인하세요.
        </p>
      </div>
    </div>
  );
}
