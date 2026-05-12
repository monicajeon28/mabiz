'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShoppingCart, Users, CreditCard, UserPlus, GraduationCap,
  DollarSign, Crown, MessageSquare, Percent, Plane, FileText,
  Clock, Loader2, CalendarDays, ChevronDown,
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
type B2CData = {
  totalSalesAmount: number;
  salesCount: number;
  reservationCount: number;
  recentSales: B2CSale[];
  passportPnr: B2CPassport[];
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
  title, value, icon, suffix,
}: {
  title: string; value: string | number; icon: React.ReactNode; suffix?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <span className="text-gray-300">{icon}</span>
      </div>
      <p className="mt-1 text-3xl font-bold text-gray-900">
        {typeof value === 'number' ? value.toLocaleString() : value}
        {suffix && <span className="ml-1 text-lg font-medium text-gray-400">{suffix}</span>}
      </p>
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

/* ─────────────────── B2C 탭 ─────────────────── */

function B2CTab({ data, loading }: { data: B2CData | null; loading: boolean }) {
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
        <StatCard title="총 판매액" value={`₩${formatWon(data.totalSalesAmount)}`} icon={<DollarSign className="h-5 w-5" />} />
        <StatCard title="판매 건수" value={data.salesCount} icon={<ShoppingCart className="h-5 w-5" />} suffix="건" />
        <StatCard title="예약 현황" value={data.reservationCount} icon={<Plane className="h-5 w-5" />} suffix="건" />
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
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
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

function B2BTab({ data, loading }: { data: B2BData | null; loading: boolean }) {
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
        <StatCard title="신규 리드" value={data.newLeads} icon={<UserPlus className="h-5 w-5" />} suffix="명" />
        <StatCard title="교육 신청자" value={data.eduApplicants} icon={<GraduationCap className="h-5 w-5" />} suffix="명" />
        <StatCard title="결제 현황" value={`₩${formatWon(data.paymentAmount)}`} icon={<CreditCard className="h-5 w-5" />} />
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

function GoldTab({ data, loading }: { data: GoldData | null; loading: boolean }) {
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
        <StatCard title="골드 회원 수" value={data.goldMemberCount} icon={<Crown className="h-5 w-5" />} suffix="명" />
        <StatCard title="신규 문의" value={data.newInquiries} icon={<MessageSquare className="h-5 w-5" />} suffix="건" />
        <StatCard title="납부율" value={data.paymentRate} icon={<Percent className="h-5 w-5" />} suffix="%" />
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
      {activeTab === 'b2c' && <B2CTab data={b2cData} loading={loading && !b2cData} />}
      {activeTab === 'b2b' && <B2BTab data={b2bData} loading={loading && !b2bData} />}
      {activeTab === 'gold' && <GoldTab data={goldData} loading={loading && !goldData} />}
    </div>
  );
}
