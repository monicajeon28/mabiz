"use client";

import React, { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LTVStats {
  totalLtv: number;
  totalCruises: number;
  avgLtvPerContact: number;
  avgCruisePerContact: number;
  maxLtv: number;
  maxCruiseCount: number;
  tierDistribution: Record<string, number>;
  avgReturnInterestLevel: number;
}

interface SMSStats {
  day10: number;
  day30: number;
  day60: number;
  day90: number;
  totalEligible: number;
  conversionRate: {
    day10: number;
    day30: number;
    day60: number;
    day90: number;
  };
}

export default function L8ReturnOptimizationPage() {
  const [ltvStats, setLtvStats] = useState<LTVStats | null>(null);
  const [smsStats, setSmsStats] = useState<SMSStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);

      // Get organization ID from session/context
      const orgId = "your-org-id"; // TODO: from auth context

      const [ltvRes, smsRes] = await Promise.all([
        fetch(`/api/l8-ltv-tracking/stats?organizationId=${orgId}`),
        fetch(`/api/l8-sms-return-sequence/stats?organizationId=${orgId}`),
      ]);

      if (ltvRes.ok) {
        const ltvData = await ltvRes.json();
        setLtvStats(ltvData.stats);
      }

      if (smsRes.ok) {
        const smsData = await smsRes.json();
        setSmsStats(smsData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">로딩 중...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">L8 렌즈: 재방문 습관화</h1>
        <p className="text-gray-500 mt-2">
          크루즈 후 재방문 습관화 및 생명주기 가치(LTV) 극대화
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* LTV Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">총 LTV</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${ltvStats?.totalLtv.toLocaleString() || 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              전체 고객 생명주기 가치
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">평균 LTV/고객</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${ltvStats?.avgLtvPerContact.toLocaleString() || 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              목표: $7,500
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">총 크루즈 수</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {ltvStats?.totalCruises || 0}회
            </div>
            <p className="text-xs text-gray-500 mt-1">
              평균 {ltvStats?.avgCruisePerContact.toFixed(1) || 0}회/고객
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">재방문 의향도</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(ltvStats?.avgReturnInterestLevel || 0)}%
            </div>
            <p className="text-xs text-gray-500 mt-1">
              목표: 80%+
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="ltvTracking" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ltvTracking">LTV 추적</TabsTrigger>
          <TabsTrigger value="clubTiers">크루즈 클럽</TabsTrigger>
          <TabsTrigger value="smsSequence">SMS 자동화</TabsTrigger>
        </TabsList>

        {/* Tab 1: LTV Tracking */}
        <TabsContent value="ltvTracking" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>생명주기 가치(LTV) 분석</CardTitle>
              <CardDescription>
                고객 재방문 패턴과 누적 가치 추적
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-4">LTV 계산 공식</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center">
                    <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center mr-3 text-xs font-bold">1</span>
                    <span>크루즈 1회: <strong>$2,500</strong> (평균 예약가)</span>
                  </li>
                  <li className="flex items-center">
                    <span className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center mr-3 text-xs font-bold">2</span>
                    <span>크루즈 2회: <strong>+$2,500</strong> = $5,000 (누적)</span>
                  </li>
                  <li className="flex items-center">
                    <span className="w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center mr-3 text-xs font-bold">3+</span>
                    <span>크루즈 3회+: <strong>+$2,334</strong>/회 (재구매율 94% 기준)</span>
                  </li>
                </ul>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">목표 설정</h3>
                <div className="bg-gray-50 p-4 rounded space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>각 고객 LTV 목표</span>
                    <strong>$7,500</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>달성 기준</span>
                    <strong>3회 이상 재방문</strong>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>현재 진행률</span>
                    <strong>
                      {ltvStats
                        ? `${Math.round(
                            ((ltvStats.avgLtvPerContact || 0) / 7500) * 100
                          )}%`
                        : "0%"}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <Button className="w-full">
                  LTV 상세 분석 보기
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Cruise Club Tiers */}
        <TabsContent value="clubTiers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>크루즈 클럽 멤버 체계</CardTitle>
              <CardDescription>
                재방문 횟수별 티어 분포 및 특전
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Bronze */}
                <div className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold flex items-center">
                        <span className="w-3 h-3 bg-orange-600 rounded-full mr-2"></span>
                        Bronze 멤버
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        1회 크루즈 완료
                      </p>
                    </div>
                    <span className="text-2xl font-bold text-gray-400">
                      {ltvStats?.tierDistribution?.bronze || 0}명
                    </span>
                  </div>
                  <div className="mt-3 space-y-1 text-sm">
                    <p>✓ 10% 할인</p>
                    <p>✓ 포인트 적립</p>
                  </div>
                </div>

                {/* Silver */}
                <div className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold flex items-center">
                        <span className="w-3 h-3 bg-gray-400 rounded-full mr-2"></span>
                        Silver 멤버
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        2회 크루즈 완료
                      </p>
                    </div>
                    <span className="text-2xl font-bold text-gray-400">
                      {ltvStats?.tierDistribution?.silver || 0}명
                    </span>
                  </div>
                  <div className="mt-3 space-y-1 text-sm">
                    <p>✓ 15% 할인</p>
                    <p>✓ 무료 객실 업그레이드</p>
                    <p>✓ 우선 배정</p>
                  </div>
                </div>

                {/* Gold */}
                <div className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold flex items-center">
                        <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
                        Gold 멤버
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        3회 크루즈 완료
                      </p>
                    </div>
                    <span className="text-2xl font-bold text-gray-400">
                      {ltvStats?.tierDistribution?.gold || 0}명
                    </span>
                  </div>
                  <div className="mt-3 space-y-1 text-sm">
                    <p>✓ 20% 할인</p>
                    <p>✓ 무료 가이드 투어</p>
                    <p>✓ 전담 고객서비스</p>
                  </div>
                </div>

                {/* Platinum */}
                <div className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold flex items-center">
                        <span className="w-3 h-3 bg-blue-600 rounded-full mr-2"></span>
                        Platinum 멤버
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        4회 이상 크루즈
                      </p>
                    </div>
                    <span className="text-2xl font-bold text-gray-400">
                      {ltvStats?.tierDistribution?.platinum || 0}명
                    </span>
                  </div>
                  <div className="mt-3 space-y-1 text-sm">
                    <p>✓ 25% 할인</p>
                    <p>✓ 객실 선택권 (선착순)</p>
                    <p>✓ VIP 라운지 접근</p>
                    <p>✓ 개인 컨시어지</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: SMS Sequence */}
        <TabsContent value="smsSequence" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SMS 자동화 시퀀스</CardTitle>
              <CardDescription>
                Day 10/30/60/90 심리학 기반 메시지 발송
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Day 10 */}
              <div className="border-l-4 border-blue-500 pl-4">
                <h4 className="font-semibold text-blue-700">📊 Day 10: NPS 조사</h4>
                <p className="text-sm text-gray-600 mt-1">
                  "크루즈 후 마음이 어떠신가요?" + 만족도 평가 + $50 할인 리워드
                </p>
                <div className="mt-2 text-sm">
                  <p className="text-gray-500">
                    심리학: 감정적 재연결, 호혜성, 사회증명
                  </p>
                  <p className="text-green-600 mt-1">
                    발송: {smsStats?.conversionRate?.day10 || 0}%
                  </p>
                </div>
              </div>

              {/* Day 30 */}
              <div className="border-l-4 border-green-500 pl-4">
                <h4 className="font-semibold text-green-700">🌍 Day 30: 다음 코스 추천</h4>
                <p className="text-sm text-gray-600 mt-1">
                  "다음 여행은?" + 코스 3개 + 사진 + 조기 예약 할인
                </p>
                <div className="mt-2 text-sm">
                  <p className="text-gray-500">
                    심리학: 손실회피, 희소성, 차별성
                  </p>
                  <p className="text-green-600 mt-1">
                    발송: {smsStats?.conversionRate?.day30 || 0}%
                  </p>
                </div>
              </div>

              {/* Day 60 */}
              <div className="border-l-4 border-orange-500 pl-4">
                <h4 className="font-semibold text-orange-700">⏰ Day 60: 희소성 강조</h4>
                <p className="text-sm text-gray-600 mt-1">
                  "마감까지 3주" + "60% 이미 예약" + 동반자 50% 할인
                </p>
                <div className="mt-2 text-sm">
                  <p className="text-gray-500">
                    심리학: 희소성, 긴박감, 가족동반 설득
                  </p>
                  <p className="text-green-600 mt-1">
                    발송: {smsStats?.conversionRate?.day60 || 0}%
                  </p>
                </div>
              </div>

              {/* Day 90 */}
              <div className="border-l-4 border-red-500 pl-4">
                <h4 className="font-semibold text-red-700">🎁 Day 90: 마지막 기회</h4>
                <p className="text-sm text-gray-600 mt-1">
                  "마지막 기회" + "25% 할인" + "무료 업그레이드" + "자정 만료"
                </p>
                <div className="mt-2 text-sm">
                  <p className="text-gray-500">
                    심리학: 손실회피, 긴박감, 보상
                  </p>
                  <p className="text-green-600 mt-1">
                    발송: {smsStats?.conversionRate?.day90 || 0}%
                  </p>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <Button>SMS 수동 발송</Button>
                  <Button variant="outline">자동화 설정</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>성과 메트릭 (현재 vs 목표)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded">
              <span className="font-medium">평균 LTV/고객</span>
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold">
                  ${ltvStats?.avgLtvPerContact.toLocaleString() || 0}
                </span>
                <span className="text-gray-500">→</span>
                <span className="text-green-600 font-semibold">$7,500 목표</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded">
              <span className="font-medium">평균 재방문 횟수</span>
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold">
                  {ltvStats?.avgCruisePerContact.toFixed(1) || 0}회
                </span>
                <span className="text-gray-500">→</span>
                <span className="text-green-600 font-semibold">3회 목표</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded">
              <span className="font-medium">재방문 의향도</span>
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold">
                  {Math.round(ltvStats?.avgReturnInterestLevel || 0)}%
                </span>
                <span className="text-gray-500">→</span>
                <span className="text-green-600 font-semibold">80% 목표</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded">
              <span className="font-medium">예상 연간 반복 방문</span>
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold">
                  1-2회
                </span>
                <span className="text-gray-500">→</span>
                <span className="text-green-600 font-semibold">6개월 간격</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
