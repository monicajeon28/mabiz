'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Campaign {
  id: string;
  title: string;
  status: 'DRAFT' | 'PREPARING' | 'SENDING' | 'COMPLETED' | 'PAUSED';
  sendSms: boolean;
  sendEmail: boolean;
  sendAt?: string | null;
  sentCount: number;
  totalCount: number;
  createdAt: string;
}

type StatusFilter = 'ALL' | 'DRAFT' | 'PREPARING' | 'SENDING' | 'COMPLETED' | 'PAUSED';

const STATUS_LABELS: Record<Campaign['status'], string> = {
  DRAFT: '작성 중',
  PREPARING: '준비 중',
  SENDING: '발송 중',
  COMPLETED: '완료',
  PAUSED: '일시중지',
};

const STATUS_BADGE_CLASS: Record<Campaign['status'], string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PREPARING: 'bg-blue-100 text-blue-700',
  SENDING: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-green-100 text-green-700',
  PAUSED: 'bg-orange-100 text-orange-700',
};

const FILTER_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'DRAFT', label: '작성중' },
  { value: 'PREPARING', label: '준비중' },
  { value: 'SENDING', label: '발송중' },
  { value: 'COMPLETED', label: '완료' },
];

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ProgressBar({ sent, total }: { sent: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0;
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 whitespace-nowrap">
        {sent.toLocaleString()}/{total.toLocaleString()}
      </span>
    </div>
  );
}

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchCampaigns = useCallback(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ limit: '100', offset: '0' });
    if (filter !== 'ALL') params.set('status', filter);

    fetch(`/api/campaigns?${params.toString()}`, { signal: ctrl.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!data.ok) throw new Error(data.message || '목록 조회 실패');
        setCampaigns(data.campaigns ?? []);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : '알 수 없는 오류');
      })
      .finally(() => setLoading(false));

    return ctrl;
  }, [filter]);

  useEffect(() => {
    const ctrl = fetchCampaigns();
    return () => ctrl.abort();
  }, [fetchCampaigns]);

  const handleDeltaSetup = () => {
    if (!selectedId) {
      alert('렌탈 SMS 자동화를 설정할 캠페인을 먼저 선택해주세요.');
      return;
    }
    router.push(`/campaigns/${selectedId}/delta-setup`);
  };

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">캠페인 관리</h1>
          <p className="text-sm text-gray-500 mt-1">SMS/이메일 캠페인을 생성하고 관리합니다.</p>
        </div>
        <span className="px-4 py-2 bg-gray-100 text-gray-400 text-sm font-medium rounded-lg cursor-not-allowed select-none">
          + 캠페인 만들기 (준비 중)
        </span>
      </div>

      {/* 상태 필터 탭 */}
      <div className="flex gap-1 border-b border-gray-200">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
              filter === tab.value
                ? 'bg-white border border-b-white border-gray-200 text-blue-600 -mb-px'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 테이블 영역 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
            <svg className="animate-spin w-5 h-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            캠페인 목록 불러오는 중...
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 text-red-500 text-sm gap-3">
            <span>오류: {error}</span>
            <button
              onClick={() => fetchCampaigns()}
              className="px-3 py-1 text-xs bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
            >
              다시 시도
            </button>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-sm gap-2">
            <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>등록된 캠페인이 없습니다.</span>
            <span className="px-3 py-1 text-xs text-gray-400">캠페인을 추가하려면 관리자에게 문의하세요.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-8 px-4 py-3"></th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">제목</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">상태</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">채널</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">진행률</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">예정일</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {campaigns.map((c) => (
                  <tr
                    key={c.id}
                    className={`hover:bg-gray-50 transition-colors ${selectedId === c.id ? 'bg-blue-50' : ''}`}
                  >
                    {/* 선택 라디오 */}
                    <td className="px-4 py-3">
                      <input
                        type="radio"
                        name="campaign-select"
                        checked={selectedId === c.id}
                        onChange={() => setSelectedId(c.id)}
                        className="accent-blue-600 cursor-pointer"
                      />
                    </td>
                    {/* 제목 */}
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900 line-clamp-1 max-w-[240px] block" title={c.title}>
                        {c.title}
                      </span>
                    </td>
                    {/* 상태 배지 */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_CLASS[c.status]}`}
                      >
                        {STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    {/* 채널 아이콘 */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {c.sendSms && (
                          <span
                            title="SMS"
                            className="inline-flex items-center justify-center w-6 h-6 bg-green-100 text-green-700 rounded text-xs font-bold"
                          >
                            S
                          </span>
                        )}
                        {c.sendEmail && (
                          <span
                            title="이메일"
                            className="inline-flex items-center justify-center w-6 h-6 bg-purple-100 text-purple-700 rounded text-xs font-bold"
                          >
                            E
                          </span>
                        )}
                        {!c.sendSms && !c.sendEmail && (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </div>
                    </td>
                    {/* 진행률 */}
                    <td className="px-4 py-3">
                      <ProgressBar sent={c.sentCount} total={c.totalCount} />
                    </td>
                    {/* 예정일 */}
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {formatDate(c.sendAt)}
                    </td>
                    {/* 액션 */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => router.push(`/campaigns/sending-history-dashboard?campaignId=${c.id}`)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium hover:underline transition-colors"
                      >
                        발송현황
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 기능 카드 3개 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* 발송 이력 */}
        <button
          onClick={() => router.push('/campaigns/sending-history')}
          className="flex items-start gap-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all text-left group"
        >
          <div className="flex-shrink-0 w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-xl group-hover:bg-blue-100 transition-colors">
            📤
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">발송 이력</p>
            <p className="text-xs text-gray-500 mt-0.5">개별 발송 기록 및 결과 확인</p>
          </div>
        </button>

        {/* 발송 현황 대시보드 */}
        <button
          onClick={() => router.push('/campaigns/sending-history-dashboard')}
          className="flex items-start gap-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-green-300 transition-all text-left group"
        >
          <div className="flex-shrink-0 w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center text-xl group-hover:bg-green-100 transition-colors">
            📊
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">발송 현황 대시보드</p>
            <p className="text-xs text-gray-500 mt-0.5">채널별 성과 및 통계 분석</p>
          </div>
        </button>

        {/* 렌탈 SMS 자동화 */}
        <button
          onClick={handleDeltaSetup}
          className={`flex items-start gap-3 p-4 bg-white rounded-xl border shadow-sm hover:shadow-md transition-all text-left group ${
            selectedId
              ? 'border-orange-200 hover:border-orange-400'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-colors ${
              selectedId ? 'bg-orange-50 group-hover:bg-orange-100' : 'bg-gray-50 group-hover:bg-gray-100'
            }`}
          >
            ⚙️
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">렌탈 SMS 자동화</p>
            <p className={`text-xs mt-0.5 ${selectedId ? 'text-orange-600 font-medium' : 'text-gray-500'}`}>
              {selectedId ? '선택된 캠페인으로 설정하기' : '캠페인을 먼저 선택하세요'}
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
