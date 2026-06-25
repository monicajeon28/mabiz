"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users,
  TrendingUp,
  UserCheck,
  BarChart,
  ChevronDown,
  ChevronUp,
  Calendar,
} from "lucide-react";
import { showError } from "@/components/ui/Toast";
import { logger } from "@/lib/logger";
import { useSession } from "@/hooks/useSession";

// ─── 타입 정의 ───────────────────────────────────────────────────────────────

type AgentMetric = {
  agent: {
    id: string;
    userId: string; // OrganizationMember.userId (UUID) — API 필드명 변경 반영 (T-025)
    displayName: string | null;
    status: string;
    // lastActivityAt 제거 — API 미구현, UI에서 '—' 표시 데드코드 (T-005)
  };
  leads: { total: number };
  sales: { count: number; salesCommission: number | null };
  // callCount 제거 — /api/team/agents가 반환하지 않음 (T-005)
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
  OWNER: "지사장",
  AGENT: "대리점장",
  FREE_SALES: "마케터",
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
        <p className={`text-sm ${accent ? "text-gray-600" : "text-gray-600"}`}>{sub}</p>
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
    `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
      active
        ? "bg-navy-900 text-white"
        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Calendar className="w-4 h-4 text-gray-600 shrink-0" />
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
            className="border border-gray-200 rounded-lg px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy-300"
          />
          <span className="text-sm text-gray-600">~</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy-300"
          />
        </div>
      )}
    </div>
  );
}

// ─── 대리점장 순위 섹션 ─────────────────────────────────────────────────────────

function LeaderboardSection({
  period,
  customFrom,
  customTo,
  orgId,
  role,
}: {
  period: Period;
  customFrom: string;
  customTo: string;
  orgId: string;
  role: string | null;
}) {
  const [agents, setAgents] = useState<AgentMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  const load = useCallback((signal?: AbortSignal) => {
    const range = getPeriodRange(period, customFrom, customTo);

    // custom 모드인데 날짜가 없으면 조회 생략
    if (period === "custom" && (!range.from || !range.to)) return;

    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ from: range.from, to: range.to });
    if (orgId) qs.set("orgId", orgId);
    fetch(`/api/team/agents?${qs.toString()}`, { signal })
      .then((r) => {
        if (r.status === 403) {
          setError("이 데이터를 볼 권한이 없습니다.");
          return null;
        }
        if (!r.ok) throw new Error("서버 오류");
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        if (d.ok) setAgents(d.metrics ?? []);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
      })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  }, [period, customFrom, customTo, orgId]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
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

  if (error) {
    return (
      <div className="text-center py-16 text-red-500">
        <p>{error}</p>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="text-center py-16 text-gray-600">
        <p>대리점장 데이터가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {agents.map((item, idx) => {
        const isExpanded = expandedAgent === item.agent.id;

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
                  {item.agent.displayName ?? item.agent.userId}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">
                  리드 {item.leads.total}건 · 판매 {item.sales.count}건
                </p>
              </div>
              {(role === 'GLOBAL_ADMIN' || role === 'OWNER') && (
                <div className="text-right shrink-0">
                  <p className="font-bold text-navy-900">
                    {(item.sales.salesCommission ?? 0).toLocaleString()}원
                  </p>
                  <p className="text-sm text-gray-600">커미션</p>
                </div>
              )}
              <span className="text-gray-600 shrink-0">
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </span>
            </button>

            {/* 활동 상세 (펼침) — callCount/lastActivityAt은 API 미구현으로 제거 (T-005) */}
            {isExpanded && (
              <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                상세 활동 데이터를 불러올 수 없습니다.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── 마케터 현황 섹션 ─────────────────────────────────────────────────────

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
      <div className="text-center py-16 text-gray-600">
        <p>소속 마케터가 없습니다</p>
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
            <span className="text-sm bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium shrink-0">
              마케터
            </span>
          </div>

          {/* 지표 3개 */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-sm text-gray-600 mb-1">유입 수</p>
              <p className="text-xl font-bold text-navy-900">{fs.leads.total}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">전환 수</p>
              <p className="text-xl font-bold text-navy-900">{fs.leads.converted}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">전환율</p>
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

  // 날짜 필터 상태 (리더보드 / 마케터 공통)
  const [period, setPeriod] = useState<Period>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // 마케터
  const [freeSales, setFreeSales] = useState<FreeSalesMember[]>([]);
  const [freeSalesLoading, setFreeSalesLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<"crm" | "leaderboard" | "freesales">("crm");

  // GLOBAL_ADMIN 조직 선택
  // T-008: useSession에서 role을 직접 가져와 초기값으로 사용 (하이드레이션 지연 방지)
  const { role: sessionRole } = useSession();
  // sessionRole만 신뢰 (API 응답 role로 권한 상승 방지)
  const displayRole = sessionRole ?? null;
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>(""); // "" = 전체

  // CRM 성과 탭 데이터
  const loadCrmStats = useCallback((signal?: AbortSignal) => {
    // T-007: GLOBAL_ADMIN만 orgId 파라미터 전송 (AGENT/OWNER는 서버에서 자동 처리)
    const qs = (sessionRole === 'GLOBAL_ADMIN' && selectedOrgId) ? `?orgId=${selectedOrgId}` : "";
    fetch(`/api/team/crm-stats${qs}`, { signal })
      .then(async (r) => {
        if (!r.ok) {
          if (r.status === 403) showError('권한이 없습니다.');
          else showError('팀 성과 데이터를 불러올 수 없습니다.');
          return undefined;
        }
        return r.json();
      })
      .then((data) => {
        if (!data || !data.ok) return;
        // data.role은 UI 표시에 사용하지 않음 (sessionRole만 신뢰)
        setOrgs(data.orgs ?? []);
        setMembers(data.members ?? []);
        setSummary(data.summary ?? null);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        logger.error("[TeamPage] fetch failed", { err });
        showError("서버 오류가 발생했습니다.");
      })
      .finally(() => { if (!signal?.aborted) setCrmLoading(false); });
  }, [selectedOrgId, sessionRole]); // T-007: sessionRole 의존성 추가

  useEffect(() => {
    const ctrl = new AbortController();
    loadCrmStats(ctrl.signal);
    return () => ctrl.abort();
  }, [loadCrmStats]);

  // 마케터 데이터 — agents API 에서 freeSales 필드 사용
  const loadFreeSales = useCallback((signal?: AbortSignal) => {
    // T-009: AGENT 역할은 /api/team/agents 접근 불가 (API가 403 반환) — 클라이언트 guard 추가
    if (sessionRole !== 'GLOBAL_ADMIN' && sessionRole !== 'OWNER') return;

    const range = getPeriodRange(period, customFrom, customTo);
    if (period === "custom" && (!range.from || !range.to)) return;

    setFreeSalesLoading(true);
    const qs = new URLSearchParams({ from: range.from, to: range.to });
    if (selectedOrgId) qs.set("orgId", selectedOrgId);
    fetch(`/api/team/agents?${qs.toString()}`, { signal })
      .then((r) => {
        if (r.status === 403) return null;
        if (!r.ok) throw new Error("서버 오류");
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        if (d.ok) setFreeSales(d.freeSales ?? []);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
      })
      .finally(() => { if (!signal?.aborted) setFreeSalesLoading(false); });
  }, [period, customFrom, customTo, selectedOrgId, sessionRole]); // T-009: sessionRole 의존성 추가

  // 마케터 탭 활성화 시 or 필터 변경 시 로드
  useEffect(() => {
    if (activeTab !== "freesales") return;
    const ctrl = new AbortController();
    loadFreeSales(ctrl.signal);
    return () => ctrl.abort();
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
        <p className="text-sm text-gray-500 mt-1">조직 전체 CRM 실적 및 대리점장 순위</p>
      </div>

      {/* 조직 선택 드롭다운 — GLOBAL_ADMIN 전용 */}
      {displayRole === "GLOBAL_ADMIN" && orgs.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">조직 선택</span>
          <select
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy-300 bg-white"
          >
            <option value="">전체 합산</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* 탭 */}
      {/* T-007: AGENT는 crm-stats 탭만 표시. leaderboard/freesales는 GLOBAL_ADMIN/OWNER 전용 */}
      <div className="flex flex-wrap gap-2 border-b pb-3">
        <button type="button" className={tabClass("crm")} onClick={() => setActiveTab("crm")}>
          CRM 성과
        </button>
        {(displayRole === "GLOBAL_ADMIN" || displayRole === "OWNER") && (
          <button type="button" className={tabClass("leaderboard")} onClick={() => setActiveTab("leaderboard")}>
            대리점장 순위
          </button>
        )}
        {(displayRole === "GLOBAL_ADMIN" || displayRole === "OWNER") && (
          <button type="button" className={tabClass("freesales")} onClick={() => setActiveTab("freesales")}>
            마케터 현황
          </button>
        )}
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
                      <td colSpan={3} className="px-4 py-8 text-center text-gray-600">
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
                            className={`inline-flex items-center px-2 py-0.5 rounded text-sm font-medium ${
                              ROLE_COLORS[m.role] ?? "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {ROLE_LABELS[m.role] ?? m.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-sm hidden md:table-cell">-</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── 대리점장 순위 탭 (GLOBAL_ADMIN / OWNER 전용) ─────────────────────── */}
      {activeTab === "leaderboard" && (displayRole === "GLOBAL_ADMIN" || displayRole === "OWNER") && (
        <>
          <DateFilterBar
            period={period}
            setPeriod={setPeriod}
            customFrom={customFrom}
            setCustomFrom={setCustomFrom}
            customTo={customTo}
            setCustomTo={setCustomTo}
          />
          <LeaderboardSection period={period} customFrom={customFrom} customTo={customTo} orgId={selectedOrgId} role={displayRole} />
        </>
      )}

      {/* ── 마케터 현황 탭 (GLOBAL_ADMIN / OWNER 전용) ──────────────────── */}
      {activeTab === "freesales" && (displayRole === "GLOBAL_ADMIN" || displayRole === "OWNER") && (
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
