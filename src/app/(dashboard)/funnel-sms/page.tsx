"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, MessageSquare } from "lucide-react";
import { showSuccess, showError } from "@/components/ui/Toast";
import FunnelSmsList from "@/components/funnel-sms/FunnelSmsList";
import { logger } from "@/lib/logger";

interface FunnelSmsListItem {
  id: string;
  title: string;
  category?: string;
  sendHour: number;
  sendMinute: number;
  createdAt: Date;
  _count: { messages: number };
  groups: Array<{ id: string; name: string }>;
  sentCount?: number;
}

interface GroupOption {
  id: string;
  name: string;
}

const PAGE_SIZE = 100;

export default function FunnelSmsPage() {
  const router = useRouter();

  const [list, setList] = useState<FunnelSmsListItem[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [filter, setFilter] = useState({ groupId: "", q: "" });
  const [inputQ, setInputQ] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // 그룹 목록 fetch (필터 드롭다운용)
  useEffect(() => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 10_000);
    fetch("/api/groups?limit=100", { signal: ac.signal })
      .then((r) => r.json())
      .then((d: { ok: boolean; groups?: GroupOption[] }) => {
        if (d.ok && d.groups) setGroups(d.groups);
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") {
          logger.error("[FunnelSmsPage] groups fetch", { err });
        }
      })
      .finally(() => clearTimeout(timer));
    return () => ac.abort();
  }, []);

  const loadList = useCallback(
    async (currentPage: number, currentFilter: { groupId: string; q: string }) => {
      setLoading(true);
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 10_000);
      try {
        const params = new URLSearchParams({
          page: String(currentPage),
          pageSize: String(PAGE_SIZE),
        });
        if (currentFilter.groupId) params.set("groupId", currentFilter.groupId);
        if (currentFilter.q) params.set("q", currentFilter.q);

        const res = await fetch(`/api/funnel-sms?${params}`, { signal: ac.signal });
        const d = await res.json() as {
          ok: boolean;
          data?: FunnelSmsListItem[];
          total?: number;
          message?: string;
        };
        if (d.ok && d.data) {
          setList(d.data);
          setTotal(d.total ?? 0);
        } else {
          showError(d.message ?? "목록을 불러오지 못했습니다.");
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          logger.error("[FunnelSmsPage] loadList", { err });
          showError("목록을 불러오지 못했습니다.");
        }
      } finally {
        clearTimeout(timer);
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadList(page, filter);
  }, [page, filter, loadList]);

  const handleSearch = () => {
    setPage(0);
    setFilter((prev) => ({ ...prev, q: inputQ }));
  };

  const handleGroupFilter = (groupId: string) => {
    setPage(0);
    setFilter((prev) => ({ ...prev, groupId }));
  };

  const handleCopyUrl = (id: string, groupId: string) => {
    const url = `${window.location.origin}/landing-pages?groupId=${groupId}&funnelSmsId=${id}`;
    navigator.clipboard
      .writeText(url)
      .then(() => showSuccess("URL이 클립보드에 복사되었습니다."))
      .catch(() => showError("URL 복사에 실패했습니다."));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("퍼널문자를 삭제하시겠습니까? 연결된 그룹에서도 해제됩니다.")) return;
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 10_000);
      const res = await fetch(`/api/funnel-sms/${id}`, {
        method: "DELETE",
        signal: ac.signal,
      });
      clearTimeout(timer);
      const d = await res.json() as { ok: boolean; message?: string };
      if (d.ok) {
        showSuccess("퍼널문자가 삭제되었습니다.");
        loadList(page, filter);
      } else {
        showError(d.message ?? "삭제에 실패했습니다.");
      }
    } catch (err) {
      logger.error("[FunnelSmsPage] handleDelete", { err });
      showError("삭제 중 오류가 발생했습니다.");
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-blue-600" />
            퍼널문자 관리
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            그룹에 연결된 자동 SMS 시퀀스를 관리합니다.
          </p>
        </div>
        <button
          onClick={() => router.push("/funnel-sms/new")}
          className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          퍼널문자 만들기
        </button>
      </div>

      {/* 필터 행 */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* 그룹 필터 */}
        <select
          value={filter.groupId}
          onChange={(e) => handleGroupFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">전체 그룹</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>

        {/* 검색 */}
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <input
            type="text"
            value={inputQ}
            onChange={(e) => setInputQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="제목 또는 카테고리 검색"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSearch}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg text-sm text-gray-700 transition-colors"
          >
            검색
          </button>
        </div>

        {/* 결과 수 */}
        {!loading && (
          <span className="text-sm text-gray-500 ml-auto">
            총 {total.toLocaleString()}개
          </span>
        )}
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <FunnelSmsList
          items={list}
          onCopyUrl={handleCopyUrl}
          onDelete={handleDelete}
        />
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            이전
          </button>
          <span className="text-sm text-gray-600">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page + 1 >= totalPages}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
