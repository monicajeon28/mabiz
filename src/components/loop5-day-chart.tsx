'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface DayData {
  day: number;
  sent: number;
  clicked: number;
  submitted: number;
  rate: number;
  completionRate: number;
}

interface Loop5DayChartProps {
  data: Record<number, DayData>;
  loading?: boolean;
}

export function Loop5DayChart({ data, loading }: Loop5DayChartProps) {
  const [displayMetric, setDisplayMetric] = useState<'rate' | 'completionRate'>('rate');

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-6 bg-white dark:bg-gray-900 h-96 animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-32 mb-4"></div>
        <div className="h-full bg-gray-100 dark:bg-gray-800 rounded"></div>
      </div>
    );
  }

  const chartData = Object.entries(data).map(([day, stats]) => ({
    day: `Day ${day}`,
    dayNum: parseInt(day),
    rate: parseFloat(stats.rate.toFixed(1)),
    completionRate: parseFloat(stats.completionRate.toFixed(1)),
  }));

  const metricLabel = displayMetric === 'rate' ? '응답율 (%)' : '폼 완성율 (%)';

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-6 bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Day별 성과 추이
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-600 mt-1">
            Day 0부터 Day 7까지의 누적 {metricLabel} 추이
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setDisplayMetric('rate')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              displayMetric === 'rate'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            응답율
          </button>
          <button
            onClick={() => setDisplayMetric('completionRate')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              displayMetric === 'completionRate'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            폼완성율
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e5e7eb"
            className="dark:stroke-gray-800"
          />
          <XAxis
            dataKey="day"
            stroke="#9ca3af"
            className="dark:stroke-gray-600"
          />
          <YAxis
            stroke="#9ca3af"
            className="dark:stroke-gray-600"
            label={{ value: '%', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#f3f4f6',
            }}
            formatter={(value: any) => `${parseFloat(value).toFixed(1)}%`}
            labelStyle={{ color: '#f3f4f6' }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Line
            type="monotone"
            dataKey={displayMetric}
            stroke="#3b82f6"
            strokeWidth={3}
            dot={{ fill: '#3b82f6', r: 5 }}
            activeDot={{ r: 7 }}
            name={metricLabel}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-600">최고 응답율</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {Math.max(...chartData.map(d => d.rate)).toFixed(1)}%
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
            {chartData.find(d => d.rate === Math.max(...chartData.map(d => d.rate)))?.day}
          </p>
        </div>
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-600">평균 응답율</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {(chartData.reduce((sum, d) => sum + d.rate, 0) / chartData.length).toFixed(1)}%
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
            Day 0-7 평균
          </p>
        </div>
      </div>
    </div>
  );
}
