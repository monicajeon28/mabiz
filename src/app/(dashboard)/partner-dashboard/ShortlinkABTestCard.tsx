'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, TrendingUp, BarChart3 } from 'lucide-react';
import { useToast } from '@/lib/api/use-toast';

interface ABTestResult {
  testId: string;
  testName: string;
  status: string;
  summary: {
    statusMessage: string;
    statusType: 'pending' | 'significant';
    confidence: number;
    pValue: number;
  };
  details: {
    variantA: {
      code: string;
      title: string | null;
      clicks: number;
      impressions: number;
      ctr: string;
    };
    variantB: {
      code: string;
      title: string | null;
      clicks: number;
      impressions: number;
      ctr: string;
    };
    statistics: {
      chiSquare: number;
      pValue: number;
      isSignificant: boolean;
    };
  };
  nextAction: string;
}

interface ShortlinkABTestCardProps {
  testId: string;
  onDecideWinner?: (testId: string) => void;
  onStopTest?: (testId: string) => void;
}

export function ShortlinkABTestCard({
  testId,
  onDecideWinner,
  onStopTest,
}: ShortlinkABTestCardProps) {
  const [result, setResult] = useState<ABTestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const res = await fetch(`/api/analytics/ab-test-results?testId=${testId}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setResult(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
    // 10초마다 갱신
    const interval = setInterval(fetchResults, 10000);
    return () => clearInterval(interval);
  }, [testId]);

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-center py-8">
          <div className="text-center text-gray-500">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-500 mx-auto mb-2"></div>
            로딩 중...
          </div>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">
            {error || '테스트를 불러올 수 없습니다'}
          </div>
        </div>
      </div>
    );
  }

  const { variantA, variantB } = result.details;
  const totalImpressions = variantA.impressions + variantB.impressions;
  const progressA =
    totalImpressions > 0
      ? (variantA.impressions / totalImpressions) * 100
      : 0;

  const handleDeclareWinner = async (variant: 'A' | 'B') => {
    try {
      const res = await fetch(
        `/api/links/ab-tests/${testId}/declare-winner`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ winner: variant }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to declare winner');
      }

      toast({
        title: '성공',
        description: `${variant}이(가) 우승자로 선정되었습니다.`,
      });

      // 결과 새로고침
      const refreshRes = await fetch(
        `/api/analytics/ab-test-results?testId=${testId}`
      );
      const newResult = await refreshRes.json();
      setResult(newResult);

      onDecideWinner?.(testId);
    } catch (err) {
      toast({
        title: '오류',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <div
      className={`rounded-lg border shadow-sm ${
        result.summary.statusType === 'significant'
          ? 'border-green-200 bg-green-50'
          : 'border-gray-200 bg-white'
      }`}
    >
      {/* 헤더 */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {result.summary.statusType === 'significant' ? (
                <TrendingUp className="h-5 w-5 text-green-600" />
              ) : (
                <BarChart3 className="h-5 w-5 text-blue-600" />
              )}
              <h3 className="text-lg font-semibold text-gray-900">
                {result.testName}
              </h3>
            </div>
            <p className="mt-1 text-sm text-gray-600">
              상태:{' '}
              {result.status === 'ACTIVE'
                ? '⏳ 진행 중'
                : result.status === 'WINNER_A' || result.status === 'WINNER_B'
                  ? '✅ 완료'
                  : '⏸️ 일시 중지'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-gray-900">
              {result.summary.statusMessage}
            </div>
            {result.summary.statusType === 'significant' && (
              <p className="mt-1 text-xs text-gray-600">
                신뢰도 {result.summary.confidence}%
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 바디 */}
      <div className="space-y-4 px-6 py-4">
        {/* A 링크 진행률 */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900">
              A: {variantA.title || variantA.code}
            </span>
            <span className="text-sm text-gray-600">{variantA.clicks} 클릭</span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${progressA}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-600">{variantA.ctr} CTR</p>
        </div>

        {/* B 링크 진행률 */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900">
              B: {variantB.title || variantB.code}
            </span>
            <span className="text-sm text-gray-600">{variantB.clicks} 클릭</span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full bg-purple-500 transition-all"
              style={{ width: `${100 - progressA}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-600">{variantB.ctr} CTR</p>
        </div>

        {/* 샘플 크기 */}
        <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm">
          <p className="text-gray-700">
            총 노출: <strong>{totalImpressions}</strong> (목표: 200)
          </p>
          {totalImpressions < 200 && (
            <p className="mt-1 text-xs text-yellow-700">
              ⚠️ 더 수집하면 정확도가 올라갑니다 ({200 - totalImpressions}회)
            </p>
          )}
        </div>

        {/* 세부보기 토글 */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full rounded-lg bg-gray-100 py-2 text-center text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
        >
          {showDetails ? '▼ 세부통계 닫기' : '▶ 세부통계 보기'}
        </button>

        {/* 세부 통계 (토글) */}
        {showDetails && (
          <div className="space-y-2 rounded-lg bg-gray-50 p-3 text-sm">
            <div>
              <span className="text-gray-600">Chi-square: </span>
              <span className="font-mono">
                {result.details.statistics.chiSquare}
              </span>
            </div>
            <div>
              <span className="text-gray-600">p-value: </span>
              <span className="font-mono">
                {result.summary.pValue.toFixed(4)}
              </span>
            </div>
            <div className="text-gray-600">
              {result.summary.statusType === 'significant' ? (
                <p className="text-green-700">✅ 통계적으로 유의합니다</p>
              ) : (
                <p className="text-yellow-700">
                  ⏳ 아직 충분한 데이터가 아닙니다
                </p>
              )}
            </div>
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex gap-2 border-t border-gray-200 pt-4">
          {result.nextAction === 'declare_winner' ? (
            <>
              <button
                onClick={() => {
                  // A vs B 중 더 높은 CTR 선택
                  const ctrA = parseFloat(variantA.ctr);
                  const ctrB = parseFloat(variantB.ctr);
                  const winner = ctrA > ctrB ? 'A' : 'B';
                  handleDeclareWinner(winner);
                }}
                className="flex-1 rounded-lg bg-green-600 py-2 text-center font-medium text-white transition-colors hover:bg-green-700"
              >
                🏆 우승자 선택하기
              </button>
              <button
                onClick={() => {
                  if (onStopTest) {
                    onStopTest(testId);
                  }
                }}
                className="flex-1 rounded-lg border border-gray-300 py-2 text-center font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                중지
              </button>
            </>
          ) : result.nextAction === 'test_completed' ? (
            <p className="w-full py-2 text-center text-sm font-medium text-green-700">
              ✅ 테스트 완료
            </p>
          ) : (
            <button
              disabled
              className="w-full rounded-lg border border-gray-300 py-2 text-center font-medium text-gray-500"
            >
              계속 수집 중...
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
