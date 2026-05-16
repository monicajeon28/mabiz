"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Globe,
  Copy,
  Trash2,
  FileText,
  Eye,
  Users,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────
type B2BPage = {
  id: string;
  partnerId: string | null;
  title: string;
  slug: string;
  isActive: boolean;
  viewCount: number;
  editorMode: string;
  paymentEnabled: boolean;
  commentEnabled: boolean;
  registrationCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
};

type Partner = {
  id: string;
  name: string | null;
};

// ─── Skeleton Card ─────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-gray-200" />
          <div>
            <div className="h-5 w-40 bg-gray-200 rounded mb-2" />
            <div className="h-3.5 w-52 bg-gray-100 rounded" />
          </div>
        </div>
        <div className="h-6 w-16 bg-gray-100 rounded-full" />
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="h-16 bg-gray-50 rounded-lg" />
        <div className="h-16 bg-gray-50 rounded-lg" />
        <div className="h-16 bg-gray-50 rounded-lg" />
      </div>
      <div className="flex gap-2">
        <div className="h-9 flex-1 bg-gray-100 rounded-lg" />
        <div className="h-9 w-9 bg-gray-100 rounded-lg" />
        <div className="h-9 w-9 bg-gray-100 rounded-lg" />
      </div>
    </div>
  );
}

// ─── Empty State ───────────────────────────────────────
function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-6">
        <FileText className="w-10 h-10 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-700 mb-2">
        등록된 B2B 랜딩 페이지가 없습니다
      </h3>
      <p className="text-sm text-gray-500 mb-6 max-w-sm">
        새 페이지를 만들어 파트너 모집을 시작하세요. 템플릿을 활용하면 빠르게
        만들 수 있습니다.
      </p>
      <button
        onClick={onCreateClick}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-navy-900 bg-[#1e293b] text-white rounded-lg hover:bg-[#0f172a] transition font-medium text-sm"
      >
        <Plus className="w-4 h-4" />
        새 페이지 만들기
      </button>
    </div>
  );
}

