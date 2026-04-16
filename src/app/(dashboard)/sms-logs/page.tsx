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

export default function SmsLogsPage() {
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    const params = new URLSearchParams({ days: String(days), take: "50" });
    if (statusFilter) params.set("status", statusFilter);

    setLoading(true);
    setError(null);

    fetch(`/api/sms-logs?${params.toString()}`)
      .then((res) => res.json() as Promise<ApiResponse>)
      .then((data) => {
        if (!data.ok) {
          setError(data.message ?? "데이터를 불러오는 데 실패했습니다.");
          return;
        }
        setLogs(data.logs);
        setSummary(data.summary);
      })
      .catch(() => {
        setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      })
      .finally(() => setLoading(false));
  }, [days, statusFilter]);

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">SMS 발송 기록</h1>
        <p className="text-sm text-gray-500 mt-1">최근 발송된 문자 메시지 내역입니다.</p>
      </div>

      {/* 요약 카드 */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white border rounded-lg p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">전체</p>
            <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
          </div>
          <div className="bg-white border rounded-lg p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">성공</p>
            <p className="text-2xl font-bold text-green-600">{summary.sent}</p>
          </div>
          <div className="bg-white border rounded-lg p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">실패</p>
            <p className="text-2xl font-bold text-red-600">{summary.failed}</p>
          </div>
          <div className="bg-white border rounded-lg p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">차단</p>
            <p className="text-2xl font-bold text-yellow-600">{summary.blocked}</p>
          </div>
        </div>
      )}

      {/* 필터 */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 whitespace-nowrap">기간</label>
          <select
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
          <label className="text-sm text-gray-600 whitespace-nowrap">상태</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">전체</option>
            <option value="SENT">성공</option>
            <option value="FAILED">실패</option>
            <option value="BLOCKED">차단</option>
          </select>
        </div>
      </div>

      {/* 상태 */}
      {loading && (
        <div className="flex justify-center items-center py-16 text-gray-400 text-sm">
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
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            STATUS_CLASS[log.status] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {STATUS_LABEL[log.status] ?? log.status}
                        </span>
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
            <div className="px-4 py-3 border-t bg-gray-50 text-xs text-gray-400 text-right">
              총 {summary?.total ?? logs.length}건 중 {logs.length}건 표시
            </div>
          )}
        </div>
      )}
    </div>
  );
}
