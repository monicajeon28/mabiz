'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Metrics {
  totalCompetitorMentions: number;
  byCompetitor: {
    'Royal Caribbean': number;
    'MSC Cruises': number;
    'Disney Cruise Line': number;
  };
  differentiationMessagesSent: number;
  conversionRate: number;
  avgDifferentiationScore: number;
  byExperienceLevel: Record<string, number>;
}

export default function ComparisonsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const fetchMetrics = async () => {
      try {
        const res = await fetch('/api/comparisons/metrics', { signal: ctrl.signal });
        const data = await res.json();
        if (data.ok) {
          setMetrics(data.metrics);
        } else {
          setError('메트릭 로드 실패');
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : '오류 발생');
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    };

    fetchMetrics();
    return () => ctrl.abort();
  }, []);

  if (loading) {
    return <div className="p-6 text-center">로딩 중...</div>;
  }

  if (error || !metrics) {
    return <div className="p-6 text-red-600">오류: {error}</div>;
  }

  const conversionTarget = 45; // 40-50% 목표
  const conversionDiff = metrics.conversionRate - conversionTarget;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Menu #49: L3 렌즈 대시보드</h1>
        <p className="text-gray-600 mt-2">차별성 미인지형 고객 관리 및 경쟁사 비교</p>
      </div>

      {/* KPI 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">경쟁사 언급 고객</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.totalCompetitorMentions}</div>
            <p className="text-sm text-gray-600 mt-1">명</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">차별성 메시지 발송</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.differentiationMessagesSent}</div>
            <p className="text-sm text-gray-600 mt-1">명</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">전환율</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                conversionDiff >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {metrics.conversionRate.toFixed(1)}%
            </div>
            <p className="text-sm text-gray-600 mt-1">목표: {conversionTarget}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">평균 차별성 점수</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.avgDifferentiationScore.toFixed(1)}</div>
            <p className="text-sm text-gray-600 mt-1">/100</p>
          </CardContent>
        </Card>
      </div>

      {/* 상세 분석 */}
      <Tabs defaultValue="competitor" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="competitor">경쟁사 분석</TabsTrigger>
          <TabsTrigger value="experience">경험도 분석</TabsTrigger>
        </TabsList>

        <TabsContent value="competitor" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>경쟁사별 언급 현황</CardTitle>
              <CardDescription>고객들이 언급한 경쟁사 크루즈라인</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(metrics.byCompetitor).map(([competitor, count]) => (
                <div key={competitor} className="flex items-center justify-between border-b pb-3">
                  <span className="font-medium">{competitor}</span>
                  <div className="flex items-center gap-4">
                    <div className="w-40 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${
                            metrics.totalCompetitorMentions > 0
                              ? (count / metrics.totalCompetitorMentions) * 100
                              : 0
                          }%`,
                        }}
                      ></div>
                    </div>
                    <span className="font-bold w-12 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>차별성 메시지 전략</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <h4 className="font-semibold mb-2">우리의 차별성 (L3 렌즈)</h4>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex gap-2">
                    <span className="text-green-600">✓</span>
                    <span>호텔의 편안함 + 매일 새로운 나라를 깨어나기</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-600">✓</span>
                    <span>한국인 맞춤형 (한국 스태프, 한국 음식, 맞춤 일정)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-600">✓</span>
                    <span>50-60% 저렴 (같은 가격에 호텔 3박 vs 크루즈 7박)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-600">✓</span>
                    <span>가족 중심 (kids club, family programs)</span>
                  </li>
                </ul>
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded">
                <p className="text-sm text-gray-600">
                  <strong>자동화 시퀀스:</strong> Day 0 경쟁사 언급 감지 → Day
                  1-3 구조화된 차별성 메시지 발송 → 전환율 40-50% 목표
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="experience" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>호텔 경험도별 분포</CardTitle>
              <CardDescription>
                차별성 메시지를 받은 고객의 호텔 경험 수준 분류
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(metrics.byExperienceLevel).map(([level, count]) => {
                const labels: Record<string, string> = {
                  none: '호텔 경험 없음',
                  basic: '가끔 호텔 여행',
                  frequent: '자주 호텔 여행',
                  regular: '매년 호텔 여행',
                  unknown: '미분류',
                };

                return (
                  <div key={level} className="flex items-center justify-between border-b pb-3">
                    <span className="font-medium">{labels[level] || level}</span>
                    <div className="flex items-center gap-4">
                      <div className="w-40 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{
                            width: `${
                              metrics.differentiationMessagesSent > 0
                                ? (count / metrics.differentiationMessagesSent) * 100
                                : 0
                            }%`,
                          }}
                        ></div>
                      </div>
                      <span className="font-bold w-12 text-right">{count}</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>경험도별 메시지 전략</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded">
                  <p className="font-semibold text-gray-700">호텔 경험 없음</p>
                  <p className="text-sm text-gray-600 mt-1">
                    완전히 새로운 경험 프레이밍 → 리조트처럼 편한 생활 강조
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="font-semibold text-gray-700">가끔 호텔 여행</p>
                  <p className="text-sm text-gray-600 mt-1">
                    호텔의 좋은 점 유지 + 더 나은 경험 → 업그레이드 프레이밍
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="font-semibold text-gray-700">자주 호텔 여행</p>
                  <p className="text-sm text-gray-600 mt-1">
                    호텔 여행의 진화 → 다음 단계 경험 제시
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="font-semibold text-gray-700">매년 호텔 여행</p>
                  <p className="text-sm text-gray-600 mt-1">
                    여행 방식의 혁신 → 생활 방식의 변화 제시
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 구현 체크리스트 */}
      <Card>
        <CardHeader>
          <CardTitle>구현 항목 체크리스트</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="db"
              checked
              readOnly
              className="rounded"
            />
            <label htmlFor="db" className="text-gray-700">
              DB 스키마: L3 필드 추가 (경쟁사 감지, 차별성 점수 등)
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="api1"
              checked
              readOnly
              className="rounded"
            />
            <label htmlFor="api1" className="text-gray-700">
              API 1: GET /api/comparisons/competitor (경쟁사 비교 데이터)
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="api2"
              checked
              readOnly
              className="rounded"
            />
            <label htmlFor="api2" className="text-gray-700">
              API 2: POST /api/comparisons/detect-mention (경쟁사 자동 감지 + SMS)
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="api3"
              checked
              readOnly
              className="rounded"
            />
            <label htmlFor="api3" className="text-gray-700">
              API 3: POST /api/comparisons/send-differentiation (차별성 메시지 발송)
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="api4"
              checked
              readOnly
              className="rounded"
            />
            <label htmlFor="api4" className="text-gray-700">
              API 4: GET /api/comparisons/metrics (대시보드 KPI)
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="sms"
              checked
              readOnly
              className="rounded"
            />
            <label htmlFor="sms" className="text-gray-700">
              SMS 자동화: Day 0-3 차별성 시퀀스
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="dash"
              checked
              readOnly
              className="rounded"
            />
            <label htmlFor="dash" className="text-gray-700">
              대시보드: 경쟁사 언급/차별성 메시지 성과 추적
            </label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
