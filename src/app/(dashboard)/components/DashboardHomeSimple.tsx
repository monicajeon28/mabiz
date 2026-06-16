'use client';

import { useCallListRefresh } from '../hooks/useCallListRefresh';
import { AlertCircle, Phone, TrendingUp } from 'lucide-react';
import Link from 'next/link';

interface DashboardHomeSimpleProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session?: any;
}

/**
 * DashboardHomeSimple
 *
 * 50대 사용자를 위한 단순하고 명확한 홈 대시보드
 *
 * Steve Jobs 원칙 적용:
 * - 색상: 🟢(정상 rgb(34,197,94)) / 🟡(주의 rgb(251,191,36)) / 🔴(위험 rgb(239,68,68))
 * - 글자: 맑은 고딕 24pt(제목), 16pt(본문), 18pt+(숫자)
 * - 배치: 한 화면 최대 5개 카드, 16px 간격
 * - 터치: 최소 44px × 44px
 * - 용어: 한글만 (영문 용어 모두 번역)
 *
 * Elon Musk 기술:
 * - 5분 폴링 (WebSocket은 Phase 9 추연기)
 * - 네트워크 오류 시 자동 재시도 3회
 */
 
export function DashboardHomeSimple({ session: _session }: DashboardHomeSimpleProps) {
  const { stats, loading, error } = useCallListRefresh(300); // 5분 = 300초

  const getRiskColor = (riskScore: number): { bg: string; text: string; icon: string } => {
    if (riskScore >= 61) return { bg: 'bg-red-600', text: 'text-red-600', icon: '🔴' };
    if (riskScore >= 31) return { bg: 'bg-yellow-500', text: 'text-yellow-500', icon: '🟡' };
    return { bg: 'bg-green-600', text: 'text-green-600', icon: '🟢' };
  };

  const getPriorityLabel = (daysLeft: number): string => {
    if (daysLeft === 0) return '지금 전화!';
    if (daysLeft === 1) return '1시간 내';
    return '기한 임박';
  };

  if (loading && !stats) {
    return (
      <div className="space-y-4">
        <div className="h-12 bg-gray-200 rounded animate-pulse" />
        <div className="h-40 bg-gray-200 rounded animate-pulse" />
        <div className="h-32 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700">데이터 로드 실패</p>
            <p className="text-sm text-red-600">{error || '알 수 없는 오류가 발생했습니다'}</p>
          </div>
        </div>
      </div>
    );
  }

  const riskColor = getRiskColor(stats.riskLevel === 'CRITICAL' ? 80 : stats.riskLevel === 'WARNING' ? 45 : 20);

  return (
    <div className="space-y-6">
      {/* 제목 + 날짜 */}
      <div>
        <h1
          className="text-2xl font-bold text-slate-900"
          style={{ fontFamily: "'Malgun Gothic', sans-serif" }}
        >
          대시보드
        </h1>
        <p className="text-gray-600 text-sm mt-1">{stats.yearMonth}</p>
      </div>

      {/* 상단 KPI 카드: 4개 (모바일: 2×2, PC: 1×4) */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {/* 오늘의 신청자 */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 font-medium mb-1">오늘의 신청자</p>
          <p
            className="text-4xl font-bold text-slate-900"
            style={{ fontFamily: "'Malgun Gothic', sans-serif" }}
          >
            {stats.todayNewApplications}
          </p>
          <p className="text-xs text-gray-500 mt-1">명</p>
        </div>

        {/* 계약 완료 */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 font-medium mb-1">계약 완료</p>
          <p
            className="text-4xl font-bold text-slate-900"
            style={{ fontFamily: "'Malgun Gothic', sans-serif" }}
          >
            {stats.todayCompletedContracts}
          </p>
          <p className="text-xs text-gray-500 mt-1">명</p>
        </div>

        {/* 대기 중 */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 font-medium mb-1">대기 중</p>
          <p
            className="text-4xl font-bold text-slate-900"
            style={{ fontFamily: "'Malgun Gothic', sans-serif" }}
          >
            {stats.pendingCount}
          </p>
          <p className="text-xs text-gray-500 mt-1">명</p>
        </div>

        {/* 위험도 */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 font-medium mb-1">위험도</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-3xl">{riskColor.icon}</span>
            <span
              className="text-lg font-bold"
              style={{ color: riskColor.text.split('-')[1] === 'red' ? '#ef4444' : riskColor.text.split('-')[1] === 'yellow' ? '#fbbf24' : '#22c55e' }}
            >
              {stats.riskLevel === 'CRITICAL' ? '위험' : stats.riskLevel === 'WARNING' ? '주의' : '정상'}
            </span>
          </div>
        </div>
      </div>

      {/* Russell 퍼널 (3단계) */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2
          className="text-lg font-bold text-slate-900 mb-4"
          style={{ fontFamily: "'Malgun Gothic', sans-serif" }}
        >
          신청흐름
        </h2>

        <div className="space-y-3">
          {/* 신청 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-gray-700">신청</p>
              <p className="text-sm font-bold text-slate-900">{stats.funnelStats.step1.count}명</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full flex items-center justify-center transition-all"
                style={{ width: '100%' }}
              >
                <span className="text-xs font-bold text-white">100%</span>
              </div>
            </div>
          </div>

          {/* 문자 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-gray-700">문자</p>
              <p className="text-sm font-bold text-slate-900">{stats.funnelStats.step2.count}명</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
              <div
                className="bg-green-600 h-full rounded-full flex items-center justify-center transition-all"
                style={{ width: `${Math.min(100, stats.funnelStats.step2.percentage)}%` }}
              >
                <span className="text-xs font-bold text-white">
                  {Math.round(stats.funnelStats.step2.percentage)}%
                </span>
              </div>
            </div>
          </div>

          {/* 계약 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-gray-700">계약</p>
              <p className="text-sm font-bold text-slate-900">{stats.funnelStats.step3.count}명</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
              <div
                className="bg-purple-600 h-full rounded-full flex items-center justify-center transition-all"
                style={{ width: `${Math.min(100, stats.funnelStats.step3.percentage)}%` }}
              >
                <span className="text-xs font-bold text-white">
                  {Math.round(stats.funnelStats.step3.percentage)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grant TOP 3 우선순위 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2
          className="text-lg font-bold text-slate-900 mb-4"
          style={{ fontFamily: "'Malgun Gothic', sans-serif" }}
        >
          오늘 전화할 사람 TOP 3
        </h2>

        <div className="space-y-3">
          {stats.topPriorityCalls.map((call, idx) => {
            const priorityColor =
              idx === 0
                ? 'bg-red-50 border-red-200'
                : idx === 1
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-blue-50 border-blue-200';

            const badgeColor =
              idx === 0 ? 'bg-red-600 text-white' : idx === 1 ? 'bg-yellow-500 text-white' : 'bg-blue-600 text-white';

            return (
              <Link
                key={call.id}
                href={`/contacts/${call.id}`}
                className={`border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow ${priorityColor}`}
              >
                <div className="flex items-start gap-3">
                  {/* 순번 배지 */}
                  <div className={`${badgeColor} w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0`}>
                    {idx + 1}️⃣
                  </div>

                  {/* 정보 */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 text-sm">{call.name}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{call.phone}</p>
                    <p className="text-xs font-semibold text-slate-700 mt-1">{getPriorityLabel(call.daysLeft)}</p>
                    {call.method && <p className="text-xs text-gray-600 mt-1">→ {call.method}</p>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 하단 액션 버튼 2개 */}
      <div className="grid grid-cols-2 gap-4">
        <Link
          href="/contacts"
          className="flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg py-4 px-4 font-semibold hover:bg-blue-700 transition-colors"
          style={{ minHeight: '48px' }}
        >
          <Phone className="w-5 h-5" />
          <span>전화 콜 리스트</span>
        </Link>

        <Link
          href="/contacts/analytics"
          className="flex items-center justify-center gap-2 bg-slate-600 text-white rounded-lg py-4 px-4 font-semibold hover:bg-slate-700 transition-colors"
          style={{ minHeight: '48px' }}
        >
          <TrendingUp className="w-5 h-5" />
          <span>위험도 보기</span>
        </Link>
      </div>

      {/* 폴링 상태 표시 (개발 환경) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-500 text-center">
          ⏱️ 5분마다 자동 새로고침 | 마지막 업데이트: {new Date().toLocaleTimeString('ko-KR')}
        </div>
      )}
    </div>
  );
}
