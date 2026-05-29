"use client";

import { useState, useEffect, useRef } from "react";
import { AlarmClock, X, CheckCircle, Clock, XCircle, Pause, Play, RotateCcw } from "lucide-react";

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
  PENDING:       { label: "예약됨",     icon: <Clock       className="w-3.5 h-3.5" />, color: "bg-blue-100 text-blue-700" },
  SENDING:       { label: "발송 중",    icon: <Clock       className="w-3.5 h-3.5" />, color: "bg-yellow-100 text-yellow-700" },
  SENT:          { label: "발송 완료",  icon: <CheckCircle className="w-3.5 h-3.5" />, color: "bg-green-100 text-green-700" },
  FAILED:        { label: "실패",       icon: <XCircle     className="w-3.5 h-3.5" />, color: "bg-red-100 text-red-700" },
  CANCELLED:     { label: "취소됨",     icon: <X           className="w-3.5 h-3.5" />, color: "bg-gray-100 text-gray-500" },
  PAUSED:        { label: "일시정지",   icon: <Pause       className="w-3.5 h-3.5" />, color: "bg-orange-100 text-orange-700" },
  NIGHT_BLOCKED: { label: "야간 대기",  icon: <Clock       className="w-3.5 h-3.5" />, color: "bg-purple-100 text-purple-700" },
};

export default function ScheduledSmsPage() {
  const [list,      setList]      = useState<ScheduledItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [filter,    setFilter]    = useState("PENDING");
  const [cancelling, setCancelling] = useState<string | null>(null);
  // P1-13: CSRF 토큰 상태
  const [csrfToken, setCsrfToken] = useState("");
  // P1-14: filterRef — doAction 내 스테일 클로저 방지
  const filterRef = useRef(filter);

  // P1-13: CSRF 토큰 로드
  useEffect(() => {
    fetch("/api/csrf-token").then(r => r.json())
      .then(d => { if (d.ok && d.token) setCsrfToken(d.token); })
      .catch(() => { /* silently fail */ });
  }, []);

  // P1-14: filter 변경 시 filterRef 동기화
  useEffect(() => { filterRef.current = filter; }, [filter]);

  const load = async (status: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/scheduled-sms?status=${status}`);
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
      const data = await res.json();
      if (data.ok) setList(data.list);
      else throw new Error(data.message ?? "조회 실패");
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터를 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(filter); }, [filter]);

  const [actionError, setActionError] = useState<string | null>(null);

  const cancel = async (id: string) => {
    setCancelling(id);
    setActionError(null);
    try {
      // P1-13: CSRF 헤더 추가
      const res = await fetch(`/api/scheduled-sms?id=${id}`, {
        method: "DELETE",
        headers: {
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
      });
      const data = await res.json();
      if (data.ok) {
        if (filter === "") {
          setList((prev) => prev.map((item) => item.id === id ? { ...item, status: "CANCELLED" } : item));
        } else {
          setList((prev) => prev.filter((item) => item.id !== id));
        }
      } else {
        setActionError(data.message ?? "취소 실패");
      }
    } catch {
      setActionError("네트워크 오류가 발생했습니다.");
    } finally {
      setCancelling(null);
    }
  };

  const [acting, setActing] = useState<string | null>(null);

  const doAction = async (id: string, action: "pause" | "resume" | "retry") => {
    setActing(id);
    setActionError(null);
    try {
      // P1-13: CSRF 헤더 추가
      const res = await fetch("/api/scheduled-sms", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      // P1-14: filterRef.current 사용 — 스테일 클로저 방지
      if (data.ok) load(filterRef.current);
      else setActionError(data.message ?? "작업 실패");
    } catch {
      setActionError("네트워크 오류가 발생했습니다.");
    } finally {
      setActing(null);
    }
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
          onClick={() => setFilter("")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            filter === "" ? "bg-navy-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          전체
        </button>
      </div>

      {/* 에러 메시지 */}
      {(error || actionError) && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 mb-4 flex items-center justify-between gap-2">
          <span>{error || actionError}</span>
          <button onClick={() => { setError(null); setActionError(null); }} className="text-red-400 hover:text-red-600 shrink-0">✕</button>
        </div>
      )}

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

                  {/* 액션 버튼 */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* 일시정지 (PENDING/NIGHT_BLOCKED) */}
                    {(item.status === "PENDING" || item.status === "NIGHT_BLOCKED") && (
                      <button onClick={() => doAction(item.id, "pause")} disabled={acting === item.id}
                        className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors" title="일시정지">
                        <Pause className="w-4 h-4" />
                      </button>
                    )}
                    {/* 재개 (PAUSED) */}
                    {item.status === "PAUSED" && (
                      <button onClick={() => doAction(item.id, "resume")} disabled={acting === item.id}
                        className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-lg transition-colors" title="재개">
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    {/* 재발송 (FAILED) */}
                    {item.status === "FAILED" && (
                      <button onClick={() => doAction(item.id, "retry")} disabled={acting === item.id}
                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="재발송">
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                    {/* 취소 (PENDING/PAUSED/NIGHT_BLOCKED) */}
                    {(item.status === "PENDING" || item.status === "PAUSED" || item.status === "NIGHT_BLOCKED") && (
                      <button onClick={() => cancel(item.id)} disabled={cancelling === item.id || acting === item.id}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40" title="취소">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
