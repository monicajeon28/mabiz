'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ReactivationDashboardProps {
  organizationId: string;
}

interface SegmentStats {
  segment: string;
  count: number;
  avgLikelihood: number;
}

/** /api/segments/reactivation 실제 응답 형태 */
interface ReactivationApiResponse {
  segments: SegmentStats[];
  total: number;
  timestamp: string;
}

/** 컴포넌트 내부 표시용 summary */
interface DashboardSummary {
  totalContacts: number;
  expectedConversion: number;
  expectedRevenue: number;
  segmentBreakdown: SegmentStats[];
}

export default function Menu47ReactivationDashboard({ organizationId }: ReactivationDashboardProps) {
  const [selectedSegment, setSelectedSegment] = useState<'3-6m' | '6-12m' | '1y+' | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<DashboardSummary | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 데이터 로드
  useEffect(() => {
    fetchAnalytics();
    // cleanup: 언마운트 또는 selectedSegment 변경 시 이전 요청 취소
    return () => {
      abortRef.current?.abort();
    };
  }, [selectedSegment]);

  const fetchAnalytics = async () => {
    // 이전 요청 취소
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const params = new URLSearchParams({ organizationId });
      if (selectedSegment !== 'all') {
        // 세그먼트별 daysInactive 매핑
        const daysMap: Record<string, string> = {
          '3-6m': '90',
          '6-12m': '180',
          '1y+': '365',
        };
        params.set('daysInactive', daysMap[selectedSegment] ?? '180');
      }

      const response = await fetch(
        `/api/segments/reactivation?${params.toString()}`,
        { signal: controller.signal },
      );
      const data: ReactivationApiResponse = await response.json();

      // 실제 응답(segments, total)을 컴포넌트 표시 구조로 매핑
      // avgLikelihood를 가중 평균하여 예상 전환율 산출
      const weightedLikelihood =
        data.total > 0
          ? Math.round(
              data.segments.reduce((sum, s) => sum + s.avgLikelihood * s.count, 0) / data.total,
            )
          : 0;

      // 예상 매출: 총 고객 × 전환율 × 평균 객단가(임시 1,200,000원 기준)
      const avgOrderValue = 1200000;
      const expectedRevenue = Math.round(data.total * (weightedLikelihood / 100) * avgOrderValue);

      // 선택된 세그먼트가 있으면 해당 세그먼트만 필터링해서 breakdown으로 표시
      const breakdown =
        selectedSegment === 'all'
          ? data.segments
          : data.segments.filter((s) => s.segment === selectedSegment);

      setStats({
        totalContacts: data.total,
        expectedConversion: weightedLikelihood,
        expectedRevenue,
        segmentBreakdown: breakdown,
      });
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      console.error('Failed to fetch reactivation segments:', error);
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
          organizationId,
          segment: selectedSegment === 'all' ? null : selectedSegment,
          dayIndex,
          variant,
          customerIds: [],
        }),
      });

      if (response.ok) {
        void fetchAnalytics();
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
            <div className="text-3xl font-bold">
              {stats?.expectedRevenue ? `₩${stats.expectedRevenue.toLocaleString('ko-KR')}` : '₩0'}
            </div>
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

      {/* SMS Day 0-3 캠페인 발송 */}
      <Card>
        <CardHeader>
          <CardTitle>SMS Day 0-3 캠페인</CardTitle>
          <CardDescription>자동화 시퀀스 수동 발송</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            {(['Day 0', 'Day 1', 'Day 2', 'Day 3'] as const).map((label, idx) => (
              <div key={label} className="text-center">
                <h3 className="font-medium text-sm mb-2">{label}</h3>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleSendCampaign(idx, idx % 2 === 0 ? 'A' : 'B')}
                  className="w-full text-sm"
                >
                  발송
                </Button>
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
