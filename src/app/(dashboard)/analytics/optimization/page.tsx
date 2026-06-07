"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Zap,
  Target,
  DollarSign,
  Clock,
  CheckCircle,
  MessageSquare,
  Mail,
  MessageCircle,
  PieChart as PieChartIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MessageChannel } from "@/lib/types/multi-channel";

interface ChannelAllocation {
  SMS: number;
  KAKAO: number;
  EMAIL: number;
}

interface BanditStats {
  SMS: {
    successes: number;
    failures: number;
    successRate: number;
  };
  KAKAO: {
    successes: number;
    failures: number;
    successRate: number;
  };
  EMAIL: {
    successes: number;
    failures: number;
    successRate: number;
  };
}

interface OptimizationDashboardData {
  currentAllocation: ChannelAllocation;
  lastUpdateAt: Date;
  nextUpdateAt: Date;
  confidence: number;
  banditStats: BanditStats;
  recommendations: string[];
  abTestResults: Array<{
    variant: string;
    channel: MessageChannel;
    conversionRate: number;
    winner?: boolean;
  }>;
  projectedImpact: {
    monthlyRevenue: number;
    revenueIncrease: number;
    expectedCPA: number;
    cpaSavings: number;
  };
}


const CHANNEL_CONFIG: Record<
  MessageChannel,
  { label: string; icon: React.ReactNode; color: string; bgColor: string }
