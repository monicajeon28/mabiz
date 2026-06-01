'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ReactivationDashboardProps {
  organizationId: string;
}

interface SegmentStats {
  segment: string;
  count: number;
  avgLikelihood: number;
}

interface SmsMetrics {
  day0: { sent: number; pending: number; sendRate: string };
  day1: { sent: number; pending: number; sendRate: string };
  day2: { sent: number; pending: number; sendRate: string };
  day3: { sent: number; pending: number; sendRate: string };
}

interface ConversionStage {
  stage: string;
  count: number;
  rate: string | number;
}

export default function Menu47ReactivationDashboard({ organizationId }: ReactivationDashboardProps) {
  const [selectedSegment, setSelectedSegment] = useState<'3-6m' | '6-12m' | '1y+' | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [smsMetrics, setSmsMetrics] = useState<SmsMetrics | null>(null);
  const [conversionFunnel, setConversionFunnel] = useState<ConversionStage[]>([]);

  // 데이터 로드
  useEffect(() => {
    fetchAnalytics();
  }, [selectedSegment]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/analytics/reactivation?segment=${selectedSegment === 'all' ? '' : selectedSegment}`,
      );
      const data = await response.json();

      setStats(data.summary);
      setSmsMetrics(data.smsPipeline);
      setConversionFunnel(data.conversionFunnel);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendCampaign = async (dayIndex: number, variant: 'A' | 'B') => {
    try {
      const response = await fetch('/api/sms/reactivation-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segment: selectedSegment === 'all' ? null : selectedSegment,
          dayIndex,
          variant,
          customerIds: [], // 실제로는 선택된 고객 목록
        }),
      });

      if (response.ok) {
        alert('캠페인 발송 완료!');
        fetchAnalytics();
      }
    } catch (error) {
      console.error('Failed to send campaign:', error);
    }
  };

  if (loading) {
    return <div className="p-4">로딩 중...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Menu #47: 부재중 고객 재활성화</h1>
          <p className="text-gray-600">L0 렌즈 - 6개월+ 부재 고객 재예약율 62-97% 유도</p>
        </div>
      </div>

      {/* 세그먼트 선택 */}
      <div className="flex gap-4">
        <select
          value={selectedSegment}
          onChange={(e) => setSelectedSegment(e.target.value as any)}
          className="w-48 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">전체</option>
          <option value="3-6m">3-6개월 부재</option>
          <option value="6-12m">6-12개월 부재</option>
          <option value="1y+">1년+ 부재</option>
        </select>

        <Button onClick={fetchAnalytics} variant="outline">
          새로고침
        </Button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">총 부재중 고객</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalContacts || 0}</div>
            <p className="text-sm text-gray-500">명</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">예상 전환율</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.expectedConversion || 0}%</div>
            <p className="text-sm text-gray-500">목표 62-97%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">예상 매출</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${stats?.expectedRevenue || 0}</div>
            <p className="text-sm text-gray-500">예상 재예약</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">세그먼트 수</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.segmentBreakdown?.length || 0}</div>
            <p className="text-sm text-gray-500">부재 기간별</p>
          </CardContent>
        </Card>
      </div>

      {/* 세그먼트 분석 */}
      <Card>
        <CardHeader>
          <CardTitle>세그먼트별 분석</CardTitle>
          <CardDescription>부재 기간별 고객 분포</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats?.segmentBreakdown?.map((sb: any) => (
              <div key={sb.segment} className="flex items-center justify-between rounded bg-gray-50 p-3">
                <div className="flex-1">
                  <p className="font-medium">{segmentLabel(sb.segment)}</p>
                  <p className="text-sm text-gray-500">{sb.count}명</p>
                </div>
                <div className="text-right">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${(sb.count / stats.totalContacts) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* SMS 발송 상태 */}
      <Card>
        <CardHeader>
          <CardTitle>SMS 발송 진행률</CardTitle>
          <CardDescription>Day 0-3 자동화 시퀀스 추적</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            {smsMetrics && ['day0', 'day1', 'day2', 'day3'].map((day, idx) => {
              const dayMetric = smsMetrics[day as keyof SmsMetrics];
              return (
                <div key={day} className="text-center">
                  <h3 className="font-medium text-sm mb-2">Day {idx}</h3>
                  <div className="mb-2">
                    <div className="text-lg font-bold">{dayMetric.sent}</div>
                    <div className="text-sm text-gray-500">발송완료 ({dayMetric.sendRate}%)</div>
                  </div>
                  <Button
                    size="sm"
                    variant={dayMetric.sent > 0 ? 'outline' : 'default'}
                    onClick={() => handleSendCampaign(idx, idx % 2 === 0 ? 'A' : 'B')}
                    className="w-full text-sm"
                  >
                    {dayMetric.sent > 0 ? '재발송' : '발송'}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 전환 Funnel */}
      <Card>
        <CardHeader>
          <CardTitle>전환 Funnel</CardTitle>
          <CardDescription>부재 고객 → 재예약 완료</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {conversionFunnel.map((stage, idx) => (
              <div key={idx} className="flex items-center gap-4">
                <div className="w-24 text-sm font-medium text-gray-600">{stage.stage}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-bold">{stage.count}</div>
                    <div className="flex-1 bg-gray-200 rounded-full h-6">
                      <div
                        className="bg-green-500 h-6 rounded-full flex items-center justify-center text-white text-sm font-medium"
                        style={{ width: `${typeof stage.rate === 'number' ? stage.rate : parseFloat(stage.rate as string)}%` }}
                      >
                        {typeof stage.rate === 'number' ? stage.rate : stage.rate}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 심리학 기법 안내 */}
      <Card>
        <CardHeader>
          <CardTitle>L0 렌즈: 심리학 기법</CardTitle>
          <CardDescription>적용된 심리학 원칙</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 font-bold">L6</span>
              <span>Timing Loss Aversion: 시간의 흐름(벌써 6개월) + 시간 제한(오늘만) 강조</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 font-bold">L10</span>
              <span>Immediate Purchase Closing: 즉시 구매 결정(지금 예약하세요) 촉구</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 font-bold">Scarcity</span>
              <span>희소성: 마지막 3석, 48시간 특가 종료, 2년 뒤 못 탐</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 font-bold">Social Proof</span>
              <span>사회증명: USS Liberty 탑승 고객 재예약 후기</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function segmentLabel(segment: string): string {
  const labels: Record<string, string> = {
    '3-6m': '3-6개월 부재',
    '6-12m': '6-12개월 부재',
    '1y+': '1년 이상 부재',
  };
  return labels[segment] || segment;
}
