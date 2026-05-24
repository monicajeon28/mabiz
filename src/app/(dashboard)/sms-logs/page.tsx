"use client";

import { useEffect, useState } from "react";

interface SmsLog {
  id: string;
  phone: string;
  contentPreview: string | null;
  status: string;
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

interface ApiResponse {
  ok: boolean;
  logs: SmsLog[];
  summary: Summary;
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  message?: string;
}

const STATUS_LABEL: Record<string, string> = {
  SENT: "성공",
  FAILED: "실패",
  BLOCKED: "차단",
};

const STATUS_CLASS: Record<string, string> = {
  SENT: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  BLOCKED: "bg-yellow-100 text-yellow-700",
};

const CHANNEL_LABEL: Record<string, string> = {
  FUNNEL: "퍼널",
  GROUP: "그룹",
  MANUAL: "수동",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${M}-${D} ${h}:${m}`;
}

type Stats = {
  total: number; sent: number; failed: number; blocked: number; successRate: number;
  byChannel: Record<string, number>;
  blockReasons: { reason: string; count: number }[];
  daily: { date: string; sent: number; failed: number; blocked: number }[];
};

export default function SmsLogsPage() {
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [statusFilter, setStatusFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{ total: number; totalPages: number; pageSize: number }>({ total: 0, totalPages: 0, pageSize: 50 });

  useEffect(() => {
    const params = new URLSearchParams({ days: String(days), take: "50", page: String(page) });
    if (statusFilter) params.set("status", statusFilter);
    if (channelFilter) params.set("channel", channelFilter);

    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/sms-logs?${params.toString()}`).then((r) => r.json() as Promise<ApiResponse>),
      fetch(`/api/sms-logs/stats?days=${days}`).then((r) => r.json()),
    ]).then(([logData, statsData]) => {
      if (!logData.ok) { setError(logData.message ?? "데이터 로드 실패"); return; }
      setLogs(logData.logs);
      setSummary(logData.summary);
      if (logData.total && logData.totalPages && logData.pageSize) {
        setPagination({ total: logData.total, totalPages: logData.totalPages, pageSize: logData.pageSize });
      }
      if (statsData.ok) setStats(statsData.stats);
    }).catch(() => {
      setError("네트워크 오류가 발생했습니다.");
    }).finally(() => setLoading(false));
  }, [days, statusFilter, channelFilter, page]);

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">SMS 발송 기록</h1>
        <p className="text-sm text-gray-500 mt-1">최근 발송된 문자 메시지 내역입니다.</p>
      </div>

      {/* 통계 대시보드 */}
      {stats && (
        <div className="space-y-4">
          {/* 요약 카드 5개 */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white border rounded-lg p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">전체</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total.toLocaleString()}</p>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">성공</p>
              <p className="text-2xl font-bold text-green-600">{stats.sent.toLocaleString()}</p>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">실패</p>
              <p className="text-2xl font-bold text-red-600">{stats.failed.toLocaleString()}</p>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">차단</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.blocked.toLocaleString()}</p>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">성공률</p>
              <p className="text-2xl font-bold text-blue-600">{stats.successRate}%</p>
            </div>
          </div>

          {/* 채널별 + 차단 사유 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 채널별 발송 */}
            <div className="bg-white border rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-3">채널별 발송</p>
              <div className="space-y-2">
                {Object.entries(stats.byChannel).map(([ch, cnt]) => {
                  const pct = stats.total > 0 ? Math.round((cnt / stats.total) * 100) : 0;
                  return (
                    <div key={ch} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-600 w-12">{CHANNEL_LABEL[ch] ?? ch}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                        <div className="bg-blue-500 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-16 text-right">{cnt.toLocaleString()} ({pct}%)</span>
                    </div>
                  );
                })}
                {Object.keys(stats.byChannel).length === 0 && (
                  <p className="text-xs text-gray-400">데이터 없음</p>
                )}
              </div>
            </div>

            {/* 차단 사유 TOP */}
            <div className="bg-white border rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-3">차단 사유</p>
              <div className="space-y-2">
                {stats.blockReasons.map((r) => (
                  <div key={r.reason} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      {r.reason === "OPT_OUT" ? "수신거부" : r.reason === "NIGHT_BLOCK" ? "야간차단" : r.reason}
                    </span>
                    <span className="text-sm font-semibold text-yellow-600">{r.count}건</span>
                  </div>
                ))}
                {stats.blockReasons.length === 0 && (
                  <p className="text-xs text-gray-400">차단 건 없음</p>
                )}
              </div>
            </div>
          </div>

          {/* 일별 추이 (텍스트 기반 — 간단한 바 차트) */}
          {stats.daily.length > 0 && (
            <div className="bg-white border rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-3">일별 발송 추이 (최근 {days}일)</p>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {stats.daily.slice(-14).map((d) => {
                  const dayTotal = d.sent + d.failed + d.blocked;
                  const maxVal = Math.max(...stats.daily.slice(-14).map((x) => x.sent + x.failed + x.blocked), 1);
                  const pct = Math.round((dayTotal / maxVal) * 100);
                  return (
                    <div key={d.date} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-20 shrink-0">{d.date.slice(5)}</span>
                      <div className="flex-1 flex h-4 rounded overflow-hidden bg-gray-100">
                        <div className="bg-green-400" style={{ width: `${dayTotal > 0 ? (d.sent / maxVal) * 100 : 0}%` }} />
                        <div className="bg-red-400" style={{ width: `${dayTotal > 0 ? (d.failed / maxVal) * 100 : 0}%` }} />
                        <div className="bg-yellow-400" style={{ width: `${dayTotal > 0 ? (d.blocked / maxVal) * 100 : 0}%` }} />
                      </div>
                      <span className="text-xs text-gray-400 w-10 text-right">{dayTotal}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-4 mt-2 text-xs text-gray-400">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-400 rounded" />성공</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-400 rounded" />실패</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-400 rounded" />차단</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 필터 */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label htmlFor="days-filter" className="text-sm text-gray-600 whitespace-nowrap">기간</label>
          <select
            id="days-filter"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="border rounded-md px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={7}>최근 7일</option>
            <option value={14}>최근 14일</option>
            <option value={30}>최근 30일</option>
            <option value={60}>최근 60일</option>
            <option value={90}>최근 90일</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="status-filter" className="text-sm text-gray-600 whitespace-nowrap">상태</label>
          <select id="status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">전체</option>
            <option value="SENT">성공</option>
            <option value="FAILED">실패</option>
            <option value="BLOCKED">차단</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="channel-filter" className="text-sm text-gray-600 whitespace-nowrap">채널</label>
          <select id="channel-filter" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">전체</option>
            <option value="FUNNEL">퍼널</option>
            <option value="GROUP">그룹</option>
            <option value="MANUAL">수동</option>
          </select>
        </div>
      </div>

      {/* 상태 */}
      {loading && (
        <div className="flex justify-center items-center py-16 text-gray-400 text-sm" aria-live="polite" aria-busy="true">
          불러오는 중...
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* 테이블 */}
      {!loading && !error && (
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-600">
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap">발송일시</th>
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap">수신번호</th>
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap">채널</th>
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap">상태</th>
                  <th className="px-4 py-3 text-left font-medium">메시지 미리보기</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                      발송 기록이 없습니다.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {formatDate(log.sentAt)}
                      </td>
                      <td className="px-4 py-3 text-gray-800 whitespace-nowrap font-mono text-xs">
                        {log.phone}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                          {CHANNEL_LABEL[log.channel] ?? log.channel}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              STATUS_CLASS[log.status] ?? "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {STATUS_LABEL[log.status] ?? log.status}
                          </span>
                          {log.status === "SENT" && <span className="text-xs text-green-600">✓</span>}
                          {log.status === "FAILED" && <span className="text-xs text-red-600">✕</span>}
                          {log.status === "BLOCKED" && <span className="text-xs text-yellow-600">⊘</span>}
                        </div>
                        {log.blockReason && (
                          <span className="ml-1 text-xs text-gray-400">({log.blockReason})</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-xs">
                        <p className="truncate">
                          {log.contentPreview ?? <span className="text-gray-300 italic">미리보기 없음</span>}
                        </p>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {logs.length > 0 && (
            <div className="px-4 py-4 border-t bg-gray-50 flex items-center justify-between text-sm">
              <span className="text-gray-600">
                총 {pagination.total.toLocaleString()}건 중 {((page - 1) * pagination.pageSize + 1).toLocaleString()}-{Math.min(page * pagination.pageSize, pagination.total).toLocaleString()}건 표시
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 border rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  ← 이전
                </button>
                <span className="text-xs text-gray-500 px-2">
                  {page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(p + 1, pagination.totalPages))}
                  disabled={page === pagination.totalPages}
                  className="px-3 py-1.5 border rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  다음 →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
