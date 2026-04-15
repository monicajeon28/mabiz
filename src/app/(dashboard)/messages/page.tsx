"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageSquare, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

type SmsLog = {
  id: string;
  phone: string;
  contentPreview: string | null;
  status: string;
  blockReason: string | null;
  resultCode: string | null;
  channel: string;
  sentAt: string;
};

type Summary = {
  total: number;
  sent: number;
  failed: number;
  blocked: number;
};

type DaysOption = 7 | 30 | 90;
type ChannelFilter = "" | "FUNNEL" | "GROUP" | "MANUAL";
type StatusFilter = "" | "SENT" | "FAILED" | "BLOCKED";

const CHANNEL_LABELS: Record<string, string> = {
  FUNNEL: "퍼널",
  GROUP: "그룹",
  MANUAL: "수동",
};

const CHANNEL_COLORS: Record<string, string> = {
  FUNNEL:  "bg-purple-100 text-purple-700",
  GROUP:   "bg-blue-100 text-blue-700",
  MANUAL:  "bg-gray-100 text-gray-700",
};

const STATUS_LABELS: Record<string, string> = {
  SENT:    "성공",
  FAILED:  "실패",
  BLOCKED: "차단",
};

const STATUS_COLORS: Record<string, string> = {
  SENT:    "bg-green-100 text-green-700",
  FAILED:  "bg-red-100 text-red-700",
  BLOCKED: "bg-yellow-100 text-yellow-700",
};

export default function MessagesPage() {
  const [logs, setLogs]         = useState<SmsLog[]>([]);
  const [summary, setSummary]   = useState<Summary | null>(null);
  const [loading, setLoading]   = useState(true);

  const [days, setDays]         = useState<DaysOption>(30);
  const [channel, setChannel]   = useState<ChannelFilter>("");
  const [status, setStatus]     = useState<StatusFilter>("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ days: String(days), take: "50" });
      if (status) params.set("status", status);

      const res  = await fetch(`/api/sms-logs?${params}`);
      const data = await res.json() as { ok: boolean; logs: SmsLog[]; summary: Summary };
      if (data.ok) {
        setLogs(data.logs);
        setSummary(data.summary);
      }
    } finally {
      setLoading(false);
    }
  }, [days, status]);

  useEffect(() => { load(); }, [load]);

  // 채널 필터는 클라이언트 사이드 적용 (API가 channel 파라미터 미지원)
  const filtered = channel ? logs.filter(l => l.channel === channel) : logs;

  const successRate = summary && summary.total > 0
    ? Math.round((summary.sent / summary.total) * 100)
    : null;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-navy-900">발송 내역</h1>
        <p className="text-sm text-gray-500 mt-0.5">SMS 발송 현황 대시보드</p>
      </div>

      {/* 요약 카드 3개 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {/* 총 발송 */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-navy-600" />
            <span className="text-xs text-gray-500 font-medium">총 발송</span>
          </div>
          <p className="text-2xl font-bold text-navy-900">
            {loading ? "—" : (summary?.total ?? 0).toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">최근 {days}일</p>
        </div>

        {/* 성공률 */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-xs text-gray-500 font-medium">성공률</span>
          </div>
          <p className={`text-2xl font-bold ${
            successRate === null ? "text-gray-300"
            : successRate >= 90   ? "text-green-600"
            : successRate >= 70   ? "text-yellow-600"
            : "text-red-600"
          }`}>
            {loading ? "—" : successRate !== null ? `${successRate}%` : "—"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {loading ? "" : `성공 ${(summary?.sent ?? 0).toLocaleString()}건`}
          </p>
        </div>

        {/* 차단/실패 */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-xs text-gray-500 font-medium">차단 / 실패</span>
          </div>
          <p className="text-2xl font-bold text-red-600">
            {loading ? "—" : ((summary?.blocked ?? 0) + (summary?.failed ?? 0)).toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {loading ? "" : `차단 ${summary?.blocked ?? 0} · 실패 ${summary?.failed ?? 0}`}
          </p>
        </div>
      </div>

      {/* 필터 바 */}
      <div className="flex flex-wrap gap-3 mb-4">
        {/* 기간 */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {([7, 30, 90] as DaysOption[]).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                days === d
                  ? "bg-white text-navy-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {d}일
            </button>
          ))}
        </div>

        {/* 채널 */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {([
            { value: "" as ChannelFilter, label: "전체 채널" },
            { value: "FUNNEL" as ChannelFilter, label: "퍼널" },
            { value: "GROUP" as ChannelFilter, label: "그룹" },
            { value: "MANUAL" as ChannelFilter, label: "수동" },
          ]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setChannel(opt.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                channel === opt.value
                  ? "bg-white text-navy-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 상태 */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {([
            { value: "" as StatusFilter, label: "전체 상태" },
            { value: "SENT" as StatusFilter, label: "성공" },
            { value: "FAILED" as StatusFilter, label: "실패" },
            { value: "BLOCKED" as StatusFilter, label: "차단" },
          ]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatus(opt.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                status === opt.value
                  ? "bg-white text-navy-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="space-y-0">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 bg-gray-50 border-b border-gray-100 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <AlertTriangle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-medium text-gray-600">발송 내역이 없습니다</p>
            <p className="text-sm text-gray-400 mt-1">기간 또는 필터를 변경해보세요</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">발송 일시</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">수신 번호</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">내용 미리보기</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">채널</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {formatDate(log.sentAt)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-mono text-xs">
                      {log.phone}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs">
                      <span className="truncate block" title={log.contentPreview ?? ""}>
                        {log.contentPreview ?? <span className="text-gray-300">—</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        CHANNEL_COLORS[log.channel] ?? "bg-gray-100 text-gray-600"
                      }`}>
                        {CHANNEL_LABELS[log.channel] ?? log.channel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        STATUS_COLORS[log.status] ?? "bg-gray-100 text-gray-600"
                      }`}>
                        {STATUS_LABELS[log.status] ?? log.status}
                      </span>
                      {log.blockReason && (
                        <p className="text-xs text-yellow-600 mt-0.5">{log.blockReason}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 text-xs text-gray-400 border-t border-gray-100">
              {filtered.length}건 표시 (최대 50건)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
