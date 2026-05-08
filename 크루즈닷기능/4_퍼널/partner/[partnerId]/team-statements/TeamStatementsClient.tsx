// app/partner/[partnerId]/team-statements/TeamStatementsClient.tsx
// 대리점장 팀원 정산 명세서 클라이언트 컴포넌트

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiRefreshCw, FiUsers, FiEye, FiCalendar, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { showError, showSuccess } from '@/components/ui/Toast';
import StatementCard from '@/components/partner/StatementCard';

type Pagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

type Settlement = {
  id: number;
  periodStart: string;
  periodEnd: string;
  status: string;
  paymentDate: string | null;
};

type StatementDetail = {
  entryId: number;
  saleId: number | null;
  productCode: string | null;
  saleAmount: number | null;
  saleDate: string | null;
  cabinType: string | null;
  headcount: number | null;
  customerName: string | null;
  entryType: string;
  amount: number;
  withholdingAmount: number;
  netAmount: number;
};

type Statement = {
  profileId: number;
  affiliateCode: string | null;
  displayName: string | null;
  type: string;
  periodStart: string;
  periodEnd: string;
  salesCount: number;
  totalSaleAmount: number;
  salesCommission: number;
  branchCommission: number;
  overrideCommission: number;
  grossAmount: number;
  withholdingAmount: number;
  withholdingRate: number;
  netAmount: number;
  entryCount: number;
  bankName: string | null;
  bankAccount: string | null;
  bankAccountHolder: string | null;
  details: StatementDetail[];
};

