'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShoppingCart, Users, CreditCard, UserPlus, GraduationCap,
  DollarSign, Crown, MessageSquare, Percent, Plane, FileText,
  Clock, Loader2, CalendarDays, ChevronDown, X, ChevronLeft, ChevronRight,
} from 'lucide-react';

/* ─────────────────── 타입 ─────────────────── */

type Tab = 'b2c' | 'b2b' | 'gold';

// B2C
type B2CSale = {
  id: string;
  productName: string;
  amount: number;
  commission: number;
  status: string;
  date: string;
};
type B2CPassport = {
  id: string;
  customerName: string;
  passportStatus: string;
  pnrStatus: string;
  confirmedAt: string | null;
};
type TrendValues = Record<string, number>;
type B2CData = {
  totalSalesAmount: number;
  salesCount: number;
  reservationCount: number;
  recentSales: B2CSale[];
  passportPnr: B2CPassport[];
  trends?: TrendValues;
};

// B2B
type B2BLead = {
  id: string;
  name: string;
  phone: string;
  interestedPackage: string;
  source: string;
  status: string;
};
type B2BPayment = {
  id: string;
  customerName: string;
  amount: number;
  product: string;
  date: string;
};
type B2BData = {
  newLeads: number;
  eduApplicants: number;
  paymentAmount: number;
  recentLeads: B2BLead[];
  recentPayments: B2BPayment[];
  trends?: TrendValues;
};

// Gold
type GoldMember = {
  id: string;
  name: string;
  course: string;
  paidCount: number;
  totalCount: number;
  status: string;
};
type GoldConsultation = {
  id: string;
  memberName: string;
  content: string;
  date: string;
};
type GoldData = {
  goldMemberCount: number;
  newInquiries: number;
  paymentRate: number;
  members: GoldMember[];
  recentConsultations: GoldConsultation[];
  trends?: TrendValues;
};

/* ─────────────────── 유틸 ─────────────────── */

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

/* ─────────────────── 배지 ─────────────────── */

const STATUS_COLORS: Record<string, string> = {
  PENDING:    'bg-yellow-100 text-yellow-800',
  COMPLETED:  'bg-green-100 text-green-800',
  CONFIRMED:  'bg-green-100 text-green-800',
  CANCELLED:  'bg-red-100 text-red-800',
  SENT:       'bg-blue-100 text-blue-800',
  NEW:        'bg-blue-100 text-blue-800',
  CONTACTED:  'bg-purple-100 text-purple-800',
  WON:        'bg-green-100 text-green-800',
  LOST:       'bg-gray-100 text-gray-500',
  ACTIVE:     'bg-green-100 text-green-800',
  PAUSED:     'bg-yellow-100 text-yellow-800',
};

function Badge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}

/* ─────────────────── 공통 컴포넌트 ─────────────────── */

