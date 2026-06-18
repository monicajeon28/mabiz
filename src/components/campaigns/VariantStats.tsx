'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

interface VariantStatsProps {
  stats: {
    variants: Record<
      string,
      {
        sent: number;
        success: number;
        failure: number;
        successRate: number;
      }
    >;
    analysis: {
      chiSquare?: {
        chi2: number;
        pValue: number;
        isSignificant: boolean;
      };
      cramersV: number;
      recommendation?: string;
      confidence: 'HIGH' | 'MEDIUM' | 'LOW';
      interpretation: string;
    };
    metadata: {
      sampleSizeRecommendation?: string;
    };
  };
  onRefresh: () => void | Promise<void>;  // UI-VARIANTS-008: Promise<void> 허용으로 await가 실제로 동작
}

export function VariantStats({ stats, onRefresh }: VariantStatsProps) {
  const [loading, setLoading] = useState(false);

  const handleRefresh = async () => {
    setLoading(true);
    await onRefresh();
    setLoading(false);
  };

  const variantA = stats.variants['A'];
  const variantB = stats.variants['B'];

  // 성공률 비교 차트 데이터
  const successRateData = [
    {
      name: 'Variant A',
      successRate: variantA ? Math.round(variantA.successRate * 100) : 0,
    },
    {
      name: 'Variant B',
      successRate: variantB ? Math.round(variantB.successRate * 100) : 0,
    },
  ];

  // 발송 수 비교 차트 데이터
  const sendCountData = [
    {
      name: 'Variant A',
      sent: variantA?.sent || 0,
      success: variantA?.success || 0,
      failure: variantA?.failure || 0,
    },
    {
      name: 'Variant B',
      sent: variantB?.sent || 0,
      success: variantB?.success || 0,
      failure: variantB?.failure || 0,
    },
  ];

  return (
    <div className="space-y-6">
      {/* 액션 바 */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">📊 성과 분석</h2>
        <Button size="sm" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>

      {/* 신뢰도 배지 */}
      <div className="flex gap-2 items-center flex-wrap">
        <span className="text-sm font-semibold">신뢰도:</span>
        <span className={`px-3 py-1 rounded text-sm font-medium ${
          stats.analysis.confidence === 'HIGH'
            ? 'bg-green-100 text-green-800'
            : stats.analysis.confidence === 'MEDIUM'
            ? 'bg-blue-100 text-blue-800'
            : 'bg-gray-100 text-gray-800'
        }`}>
          {stats.analysis.confidence}
        </span>
        {stats.analysis.recommendation && (
          <span className="px-3 py-1 rounded border border-gray-300 text-sm">
            🎯 추천: Variant {stats.analysis.recommendation}
          </span>
        )}
      </div>

      {/* 해석 */}
      <div className="border border-gray-200 bg-gray-50 p-4 rounded text-gray-700">
        {stats.analysis.interpretation}
      </div>

      {/* 샘플 크기 경고 */}
      {stats.metadata.sampleSizeRecommendation && (
        <div className="border border-yellow-200 bg-yellow-50 p-4 rounded text-yellow-800">
          {stats.metadata.sampleSizeRecommendation}
        </div>
      )}

      {/* KPI 카드 */}
      {variantA && variantB && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4 border-l-4 border-l-blue-500">
            <h3 className="font-semibold text-blue-600 mb-4">Variant A</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">발송 수:</span>
                <span className="font-bold">{variantA.sent}건</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">성공:</span>
                <span className="font-bold text-green-600">{variantA.success}건</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">실패:</span>
                <span className="font-bold text-red-600">{variantA.failure}건</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-gray-600">성공률:</span>
                <span className="font-bold text-lg">
                  {Math.round(variantA.successRate * 100)}%
                </span>
              </div>
            </div>
          </Card>

          <Card className="p-4 border-l-4 border-l-red-500">
            <h3 className="font-semibold text-red-600 mb-4">Variant B</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">발송 수:</span>
                <span className="font-bold">{variantB.sent}건</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">성공:</span>
                <span className="font-bold text-green-600">{variantB.success}건</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">실패:</span>
                <span className="font-bold text-red-600">{variantB.failure}건</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-gray-600">성공률:</span>
                <span className="font-bold text-lg">
                  {Math.round(variantB.successRate * 100)}%
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* 성공률 비교 차트 */}
      {variantA && variantB && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">성공률 비교</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={successRateData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => `${value}%`} />
              <Bar dataKey="successRate" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* 발송 수 비교 차트 */}
      {variantA && variantB && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">발송 수 비교</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sendCountData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="success" fill="#22c55e" radius={[8, 8, 0, 0]} />
              <Bar dataKey="failure" fill="#ef4444" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Chi-square 상세 정보 */}
      {stats.analysis.chiSquare && (
        <Card className="p-6 bg-gray-50">
          <h3 className="font-semibold mb-4">📈 통계 검정 결과 (Chi-square)</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Chi-square 통계량</p>
              <p className="font-bold text-lg">
                {stats.analysis.chiSquare.chi2.toFixed(4)}
              </p>
            </div>
            <div>
              <p className="text-gray-600">P-value</p>
              <p className="font-bold text-lg">
                {stats.analysis.chiSquare.pValue.toFixed(4)}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Cramer's V (효과 크기)</p>
              <p className="font-bold text-lg">
                {stats.analysis.cramersV.toFixed(4)}
              </p>
            </div>
            <div>
              <p className="text-gray-600">유의성</p>
              <p
                className={`font-bold text-lg ${
                  stats.analysis.chiSquare.isSignificant
                    ? 'text-green-600'
                    : 'text-gray-600'
                }`}
              >
                {stats.analysis.chiSquare.isSignificant ? '✅ 유의미' : '❌ 비유의미'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* 해석 가이드 */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-3">📚 결과 해석 가이드</h3>
        <ul className="text-sm text-blue-800 space-y-2">
          <li>
            <strong>성공률:</strong> 각 Variant의 최종 발송 성공 비율입니다.
          </li>
          <li>
            <strong>P-value:</strong> 0.05 이하면 두 Variant 간 유의미한 차이가 있습니다.
          </li>
          <li>
            <strong>Cramer's V:</strong> 두 변수 간 연관성의 크기입니다. (0~1, 클수록 강함)
          </li>
          <li>
            <strong>추천:</strong> 높은 신뢰도 이상에서만 신뢰할 수 있습니다.
          </li>
        </ul>
      </Card>
    </div>
  );
}
