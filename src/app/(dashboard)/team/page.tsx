"use client";

import { useEffect, useState } from "react";
import { Users, TrendingUp, UserCheck, BarChart } from "lucide-react";
import { showError } from "@/components/ui/Toast";
import { logger } from "@/lib/logger";

type AgentMetric = {
  agent: { id: string; affiliateCode: string; displayName: string | null; status: string };
  leads: { total: number };
  sales: { count: number; salesCommission: number | null };
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

function LeaderboardSection() {
  const [agents, setAgents] = useState<AgentMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/team/agents")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setAgents(d.metrics ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
      {agents.map((item, idx) => (
        <div
          key={item.agent.id}
          className="bg-white border rounded-xl p-4 flex items-center gap-4"
        >
          <span className="text-2xl w-8">{rankEmojis[idx] ?? `${idx + 1}`}</span>
          <div className="flex-1">
            <p className="font-semibold">
              {item.agent.displayName ?? item.agent.affiliateCode}
            </p>
            <p className="text-xs text-gray-500">
              리드 {item.leads.total}건 · 판매 {item.sales.count}건
            </p>
          </div>
          <div className="text-right">
            <p className="font-bold text-navy-900">
              {(item.sales.salesCommission ?? 0).toLocaleString()}원
            </p>
            <p className="text-xs text-gray-400">커미션</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"crm" | "leaderboard">("crm");

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
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-navy-900">팀 성과</h1>
        <p className="text-sm text-gray-500 mt-1">조직 전체 CRM 실적 및 판매원 순위</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 border-b pb-3">
        <button
          onClick={() => setActiveTab("crm")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "crm"
              ? "bg-navy-900 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          CRM 성과
        </button>
        <button
          onClick={() => setActiveTab("leaderboard")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "leaderboard"
              ? "bg-navy-900 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          판매원 순위
        </button>
      </div>

      {/* 리더보드 탭 */}
      {activeTab === "leaderboard" && <LeaderboardSection />}

      {/* CRM 성과 탭 */}
      {activeTab === "crm" && (<>

      {/* KPI 카드 */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-gray-50 p-5 h-28 animate-pulse" />
          ))}
        </div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              title="전체 고객"
              value={summary.totalContacts}
              sub="누적"
              icon={Users}
            />
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
        </>
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
              {loading ? (
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
      </>)}
    </div>
  );
}
