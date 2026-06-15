"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ClipboardList,
  CheckCircle,
  XCircle,
  Ban,
  BarChart2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Calendar,
  MessageSquare,
  Phone,
  AlertCircle,
  TrendingUp,
  Send,
  Clock,
  Users,
} from "lucide-react";
import ABTestDashboard from "./components/ab-test-dashboard";
import { logger } from "@/lib/logger";

// ─── 타입 ──────────────────────────────────────────────────────────────────

type SmsStatus = "SENT" | "FAILED" | "BLOCKED";

interface SmsLog {
  id: string;
  phone: string;
  contentPreview: string;
  status: SmsStatus;
  blockReason: string | null;
  resultCode: string | null;
  channel: string;
  sentAt: string;
}

interface Summary {
  total: number;
  sent: number;
  failed: number;
  blocked: number;
}

interface LogsResponse {
  ok: boolean;
  logs: SmsLog[];
  summary: Summary;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface ChannelStats {
  [channel: string]: number;
}

interface BlockReason {
  reason: string;
  count: number;
}

interface DailyEntry {
  date: string;
  sent: number;
  failed: number;
  blocked: number;
}

interface StatsData {
  total: number;
  sent: number;
  failed: number;
  blocked: number;
  successRate: number;
  byChannel: ChannelStats;
  blockReasons: BlockReason[];
  daily: DailyEntry[];
}

// ─── 퍼널문자(회차발송) 타입 ──────────────────────────────────────────────

// ScheduledSms.status 4종 (PENDING=예약중 포함)
type FunnelSentStatus = "PENDING" | "SENT" | "FAILED" | "BLOCKED";

// 백엔드 SSoT(/api/funnel-sms/sent-history)가 실제로 반환하는 행 형태와 1:1 정합.
// (route.ts L161-172 select 결과)
interface FunnelSentRow {
  contactId: string | null;
  name: string | null; // 고객명 (Contact.name)
  phone: string | null; // 수신번호 (Contact.phone)
  addedAt: string | null; // DB 유입일 (ContactGroupMember.addedAt)
  round: number | null; // 발송 당시 daysAfter 스냅샷 = N일차 (round=0 → 0일차=유입 당일). 레거시 NULL 가능
  dayLabel: number | null; // = round (N일차, 0-인덱스)
  status: FunnelSentStatus; // 성공여부
  scheduledAt: string; // 발송 예정일시
  sentAt: string | null; // 실제 발송일시
  groupId: string | null;
}

// 백엔드 summary 형태 (route.ts L176): status 버킷 집계.
// failedOrBlocked/progressRate 는 백엔드가 주지 않으므로 클라이언트에서 파생.
interface FunnelSentSummary {
  total: number; // 총 발송예약
  sent: number; // 성공
  failed: number; // 실패
  blocked: number; // 차단
  pending: number; // 예약중/발송중
}

interface FunnelSentResponse {
  ok: boolean;
  rows: FunnelSentRow[];
  summary: FunnelSentSummary;
  page: number;
  total: number;
  message?: string;
}

interface FunnelSmsOption {
  id: string;
  title: string;
}

interface FunnelSmsListResponse {
  ok: boolean;
  data: { id: string; title: string }[];
}

// ─── 상수 ──────────────────────────────────────────────────────────────────

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "전체" },
  { value: "SENT", label: "발송 성공" },
  { value: "FAILED", label: "실패" },
  { value: "BLOCKED", label: "차단됨" },
];

const DAYS_OPTIONS = [
  { value: 7, label: "7일" },
  { value: 14, label: "14일" },
  { value: 30, label: "30일" },
  { value: 60, label: "60일" },
  { value: 90, label: "90일" },
];

const PAGE_SIZE_OPTIONS = [20, 50, 100];

