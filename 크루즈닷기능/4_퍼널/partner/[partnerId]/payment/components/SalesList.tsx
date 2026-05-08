'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiRefreshCw,
  FiExternalLink,
  FiChevronLeft,
  FiChevronRight,
  FiCalendar,
} from 'react-icons/fi';
import { showError } from '@/components/ui/Toast';
import SalesConfirmationModal from '@/components/affiliate/SalesConfirmationModal';

type Sale = {
  id: number;
  productCode: string | null;
  saleAmount: number;
  status: string;
  audioFileGoogleDriveUrl: string | null;
  saleDate: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type Summary = {
  APPROVED: { amount: number; count: number };
  PENDING_APPROVAL: { amount: number; count: number };
  PENDING: { amount: number; count: number };
  REJECTED: { amount: number; count: number };
  CONFIRMED: { amount: number; count: number };
};

export default function SalesList() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSalesConfirmationModal, setShowSalesConfirmationModal] = useState(false);
  const [selectedSaleForConfirmation, setSelectedSaleForConfirmation] = useState<Sale | null>(null);
  
  // 월별 필터링 및 페이지네이션 (기본값: 현재 달)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [summary, setSummary] = useState<Summary>({
    APPROVED: { amount: 0, count: 0 },
    PENDING_APPROVAL: { amount: 0, count: 0 },
    PENDING: { amount: 0, count: 0 },
    REJECTED: { amount: 0, count: 0 },
    CONFIRMED: { amount: 0, count: 0 },
  });
  
  // 사용 가능한 월 목록 생성 (최근 12개월)
  const getAvailableMonths = () => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      months.push(`${year}-${month}`);
    }
    return months;
  };

  const formatMonthLabel = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    return `${year}년 ${parseInt(month)}월`;
  };

  const loadSales = useCallback(async (page: number = 1, month?: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', pagination.limit.toString());
      if (month) {
        params.set('month', month);
      }

      const res = await fetch(`/api/affiliate/sales/my-sales?${params}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || '판매 목록을 불러오지 못했습니다');
      }
      setSales(json.sales || []);
      if (json.pagination) {
        setPagination(json.pagination);
      }
      if (json.summary) {
        setSummary(json.summary);
      }

      // 판매 목록 자동 백업 (백그라운드에서 실행, 에러 무시)
      if (json.sales && json.sales.length > 0) {
        fetch('/api/partner/sales/backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ month: month || null }),
          credentials: 'include',
        }).catch((err) => {
          console.warn('[SalesList] Backup failed:', err);
        });
      }
    } catch (error: any) {
      console.error('[SalesList] Load sales error:', error);
      showError(error.message || '판매 목록을 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  }, [pagination.limit]);

  useEffect(() => {
    loadSales(1, selectedMonth || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    loadSales(newPage, selectedMonth || undefined);
  };

  // 판매 상태를 한국어로 변환
  const formatSaleStatus = (status: string) => {
    switch (status) {
      case 'PENDING':
        return '대기 중';
      case 'PENDING_APPROVAL':
        return '승인 대기';
      case 'APPROVED':
        return '승인됨';
      case 'REJECTED':
        return '거부됨';
      case 'CONFIRMED':
        return '확정됨';
      default:
        return '알 수 없음';
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'PENDING':
        return {
          label: '대기 중',
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          icon: <FiClock className="text-base" />,
        };
      case 'PENDING_APPROVAL':
        return {
          label: '승인 대기',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          icon: <FiClock className="text-base" />,
        };
      case 'APPROVED':
        return {
          label: '승인됨',
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          icon: <FiCheckCircle className="text-base" />,
        };
      case 'REJECTED':
        return {
          label: '거부됨',
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          icon: <FiXCircle className="text-base" />,
        };
      default:
        return {
          label: '알 수 없음',
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          icon: <FiClock className="text-base" />,
        };
    }
  };

  return (
    <>
      <div className="rounded-3xl bg-white p-6 shadow-lg">
        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-bold text-slate-900">내 판매 목록</h2>
          <div className="flex items-center gap-3">
            {/* 월별 필터 */}
            <div className="flex items-center gap-2">
              <FiCalendar className="text-gray-500" />
              <select
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">전체 기간</option>
                {getAvailableMonths().map((month) => (
                  <option key={month} value={month}>
                    {formatMonthLabel(month)}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => loadSales(pagination.page, selectedMonth || undefined)}
              className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
            >
              <FiRefreshCw className="text-base" />
              새로고침
            </button>
          </div>
        </div>

        {/* 통계 정보 */}
        {!loading && sales.length > 0 && (
          <div className="mb-4 rounded-lg bg-blue-50 p-3 border border-blue-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                총 <span className="font-bold text-blue-600">{pagination.total.toLocaleString()}</span>건
              </span>
              {selectedMonth && (
                <span className="text-gray-600">
                  {formatMonthLabel(selectedMonth)} 기준
                </span>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-500">
            판매 목록을 불러오는 중입니다...
          </div>
        ) : sales.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">
            {selectedMonth ? `${formatMonthLabel(selectedMonth)} 판매 내역이 없습니다.` : '판매 내역이 없습니다.'}
          </div>
        ) : (
          <>
            {/* 테이블 형식으로 표시 (대량 데이터 효율적 표시) */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">상품 코드</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">판매 금액</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">판매일</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">상태</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sales.map((sale) => {
                    const statusInfo = getStatusInfo(sale.status);
                    return (
                      <tr
                        key={sale.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className="font-semibold text-gray-900">
                            {sale.productCode || '상품 코드 없음'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-gray-900">
                            {new Intl.NumberFormat('ko-KR', {
                              style: 'currency',
                              currency: 'KRW',
                            }).format(sale.saleAmount)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {sale.saleDate ? (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <FiClock className="text-xs" />
                              {new Date(sale.saleDate).toLocaleDateString('ko-KR', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${statusInfo.color} ${statusInfo.bgColor}`}
                          >
                            {statusInfo.icon}
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {(sale.status === 'PENDING' || sale.status === 'REJECTED' || sale.status === 'PENDING_APPROVAL') && (
                              <button
                                onClick={() => {
                                  setSelectedSaleForConfirmation(sale);
                                  setShowSalesConfirmationModal(true);
                                }}
                                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                              >
                                {sale.status === 'PENDING_APPROVAL' ? '상세 보기' : sale.status === 'REJECTED' ? '다시 확정 요청' : '확정 요청'}
                              </button>
                            )}
                            {sale.status === 'APPROVED' && (
                              <button
                                onClick={() => {
                                  setSelectedSaleForConfirmation(sale);
                                  setShowSalesConfirmationModal(true);
                                }}
                                className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
                              >
                                상세 보기
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            {pagination.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
                <div className="text-sm text-gray-600">
                  {pagination.total > 0 && (
                    <span>
                      {((pagination.page - 1) * pagination.limit + 1).toLocaleString()} - {Math.min(pagination.page * pagination.limit, pagination.total).toLocaleString()} / 총 {pagination.total.toLocaleString()}건
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <FiChevronLeft />
                    이전
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (pagination.totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (pagination.page <= 3) {
                        pageNum = i + 1;
                      } else if (pagination.page >= pagination.totalPages - 2) {
                        pageNum = pagination.totalPages - 4 + i;
                      } else {
                        pageNum = pagination.page - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
                            pagination.page === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    다음
                    <FiChevronRight />
                  </button>
                </div>
              </div>
            )}

            {/* 월별 판매 금액 통계 */}
            {!loading && sales.length > 0 && (
              <div className="mt-6 rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
                <h3 className="mb-4 text-lg font-bold text-gray-900 flex items-center gap-2">
                  <FiCalendar className="text-blue-600" />
                  {selectedMonth ? `${formatMonthLabel(selectedMonth)} 판매 금액 통계` : '전체 판매 금액 통계'}
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {/* 승인된 판매 */}
                  <div className="rounded-lg bg-white p-4 shadow-sm border border-green-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-600">승인된 판매</span>
                      <FiCheckCircle className="text-green-600" />
                    </div>
                    <div className="text-2xl font-bold text-green-700 mb-1">
                      {new Intl.NumberFormat('ko-KR', {
                        style: 'currency',
                        currency: 'KRW',
                      }).format(summary.APPROVED.amount + summary.CONFIRMED.amount)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {summary.APPROVED.count + summary.CONFIRMED.count}건
                    </div>
                  </div>

                  {/* 승인 대기 */}
                  <div className="rounded-lg bg-white p-4 shadow-sm border border-yellow-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-600">승인 대기</span>
                      <FiClock className="text-yellow-600" />
                    </div>
                    <div className="text-2xl font-bold text-yellow-700 mb-1">
                      {new Intl.NumberFormat('ko-KR', {
                        style: 'currency',
                        currency: 'KRW',
                      }).format(summary.PENDING_APPROVAL.amount)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {summary.PENDING_APPROVAL.count}건
                    </div>
                  </div>

                  {/* 대기 중 */}
                  <div className="rounded-lg bg-white p-4 shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-600">대기 중</span>
                      <FiClock className="text-gray-600" />
                    </div>
                    <div className="text-2xl font-bold text-gray-700 mb-1">
                      {new Intl.NumberFormat('ko-KR', {
                        style: 'currency',
                        currency: 'KRW',
                      }).format(summary.PENDING.amount)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {summary.PENDING.count}건
                    </div>
                  </div>

                  {/* 거부된 판매 */}
                  <div className="rounded-lg bg-white p-4 shadow-sm border border-red-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-600">거부된 판매</span>
                      <FiXCircle className="text-red-600" />
                    </div>
                    <div className="text-2xl font-bold text-red-700 mb-1">
                      {new Intl.NumberFormat('ko-KR', {
                        style: 'currency',
                        currency: 'KRW',
                      }).format(summary.REJECTED.amount)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {summary.REJECTED.count}건
                    </div>
                  </div>
                </div>

                {/* 총합계 (승인된 판매만) */}
                <div className="mt-4 pt-4 border-t border-blue-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">총 판매 금액 (승인된 판매만)</span>
                    <span className="text-xl font-bold text-blue-700">
                      {new Intl.NumberFormat('ko-KR', {
                        style: 'currency',
                        currency: 'KRW',
                      }).format(
                        summary.APPROVED.amount + summary.CONFIRMED.amount
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showSalesConfirmationModal && selectedSaleForConfirmation && (
        <SalesConfirmationModal
          sale={selectedSaleForConfirmation}
          isOpen={showSalesConfirmationModal}
          onClose={() => {
            setShowSalesConfirmationModal(false);
            setSelectedSaleForConfirmation(null);
          }}
          onSuccess={() => {
            loadSales();
            setShowSalesConfirmationModal(false);
            setSelectedSaleForConfirmation(null);
          }}
        />
      )}
    </>
  );
}

