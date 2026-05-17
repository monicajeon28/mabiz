'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, ChevronRight, Loader2, Calendar, FileText, TrendingUp,
} from 'lucide-react';
import { maskCustomerName } from '@/lib/pii-mask';

/* ─────────────────── 타입 정의 ─────────────────── */

type AffiliateMonthlyData = {
  month: string;
  totalRevenue: number;
  conversionRate: number;
  avgOrderAmount: number;
  topProducts: Array<{ productName: string; salesCount: number }>;
  pages: Array<{
    id: string;
    title: string;
    revenue: number;
    conversionRate: number;
    salesCount: number;
  }>;
};

type AffiliatePageDetail = {
  pageId: string;
  pageTitle: string;
  month: string;
  totalRevenue: number;
  conversionRate: number;
  avgOrderAmount: number;
  topProducts: Array<{
    productName: string;
    salesCount: number;
    totalAmount: number;
  }>;
  monthlyTrend: Array<{ month: string; revenue: number }>;
  customers: Array<{
    customerName: string;
    amount: number;
    paymentDate: string;
    productName: string;
  }>;
};

/* ─────────────────── 유틸 함수 ─────────────────── */

function formatWon(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만`;
  return n.toLocaleString();
}

function getMonthOptions(): { label: string; value: string }[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    return {
      label: `${y}년 ${m}월`,
      value: `${y}-${String(m).padStart(2, '0')}`,
    };
  });
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      <FileText className="h-10 w-10 mb-2" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

/* ─────────────────── Step 1: 월 선택 ─────────────────── */

function MonthSelector({
  onSelect,
}: {
  onSelect: (month: string) => void;
}) {
  const monthOptions = getMonthOptions();

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">매출 분석</h1>
          <p className="text-sm text-gray-500 mt-1">조회할 월을 선택하세요.</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Calendar className="h-5 w-5 text-gray-400" />
            <h2 className="text-base font-semibold text-gray-900">월 선택</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {monthOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => onSelect(option.value)}
                className="p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 text-left transition-all active:scale-[0.98]"
              >
                <p className="font-semibold text-gray-900">{option.label}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── Step 2: 페이지 목록 ─────────────────── */

function PageListSelector({
  month,
  data,
  loading,
  onSelect,
  onBack,
}: {
  month: string;
  data: AffiliateMonthlyData | null;
  loading: boolean;
  onSelect: (pageId: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
            title="뒤로가기"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">매출 분석</h1>
            <p className="text-sm text-gray-500 mt-1">{month} 기준 랜딩페이지 현황</p>
          </div>
        </div>

        {/* 요약 카드 */}
        {data && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500 mb-1">총 수익</p>
              <p className="text-2xl font-bold text-gray-900">₩{formatWon(data.totalRevenue)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500 mb-1">전환율</p>
              <p className="text-2xl font-bold text-gray-900">{(data.conversionRate * 100).toFixed(1)}%</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500 mb-1">평균 금액</p>
              <p className="text-2xl font-bold text-gray-900">₩{formatWon(data.avgOrderAmount)}</p>
            </div>
          </div>
        )}

        {/* 페이지 목록 테이블 */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">페이지 목록</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : !data || data.pages.length === 0 ? (
            <EmptyState message="조회 가능한 페이지가 없습니다." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium">페이지명</th>
                    <th className="px-6 py-3 text-right font-medium">수익</th>
                    <th className="px-6 py-3 text-right font-medium">전환율</th>
                    <th className="px-6 py-3 text-right font-medium">판매 건수</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.pages.map((page) => (
                    <tr
                      key={page.id}
                      onClick={() => onSelect(page.id)}
                      className="hover:bg-blue-50 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4 font-medium text-gray-900 group-hover:text-blue-600">
                        {page.title}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-700">₩{formatWon(page.revenue)}</td>
                      <td className="px-6 py-4 text-right">
                        <span className="inline-flex items-center gap-1 text-gray-700">
                          {(page.conversionRate * 100).toFixed(1)}%
                          <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-gray-700">{page.salesCount}건</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── Step 3: 페이지 상세 ─────────────────── */

function DetailView({
  month,
  pageId,
  data,
  loading,
  onBack,
}: {
  month: string;
  pageId: string;
  data: AffiliatePageDetail | null;
  loading: boolean;
  onBack: () => void;
}) {
  const [customerPage, setCustomerPage] = useState(1);
  const customersPerPage = 10;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={onBack}
            className="mb-6 p-2 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <EmptyState message="상세 데이터를 불러올 수 없습니다." />
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(data.customers.length / customersPerPage);
  const startIdx = (customerPage - 1) * customersPerPage;
  const paginatedCustomers = data.customers.slice(startIdx, startIdx + customersPerPage);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
            title="뒤로가기"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{data.pageTitle}</h1>
            <p className="text-sm text-gray-500 mt-1">{month} 상세 분석</p>
          </div>
        </div>

        {/* 핵심 지표 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-500 mb-1">총 수익</p>
            <p className="text-2xl font-bold text-gray-900">₩{formatWon(data.totalRevenue)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-500 mb-1">전환율</p>
            <p className="text-2xl font-bold text-gray-900">{(data.conversionRate * 100).toFixed(1)}%</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-500 mb-1">평균 금액</p>
            <p className="text-2xl font-bold text-gray-900">₩{formatWon(data.avgOrderAmount)}</p>
          </div>
        </div>

        {/* 월별 수익 트렌드 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm mb-8">
          <h2 className="text-base font-semibold text-gray-900 mb-4">수익 추이</h2>
          <div className="space-y-2">
            {data.monthlyTrend.length === 0 ? (
              <p className="text-sm text-gray-400">추이 데이터가 없습니다.</p>
            ) : (
              data.monthlyTrend.map((item) => {
                const maxRevenue = Math.max(...data.monthlyTrend.map((m) => m.revenue));
                const percentage = maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 0;
                return (
                  <div key={item.month} className="flex items-center gap-3">
                    <div className="w-20 text-xs font-medium text-gray-600">{item.month}</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full flex items-center justify-end pr-2 text-xs font-semibold text-white"
                        style={{ width: `${percentage}%` }}
                      >
                        {percentage > 10 && `₩${formatWon(item.revenue)}`}
                      </div>
                    </div>
                    <div className="w-24 text-right text-xs text-gray-600">₩{formatWon(item.revenue)}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* TOP 5 인기상품 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm mb-8">
          <h2 className="text-base font-semibold text-gray-900 mb-4">인기 상품 TOP 5</h2>
          {data.topProducts.length === 0 ? (
            <EmptyState message="상품 데이터가 없습니다." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">상품명</th>
                    <th className="px-4 py-3 text-right font-medium">판매 건수</th>
                    <th className="px-4 py-3 text-right font-medium">판매액</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.topProducts.slice(0, 5).map((product) => (
                    <tr key={product.productName} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{product.productName}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{product.salesCount}건</td>
                      <td className="px-4 py-3 text-right text-gray-700">₩{formatWon(product.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 구매자 현황 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">구매자 현황</h2>
          {data.customers.length === 0 ? (
            <EmptyState message="고객 데이터가 없습니다." />
          ) : (
            <>
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">고객명</th>
                      <th className="px-4 py-3 text-left font-medium">상품명</th>
                      <th className="px-4 py-3 text-right font-medium">결제액</th>
                      <th className="px-4 py-3 text-right font-medium">결제일</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedCustomers.map((customer, i) => (
                      <tr key={`${customer.customerName}-${i}`} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">{maskCustomerName(customer.customerName)}</td>
                        <td className="px-4 py-3 text-gray-700 max-w-[200px] truncate">{customer.productName}</td>
                        <td className="px-4 py-3 text-right text-gray-700">₩{formatWon(customer.amount)}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{customer.paymentDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 페이징 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400">
                    {startIdx + 1}-{Math.min(startIdx + customersPerPage, data.customers.length)} / {data.customers.length}건
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setCustomerPage((p) => Math.max(1, p - 1))}
                      disabled={customerPage === 1}
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCustomerPage((p) => Math.min(totalPages, p + 1))}
                      disabled={customerPage === totalPages}
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── 메인 페이지 ─────────────────── */

export default function MyAffiliateSalesPage() {
  const router = useRouter();
  const [step, setStep] = useState<'month' | 'pages' | 'detail'>('month');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedPageId, setSelectedPageId] = useState<string>('');

  // Step 2: 페이지 목록 데이터
  const [monthlyData, setMonthlyData] = useState<AffiliateMonthlyData | null>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  // Step 3: 페이지 상세 데이터
  const [detailData, setDetailData] = useState<AffiliatePageDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Step 1 → Step 2: 월 선택 후 데이터 로드
  const handleMonthSelect = useCallback(async (month: string) => {
    setSelectedMonth(month);
    setMonthlyLoading(true);
    try {
      const res = await fetch(`/api/affiliate/my-sales?month=${month}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.ok && json.data) {
        setMonthlyData(json.data);
        setStep('pages');
      }
    } catch (error) {
      console.error('[my-sales] fetch error:', error);
      alert('데이터를 불러올 수 없습니다.');
    } finally {
      setMonthlyLoading(false);
    }
  }, []);

  // Step 2 → Step 3: 페이지 선택 후 상세 데이터 로드
  const handlePageSelect = useCallback(
    async (pageId: string) => {
      setSelectedPageId(pageId);
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/affiliate/my-sales?month=${selectedMonth}&pageId=${pageId}`, {
          credentials: 'include',
        });
        const json = await res.json();
        if (json.ok && json.data) {
          setDetailData(json.data);
          setStep('detail');
        }
      } catch (error) {
        console.error('[my-sales] detail fetch error:', error);
        alert('상세 데이터를 불러올 수 없습니다.');
      } finally {
        setDetailLoading(false);
      }
    },
    [selectedMonth]
  );

  // Step 뒤로가기
  const handleBack = useCallback(() => {
    if (step === 'pages') {
      setStep('month');
      setMonthlyData(null);
    } else if (step === 'detail') {
      setStep('pages');
      setDetailData(null);
    }
  }, [step]);

  if (step === 'month') {
    return <MonthSelector onSelect={handleMonthSelect} />;
  }

  if (step === 'pages') {
    return (
      <PageListSelector
        month={selectedMonth}
        data={monthlyData}
        loading={monthlyLoading}
        onSelect={handlePageSelect}
        onBack={handleBack}
      />
    );
  }

  if (step === 'detail') {
    return (
      <DetailView
        month={selectedMonth}
        pageId={selectedPageId}
        data={detailData}
        loading={detailLoading}
        onBack={handleBack}
      />
    );
  }

  return null;
}
