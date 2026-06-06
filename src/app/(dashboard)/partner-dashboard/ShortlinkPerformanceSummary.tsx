'use client';

import { TrendingUp, TrendingDown, Minus, Link2 } from 'lucide-react';

type ShortlinkSummaryData = {
  total: {
    clickCount: number;
    averageClicksPerDay: number;
    linkCount: number;
  };
};

export function ShortlinkPerformanceSummary({ data }: { data: ShortlinkSummaryData }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      {/* 총 클릭 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all">
        <div className="flex items-start justify-between">
          <p className="text-sm font-medium text-gray-500">총 클릭</p>
          <TrendingUp className="w-5 h-5 text-green-500" />
        </div>
        <div className="mt-3">
          <p className="text-3xl font-bold text-gray-900">
            {data.total.clickCount.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-2">회</p>
        </div>
      </div>

      {/* 일평균 클릭 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all">
        <div className="flex items-start justify-between">
          <p className="text-sm font-medium text-gray-500">일평균 클릭</p>
          <Link2 className="w-5 h-5 text-blue-500" />
        </div>
        <div className="mt-3">
          <p className="text-3xl font-bold text-gray-900">
            {data.total.averageClicksPerDay.toFixed(1)}
          </p>
          <p className="text-xs text-gray-400 mt-2">회/일</p>
        </div>
      </div>

      {/* 활성 링크 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all">
        <div className="flex items-start justify-between">
          <p className="text-sm font-medium text-gray-500">활성 링크</p>
          <Minus className="w-5 h-5 text-purple-500" />
        </div>
        <div className="mt-3">
          <p className="text-3xl font-bold text-gray-900">
            {data.total.linkCount}
          </p>
          <p className="text-xs text-gray-400 mt-2">개</p>
        </div>
      </div>
    </div>
  );
}