> = {
  SMS: {
    label: "SMS",
    icon: <MessageSquare className="w-4 h-4" />,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  KAKAO: {
    label: "카카오",
    icon: <MessageCircle className="w-4 h-4" />,
    color: "text-yellow-600",
    bgColor: "bg-yellow-100",
  },
  EMAIL: {
    label: "이메일",
    icon: <Mail className="w-4 h-4" />,
    color: "text-purple-600",
    bgColor: "bg-purple-100",
  },
};

export default function OptimizationDashboard() {
  const [data, setData] = useState<OptimizationDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<MessageChannel | null>(
    null
  );

  useEffect(() => {
    const ctrl = new AbortController();
    const fetchData = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const response = await fetch('/api/analytics/optimization', { signal: ctrl.signal });
        const result = await response.json();
        if (result.ok) {
          setData({
            ...result,
            lastUpdateAt: new Date(result.lastUpdateAt),
            nextUpdateAt: new Date(result.nextUpdateAt),
          });
        } else {
          setFetchError(result.message || '데이터를 불러올 수 없습니다.');
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setFetchError('최적화 데이터 로드 중 오류가 발생했습니다.');
      } finally {
        if (!ctrl.signal.aborted) setIsLoading(false);
      }
    };
    fetchData();
    return () => ctrl.abort();
  }, []);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/analytics/optimization');
      const result = await response.json();
      if (result.ok) {
        setData({
          ...result,
          lastUpdateAt: new Date(result.lastUpdateAt),
          nextUpdateAt: new Date(result.nextUpdateAt),
        });
      }
    } catch (error) {
      console.error("Failed to refresh optimization:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  if (isLoading && !data) {
    return (
      <div className="space-y-6 flex items-center justify-center min-h-64">
        <div className="text-center text-gray-500">데이터를 불러오는 중...</div>
      </div>
    );
  }

  if (fetchError || !data) {
    return (
      <div className="space-y-6 flex items-center justify-center min-h-64">
        <div className="text-center text-red-500">{fetchError ?? '데이터 없음'}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">실시간 채널 최적화</h1>
          <p className="text-gray-600 mt-1">
            Thompson Sampling 기반 자동 채널 최적화
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          {isLoading ? "업데이트 중..." : "지금 업데이트"}
        </button>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-600" />
            최적화 상태
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">신뢰도</p>
              <p className="text-2xl font-bold text-blue-600">{data.confidence}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">마지막 업데이트</p>
              <p className="text-sm font-mono">{formatTime(data.lastUpdateAt)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">다음 업데이트</p>
              <p className="text-sm font-mono">{formatTime(data.nextUpdateAt)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">상태</p>
              <p className="text-sm font-bold text-green-600 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                정상 작동 중
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Channel Allocation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="w-5 h-5 text-purple-600" />
            현재 채널 할당 (%)
          </CardTitle>
          <CardDescription>
            최근 30분 성과 기반 최적 배분
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(["SMS", "KAKAO", "EMAIL"] as MessageChannel[]).map(
              (channel) => {
                const config = CHANNEL_CONFIG[channel];
                const percentage = data.currentAllocation[channel];

                return (
                  <div
                    key={channel}
                    onClick={() =>
                      setSelectedChannel(
                        selectedChannel === channel ? null : channel
                      )
                    }
                    className={`p-4 rounded-lg border-2 cursor-pointer transition ${
                      selectedChannel === channel
                        ? `${config.bgColor} border-gray-900`
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {config.icon}
                      <span className="font-semibold">{config.label}</span>
                    </div>

                    <div className="flex items-end gap-2">
                      <span className={`text-3xl font-bold ${config.color}`}>
                        {percentage}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          channel === "SMS"
                            ? "bg-blue-600"
                            : channel === "KAKAO"
                              ? "bg-yellow-600"
                              : "bg-purple-600"
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    <p className="text-sm text-gray-600 mt-2">
                      {channel === "SMS" && "전송 속도 빠름"}
                      {channel === "KAKAO" && "개방율 최고"}
                      {channel === "EMAIL" && "비용 효율"}
                    </p>
                  </div>
                );
              }
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bandit Statistics */}
      {selectedChannel && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-orange-600" />
              {CHANNEL_CONFIG[selectedChannel].label} - Thompson Sampling 통계
            </CardTitle>
            <CardDescription>
              다중 선택 최적화 알고리즘 상태
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">성공</p>
                <p className="text-2xl font-bold text-green-600">
                  {data.banditStats[selectedChannel].successes}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">실패</p>
                <p className="text-2xl font-bold text-red-600">
                  {data.banditStats[selectedChannel].failures}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">성공률</p>
                <p className="text-2xl font-bold text-blue-600">
                  {(data.banditStats[selectedChannel].successRate * 100).toFixed(
                    1
                  )}
                  %
                </p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-900">
                <strong>Thompson Sampling:</strong> Bayesian 방식으로 각 채널의
                성공률을 지속적으로 학습하고, 확률 샘플링으로 탐색(20%) vs
                활용(80%)을 자동 균형. 매 시도마다 베타 분포 업데이트.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-600" />
            실시간 추천사항
          </CardTitle>
          <CardDescription>
            최근 30분 성과 기반 자동 도출
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="flex gap-3 p-3 bg-amber-50 border border-amber-200 rounded"
              >
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-900">{rec}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* A/B Test Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-teal-600" />
            A/B 테스트 결과
          </CardTitle>
          <CardDescription>
            채널별 진행 중인 테스트 승/패 판정
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.abTestResults.map((test, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded"
              >
                <div className="flex items-center gap-3 flex-1">
                  {CHANNEL_CONFIG[test.channel].icon}
                  <div>
                    <p className="font-medium text-sm">{test.variant}</p>
                    <p className="text-sm text-gray-600">
                      전환율: {test.conversionRate.toFixed(2)}%
                    </p>
                  </div>
                </div>
                {test.winner && (
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-bold rounded-full flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    우승
                  </span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Projected Impact */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            예상 효과 (월간)
          </CardTitle>
          <CardDescription>
            추천사항 적용 시 예상 개선도
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded">
              <p className="text-sm text-green-700 font-semibold mb-1">
                현재 월 수익
              </p>
              <p className="text-2xl font-bold text-green-600">
                ${(data.projectedImpact.monthlyRevenue / 1000).toFixed(0)}K
              </p>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-700 font-semibold mb-1">
                예상 증가분
              </p>
              <p className="text-2xl font-bold text-blue-600">
                +${(data.projectedImpact.revenueIncrease / 1000).toFixed(0)}K
              </p>
              <p className="text-sm text-blue-600 mt-1">+15%</p>
            </div>

            <div className="p-4 bg-purple-50 border border-purple-200 rounded">
              <p className="text-sm text-purple-700 font-semibold mb-1">
                현재 CPA
              </p>
              <p className="text-2xl font-bold text-purple-600">
                ${data.projectedImpact.expectedCPA}
              </p>
            </div>

            <div className="p-4 bg-orange-50 border border-orange-200 rounded">
              <p className="text-sm text-orange-700 font-semibold mb-1">
                CPA 절감
              </p>
              <p className="text-2xl font-bold text-orange-600">
                -${Math.round(data.projectedImpact.cpaSavings / 100) * 100}
              </p>
              <p className="text-sm text-orange-600 mt-1">-15%</p>
            </div>
          </div>

          <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded">
            <h4 className="font-semibold text-sm mb-2">계산 방식</h4>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>
                • 월 수익 = 기존 캠페인 ROI × 현재 예산 × (1 + 신뢰도 계수)
              </li>
              <li>
                • 예상 증가분 = 채널 최적화 + 송시시간 최적화 + 오퍼 최적화 합산
              </li>
              <li>• CPA 절감 = 채널별 비용 효율 개선도 기반</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* System Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-600" />
            시스템 정보
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">최적화 간격</p>
              <p className="font-mono">30분</p>
            </div>
            <div>
              <p className="text-gray-600">학습 알고리즘</p>
              <p className="font-mono">Thompson Sampling</p>
            </div>
            <div>
              <p className="text-gray-600">배치 크기</p>
              <p className="font-mono">10개 조직</p>
            </div>
            <div>
              <p className="text-gray-600">마지막 업데이트</p>
              <p className="font-mono">{formatDate(data.lastUpdateAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
