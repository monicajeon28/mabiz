// app/partner/[partnerId]/sales/SalesClient.tsx
// 파트너 판매 내역 클라이언트 컴포넌트

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FiArrowLeft,
  FiRefreshCw,
  FiDollarSign,
  FiPackage,
  FiCalendar,
  FiUser,
  FiTrendingUp,
  FiInfo,
} from 'react-icons/fi';
import { showError } from '@/components/ui/Toast';

type Sale = {
  id: number;
  externalOrderCode: string | null;
  productCode: string | null;
  cabinType: string | null;
  fareCategory: string | null;
  headcount: number | null;
  saleAmount: number | null;
  costAmount: number | null;
  netRevenue: number | null;
  branchCommission: number | null;
  salesCommission: number | null;
  overrideCommission: number | null;
  withholdingAmount: number | null;
  status: string;
  saleDate: string | null;
  confirmedAt: string | null;
  metadata: any;
  AffiliateProduct: {
    id: number;
    productCode: string;
    title: string;
    CruiseProduct: {
      packageName: string | null;
      cruiseLine: string | null;
      shipName: string | null;
    } | null;
  } | null;
  ManagerProfile: {
    id: number;
    displayName: string | null;
    branchLabel: string | null;
  } | null;
  AgentProfile: {
    id: number;
    displayName: string | null;
    User: {
      mallUserId: string;
      name: string | null;
    } | null;
  } | null;
  Lead: {
    id: number;
    customerName: string | null;
    customerPhone: string | null;
    customerEmail: string | null;
  } | null;
};

type Stats = {
  totalSales: number;
  totalSaleAmount: number;
  totalBranchCommission: number;
  totalSalesCommission: number;
  totalOverrideCommission: number;
  totalWithholding: number;
  myCommission: number;
};

