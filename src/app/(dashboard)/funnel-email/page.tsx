"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Mail, Users, CheckCircle, XCircle, Clock } from "lucide-react";
import { showError } from "@/components/ui/Toast";
import { logger } from "@/lib/logger";

interface FunnelEmailListItem {
  id: string;
  title: string;
  description?: string | null;
  senderName?: string | null;
  senderEmail?: string | null;
  sendHour: number;
  sendMinute: number;
  isActive: boolean;
  createdAt: string;
  _count: { messages: number };
  groups: Array<{ id: string; name: string }>;
}

function formatSendTime(hour: number, minute: string | number): string {
  const h = Number(hour);
  const m = Number(minute);
  const ampm = h < 12 ? "오전" : "오후";
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const displayM = String(m).padStart(2, "0");
  return `${ampm} ${displayH}시 ${displayM}분`;
}

export default function FunnelEmailPage() {
  const router = useRouter();

  const [list, setList] = useState<FunnelEmailListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const loadList = useCallback(async () => {
    setLoading(true);
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 10_000);
    try {
      const res = await fetch("/api/funnel-email?limit=100", { signal: ac.signal });
      const d = await res.json() as {
        ok: boolean;
        data?: FunnelEmailListItem[];
        total?: number;
        message?: string;
      };
      if (d.ok && d.data) {
        setList(d.data);
        setTotal(d.total ?? d.data.length);
      } else {
        showError(d.message ?? "목록을 불러오지 못했습니다.");
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        logger.error("[FunnelEmailPage] loadList", { err });
        showError("목록을 불러오지 못했습니다.");
      }
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="w-6 h-6 text-blue-600" />
            자동이메일
          </h1>
          <p className="text-base text-gray-500 mt-1">
            고객이 신청하면 자동으로 이메일이 발송됩니다.
          </p>
        </div>
        <button
          onClick={() => router.push("/funnel-email/new")}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg text-base font-medium hover:bg-blue-700 transition-colors min-h-[48px]"
        >
          <Plus className="w-5 h-5" />
          새 자동이메일 만들기
        </button>
      </div>

      {/* 총 개수 */}
      {!loading && (
        <p className="text-sm text-gray-500 mb-4">총 {total.toLocaleString()}개</p>
      )}

      {/* 목록 */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Mail className="w-12 h-12 text-gray-300 mb-4" />
          <p className="text-lg font-medium text-gray-600 mb-2">
            아직 자동이메일이 없습니다.
          </p>
          <p className="text-base text-gray-400 mb-6">
            새로 만들어보세요.
          </p>
          <button
            onClick={() => router.push("/funnel-email/new")}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-lg text-base font-medium hover:bg-blue-700 transition-colors min-h-[48px]"
          >
            <Plus className="w-5 h-5" />
            새 자동이메일 만들기
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((item) => (
            <div
              key={item.id}
              onClick={() => router.push(`/funnel-email/${item.id}`)}
              className="bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-gray-900 truncate">
                      {item.title}
                    </p>
                    {item.description && (
                      <p className="text-sm text-gray-500 truncate mt-0.5">
                        {item.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <span className="flex items-center gap-1 text-sm text-gray-500">
                        <Mail className="w-4 h-4" />
                        이메일 {item._count.messages}개
                      </span>
                      {item.groups.length > 0 && (
                        <span className="flex items-center gap-1 text-sm text-gray-500">
                          <Users className="w-4 h-4" />
                          {item.groups.length}개 그룹 연결
                        </span>
                      )}
                      {item.senderEmail && (
                        <span className="text-sm text-gray-400 truncate max-w-[200px]">
                          {item.senderEmail}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-sm text-gray-400">
                        <Clock className="w-3.5 h-3.5" />
                        {formatSendTime(item.sendHour, item.sendMinute)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="shrink-0">
                  {item.isActive ? (
                    <span className="flex items-center gap-1 text-sm font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                      <CheckCircle className="w-3.5 h-3.5" />
                      활성
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-sm font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                      <XCircle className="w-3.5 h-3.5" />
                      비활성
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
