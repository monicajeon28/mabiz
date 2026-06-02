'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Zap } from 'lucide-react';

interface LensData {
  lens: string;
  totalContacts: number;
  conversions: number;
  conversionRate: number;
  revenue: number;
  ltv: number;
}

interface LensPerformanceChartProps {
  data: LensData[];
  title?: string;
}

export function LensPerformanceChart({
  data,
  title = '심리학 렌즈별 성과',
}: LensPerformanceChartProps) {
  const chartData = data.map((item) => ({
    lens: `L${item.lens.replace('L', '')}`,
    '전환율': parseFloat(item.conversionRate.toFixed(1)),
  }));

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
      <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <Zap className="w-5 h-5 text-yellow-500" />
        {title}
      </h3>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="lens" />
          <YAxis />
          <Tooltip
            contentStyle={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '0.5rem',
            }}
            formatter={(value) => `${value}%`}
          />
          <Bar dataKey="전환율" fill="#3b82f6" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* 상세 테이블 */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-2 text-left font-semibold text-slate-700">렌즈</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">고객수</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">전환</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">전환율</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">수익</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">LTV</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.lens} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{item.lens}</td>
                <td className="px-4 py-3 text-right text-slate-600">
                  {item.totalContacts.toLocaleString()}명
                </td>
                <td className="px-4 py-3 text-right text-slate-600">
                  {item.conversions.toLocaleString()}건
                </td>
                <td className="px-4 py-3 text-right font-semibold text-blue-600">
                  {item.conversionRate.toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-right text-slate-600">
                  ₩{(item.revenue / 1000000).toFixed(1)}M
                </td>
                <td className="px-4 py-3 text-right text-slate-600">
                  ₩{(item.ltv / 10000).toFixed(0)}만
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