function StatCard({
  title, value, icon, suffix, trend, onClick,
}: {
  title: string; value: string | number; icon: React.ReactNode; suffix?: string; trend?: number; onClick?: () => void;
}) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all ${
        onClick ? 'cursor-pointer hover:border-blue-300 hover:shadow-md active:scale-[0.98]' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <span className="text-gray-300">{icon}</span>
      </div>
      <div className="mt-1 flex items-end gap-2">
        <p className="text-3xl font-bold text-gray-900">
          {typeof value === 'number' ? value.toLocaleString() : value}
          {suffix && <span className="ml-1 text-lg font-medium text-gray-400">{suffix}</span>}
        </p>
        {trend !== undefined && trend !== 0 && (
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full mb-1 ${
            trend > 0
              ? 'bg-green-50 text-green-600'
              : 'bg-red-50 text-red-600'
          }`}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="flex items-center justify-between mt-1">
        {trend !== undefined && trend !== 0 ? (
          <p className="text-xs text-gray-400">전월 대비</p>
        ) : <span />}
        {onClick && <p className="text-xs text-blue-500">상세보기 →</p>}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm animate-pulse">
      <div className="h-4 w-20 bg-gray-200 rounded mb-3" />
      <div className="h-8 w-32 bg-gray-200 rounded" />
    </div>
  );
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: cols }, (_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded w-full" />
        </td>
      ))}
    </tr>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      <FileText className="h-10 w-10 mb-2" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function TableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      {children}
    </div>
  );
}

/* ─────────────────── 드릴다운 드로어 ─────────────────── */

type DrilldownConfig = {
  title: string;
  apiUrl: string;
  columns: { key: string; label: string; align?: 'left' | 'right' | 'center'; render?: (v: unknown, row: Record<string, unknown>) => React.ReactNode }[];
  summaryRender?: (data: Record<string, unknown>) => React.ReactNode;
};

function DrilldownDrawer({
  config, open, onClose,
}: {
  config: DrilldownConfig | null; open: boolean; onClose: () => void;
}) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!open || !config) return;
    setPage(1);
    setItems([]);
    setSummary(null);
  }, [open, config]);

  useEffect(() => {
    if (!open || !config) return;
    setLoading(true);
    fetch(`${config.apiUrl}&page=${page}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        if (json.ok && json.data) {
          setItems(json.data.items ?? []);
          setTotal(json.data.total ?? 0);
          setTotalPages(json.data.totalPages ?? 1);
          if (json.data.summary) setSummary(json.data.summary);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, config, page]);

  if (!open || !config) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-2xl bg-white h-full overflow-y-auto shadow-xl flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-base font-bold text-gray-900">{config.title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">총 {total.toLocaleString()}건</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 요약 (있으면) */}
        {summary && config.summaryRender && (
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            {config.summaryRender(summary)}
          </div>
        )}

        {/* 테이블 */}
        <div className="flex-1 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState message="데이터가 없습니다." />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase sticky top-0">
                <tr>
                  {config.columns.map((col) => (
                    <th key={col.key} className={`px-4 py-3 text-${col.align ?? 'left'} font-medium`}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((row, i) => (
                  <tr key={(row.id as string) ?? i} className="hover:bg-gray-50 transition-colors">
                    {config.columns.map((col) => (
                      <td key={col.key} className={`px-4 py-3 text-${col.align ?? 'left'} ${col.align === 'right' ? 'text-gray-700' : ''}`}>
                        {col.render ? col.render(row[col.key], row) : (
                          <span className="text-gray-700">{String(row[col.key] ?? '-')}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 페이징 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-white sticky bottom-0">
            <p className="text-xs text-gray-400">{page} / {totalPages}</p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────── B2C 탭 ─────────────────── */

function B2CTab({ data, loading, month, onDrilldown }: { data: B2CData | null; loading: boolean; month: string; onDrilldown: (config: DrilldownConfig) => void }) {
  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
        <TableWrapper>
          <table className="w-full text-sm">
            <tbody>{Array.from({ length: 3 }, (_, i) => <SkeletonRow key={i} cols={5} />)}</tbody>
          </table>
        </TableWrapper>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 통계 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="총 판매액" value={`₩${formatWon(data.totalSalesAmount)}`} icon={<DollarSign className="h-5 w-5" />} trend={data.trends?.totalSalesAmount} onClick={() => onDrilldown({
          title: '판매 상세 내역',
          apiUrl: `/api/partner/dashboard/b2c/detail?type=sales&month=${month}`,
          columns: [
            { key: 'productName', label: '상품명' },
            { key: 'amount', label: '금액', align: 'right', render: (v) => `₩${(v as number)?.toLocaleString()}` },
            { key: 'commission', label: '수수료', align: 'right', render: (v) => `₩${(v as number)?.toLocaleString()}` },
            { key: 'status', label: '상태', align: 'center', render: (v) => <Badge status={v as string} /> },
            { key: 'date', label: '날짜', align: 'right' },
          ],
        })} />
        <StatCard title="판매 건수" value={data.salesCount} icon={<ShoppingCart className="h-5 w-5" />} suffix="건" trend={data.trends?.salesCount} onClick={() => onDrilldown({
          title: '판매 상세 내역',
          apiUrl: `/api/partner/dashboard/b2c/detail?type=sales&month=${month}`,
          columns: [
            { key: 'productName', label: '상품명' },
            { key: 'amount', label: '금액', align: 'right', render: (v) => `₩${(v as number)?.toLocaleString()}` },
            { key: 'commission', label: '수수료', align: 'right', render: (v) => `₩${(v as number)?.toLocaleString()}` },
            { key: 'status', label: '상태', align: 'center', render: (v) => <Badge status={v as string} /> },
            { key: 'date', label: '날짜', align: 'right' },
          ],
        })} />
        <StatCard title="예약 현황" value={data.reservationCount} icon={<Plane className="h-5 w-5" />} suffix="건" trend={data.trends?.reservationCount} onClick={() => onDrilldown({
          title: '예약 상세 내역',
          apiUrl: `/api/partner/dashboard/b2c/detail?type=reservations&month=${month}`,
          columns: [
            { key: 'customerName', label: '고객명' },
            { key: 'productName', label: '상품명' },
            { key: 'passportStatus', label: '여권', align: 'center', render: (v) => <Badge status={v as string} /> },
            { key: 'pnrStatus', label: 'PNR', align: 'center', render: (v) => <Badge status={v as string} /> },
            { key: 'departureDate', label: '출발일', align: 'right' },
            { key: 'date', label: '예약일', align: 'right' },
          ],
        })} />
      </div>

      {/* 최근 판매 */}
      <TableWrapper>
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">최근 판매</h3>
        </div>
        {data.recentSales.length === 0 ? (
          <EmptyState message="판매 내역이 없습니다." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">상품명</th>
                <th className="px-4 py-3 text-right">금액</th>
                <th className="px-4 py-3 text-right">수수료</th>
                <th className="px-4 py-3 text-center">상태</th>
                <th className="px-4 py-3 text-right">날짜</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.recentSales.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">{s.productName}</td>
                  <td className="px-4 py-3 text-right text-gray-700">₩{s.amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-700">₩{s.commission.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center"><Badge status={s.status} /></td>
                  <td className="px-4 py-3 text-right text-gray-500">{s.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableWrapper>

      {/* 여권/PNR 현황 */}
      <TableWrapper>
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">여권 / PNR 현황</h3>
        </div>
        {data.passportPnr.length === 0 ? (
          <EmptyState message="여권/PNR 데이터가 없습니다." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">고객명</th>
                <th className="px-4 py-3 text-center">여권</th>
                <th className="px-4 py-3 text-center">PNR</th>
                <th className="px-4 py-3 text-right">최종확인</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.passportPnr.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-blue-50 transition-colors cursor-pointer"
                  onClick={() => onDrilldown({
                    title: `${p.customerName} — 예약 상세`,
                    apiUrl: `/api/partner/dashboard/b2c/detail?type=reservations&month=${month}`,
                    columns: [
                      { key: 'customerName', label: '고객명' },
                      { key: 'productName', label: '상품명' },
                      { key: 'passportStatus', label: '여권', align: 'center', render: (v) => <Badge status={v as string} /> },
                      { key: 'pnrStatus', label: 'PNR', align: 'center', render: (v) => <Badge status={v as string} /> },
                      { key: 'departureDate', label: '출발일', align: 'right' },
                      { key: 'date', label: '예약일', align: 'right' },
                    ],
                  })}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{p.customerName}</td>
                  <td className="px-4 py-3 text-center"><Badge status={p.passportStatus} /></td>
                  <td className="px-4 py-3 text-center"><Badge status={p.pnrStatus} /></td>
                  <td className="px-4 py-3 text-right text-gray-500">{p.confirmedAt ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableWrapper>
    </div>
  );
}

/* ─────────────────── B2B 탭 ─────────────────── */

function B2BTab({ data, loading, month, onDrilldown }: { data: B2BData | null; loading: boolean; month: string; onDrilldown: (config: DrilldownConfig) => void }) {
  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
        <TableWrapper>
          <table className="w-full text-sm">
            <tbody>{Array.from({ length: 3 }, (_, i) => <SkeletonRow key={i} cols={5} />)}</tbody>
          </table>
        </TableWrapper>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="신규 리드" value={data.newLeads} icon={<UserPlus className="h-5 w-5" />} suffix="명" trend={data.trends?.newLeads} onClick={() => onDrilldown({
          title: '신규 리드 전체',
          apiUrl: `/api/partner/dashboard/b2b/detail?type=leads&month=${month}`,
          columns: [
            { key: 'name', label: '이름' },
            { key: 'phone', label: '연락처' },
            { key: 'interestedPackage', label: '관심 패키지' },
            { key: 'source', label: '출처' },
            { key: 'status', label: '상태', align: 'center', render: (v) => <Badge status={v as string} /> },
            { key: 'date', label: '날짜', align: 'right' },
          ],
        })} />
        <StatCard title="교육 신청자" value={data.eduApplicants} icon={<GraduationCap className="h-5 w-5" />} suffix="명" trend={data.trends?.eduApplicants} onClick={() => onDrilldown({
          title: '랜딩 등록자 전체',
          apiUrl: `/api/partner/dashboard/b2b/detail?type=registrations&month=${month}`,
          columns: [
            { key: 'name', label: '이름' },
            { key: 'phone', label: '연락처' },
            { key: 'landingPageTitle', label: '랜딩페이지' },
            { key: 'utmSource', label: 'UTM 출처' },
            { key: 'date', label: '날짜', align: 'right' },
          ],
        })} />
        <StatCard title="결제 현황" value={`₩${formatWon(data.paymentAmount)}`} icon={<CreditCard className="h-5 w-5" />} trend={data.trends?.paymentAmount} onClick={() => onDrilldown({
          title: '결제 상세 내역',
          apiUrl: `/api/partner/dashboard/b2b/detail?type=payments&month=${month}`,
          columns: [
            { key: 'productName', label: '상품명' },
            { key: 'amount', label: '금액', align: 'right', render: (v) => `₩${(v as number)?.toLocaleString()}` },
            { key: 'customerPhone', label: '고객 연락처' },
            { key: 'status', label: '상태', align: 'center', render: (v) => <Badge status={v as string} /> },
            { key: 'date', label: '결제일', align: 'right' },
          ],
        })} />
      </div>

      {/* 최근 리드 */}
      <TableWrapper>
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">최근 리드</h3>
        </div>
        {data.recentLeads.length === 0 ? (
          <EmptyState message="리드 내역이 없습니다." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">이름</th>
                <th className="px-4 py-3 text-left">전화</th>
                <th className="px-4 py-3 text-left">관심 패키지</th>
                <th className="px-4 py-3 text-left">출처</th>
                <th className="px-4 py-3 text-center">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.recentLeads.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{l.name}</td>
                  <td className="px-4 py-3 text-gray-700">{l.phone}</td>
                  <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate">{l.interestedPackage}</td>
                  <td className="px-4 py-3 text-gray-500">{l.source}</td>
                  <td className="px-4 py-3 text-center"><Badge status={l.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableWrapper>

      {/* 최근 결제 */}
      <TableWrapper>
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">최근 결제</h3>
        </div>
        {data.recentPayments.length === 0 ? (
          <EmptyState message="결제 내역이 없습니다." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">고객명</th>
                <th className="px-4 py-3 text-right">금액</th>
                <th className="px-4 py-3 text-left">상품</th>
                <th className="px-4 py-3 text-right">날짜</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.recentPayments.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.customerName}</td>
                  <td className="px-4 py-3 text-right text-gray-700">₩{p.amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-700 max-w-[200px] truncate">{p.product}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{p.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableWrapper>
    </div>
  );
}

/* ─────────────────── 골드 탭 ─────────────────── */

function GoldTab({ data, loading, month, onDrilldown }: { data: GoldData | null; loading: boolean; month: string; onDrilldown: (config: DrilldownConfig) => void }) {
  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
        <TableWrapper>
          <table className="w-full text-sm">
            <tbody>{Array.from({ length: 3 }, (_, i) => <SkeletonRow key={i} cols={4} />)}</tbody>
          </table>
        </TableWrapper>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="골드 회원 수" value={data.goldMemberCount} icon={<Crown className="h-5 w-5" />} suffix="명" trend={data.trends?.goldMemberCount} onClick={() => onDrilldown({
          title: '전체 활성 회원',
          apiUrl: `/api/partner/dashboard/gold/detail?type=members&month=${month}`,
          columns: [
            { key: 'name', label: '이름' },
            { key: 'phone', label: '연락처' },
            { key: 'courseType', label: '코스', align: 'center', render: (v) => {
              const labels: Record<string, string> = { A: 'A코스', B: 'B코스', C: 'C코스', HEALTH: '건강' };
              const colors: Record<string, string> = { A: 'bg-blue-100 text-blue-700', B: 'bg-purple-100 text-purple-700', C: 'bg-indigo-100 text-indigo-700', HEALTH: 'bg-emerald-100 text-emerald-700' };
              const key = v as string;
              return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[key] ?? 'bg-gray-100'}`}>{labels[key] ?? key}</span>;
            }},
            { key: 'paidCount', label: '납부', align: 'center', render: (_v, row) => {
              const paid = row.paidCount as number;
              const total = row.totalPayments as number;
              return total > 0 ? `${paid}/${total}` : `${paid}회`;
            }},
            { key: 'joinDate', label: '가입일', align: 'right' },
          ],
        })} />
        <StatCard title="신규 문의" value={data.newInquiries} icon={<MessageSquare className="h-5 w-5" />} suffix="건" trend={data.trends?.newInquiries} onClick={() => onDrilldown({
          title: '상담 전체 내역',
          apiUrl: `/api/partner/dashboard/gold/detail?type=consultations&month=${month}`,
          columns: [
            { key: 'memberName', label: '회원명' },
            { key: 'memberCode', label: '코드' },
            { key: 'content', label: '내용', render: (v) => {
              const s = String(v ?? '');
              return <span className="max-w-[200px] truncate block">{s.length > 40 ? s.slice(0, 40) + '...' : s}</span>;
            }},
            { key: 'date', label: '날짜', align: 'right' },
          ],
        })} />
        <StatCard title="납부율" value={data.paymentRate} icon={<Percent className="h-5 w-5" />} suffix="%" onClick={() => onDrilldown({
          title: '납부 현황 분류',
          apiUrl: `/api/partner/dashboard/gold/detail?type=payment-breakdown&month=${month}`,
          columns: [
            { key: 'name', label: '이름' },
            { key: 'courseType', label: '코스', align: 'center', render: (v) => {
              const labels: Record<string, string> = { A: 'A', B: 'B', C: 'C', HEALTH: '건강' };
              return labels[v as string] ?? v;
            }},
            { key: 'paidCount', label: '납부', align: 'center', render: (_v, row) => {
              const paid = row.paidCount as number;
              const total = row.totalPayments as number;
              return total > 0 ? `${paid}/${total}` : `${paid}회`;
            }},
            { key: 'category', label: '분류', align: 'center', render: (v) => {
              const map: Record<string, { label: string; cls: string }> = {
                completed: { label: '의무완료', cls: 'bg-green-100 text-green-700' },
                inProgress: { label: '진행중', cls: 'bg-yellow-100 text-yellow-700' },
                health: { label: '건강', cls: 'bg-emerald-100 text-emerald-700' },
              };
              const m = map[v as string];
              return m ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.cls}`}>{m.label}</span> : '-';
            }},
          ],
          summaryRender: (summary) => (
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <span className="text-gray-600">의무완료 <strong>{String(summary.completedCount)}명</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                <span className="text-gray-600">진행중 <strong>{String(summary.inProgressCount)}명</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-gray-600">건강 <strong>{String(summary.healthCourseCount)}명</strong></span>
              </div>
            </div>
          ),
        })} />
      </div>

      {/* 회원 목록 */}
      <TableWrapper>
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">회원 목록</h3>
        </div>
        {data.members.length === 0 ? (
          <EmptyState message="골드 회원이 없습니다." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">이름</th>
                <th className="px-4 py-3 text-center">코스</th>
                <th className="px-4 py-3 text-center">납부</th>
                <th className="px-4 py-3 text-center">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.members.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{m.name}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                      {m.course}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700">
                    {m.paidCount}/{m.totalCount}
                  </td>
                  <td className="px-4 py-3 text-center"><Badge status={m.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableWrapper>

      {/* 최근 상담 */}
      <TableWrapper>
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">최근 상담</h3>
        </div>
        {data.recentConsultations.length === 0 ? (
          <EmptyState message="상담 내역이 없습니다." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">회원명</th>
                <th className="px-4 py-3 text-left">내용</th>
                <th className="px-4 py-3 text-right">날짜</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.recentConsultations.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.memberName}</td>
                  <td className="px-4 py-3 text-gray-700 max-w-[300px] truncate">
                    {c.content.length > 50 ? `${c.content.slice(0, 50)}...` : c.content}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">{c.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableWrapper>
    </div>
  );
}

/* ─────────────────── 메인 페이지 ─────────────────── */

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'b2c', label: 'B2C', icon: <ShoppingCart className="h-4 w-4" /> },
  { key: 'b2b', label: 'B2B', icon: <Users className="h-4 w-4" /> },
  { key: 'gold', label: '골드회원', icon: <Crown className="h-4 w-4" /> },
];

const API_MAP: Record<Tab, string> = {
  b2c: '/api/partner/dashboard/b2c',
  b2b: '/api/partner/dashboard/b2b',
  gold: '/api/partner/dashboard/gold',
};

export default function PartnerDashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('b2c');
  const [month, setMonth] = useState(() => getMonthOptions()[0].value);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(false);

  // 탭별 캐시 (월 변경 시 초기화)
  const cache = useRef<Record<string, Record<Tab, unknown>>>({});

  const [b2cData, setB2cData] = useState<B2CData | null>(null);
  const [b2bData, setB2bData] = useState<B2BData | null>(null);
  const [goldData, setGoldData] = useState<GoldData | null>(null);

  // 드릴다운 드로어
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerConfig, setDrawerConfig] = useState<DrilldownConfig | null>(null);
  const openDrilldown = useCallback((config: DrilldownConfig) => {
    setDrawerConfig(config);
    setDrawerOpen(true);
  }, []);

  const monthOptions = getMonthOptions();

  const fetchTab = useCallback(async (tab: Tab, ym: string) => {
    // 캐시 히트
    const cached = cache.current[ym]?.[tab];
    if (cached) {
      if (tab === 'b2c') setB2cData(cached as B2CData);
      if (tab === 'b2b') setB2bData(cached as B2BData);
      if (tab === 'gold') setGoldData(cached as GoldData);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_MAP[tab]}?month=${ym}`, {
        credentials: 'include',
      });

      if (res.status === 401 || res.status === 403) {
        setAuthError(true);
        setLoading(false);
        return;
      }

      const json = await res.json();
      if (!json.ok) {
        setLoading(false);
        return;
      }

      const d = json.data;
      if (!cache.current[ym]) cache.current[ym] = {} as Record<Tab, unknown>;
      cache.current[ym][tab] = d;

      if (tab === 'b2c') setB2cData(d as B2CData);
      if (tab === 'b2b') setB2bData(d as B2BData);
      if (tab === 'gold') setGoldData(d as GoldData);
    } catch {
      // 네트워크 오류 무시 — 스켈레톤 유지
    }
    setLoading(false);
  }, []);

  // 탭 또는 월 변경 시 fetch
  useEffect(() => {
    fetchTab(activeTab, month);
  }, [activeTab, month, fetchTab]);

  // 월 변경 시 캐시된 데이터 세팅 or null
  useEffect(() => {
    const c = cache.current[month];
    setB2cData((c?.b2c as B2CData) ?? null);
    setB2bData((c?.b2b as B2BData) ?? null);
    setGoldData((c?.gold as GoldData) ?? null);
  }, [month]);

  if (authError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-red-600">접근 권한이 없습니다</p>
          <p className="text-sm text-gray-500">GLOBAL_ADMIN 또는 OWNER 권한이 필요합니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">파트너 대시보드</h1>
          <p className="text-sm text-gray-500 mt-1">B2C / B2B / 골드회원 현황을 한눈에 확인하세요.</p>
        </div>

        {/* 월 선택 */}
        <div className="relative">
          <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-9 text-sm font-medium text-gray-700 shadow-sm hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer"
          >
            {monthOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={activeTab === t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}

          {loading && (
            <div className="ml-auto flex items-center text-gray-400 text-xs gap-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              로딩 중...
            </div>
          )}
        </nav>
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === 'b2c' && <B2CTab data={b2cData} loading={loading && !b2cData} month={month} onDrilldown={openDrilldown} />}
      {activeTab === 'b2b' && <B2BTab data={b2bData} loading={loading && !b2bData} month={month} onDrilldown={openDrilldown} />}
      {activeTab === 'gold' && <GoldTab data={goldData} loading={loading && !goldData} month={month} onDrilldown={openDrilldown} />}

      {/* 드릴다운 드로어 */}
      <DrilldownDrawer config={drawerConfig} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