type TeamStatementsClientProps = {
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

export default function TeamStatementsClient({ currentUser, profile }: TeamStatementsClientProps) {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [selectedStatement, setSelectedStatement] = useState<Statement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingStatements, setIsLoadingStatements] = useState(false);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const partnerBase = `/partner/${currentUser.mallUserId}`;
  const dashboardUrl = `${partnerBase}/dashboard`;

  const loadSettlements = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/admin/affiliate/settlements-list?limit=100');
      const json = await res.json();
      if (res.ok && json.ok) {
        setSettlements(json.settlements || []);
      }
    } catch (error: any) {
      console.error('[TeamStatements] load error', error);
      showError(error.message || '정산 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadTeamStatements = useCallback(async (settlement: Settlement, page: number = 1) => {
    try {
      setIsLoadingStatements(true);
      setSelectedSettlement(settlement);
      if (page === 1) {
        setStatements([]);
      }

      const res = await fetch(`/api/partner/team-statements?settlementId=${settlement.id}&page=${page}&pageSize=50`);
      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.message || '팀원 명세서를 불러오지 못했습니다.');
      }

      setStatements(json.statements || []);
      setPagination(json.pagination || null);
      setCurrentPage(page);

      if (json.statements?.length === 0 && page === 1) {
        showSuccess('팀원의 정산 내역이 없습니다.');
      }
    } catch (error: any) {
      console.error('[TeamStatements] load team statements error', error);
      showError(error.message || '팀원 명세서를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoadingStatements(false);
    }
  }, []);

  // 페이지 이동 함수
  const handlePageChange = useCallback((newPage: number) => {
    if (selectedSettlement && newPage >= 1 && newPage <= (pagination?.totalPages || 1)) {
      loadTeamStatements(selectedSettlement, newPage);
    }
  }, [selectedSettlement, pagination?.totalPages, loadTeamStatements]);

  useEffect(() => {
    loadSettlements();
  }, [loadSettlements]);

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString() + '원';
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR');
  };

  const formatPeriod = (start: string, end: string) => {
    const startDate = new Date(start);
    return `${startDate.getFullYear()}년 ${startDate.getMonth() + 1}월`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-600';
      case 'APPROVED':
        return 'bg-emerald-50 text-emerald-700';
      case 'PAID':
        return 'bg-blue-50 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return '초안';
      case 'APPROVED':
        return '승인됨';
      case 'PAID':
        return '지급완료';
      default:
        return status;
    }
  };

  // 팀 전체 합계 계산 (메모이제이션)
  const teamTotals = useMemo(() =>
    statements.reduce(
      (acc, stmt) => ({
        salesCount: acc.salesCount + stmt.salesCount,
        totalSaleAmount: acc.totalSaleAmount + stmt.totalSaleAmount,
        grossAmount: acc.grossAmount + stmt.grossAmount,
        withholdingAmount: acc.withholdingAmount + stmt.withholdingAmount,
        netAmount: acc.netAmount + stmt.netAmount,
      }),
      { salesCount: 0, totalSaleAmount: 0, grossAmount: 0, withholdingAmount: 0, netAmount: 0 }
    ), [statements]);

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
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <FiUsers className="text-blue-600" />
            팀원 지급명세서
          </h1>
        </div>

        {/* 정산 기간 선택 */}
        <section className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">정산 기간 선택</h2>
              <p className="text-sm text-gray-600 mt-1">
                정산 기간을 선택하여 팀원들의 지급명세서를 확인하세요.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={loadSettlements}
                disabled={isLoading}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                <FiRefreshCw className={`text-base ${isLoading ? 'animate-spin' : ''}`} />
                새로고침
              </button>
            </div>
          </div>

          {/* 정산 기간 목록 */}
          <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {isLoading ? (
              <div className="col-span-full py-8 text-center text-gray-500">불러오는 중...</div>
            ) : settlements.length === 0 ? (
              <div className="col-span-full py-8 text-center text-gray-500">정산 기간이 없습니다.</div>
            ) : (
              settlements.map((settlement) => (
                <button
                  key={settlement.id}
                  onClick={() => loadTeamStatements(settlement)}
                  className={`rounded-xl border-2 p-4 text-left transition-all hover:shadow-md ${
                    selectedSettlement?.id === settlement.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-gray-900">
                      {formatPeriod(settlement.periodStart, settlement.periodEnd)}
                    </span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusColor(settlement.status)}`}>
                      {getStatusLabel(settlement.status)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    <FiCalendar className="inline mr-1" />
                    {formatDate(settlement.periodStart)} ~ {formatDate(settlement.periodEnd)}
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        {/* 팀원 명세서 목록 */}
        {selectedSettlement && (
          <section className="bg-white rounded-2xl shadow-lg border border-gray-200">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-bold text-gray-900">
                {formatPeriod(selectedSettlement.periodStart, selectedSettlement.periodEnd)} 팀원 명세서
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                팀원의 이름을 클릭하여 상세 명세서를 확인하세요.
              </p>
            </div>

            {/* 팀 합계 요약 */}
            {statements.length > 0 && (
              <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-blue-800 mb-3">팀 전체 합계</h3>
                <div className="grid gap-4 md:grid-cols-5">
                  <div className="text-center">
                    <p className="text-xs text-blue-600 mb-1">총 판매건수</p>
                    <p className="text-lg font-bold text-blue-800">{teamTotals.salesCount}건</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-blue-600 mb-1">총 판매금액</p>
                    <p className="text-lg font-bold text-blue-800">{formatCurrency(teamTotals.totalSaleAmount)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-blue-600 mb-1">총 수당</p>
                    <p className="text-lg font-bold text-blue-800">{formatCurrency(teamTotals.grossAmount)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-red-600 mb-1">총 원천징수</p>
                    <p className="text-lg font-bold text-red-600">-{formatCurrency(teamTotals.withholdingAmount)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-emerald-600 mb-1">총 실지급액</p>
                    <p className="text-lg font-bold text-emerald-600">{formatCurrency(teamTotals.netAmount)}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">팀원</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">판매건수</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">총 수당</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">원천징수</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">실지급액</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {isLoadingStatements && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">
                        팀원 명세서를 불러오는 중입니다...
                      </td>
                    </tr>
                  )}
                  {!isLoadingStatements && statements.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                        해당 기간의 팀원 정산 내역이 없습니다.
                      </td>
                    </tr>
                  )}
                  {!isLoadingStatements &&
                    statements.map((stmt) => (
                      <tr key={stmt.profileId} className="hover:bg-blue-50/40">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold">
                              {(stmt.displayName || stmt.affiliateCode || '?')[0]}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-gray-900">
                                {stmt.displayName || '-'}
                              </div>
                              <div className="text-xs text-gray-500">
                                {stmt.affiliateCode || '-'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right text-sm text-gray-900">
                          {stmt.salesCount}건
                        </td>
                        <td className="px-4 py-4 text-right text-sm font-semibold text-gray-900">
                          {formatCurrency(stmt.grossAmount)}
                        </td>
                        <td className="px-4 py-4 text-right text-sm text-red-600">
                          -{formatCurrency(stmt.withholdingAmount)}
                        </td>
                        <td className="px-4 py-4 text-right text-sm font-bold text-emerald-600">
                          {formatCurrency(stmt.netAmount)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            onClick={() => setSelectedStatement(stmt)}
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            <FiEye />
                            명세서 보기
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 UI */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
                <div className="text-sm text-gray-600">
                  총 <span className="font-semibold">{pagination.totalCount}</span>명 중{' '}
                  <span className="font-semibold">
                    {(currentPage - 1) * pagination.pageSize + 1}-
                    {Math.min(currentPage * pagination.pageSize, pagination.totalCount)}
                  </span>
                  명 표시
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1 || isLoadingStatements}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FiChevronLeft className="w-4 h-4" />
                    이전
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (pagination.totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= pagination.totalPages - 2) {
                        pageNum = pagination.totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          disabled={isLoadingStatements}
                          className={`w-10 h-10 rounded-lg text-sm font-medium ${
                            pageNum === currentPage
                              ? 'bg-blue-600 text-white'
                              : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                          } disabled:opacity-50`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === pagination.totalPages || isLoadingStatements}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    다음
                    <FiChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {/* StatementCard 모달 */}
      {selectedStatement && selectedSettlement && (
        <StatementCard
          statement={selectedStatement}
          settlement={selectedSettlement}
          onClose={() => setSelectedStatement(null)}
        />
      )}
    </div>
  );
}