// ─── Main Page Component ───────────────────────────────
export default function B2BEditorListPage() {
  const router = useRouter();

  // Data
  const [pages, setPages] = useState<B2BPage[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  // Filters & pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPartnerId, setFilterPartnerId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 20;

  // UI states
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ─── Fetch pages ──────────────────────────────────────
  const fetchPages = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(limit),
      });
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (filterPartnerId) params.set("partnerId", filterPartnerId);

      const res = await fetch(`/api/b2b-landing?${params.toString()}`, {
        credentials: "include",
      });
      const data = await res.json();

      if (res.ok) {
        setPages(data.pages ?? data.data ?? []);
        setTotalCount(data.total ?? data.totalCount ?? 0);
      }
    } catch (err) {
      console.error("페이지 목록 로드 실패:", err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, filterPartnerId]);

  // ─── Fetch partners for filter ────────────────────────
  const fetchPartners = useCallback(async () => {
    try {
      const res = await fetch("/api/partner/list?limit=200", {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.partners) {
        setPartners(
          data.partners.map((p: Record<string, unknown>) => ({
            id: String(p.id),
            name: (p.name as string) || null,
          }))
        );
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  // ─── Handlers ─────────────────────────────────────────
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    // fetchPages triggers via useEffect
  };

  const handleDelete = async (id: string, title: string) => {
    const confirmed = window.confirm(
      `"${title}" 페이지를 삭제하시겠습니까?\n\n삭제하면 복구할 수 없습니다.`
    );
    if (!confirmed) return;

    setDeleting(id);
    try {
      const res = await fetch(`/api/b2b-landing/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setPages((prev) => prev.filter((p) => p.id !== id));
        setTotalCount((prev) => prev - 1);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || "삭제에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setDeleting(null);
    }
  };

  const handleCopyLink = async (slug: string, id: string) => {
    const url = `${window.location.origin}/b2b/p/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleCreate = () => {
    router.push("/b2b-editor/new");
  };

  // ─── Derived values ───────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  const getConversionRate = (views: number, registrations: number) => {
    if (views === 0) return "0.0";
    return ((registrations / views) * 100).toFixed(1);
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // ─── Render ───────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ── Header ─────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              B2B 랜딩 관리
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              파트너 모집용 랜딩 페이지를 관리하고 성과를 확인하세요
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1e293b] text-white rounded-lg hover:bg-[#0f172a] transition font-medium text-sm shadow-sm"
          >
            <Plus className="w-4 h-4" />
            새 페이지
          </button>
        </div>

        {/* ── Filters ────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative sm:w-48">
            <select
              value={filterPartnerId}
              onChange={(e) => {
                setFilterPartnerId(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2.5 pr-10 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">전체 파트너</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || `파트너 ${p.id}`}
                </option>
              ))}
            </select>
            <Users className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          <form onSubmit={handleSearch} className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="페이지 제목 또는 슬러그로 검색..."
              className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </form>
        </div>

        {/* ── Content ────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : pages.length === 0 ? (
          <EmptyState onCreateClick={handleCreate} />
        ) : (
          <>
            {/* Page count */}
            <p className="text-sm text-gray-500 mb-4">
              총 <span className="font-semibold text-gray-700">{totalCount}</span>개 페이지
            </p>

            {/* Card grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {pages.map((page) => (
                <div
                  key={page.id}
                  className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow group"
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span
                        className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          page.isActive ? "bg-green-500" : "bg-gray-300"
                        }`}
                        title={page.isActive ? "활성" : "비활성"}
                      />
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate text-sm leading-6">
                          {page.title}
                        </h3>
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          /b2b/p/{page.partnerId || page.slug}
                        </p>
                      </div>
                    </div>
                    {page.partnerId && (
                      <span className="ml-2 flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                        <Users className="w-3 h-3" />
                        파트너
                      </span>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-gray-50 rounded-lg px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Eye className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                      <p className="text-lg font-bold text-gray-800 leading-none">
                        {page.viewCount.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-1">조회수</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Users className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                      <p className="text-lg font-bold text-gray-800 leading-none">
                        {page.registrationCount.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-1">신청수</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Globe className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                      <p className="text-lg font-bold text-gray-800 leading-none">
                        {getConversionRate(page.viewCount, page.registrationCount)}
                        <span className="text-xs font-normal">%</span>
                      </p>
                      <p className="text-[10px] text-gray-500 mt-1">전환율</p>
                    </div>
                  </div>

                  {/* Meta */}
                  <p className="text-xs text-gray-400 mb-3">
                    {formatDate(page.createdAt)} 생성
                    {page.editorMode && (
                      <span className="ml-2 px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 text-[10px]">
                        {page.editorMode}
                      </span>
                    )}
                    {page.paymentEnabled && (
                      <span className="ml-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[10px]">
                        결제
                      </span>
                    )}
                    {page.commentEnabled && (
                      <span className="ml-1 px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded text-[10px]">
                        댓글
                      </span>
                    )}
                  </p>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/b2b-editor/${page.id}`)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#1e293b] text-white rounded-lg hover:bg-[#0f172a] transition text-xs font-medium"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      편집
                    </button>
                    <button
                      onClick={() =>
                        handleCopyLink(page.partnerId || page.slug, page.id)
                      }
                      className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border transition text-xs ${
                        copiedId === page.id
                          ? "bg-green-50 border-green-300 text-green-600"
                          : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                      }`}
                      title="링크 복사"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(page.id, page.title)}
                      disabled={deleting === page.id}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 bg-white text-gray-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition disabled:opacity-50"
                      title="삭제"
                    >
                      {deleting === page.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Pagination ────────────────────────────── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    if (totalPages <= 7) return true;
                    if (p === 1 || p === totalPages) return true;
                    if (Math.abs(p - currentPage) <= 1) return true;
                    return false;
                  })
                  .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                    if (idx > 0) {
                      const prev = arr[idx - 1];
                      if (p - prev > 1) acc.push("ellipsis");
                    }
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === "ellipsis" ? (
                      <span
                        key={`ellipsis-${idx}`}
                        className="w-9 h-9 flex items-center justify-center text-gray-400 text-sm"
                      >
                        ...
                      </span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => setCurrentPage(item)}
                        className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm font-medium transition ${
                          currentPage === item
                            ? "bg-[#1e293b] text-white shadow-sm"
                            : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )}

                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