const STATUS_INFO: Record<
  SmsStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  SENT: {
    label: "발송 성공",
    color: "bg-green-100 text-green-700",
    icon: <CheckCircle className="w-3.5 h-3.5" />,
  },
  FAILED: {
    label: "실패",
    color: "bg-red-100 text-red-700",
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
  BLOCKED: {
    label: "차단됨",
    color: "bg-orange-100 text-orange-700",
    icon: <Ban className="w-3.5 h-3.5" />,
  },
};

// 퍼널문자 회차발송 상태 배지: 기존 STATUS_INFO(SENT/FAILED/BLOCKED) 재사용 + PENDING 추가
const FUNNEL_STATUS_INFO: Record<
  FunnelSentStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  ...STATUS_INFO,
  PENDING: {
    label: "예약중",
    color: "bg-gray-100 text-gray-600",
    icon: <Clock className="w-3.5 h-3.5" />,
  },
};

const FUNNEL_STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "전체" },
  { value: "PENDING", label: "예약중" },
  { value: "SENT", label: "발송 성공" },
  { value: "FAILED", label: "실패" },
  { value: "BLOCKED", label: "차단됨" },
];

const CHANNEL_LABELS: Record<string, string> = {
  SMS: "SMS",
  LMS: "LMS",
  MMS: "MMS",
  KAKAO: "카카오",
  EMAIL: "이메일",
  PUSH: "푸시",
};

// ─── 유틸리티 ──────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function channelLabel(ch: string): string {
  return CHANNEL_LABELS[ch] ?? ch;
}

// 날짜만 (DB 유입일 표기용)
function formatDateOnly(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
}

// 회차 라벨 1곳 고정: round = daysAfter = "N일차" (0-인덱스). round=0 → 유입 당일.
function roundLabel(round: number | null): string {
  if (round === null || round === undefined) return "회차 미상";
  if (round === 0) return "0일차(당일)";
  return `${round}일차`;
}

// ─── 통계 카드 컴포넌트 ────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ReactNode;
  colorClass: string;
}

