"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { BarChart2, Users, MousePointerClick, TrendingUp, RefreshCw } from "lucide-react";
import { logger } from "@/lib/logger";
import { KpiCard } from "@/components/marketing/KpiCard";
import { TrendChart } from "@/components/marketing/TrendChart";
import { FunnelChart } from "@/components/marketing/FunnelChart";
import { TopPagesTable } from "@/components/marketing/TopPagesTable";
import type { DashboardData } from "@/types/marketing";

interface Organization {
  id: string;
  name: string | null;
}

// 헬퍼 함수: 현재 KST 기준 월 (YYYY-MM)
function getCurrentKSTMonth() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}`;
}

// 헬퍼 함수: 최근 12개월 목록 생성
function getLast12Months(): { value: string; label: string }[] {
  const months = [];
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth() - i, 1));
    const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const label = `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월${i === 0 ? ' (이번 달)' : ''}`;
    months.push({ value, label });
  }
  return months;
}

function SkeletonCard() {
  return <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />;
}

export default function MarketingDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentKSTMonth);
  const refreshCtrlRef = useRef<AbortController | null>(null);

  // 역할과 조직 목록 로드
  useEffect(() => {
    const fetchUserRoleAndOrgs = async () => {
      try {
        const res = await fetch("/api/me");
        if (res.ok) {
          const ctx = await res.json();
          setRole(ctx.role);

          // GLOBAL_ADMIN이면 조직 목록 로드
          if (ctx.role === "GLOBAL_ADMIN") {
            const orgsRes = await fetch("/api/organizations");
            if (orgsRes.ok) {
              const orgs = await orgsRes.json();
              setOrganizations(orgs);
            }
          }
        }
      } catch (err) {
        logger.error('[fetchUserRoleAndOrgs]', { err });
      }
    };

    fetchUserRoleAndOrgs();
  }, []);

  const fetchData = useCallback((signal?: AbortSignal, orgId?: string) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (orgId) params.set('organizationId', orgId);
    params.set('month', selectedMonth);
    const url = `/api/marketing/dashboard?${params.toString()}`;

    fetch(url, { signal })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setData(d);
        } else {
          setError(d.message ?? "데이터를 불러올 수 없습니다.");
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        logger.error('[fetchData]', { err });
        const isNetworkError = err instanceof TypeError || !navigator.onLine;
        setError(
          isNetworkError
            ? "인터넷 연결을 확인하고 다시 시도해주세요."
            : "서버에 일시적 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
        );
      })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  }, [selectedMonth]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchData(ctrl.signal, selectedOrgId);
    return () => ctrl.abort();
  }, [fetchData, selectedOrgId, selectedMonth]);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-navy-900">마케팅 대시보드</h1>
          <p className="text-gray-500 text-base mt-1">
            {selectedMonth.split('-')[0]}년 {Number(selectedMonth.split('-')[1])}월 성과 분석
          </p>

          {/* 월 선택 */}
          <div className="mt-3 flex items-center gap-2">
            <label htmlFor="month-select" className="text-base text-gray-600 shrink-0">📅 월 선택</label>
            <select
              id="month-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-12 px-3 border border-gray-300 rounded-lg bg-white text-base focus:ring-2 focus:ring-blue-500"
            >
              {getLast12Months().map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* GLOBAL_ADMIN이면 조직 드롭다운 표시 */}
          {role === "GLOBAL_ADMIN" && organizations.length > 0 && (
            <div className="mt-4 flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">조직 선택:</label>
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="h-10 px-3 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-navy-600 focus:border-transparent transition-colors"
              >
                <option value="">전체</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name || "이름 없음"}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <button
          onClick={() => {
            refreshCtrlRef.current?.abort();
            refreshCtrlRef.current = new AbortController();
            fetchData(refreshCtrlRef.current.signal, selectedOrgId);
          }}
          disabled={loading}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-offset-1 focus:ring-navy-600"
          aria-label="새로고침"
          aria-busy={loading}
        >
          <RefreshCw
            className={`w-4 h-4 text-gray-500 ${loading ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {error && (
        <div className="text-center py-16" role="alert">
          <p className="text-red-500 text-sm mb-3">{error}</p>
          <button
            onClick={() => {
              // UI-MARKETING-006: 에러 재시도도 AbortController로 취소 가능하게 처리
              refreshCtrlRef.current?.abort();
              refreshCtrlRef.current = new AbortController();
              fetchData(refreshCtrlRef.current.signal);
            }}
            className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm hover:bg-navy-800"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* ━━━ 요약 카드 4개 ━━━ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : data ? (
          <>
            <KpiCard
              title="전체 방문수"
              value={data.summary.totalViews}
              icon={<BarChart2 className="w-5 h-5 text-navy-600" />}
            />
            <KpiCard
              title="전체 등록수"
              value={data.summary.totalRegistrations}
              sub={`전환율 ${data.summary.conversionRate}%`}
              icon={<Users className="w-5 h-5 text-navy-600" />}
              delta={data.summary.registrationDelta}
            />
            <KpiCard
              title="퍼널 진입"
              value={data.summary.totalFunnelEntered}
              icon={<MousePointerClick className="w-5 h-5 text-navy-600" />}
            />
            <KpiCard
              title="구매 전환율"
              value={`${data.summary.purchaseRate}%`}
              sub={`구매 ${data.summary.totalPurchased}건`}
              icon={<TrendingUp className="w-5 h-5 text-navy-600" />}
            />
          </>
        ) : null}
      </div>

      {/* ━━━ 7일 트렌드 ━━━ */}
      {!loading && data && <TrendChart trend={data.trend} loading={loading} />}

      {/* ━━━ 전환 퍼널 차트 ━━━ */}
      {!loading && data && <FunnelChart summary={data.summary} />}

      {/* ━━━ 상위 랜딩페이지 ━━━ */}
      {(loading || data) && (
        <TopPagesTable
          topPages={data?.topPages ?? []}
          loading={loading}
        />
      )}
    </div>
  );
}
