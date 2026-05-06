"use client";

import { useState, useEffect } from "react";
import { Rocket, CheckCircle, Loader2, Users, TrendingUp, RotateCcw, Clock, Star } from "lucide-react";
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

type SetupState = "loading" | "needed" | "done";

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
  const [data,        setData]        = useState<DashboardData | null>(null);
  const [setupState,  setSetupState]  = useState<SetupState>("loading");
  const [setting,     setSetting]     = useState(false);
  const [setupResult, setSetupResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard").then((r) => r.json()).then((d) => {
      if (d.ok) setData(d);
    });

    fetch("/api/funnels").then((r) => r.json()).then((d) => {
      setSetupState(d.funnels?.length > 0 ? "done" : "needed");
    });
  }, []);

  const runDefaultSetup = async () => {
    setSetting(true);
    const res  = await fetch("/api/setup/defaults", { method: "POST" });
    const d    = await res.json();
    setSetupState(d.ok ? "done" : "needed");
    setSetupResult(d.ok ? "기본 그룹 3개 + 퍼널 3개 생성 완료!" : (d.message ?? "셋업 실패"));
    setSetting(false);
  };

  const role = data?.role;
  const ym   = data?.yearMonth ?? new Date().toISOString().slice(0, 7);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy-900">대시보드</h1>
        <p className="text-gray-500 text-sm mt-1">{ym} 기준 · {new Date().toLocaleDateString("ko-KR")}</p>
      </div>

      {/* 기본 셋업 배너 */}
      {setupState === "needed" && (
        <div className="bg-gradient-to-r from-navy-900 to-navy-700 text-white rounded-2xl p-5 mb-6">
          <div className="flex items-start gap-4">
            <Rocket className="w-8 h-8 text-gold-300 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h2 className="font-bold text-lg">기본 셋업 1번만 클릭하면 끝!</h2>
              <p className="text-gray-300 text-sm mt-1 mb-3">그룹 3개 + 퍼널 3개 자동 생성</p>
              <button
                onClick={runDefaultSetup}
                disabled={setting}
                className="flex items-center gap-2 bg-gold-500 text-navy-900 px-6 py-2.5 rounded-xl font-bold hover:bg-gold-300 disabled:opacity-50 transition-colors"
              >
                {setting ? <><Loader2 className="w-4 h-4 animate-spin" /> 생성 중...</> : <><Rocket className="w-4 h-4" /> 기본 셋업 시작하기</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {setupResult && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
          <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
          <p className="text-green-800 font-medium text-sm">{setupResult}</p>
        </div>
      )}

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
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
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
    </div>
  );
}
