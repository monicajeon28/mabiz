// app/partner/[partnerId]/adjustments/PartnerAdjustmentsClient.tsx
// 파트너 수당 조정 신청 클라이언트 컴포넌트

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FiArrowLeft,
  FiPlus,
  FiRefreshCw,
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiX,
} from 'react-icons/fi';
import { showError, showSuccess } from '@/components/ui/Toast';
import { logger } from '@/lib/logger';

type CommissionAdjustment = {
  id: number;
  ledgerId: number;
  amount: number;
  reason: string;
  status: string;
  requestedAt: string;
  decidedAt: string | null;
  ledger: {
    id: number;
    amount: number;
    entryType: string;
    sale: {
      id: number;
      productCode: string;
      saleAmount: number | null;
      saleDate: string | null;
    } | null;
    profile: {
      id: number;
      affiliateCode: string | null;
      displayName: string | null;
    } | null;
  };
  requestedBy: {
    id: number;
    name: string | null;
  };
  approvedBy: {
    id: number;
    name: string | null;
  } | null;
};

type LedgerItem = {
  id: number;
  amount: number;
  entryType: string;
  status: string;
  sale: {
    productCode: string | null;
  } | null;
  profile: {
    id: number;
    affiliateCode: string | null;
    displayName: string | null;
  } | null;
};

type PartnerAdjustmentsClientProps = {
  currentUser: {
    id: number;
    name: string | null;
    email: string | null;
    phone: string | null;
    mallUserId: string;
    mallNickname: string | null;
  };
  profile: {
    id: number;
    type: string;
    affiliateCode: string | null;
    displayName: string | null;
  };
};

type AdjustmentFormState = {
  ledgerId: string;
  amount: string;
  reason: string;
};

const EMPTY_FORM: AdjustmentFormState = {
  ledgerId: '',
  amount: '',
  reason: '',
};

