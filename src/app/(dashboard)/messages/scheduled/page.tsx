"use client";

import { useState, useEffect } from "react";
import { AlarmClock, X, CheckCircle, Clock, XCircle } from "lucide-react";

type ScheduledItem = {
  id: string;
  contactId:  string | null;
  groupId:    string | null;
  message:    string;
  scheduledAt: string;
  status:     string;
  sentAt:     string | null;
  sentCount:  number;
  failedCount: number;
  createdAt:  string;
};

const STATUS_INFO: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  PENDING:   { label: "예약됨",   icon: <Clock      className="w-3.5 h-3.5" />, color: "bg-blue-100 text-blue-700" },
  SENDING:   { label: "발송 중",  icon: <Clock      className="w-3.5 h-3.5" />, color: "bg-yellow-100 text-yellow-700" },
  SENT:      { label: "발송 완료", icon: <CheckCircle className="w-3.5 h-3.5" />, color: "bg-green-100 text-green-700" },
  FAILED:    { label: "실패",     icon: <XCircle    className="w-3.5 h-3.5" />, color: "bg-red-100 text-red-700" },
  CANCELLED: { label: "취소됨",   icon: <X          className="w-3.5 h-3.5" />, color: "bg-gray-100 text-gray-500" },
};

export default function ScheduledSmsPage() {
  const [list,      setList]      = useState<ScheduledItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState("PENDING");
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = async (status: string) => {
    setLoading(true);
    const res = await fetch(`/api/scheduled-sms?status=${status}`);
    const data = await res.json();
    if (data.ok) setList(data.list);
    setLoading(false);
  };

  useEffect(() => { load(filter); }, [filter]);

  const cancel = async (id: string) => {
    setCancelling(id);
    const res = await fetch(`/api/scheduled-sms?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) setList((prev) => prev.filter((item) => item.id !== id));
    setCancelling(null);
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <AlarmClock className="w-6 h-6 text-orange-500" />
        <div>
          <h1 className="text-xl font-bold text-navy-900">예약 발송</h1>
          <p className="text-sm text-gray-500 mt-0.5">5분 주기로 자동 처리됩니다</p>
        </div>
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {Object.entries(STATUS_INFO).map(([key, info]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors ${
              filter === key
                ? "bg-navy-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {info.icon} {info.label}
          </button>
        ))}
        <button
          onClick={() => { setFilter(""); load(""); }}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            filter === "" ? "bg-navy-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          전체
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <AlarmClock className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">예약된 발송이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((item) => {
            const info = STATUS_INFO[item.status] ?? STATUS_INFO.PENDING;
            return (
              <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {/* 상태 + 예약 시각 */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${info.color}`}>
                        {info.icon} {info.label}
                      </span>
                      <span className="text-xs text-gray-500">
                        🕐 {new Date(item.scheduledAt).toLocaleString("ko-KR")}
                      </span>
                      {item.sentAt && (
                        <span className="text-xs text-gray-400">
                          · 발송: {new Date(item.sentAt).toLocaleString("ko-KR")}
                        </span>
                      )}
                    </div>

                    {/* 수신 대상 */}
                    <p className="text-xs text-gray-500 mb-1">
                      {item.contactId  ? "👤 개별 고객" : ""}
                      {item.groupId    ? "👥 그룹 전체" : ""}
                    </p>

                    {/* 메시지 미리보기 */}
                    <p className="text-sm text-gray-700 line-clamp-2">{item.message}</p>

                    {/* 발송 결과 */}
                    {(item.sentCount > 0 || item.failedCount > 0) && (
                      <p className="text-xs text-gray-400 mt-1">
                        ✅ {item.sentCount}건 성공
                        {item.failedCount > 0 && ` · ❌ ${item.failedCount}건 실패`}
                      </p>
                    )}
                  </div>

                  {/* 취소 버튼 (PENDING만) */}
                  {item.status === "PENDING" && (
                    <button
                      onClick={() => cancel(item.id)}
                      disabled={cancelling === item.id}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                      title="예약 취소"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
