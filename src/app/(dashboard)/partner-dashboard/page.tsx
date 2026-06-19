'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ShoppingCart, Users, CreditCard, UserPlus, GraduationCap,
  DollarSign, Crown, MessageSquare, Percent, Plane, FileText,
  Clock, Loader2, CalendarDays, ChevronDown, X, ChevronLeft, ChevronRight, AlertCircle,
  TrendingUp, Link2,
} from 'lucide-react';
import { maskPhoneNumber, maskCustomerName } from '@/lib/pii-mask';
import { genericApiResponseSchema } from '@/lib/schemas/partner-api';
import { useToast } from '@/lib/api/use-toast';
import { ShortlinkPerformanceSummary } from './ShortlinkPerformanceSummary';
import { ShortlinkTrendChart } from './ShortlinkTrendChart';
import { ShortlinkTable } from './ShortlinkTable';
import { ShortlinkABTestCard } from './ShortlinkABTestCard';
import { CreateABTestModal } from './CreateABTestModal';
import { Plus } from 'lucide-react';

/* ─────────────────── 타입 ─────────────────── */

type Tab = 'b2c' | 'b2b' | 'gold' | 'performance' | 'shortlink';

// B2C
type B2CSale = {
  id: string;
  productName: string;
  amount: number;
  commission: number;
  commissionRate: number | null;  // null=확인 중, 숫자=확정
  status: string;
  date: string;
};
type B2CPassport = {
  id: string;
  customerName: string;
  passportStatus: string;
  pnrStatus: string;
  finalConfirmStatus: string | null;
  assignedName?: string;
  commissionAmount?: number;
  saleId?: string | null;
};
type TrendValues = Record<string, number>;
type B2CData = {
  totalSalesAmount: number;
  salesCount: number;
  reservationCount: number;
  recentSales: B2CSale[];
  passportPnr: B2CPassport[];
  passportSummary?: Record<string, number>;
  pnrSummary?: Record<string, number>;
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

// Shortlink
type ShortLink = {
  id: string;
  title: string;
  shortCode: string;
  clickCount: number;
  createdAt: string;
};
type DailyClick = {
  date: string;
  clicks: number;
};
type ShortlinkData = {
  total: {
    clickCount: number;
    averageClicksPerDay: number;
    linkCount: number;
  };
  dailyClicks: DailyClick[];
  shortLinks: ShortLink[];
};

// Performance
type PerformanceMember = {
  memberId: string;
  orgId: string;
  displayName: string;
  role: string;
  orgName: string;
  monthlySales: { month: string; amount: number; count: number }[];
  currentMonthSales: number;
  currentMonthRefunds: number;
  refundRate: number;
  prevMonthRefundRate: number;
  refundTrend: number;        // 음수=개선, 양수=악화
  refundScore: number;
  activityScore: number;
  score: number;
  status: 'GREEN' | 'YELLOW' | 'RED' | 'BLACK';
  isSelf: boolean;
  alreadySuspended: boolean;
  autoSuspendNeeded: boolean;
};
type PerformanceData = {
  members: PerformanceMember[];
  isAdmin: boolean;
  isOwner: boolean;
  monthLabels: string[];
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
  NONE:       'bg-gray-100 text-gray-500',
  SUBMITTED:  'bg-blue-100 text-blue-800',
  VERIFIED:   'bg-green-100 text-green-800',
  REJECTED:   'bg-red-100 text-red-800',
  ISSUED:     'bg-green-100 text-green-800',
  paid:       'bg-green-100 text-green-800',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING:    '대기',
  COMPLETED:  '완료',
  CONFIRMED:  '확인됨',
  CANCELLED:  '취소',
  SENT:       '발송됨',
  NEW:        '신규',
  CONTACTED:  '연락완료',
  WON:        '성사',
  LOST:       '이탈',
  ACTIVE:     '활성',
  PAUSED:     '일시정지',
  NONE:       '미등록',
  SUBMITTED:  '제출됨',
  VERIFIED:   '확인완료',
  REJECTED:   '반려',
  ISSUED:     '발급됨',
  paid:       '결제완료',
  pending:    '대기',
  refunded:   '환불',
  cancelled:  '취소',
};

function Badge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600';
  const label = STATUS_LABEL[status] ?? status;
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-sm font-semibold ${cls}`}>
      {label}
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
          {suffix && <span className="ml-1 text-lg font-medium text-gray-600">{suffix}</span>}
        </p>
        {trend !== undefined && trend !== 0 && (
          <span className={`text-sm font-semibold px-1.5 py-0.5 rounded-full mb-1 ${
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
          <p className="text-sm text-gray-600">전월 대비</p>
        ) : <span />}
        {onClick && <p className="text-sm text-blue-500">상세보기 →</p>}
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
        <td key={`skel-${i}`} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded w-full" />
        </td>
      ))}
    </tr>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-600">
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

  // config를 ref로 저장 (객체 참조 변경에 의한 무한 루프 방지)
  const configRef = useRef(config);
  configRef.current = config;
  const apiUrl = config?.apiUrl ?? '';

  // apiUrl 변경 시 페이지 리셋
  useEffect(() => {
    if (!open || !apiUrl) return;
    setPage(1);
    setItems([]);
    setSummary(null);
  }, [open, apiUrl]);

  // 데이터 fetch — apiUrl(문자열)로 의존하여 무한 루프 방지
  useEffect(() => {
    if (!open || !apiUrl) return;
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`${apiUrl}&page=${page}`, { credentials: 'include', signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (json.ok && json.data) {
          setItems(json.data.items ?? []);
          setTotal(json.data.total ?? json.data.items?.length ?? 0);
          setTotalPages(json.data.totalPages ?? 1);
          if (json.data.summary) setSummary(json.data.summary);
        }
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setItems([]);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [open, apiUrl, page]);

  if (!open || !config) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-2xl bg-white h-full overflow-y-auto shadow-xl flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-base font-bold text-gray-900">{config.title}</h2>
            <p className="text-sm text-gray-600 mt-0.5">총 {total.toLocaleString()}건</p>
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
              <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState message="데이터가 없습니다." />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-sm uppercase sticky top-0">
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
            <p className="text-sm text-gray-600">{page} / {totalPages}</p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30"
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

function B2CTab({ data, loading, month, onDrilldown, onRefresh }: { data: B2CData | null; loading: boolean; month: string; onDrilldown: (config: DrilldownConfig) => void; onRefresh: () => void }) {
  const [passportSubTab, setPassportSubTab] = useState<'pending' | 'complete'>('pending');
  const router = useRouter();
  const { toast } = useToast();

  // 드릴다운 config들을 useMemo로 메모이제이션 (month 변경 시만 재생성)
  const salesConfig = useMemo(() => ({
    title: '판매 상세 내역',
    apiUrl: `/api/partner/dashboard/b2c/detail?type=sales&month=${month}`,
    columns: [
      { key: 'productName', label: '상품명' },
      { key: 'amount', label: '금액', align: 'right' as const, render: (v: unknown) => `₩${(v as number)?.toLocaleString()}` },
      { key: 'commission', label: '수수료', align: 'right' as const, render: (v: unknown) => `₩${(v as number)?.toLocaleString()}` },
      { key: 'status', label: '상태', align: 'center' as const, render: (v: unknown) => <Badge status={v as string} /> },
      { key: 'date', label: '날짜', align: 'right' as const },
    ],
  }), [month]);

  const reservationConfig = useMemo(() => ({
    title: '예약 상세 내역',
    apiUrl: `/api/partner/dashboard/b2c/detail?type=reservations&month=${month}`,
    columns: [
      { key: 'customerName', label: '고객명' },
      { key: 'productName', label: '상품명' },
      { key: 'passportStatus', label: '여권', align: 'center' as const, render: (v: unknown) => <Badge status={v as string} /> },
      { key: 'pnrStatus', label: 'PNR', align: 'center' as const, render: (v: unknown) => <Badge status={v as string} /> },
      { key: 'departureDate', label: '출발일', align: 'right' as const },
      { key: 'date', label: '예약일', align: 'right' as const },
    ],
  }), [month]);

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
      {/* 매출 분석 카드 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">이달의 매출 현황</h3>
            <p className="text-sm text-gray-500 mt-1">{month} 기준</p>
          </div>
          <DollarSign className="h-5 w-5 text-gray-300" />
        </div>

        {/* 핵심 지표 (3개 열) */}
        <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b border-gray-100">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">전체 수익</p>
            <p className="text-2xl font-bold text-gray-900">₩{formatWon(data.totalSalesAmount)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">판매 건수</p>
            <p className="text-2xl font-bold text-gray-900">{data.salesCount}</p>
            <p className="text-sm text-gray-600 mt-1">건</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">평균 금액</p>
            <p className="text-2xl font-bold text-gray-900">
              ₩{data.salesCount > 0 ? formatWon(Math.floor(data.totalSalesAmount / data.salesCount)) : '0'}
            </p>
          </div>
        </div>

        {/* TOP 3 인기상품 */}
        <div className="mb-6">
          <p className="text-sm font-semibold text-gray-700 mb-3">인기 상품 TOP 3</p>
          {data.recentSales.length === 0 ? (
            <p className="text-sm text-gray-600">상품 판매 데이터가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {(() => {
                const grouped: Record<string, number> = {};
                data.recentSales.forEach((s) => {
                  grouped[s.productName] = (grouped[s.productName] ?? 0) + 1;
                });
                return Object.entries(grouped)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 3)
                  .map(([name, count], i) => (
                    <div key={name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">
                          {i + 1}
                        </span>
                        <span className="text-gray-700 truncate">{name}</span>
                      </div>
                      <span className="text-gray-500 whitespace-nowrap">{count}건</span>
                    </div>
                  ));
              })()}
            </div>
          )}
        </div>

        {/* CTA 버튼 */}
        <button
          onClick={() => router.push('/partner/my-sales')}
          className="w-full px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors active:scale-[0.98]"
        >
          상세 분석 보기 →
        </button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="총 판매액" value={`₩${formatWon(data.totalSalesAmount)}`} icon={<DollarSign className="h-5 w-5" />} trend={data.trends?.totalSalesAmount} onClick={() => onDrilldown(salesConfig)} />
        <StatCard title="판매 건수" value={data.salesCount} icon={<ShoppingCart className="h-5 w-5" />} suffix="건" trend={data.trends?.salesCount} onClick={() => onDrilldown(salesConfig)} />
        <StatCard title="예약 현황" value={data.reservationCount} icon={<Plane className="h-5 w-5" />} suffix="건" trend={data.trends?.reservationCount} onClick={() => onDrilldown(reservationConfig)} />
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
            <thead className="bg-gray-50 text-gray-500 text-sm uppercase">
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
                  <td className="px-4 py-3 text-right">
                    {s.commissionRate == null ? (
                      <span className="text-sm text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">확인 중</span>
                    ) : (
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-gray-700">₩{s.commission.toLocaleString()} <span className="text-gray-600 text-sm">({s.commissionRate}%)</span></span>
                        {s.status === 'COMPLETED' && (
                          <span className="text-sm bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full whitespace-nowrap">완료</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center"><Badge status={s.status} /></td>
                  <td className="px-4 py-3 text-right text-gray-500">{s.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableWrapper>

      {/* 여권/PNR 현황 — 서브탭 + 확장된 테이블 */}
      <TableWrapper>
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-semibold text-gray-700">여권 / PNR 현황</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setPassportSubTab('pending')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  passportSubTab === 'pending'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                현황
              </button>
              <button
                onClick={() => setPassportSubTab('complete')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  passportSubTab === 'complete'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                완료
              </button>
            </div>
          </div>
          {passportSubTab === 'pending' && (
            <button
              onClick={() => onDrilldown({
                title: '여권/PNR 현황 전체',
                apiUrl: `/api/partner/dashboard/b2c/detail?type=passport-pending&month=${month}`,
                columns: [
                  { key: 'customerName', label: '고객명' },
                  { key: 'passportStatus', label: '여권', align: 'center', render: (v) => <Badge status={v as string} /> },
                  { key: 'pnrStatus', label: 'PNR', align: 'center', render: (v) => <Badge status={v as string} /> },
                  { key: 'finalConfirmStatus', label: '최종확인', align: 'center', render: (v) => <Badge status={v as string} /> },
                  { key: 'assignedName', label: '담당자' },
                  { key: 'commissionAmount', label: '수당', align: 'right', render: (v) => v ? `₩${(v as number).toLocaleString()}` : '-' },
                  { key: 'date', label: '날짜', align: 'right' },
                ],
              })}
              className="text-sm text-blue-600 hover:underline"
            >
              전체보기 →
            </button>
          )}
          {passportSubTab === 'complete' && (
            <button
              onClick={() => onDrilldown({
                title: '여권/PNR 완료 목록',
                apiUrl: `/api/partner/dashboard/b2c/detail?type=passport-complete&month=${month}`,
                columns: [
                  { key: 'customerName', label: '고객명' },
                  { key: 'passportStatus', label: '여권', align: 'center', render: (v) => <Badge status={v as string} /> },
                  { key: 'pnrStatus', label: 'PNR', align: 'center', render: (v) => <Badge status={v as string} /> },
                  { key: 'assignedName', label: '담당자' },
                  { key: 'commissionAmount', label: '수당', align: 'right', render: (v) => v ? `₩${(v as number).toLocaleString()}` : '-' },
                  { key: 'date', label: '완료일', align: 'right' },
                ],
              })}
              className="text-sm text-blue-600 hover:underline"
            >
              전체보기 →
            </button>
          )}
        </div>

        {/* 상태별 숫자 요약 (현황 탭에서만) */}
        {passportSubTab === 'pending' && (data.passportSummary || data.pnrSummary) && (
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">여권 상태</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(data.passportSummary ?? {}).map(([status, count]) => (
                    <div key={status} className="flex items-center gap-1.5">
                      <Badge status={status} />
                      <span className="text-sm font-bold text-gray-900">{count}건</span>
                    </div>
                  ))}
                  {Object.keys(data.passportSummary ?? {}).length === 0 && (
                    <span className="text-sm text-gray-600">데이터 없음</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">PNR 상태</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(data.pnrSummary ?? {}).map(([status, count]) => (
                    <div key={status} className="flex items-center gap-1.5">
                      <Badge status={status} />
                      <span className="text-sm font-bold text-gray-900">{count}건</span>
                    </div>
                  ))}
                  {Object.keys(data.pnrSummary ?? {}).length === 0 && (
                    <span className="text-sm text-gray-600">데이터 없음</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 테이블 (현황 탭) */}
        {passportSubTab === 'pending' && (
          <>
            {data.passportPnr.length === 0 ? (
              <EmptyState message="대기 중인 여권/PNR 데이터가 없습니다." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-sm uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">고객명</th>
                      <th className="px-4 py-3 text-center">여권</th>
                      <th className="px-4 py-3 text-center">PNR</th>
                      <th className="px-4 py-3 text-center">최종확인</th>
                      <th className="px-4 py-3 text-left">담당자</th>
                      <th className="px-4 py-3 text-right">수당</th>
                      <th className="px-4 py-3 text-center">액션</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.passportPnr.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          <button className="text-blue-600 hover:underline">{p.customerName}</button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Badge status={p.passportStatus} />
                            <a href={`/passport?customerId=${p.id}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-600 text-sm">
                              📎
                            </a>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Badge status={p.pnrStatus} />
                            <a href={`/passport?customerId=${p.id}&tab=pnr`} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-600 text-sm">
                              📎
                            </a>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">{p.finalConfirmStatus ? <Badge status={p.finalConfirmStatus} /> : '-'}</td>
                        <td className="px-4 py-3 text-gray-600 text-sm">{p.assignedName || '-'}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{p.commissionAmount ? `₩${(p.commissionAmount).toLocaleString()}` : '-'}</td>
                        <td className="px-4 py-3 text-center">
                          {p.saleId && (
                            <button
                              onClick={() => {
                                void fetch(`/api/partner/dashboard/b2c/confirm`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ saleId: p.saleId }),
                                  credentials: 'include',
                                })
                                  .then((res) => {
                                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                                    return res.json();
                                  })
                                  .then((json: { ok: boolean; error?: string }) => {
                                    if (json.ok) {
                                      toast({ title: '수당 승인 완료', description: '수당 승인이 완료되었습니다.' });
                                      onRefresh();
                                    } else {
                                      toast({ title: '오류', description: json.error || '승인 실패', variant: 'destructive' });
                                    }
                                  })
                                  .catch(() => toast({ title: '요청 실패', variant: 'destructive' }));
                              }}
                              className="px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors whitespace-nowrap"
                            >
                              검토완료
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* 테이블 (완료 탭) — 드릴다운으로 표시 */}
        {passportSubTab === 'complete' && (
          <div className="px-5 py-6 text-center">
            <p className="text-sm text-gray-500 mb-3">완료된 여권/PNR 목록을 확인하려면 아래 버튼을 클릭하세요.</p>
            <button
              onClick={() => onDrilldown({
                title: '여권/PNR 완료 목록',
                apiUrl: `/api/partner/dashboard/b2c/detail?type=passport-complete&month=${month}`,
                columns: [
                  { key: 'customerName', label: '고객명' },
                  { key: 'passportStatus', label: '여권', align: 'center', render: (v) => <Badge status={v as string} /> },
                  { key: 'pnrStatus', label: 'PNR', align: 'center', render: (v) => <Badge status={v as string} /> },
                  { key: 'assignedName', label: '담당자' },
                  { key: 'commissionAmount', label: '수당', align: 'right', render: (v) => v ? `₩${(v as number).toLocaleString()}` : '-' },
                  { key: 'date', label: '완료일', align: 'right' },
                ],
              })}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              완료 목록 보기
            </button>
          </div>
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
            { key: 'phone', label: '연락처', render: (v) => maskPhoneNumber(v as string) },
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
            { key: 'phone', label: '연락처', render: (v) => maskPhoneNumber(v as string) },
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
            { key: 'customerPhone', label: '고객 연락처', render: (v) => maskPhoneNumber(v as string) },
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
            <thead className="bg-gray-50 text-gray-500 text-sm uppercase">
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
            <thead className="bg-gray-50 text-gray-500 text-sm uppercase">
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
              return <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${colors[key] ?? 'bg-gray-100'}`}>{labels[key] ?? key}</span>;
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
              return m ? <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${m.cls}`}>{m.label}</span> : '-';
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
            <thead className="bg-gray-50 text-gray-500 text-sm uppercase">
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
                    <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-sm font-semibold text-gray-700">
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
            <thead className="bg-gray-50 text-gray-500 text-sm uppercase">
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

/* ─────────────────── 성과현황 탭 ─────────────────── */

const ROLE_LABEL: Record<string, string> = {
  OWNER: '지점장', owner: '지점장',
  AGENT: '판매원', agent: '판매원',
  FREE_SALES: '사전영업', free_sales: '사전영업',
  BRANCH_MANAGER: '지점장',
};

// 상태별 설정 — 50대 친화적 (한국어 우선, 구체적 행동 안내)
const PERF_STATUS = {
  GREEN:  { icon: '✅', title: '정상',       color: 'text-green-700', bg: 'bg-green-50',  headerBg: 'bg-green-100', border: 'border-green-200', barColor: '#16a34a',
    action: (m: PerformanceMember) => `이번달 환불율 ${m.refundRate}%로 기준치(10%) 이하입니다. 이 페이스를 유지하세요! 🎉` },
  YELLOW: { icon: '⚠️', title: '주의 필요',  color: 'text-amber-700', bg: 'bg-amber-50',  headerBg: 'bg-amber-100', border: 'border-amber-200', barColor: '#d97706',
    action: (m: PerformanceMember) => `환불율이 ${m.refundRate}%로 기준치(10%)를 초과했습니다. 환불 고객 ${m.currentMonthRefunds}명에게 연락하여 만족도를 확인해보세요.` },
  RED:    { icon: '🚨', title: '즉시 조치 필요', color: 'text-red-700',   bg: 'bg-red-50',    headerBg: 'bg-red-100',   border: 'border-red-200',   barColor: '#dc2626',
    action: (m: PerformanceMember) => `환불율 ${m.refundRate}%로 정지 기준(20%)을 초과했습니다. 지금 바로 관리자에게 보고하고 환불 원인을 파악하세요.` },
  BLACK:  { icon: '⛔', title: '계약 해지 검토', color: 'text-gray-800', bg: 'bg-gray-100', headerBg: 'bg-gray-200',  border: 'border-gray-400',  barColor: '#1f2937',
    action: (_m: PerformanceMember) => '지속적인 성과 미달로 계약 해지 검토 대상입니다. 지금 바로 관리자에게 연락하세요.' },
} as const;

function TrendBadge({ trend }: { trend: number }) {
  if (trend === 0) return <span className="text-xs text-gray-400">전달 동일</span>;
  if (trend > 0) return <span className="text-xs font-bold text-red-600">↑{trend}% 악화</span>;
  return <span className="text-xs font-bold text-green-600">↓{Math.abs(trend)}% 개선</span>;
}

function ScoreBar({ score, status }: { score: number; status: keyof typeof PERF_STATUS }) {
  const cfg = PERF_STATUS[status];
  return (
    <div className="flex-1 max-w-[160px]">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-gray-500">성과 점수</span>
        <span className="text-sm font-black" style={{ color: cfg.barColor }}>{score}점</span>
      </div>
      <div className="h-2.5 bg-white/60 rounded-full overflow-hidden border border-white/40">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, backgroundColor: cfg.barColor }}
        />
      </div>
    </div>
  );
}

function MiniBar({ monthlySales }: { monthlySales: { month: string; amount: number; count: number }[] }) {
  const maxAmt = Math.max(...monthlySales.map(m => m.amount), 1);
  return (
    <div className="flex items-end gap-1 h-12">
      {monthlySales.map((m, i) => {
        const h = Math.max(4, Math.round((m.amount / maxAmt) * 44));
        const isLast = i === monthlySales.length - 1;
        return (
          <div key={m.month} className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
            <div
              className={`w-full rounded-sm ${isLast ? 'bg-blue-500' : 'bg-gray-300'}`}
              style={{ height: `${h}px` }}
              title={`${m.month}: ${m.count}건 ${m.amount.toLocaleString()}원`}
            />
            <span className="text-[9px] text-gray-400 truncate w-full text-center leading-tight">{m.month.slice(5)}월</span>
          </div>
        );
      })}
    </div>
  );
}

function PerformanceTab({
  data, loading, onRefresh,
}: {
  data: PerformanceData | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [suspending, setSuspending] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  useEffect(() => { setLastRefreshed(new Date()); }, []);

  const handleRefresh = () => {
    onRefresh();
  };

  const handleSuspend = async (m: PerformanceMember) => {
    if (!confirm(`${m.displayName} 님을 정지 처리하시겠습니까?\n환불율: ${m.refundRate}% (기준 20%)`)) return;
    setSuspending(m.memberId);
    try {
      const res = await fetch('/api/partner/performance/suspend', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: m.memberId, organizationId: m.orgId,
          memberName: m.displayName, memberRole: m.role,
          refundRate: m.refundRate, score: m.score,
        }),
      });
      const json = await res.json() as { ok: boolean; result?: string; message?: string; error?: string };
      if (json.ok) {
        toast({ title: json.result === 'already_suspended' ? '이미 정지됨' : '정지 처리 완료', description: json.message });
        handleRefresh();
      } else {
        toast({ title: '처리 실패', description: json.error ?? '다시 시도해주세요.', variant: 'destructive' });
      }
    } catch {
      toast({ title: '오류 발생', description: '네트워크 오류가 발생했습니다.', variant: 'destructive' });
    } finally {
      setSuspending(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <div key={i} className="rounded-2xl border border-gray-200 bg-white p-6 animate-pulse">
            <div className="h-8 w-28 bg-gray-200 rounded-lg mb-3" />
            <div className="h-4 w-72 bg-gray-100 rounded mb-4" />
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map(j => <div key={j} className="h-24 bg-gray-100 rounded-xl" />)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <TrendingUp className="h-16 w-16 text-gray-200" />
        <p className="text-gray-400">아직 성과 데이터가 없습니다.</p>
        <p className="text-sm text-gray-300">판매가 시작되면 자동으로 표시됩니다.</p>
      </div>
    );
  }

  const self      = data.members.find(m => m.isSelf);
  const team      = data.members.filter(m => !m.isSelf);
  const urgentList = team.filter(m => m.autoSuspendNeeded && !m.alreadySuspended);

  return (
    <div className="space-y-5">

      {/* 새로고침 헤더 */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {lastRefreshed
          ? `갱신 ${lastRefreshed.getHours()}:${String(lastRefreshed.getMinutes()).padStart(2,'0')} · 실시간 산출`
          : '실시간 산출'}
        </p>
        <button onClick={handleRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors font-medium">
          <TrendingUp className="h-3.5 w-3.5" />새로고침
        </button>
      </div>

      {/* 긴급 경보 배너 */}
      {urgentList.length > 0 && (data.isOwner || data.isAdmin) && (
        <div className="rounded-xl border-2 border-red-400 bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-700 text-base mb-1">🚨 즉시 조치 필요 — 정지 대상 {urgentList.length}명</p>
            <p className="text-sm text-red-600 mb-2">환불율 20% 초과로 정지 처리가 필요한 판매원이 있습니다. 아래 목록에서 확인 후 정지 처리해주세요.</p>
            <div className="flex flex-wrap gap-1.5">
              {urgentList.map(m => (
                <span key={m.memberId} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full border border-red-200">
                  {m.displayName} ({m.refundRate}%)
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 나의 성과 카드 */}
      {self && (() => {
        const cfg = PERF_STATUS[self.status];
        return (
          <div className={`rounded-2xl border-2 ${cfg.border} bg-white shadow-sm overflow-hidden`}>
            {/* 상태 헤더 — 가장 크고 명확하게 */}
            <div className={`px-6 py-4 ${cfg.headerBg} flex items-center justify-between gap-4`}>
              <div>
                <p className="text-xs text-gray-500 font-medium mb-0.5">나의 현재 상태</p>
                <p className={`text-2xl font-black ${cfg.color}`}>{cfg.icon} {cfg.title}</p>
              </div>
              <ScoreBar score={self.score} status={self.status} />
            </div>
            {/* 지금 할 일 */}
            <div className={`px-6 py-3 ${cfg.bg} border-b ${cfg.border}`}>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">지금 해야 할 일</p>
              <p className={`text-sm font-semibold ${cfg.color} leading-relaxed`}>{cfg.action(self)}</p>
            </div>
            {/* 지표 3개 */}
            <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-gray-100 p-4">
                <p className="text-sm text-gray-500 mb-2 font-medium">이번달 환불율</p>
                <p className={`text-4xl font-black tabular-nums mb-1 ${self.refundRate >= 20 ? 'text-red-600' : self.refundRate >= 10 ? 'text-amber-600' : 'text-green-700'}`}>
                  {self.refundRate}%
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-400">{self.currentMonthRefunds}/{self.currentMonthSales}건</span>
                  <TrendBadge trend={self.refundTrend} />
                </div>
                <p className="text-[10px] text-gray-300 mt-1.5">기준: 10%이상 주의 / 20%이상 정지</p>
              </div>
              <div className="rounded-xl border border-gray-100 p-4">
                <p className="text-sm text-gray-500 mb-2 font-medium">이번달 판매</p>
                <p className="text-4xl font-black text-gray-900 tabular-nums mb-1">
                  {self.currentMonthSales}<span className="text-xl font-normal text-gray-400 ml-1">건</span>
                </p>
                <p className="text-sm text-gray-500">{formatWon(self.monthlySales[4]?.amount ?? 0)}원</p>
                <p className="text-[10px] text-gray-300 mt-1.5">환불점수 {self.refundScore}점 + 활성점수 {self.activityScore}점</p>
              </div>
              <div className="rounded-xl border border-gray-100 p-4">
                <p className="text-sm text-gray-500 mb-2 font-medium">최근 5개월 매출 추세</p>
                <MiniBar monthlySales={self.monthlySales} />
                <p className="text-[10px] text-gray-300 mt-1">파란 막대 = 이번달</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 팀 성과 (OWNER / ADMIN) */}
      {(data.isOwner || data.isAdmin) && team.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-400" />팀 성과현황
              <span className="text-sm font-normal text-gray-400">총 {team.length}명</span>
            </h3>
            <div className="flex gap-1.5 flex-wrap">
              {(['RED','BLACK','YELLOW','GREEN'] as const).map(s => {
                const cnt = team.filter(m => m.status === s).length;
                if (!cnt) return null;
                const cfg = PERF_STATUS[s];
                return (
                  <span key={s} className={`px-2.5 py-1 rounded-full text-xs font-bold border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
                    {cfg.icon} {cnt}명
                  </span>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            {team.map(m => {
              const cfg = PERF_STATUS[m.status];
              const needsAction = m.autoSuspendNeeded && !m.alreadySuspended;
              return (
                <div key={m.memberId}
                  className={`rounded-xl border-2 bg-white p-4 transition-all ${needsAction ? 'border-red-300 shadow-sm' : cfg.border}`}>
                  <div className="flex items-start gap-3">
                    {/* 상태 아이콘 박스 */}
                    <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center ${cfg.bg} border ${cfg.border}`}>
                      <span className="text-2xl leading-none">{cfg.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <p className="font-bold text-gray-900 text-base leading-tight">{m.displayName}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {ROLE_LABEL[m.role] ?? m.role}
                            {data.isAdmin && <span className="ml-1 text-gray-300">· {m.orgName}</span>}
                          </p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          {needsAction && (
                            <button onClick={() => handleSuspend(m)} disabled={suspending === m.memberId}
                              className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
                              {suspending === m.memberId ? '처리 중...' : '정지 처리'}
                            </button>
                          )}
                          {m.alreadySuspended && (
                            <span className="px-2.5 py-1 text-xs font-semibold text-gray-400 bg-gray-100 border border-gray-200 rounded-lg">정지됨</span>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div>
                          <p className="text-[10px] text-gray-400 mb-0.5">환불율</p>
                          <p className={`text-lg font-black tabular-nums ${m.refundRate >= 20 ? 'text-red-600' : m.refundRate >= 10 ? 'text-amber-600' : 'text-green-700'}`}>
                            {m.refundRate}%
                          </p>
                          <TrendBadge trend={m.refundTrend} />
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 mb-0.5">성과점수</p>
                          <p className="text-lg font-black text-gray-800 tabular-nums">{m.score}점</p>
                          <p className="text-[10px] text-gray-400">{m.currentMonthSales}건</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 mb-1">5개월 추세</p>
                          <MiniBar monthlySales={m.monthlySales} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 점수 기준 (접기/펼치기) */}
      <details className="group">
        <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 list-none flex items-center gap-1.5 transition-colors">
          <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
          점수 계산 방법 보기
        </summary>
        <div className="mt-2 text-xs text-gray-400 bg-gray-50 rounded-lg p-4 space-y-1.5 border border-gray-100">
          <p className="font-semibold text-gray-600 mb-2">📊 점수 계산 방법 (총 100점)</p>
          <p>• <strong>환불율 점수</strong> (최대 60점): 5%미만→60점 / 10%미만→50점 / 15%미만→30점 / 20%미만→15점 / 20%이상→0점</p>
          <p>• <strong>활성도 점수</strong> (최대 40점): 최근 5개월 중 판매 있는 달 수 × 8점</p>
          <p className="pt-1 text-gray-500">📌 환불율 10% 이상 → 주의(⚠️) 강제 / 20% 이상 → 즉시조치(🚨) 강제</p>
        </div>
      </details>
    </div>
  );
}

/* ─────────────────── 메인 페이지 ─────────────────── */

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'b2c', label: 'B2C', icon: <ShoppingCart className="h-4 w-4" /> },
  { key: 'b2b', label: 'B2B', icon: <Users className="h-4 w-4" /> },
  { key: 'gold', label: '골드회원', icon: <Crown className="h-4 w-4" /> },
  { key: 'performance', label: '성과현황', icon: <TrendingUp className="h-4 w-4" /> },
  { key: 'shortlink', label: '숏링크 성과', icon: <Link2 className="h-4 w-4" /> },
];

const API_MAP: Record<Tab, string> = {
  b2c:         '/api/partner/dashboard/b2c',
  b2b:         '/api/partner/dashboard/b2b',
  gold:        '/api/partner/dashboard/gold',
  performance: '/api/partner/dashboard/performance',
  shortlink:   '/api/partner/dashboard/shortlink',
};

interface SuspensionInfo {
  status: 'SUSPENDED' | 'APPEALING' | 'RESOLVED' | 'ACTIVE';
  suspensionReason?: string;
  reasonDetails?: Record<string, any>;
  appealMessage?: string;
}

export default function PartnerDashboardPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('b2c');
  const [month, setMonth] = useState(() => getMonthOptions()[0].value);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(false);

  // 탭별 캐시 (월 변경 시 초기화)
  const cache = useRef<Record<string, Record<Tab, unknown>>>({});

  const [b2cData, setB2cData] = useState<B2CData | null>(null);
  const [b2bData, setB2bData] = useState<B2BData | null>(null);
  const [goldData, setGoldData] = useState<GoldData | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [shortlinkData, setShortlinkData] = useState<ShortlinkData | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 정지 상태
  const [suspensionInfo, setSuspensionInfo] = useState<SuspensionInfo | null>(null);
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [appealText, setAppealText] = useState('');
  const [appealSubmitting, setAppealSubmitting] = useState(false);

  // 드릴다운 드로어
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerConfig, setDrawerConfig] = useState<DrilldownConfig | null>(null);
  const openDrilldown = useCallback((config: DrilldownConfig) => {
    setDrawerConfig(config);
    setDrawerOpen(true);
  }, []);

  const monthOptions = getMonthOptions();

  const fetchTab = useCallback(async (tab: Tab, ym: string, skipLoading?: boolean) => {
    // 성과현황과 숏링크는 월 필터 없음 — 'all' 키로 캐시
    const cacheKey = (tab === 'performance' || tab === 'shortlink') ? 'all' : ym;

    // 캐시 히트
    const cached = cache.current[cacheKey]?.[tab];
    if (cached) {
      if (tab === 'b2c') setB2cData(cached as B2CData);
      if (tab === 'b2b') setB2bData(cached as B2BData);
      if (tab === 'gold') setGoldData(cached as GoldData);
      if (tab === 'performance') setPerformanceData(cached as PerformanceData);
      if (tab === 'shortlink') setShortlinkData(cached as ShortlinkData);
      return;
    }

    if (!skipLoading) setLoading(true);
    try {
      // 타임아웃: 느린 API도 빠르게 응답 (스켈레톤으로 폴백)
      const timeoutMs = tab === 'performance' ? 10000 : 6000; // performance는 더 느림
      const ctrl = new AbortController();
      const timeoutId = setTimeout(() => ctrl.abort(), timeoutMs);

      const url = (tab === 'performance' || tab === 'shortlink') ? API_MAP[tab] : `${API_MAP[tab]}?month=${ym}`;
      const res = await fetch(url, { credentials: 'include', signal: ctrl.signal });
      clearTimeout(timeoutId);

      if (res.status === 401 || res.status === 403) {
        setAuthError(true);
        if (!skipLoading) setLoading(false);
        return;
      }

      const json = await res.json();

      // Zod 검증으로 응답 구조 확인
      const validated = genericApiResponseSchema.safeParse(json);
      if (!validated.success || !validated.data.ok) {
        if (!skipLoading) setLoading(false);
        return;
      }

      const d = validated.data.data;
      if (!d) {
        if (!skipLoading) setLoading(false);
        return;
      }

      if (!cache.current[cacheKey]) cache.current[cacheKey] = {} as Record<Tab, unknown>;
      cache.current[cacheKey][tab] = d;

      if (tab === 'b2c') setB2cData(d as B2CData);
      if (tab === 'b2b') setB2bData(d as B2BData);
      if (tab === 'gold') setGoldData(d as GoldData);
      if (tab === 'performance') setPerformanceData(d as PerformanceData);
      if (tab === 'shortlink') setShortlinkData(d as ShortlinkData);
    } catch (err) {
      // 타임아웃 또는 네트워크 오류 무시 — 스켈레톤 유지 또는 캐시된 데이터 표시
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error(`[fetchTab] ${tab}`, err);
      }
    } finally {
      if (!skipLoading) setLoading(false);
    }
  }, []);

  // 탭 또는 월 변경 시 fetch — 활성 탭 우선, 나머지 백그라운드 프리페치
  useEffect(() => {
    // 월 변경 시 캐시된 데이터 즉시 세팅 (깜빡임 방지)
    const c = cache.current[month];
    setB2cData((c?.b2c as B2CData) ?? null);
    setB2bData((c?.b2b as B2BData) ?? null);
    setGoldData((c?.gold as GoldData) ?? null);
    // 성과현황과 숏링크는 월 무관 — 'all' 캐시에서 복원
    const perfCached = cache.current['all']?.performance;
    if (perfCached) setPerformanceData(perfCached as PerformanceData);
    const slinkCached = cache.current['all']?.shortlink;
    if (slinkCached) setShortlinkData(slinkCached as ShortlinkData);
    // 현재 탭 데이터 fetch (로딩 상태 표시)
    fetchTab(activeTab, month, false);
    // 나머지 탭 백그라운드 프리페치 (로딩 상태 미표시)
    const otherTabs = TABS.map(t => t.key).filter(t => t !== activeTab);
    otherTabs.forEach(tab => {
      if (tab === 'performance' || tab === 'shortlink') {
        fetchTab(tab, month, true); // 월 무관
      } else {
        // b2c, b2b, gold는 월별로 프리페치
        if (!cache.current[month]?.[tab]) {
          fetchTab(tab, month, true);
        }
      }
    });
  }, [activeTab, month, fetchTab, refreshTrigger]);

  // ✅ Component unmount 시 캐시 정리 (메모리 누수 방지)
  useEffect(() => {
    return () => {
      cache.current = {};
    };
  }, []);

  // 정지 상태 조회
  useEffect(() => {
    fetch('/api/partner/suspension-status')
      .then((res) => {
        if (!res.ok) return null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return res.json() as Promise<{ ok: boolean; data?: Record<string, any> }>;
      })
      .then((data) => {
        if (data?.ok && data.data) {
          const raw = data.data;
          const knownStatuses = ['ACTIVE', 'SUSPENDED', 'APPEALING', 'RESOLVED'] as const;
          type SuspStatus = typeof knownStatuses[number];
          const rawStatus = raw.suspensionStatus ?? raw.status ?? 'ACTIVE';
          const validStatus: SuspStatus = (knownStatuses as readonly string[]).includes(rawStatus) ? rawStatus as SuspStatus : 'ACTIVE';
          setSuspensionInfo({
            status: validStatus,
            suspensionReason: typeof raw.suspensionReason === 'string' ? raw.suspensionReason : undefined,
            reasonDetails: raw.reasonDetails,
            appealMessage: typeof raw.appealMessage === 'string' ? raw.appealMessage : undefined,
          });
        }
      })
      .catch(() => setSuspensionInfo({ status: 'ACTIVE' }));
  }, []);

  // 이의 제기 제출
  const handleSubmitAppeal = async () => {
    if (appealText.length < 10) {
      toast({ title: '입력 오류', description: '최소 10자 이상 입력하세요.', variant: 'destructive' });
      return;
    }

    setAppealSubmitting(true);
    try {
      const res = await fetch('/api/partner/suspension-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: appealText }),
      });

      if (res.ok) {
        toast({ title: '이의 접수 완료', description: '이의가 정상적으로 접수되었습니다.' });
        setShowAppealForm(false);
        setAppealText('');
        // 정지 상태 갱신
        const data = await fetch('/api/partner/suspension-status').then((r) =>
          r.json()
        );
        if (data.ok) {
          setSuspensionInfo(data.data);
        }
      } else {
        const error = await res.json();
        toast({ title: '제출 실패', description: error.error || '다시 시도해주세요.', variant: 'destructive' });
      }
    } catch {
      toast({ title: '오류 발생', description: '잠시 후 다시 시도해주세요.', variant: 'destructive' });
    } finally {
      setAppealSubmitting(false);
    }
  };

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

  // 정지 상태인 경우 배너 표시
  if (suspensionInfo?.status === 'SUSPENDED') {
    return (
      <div className="p-6">
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-8 mb-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-8 h-8 text-red-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-red-700 mb-2">계약이 일시 정지되었습니다</h2>
              <p className="text-red-600 mb-4 text-lg">
                {suspensionInfo.suspensionReason === 'HIGH_REFUND'
                  ? `높은 환불율(${suspensionInfo.reasonDetails?.refundRate?.toFixed(1) || '?'}%)로 인해 정지되었습니다.`
                  : suspensionInfo.suspensionReason === 'NO_REVENUE'
                    ? `${suspensionInfo.reasonDetails?.monthsAffected?.length || 5}개월 연속 매출 부진으로 정지되었습니다.`
                    : '계약이 정지되었습니다.'}
              </p>
              <div className="flex gap-3 mb-6">
                <button
                  onClick={() => setShowAppealForm(!showAppealForm)}
                  className="px-6 py-3 border-2 border-red-600 text-red-600 font-semibold rounded-lg hover:bg-red-50 transition-colors"
                >
                  이의 제기
                </button>
                <a
                  href="mailto:admin@mabiz.io?subject=정지 관련 문의"
                  className="px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
                >
                  관리자 문의
                </a>
              </div>

              {/* 이의 제기 폼 */}
              {showAppealForm && (
                <div className="mt-6 p-6 bg-white border-2 border-red-200 rounded-lg">
                  <h3 className="font-bold text-lg text-gray-900 mb-3">이의 제기</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    정지 사유에 대한 이의가 있으신 경우, 아래에 상세한 사유를 작성해주세요.
                  </p>
                  <textarea
                    value={appealText}
                    onChange={(e) => setAppealText(e.target.value)}
                    placeholder="정지 사유에 대한 이의를 입력하세요 (최소 10자)"
                    className="w-full p-3 border-2 border-gray-300 rounded-lg mb-4 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200 text-gray-900"
                    rows={5}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={handleSubmitAppeal}
                      disabled={appealSubmitting || appealText.length < 10}
                      className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {appealSubmitting ? '제출 중...' : '제출'}
                    </button>
                    <button
                      onClick={() => {
                        setShowAppealForm(false);
                        setAppealText('');
                      }}
                      className="px-6 py-2.5 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 이의 제기 중 상태
  if (suspensionInfo?.status === 'APPEALING') {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-8 mb-6">
          <div className="flex items-start gap-4">
            <Clock className="w-8 h-8 text-yellow-600 flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-2xl font-bold text-yellow-700 mb-2">이의 제기 대기 중</h2>
              <p className="text-yellow-600 mb-4 text-lg">
                귀사의 이의 제기가 접수되었습니다. 관리자가 검토 후 연락드리겠습니다.
              </p>
              <p className="text-sm text-yellow-700 bg-white/50 p-3 rounded-lg">
                <strong>이의 제기 내용:</strong> {suspensionInfo.appealMessage}
              </p>
            </div>
          </div>
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
          <p className="text-sm text-gray-500 mt-1">B2C / B2B / 골드회원 / 성과현황을 한눈에 확인하세요.</p>
        </div>

        {/* 월 선택 — 성과현황/숏링크 탭에서는 숨김 */}
        <div className={`relative ${(activeTab === 'performance' || activeTab === 'shortlink') ? 'invisible' : ''}`}>
          <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600 pointer-events-none" />
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-9 text-sm font-medium text-gray-700 shadow-sm hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer"
          >
            {monthOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600 pointer-events-none" />
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
            <div className="ml-auto flex items-center text-gray-600 text-sm gap-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              로딩 중...
            </div>
          )}
        </nav>
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === 'b2c' && <B2CTab data={b2cData} loading={loading && !b2cData} month={month} onDrilldown={openDrilldown} onRefresh={() => setRefreshTrigger(t => t + 1)} />}
      {activeTab === 'b2b' && <B2BTab data={b2bData} loading={loading && !b2bData} month={month} onDrilldown={openDrilldown} />}
      {activeTab === 'gold' && <GoldTab data={goldData} loading={loading && !goldData} month={month} onDrilldown={openDrilldown} />}
      {activeTab === 'performance' && (
        <PerformanceTab
          data={performanceData}
          loading={loading && !performanceData}
          onRefresh={() => {
            if (cache.current['all']) {
              (cache.current['all'] as Record<string, unknown>).performance = undefined;
            }
            setRefreshTrigger(t => t + 1);
          }}
        />
      )}
      {activeTab === 'shortlink' && (
        <ShortlinkTabContent
          shortlinkData={shortlinkData}
          loading={loading && !shortlinkData}
        />
      )}

      {/* 드릴다운 드로어 */}
      <DrilldownDrawer config={drawerConfig} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}

/**
 * 숏링크 성과 탭 — 3개 서브탭 포함
 */
interface ShortlinkTabContentProps {
  shortlinkData: ShortlinkData | null;
  loading: boolean;
}

function ShortlinkTabContent({ shortlinkData, loading }: ShortlinkTabContentProps) {
  const [shortlinkTab, setShortlinkTab] = useState<'performance' | 'testing' | 'completed'>('performance');
  const [abTests, setAbTests] = useState<any[]>([]);
  const [abTestsLoading, setAbTestsLoading] = useState(false);
  const [abTestsError, setAbTestsError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const { toast } = useToast();

  // A/B 테스트 목록 조회
  useEffect(() => {
    if (shortlinkTab === 'testing' || shortlinkTab === 'completed') {
      fetchABTests();
    }
  }, [shortlinkTab]);

  const fetchABTests = async () => {
    try {
      setAbTestsLoading(true);
      setAbTestsError(null);
      const res = await fetch('/api/links/ab-tests');
      if (!res.ok) throw new Error('Failed to fetch AB tests');
      const data = await res.json();
      setAbTests(data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'A/B 테스트 목록을 불러올 수 없습니다.';
      setAbTestsError(errorMsg);
      toast({
        title: '오류',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setAbTestsLoading(false);
    }
  };

  const handleCreateTest = async (
    testName: string,
    variantA_id: string,
    variantB_id: string
  ) => {
    try {
      const res = await fetch('/api/links/ab-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testName, variantA_id, variantB_id }),
      });
      if (!res.ok) throw new Error('Failed to create test');

      await fetchABTests();
      toast({
        title: '성공',
        description: '테스트가 생성되었습니다.',
      });
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to create test');
    }
  };

  // 성과현황 탭
  if (shortlinkTab === 'performance') {
    return (
      <div className="space-y-6">
        {loading ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm animate-pulse">
                  <div className="h-4 w-20 bg-gray-200 rounded mb-3" />
                  <div className="h-8 w-32 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse h-80" />
            <div className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse h-40" />
          </>
        ) : shortlinkData ? (
          <>
            <ShortlinkPerformanceSummary data={shortlinkData} />
            <ShortlinkTrendChart data={shortlinkData.dailyClicks} />
            <ShortlinkTable shortLinks={shortlinkData.shortLinks} />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <p className="text-sm">데이터를 불러올 수 없습니다.</p>
          </div>
        )}
      </div>
    );
  }

  // A/B 테스트 탭들
  const activeTests = abTests.filter(t => t.status === 'ACTIVE');
  const completedTests = abTests.filter(t => ['WINNER_A', 'WINNER_B', 'PAUSED'].includes(t.status));
  const currentTab = shortlinkTab as string; // performance early-return 이후 타입 좁혀짐 방지

  return (
    <div className="space-y-6">
      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1" role="tablist">
          <button
            role="tab"
            aria-selected={currentTab === 'performance'}
            onClick={() => setShortlinkTab('performance')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              currentTab === 'performance'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            숏링크 성과
          </button>
          <button
            role="tab"
            aria-selected={shortlinkTab === 'testing'}
            onClick={() => setShortlinkTab('testing')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              shortlinkTab === 'testing'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            테스트 중 ({activeTests.length})
          </button>
          <button
            role="tab"
            aria-selected={shortlinkTab === 'completed'}
            onClick={() => setShortlinkTab('completed')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              shortlinkTab === 'completed'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            완료된 테스트 ({completedTests.length})
          </button>
        </nav>
      </div>

      {/* 탭 콘텐츠 */}
      {shortlinkTab === 'testing' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">진행 중인 테스트</h2>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              테스트 생성
            </button>
          </div>

          {abTestsError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">
                {abTestsError}
              </div>
            </div>
          )}

          {abTestsLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-500">로딩 중...</p>
            </div>
          ) : activeTests.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="mb-4">진행 중인 테스트가 없습니다</p>
              <button
                onClick={() => setCreateModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <Plus className="h-4 w-4" />
                첫 테스트 만들기
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {activeTests.map((test) => (
                <ShortlinkABTestCard key={test.id} testId={test.id} />
              ))}
            </div>
          )}
        </div>
      )}

      {shortlinkTab === 'completed' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">완료된 테스트</h2>

          {abTestsError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">
                {abTestsError}
              </div>
            </div>
          )}

          {abTestsLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-500">로딩 중...</p>
            </div>
          ) : completedTests.length === 0 ? (
            <p className="text-gray-500">완료된 테스트가 없습니다</p>
          ) : (
            <div className="grid gap-4">
              {completedTests.map((test) => (
                <ShortlinkABTestCard key={test.id} testId={test.id} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 테스트 생성 모달 */}
      <CreateABTestModal
        open={createModalOpen}
        links={shortlinkData?.shortLinks?.map(link => ({
          id: link.id,
          code: link.shortCode,
          title: link.title,
          clickCount: link.clickCount,
        })) || []}
        onCreate={handleCreateTest}
        onOpenChange={setCreateModalOpen}
      />
    </div>
  );
}
