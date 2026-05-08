'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import type { FunnelState } from '@/lib/funnel-state-machine';
import FunnelStateModal from '@/components/funnel/FunnelStateModal';

export default function FunnelStatesPage() {
  const [selectedStatus, setSelectedStatus] = useState<FunnelState | null>(null);
  const [selectedStateId, setSelectedStateId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // 통계 조회
  const { data: statsData } = useQuery({
    queryKey: ['funnel-states-stats'],
    queryFn: async () => {
      const res = await fetch('/api/funnel-states/stats');
      if (!res.ok) throw new Error('통계 조회 실패');
      return res.json();
    },
    refetchInterval: 60000,
  });

  // 상태별 고객 목록 조회
  const { data: statesData, isLoading, refetch } = useQuery({
    queryKey: ['funnel-states-list', selectedStatus],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: '100',
        offset: '0',
      });
      if (selectedStatus) {
        params.append('status', selectedStatus);
      }

      const res = await fetch(`/api/funnel-states/list?${params}`);
      if (!res.ok) throw new Error('목록 조회 실패');
      return res.json();
    },
  });

  const handleStateSelect = (stateId: string) => {
    setSelectedStateId(stateId);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedStateId(null);
    refetch();
  };

  const stats = statsData?.data?.summary || {};
  const states = statesData?.data || [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">퍼널 상태 관리</h1>
        <p className="text-gray-600 mt-2">고객의 퍼널 진행 상황을 관리합니다</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard
          label="대기 중"
          count={stats.pending || 0}
          color="bg-gray-100"
          onClick={() => setSelectedStatus('PENDING')}
        />
        <StatCard
          label="진행 중"
          count={stats.active || 0}
          color="bg-blue-100"
          onClick={() => setSelectedStatus('ACTIVE')}
        />
        <StatCard
          label="응답 대기"
          count={stats.waiting || 0}
          color="bg-yellow-100"
          onClick={() => setSelectedStatus('WAITING')}
        />
        <StatCard
          label="완료됨"
          count={stats.completed || 0}
          color="bg-green-100"
          onClick={() => setSelectedStatus('COMPLETED')}
        />
        <StatCard
          label="실패"
          count={stats.failed || 0}
          color="bg-red-100"
          onClick={() => setSelectedStatus('FAILED')}
        />
        <StatCard
          label="보관됨"
          count={stats.archived || 0}
          color="bg-slate-100"
          onClick={() => setSelectedStatus('ARCHIVED')}
        />
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">변환율</div>
          <div className="text-2xl font-bold">
            {statsData?.data?.conversionRate || 0}%
          </div>
          <p className="text-xs text-gray-500 mt-1">PENDING → COMPLETED</p>
        </Card>

        <Card className="p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">평균 체류일수</div>
          <div className="text-2xl font-bold">
            {statsData?.data?.averageDaysToComplete || 0}일
          </div>
          <p className="text-xs text-gray-500 mt-1">완료까지 소요 기간</p>
        </Card>

        <Card className="p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">총 고객 수</div>
          <div className="text-2xl font-bold">
            {statsData?.data?.total || 0}
          </div>
          <p className="text-xs text-gray-500 mt-1">활성 퍼널 상태</p>
        </Card>
      </div>

      {/* 고객 목록 */}
      <Card className="p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">고객 목록</h2>
          <p className="text-sm text-gray-600">상태별로 고객을 필터링하고 상태를 변경합니다</p>
        </div>

        {/* 필터 */}
        <div className="flex gap-4 mb-6">
          <select
            value={selectedStatus || ''}
            onChange={(e) =>
              setSelectedStatus((e.target.value as FunnelState) || null)
            }
            className="w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">모두</option>
            <option value="PENDING">대기 중</option>
            <option value="ACTIVE">진행 중</option>
            <option value="WAITING">응답 대기</option>
            <option value="COMPLETED">완료됨</option>
            <option value="FAILED">실패</option>
            <option value="ARCHIVED">보관됨</option>
          </select>
        </div>

        {/* 테이블 */}
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <div className="text-gray-500">로딩 중...</div>
          </div>
        ) : states.length === 0 ? (
          <div className="flex justify-center items-center h-40">
            <div className="text-gray-500">조회된 데이터가 없습니다</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold">고객명</th>
                  <th className="text-left py-3 px-4 font-semibold">전화번호</th>
                  <th className="text-left py-3 px-4 font-semibold">상태</th>
                  <th className="text-left py-3 px-4 font-semibold">변경일</th>
                  <th className="text-left py-3 px-4 font-semibold">액션</th>
                </tr>
              </thead>
              <tbody>
                {states.map((state: any) => (
                  <tr key={state.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">{state.contact.name}</td>
                    <td className="py-3 px-4">{state.contact.phone}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusBadgeClass(
                          state.status
                        )}`}
                      >
                        {getStatusLabel(state.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600 text-xs">
                      {new Date(state.updatedAt).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleStateSelect(state.id)}
                        className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-600 hover:bg-blue-50 rounded"
                      >
                        관리
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selectedStateId && (
        <FunnelStateModal
          stateId={selectedStateId}
          isOpen={showModal}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  count,
  color,
  onClick,
}: {
  label: string;
  count: number;
  color: string;
  onClick: () => void;
}) {
  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow p-4 ${color}`}
      onClick={onClick}
    >
      <div className="text-2xl font-bold text-gray-900">{count}</div>
      <p className="text-xs text-gray-600 mt-1">{label}</p>
    </Card>
  );
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: '대기 중',
    ACTIVE: '진행 중',
    WAITING: '응답 대기',
    COMPLETED: '완료됨',
    FAILED: '실패',
    ARCHIVED: '보관됨',
  };
  return labels[status] || status;
}

function getStatusBadgeClass(status: string): string {
  const classes: Record<string, string> = {
    PENDING: 'bg-gray-100 text-gray-700',
    ACTIVE: 'bg-blue-100 text-blue-700',
    WAITING: 'bg-yellow-100 text-yellow-700',
    COMPLETED: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
    ARCHIVED: 'bg-slate-100 text-slate-700',
  };
  return classes[status] || 'bg-gray-100 text-gray-700';
}