function StatCard({ label, value, sub, icon, colorClass }: StatCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${colorClass} shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500 mb-0.5">{label}</p>
        <p className="text-xl font-bold text-gray-900 tabular-nums">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {sub && <p className="text-sm text-gray-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── 스켈레톤 ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />;
}

function SkeletonRow() {
  return <div className="h-14 bg-gray-100 rounded-xl animate-pulse" />;
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────

export default function SmsLogsPage() {
  // 세션
  const [orgId, setOrgId] = useState<string>("");

  // 필터 상태
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [days, setDays] = useState<number>(30);
  const [pageSize, setPageSize] = useState<number>(50);
  const [page, setPage] = useState<number>(1);

  // 탭
  const [activeTab, setActiveTab] = useState<
    "logs" | "funnel" | "stats" | "abtest"
  >("logs");

  // 데이터
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [summary, setSummary] = useState<Summary>({
    total: 0,
    sent: 0,
    failed: 0,
    blocked: 0,
  });
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [stats, setStats] = useState<StatsData | null>(null);

  // ── 퍼널문자(회차발송) 탭 상태 ──
  const [funnelRows, setFunnelRows] = useState<FunnelSentRow[]>([]);
  const [funnelSummary, setFunnelSummary] = useState<FunnelSentSummary>({
    total: 0,
    sent: 0,
    failed: 0,
    blocked: 0,
    pending: 0,
  });
  const [funnelTotalPages, setFunnelTotalPages] = useState<number>(1);
  const [funnelTotalCount, setFunnelTotalCount] = useState<number>(0);
  const [funnelPage, setFunnelPage] = useState<number>(1);
  const [funnelOptions, setFunnelOptions] = useState<FunnelSmsOption[]>([]);
  // 퍼널 탭 필터
  const [funnelSmsId, setFunnelSmsId] = useState<string>("");
  const [funnelGroupId, setFunnelGroupId] = useState<string>("");
  const [funnelRound, setFunnelRound] = useState<string>("");
  const [funnelStatus, setFunnelStatus] = useState<string>("");
  const [funnelLoading, setFunnelLoading] = useState<boolean>(false);
  const [funnelError, setFunnelError] = useState<string | null>(null);

  // 로딩 / 에러
  const [logsLoading, setLogsLoading] = useState<boolean>(true);
  const [statsLoading, setStatsLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  // orgId 로드
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/me", { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.organizationId) setOrgId(d.organizationId);
      })
      .catch((e) => {
        if (e instanceof Error && e.name === "AbortError") return;
      });
    return () => {
      controller.abort();
    };
  }, []);

  // URL 쿼리 초기화 (?tab=funnel&funnelSmsId=) — T6 딥링크 연동
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const tab = sp.get("tab");
    if (
      tab === "logs" ||
      tab === "funnel" ||
      tab === "stats" ||
      tab === "abtest"
    ) {
      setActiveTab(tab);
    }
    const fid = sp.get("funnelSmsId");
    if (fid) setFunnelSmsId(fid);
    // 최초 1회만 (마운트 시) URL 읽기
     
  }, []);

  // 퍼널문자 드롭다운 옵션 로드 (/api/funnel-sms)
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/funnel-sms?pageSize=200", { signal: controller.signal })
      .then((r) => r.json())
      .then((d: FunnelSmsListResponse) => {
        if (d.ok && Array.isArray(d.data)) {
          setFunnelOptions(
            d.data.map((f) => ({ id: f.id, title: f.title }))
          );
        }
      })
      .catch((e) => {
        if (e instanceof Error && e.name === "AbortError") return;
        logger.error("[sms-logs] funnel-sms 옵션 로드 실패", {
          err: e instanceof Error ? e.message : String(e),
        });
      });
    return () => {
      controller.abort();
    };
  }, []);

  // 발송 기록 불러오기
  const fetchLogs = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLogsLoading(true);
      setLogsError(null);

      const params = new URLSearchParams({
        days: String(days),
        take: String(pageSize),
        page: String(page),
      });
      if (statusFilter) params.set("status", statusFilter);

      try {
        const res = await fetch(`/api/sms-logs?${params.toString()}`);
        if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
        const data: LogsResponse = await res.json();
        if (data.ok) {
          setLogs(data.logs);
          setSummary(data.summary);
          setTotalPages(data.totalPages);
          setTotalCount(data.total);
        } else {
          throw new Error((data as { message?: string }).message ?? "조회 실패");
        }
      } catch (e) {
        setLogsError(e instanceof Error ? e.message : "데이터를 불러올 수 없습니다.");
      } finally {
        if (isRefresh) setRefreshing(false);
        else setLogsLoading(false);
      }
    },
    [days, pageSize, page, statusFilter]
  );

  // 통계 불러오기
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const res = await fetch(`/api/sms-logs/stats?days=${days}`);
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
      const data = await res.json();
      if (data.ok) setStats(data.stats);
      else throw new Error(data.message ?? "통계 조회 실패");
    } catch (e) {
      setStatsError(e instanceof Error ? e.message : "통계를 불러올 수 없습니다.");
    } finally {
      setStatsLoading(false);
    }
  }, [days]);

  // 퍼널문자(회차발송) 발송 이력 불러오기
  const fetchFunnelHistory = useCallback(async () => {
    setFunnelLoading(true);
    setFunnelError(null);

    const params = new URLSearchParams({
      days: String(days),
      take: String(pageSize),
      page: String(funnelPage),
    });
    if (funnelSmsId) params.set("funnelSmsId", funnelSmsId);
    if (funnelGroupId) params.set("groupId", funnelGroupId);
    if (funnelRound) params.set("round", funnelRound);
    if (funnelStatus) params.set("status", funnelStatus);

    try {
      const res = await fetch(
        `/api/funnel-sms/sent-history?${params.toString()}`
      );
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
      const data: FunnelSentResponse = await res.json();
      if (data.ok) {
        setFunnelRows(data.rows);
        setFunnelSummary(data.summary);
        // 백엔드는 totalPages/pageSize 를 주지 않으므로 클라이언트에서 파생 (take=pageSize 와 일치).
        setFunnelTotalPages(Math.max(1, Math.ceil((data.total || 0) / pageSize)));
        setFunnelTotalCount(data.total);
      } else {
        throw new Error(data.message ?? "조회 실패");
      }
    } catch (e) {
      logger.error("[sms-logs] 퍼널문자 발송이력 조회 실패", {
        err: e instanceof Error ? e.message : String(e),
      });
      setFunnelError(
        e instanceof Error ? e.message : "데이터를 불러올 수 없습니다."
      );
    } finally {
      setFunnelLoading(false);
    }
  }, [days, pageSize, funnelPage, funnelSmsId, funnelGroupId, funnelRound, funnelStatus]);

  // 탭/필터 변경 시 데이터 로드
  useEffect(() => {
    if (activeTab === "logs") fetchLogs();
  }, [activeTab, fetchLogs]);

  useEffect(() => {
    if (activeTab === "stats") fetchStats();
  }, [activeTab, fetchStats]);

  useEffect(() => {
    if (activeTab === "funnel") fetchFunnelHistory();
  }, [activeTab, fetchFunnelHistory]);

  // 필터 변경 시 페이지 1로 리셋
  const applyFilter = (type: "status" | "days" | "pageSize", value: string | number) => {
    setPage(1);
    if (type === "status") setStatusFilter(value as string);
    if (type === "days") setDays(value as number);
    if (type === "pageSize") setPageSize(value as number);
  };

  const successRate =
    summary.total > 0
      ? Math.round((summary.sent / summary.total) * 1000) / 10
      : 0;

  // 퍼널 필터 변경 시 페이지 1로 리셋
  const applyFunnelFilter = (
    type: "funnelSmsId" | "groupId" | "round" | "status",
    value: string
  ) => {
    setFunnelPage(1);
    if (type === "funnelSmsId") setFunnelSmsId(value);
    if (type === "groupId") setFunnelGroupId(value);
    if (type === "round") setFunnelRound(value);
    if (type === "status") setFunnelStatus(value);
  };

  // ─── 렌더 ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">발송 기록</h1>
            <p className="text-sm text-gray-500 mt-0.5">SMS · 카카오 · 이메일 발송 내역</p>
          </div>
        </div>
        <button
          onClick={() => fetchLogs(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          새로고침
        </button>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {(
          [
            { key: "logs", label: "발송 목록", icon: <MessageSquare className="w-3.5 h-3.5" /> },
            { key: "funnel", label: "자동문자(예약발송)", icon: <Send className="w-3.5 h-3.5" /> },
            { key: "stats", label: "통계 분석", icon: <BarChart2 className="w-3.5 h-3.5" /> },
            { key: "abtest", label: "A/B 테스트", icon: <TrendingUp className="w-3.5 h-3.5" /> },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── 탭 1: 발송 목록 ─────────────────────────────────────────────── */}
      {activeTab === "logs" && (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {logsLoading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : (
              <>
                <StatCard
                  label="전체 발송"
                  value={summary.total}
                  sub={`최근 ${days}일`}
                  icon={<MessageSquare className="w-4 h-4 text-blue-600" />}
                  colorClass="bg-blue-50"
                />
                <StatCard
                  label="성공"
                  value={summary.sent}
                  sub={`성공률 ${successRate}%`}
                  icon={<CheckCircle className="w-4 h-4 text-green-600" />}
                  colorClass="bg-green-50"
                />
                <StatCard
                  label="실패"
                  value={summary.failed}
                  icon={<XCircle className="w-4 h-4 text-red-500" />}
                  colorClass="bg-red-50"
                />
                <StatCard
                  label="차단됨"
                  value={summary.blocked}
                  sub="야간·수신거부 등"
                  icon={<Ban className="w-4 h-4 text-orange-500" />}
                  colorClass="bg-orange-50"
                />
              </>
            )}
          </div>

          {/* 필터 바 */}
          <div className="flex flex-wrap gap-2 mb-4">
            {/* 기간 */}
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-600" />
              <select
                value={days}
                onChange={(e) => applyFilter("days", Number(e.target.value))}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DAYS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    최근 {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 상태 필터 */}
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => applyFilter("status", opt.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    statusFilter === opt.value
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* 페이지 크기 */}
            <div className="ml-auto flex items-center gap-1.5">
              <span className="text-sm text-gray-600">표시</span>
              <select
                value={pageSize}
                onChange={(e) => applyFilter("pageSize", Number(e.target.value))}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}건
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 에러 */}
          {logsError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {logsError}
            </div>
          )}

          {/* 총 건수 */}
          {!logsLoading && (
            <p className="text-sm text-gray-500 mb-3">
              총{" "}
              <span className="font-semibold text-gray-700">
                {totalCount.toLocaleString()}
              </span>
              건 중{" "}
              <span className="font-semibold text-gray-700">
                {logs.length}
              </span>
              건 표시
            </p>
          )}

          {/* 목록 */}
          {logsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-gray-600">
              <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">발송 기록이 없습니다.</p>
              <p className="text-sm mt-1">기간 또는 필터를 변경해 보세요.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const info = STATUS_INFO[log.status];
                return (
                  <div
                    key={log.id}
                    className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {/* 상태 아이콘 */}
                      <div className="mt-0.5 shrink-0">
                        <span
                          className={`flex items-center gap-1 text-sm font-medium px-2 py-0.5 rounded-full ${info.color}`}
                        >
                          {info.icon}
                          {info.label}
                        </span>
                      </div>

                      {/* 메인 내용 */}
                      <div className="flex-1 min-w-0">
                        {/* 전화 + 채널 + 시간 */}
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="flex items-center gap-1 text-sm text-gray-500">
                            <Phone className="w-3 h-3" />
                            {log.phone}
                          </span>
                          <span className="text-sm bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                            {channelLabel(log.channel)}
                          </span>
                          <span className="text-sm text-gray-600">
                            {formatDate(log.sentAt)}
                          </span>
                        </div>

                        {/* 메시지 미리보기 */}
                        <p className="text-sm text-gray-700 line-clamp-2">
                          {log.contentPreview || "(내용 없음)"}
                        </p>

                        {/* 차단 사유 / 오류 코드 */}
                        {(log.blockReason || log.resultCode) && (
                          <div className="mt-1 flex items-center gap-1.5 text-sm text-gray-600">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            {log.blockReason && (
                              <span>차단: {log.blockReason}</span>
                            )}
                            {log.resultCode && !log.blockReason && (
                              <span>코드: {log.resultCode}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                이전
              </button>

              {/* 페이지 번호 (최대 5개) */}
              {(() => {
                const start = Math.max(1, page - 2);
                const end = Math.min(totalPages, start + 4);
                return Array.from({ length: end - start + 1 }, (_, i) => start + i).map(
                  (p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-9 h-9 text-sm rounded-lg font-medium transition-colors ${
                        page === p
                          ? "bg-gray-900 text-white"
                          : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {p}
                    </button>
                  )
                );
              })()}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                다음
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* ── 탭: 퍼널문자(회차발송) ───────────────────────────────────────── */}
      {activeTab === "funnel" && (
        <>
          {/* 요약 카드 (4-StatCard) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {funnelLoading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : (
              <>
                <StatCard
                  label="총 발송예약"
                  value={funnelSummary.total}
                  sub={`최근 ${days}일`}
                  icon={<Send className="w-4 h-4 text-blue-600" />}
                  colorClass="bg-blue-50"
                />
                <StatCard
                  label="성공"
                  value={funnelSummary.sent}
                  icon={<CheckCircle className="w-4 h-4 text-green-600" />}
                  colorClass="bg-green-50"
                />
                <StatCard
                  label="실패·차단"
                  value={funnelSummary.failed + funnelSummary.blocked}
                  sub="실패 + 차단 합계"
                  icon={<XCircle className="w-4 h-4 text-red-500" />}
                  colorClass="bg-red-50"
                />
                <StatCard
                  label="진행률"
                  value={`${
                    funnelSummary.total
                      ? Math.round((funnelSummary.sent / funnelSummary.total) * 100)
                      : 0
                  }%`}
                  sub="발송완료 / 전체예약"
                  icon={<TrendingUp className="w-4 h-4 text-indigo-600" />}
                  colorClass="bg-indigo-50"
                />
              </>
            )}
          </div>

          {/* 필터 바 */}
          <div className="flex flex-wrap gap-2 mb-4">
            {/* 기간 */}
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-600" />
              <select
                value={days}
                onChange={(e) => {
                  setFunnelPage(1);
                  setDays(Number(e.target.value));
                }}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DAYS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    최근 {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 퍼널문자 드롭다운 */}
            <div className="flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-gray-600" />
              <select
                value={funnelSmsId}
                onChange={(e) =>
                  applyFunnelFilter("funnelSmsId", e.target.value)
                }
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px]"
              >
                <option value="">전체 자동문자</option>
                {funnelOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title}
                  </option>
                ))}
              </select>
            </div>

            {/* 회차 필터 */}
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-gray-600">회차</span>
              <select
                value={funnelRound}
                onChange={(e) => applyFunnelFilter("round", e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">전체 회차</option>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((r) => (
                  <option key={r} value={String(r)}>
                    {roundLabel(r)}
                  </option>
                ))}
              </select>
            </div>

            {/* 상태 필터 */}
            <div className="flex gap-1.5 flex-wrap">
              {FUNNEL_STATUS_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => applyFunnelFilter("status", opt.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    funnelStatus === opt.value
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 그룹 필터 (수동 입력 — 그룹 ID 딥링크 지원) */}
          {funnelGroupId && (
            <div className="flex items-center gap-2 mb-4 text-sm">
              <Users className="w-3.5 h-3.5 text-gray-600" />
              <span className="text-gray-600">
                그룹 필터: <span className="font-medium text-gray-800">{funnelGroupId}</span>
              </span>
              <button
                onClick={() => applyFunnelFilter("groupId", "")}
                className="text-blue-600 hover:underline"
              >
                해제
              </button>
            </div>
          )}

          {/* 에러 */}
          {funnelError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {funnelError}
            </div>
          )}

          {/* 총 건수 */}
          {!funnelLoading && (
            <p className="text-sm text-gray-500 mb-3">
              총{" "}
              <span className="font-semibold text-gray-700">
                {funnelTotalCount.toLocaleString()}
              </span>
              건 중{" "}
              <span className="font-semibold text-gray-700">
                {funnelRows.length}
              </span>
              건 표시
            </p>
          )}

          {/* 목록 */}
          {funnelLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          ) : funnelRows.length === 0 ? (
            <div className="text-center py-16 text-gray-600">
              <Send className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">회차 발송 기록이 없습니다.</p>
              <p className="text-sm mt-1">
                그룹에 자동문자를 연결하면 신청일 기준으로 자동 예약됩니다.
              </p>
            </div>
          ) : (
            <>
              {/* 데스크톱: 표 */}
              <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left py-2.5 px-3 text-gray-500 font-medium">고객명</th>
                        <th className="text-left py-2.5 px-3 text-gray-500 font-medium">수신번호</th>
                        <th className="text-left py-2.5 px-3 text-gray-500 font-medium">DB 유입일</th>
                        <th className="text-left py-2.5 px-3 text-gray-500 font-medium">회차</th>
                        <th className="text-left py-2.5 px-3 text-gray-500 font-medium">발송 예정일시</th>
                        <th className="text-left py-2.5 px-3 text-gray-500 font-medium">성공여부</th>
                        <th className="text-left py-2.5 px-3 text-gray-500 font-medium">실제 발송일시</th>
                      </tr>
                    </thead>
                    <tbody>
                      {funnelRows.map((row, idx) => {
                        const info = FUNNEL_STATUS_INFO[row.status];
                        return (
                          <tr
                            key={`${row.contactId ?? "no-contact"}:${row.round ?? "no-round"}:${row.scheduledAt}:${idx}`}
                            className="border-b border-gray-50 hover:bg-gray-50 last:border-0"
                          >
                            <td className="py-2.5 px-3 text-gray-800 font-medium whitespace-nowrap">
                              {row.name || "(이름 없음)"}
                            </td>
                            <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap tabular-nums">
                              {row.phone}
                            </td>
                            <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap tabular-nums">
                              {formatDateOnly(row.addedAt)}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className="text-sm bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                {roundLabel(row.round)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap tabular-nums">
                              {formatDate(row.scheduledAt)}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 text-sm font-medium px-2 py-0.5 rounded-full ${info.color}`}
                              >
                                {info.icon}
                                {info.label}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap tabular-nums">
                              {row.sentAt ? formatDate(row.sentAt) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 모바일: 카드 레이아웃 */}
              <div className="md:hidden space-y-2">
                {funnelRows.map((row, idx) => {
                  const info = FUNNEL_STATUS_INFO[row.status];
                  return (
                    <div
                      key={`${row.contactId ?? "no-contact"}:${row.round ?? "no-round"}:${row.scheduledAt}:${idx}`}
                      className="bg-white border border-gray-200 rounded-xl p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-800">
                          {row.name || "(이름 없음)"}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-sm font-medium px-2 py-0.5 rounded-full ${info.color}`}
                        >
                          {info.icon}
                          {info.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="flex items-center gap-1 text-sm text-gray-500">
                          <Phone className="w-3 h-3" />
                          {row.phone}
                        </span>
                        <span className="text-sm bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                          {roundLabel(row.round)}
                        </span>
                      </div>
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                        <dt className="text-gray-500">DB 유입일</dt>
                        <dd className="text-gray-700 text-right tabular-nums">
                          {formatDateOnly(row.addedAt)}
                        </dd>
                        <dt className="text-gray-500">발송 예정</dt>
                        <dd className="text-gray-700 text-right tabular-nums">
                          {formatDate(row.scheduledAt)}
                        </dd>
                        <dt className="text-gray-500">실제 발송</dt>
                        <dd className="text-gray-700 text-right tabular-nums">
                          {row.sentAt ? formatDate(row.sentAt) : "—"}
                        </dd>
                      </dl>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* 페이지네이션 */}
          {funnelTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setFunnelPage((p) => Math.max(1, p - 1))}
                disabled={funnelPage === 1}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                이전
              </button>

              {(() => {
                const start = Math.max(1, funnelPage - 2);
                const end = Math.min(funnelTotalPages, start + 4);
                return Array.from(
                  { length: end - start + 1 },
                  (_, i) => start + i
                ).map((p) => (
                  <button
                    key={p}
                    onClick={() => setFunnelPage(p)}
                    className={`w-9 h-9 text-sm rounded-lg font-medium transition-colors ${
                      funnelPage === p
                        ? "bg-gray-900 text-white"
                        : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {p}
                  </button>
                ));
              })()}

              <button
                onClick={() =>
                  setFunnelPage((p) => Math.min(funnelTotalPages, p + 1))
                }
                disabled={funnelPage === funnelTotalPages}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                다음
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* ── 탭 2: 통계 분석 ─────────────────────────────────────────────── */}
      {activeTab === "stats" && (
        <div className="space-y-6">
          {/* 기간 선택 */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-600" />
            <span className="text-sm text-gray-500">분석 기간:</span>
            <div className="flex gap-1.5">
              {DAYS_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => {
                    setDays(o.value);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    days === o.value
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {statsError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {statsError}
            </div>
          )}

          {statsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : !stats ? (
            <div className="text-center py-16 text-gray-600">
              <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">통계 데이터가 없습니다.</p>
            </div>
          ) : (
            <>
              {/* 핵심 지표 카드 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                  label="전체 발송"
                  value={stats.total}
                  sub={`최근 ${days}일`}
                  icon={<MessageSquare className="w-4 h-4 text-blue-600" />}
                  colorClass="bg-blue-50"
                />
                <StatCard
                  label="성공률"
                  value={`${stats.successRate}%`}
                  sub={`성공 ${stats.sent.toLocaleString()}건`}
                  icon={<CheckCircle className="w-4 h-4 text-green-600" />}
                  colorClass="bg-green-50"
                />
                <StatCard
                  label="실패"
                  value={stats.failed}
                  icon={<XCircle className="w-4 h-4 text-red-500" />}
                  colorClass="bg-red-50"
                />
                <StatCard
                  label="차단됨"
                  value={stats.blocked}
                  icon={<Ban className="w-4 h-4 text-orange-500" />}
                  colorClass="bg-orange-50"
                />
              </div>

              {/* 채널별 발송량 */}
              {Object.keys(stats.byChannel).length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <h2 className="text-sm font-semibold text-gray-700 mb-3">
                    채널별 발송량
                  </h2>
                  <div className="space-y-2">
                    {Object.entries(stats.byChannel)
                      .sort(([, a], [, b]) => b - a)
                      .map(([ch, count]) => {
                        const pct =
                          stats.total > 0
                            ? Math.round((count / stats.total) * 100)
                            : 0;
                        return (
                          <div key={ch} className="flex items-center gap-3">
                            <span className="w-16 text-sm text-gray-600 shrink-0">
                              {channelLabel(ch)}
                            </span>
                            <div className="flex-1 bg-gray-100 rounded-full h-2">
                              <div
                                className="bg-blue-500 h-2 rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-20 text-sm text-gray-500 text-right tabular-nums">
                              {count.toLocaleString()}건 ({pct}%)
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* 차단 사유 TOP 5 */}
              {stats.blockReasons.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <h2 className="text-sm font-semibold text-gray-700 mb-3">
                    차단 사유 TOP 5
                  </h2>
                  <div className="space-y-2">
                    {stats.blockReasons.map((br, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between"
                      >
                        <span className="text-sm text-gray-600">
                          {idx + 1}. {br.reason}
                        </span>
                        <span className="text-sm font-medium tabular-nums text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                          {br.count.toLocaleString()}건
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 일별 추이 (텍스트 테이블 — 외부 차트 라이브러리 미사용) */}
              {stats.daily.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <h2 className="text-sm font-semibold text-gray-700 mb-3">
                    일별 발송 추이
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 pr-3 text-gray-500 font-medium">
                            날짜
                          </th>
                          <th className="text-right py-2 px-3 text-green-600 font-medium">
                            성공
                          </th>
                          <th className="text-right py-2 px-3 text-red-500 font-medium">
                            실패
                          </th>
                          <th className="text-right py-2 pl-3 text-orange-500 font-medium">
                            차단
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.daily
                          .slice()
                          .reverse()
                          .slice(0, 14)
                          .map((d) => (
                            <tr
                              key={d.date}
                              className="border-b border-gray-50 hover:bg-gray-50"
                            >
                              <td className="py-2 pr-3 text-gray-600">
                                {d.date}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums text-green-600">
                                {d.sent.toLocaleString()}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums text-red-500">
                                {d.failed > 0 ? d.failed.toLocaleString() : "—"}
                              </td>
                              <td className="py-2 pl-3 text-right tabular-nums text-orange-500">
                                {d.blocked > 0 ? d.blocked.toLocaleString() : "—"}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── 탭 3: A/B 테스트 ─────────────────────────────────────────────── */}
      {activeTab === "abtest" && (
        <div>
          {orgId ? (
            <ABTestDashboard orgId={orgId} />
          ) : (
            <div className="text-center py-16 text-gray-600">
              <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">조직 정보를 불러오는 중입니다...</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
