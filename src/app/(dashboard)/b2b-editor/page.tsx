"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Plus, Eye, Copy, Globe, Files,
  Check, Trash2, X, BarChart2, Pencil,
} from "lucide-react";
import { useRouter } from "next/navigation";

type B2BLandingPage = {
  id: string;
  title: string;
  partnerId?: string | null;
  isActive: boolean;
  viewCount: number;
  createdAt: string;
  _count?: { registrations: number };
};

type LandingStats = {
  viewCount: number;
  registered: number;
  funnelEntered: number;
  purchased: number;
  rates: {
    visitToRegister: number;
    registerToFunnel: number;
    funnelToPurchase: number;
    visitToPurchase: number;
  };
};

// ─── 미리보기 팝업 ──────────────────────────────────────
function HoverPreview({ partnerId, visible, anchorRef }: {
  partnerId?: string | null;
  visible: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
}) {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!visible || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + window.scrollY + 6, left: rect.left + window.scrollX });
  }, [visible, anchorRef]);

  if (!visible || !partnerId) return null;

  return (
    <div
      className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
      style={{ top: pos.top, left: pos.left, width: 200, height: 360, pointerEvents: "none" }}
    >
      <div className="bg-gray-100 px-2 py-1 text-[10px] text-gray-500 font-medium border-b">
        모바일 미리보기
      </div>
      <iframe
        src={`/b2b/p/${partnerId}`}
        style={{ width: "375px", height: "680px", transform: "scale(0.52)", transformOrigin: "0 0", border: "none", pointerEvents: "none" }}
        sandbox="allow-scripts allow-same-origin"
        loading="lazy"
      />
    </div>
  );
}

