'use client';

import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { SEGMENT_COLORS, SEGMENT_LABELS } from '@/constants/segments';

interface RecommendationData {
  ok: boolean;
  error?: string;
  segment_distribution?: Record<string, number>;
  conversion_rates?: Record<string, number>;
  top_products?: Array<{ name: string; count: number }>;
}

interface ChartDataPoint {
  segment: string;
  customers: number;
  conversionRate: number;
  conversionRatePercent: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: ChartDataPoint;
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload;
    return (
      <div className="bg-white border border-gray-300 rounded-lg p-3 shadow-lg">
        <p className="font-semibold text-gray-900">{data.segment} - {SEGMENT_LABELS[data.segment] ?? 'Unknown'}</p>
        <p className="text-sm text-gray-600">고객 수: {data.customers}명</p>
        <p className="text-sm text-blue-600 font-medium">전환율: {data.conversionRatePercent}</p>
      </div>
    );
  }
  return null;
}

export function RecommendationWidget() {
  const [data, setData] = useState<RecommendationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/dashboard/recommendations', {
          cache: 'no-store',
          credentials: 'include',
        });

        if (res.status === 401) {
          setError('조직을 선택한 후 이용 가능합니다');
          setLoading(false);
          return;
        }

        if (!res.ok) {
          throw new Error(`API request failed with status ${res.status}`);
        }

        const responseData = await res.json();

        if (!responseData || !responseData.ok) {
          throw new Error(responseData?.error || 'Unknown error');
        }

        setData(responseData);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load recommendation data';
        setError(errorMsg);
        console.error('[RecommendationWidget] Error:', errorMsg);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-center text-gray-500">
          <p className="text-sm">분석 데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-center text-gray-500">
          <p className="text-sm">추천 분석 데이터를 불러올 수 없습니다</p>
          {error && <p className="text-xs text-gray-400 mt-1">{error}</p>}
        </div>
      </div>
    );
  }

  // 차트용 데이터 포매팅
  const chartData: ChartDataPoint[] = Object.entries(data.segment_distribution || {})
    .sort(([segA], [segB]) => segA.localeCompare(segB))
    .map(([segment, count]) => {
      const conversionRate = (data.conversion_rates || {})[segment] || 0;
      return {
        segment,
        customers: count,
        conversionRate,
        conversionRatePercent: `${(conversionRate * 100).toFixed(1)}%`,
      };
    });

  // 상위 상품 데이터
  const topProducts = (data.top_products || []).slice(0, 5);

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-center text-gray-500">
          <p className="text-sm">세그먼트 데이터가 없습니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-8">
      {/* 차트 섹션 */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">고객 세그먼트 분포 및 전환율</h3>
        <div className="w-full h-80 bg-gray-50 rounded-lg p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="segment"
                label={{ value: '세그먼트', position: 'insideBottom', offset: -5 }}
                angle={0}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                label={{ value: '고객 수', angle: -90, position: 'insideLeft' }}
                tick={{ fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
                verticalAlign="top"
                height={36}
              />
              <Bar
                dataKey="customers"
                fill="#3b82f6"
                name="고객 수"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 세그먼트별 통계 */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">세그먼트별 상세 통계</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {chartData.map((item) => (
            <div
              key={item.segment}
              className="bg-gray-50 rounded-lg border border-gray-200 p-4"
              style={{ borderLeftColor: SEGMENT_COLORS[item.segment] ?? '#cccccc', borderLeftWidth: '4px' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-900">{item.segment}</span>
                <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                  {SEGMENT_LABELS[item.segment] ?? 'Unknown'}
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-gray-900">{item.customers}</p>
                <p className="text-xs text-gray-600">고객 수</p>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-lg font-semibold text-blue-600">{item.conversionRatePercent}</p>
                <p className="text-xs text-gray-600">전환율</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 상위 추천 상품 */}
      {topProducts.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">상위 추천 상품</h3>
          <div className="space-y-2">
            {topProducts.map((product, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-semibold">
                    {idx + 1}
                  </span>
                  <span className="font-medium text-gray-900">{product.name}</span>
                </div>
                <span className="text-lg font-bold text-gray-900">{product.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