export default function PartnerAdjustmentsClient({ currentUser, profile }: PartnerAdjustmentsClientProps) {
  const [adjustments, setAdjustments] = useState<CommissionAdjustment[]>([]);
  const [ledgers, setLedgers] = useState<LedgerItem[]>([]);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formState, setFormState] = useState<AdjustmentFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const dashboardUrl = `/${currentUser.mallUserId}/dashboard`;

  useEffect(() => {
    loadAdjustments();
    loadLedgers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const loadLedgers = async () => {
    try {
      // 최근 3개월 수당 원장 조회 (신청 가능한 항목)
      const res = await fetch(`/api/admin/affiliate/ledgers?limit=100&profileId=${profile.id}`);
      const json = await res.json();
      if (res.ok && json.ok) {
        // CONFIRMED 상태만 필터링 (이미 확정된 수당만 조정 신청 가능)
        const confirmedLedgers: LedgerItem[] = (json.ledgers ?? []).filter(
          (l: LedgerItem) => l.status === 'CONFIRMED'
        );
        setLedgers(confirmedLedgers);
      }
    } catch {
      logger.error('[PartnerAdjustments] load ledgers error');
    }
  };

  const loadAdjustments = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);

      const res = await fetch(`/api/admin/affiliate/adjustments?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || '수당 조정 목록을 불러오지 못했습니다.');
      }
      setAdjustments(json.adjustments ?? []);
    } catch (error) {
      logger.error('[PartnerAdjustments] load error', error);
      showError('수당 조정 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      setSaving(true);
      if (!formState.ledgerId || !formState.amount || !formState.reason.trim()) {
        showError('모든 필드를 입력해주세요.');
        setSaving(false);
        return;
      }

      const res = await fetch('/api/admin/affiliate/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ledgerId: Number(formState.ledgerId),
          amount: Number(formState.amount),
          reason: formState.reason.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || '수당 조정 신청에 실패했습니다.');
      }

      showSuccess('수당 조정 신청이 접수되었습니다.');
      setFormState(EMPTY_FORM);
      setIsCreateModalOpen(false);
      loadAdjustments();
    } catch (error) {
      logger.error('[PartnerAdjustments] create error', error);
      showError('수당 조정 신청 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'REQUESTED':
        return 'bg-yellow-50 text-yellow-700';
      case 'APPROVED':
        return 'bg-emerald-50 text-emerald-700';
      case 'REJECTED':
        return 'bg-red-50 text-red-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'REQUESTED':
        return '대기중';
      case 'APPROVED':
        return '승인됨';
      case 'REJECTED':
        return '거부됨';
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 pb-24">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-10 md:px-6">
        {/* 헤더 */}
        <div className="flex items-center gap-4">
          <Link
            href={dashboardUrl}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            <FiArrowLeft className="text-base" />
            돌아가기
          </Link>
          <h1 className="text-2xl font-extrabold text-gray-900">수당 조정 신청</h1>
        </div>

        {/* 필터 및 액션 */}
        <section className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">수당 조정 관리</h2>
              <p className="text-sm text-gray-600 mt-1">
                수당 오류나 특별 사유가 있을 경우 조정을 신청할 수 있습니다.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={loadAdjustments}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                <FiRefreshCw className="text-base" />
                새로고침
              </button>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-blue-700"
              >
                <FiPlus className="text-base" />
                신청하기
              </button>
            </div>
          </div>

          <div className="mt-6">
            <select
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="">전체 상태</option>
              <option value="REQUESTED">대기중</option>
              <option value="APPROVED">승인됨</option>
              <option value="REJECTED">거부됨</option>
            </select>
          </div>
        </section>

        {/* 조정 신청 목록 */}
        <section className="bg-white rounded-2xl shadow-lg border border-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">수당 정보</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">조정 금액</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">사유</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-600">상태</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-600">신청일</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-600">처리일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">
                      조정 신청 목록을 불러오는 중입니다...
                    </td>
                  </tr>
                )}
                {!isLoading && adjustments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                      조정 신청 내역이 없습니다.
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  adjustments.map((adjustment) => (
                    <tr key={adjustment.id} className="hover:bg-blue-50/40">
                      <td className="px-4 py-4">
                        <div className="text-sm font-semibold text-gray-900">
                          {adjustment.ledger.sale?.productCode || '-'}
                        </div>
                        <div className="text-xs text-gray-500">
                          원래 수당: {adjustment.ledger.amount.toLocaleString()}원
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-gray-900">
                        {adjustment.amount > 0 ? '+' : ''}
                        {adjustment.amount.toLocaleString()}원
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">{adjustment.reason}</td>
                      <td className="px-4 py-4 text-sm">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(adjustment.status)}`}
                        >
                          {adjustment.status === 'REQUESTED' && <FiClock className="mr-1" />}
                          {adjustment.status === 'APPROVED' && <FiCheckCircle className="mr-1" />}
                          {adjustment.status === 'REJECTED' && <FiXCircle className="mr-1" />}
                          {getStatusLabel(adjustment.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {new Date(adjustment.requestedAt).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {adjustment.decidedAt
                          ? new Date(adjustment.decidedAt).toLocaleDateString('ko-KR')
                          : '-'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 신청 모달 */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <h2 className="text-xl font-extrabold text-gray-900">수당 조정 신청</h2>
                <button
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setFormState(EMPTY_FORM);
                  }}
                  className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
                >
                  <FiX className="text-xl" />
                </button>
              </div>

              <div className="px-6 py-4 space-y-4">
                <div className="grid gap-4">
                  <label className="flex flex-col gap-1 text-sm text-gray-700">
                    <span className="font-semibold">수당 원장 선택 *</span>
                    <select
                      value={formState.ledgerId}
                      onChange={(e) => setFormState((prev) => ({ ...prev, ledgerId: e.target.value }))}
                      className="rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">선택하세요</option>
                      {ledgers.map((ledger) => (
                        <option key={ledger.id} value={ledger.id}>
                          {ledger.sale?.productCode || '상품코드 없음'} - {ledger.amount.toLocaleString()}원 (
                          {ledger.entryType})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-gray-700">
                    <span className="font-semibold">조정 금액 *</span>
                    <input
                      type="number"
                      value={formState.amount}
                      onChange={(e) => setFormState((prev) => ({ ...prev, amount: e.target.value }))}
                      placeholder="예: 50000 (추가) 또는 -30000 (차감)"
                      className="rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <span className="text-xs text-gray-500">
                      양수는 추가, 음수는 차감입니다. 예: +50000 또는 -30000
                    </span>
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-gray-700">
                    <span className="font-semibold">사유 *</span>
                    <textarea
                      value={formState.reason}
                      onChange={(e) => setFormState((prev) => ({ ...prev, reason: e.target.value }))}
                      rows={4}
                      placeholder="수당 조정 사유를 상세히 입력해주세요..."
                      className="rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
                <button
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setFormState(EMPTY_FORM);
                  }}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100"
                  disabled={saving}
                >
                  취소
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-blue-700 disabled:bg-blue-300"
                >
                  {saving ? '신청 중...' : '신청하기'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