type SalesClientProps = {
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

export default function SalesClient({ currentUser, profile }: SalesClientProps) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const partnerBase = `/partner/${currentUser.mallUserId}`;

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/partner/sales');
      const json = await res.json();
      if (res.ok && json.ok) {
        setSales(json.sales || []);
        setStats(json.stats || null);
      } else {
        showError(json.message || '판매 내역을 불러오는 중 오류가 발생했습니다.');
      }
    } catch (error: any) {
      console.error('[SalesClient] load error', error);
      showError(error.message || '판매 내역을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PENDING_APPROVAL':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'REFUNDED':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return '확정';
      case 'PENDING_APPROVAL':
        return '승인대기';
      case 'REFUNDED':
        return '환불';
      default:
        return status;
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '-';
    return `${amount.toLocaleString()}원`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href={partnerBase}
              className="p-2 hover:bg-white/80 rounded-lg transition-all duration-200 border border-slate-200"
            >
              <FiArrowLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">판매 내역</h1>
              <p className="text-slate-600 mt-1">나의 판매 실적과 수당을 확인하세요</p>
            </div>
          </div>

          <button
            onClick={loadSales}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all duration-200 disabled:opacity-50"
          >
            <FiRefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <FiPackage className="w-5 h-5 text-slate-600" />
                </div>
                <span className="text-sm font-medium text-slate-600">총 판매건수</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{stats.totalSales}건</p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-50 rounded-lg">
                  <FiDollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <span className="text-sm font-medium text-slate-600">총 판매액</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats.totalSaleAmount)}</p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-slate-900 rounded-lg">
                  <FiTrendingUp className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-medium text-slate-600">나의 수당</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats.myCommission)}</p>
              <p className="text-xs text-slate-500 mt-1">
                원천징수 전: {formatCurrency(stats.myCommission + stats.totalWithholding)}
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-amber-50 rounded-lg">
                  <FiInfo className="w-5 h-5 text-amber-600" />
                </div>
                <span className="text-sm font-medium text-slate-600">원천징수</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats.totalWithholding)}</p>
              <p className="text-xs text-slate-500 mt-1">3.3% 사업소득세</p>
            </div>
          </div>
        )}

        {/* Sales Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">판매 목록</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    판매일
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    상품
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    객실
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                    판매액
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                    {profile.type === 'BRANCH_MANAGER' ? '대리점수당' : '판매원수당'}
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-600 uppercase tracking-wider">
                    상태
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                      <FiRefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                      불러오는 중...
                    </td>
                  </tr>
                ) : sales.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                      판매 내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  sales.map((sale) => {
                    const commission =
                      profile.type === 'BRANCH_MANAGER'
                        ? (sale.ManagerProfile?.id === profile.id ? sale.branchCommission : 0) +
                          (sale.AgentProfile?.id === profile.id ? sale.salesCommission : 0)
                        : sale.AgentProfile?.id === profile.id
                        ? sale.salesCommission
                        : 0;

                    return (
                      <tr
                        key={sale.id}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedSale(sale);
                          setShowDetailModal(true);
                        }}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-sm text-slate-700">
                            <FiCalendar className="w-4 h-4 text-slate-400" />
                            {formatDate(sale.saleDate)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-slate-900">
                            {sale.AffiliateProduct?.title || sale.productCode}
                          </div>
                          {sale.AffiliateProduct?.CruiseProduct && (
                            <div className="text-xs text-slate-500 mt-1">
                              {sale.AffiliateProduct.CruiseProduct.cruiseLine} ·{' '}
                              {sale.AffiliateProduct.CruiseProduct.shipName}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-700">{sale.cabinType || '-'}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-sm font-medium text-slate-900">
                            {formatCurrency(sale.saleAmount)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-sm font-bold text-slate-900">{formatCurrency(commission)}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(
                              sale.status
                            )}`}
                          >
                            {getStatusLabel(sale.status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail Modal */}
        {showDetailModal && selectedSale && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">판매 상세</h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <FiArrowLeft className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Product Info */}
                <div>
                  <h4 className="text-sm font-medium text-slate-600 mb-3">상품 정보</h4>
                  <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">상품명</span>
                      <span className="text-sm font-medium text-slate-900">
                        {selectedSale.AffiliateProduct?.title || selectedSale.productCode}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">객실타입</span>
                      <span className="text-sm font-medium text-slate-900">{selectedSale.cabinType || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">주문번호</span>
                      <span className="text-sm font-medium text-slate-900">
                        {selectedSale.externalOrderCode || '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Commission Info */}
                <div>
                  <h4 className="text-sm font-medium text-slate-600 mb-3">수당 정보</h4>
                  <div className="bg-slate-100 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-700">판매액</span>
                      <span className="text-lg font-bold text-slate-900">
                        {formatCurrency(selectedSale.saleAmount)}
                      </span>
                    </div>
                    <div className="border-t border-slate-200 pt-2 space-y-2">
                      {selectedSale.branchCommission > 0 && (
                        <div className="flex justify-between">
                          <span className="text-sm text-slate-600">대리점 수당</span>
                          <span className="text-sm font-semibold text-slate-900">
                            {formatCurrency(selectedSale.branchCommission)}
                          </span>
                        </div>
                      )}
                      {selectedSale.salesCommission > 0 && (
                        <div className="flex justify-between">
                          <span className="text-sm text-slate-600">판매원 수당</span>
                          <span className="text-sm font-semibold text-slate-900">
                            {formatCurrency(selectedSale.salesCommission)}
                          </span>
                        </div>
                      )}
                      {selectedSale.withholdingAmount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-sm text-slate-600">원천징수 (3.3%)</span>
                          <span className="text-sm font-medium text-red-600">
                            -{formatCurrency(selectedSale.withholdingAmount)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Customer Info */}
                {selectedSale.Lead && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-600 mb-3">고객 정보</h4>
                    <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600">고객명</span>
                        <span className="text-sm font-medium text-slate-900">
                          {selectedSale.Lead.customerName || '-'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600">연락처</span>
                        <span className="text-sm font-medium text-slate-900">
                          {selectedSale.Lead.customerPhone || '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Agent Info */}
                {selectedSale.AgentProfile && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-600 mb-3">판매원 정보</h4>
                    <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600">판매원</span>
                        <span className="text-sm font-medium text-slate-900">
                          {selectedSale.AgentProfile.displayName || selectedSale.AgentProfile.User?.name}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
