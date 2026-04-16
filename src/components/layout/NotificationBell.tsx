"use client";
import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { logger } from "@/lib/logger";

type Lead = {
  id: string;
  name: string;
  phone: string;
  landingPageTitle: string;
  createdAt: string;
  funnelStarted: boolean;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const since = localStorage.getItem("mabiz_notification_since") ?? "";
      const url = since
        ? `/api/notifications/leads?since=${encodeURIComponent(since)}`
        : "/api/notifications/leads";
      const res = await fetch(url);
      const d = (await res.json()) as { ok: boolean; leads?: Lead[] };
      if (d.ok) setLeads(d.leads ?? []);
    } catch (err) {
      logger.log("[NotificationBell] fetchLeads 실패", { err });
    } finally {
      setLoading(false);
    }
  };

  // 마운트 시 + 30초마다 폴링 (백그라운드 탭에서는 중단)
  useEffect(() => {
    fetchLeads();

    let interval: ReturnType<typeof setInterval> | null = setInterval(fetchLeads, 30_000);

    const handleVisibility = () => {
      if (document.hidden) {
        if (interval) { clearInterval(interval); interval = null; }
      } else {
        fetchLeads(); // 탭 복귀 시 즉시 갱신
        interval = setInterval(fetchLeads, 30_000);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllRead = () => {
    localStorage.setItem("mabiz_notification_since", new Date().toISOString());
    setLeads([]);
    setOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) fetchLeads();
        }}
        className="relative p-2 rounded-lg hover:bg-navy-700 transition-colors"
        aria-label="알림"
      >
        <Bell className="w-5 h-5 text-gray-300" />
        {leads.length > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold leading-none">
            {leads.length > 9 ? "9+" : leads.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white rounded-xl shadow-xl border z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
            <span className="text-sm font-semibold text-gray-700">
              신규 DB 알림
            </span>
            {leads.length > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-blue-600 hover:underline"
              >
                모두 확인
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {loading && (
              <div className="p-4 text-xs text-gray-400 text-center">
                불러오는 중...
              </div>
            )}
            {!loading && leads.length === 0 && (
              <div className="p-4 text-xs text-gray-400 text-center">
                새 알림이 없습니다
              </div>
            )}
            {!loading &&
              leads.map((lead) => (
                <div
                  key={lead.id}
                  className="px-4 py-3 border-b last:border-0 hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800">
                      {lead.name}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(lead.createdAt).toLocaleDateString("ko-KR", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {lead.phone} · {lead.landingPageTitle}
                  </div>
                  {lead.funnelStarted && (
                    <span className="text-xs text-green-600 font-medium">
                      퍼널 자동 시작
                    </span>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