// ─── 페이지 카드 ──────────────────────────────────────────
function PageCard({
  page,
  isSelected,
  statsMap,
  loadingStats,
  cloningId,
  togglingId,
  copiedLinkId,
  copied,
  deletingId,
  onToggle,
  onClone,
  onCreateShortLink,
  onCopyLink,
  onDelete,
  onLoadStats,
  onToggleSelect,
}: {
  page: B2BLandingPage;
  isSelected: boolean;
  statsMap: Record<string, LandingStats>;
  loadingStats: string | null;
  cloningId: string | null;
  togglingId: string | null;
  copiedLinkId: string | null;
  copied: string | null;
  deletingId: string | null;
  onToggle: (p: B2BLandingPage) => void;
  onClone: (id: string) => void;
  onCreateShortLink: (p: B2BLandingPage) => void;
  onCopyLink: (partnerId?: string | null) => void;
  onDelete: (id: string, title: string) => void;
  onLoadStats: (id: string) => void;
  onToggleSelect?: (id: string) => void;
}) {
  const [hoverVisible, setHoverVisible] = useState(false);
  const titleRef = useRef<HTMLElement | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onMouseEnter = () => {
    hoverTimer.current = setTimeout(() => setHoverVisible(true), 600);
  };
  const onMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHoverVisible(false);
  };

  const previewKey = page.partnerId || "default";

  return (
    <div className={`bg-white border rounded-xl p-4 hover:shadow-sm transition-shadow ${
      isSelected ? "border-navy-400 bg-navy-50/20" : "border-gray-200"
    }`}>
      {/* 선택 체크박스 */}
      {onToggleSelect && (
        <div className="flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(page.id)}
            className="w-4 h-4 accent-navy-900"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* 파트너 ID 또는 기본 페이지 배지 */}
      {(page.partnerId || page.id) && (
        <div className="flex items-center gap-1.5 mb-2">
          {page.partnerId ? (
            <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">
              파트너 ID: {page.partnerId}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">
              기본 페이지
            </span>
          )}
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* isActive 토글 */}
        <button
          onClick={() => onToggle(page)}
          disabled={togglingId === page.id}
          title={page.isActive ? "비활성화" : "활성화"}
          className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 transition-colors ${
            page.isActive ? "bg-green-400 hover:bg-green-600" : "bg-gray-300 hover:bg-gray-500"
          } disabled:opacity-50`}
        />

        <div className="flex-1 min-w-0">
          <h3
            ref={titleRef as React.RefObject<HTMLHeadingElement>}
            className="font-semibold text-gray-900 cursor-default select-none"
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
          >
            {page.title}
          </h3>
          <HoverPreview partnerId={page.partnerId} visible={hoverVisible} anchorRef={titleRef} />
          {page.partnerId ? (
            <p className="text-xs text-gray-400 mt-0.5">/b2b/p/{page.partnerId}</p>
          ) : (
            <p className="text-xs text-gray-400 mt-0.5">기본 페이지 - 미리보기 불가</p>
          )}

          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" /> {page.viewCount.toLocaleString()}명 방문
            </span>
            {page._count && (
              <>
                <span>📋 등록 {page._count.registrations}명</span>
                {page.viewCount > 0 ? (
                  <span className={`font-semibold px-1.5 py-0.5 rounded ${
                    (page._count.registrations / page.viewCount) >= 0.05
                      ? "bg-green-100 text-green-700"
                      : (page._count.registrations / page.viewCount) >= 0.02
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-red-100 text-red-700"
                  }`}>
                    전환율 {(page._count.registrations / page.viewCount * 100).toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-gray-300">방문 없음</span>
                )}
              </>
            )}
            <span>{new Date(page.createdAt).toLocaleDateString("ko-KR")}</span>
          </div>

          {/* 퍼널 막대 그래프 */}
          {statsMap[page.id] && (() => {
            const s = statsMap[page.id]!;
            const max = s.viewCount || 1;
            const bars = [
              { label: "방문", value: s.viewCount,      color: "bg-gray-400",   rate: null },
              { label: "등록", value: s.registered,     color: "bg-blue-500",   rate: s.rates.visitToRegister },
              { label: "퍼널", value: s.funnelEntered,  color: "bg-purple-500", rate: s.rates.registerToFunnel },
              { label: "구매", value: s.purchased,      color: "bg-green-500",  rate: s.rates.funnelToPurchase },
            ];
            return (
              <div className="mt-3 bg-gray-50 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-600">퍼널 전환 그래프</p>
                  {s.viewCount > 0 && s.purchased > 0 && (
                    <span className="text-[11px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                      전체 전환 {s.rates.visitToPurchase}%
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {bars.map((b) => (
                    <div key={b.label} className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-500 w-8 shrink-0">{b.label}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${b.color}`}
                          style={{ width: `${Math.round((b.value / max) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-gray-700 w-8 text-right shrink-0">
                        {b.value.toLocaleString()}
                      </span>
                      {b.rate !== null && (
                        <span className="text-[10px] text-gray-400 w-8 shrink-0">{b.rate}%</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* 액션 버튼 - 복사, 통계, 삭제만 표시 */}
        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
          <button
            onClick={() => onCreateShortLink(page)}
            className="flex items-center gap-1 px-2 py-1.5 hover:bg-gray-100 rounded-lg text-gray-500 text-xs"
            title="숏링크 만들기"
          >
            {copiedLinkId === page.id ? (
              <><Check className="w-4 h-4 text-green-500" /><span className="text-green-500">복사됨</span></>
            ) : (
              <><Copy className="w-4 h-4" /><span>복사</span></>
            )}
          </button>
          {page.partnerId && (
            <a
              href={`/b2b/p/${page.partnerId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
              title="새 탭에서 열기"
            >
              <Globe className="w-4 h-4" />
            </a>
          )}
          <button
            onClick={() => onCopyLink(page.partnerId)}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
            title="링크 복사"
          >
            {copied === previewKey
              ? <span className="text-xs text-green-500 font-medium">복사됨</span>
              : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={() => onClone(page.id)}
            disabled={cloningId === page.id}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 disabled:opacity-50"
            title="복제 (사본 만들기)"
          >
            {cloningId === page.id ? <span className="text-xs text-blue-500">복제중...</span> : <Files className="w-4 h-4" />}
          </button>
          <button
            onClick={() => onLoadStats(page.id)}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
            title={statsMap[page.id] ? "그래프 새로고침" : "퍼널 그래프 보기"}
          >
            {loadingStats === page.id
              ? <span className="text-[10px] text-blue-400">로딩</span>
              : <BarChart2 className={`w-4 h-4 ${statsMap[page.id] ? "text-blue-500" : ""}`} />}
          </button>
          <Link
            href={`/b2b-editor/${page.id}`}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
            title="편집"
          >
            <Pencil className="w-4 h-4" />
          </Link>
          <button
            onClick={() => onDelete(page.id, page.title)}
            disabled={deletingId === page.id}
            className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 disabled:opacity-50"
            title="삭제"
          >
            {deletingId === page.id ? <span className="text-xs text-red-400">삭제중...</span> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────
export default function B2BEditorPage() {
  const router = useRouter();
  const [pages, setPages]             = useState<B2BLandingPage[]>([]);
  const [loading, setLoading]         = useState(true);
  const [copied, setCopied]           = useState<string | null>(null);
  const [statsMap, setStatsMap]       = useState<Record<string, LandingStats>>({});
  const [loadingStats, setLoadingStats] = useState<string | null>(null);
  const [cloningId,   setCloningId]   = useState<string | null>(null);
  const [togglingId,  setTogglingId]  = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const loadPages = useCallback(async () => {
    const res = await fetch("/api/b2b-landing");
    const d   = await res.json();
    if (d.ok) {
      setPages(d.pages ?? []);
    }
  }, []);

  useEffect(() => {
    loadPages().finally(() => setLoading(false));
  }, [loadPages]);

  const loadStats = async (pageId: string) => {
    if (loadingStats === pageId) return;
    setStatsMap((prev) => { const n = { ...prev }; delete n[pageId]; return n; });
    setLoadingStats(pageId);
    try {
      const res  = await fetch(`/api/b2b-landing/${pageId}/stats`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.ok) setStatsMap((prev) => ({ ...prev, [pageId]: data.stats }));
    } catch (err) {
      console.error(`[loadStats] Failed to load stats for ${pageId}:`, err);
    } finally {
      setLoadingStats(null);
    }
  };

  const createShortLink = async (page: B2BLandingPage) => {
    if (!page.partnerId) {
      alert("기본 페이지는 미리보기 URL이 없습니다.");
      return;
    }
    const landingUrl = `${window.location.origin}/b2b/p/${page.partnerId}`;
    const res = await fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUrl: landingUrl, title: `${page.title} B2B 랜딩링크` }),
    });
    const d = await res.json();
    if (d.ok) {
      navigator.clipboard.writeText(`${window.location.origin}/l/${d.link.code}`);
      setCopiedLinkId(page.id);
      setTimeout(() => setCopiedLinkId(null), 2000);
    }
  };

  const copyLink = (partnerId?: string | null) => {
    if (!partnerId) {
      alert("기본 페이지는 미리보기 URL이 없습니다.");
      return;
    }
    navigator.clipboard.writeText(`${window.location.origin}/b2b/p/${partnerId}`);
    const key = partnerId || "default";
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const toggleActive = async (page: B2BLandingPage) => {
    setTogglingId(page.id);
    const res = await fetch(`/api/b2b-landing/${page.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !page.isActive }),
    });
    const data = await res.json();
    if (data.ok) setPages((prev) => prev.map((p) => p.id === page.id ? { ...p, isActive: !p.isActive } : p));
    setTogglingId(null);
  };

  const clonePage = async (pageId: string) => {
    setCloningId(pageId);
    const res = await fetch(`/api/b2b-landing/${pageId}/clone`, { method: "POST" });
    const data = await res.json();
    if (data.ok) {
      await loadPages();
      router.push(`/b2b-editor/${data.page.id}`);
    }
    setCloningId(null);
  };

  const deletePage = async (pageId: string, title: string) => {
    if (!confirm(`"${title}" 페이지를 삭제하시겠습니까?\n삭제하면 복구할 수 없습니다.`)) return;
    setDeletingId(pageId);
    const res = await fetch(`/api/b2b-landing/${pageId}`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) {
      setPages((prev) => prev.filter((p) => p.id !== pageId));
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(pageId); return n; });
    } else {
      alert(data.message ?? "삭제에 실패했습니다.");
    }
    setDeletingId(null);
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`선택한 ${selectedIds.size}개 페이지를 삭제하시겠습니까?\n삭제하면 복구할 수 없습니다.`)) return;
    setBulkDeleting(true);
    const ids = [...selectedIds];
    const results = await Promise.all(
      ids.map((id) => fetch(`/api/b2b-landing/${id}`, { method: "DELETE" }).then((r) => r.json()))
    );
    const deleted = ids.filter((_, i) => results[i].ok);
    const failCount = ids.length - deleted.length;
    setPages((prev) => prev.filter((p) => !deleted.includes(p.id)));
    setSelectedIds(new Set());
    if (failCount > 0) alert(`${failCount}개 삭제에 실패했습니다.`);
    setBulkDeleting(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === pages.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pages.map((p) => p.id)));
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-navy-900">B2B 랜딩페이지</h1>
          <p className="text-sm text-gray-500 mt-0.5">총 {pages.length}개</p>
        </div>
        <Link
          href="/b2b-editor/new"
          className="flex items-center gap-1.5 bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> 새 페이지
        </Link>
      </div>

      {/* 복수선택 툴바 */}
      {pages.length > 0 && (
        <div className="flex items-center gap-3 mb-3 px-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={selectedIds.size === pages.length && pages.length > 0}
              onChange={toggleSelectAll}
              className="w-4 h-4 accent-navy-900"
            />
            <span className="text-xs text-gray-500">전체 선택</span>
          </label>
          {selectedIds.size > 0 && (
            <button
              onClick={bulkDelete}
              disabled={bulkDeleting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {bulkDeleting ? "삭제 중..." : `${selectedIds.size}개 삭제`}
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {pages.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">📄</p>
              <p className="font-medium text-gray-700">B2B 랜딩페이지가 없습니다</p>
              <p className="text-sm text-gray-400 mt-1">+ 새 페이지 버튼으로 만들어보세요</p>
            </div>
          ) : (
            pages.map((page) => (
              <PageCard
                key={page.id}
                page={page}
                isSelected={selectedIds.has(page.id)}
                statsMap={statsMap}
                loadingStats={loadingStats}
                cloningId={cloningId}
                togglingId={togglingId}
                copiedLinkId={copiedLinkId}
                copied={copied}
                deletingId={deletingId}
                onToggle={toggleActive}
                onClone={clonePage}
                onCreateShortLink={createShortLink}
                onCopyLink={copyLink}
                onDelete={deletePage}
                onLoadStats={loadStats}
                onToggleSelect={toggleSelect}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
