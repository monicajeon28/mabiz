'use client';

import { useState } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';

interface FilterPanelProps {
  onApplyFilters: (filters: FilterState) => void;
  onResetFilters: () => void;
}

export interface FilterState {
  dateFrom: string;
  dateTo: string;
  segments: string[];
  day?: number;
  status?: string;
}

const SEGMENTS = [
  { id: 'A', label: '신혼부부' },
  { id: 'B', label: '가족' },
  { id: 'C', label: '중년' },
  { id: 'D', label: 'VVIP' },
  { id: 'E', label: '70s+' },
];

const STATUS_OPTIONS = [
  { id: 'SENT', label: '발송됨' },
  { id: 'CLICKED', label: '클릭됨' },
  { id: 'FORM_SUBMITTED', label: '폼 제출' },
];

export function Loop5FilterPanel({
  onApplyFilters,
  onResetFilters,
}: FilterPanelProps) {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const [filters, setFilters] = useState<FilterState>({
    dateFrom: weekAgo,
    dateTo: today,
    segments: Object.keys(SEGMENTS),
    status: 'SENT',
  });

  const [isOpen, setIsOpen] = useState(false);

  const handleSegmentChange = (segmentId: string) => {
    setFilters(prev => ({
      ...prev,
      segments: prev.segments.includes(segmentId)
        ? prev.segments.filter(s => s !== segmentId)
        : [...prev.segments, segmentId],
    }));
  };

  const handleApply = () => {
    onApplyFilters(filters);
    setIsOpen(false);
  };

  const handleReset = () => {
    const defaultFilters = {
      dateFrom: weekAgo,
      dateTo: today,
      segments: Object.keys(SEGMENTS),
      status: 'SENT',
    };
    setFilters(defaultFilters);
    onResetFilters();
  };

  const activeFilterCount = [
    filters.dateFrom !== weekAgo,
    filters.dateTo !== today,
    filters.segments.length !== Object.keys(SEGMENTS).length,
    filters.status !== 'SENT',
  ].filter(Boolean).length;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium text-sm"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
          />
        </svg>
        필터
        {activeFilterCount > 0 && (
          <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white text-sm font-bold">
            {activeFilterCount}
          </span>
        )}
        <ChevronDown className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg p-4 z-50">
          {/* Date Range */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              날짜 범위
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={filters.dateFrom}
                onChange={e =>
                  setFilters(prev => ({ ...prev, dateFrom: e.target.value }))
                }
                className="flex-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              />
              <input
                type="date"
                value={filters.dateTo}
                onChange={e =>
                  setFilters(prev => ({ ...prev, dateTo: e.target.value }))
                }
                className="flex-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              />
            </div>
          </div>

          {/* Segments */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Segment
            </label>
            <div className="space-y-2">
              {SEGMENTS.map(segment => (
                <label key={segment.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filters.segments.includes(segment.id)}
                    onChange={() => handleSegmentChange(segment.id)}
                    className="rounded border-gray-300 dark:border-gray-700"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {segment.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              상태
            </label>
            <select
              value={filters.status || ''}
              onChange={e =>
                setFilters(prev => ({ ...prev, status: e.target.value }))
              }
              className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            >
              {STATUS_OPTIONS.map(status => (
                <option key={status.id} value={status.id}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t dark:border-gray-800">
            <button
              onClick={handleReset}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              초기화
            </button>
            <button
              onClick={handleApply}
              className="flex-1 px-3 py-2 rounded text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            >
              적용
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
