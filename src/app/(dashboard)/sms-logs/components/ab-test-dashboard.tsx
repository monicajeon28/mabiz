"use client";

import { useEffect, useState, useCallback } from "react";
import React from "react";
import type { SmsABTestDTO, TimelineEntryDTO } from "@/lib/types/ab-test";
import { logger } from "@/lib/logger";

interface ABTestDashboardProps {
  orgId: string;
}

const formatPercent = (value: number, decimals = 2) => {
  return `${(value * 100).toFixed(decimals)}%`;
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${M}-${D} ${h}:${m}`;
};

const getStatSigColor = (isSig: boolean) => {
  return isSig ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200";
};

const getWinnerBadge = (winner: string | undefined) => {
  if (!winner) return null;
  return winner === "A" ? (
    <span className="bg-blue-100 text-blue-700 text-sm px-2 py-1 rounded-full font-medium">
      A Winner
    </span>
  ) : (
    <span className="bg-purple-100 text-purple-700 text-sm px-2 py-1 rounded-full font-medium">
      B Winner
    </span>
  );
};

export default function ABTestDashboard({ orgId }: ABTestDashboardProps) {
  const [tests, setTests] = useState<SmsABTestDTO[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntryDTO[]>([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch tests list
  const fetchTests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        days: String(days),
        limit: "50",
      });

      const response = await fetch(`/api/sms-ab-tests?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch A/B tests");
      }

      const data = await response.json();
      setTests(data.data || []);

      // Auto-select first test if available and none selected
      if (data.data && data.data.length > 0 && !selectedTestId) {
        setSelectedTestId(data.data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading A/B tests");
    } finally {
      setLoading(false);
    }
  }, [days, selectedTestId]);

  // Fetch timeline for selected test
  const fetchTimeline = useCallback(async (testId: string) => {
    try {
      setLoadingTimeline(true);
      const response = await fetch(`/api/sms-ab-tests/${testId}/timeline`);
      if (!response.ok) {
        throw new Error("Failed to fetch timeline");
      }
      const data = await response.json();
      setTimeline(data.data || []);
    } catch (err) {
      logger.error("Error loading timeline:", { error: err instanceof Error ? err.message : String(err) });
      setTimeline([]);
    } finally {
      setLoadingTimeline(false);
    }
  }, []);

  // Fetch tests on mount and when days change
  useEffect(() => {
    if (orgId) {
      fetchTests();
    }
  }, [orgId, days, fetchTests]);

  // Fetch timeline when selected test changes
  useEffect(() => {
    if (selectedTestId) {
      fetchTimeline(selectedTestId);
    }
  }, [selectedTestId, fetchTimeline]);

  const selectedTest = tests.find((t) => t.id === selectedTestId);

  if (loading) {
    return (
      <div className="bg-white border rounded-lg p-6">
        <div className="flex justify-center items-center py-8">
          <p className="text-center text-gray-500">A/B 테스트를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
        {error}
      </div>
    );
  }

  if (tests.length === 0) {
    return (
      <div className="bg-white border rounded-lg p-6">
        <p className="text-center text-gray-500 py-8">A/B 테스트가 없습니다. 새로 생성해주세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">A/B 테스트 분석</h2>
        <p className="text-sm text-gray-500 mt-1">
          SMS 캠프 변형별 성과 비교 및 통계 분석 (95% 신뢰도)
        </p>
      </div>

      {/* Test Selection Filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label htmlFor="test-select" className="text-sm text-gray-600 whitespace-nowrap">
            테스트 선택
          </label>
          <select
            id="test-select"
            value={selectedTestId || ""}
            onChange={(e) => setSelectedTestId(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- 선택하기 --</option>
            {tests.map((test) => (
              <option key={test.id} value={test.id}>
                {test.name} ({test.objectiveType})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="days-filter" className="text-sm text-gray-600 whitespace-nowrap">
            기간
          </label>
          <select
            id="days-filter"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="border rounded-md px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={1}>1일</option>
            <option value={3}>3일</option>
            <option value={7}>7일</option>
            <option value={14}>14일</option>
            <option value={30}>30일</option>
          </select>
        </div>
      </div>

      {selectedTest ? (
        <>
          {/* Test Info */}
          <div className="bg-white border rounded-lg p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">테스트명</p>
                <p className="font-semibold text-gray-900">{selectedTest.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">목표</p>
                <p className="font-semibold text-gray-900">{selectedTest.objectiveType}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">심리학 렌즈</p>
                <p className="font-semibold text-gray-900">{selectedTest.psychologyLens || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">상태</p>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm px-2 py-1 rounded-full font-medium ${
                      selectedTest.status === "ACTIVE"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {selectedTest.status}
                  </span>
                  {selectedTest.declaredWinner && getWinnerBadge(selectedTest.declaredWinner)}
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t text-sm text-gray-500">
              <span>시작: {formatDate(selectedTest.startedAt)}</span>
              {selectedTest.endedAt && (
                <span className="ml-4">종료: {formatDate(selectedTest.endedAt)}</span>
              )}
            </div>
          </div>

          {/* A vs B Comparison Table */}
          <div className={`border rounded-lg p-4 ${getStatSigColor(selectedTest.statistics.isStatisticallySignificant)}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">A vs B 비교</h3>
              <div className="flex items-center gap-2 text-sm">
                <span className={`font-semibold ${selectedTest.statistics.isStatisticallySignificant ? "text-green-700" : "text-gray-700"}`}>
                  p-value: {selectedTest.statistics.pValue.toFixed(4)}
                </span>
                {selectedTest.statistics.isStatisticallySignificant && (
                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-sm font-medium">
                    ✓ 유의미 (p &lt; 0.05)
                  </span>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-white">
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">지표</th>
                    <th className="text-center px-4 py-3 font-semibold text-blue-700">A (기존)</th>
                    <th className="text-center px-4 py-3 font-semibold text-purple-700">B (신규)</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700">차이</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700">비율(%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {/* Sent */}
                  <tr>
                    <td className="px-4 py-3 text-gray-700 font-medium">발송수</td>
                    <td className="text-center px-4 py-3 text-gray-900 font-semibold">
                      {selectedTest.currentMetrics.groupA.sent.toLocaleString()}
                    </td>
                    <td className="text-center px-4 py-3 text-gray-900 font-semibold">
                      {selectedTest.currentMetrics.groupB.sent.toLocaleString()}
                    </td>
                    <td className="text-center px-4 py-3 text-gray-600">
                      {(selectedTest.currentMetrics.groupB.sent - selectedTest.currentMetrics.groupA.sent).toLocaleString()}
                    </td>
                    <td className="text-center px-4 py-3 text-gray-600">
                      {selectedTest.currentMetrics.groupA.sent > 0
                        ? (((selectedTest.currentMetrics.groupB.sent - selectedTest.currentMetrics.groupA.sent) / selectedTest.currentMetrics.groupA.sent) * 100).toFixed(1)
                        : "0"}%
                    </td>
                  </tr>

                  {/* Open Rate */}
                  <tr className="bg-blue-50">
                    <td className="px-4 py-3 text-gray-700 font-medium">오픈율</td>
                    <td className="text-center px-4 py-3 text-gray-900 font-semibold">
                      {formatPercent(selectedTest.currentMetrics.groupA.openRate)}
                    </td>
                    <td className="text-center px-4 py-3 text-gray-900 font-semibold">
                      {formatPercent(selectedTest.currentMetrics.groupB.openRate)}
                    </td>
                    <td className="text-center px-4 py-3">
                      <span className={`text-sm font-medium ${
                        selectedTest.currentMetrics.groupB.openRate > selectedTest.currentMetrics.groupA.openRate
                          ? "text-green-600"
                          : "text-red-600"
                      }`}>
                        {formatPercent(
                          selectedTest.currentMetrics.groupB.openRate - selectedTest.currentMetrics.groupA.openRate
                        )}
                      </span>
                    </td>
                    <td className="text-center px-4 py-3 text-gray-600 text-sm">
                      {selectedTest.currentMetrics.groupA.openRate > 0
                        ? (((selectedTest.currentMetrics.groupB.openRate - selectedTest.currentMetrics.groupA.openRate) / selectedTest.currentMetrics.groupA.openRate) * 100).toFixed(1)
                        : "0"}%
                    </td>
                  </tr>

                  {/* Click Rate */}
                  <tr>
                    <td className="px-4 py-3 text-gray-700 font-medium">클릭율</td>
                    <td className="text-center px-4 py-3 text-gray-900 font-semibold">
                      {formatPercent(selectedTest.currentMetrics.groupA.clickRate)}
                    </td>
                    <td className="text-center px-4 py-3 text-gray-900 font-semibold">
                      {formatPercent(selectedTest.currentMetrics.groupB.clickRate)}
                    </td>
                    <td className="text-center px-4 py-3">
                      <span className={`text-sm font-medium ${
                        selectedTest.currentMetrics.groupB.clickRate > selectedTest.currentMetrics.groupA.clickRate
                          ? "text-green-600"
                          : "text-red-600"
                      }`}>
                        {formatPercent(
                          selectedTest.currentMetrics.groupB.clickRate - selectedTest.currentMetrics.groupA.clickRate
                        )}
                      </span>
                    </td>
                    <td className="text-center px-4 py-3 text-gray-600 text-sm">
                      {selectedTest.currentMetrics.groupA.clickRate > 0
                        ? (((selectedTest.currentMetrics.groupB.clickRate - selectedTest.currentMetrics.groupA.clickRate) / selectedTest.currentMetrics.groupA.clickRate) * 100).toFixed(1)
                        : "0"}%
                    </td>
                  </tr>

                  {/* Conversion Rate */}
                  <tr className="bg-green-50">
                    <td className="px-4 py-3 text-gray-700 font-medium">전환율</td>
                    <td className="text-center px-4 py-3 text-gray-900 font-semibold">
                      {formatPercent(selectedTest.currentMetrics.groupA.conversionRate)}
                    </td>
                    <td className="text-center px-4 py-3 text-gray-900 font-semibold">
                      {formatPercent(selectedTest.currentMetrics.groupB.conversionRate)}
                    </td>
                    <td className="text-center px-4 py-3">
                      <span className={`text-sm font-semibold ${
                        selectedTest.currentMetrics.groupB.conversionRate > selectedTest.currentMetrics.groupA.conversionRate
                          ? "text-green-700"
                          : "text-red-700"
                      }`}>
                        {formatPercent(
                          selectedTest.currentMetrics.groupB.conversionRate - selectedTest.currentMetrics.groupA.conversionRate
                        )}
                      </span>
                    </td>
                    <td className="text-center px-4 py-3 text-gray-600 text-sm font-semibold">
                      {selectedTest.currentMetrics.groupA.conversionRate > 0
                        ? (((selectedTest.currentMetrics.groupB.conversionRate - selectedTest.currentMetrics.groupA.conversionRate) / selectedTest.currentMetrics.groupA.conversionRate) * 100).toFixed(1)
                        : "0"}%
                    </td>
                  </tr>

                  {/* Response Rate */}
                  <tr>
                    <td className="px-4 py-3 text-gray-700 font-medium">응답율</td>
                    <td className="text-center px-4 py-3 text-gray-900 font-semibold">
                      {formatPercent(selectedTest.currentMetrics.groupA.responseRate)}
                    </td>
                    <td className="text-center px-4 py-3 text-gray-900 font-semibold">
                      {formatPercent(selectedTest.currentMetrics.groupB.responseRate)}
                    </td>
                    <td className="text-center px-4 py-3">
                      <span className={`text-sm font-medium ${
                        selectedTest.currentMetrics.groupB.responseRate > selectedTest.currentMetrics.groupA.responseRate
                          ? "text-green-600"
                          : "text-red-600"
                      }`}>
                        {formatPercent(
                          selectedTest.currentMetrics.groupB.responseRate - selectedTest.currentMetrics.groupA.responseRate
                        )}
                      </span>
                    </td>
                    <td className="text-center px-4 py-3 text-gray-600 text-sm">
                      {selectedTest.currentMetrics.groupA.responseRate > 0
                        ? (((selectedTest.currentMetrics.groupB.responseRate - selectedTest.currentMetrics.groupA.responseRate) / selectedTest.currentMetrics.groupA.responseRate) * 100).toFixed(1)
                        : "0"}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Statistics Section */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Chi-square & Z-score */}
            <div className="bg-white border rounded-lg p-4">
              <p className="text-sm text-gray-500 mb-2">통계 검정</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">χ² (Chi-square)</span>
                  <span className="font-semibold text-gray-900">
                    {selectedTest.statistics.chiSquare.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Z-score</span>
                  <span className="font-semibold text-gray-900">
                    {selectedTest.statistics.zScore.toFixed(4)}
                  </span>
                </div>
              </div>
            </div>

            {/* Effect Size */}
            <div className="bg-white border rounded-lg p-4">
              <p className="text-sm text-gray-500 mb-2">효과 크기</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Relative Risk</span>
                  <span className="font-semibold text-gray-900">
                    {selectedTest.statistics.relativeRisk.toFixed(2)}x
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Odds Ratio</span>
                  <span className="font-semibold text-gray-900">
                    {selectedTest.statistics.oddsRatio.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Confidence Intervals */}
            <div className="bg-white border rounded-lg p-4">
              <p className="text-sm text-gray-500 mb-2">95% 신뢰 구간</p>
              <div className="space-y-2">
                <div className="text-sm">
                  <p className="text-gray-600">A: [{(selectedTest.statistics.confidenceIntervals.A.lower * 100).toFixed(1)}% - {(selectedTest.statistics.confidenceIntervals.A.upper * 100).toFixed(1)}%]</p>
                </div>
                <div className="text-sm">
                  <p className="text-gray-600">B: [{(selectedTest.statistics.confidenceIntervals.B.lower * 100).toFixed(1)}% - {(selectedTest.statistics.confidenceIntervals.B.upper * 100).toFixed(1)}%]</p>
                </div>
                <div className="text-sm">
                  <p className="text-gray-600">Diff: [{(selectedTest.statistics.confidenceIntervals.difference.lower * 100).toFixed(1)}% - {(selectedTest.statistics.confidenceIntervals.difference.upper * 100).toFixed(1)}%]</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recommendation */}
          <div className={`rounded-lg p-4 ${
            selectedTest.statistics.isStatisticallySignificant
              ? "bg-green-50 border border-green-200"
              : "bg-blue-50 border border-blue-200"
          }`}>
            <p className="text-sm font-semibold text-gray-900 mb-2">권장사항</p>
            <p className="text-sm text-gray-700 leading-relaxed">
              {selectedTest.recommendation}
            </p>
          </div>

          {/* Day-by-Day Timeline */}
          {timeline && timeline.length > 0 && (
            <div className="bg-white border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">일별 성과 추이</h3>
              {loadingTimeline ? (
                <p className="text-center text-gray-500 py-6">불러오는 중...</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left px-3 py-2 font-medium text-gray-600">날짜</th>
                        <th className="text-center px-3 py-2 font-medium text-blue-700">A 전환율</th>
                        <th className="text-center px-3 py-2 font-medium text-purple-700">B 전환율</th>
                        <th className="text-center px-3 py-2 font-medium text-gray-600">p-value</th>
                        <th className="text-center px-3 py-2 font-medium text-gray-600">유의미</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {timeline.slice(-7).map((entry) => (
                        <tr key={entry.date} className="hover:bg-gray-50 transition-colors">
                          <td className="px-3 py-2 text-gray-600">{entry.date}</td>
                          <td className="text-center px-3 py-2 text-gray-900 font-medium">{formatPercent(entry.groupA.rate)}</td>
                          <td className="text-center px-3 py-2 text-gray-900 font-medium">{formatPercent(entry.groupB.rate)}</td>
                          <td className="text-center px-3 py-2 text-gray-600">{entry.statistics.pValue.toFixed(4)}</td>
                          <td className="text-center px-3 py-2">
                            {entry.statistics.isSignificant ? (
                              <span className="text-sm bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">Yes</span>
                            ) : (
                              <span className="text-sm bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">No</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Template Comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">A (기존 템플릿)</h4>
              <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded border border-blue-200 break-words whitespace-pre-wrap max-h-48 overflow-y-auto">
                {selectedTest.variantATemplate}
              </p>
            </div>
            <div className="bg-white border rounded-lg p-4">
              <h4 className="text-sm font-semibold text-purple-900 mb-2">B (신규 템플릿)</h4>
              <p className="text-sm text-gray-700 bg-purple-50 p-3 rounded border border-purple-200 break-words whitespace-pre-wrap max-h-48 overflow-y-auto">
                {selectedTest.variantBTemplate}
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-gray-50 border rounded-lg p-6 text-center">
          <p className="text-gray-500">테스트를 선택하여 상세 분석을 확인하세요</p>
        </div>
      )}
    </div>
  );
}
