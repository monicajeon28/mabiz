"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users,
  TrendingUp,
  UserCheck,
  BarChart,
  Phone,
  ChevronDown,
  ChevronUp,
  Calendar,
} from "lucide-react";
import { showError } from "@/components/ui/Toast";
import { logger } from "@/lib/logger";

// ─── 타입 정의 ───────────────────────────────────────────────────────────────

type AgentMetric = {
  agent: {
    id: string;
    affiliateCode: string;
    displayName: string | null;
    status: string;
    lastActivityAt?: string | null;
  };
  leads: { total: number };
  sales: { count: number; salesCommission: number | null };
  callCount?: number;
};

type FreeSalesMember = {
  member: { id: string; displayName: string | null; affiliateCode: string };
  leads: { total: number; converted: number };
  conversionRate: number;
};

type Member = {
  userId: string;
  displayName: string | null;
  role: string;
};

type Summary = {
  totalContacts: number;
  totalLeads: number;
  totalCustomers: number;
  monthLeads: number;
  monthCustomers: number;
  conversionRate: number;
};

type Period = "this_month" | "last_month" | "custom";

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  OWNER: "대리점장",
  AGENT: "판매원",
  FREE_SALES: "프리세일즈",
};

const ROLE_COLORS: Record<string, string> = {
  OWNER: "bg-amber-100 text-amber-700",
  AGENT: "bg-blue-100 text-blue-700",
  FREE_SALES: "bg-gray-100 text-gray-600",
};

// ─── 날짜 유틸 ────────────────────────────────────────────────────────────────

function toKSTDateString(date: Date): string {
  // KST(+09:00) 기준 YYYY-MM-DD
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function getPeriodRange(period: Period, customFrom: string, customTo: string) {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  if (period === "this_month") {
    const from = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), 1));
    const to = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth() + 1, 0));
    return { from: toKSTDateString(from), to: toKSTDateString(to) };
  }

  if (period === "last_month") {
    const from = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth() - 1, 1));
    const to = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), 0));
    return { from: toKSTDateString(from), to: toKSTDateString(to) };
  }

  // custom
  return { from: customFrom, to: customTo };
}

