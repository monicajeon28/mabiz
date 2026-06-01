'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface AnxietyStats {
  totalContacts: number;
  highAnxiety: number;
  mediumAnxiety: number;
  lowAnxiety: number;
  avgScore: number;
  smsClickRate: number;
  consultationBookingRate: number;
  conversionRate: number;
}

interface AnxietyBreakdown {
  category: 'low' | 'medium' | 'high';
  count: number;
  percentage: number;
  color: string;
}

interface PreparationStageBreakdown {
  stage: string;
  count: number;
}

interface SmsPerformance {
  day: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
}

export function Menu48AnxietyDashboard() {
  const [stats, setStats] = useState<AnxietyStats | null>(null);
  const [anxietyBreakdown, setAnxietyBreakdown] = useState<AnxietyBreakdown[]>([]);
  const [prepStages, setPrepStages] = useState<PreparationStageBreakdown[]>([]);
  const [smsPerformance, setSmsPerformance] = useState<SmsPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // 실제 API 호출로 대체 필요
      setStats({
        totalContacts: 324,
        highAnxiety: 98,
        mediumAnxiety: 126,
        lowAnxiety: 100,
        avgScore: 54.2,
        smsClickRate: 38.5,
        consultationBookingRate: 22.8,
        conversionRate: 78.5,
      });

      setAnxietyBreakdown([
        { category: 'high', count: 98, percentage: 30.2, color: '#ef4444' },
        { category: 'medium', count: 126, percentage: 38.9, color: '#f97316' },
        { category: 'low', count: 100, percentage: 30.9, color: '#22c55e' },
      ]);

      setPrepStages([
        { stage: 'inquiry', count: 45 },
        { stage: 'visa_concern', count: 78 },
        { stage: 'health_concern', count: 54 },
        { stage: 'passport_concern', count: 89 },
        { stage: 'ready', count: 58 },
      ]);

      setSmsPerformance([
        { day: 0, openRate: 72, clickRate: 35, conversionRate: 18 },
        { day: 1, openRate: 68, clickRate: 42, conversionRate: 24 },
        { day: 2, openRate: 65, clickRate: 45, conversionRate: 28 },
        { day: 3, openRate: 78, clickRate: 58, conversionRate: 38 },
      ]);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96">로딩 중...</div>;
  }

  if (!stats) {
    return <div>데이터를 불러올 수 없습니다.</div>;
  }

  const anxietyColors = {
    high: '#ef4444',
    medium: '#f97316',
    low: '#22c55e',
  };

  const getCategoryLabel = (category: 'low' | 'medium' | 'high') => {
    const labels = {
      high: '높음 (80점+)',
      medium: '중간 (40-79점)',
      low: '낮음 (0-39점)',
    };
    return labels[category];
  };

  const getCategoryBadgeVariant = (category: 'low' | 'medium' | 'high') => {
    const variants: Record<string, any> = {
      high: 'destructive',
      medium: 'secondary',
      low: 'outline',
    };
    return variants[category];
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-3xl font-bold">Menu #48: L2 렌즈 불안도 관리 대시보드</h1>
        <p className="text-gray-600 mt-2">
          준비 불안 고객을 위한 SPIN 기반 5단계 자동화 시퀀스
        </p>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              전체 고객
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalContacts}</div>
            <p className="text-sm text-gray-500 mt-1">L2 평가 완료</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              높은 불안도
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.highAnxiety}</div>
            <p className="text-sm text-gray-500 mt-1">
              {((stats.highAnxiety / stats.totalContacts) * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              SMS 클릭율
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.smsClickRate.toFixed(1)}%</div>
            <p className="text-sm text-gray-500 mt-1">Day 0-3 평균</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              상담 예약율
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.consultationBookingRate.toFixed(1)}%</div>
            <p className="text-sm text-gray-500 mt-1">고불안도 고객</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              예약 완료율
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.conversionRate.toFixed(1)}%
            </div>
            <p className="text-sm text-gray-500 mt-1">목표: 75%</p>
          </CardContent>
        </Card>
      </div>

      {/* 불안도 분포 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>불안도 분포</CardTitle>
            <CardDescription>
              고객별 불안도 레벨 분류
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={anxietyBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry: any) =>
                      `${getCategoryLabel(entry.category)} ${entry.percentage}%`
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {anxietyBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => (value !== undefined ? `${value}명` : '')} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 space-y-3">
              {anxietyBreakdown.map((item) => (
                <div key={item.category} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm font-medium">
                      {getCategoryLabel(item.category)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{item.count}명</span>
                    <span className="text-sm text-gray-500">
                      ({item.percentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 준비 단계별 분포 */}
        <Card>
          <CardHeader>
            <CardTitle>준비 단계별 분포</CardTitle>
            <CardDescription>
              고객의 준비 현황 매핑
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={prepStages}
                margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="stage"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  tick={{ fontSize: 12 }}
                />
                <YAxis />
                <Tooltip formatter={(value: any) => (value !== undefined ? `${value}명` : '')} />
                <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-4">
              <h4 className="text-sm font-semibold mb-2">준비 단계 설명</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• inquiry: 초기 문의 (결정 전)</li>
                <li>• visa_concern: 비자 준비 불안</li>
                <li>• health_concern: 건강 관련 우려</li>
                <li>• passport_concern: 여권 갱신 필요</li>
                <li>• ready: 준비 완료 (탑승 준비)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SMS 시퀀스 성과 */}
      <Card>
        <CardHeader>
          <CardTitle>Day 0-3 SMS 시퀀스 성과</CardTitle>
          <CardDescription>
            PASONA + 손실회피 심리학 기반 자동화 메시지 성과
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={smsPerformance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="day"
                label={{ value: 'Day', position: 'insideBottomRight', offset: -5 }}
              />
              <YAxis label={{ value: '비율 (%)', angle: -90, position: 'insideLeft' }} />
              <Tooltip formatter={(value: any) => (value !== undefined ? `${value}%` : '')} />
              <Legend />
              <Line
                type="monotone"
                dataKey="openRate"
                stroke="#3b82f6"
                name="오픈율"
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="clickRate"
                stroke="#10b981"
                name="클릭율"
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="conversionRate"
                stroke="#f59e0b"
                name="전환율"
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <h5 className="text-sm font-semibold text-blue-900">Day 0: SPIN 질문</h5>
              <p className="text-sm text-blue-700 mt-1">
                초기 인식 & 문제 발견
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <h5 className="text-sm font-semibold text-green-900">Day 1: 해결책 제시</h5>
              <p className="text-sm text-green-700 mt-1">
                세그먼트별 가이드 PDF
              </p>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg">
              <h5 className="text-sm font-semibold text-amber-900">Day 2-3: 행동 유도</h5>
              <p className="text-sm text-amber-700 mt-1">
                증거 + 긴박감 + 클로징
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 심리학 프레임워크 설명 */}
      <Card>
        <CardHeader>
          <CardTitle>적용된 심리학 프레임워크</CardTitle>
          <CardDescription>
            L2 렌즈 (준비 불안) 해소를 위한 5가지 기법
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-sm mb-2">1. SPIN 판매법 (5단계 질문)</h4>
              <p className="text-sm text-gray-600">
                Situation → Problem → Implication → Need → Reward
                <br />
                고객의 불안감을 자연스럽게 이끌어내고 해결책 제시
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-2">2. PASONA 카피</h4>
              <p className="text-sm text-gray-600">
                Problem(문제) → Agitate(자극) → Solution(해결) → Offer(오퍼) → Narrow(좁혀짐) → Action(행동)
                <br />
                Day 0-3 SMS에 단계별 적용
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-2">3. 손실회피(Loss Aversion)</h4>
              <p className="text-sm text-gray-600">
                미준비 시 탑승 불가 → Day 3에 긴박감 강조
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-2">4. 사회증명(Social Proof)</h4>
              <p className="text-sm text-gray-600">
                Day 2: 선배 탑승자 실제 사례 & 후기 공유
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-2">5. 신뢰 설계(Trust Design)</h4>
              <p className="text-sm text-gray-600">
                1:1 상담사 배정 + 의료진 소개 → 전문성 강조
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 성과 목표 */}
      <Card>
        <CardHeader>
          <CardTitle>성과 목표 vs 현황</CardTitle>
          <CardDescription>
            Menu #48 구현으로 목표하는 개선
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">예약 완료율</span>
                <span className="text-sm font-bold">
                  {stats.conversionRate.toFixed(1)}% → 목표: 82-87%
                </span>
              </div>
              <Progress value={stats.conversionRate} className="h-2" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">상담 예약율</span>
                <span className="text-sm font-bold">
                  {stats.consultationBookingRate.toFixed(1)}% → 목표: 35-40%
                </span>
              </div>
              <Progress value={stats.consultationBookingRate} className="h-2" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">SMS 클릭율</span>
                <span className="text-sm font-bold">
                  {stats.smsClickRate.toFixed(1)}% → 목표: 45-50%
                </span>
              </div>
              <Progress value={stats.smsClickRate} className="h-2" />
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-sm text-blue-900 mb-2">
              🎯 기대 효과 (월 예상)
            </h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• 불안도 높은 고객 예약 완료율: 38-45% → 75% (+40%p)</li>
              <li>• 중간 불안도 고객 예약 완료율: 65% → 82% (+17%p)</li>
              <li>• 전체 예약 완료율 상승: 월 추가 48-78명 예약</li>
              <li>• 환불/취소율 감소: 불안감 해소로 -15% 예상</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
