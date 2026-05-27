'use client';

import { useState } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface SegmentData {
  key: string;
  name: string;
  sent: number;
  clicked: number;
  submitted: number;
  responseRate: number;
  formCompletionRate: number;
  estimatedRevenue: number;
  trend: 'up' | 'down' | 'stable' | 'neutral';
}

interface Loop5SegmentTableProps {
  data: SegmentData[];
  loading?: boolean;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up') {
    return <ArrowUpRight className="w-4 h-4 text-green-600" />;
  }
  if (trend === 'down') {
    return <ArrowDownRight className="w-4 h-4 text-red-600" />;
  }
  return <div className="w-4 h-4 rounded-full bg-gray-400"></div>;
}

function getRateColor(rate: number, threshold: number = 35) {
  if (rate >= threshold) return 'bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-200';
  if (rate >= threshold - 10) return 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-900 dark:text-yellow-200';
  return 'bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-200';
}

function SkeletonRow() {
  return (
    <tr className="border-b dark:border-gray-800">
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-16"></div>
        </td>
      ))}
    </tr>
  );
}

export function Loop5SegmentTable({ data, loading }: Loop5SegmentTableProps) {
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    let aVal: any = a[sortBy as keyof SegmentData];
    let bVal: any = b[sortBy as keyof SegmentData];

    if (typeof aVal === 'string') {
      return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }

    return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const headerClass = 'px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors';
  const cellClass = 'px-4 py-3 text-sm text-gray-900 dark:text-gray-100';

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
            <tr>
              <th
                className={headerClass}
                onClick={() => handleSort('name')}
              >
                Segment {sortBy === 'name' && '↕'}
              </th>
              <th
                className={headerClass}
                onClick={() => handleSort('sent')}
              >
                SMS 발송 {sortBy === 'sent' && '↕'}
              </th>
              <th
                className={headerClass}
                onClick={() => handleSort('responseRate')}
              >
                응답율(%) {sortBy === 'responseRate' && '↕'}
              </th>
              <th
                className={headerClass}
                onClick={() => handleSort('formCompletionRate')}
              >
                폼완성(%) {sortBy === 'formCompletionRate' && '↕'}
              </th>
              <th
                className={headerClass}
                onClick={() => handleSort('estimatedRevenue')}
              >
                예상매출 {sortBy === 'estimatedRevenue' && '↕'}
              </th>
              <th className={headerClass}>추이</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
            ) : (
              sortedData.map((row) => (
                <tr
                  key={row.key}
                  className={`border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                    row.key === 'TOTAL' ? 'bg-gray-100 dark:bg-gray-800 font-semibold' : ''
                  }`}
                >
                  <td className={cellClass}>{row.name}</td>
                  <td className={cellClass}>{row.sent.toLocaleString()}</td>
                  <td className={`${cellClass} ${getRateColor(row.responseRate)} rounded px-2 py-1 inline-block`}>
                    {row.responseRate.toFixed(1)}%
                  </td>
                  <td className={`${cellClass} ${getRateColor(row.formCompletionRate, 40)} rounded px-2 py-1 inline-block`}>
                    {row.formCompletionRate.toFixed(1)}%
                  </td>
                  <td className={cellClass}>
                    ${(row.estimatedRevenue / 1000).toFixed(1)}K
                  </td>
                  <td className={`${cellClass} flex items-center gap-1`}>
                    <TrendIcon trend={row.trend} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
