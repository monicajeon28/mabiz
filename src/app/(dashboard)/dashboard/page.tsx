"use client";

import { useState, useEffect } from "react";
import { Rocket, CheckCircle, Loader2, Users, MessageSquare, FileText, GitBranch } from "lucide-react";
import Link from "next/link";

type Stats = { totalContacts: number; leads: number; customers: number };
type SetupState = "loading" | "needed" | "done";

function KpiCard({ title, value, color = "" }: { title: string; value: number | string; color?: string }) {
  return (
    <div className={`rounded-xl border border-gray-200 p-5 shadow-sm ${color || "bg-white"}`}>
      <p className="text-sm text-gray-500 font-medium">{title}</p>
      <p className={`text-3xl font-bold mt-1 ${color ? "text-white" : "text-navy-900"}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const [stats,       setStats]       = useState<Stats | null>(null);
  const [setupState,  setSetupState]  = useState<SetupState>("loading");
  const [setting,     setSetting]     = useState(false);
  const [setupResult, setSetupResult] = useState<string | null>(null);

  useEffect(() => {
    // 통계 조회
    Promise.all([
      fetch("/api/contacts?limit=1").then((r) => r.json()),
      fetch("/api/contacts?limit=1&type=LEAD").then((r) => r.json()),
      fetch("/api/contacts?limit=1&type=CUSTOMER").then((r) => r.json()),
    ]).then(([all, leads, customers]) => {
      setStats({
        totalContacts: all.total ?? 0,
        leads:         leads.total ?? 0,
        customers:     customers.total ?? 0,
      });
    });

    // 기본 셋업 여부 확인
    fetch("/api/funnels")
      .then((r) => r.json())
      .then((d) => {
        setSetupState(d.funnels?.length > 0 ? "done" : "needed");
      });
  }, []);

  const runDefaultSetup = async () => {
    setSetting(true);
    const res  = await fetch("/api/setup/defaults", { method: "POST" });
    const data = await res.json();
    if (data.ok) {
      setSetupState("done");
      setSetupResult("기본 그룹 3개 + 퍼널 3개 생성 완료!");
    } else {
      setSetupResult(data.message ?? "셋업 실패");
    }
    setSetting(false);
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy-900">대시보드</h1>
        <p className="text-gray-500 text-sm mt-1">오늘: {new Date().toLocaleDateString("ko-KR")}</p>
      </div>

      {/* ━━━ 기본 셋업 배너 ━━━ */}
      {setupState === "needed" && (
        <div className="bg-gradient-to-r from-navy-900 to-navy-700 text-white rounded-2xl p-5 mb-6">
          <div className="flex items-start gap-4">
            <Rocket className="w-8 h-8 text-gold-300 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h2 className="font-bold text-lg">기본 셋업 1번만 클릭하면 끝!</h2>
              <p className="text-gray-300 text-sm mt-1 mb-3">
                아래 3가지가 자동으로 만들어집니다:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
                {[
                  { group: "잠재고객 그룹",       funnel: "D+0/2/5 시퀀스",     color: "bg-blue-500/20 border-blue-400/30" },
                  { group: "관심고객 그룹",        funnel: "상담 후 시퀀스",      color: "bg-yellow-500/20 border-yellow-400/30" },
                  { group: "구매고객 VIP 케어",    funnel: "D-150~D+2 (14단계)", color: "bg-gold-500/20 border-gold-400/30" },
                ].map((item) => (
                  <div key={item.group} className={`rounded-xl border p-3 ${item.color}`}>
                    <p className="font-semibold text-sm">{item.group}</p>
                    <p className="text-xs text-gray-300 mt-0.5">→ {item.funnel}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={runDefaultSetup}
                disabled={setting}
                className="flex items-center gap-2 bg-gold-500 text-navy-900 px-6 py-2.5 rounded-xl font-bold hover:bg-gold-300 disabled:opacity-50 transition-colors"
              >
                {setting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> 생성 중...</>
                ) : (
                  <><Rocket className="w-4 h-4" /> 기본 셋업 시작하기</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 셋업 완료 */}
      {setupResult && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
          <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
          <p className="text-green-800 font-medium text-sm">{setupResult}</p>
        </div>
      )}

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard title="총 고객"   value={stats?.totalContacts ?? 0} color="bg-navy-900" />
        <KpiCard title="잠재고객"  value={stats?.leads     ?? 0} />
        <KpiCard title="구매완료"  value={stats?.customers ?? 0} />
        <KpiCard title="전환율"
          value={
            stats && stats.totalContacts > 0
              ? ((stats.customers / stats.totalContacts) * 100).toFixed(1) + "%"
              : "0%"
          }
        />
      </div>

      {/* 빠른 메뉴 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="font-semibold text-navy-900 mb-4">빠른 시작</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: "/contacts/new",      icon: Users,         label: "고객 추가",      bg: "bg-navy-900" },
            { href: "/groups",            icon: GitBranch,     label: "그룹 관리",      bg: "bg-blue-600" },
            { href: "/landing-pages/new", icon: FileText,      label: "랜딩페이지",     bg: "bg-emerald-600" },
            { href: "/tools",             icon: MessageSquare, label: "문자 템플릿",    bg: "bg-gold-500" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${item.bg} text-white rounded-xl p-4 flex flex-col items-center gap-2 hover:opacity-90 transition-opacity`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