// ─── KPI 카드 ─────────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  accent = false,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 shadow-sm flex flex-col gap-2 ${
        accent ? "bg-navy-800 border-navy-700 text-white" : "bg-white border-gray-200"
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`w-5 h-5 ${accent ? "text-gold-400" : "text-navy-600"}`} />
        <p className={`text-sm font-medium ${accent ? "text-gray-300" : "text-gray-500"}`}>
          {title}
        </p>
      </div>
      <p className={`text-3xl font-bold ${accent ? "text-white" : "text-navy-900"}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {sub && (
        <p className={`text-xs ${accent ? "text-gray-400" : "text-gray-400"}`}>{sub}</p>
      )}
    </div>
  );
}

// ─── 날짜 필터 바 ─────────────────────────────────────────────────────────────

function DateFilterBar({
  period,
  setPeriod,
  customFrom,
  setCustomFrom,
  customTo,
  setCustomTo,
}: {
  period: Period;
  setPeriod: (p: Period) => void;
  customFrom: string;
  setCustomFrom: (v: string) => void;
  customTo: string;
  setCustomTo: (v: string) => void;
}) {
  const btnClass = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
      active
        ? "bg-navy-900 text-white"
        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
      <button className={btnClass(period === "this_month")} onClick={() => setPeriod("this_month")}>
        이번 달
      </button>
      <button className={btnClass(period === "last_month")} onClick={() => setPeriod("last_month")}>
        지난 달
      </button>
      <button className={btnClass(period === "custom")} onClick={() => setPeriod("custom")}>
        직접 선택
      </button>
      {period === "custom" && (
        <div className="flex items-center gap-1 flex-wrap">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy-300"
          />
          <span className="text-xs text-gray-400">~</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy-300"
          />
        </div>
      )}
    </div>
  );
}

// ─── 판매원 순위 섹션 ─────────────────────────────────────────────────────────

function LeaderboardSection({
  period,
  customFrom,
  customTo,
}: {
  period: Period;
  customFrom: string;
  customTo: string;
}) {
  const [agents, setAgents] = useState<AgentMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  const load = useCallback(() => {
    const range = getPeriodRange(period, customFrom, customTo);

    // custom 모드인데 날짜가 없으면 조회 생략
    if (period === "custom" && (!range.from || !range.to)) return;

    setLoading(true);
    const qs = new URLSearchParams({ from: range.from, to: range.to }).toString();
    fetch(`/api/team/agents?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setAgents(d.metrics ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period, customFrom, customTo]);

  useEffect(() => {
    load();
  }, [load]);

  const rankEmojis = ["🥇", "🥈", "🥉"];

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p>판매원 데이터가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {agents.map((item, idx) => {
        const isExpanded = expandedAgent === item.agent.id;
        const lastActivity = item.agent.lastActivityAt
          ? new Date(item.agent.lastActivityAt).toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            })
          : null;

        return (
          <div key={item.agent.id} className="bg-white border rounded-xl overflow-hidden shadow-sm">
            {/* 카드 메인 행 */}
            <button
              type="button"
              className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50 transition-colors"
              onClick={() => setExpandedAgent(isExpanded ? null : item.agent.id)}
              aria-expanded={isExpanded}
            >
              <span className="text-2xl w-8 shrink-0">{rankEmojis[idx] ?? `${idx + 1}`}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-navy-900 truncate">
                  {item.agent.displayName ?? item.agent.affiliateCode}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  리드 {item.leads.total}건 · 판매 {item.sales.count}건
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-navy-900">
                  {(item.sales.salesCommission ?? 0).toLocaleString()}원
                </p>
                <p className="text-xs text-gray-400">커미션</p>
              </div>
              <span className="text-gray-400 shrink-0">
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </span>
            </button>

            {/* 활동 상세 (펼침) */}
            {isExpanded && (
              <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 flex flex-wrap gap-4 text-sm">
                {/* 콜 횟수 */}
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-navy-500 shrink-0" />
                  <span className="text-gray-500">콜 횟수</span>
                  <span className="font-semibold text-navy-900">
                    {item.callCount != null ? `${item.callCount}회` : "—"}
                  </span>
                </div>

                {/* 마지막 활동일 */}
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-navy-500 shrink-0" />
                  <span className="text-gray-500">마지막 활동일</span>
                  <span className="font-semibold text-navy-900">
                    {lastActivity ?? "—"}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── 프리세일즈 현황 섹션 ─────────────────────────────────────────────────────

function FreeSalesSection({
  freeSales,
  loading,
}: {
  freeSales: FreeSalesMember[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-36 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (freeSales.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p>소속 프리세일즈가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {freeSales.map((fs) => (
        <div key={fs.member.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-3">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <p className="font-semibold text-navy-900 truncate">
              {fs.member.displayName ?? fs.member.affiliateCode}
            </p>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium shrink-0">
              프리세일즈
            </span>
          </div>

          {/* 지표 3개 */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-gray-400 mb-1">유입 수</p>
              <p className="text-xl font-bold text-navy-900">{fs.leads.total}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">전환 수</p>
              <p className="text-xl font-bold text-navy-900">{fs.leads.converted}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">전환율</p>
              <p
                className={`text-xl font-bold ${
                  fs.conversionRate >= 30
                    ? "text-green-600"
                    : fs.conversionRate >= 10
                    ? "text-amber-600"
                    : "text-gray-500"
                }`}
              >
                {fs.conversionRate.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* 전환율 바 */}
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                fs.conversionRate >= 30
                  ? "bg-green-500"
                  : fs.conversionRate >= 10
                  ? "bg-amber-400"
                  : "bg-gray-300"
              }`}
              style={{ width: `${Math.min(fs.conversionRate, 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [crmLoading, setCrmLoading] = useState(true);

  // 날짜 필터 상태 (리더보드 / 프리세일즈 공통)
  const [period, setPeriod] = useState<Period>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // 프리세일즈
  const [freeSales, setFreeSales] = useState<FreeSalesMember[]>([]);
  const [freeSalesLoading, setFreeSalesLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<"crm" | "leaderboard" | "freesales">("crm");

  // CRM 성과 탭 데이터 (날짜 필터 없음 — 누적)
  useEffect(() => {
    fetch("/api/team/crm-stats")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          showError("팀 성과 데이터를 불러올 수 없습니다.");
          return;
        }
        setMembers(data.members ?? []);
        setSummary(data.summary ?? null);
      })
      .catch((err) => {
        logger.error("[TeamPage] fetch failed", { err });
        showError("서버 오류가 발생했습니다.");
      })
      .finally(() => setCrmLoading(false));
  }, []);

  // 프리세일즈 데이터 — agents API 에서 freeSales 필드 사용
  const loadFreeSales = useCallback(() => {
    const range = getPeriodRange(period, customFrom, customTo);
    if (period === "custom" && (!range.from || !range.to)) return;

    setFreeSalesLoading(true);
    const qs = new URLSearchParams({ from: range.from, to: range.to }).toString();
    fetch(`/api/team/agents?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setFreeSales(d.freeSales ?? []);
      })
      .catch(() => {})
      .finally(() => setFreeSalesLoading(false));
  }, [period, customFrom, customTo]);

  // 프리세일즈 탭 활성화 시 or 필터 변경 시 로드
  useEffect(() => {
    if (activeTab === "freesales") {
      loadFreeSales();
    }
  }, [activeTab, loadFreeSales]);

  const tabClass = (tab: typeof activeTab) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      activeTab === tab
        ? "bg-navy-900 text-white"
        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
    }`;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-navy-900">팀 성과</h1>
        <p className="text-sm text-gray-500 mt-1">조직 전체 CRM 실적 및 판매원 순위</p>
      </div>

      {/* 탭 */}
      <div className="flex flex-wrap gap-2 border-b pb-3">
        <button type="button" className={tabClass("crm")} onClick={() => setActiveTab("crm")}>
          CRM 성과
        </button>
        <button type="button" className={tabClass("leaderboard")} onClick={() => setActiveTab("leaderboard")}>
          판매원 순위
        </button>
        <button type="button" className={tabClass("freesales")} onClick={() => setActiveTab("freesales")}>
          프리세일즈 현황
        </button>
      </div>

      {/* ── CRM 성과 탭 ─────────────────────────────────────────────────────── */}
      {activeTab === "crm" && (
        <>
          {/* KPI 카드 */}
          {crmLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-5 h-28 animate-pulse"
                />
              ))}
            </div>
          ) : summary ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard title="전체 고객" value={summary.totalContacts} sub="누적" icon={Users} />
              <KpiCard
                title="LEAD"
                value={summary.totalLeads}
                sub={`이번 달 +${summary.monthLeads}`}
                icon={TrendingUp}
              />
              <KpiCard
                title="구매 완료"
                value={summary.totalCustomers}
                sub={`이번 달 +${summary.monthCustomers}`}
                icon={UserCheck}
              />
              <KpiCard
                title="이번 달 전환율"
                value={`${summary.conversionRate}%`}
                sub="LEAD → 구매"
                icon={BarChart}
                accent
              />
            </div>
          ) : null}

          {/* 팀원 목록 */}
          <div>
            <h2 className="text-base font-semibold text-navy-800 mb-3">팀원 목록</h2>
            <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">이름</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">역할</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">
                      비고
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {crmLoading ? (
                    [...Array(3)].map((_, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3">
                          <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell" />
                      </tr>
                    ))
                  ) : members.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                        팀원이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    members.map((m) => (
                      <tr key={m.userId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-navy-900">
                          {m.displayName ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              ROLE_COLORS[m.role] ?? "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {ROLE_LABELS[m.role] ?? m.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">
                          향후 개인 실적 확장 예정
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── 판매원 순위 탭 ──────────────────────────────────────────────────── */}
      {activeTab === "leaderboard" && (
        <>
          <DateFilterBar
            period={period}
            setPeriod={setPeriod}
            customFrom={customFrom}
            setCustomFrom={setCustomFrom}
            customTo={customTo}
            setCustomTo={setCustomTo}
          />
          <LeaderboardSection period={period} customFrom={customFrom} customTo={customTo} />
        </>
      )}

      {/* ── 프리세일즈 현황 탭 ──────────────────────────────────────────────── */}
      {activeTab === "freesales" && (
        <>
          <DateFilterBar
            period={period}
            setPeriod={setPeriod}
            customFrom={customFrom}
            setCustomFrom={setCustomFrom}
            customTo={customTo}
            setCustomTo={setCustomTo}
          />
          <FreeSalesSection freeSales={freeSales} loading={freeSalesLoading} />
        </>
      )}
    </div>
  );
}
