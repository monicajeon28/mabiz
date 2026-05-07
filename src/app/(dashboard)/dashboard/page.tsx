"use client";

import { useState, useEffect } from "react";
import { Users, TrendingUp, RotateCcw, Clock, Star } from "lucide-react";
import Link from "next/link";

type DashboardData = {
  role: string;
  yearMonth: string;
  // GLOBAL_ADMIN
  totalAgents?: number;
  monthSaleAmount?: number;
  monthRefundAmount?: number;
  pendingApprovalCount?: number;
  goldMemberCount?: number;
  // OWNER
  teamAgentCount?: number;
  // AGENT
  monthRefundCount?: number;
  // FREE_SALES
  affiliateCode?: string | null;
};

type FeedItem = {
  id:        string;
  type:      'LANDING_REG' | 'SALE_PENDING' | 'GOLD_INQUIRY' | 'B2B_LEAD' | 'NEW_CONTACT' | 'ORG_CONTRACT';
  name:      string;
  phone:     string | null;
  detail:    string | null;
  amount:    number | null;
  linkPath:  string;
  createdAt: string;
};

const TYPE_CONFIG: Record<string, { label: string; emoji: string; dotColor: string }> = {
  LANDING_REG:  { label: '랜딩 신규 등록', emoji: '👤', dotColor: 'bg-blue-500'   },
  SALE_PENDING: { label: '판매 승인 대기', emoji: '💰', dotColor: 'bg-amber-500'  },
  GOLD_INQUIRY: { label: '골드문의 신규',  emoji: '⭐', dotColor: 'bg-yellow-500' },
  B2B_LEAD:     { label: 'B2B 잠재고객',  emoji: '🏢', dotColor: 'bg-indigo-500' },
  NEW_CONTACT:  { label: '신규 고객',      emoji: '📋', dotColor: 'bg-green-500'  },
  ORG_CONTRACT: { label: '신규 대리점',    emoji: '🤝', dotColor: 'bg-purple-500' },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

function KpiCard({
  title, value, sub, color = "", icon,
}: {
  title: string; value: string | number; sub?: string; color?: string; icon?: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border p-5 shadow-sm ${color || "bg-white border-gray-200"}`}>
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm font-medium ${color ? "text-white/80" : "text-gray-500"}`}>{title}</p>
        {icon && <span className={color ? "text-white/60" : "text-gray-300"}>{icon}</span>}
      </div>
      <p className={`text-3xl font-bold mt-1 ${color ? "text-white" : "text-navy-900"}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {sub && <p className={`text-xs mt-1 ${color ? "text-white/60" : "text-gray-400"}`}>{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard").then((r) => r.json()).then((d) => {
      if (d.ok) setData(d);
    });

    fetch('/api/notifications/feed?limit=5')
      .then(r => r.json())
      .then(d => { if (d.ok) setFeed(d.items ?? []); })
      .finally(() => setFeedLoading(false));
  }, []);

  const role = data?.role;
  const ym   = data?.yearMonth ?? new Date().toISOString().slice(0, 7);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy-900">대시보드</h1>
        <p className="text-gray-500 text-sm mt-1">{ym} 기준 · {new Date().toLocaleDateString("ko-KR")}</p>
      </div>

      {/* FREE_SALES */}
      {role === "FREE_SALES" && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <p className="text-sm font-semibold text-gray-700 mb-2">내 어필리에이트 코드</p>
          {data?.affiliateCode ? (
            <p className="text-2xl font-bold text-navy-900 font-mono">{data.affiliateCode}</p>
          ) : (
            <p className="text-gray-400 text-sm">코드가 등록되지 않았습니다.</p>
          )}
          <Link href="/my-sales" className="inline-block mt-3 text-sm text-blue-600 hover:underline">내 판매 현황 →</Link>
        </div>
      )}

      {/* GLOBAL_ADMIN KPI */}
      {role === "GLOBAL_ADMIN" && data && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          <KpiCard title="전체 판매원"  value={data.totalAgents ?? 0}          icon={<Users className="w-5 h-5" />} color="bg-navy-900" />
          <KpiCard title="이번달 매출"  value={(data.monthSaleAmount ?? 0).toLocaleString() + "원"} icon={<TrendingUp className="w-5 h-5" />} />
          <KpiCard title="이번달 환불"  value={(data.monthRefundAmount ?? 0).toLocaleString() + "원"} icon={<RotateCcw className="w-5 h-5" />} />
          <KpiCard title="승인 대기"    value={data.pendingApprovalCount ?? 0} icon={<Clock className="w-5 h-5" />} />
          <KpiCard title="골드회원"     value={data.goldMemberCount ?? 0}      icon={<Star className="w-5 h-5" />} />
        </div>
      )}

      {/* OWNER KPI */}
      {role === "OWNER" && data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <KpiCard title="소속 판매원"  value={data.teamAgentCount ?? 0}         icon={<Users className="w-5 h-5" />} color="bg-navy-900" />
          <KpiCard title="팀 이번달 매출" value={(data.monthSaleAmount ?? 0).toLocaleString() + "원"} icon={<TrendingUp className="w-5 h-5" />} />
          <KpiCard title="팀 환불"      value={(data.monthRefundAmount ?? 0).toLocaleString() + "원"} icon={<RotateCcw className="w-5 h-5" />} />
          <KpiCard title="승인 대기"    value={data.pendingApprovalCount ?? 0} icon={<Clock className="w-5 h-5" />} />
        </div>
      )}

      {/* AGENT KPI */}
      {role === "AGENT" && data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <KpiCard title="이번달 매출"  value={(data.monthSaleAmount ?? 0).toLocaleString() + "원"} icon={<TrendingUp className="w-5 h-5" />} color="bg-navy-900" />
          <KpiCard title="환불 건수"    value={data.monthRefundCount ?? 0}     icon={<RotateCcw className="w-5 h-5" />} />
          <KpiCard title="승인 대기"    value={data.pendingApprovalCount ?? 0} icon={<Clock className="w-5 h-5" />} />
          <KpiCard title="내 골드회원"  value={data.goldMemberCount ?? 0}      icon={<Star className="w-5 h-5" />} />
        </div>
      )}

      {/* 빠른 메뉴 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
        <h2 className="font-semibold text-navy-900 mb-4">빠른 이동</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: "/contacts/new",    label: "고객 추가",    bg: "bg-navy-900",    show: role !== "FREE_SALES" },
            { href: "/affiliate-sales", label: "판매 관리",    bg: "bg-blue-600",    show: role === "GLOBAL_ADMIN" || role === "OWNER" },
            { href: "/gold-members",    label: "골드회원",     bg: "bg-gold-500",    show: role !== "FREE_SALES" },
            { href: "/gold-inquiries",  label: "골드문의",     bg: "bg-emerald-600", show: role !== "FREE_SALES" },
            { href: "/my-sales",        label: "내 판매",      bg: "bg-purple-600",  show: true },
            { href: "/payslips",        label: "급여명세",     bg: "bg-teal-600",    show: role !== "FREE_SALES" },
            { href: "/team",            label: "팀 현황",      bg: "bg-indigo-600",  show: role === "GLOBAL_ADMIN" || role === "OWNER" },
            { href: "/contacts",        label: "고객 목록",    bg: "bg-gray-700",    show: role !== "FREE_SALES" },
          ]
            .filter((m) => m.show)
            .map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className={`${m.bg} text-white rounded-xl p-4 flex items-center justify-center text-sm font-medium hover:opacity-90 transition-opacity`}
              >
                {m.label}
              </Link>
            ))}
        </div>
      </div>

      {/* 최근 알림 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-navy-900">최근 알림</h2>
          <Link href="#" className="text-xs text-blue-600 hover:underline">전체 보기</Link>
        </div>

        {feedLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : feed.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">새 알림이 없습니다</p>
        ) : (
          <div className="space-y-2">
            {feed.map(item => {
              const cfg = TYPE_CONFIG[item.type];
              return (
                <Link key={item.id} href={item.linkPath}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${cfg?.dotColor ?? 'bg-gray-400'}`} />
                  <span className="text-base shrink-0">{cfg?.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-500">{cfg?.label}</span>
                      {item.amount && (
                        <span className="text-xs font-bold text-amber-600">{item.amount.toLocaleString()}원</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.name}{item.phone ? ` · ${item.phone}` : ''}{item.detail ? ` · ${item.detail}` : ''}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">
                    {relativeTime(item.createdAt)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
