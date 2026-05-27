'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

interface SettlementDetail {
  settlementId: number;
  month: string;
  status: string;
  ledgerCount: number;
  totalCommission: number;
  totalWithholding: number;
  netPayout: number;
  approvedAt: string | null;
  paidAt: string | null;
}

interface PartnerResponse {
  ok: boolean;
  data: {
    profileId: number;
    details: SettlementDetail[];
  };
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  performance: {
    elapsedMs: number;
  };
}

const STATUS_LABEL: Record<string, { label: string; icon: JSX.Element; color: string }> = {
  DRAFT: {
    label: '예정',
    icon: <ClockIcon className="w-4 h-4" />,
    color: 'bg-slate-100 text-slate-700',
  },
  APPROVED: {
    label: '승인',
    icon: <CheckCircleIcon className="w-4 h-4" />,
    color: 'bg-blue-100 text-blue-700',
  },
  LOCKED: {
    label: '진행중',
    icon: <ExclamationCircleIcon className="w-4 h-4" />,
    color: 'bg-yellow-100 text-yellow-700',
  },
  PAID: {
    label: '완료',
    icon: <CheckCircleIcon className="w-4 h-4" />,
    color: 'bg-green-100 text-green-700',
  },
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    minimumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' });
}

export default function PartnerSettlementDetailPage() {
  const params = useParams();
  const profileId = params?.profileId as string;

  const [data, setData] = useState<PartnerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!profileId) return;

    const fetchDetails = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/settlements/partner-details?profileId=${profileId}&page=${page}`);
        const responseData = (await res.json()) as PartnerResponse;

        if (responseData.ok) {
          setData(responseData);
          setError(null);
        } else {
          setError('데이터를 불러올 수 없습니다.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '네트워크 오류');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [profileId, page]);

  if (!profileId) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-red-600">파트너 ID를 찾을 수 없습니다.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">파트너 정산 내역</h1>
        <div className="text-center py-12 text-gray-500">불러오는 중...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">파트너 정산 내역</h1>
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3">
          {error}
        </div>
      </div>
    );
  }

  const { details } = data.data;
  const { pagination, performance } = data;

  const totalCommission = details.reduce((sum, d) => sum + d.totalCommission, 0);
  const totalWithholding = details.reduce((sum, d) => sum + d.totalWithholding, 0);
  const totalNetPayout = details.reduce((sum, d) => sum + d.netPayout, 0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">파트너 ID: {profileId}</h1>
          <p className="text-sm text-gray-600 mt-1">정산 내역 상세 조회 (쿼리: {performance.elapsedMs}ms)</p>
        </div>
        <a
          href="/admin/settlements"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
        >
          ← 돌아가기
        </a>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          label="누적 수수료"
          value={formatCurrency(totalCommission)}
          color="bg-blue-50 border-blue-200"
        />
        <SummaryCard
          label="차감액 (세금/수수료)"
          value={formatCurrency(totalWithholding)}
          color="bg-yellow-50 border-yellow-200"
        />
        <SummaryCard
          label="총 지급액"
          value={formatCurrency(totalNetPayout)}
          color="bg-green-50 border-green-200"
        />
      </div>

      {/* 정산 내역 테이블 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            정산 내역 ({pagination.total}건)
          </h2>
        </div>

        {details.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            정산 내역이 없습니다.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">기간</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">상태</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">거래건수</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">수수료</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">차감액</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">순지급액</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">승인일</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">지급일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {details.map((detail) => {
                    const statusInfo = STATUS_LABEL[detail.status];
                    return (
                      <tr key={detail.settlementId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-700 font-medium">{detail.month}</td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                              statusInfo?.color || 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {statusInfo?.icon}
                            {statusInfo?.label || detail.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600">
                          {detail.ledgerCount}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {formatCurrency(detail.totalCommission)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {formatCurrency(detail.totalWithholding)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          {formatCurrency(detail.netPayout)}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {formatDate(detail.approvedAt)}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {formatDate(detail.paidAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            {pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  페이지 {pagination.page} / {pagination.totalPages}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <ChevronLeftIcon className="w-5 h-5" />
                  </button>

                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                        page === p
                          ? 'bg-blue-500 text-white'
                          : 'border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {p}
                    </button>
                  ))}

                  <button
                    onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                    disabled={page >= pagination.totalPages}
                    className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <ChevronRightIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className={`${color} border rounded-lg p-4`}>
      <p className="text-sm font-medium text-gray-600 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
