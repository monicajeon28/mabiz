"use client";

import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import useSWR from "swr";
import { AnalyticsResponse, DayMetrics } from "@/lib/types/sequence";

interface SequenceAnalyticsProps {
  sequenceId: string;
  onBack: () => void;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type DateRange = "7d" | "14d" | "30d" | "all";

function PerformanceChart({ days, metrics }: { days: number[]; metrics: number[] }) {
  const maxValue = Math.max(...metrics, 1);
  const scale = 100 / maxValue;

  return (
    <div className="flex items-end gap-2 h-32 mb-2">
      {days.map((day, idx) => (
        <div key={day} className="flex-1 flex flex-col items-center">
          <div
            className="w-full bg-gradient-to-t from-blue-400 to-blue-600 rounded-t-lg transition-all hover:from-blue-500 hover:to-blue-700"
            style={{ height: `${Math.max(metrics[idx] * scale, 5)}px` }}
          />
          <div className="text-xs text-gray-600 mt-2">Day {day}</div>
          <div className="text-xs font-semibold text-gray-900">{metrics[idx]}</div>
        </div>
      ))}
    </div>
  );
}

export function SequenceAnalytics({ sequenceId, onBack }: SequenceAnalyticsProps) {
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [displayMetrics, setDisplayMetrics] = useState<{
    days: DayMetrics[];
    overall: any;
  } | null>(null);

  const { data, isLoading } = useSWR(
    `/api/tools/day0-3-sequences/${sequenceId}/analytics?range=${dateRange}`,
    fetcher
  );

  useEffect(() => {
    if (data?.analytics) {
      setDisplayMetrics({
        days: data.analytics.byDay || [],
        overall: data.analytics.overallPerformance || {},
      });
    }
  }, [data]);

  if (isLoading) {
    return <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />;
  }

  if (!displayMetrics) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">분석 데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const { days, overall } = displayMetrics;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header with Date Range Filter */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">시퀀스 성능 분석</h2>
        <div className="flex gap-2">
          {(["7d", "14d", "30d", "all"] as DateRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                dateRange === range
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {range === "7d"
                ? "7일"
                : range === "14d"
                ? "14일"
                : range === "30d"
                ? "30일"
                : "전체"}
            </button>
          ))}
        </div>
      </div>

      {/* Overall Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
          <div className="text-xs font-medium text-blue-600 mb-1">총 발송</div>
          <div className="text-2xl font-bold text-blue-900">
            {overall.totalSent || 0}
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
          <div className="text-xs font-medium text-green-600 mb-1">열람율</div>
          <div className="text-2xl font-bold text-green-900">
            {overall.cumulativeOpenRate || "0%"}
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
          <div className="text-xs font-medium text-purple-600 mb-1">클릭율</div>
          <div className="text-2xl font-bold text-purple-900">
            {overall.cumulativeClickRate || "0%"}
          </div>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4">
          <div className="text-xs font-medium text-orange-600 mb-1">전환율</div>
          <div className="text-2xl font-bold text-orange-900">
            {overall.cumulativeConvertRate || "0%"}
          </div>
        </div>
      </div>

      {/* Day-by-Day Charts */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
        <h3 className="font-semibold text-gray-900">Day별 성능</h3>

        {/* Open Rates */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">열람율 추이</h4>
          <PerformanceChart
            days={days.map((d) => d.day || 0)}
            metrics={days.map((d) => {
              const rate = d.openRate || "0%";
              return parseInt(rate);
            })}
          />
        </div>

        {/* Click Rates */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">클릭율 추이</h4>
          <PerformanceChart
            days={days.map((d) => d.day || 0)}
            metrics={days.map((d) => {
              const rate = d.clickRate || "0%";
              return parseInt(rate);
            })}
          />
        </div>

        {/* Conversion Rates */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">전환율 추이</h4>
          <PerformanceChart
            days={days.map((d) => d.day || 0)}
            metrics={days.map((d) => {
              const rate = d.convertRate || "0%";
              return parseInt(rate);
            })}
          />
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 overflow-x-auto">
        <h3 className="font-semibold text-gray-900 mb-4">상세 데이터</h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Day</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">발송</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">열람</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">클릭</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">전환</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">열람율</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">클릭율</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">전환율</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {days.map((day, idx) => (
              <tr key={idx} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">Day {day.day}</td>
                <td className="px-4 py-3 text-right text-gray-700">{day.sent || 0}</td>
                <td className="px-4 py-3 text-right text-gray-700">{day.opened || 0}</td>
                <td className="px-4 py-3 text-right text-gray-700">{day.clicked || 0}</td>
                <td className="px-4 py-3 text-right text-gray-700">{day.converted || 0}</td>
                <td className="px-4 py-3 text-right font-semibold text-green-600">
                  {day.openRate || "0%"}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-purple-600">
                  {day.clickRate || "0%"}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-orange-600">
                  {day.convertRate || "0%"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Insights Box */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4">
        <h3 className="font-semibold text-indigo-900 mb-2">인사이트</h3>
        <ul className="space-y-1 text-sm text-indigo-800">
          <li>
            • Day 0 열람율이{" "}
            <span className="font-semibold">
              {days[0]?.openRate || "0%"}
            </span>
            입니다. 업계 평균 28-35%와 비교하여 개선이 {parseInt(days[0]?.openRate || "0") > 30 ? "필요합니다." : "잘 진행 중입니다."}
          </li>
          <li>
            • 전체 전환율은{" "}
            <span className="font-semibold">
              {overall.cumulativeConvertRate || "0%"}
            </span>
            입니다. 목표치 3-5%에 대해 검토하세요.
          </li>
          <li>
            • Day별 성능 추이를 보면, 시간이 지날수록 참여도가 감소하는 것이 일반적입니다.
          </li>
        </ul>
      </div>

      {/* Back Button */}
      <div className="flex gap-3 sticky bottom-0 bg-white py-4 border-t border-gray-200">
        <button
          onClick={onBack}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
        >
          돌아가기
        </button>
      </div>
    </div>
  );
}
