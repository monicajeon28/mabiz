"use client";

import React, { useState, useEffect } from "react";
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

// Mock 데이터 (실제로는 API에서 조회)
const MOCK_DATA: DashboardData = {
  channels: [
    {
      channel: "SMS",
      sent: 5000,
      opened: 1250,
      clicked: 400,
      converted: 100,
      failed: 50,
      cost: 250000,
      openRate: 25.0,
      clickRate: 8.0,
      conversionRate: 2.0,
      roi: 0.04,
      trend: "UP",
      trendPercent: 12.5,
    },
    {
      channel: "KAKAO",
      sent: 4000,
      opened: 1800,
      clicked: 540,
      converted: 160,
      failed: 30,
      cost: 120000,
      openRate: 45.0,
      clickRate: 13.5,
      conversionRate: 4.0,
      roi: 0.133,
      trend: "UP",
      trendPercent: 18.2,
    },
    {
      channel: "EMAIL",
      sent: 6000,
      opened: 900,
      clicked: 225,
      converted: 54,
      failed: 100,
      cost: 0,
      openRate: 15.0,
      clickRate: 3.75,
      conversionRate: 0.9,
      roi: 0,
      trend: "STABLE",
      trendPercent: 0,
    },
  ],
  bestPerformer: "KAKAO",
  recommendations: [
    "💡 Kakao 채널이 최고 효율입니다 (ROI 0.133, 비용 효율 기준)",
    "📈 다채널 혼합 사용 시 전환율 +25-35% 기대",
    "🎯 Day 0-3 시퀀스에서 Kakao → SMS → Email 순서 추천",
    "📊 SMS 비용 최적화: 현재 ₩50/건 → ₩30/건 협상 시 ROI +40%",
  ],
  periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  periodEnd: new Date(),
};

export default function ChannelsPage() {
  const [data, setData] = useState<DashboardData>(MOCK_DATA);
  const [loading, setLoading] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<MessageChannel | null>(
    null
  );

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/analytics/channels");
        const result = await response.json();
        if (result.ok) {
          setData({
            ...result,
            periodStart: new Date(result.periodStart),
            periodEnd: new Date(result.periodEnd),
          });
        }
      } catch (error) {
        console.error("Failed to fetch channel data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalSent = data.channels.reduce((sum, c) => sum + c.sent, 0);
  const totalConverted = data.channels.reduce((sum, c) => sum + c.converted, 0);
  const totalCost = data.channels.reduce((sum, c) => sum + c.cost, 0);
  const avgConversionRate =
    totalSent > 0 ? ((totalConverted / totalSent) * 100).toFixed(2) : "0.00";

  const bestPerformerData = data.channels.find(
    (c) => c.channel === data.bestPerformer
  );

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
          onClick={() => setLoading(true)}
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
                  format: (v: number) => `${v.toFixed(1)}%`,
                },
                {
                  label: "클릭율",
                  key: "clickRate",
                  format: (v: number) => `${v.toFixed(1)}%`,
                },
                {
                  label: "전환율",
                  key: "conversionRate",
                  format: (v: number) => `${v.toFixed(2)}%`,
                },
                {
                  label: "ROI",
                  key: "roi",
                  format: (v: number) => `${(v * 100).toFixed(1)}%`,
                },
                {
                  label: "비용/건",
                  key: "cost",
                  format: (v: number) => {
                    const perUnit = data.channels[0]?.sent
                      ? v / data.channels[0].sent
                      : 0;
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
                        {row.format(value)}
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
