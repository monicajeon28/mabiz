"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  MessageSquare,
  Mail,
  MessageCircle,
  TrendingUp,
  TrendingDown,
  Eye,
  MousePointer,
  BarChart3,
  ArrowRight,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import type { MessageChannel } from "@/lib/types/multi-channel";

interface ChannelStats {
  channel: MessageChannel;
  sent: number;
  opened: number;
  clicked: number;
  converted: number;
  failed: number;
  cost: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
  roi: number;
  trend: "UP" | "DOWN" | "STABLE";
  trendPercent: number;
}

interface DashboardData {
  channels: ChannelStats[];
  bestPerformer: MessageChannel;
  recommendations: string[];
  periodStart: Date;
  periodEnd: Date;
}

const CHANNEL_CONFIG: Record<
  MessageChannel,
  { label: string; icon: React.ReactNode; bgColor: string; color: string }
> = {
  SMS: {
    label: "SMS",
    icon: <MessageSquare className="w-5 h-5" />,
    bgColor: "bg-blue-50",
    color: "text-blue-600",
  },
  KAKAO: {
    label: "카카오",
    icon: <MessageCircle className="w-5 h-5" />,
    bgColor: "bg-yellow-50",
    color: "text-yellow-600",
  },
  EMAIL: {
    label: "이메일",
    icon: <Mail className="w-5 h-5" />,
    bgColor: "bg-purple-50",
    color: "text-purple-600",
  },
};


export default function ChannelsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<MessageChannel | null>(
    null
  );

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/analytics/channels", { signal });
      const result = await response.json();
      if (result.ok) {
        setData({
          ...result,
          periodStart: new Date(result.periodStart),
          periodEnd: new Date(result.periodEnd),
        });
      } else {
        setError(result.message || "데이터를 불러올 수 없습니다.");
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError("채널 데이터 로드 중 오류가 발생했습니다.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchData(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchData]);

  const totalSent = data?.channels.reduce((sum, c) => sum + c.sent, 0) ?? 0;
  const totalConverted = data?.channels.reduce((sum, c) => sum + c.converted, 0) ?? 0;
  const totalCost = data?.channels.reduce((sum, c) => sum + c.cost, 0) ?? 0;
  const avgConversionRate =
    totalSent > 0 ? ((totalConverted / totalSent) * 100).toFixed(2) : "0.00";

  const bestPerformerData = data?.channels.find(
    (c) => c.channel === data.bestPerformer
  );

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto flex items-center justify-center min-h-64">
        <div className="text-center text-gray-500">데이터를 불러오는 중...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-64 gap-4">
        <div className="text-center text-red-500">{error ?? "데이터 없음"}</div>
        <button
          onClick={() => fetchData()}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          📊 채널 성과 분석
        </h1>
        <p className="text-gray-600">
          SMS, 카카오, 이메일 채널 비교분석 및 최적화 권장
        </p>
      </div>

      {/* 기간 선택 및 새로고침 */}
      <div className="flex gap-3 mb-6">
        <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
          지난 7일
        </button>
        <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-blue-50">
          지난 30일
        </button>
        <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
          지난 90일
        </button>
        <button
          onClick={() => fetchData()}
          className="ml-auto px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          새로고침
        </button>
      </div>

      {/* KPI 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">총 발송</div>
          <div className="text-3xl font-bold text-gray-900 mb-2">
            {totalSent.toLocaleString()}
          </div>
          <div className="text-sm text-gray-500">건</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">
            총 전환
          </div>
          <div className="text-3xl font-bold text-green-600 mb-2">
            {totalConverted}
          </div>
          <div className="text-sm text-gray-500">
            {avgConversionRate}% 전환율
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">
            총 비용
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-2">
            ₩{(totalCost / 1000).toFixed(0)}K
          </div>
          <div className="text-sm text-gray-500">3채널 합계</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">
            최고 성과
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-2">
            {CHANNEL_CONFIG[data.bestPerformer]?.label}
          </div>
          <div className="text-sm text-gray-500 flex items-center gap-1">
            ROI {bestPerformerData?.roi.toFixed(2) || 0}
          </div>
        </div>
      </div>

      {/* 채널별 상세 카드 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {data.channels.map((channel) => {
          const config = CHANNEL_CONFIG[channel.channel];
          const isHighlight = channel.channel === data.bestPerformer;

          return (
            <div
              key={channel.channel}
              onClick={() =>
                setSelectedChannel(
                  selectedChannel === channel.channel
                    ? null
                    : channel.channel
                )
              }
              className={`rounded-lg border-2 p-6 cursor-pointer transition-all ${
                isHighlight
                  ? "bg-gradient-to-br from-green-50 to-emerald-50 border-green-300"
                  : selectedChannel === channel.channel
                    ? "bg-blue-50 border-blue-300"
                    : "bg-white border-gray-200 hover:border-gray-300"
              }`}
            >
              {/* 채널 헤더 */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${config.bgColor}`}>
                    <span className={config.color}>{config.icon}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {config.label}
                    </h3>
                    {isHighlight && (
                      <span className="text-sm font-medium text-green-600">
                        ⭐ 최고 성과
                      </span>
                    )}
                  </div>
                </div>

                {/* 추세 */}
                <div className="flex items-center gap-1">
                  {channel.trend === "UP" ? (
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  ) : channel.trend === "DOWN" ? (
                    <TrendingDown className="w-4 h-4 text-red-600" />
                  ) : (
                    <div className="w-4 h-4 text-gray-600">→</div>
                  )}
                  <span
                    className={`text-sm font-semibold ${
                      channel.trend === "UP"
                        ? "text-green-600"
                        : channel.trend === "DOWN"
                          ? "text-red-600"
                          : "text-gray-600"
                    }`}
                  >
                    {channel.trend === "UP" ? "+" : ""}
                    {channel.trendPercent.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* 주요 메트릭 그리드 */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white/50 rounded p-3">
                  <div className="text-sm text-gray-600 mb-1">발송</div>
                  <div className="text-xl font-bold text-gray-900">
                    {channel.sent.toLocaleString()}
                  </div>
                </div>

                <div className="bg-white/50 rounded p-3">
                  <div className="text-sm text-gray-600 mb-1">개방</div>
                  <div className="text-xl font-bold text-gray-900">
                    {channel.opened}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {channel.openRate.toFixed(1)}%
                  </div>
                </div>

                <div className="bg-white/50 rounded p-3">
                  <div className="text-sm text-gray-600 mb-1">클릭</div>
                  <div className="text-xl font-bold text-gray-900">
                    {channel.clicked}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {channel.clickRate.toFixed(1)}%
                  </div>
                </div>

                <div className="bg-white/50 rounded p-3">
                  <div className="text-sm text-gray-600 mb-1">전환</div>
                  <div className="text-xl font-bold text-green-600">
                    {channel.converted}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {channel.conversionRate.toFixed(2)}%
                  </div>
                </div>
              </div>

              {/* 비용 및 ROI */}
              <div className="border-t border-gray-200 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">비용</span>
                  <span className="text-sm font-bold text-gray-900">
                    ₩{(channel.cost / 1000).toFixed(0)}K
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">ROI</span>
                  <span
                    className={`text-sm font-bold ${
                      channel.roi > 0 ? "text-green-600" : "text-gray-600"
                    }`}
                  >
                    {(channel.roi * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* 실패율 */}
              {channel.failed > 0 && (
                <div className="mt-3 bg-red-50 rounded p-2 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-700">
                    {channel.failed}건 발송 실패 (
                    {((channel.failed / channel.sent) * 100).toFixed(1)}%)
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 채널 비교 매트릭스 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          채널 비교 분석
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-700">
                  지표
                </th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">
                  SMS
                </th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">
                  카카오
                </th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">
                  이메일
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  label: "개방율",
                  key: "openRate",
                  format: (v: number, _ch: ChannelStats) => `${v.toFixed(1)}%`,
                },
                {
                  label: "클릭율",
                  key: "clickRate",
                  format: (v: number, _ch: ChannelStats) => `${v.toFixed(1)}%`,
                },
                {
                  label: "전환율",
                  key: "conversionRate",
                  format: (v: number, _ch: ChannelStats) => `${v.toFixed(2)}%`,
                },
                {
                  label: "ROI",
                  key: "roi",
                  format: (v: number, _ch: ChannelStats) => `${(v * 100).toFixed(1)}%`,
                },
                {
                  label: "비용/건",
                  key: "cost",
                  format: (v: number, ch: ChannelStats) => {
                    const perUnit = ch.sent > 0 ? v / ch.sent : 0;
                    return `₩${perUnit.toFixed(0)}`;
                  },
                },
              ].map((row) => (
                <tr key={row.key} className="border-b border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {row.label}
                  </td>
                  {data.channels.map((channel) => {
                    const value = channel[row.key as keyof typeof channel] as number;
                    const isHighest =
                      data.channels.every(
                        (c) =>
                          (c[row.key as keyof typeof c] as number) <= value
                      ) && value > 0;

                    return (
                      <td
                        key={channel.channel}
                        className={`px-4 py-3 text-center font-semibold ${
                          isHighest ? "bg-green-50 text-green-700" : "text-gray-900"
                        }`}
                      >
                        {row.format(value, channel)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 추천사항 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          💡 최적화 추천사항
        </h2>

        <div className="space-y-3">
          {data.recommendations.map((rec, idx) => (
            <div key={idx} className="flex gap-3">
              <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-blue-200 text-blue-700 text-sm font-bold">
                {idx + 1}
              </div>
              <p className="text-sm text-gray-700">{rec}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
