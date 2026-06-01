"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Plus, Eye, Copy, Globe, Files, Link2,
  Check, Share2, Trash2, Users, X, ChevronDown, ChevronUp,
  BarChart2, Pencil,
} from "lucide-react";
import { useRouter } from "next/navigation";

type LandingPage = {
  id: string;
  title: string;
  slug: string;
  isActive: boolean;
  viewCount: number;
  createdAt: string;
  groupId?: string | null;
  _count?: { registrations: number };
};

type SharedPage = LandingPage & {
  isShared: true;
  sharedByName: string;
  sharedByOrgId: string;
  sharedByOrgName: string;
  shareId: string;
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

type ShareableOrg = {
  orgId: string;
  orgName: string;
  ownerDisplayName: string | null;
  label: string;
  isBonsa?: boolean;
};

type ExistingShare = {
  id: string;
  sharedToOrgId: string;
  sharedToOrgName: string;
  isGlobal: boolean;
  sharedByName: string;
};

// ─── 미리보기 팝업 ──────────────────────────────────────
function HoverPreview({ slug, visible, anchorRef }: {
  slug: string;
  visible: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
}) {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!visible || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + window.scrollY + 6, left: rect.left + window.scrollX });
  }, [visible, anchorRef]);

  if (!visible) return null;

  return (
    <div
      className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
      style={{ top: pos.top, left: pos.left, width: 200, height: 360, pointerEvents: "none" }}
    >
      <div className="bg-gray-100 px-2 py-1 text-[10px] text-gray-500 font-medium border-b">
        모바일 미리보기
      </div>
      <iframe
        src={`/p/${slug}`}
        style={{ width: "375px", height: "680px", transform: "scale(0.52)", transformOrigin: "0 0", border: "none", pointerEvents: "none" }}
        sandbox="allow-scripts allow-same-origin"
        loading="lazy"
      />
    </div>
  );
}

// ─── 공유 모달 ──────────────────────────────────────────
function ShareModal({ pageId, pageTitle, onClose }: {
  pageId: string;
  pageTitle: string;
  onClose: () => void;
}) {
  const [orgs, setOrgs] = useState<ShareableOrg[]>([]);
  const [existing, setExisting] = useState<ExistingShare[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isGlobal, setIsGlobal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/landing-pages/shareable-orgs").then((r) => r.json()),
      fetch(`/api/landing-pages/${pageId}/share`).then((r) => r.json()),
    ]).then(([orgsData, sharesData]) => {
      if (orgsData.ok) setOrgs(orgsData.orgs);
      if (sharesData.ok) {
        setExisting(sharesData.shares);
        const globalShare = sharesData.shares.find((s: ExistingShare) => s.isGlobal);
        if (globalShare) setIsGlobal(true);
      }
    }).finally(() => setLoading(false));
  }, [pageId]);

  const alreadySharedOrgIds = new Set(existing.map((s) => s.sharedToOrgId));

  const toggleOrg = (orgId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orgId)) next.delete(orgId);
      else next.add(orgId);
      return next;
    });
  };

  const handleShare = async () => {
    if (isGlobal) {
      setSaving(true);
      try {
        await fetch(`/api/landing-pages/${pageId}/share`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isGlobal: true }),
        });
        onClose();
      } finally {
        setSaving(false);
      }
      return;
    }
    if (selected.size === 0) return;
    setSaving(true);
    try {
      await Promise.all(
        [...selected].map((orgId) =>
          fetch(`/api/landing-pages/${pageId}/share`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sharedToOrgId: orgId }),
          })
        )
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (sharedToOrgId: string) => {
    setRemoving(sharedToOrgId);
    try {
      await fetch(`/api/landing-pages/${pageId}/share?sharedToOrgId=${encodeURIComponent(sharedToOrgId)}`, {
        method: "DELETE",
      });
      setExisting((prev) => prev.filter((s) => s.sharedToOrgId !== sharedToOrgId));
      if (sharedToOrgId === "__ALL__") setIsGlobal(false);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="font-bold text-gray-900 text-base">랜딩페이지 공유</h2>
            <p className="text-sm text-gray-600 mt-0.5 truncate max-w-[280px]">{pageTitle}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* 이미 공유된 목록 */}
          {existing.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-500 mb-2">현재 공유 중</p>
              <div className="space-y-1.5">
                {existing.map((s) => (
                  <div key={s.id} className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
                    <div>
                      <span className="text-sm font-medium text-blue-800">
                        {s.isGlobal ? "전체 공유 (모든 대리점장)" : s.sharedToOrgName}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemove(s.sharedToOrgId)}
                      disabled={removing === s.sharedToOrgId}
                      className="text-sm text-red-500 hover:text-red-700 disabled:opacity-40"
                    >
                      {removing === s.sharedToOrgId ? "취소중..." : "공유취소"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 전체 공유 옵션 */}
          <div>
            <label className="flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-colors hover:bg-gray-50"
              style={{ borderColor: isGlobal ? "#3b82f6" : "#e5e7eb" }}>
              <input
                type="checkbox"
                checked={isGlobal}
                onChange={(e) => { setIsGlobal(e.target.checked); if (e.target.checked) setSelected(new Set()); }}
                className="w-4 h-4 accent-blue-600"
              />
              <div>
                <p className="font-semibold text-sm text-gray-800">전체 공유</p>
                <p className="text-sm text-gray-600">모든 대리점장이 받은 함에서 확인할 수 있습니다</p>
              </div>
            </label>
          </div>

          {/* 조직별 선택 */}
          {!isGlobal && (
            <div>
              <p className="text-sm font-semibold text-gray-500 mb-2">특정 대리점장에게 공유</p>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
                </div>
              ) : orgs.length === 0 ? (
                <p className="text-sm text-gray-600 text-center py-4">공유 가능한 조직이 없습니다</p>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {orgs.map((org) => {
                    const alreadyShared = alreadySharedOrgIds.has(org.orgId);
                    return (
                      <label
                        key={org.orgId}
                        className={`flex items-center gap-3 p-2.5 border rounded-lg cursor-pointer transition-colors ${
                          alreadyShared
                            ? "bg-blue-50 border-blue-200 opacity-60 cursor-not-allowed"
                            : selected.has(org.orgId)
                            ? "bg-blue-50 border-blue-400"
                            : org.isBonsa
                            ? "border-orange-200 hover:bg-orange-50"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(org.orgId) || alreadyShared}
                          disabled={alreadyShared}
                          onChange={() => !alreadyShared && toggleOrg(org.orgId)}
                          className="w-4 h-4 accent-blue-600"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {org.isBonsa && (
                              <span className="text-[10px] bg-orange-100 text-orange-600 font-semibold px-1.5 py-0.5 rounded shrink-0">본사</span>
                            )}
                            {!org.isBonsa && (
                              <span className="text-[10px] bg-gray-100 text-gray-500 font-medium px-1.5 py-0.5 rounded shrink-0">대리점</span>
                            )}
                            <p className="text-sm font-medium text-gray-800 truncate">{org.label}</p>
                          </div>
                          {alreadyShared && <p className="text-[10px] text-blue-500 mt-0.5">이미 공유됨</p>}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 푸터 버튼 */}
        <div className="p-5 border-t flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">
            취소
          </button>
          <button
            onClick={handleShare}
            disabled={saving || (!isGlobal && selected.size === 0)}
            className="flex-1 py-2.5 bg-blue-600 rounded-xl text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {saving ? "공유 중..." : isGlobal ? "전체 공유하기" : `${selected.size}개 조직에 공유`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 페이지 카드 ──────────────────────────────────────────
function PageCard({
  page,
  isShared,
  isSelected,
  statsMap,
  loadingStats,
  cloningId,
  togglingId,
  copiedLinkId,
  copied,
  deletingId,
  sharingId,
  onToggle,
  onClone,
  onCloneShared,
  onCreateShortLink,
  onCopyLink,
  onDelete,
  onShare,
  onLoadStats,
  onToggleSelect,
}: {
  page: LandingPage & Partial<SharedPage>;
  isShared: boolean;
  isSelected: boolean;
  statsMap: Record<string, LandingStats>;
  loadingStats: string | null;
  cloningId: string | null;
  togglingId: string | null;
  copiedLinkId: string | null;
  copied: string | null;
  deletingId: string | null;
  sharingId: string | null;
  onToggle: (p: LandingPage) => void;
  onClone: (id: string) => void;
  onCloneShared: (id: string) => void;
  onCreateShortLink: (p: LandingPage) => void;
  onCopyLink: (slug: string) => void;
  onDelete: (id: string, title: string) => void;
  onShare: (id: string, title: string) => void;
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

  return (
    <div className={`bg-white border rounded-xl p-4 hover:shadow-sm transition-shadow ${
      isShared ? "border-blue-200 bg-blue-50/30" : isSelected ? "border-navy-400 bg-navy-50/20" : "border-gray-200"
    }`}>
      {/* 선택 체크박스 (내 페이지만) */}
      {!isShared && onToggleSelect && (
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
      {/* 공유받음 뱃지 */}
      {isShared && page.sharedByName && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">
            <Share2 className="w-2.5 h-2.5" /> 공유받음
          </span>
          <span className="text-[11px] text-gray-500">
            {page.sharedByOrgName ?? ""}
            {page.sharedByName ? ` · ${page.sharedByName}` : ""}
          </span>
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* isActive 토글 — 공유받은 페이지는 비활성 */}
        {!isShared ? (
          <button
            onClick={() => onToggle(page)}
            disabled={togglingId === page.id}
            title={page.isActive ? "비활성화" : "활성화"}
            className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 transition-colors ${
              page.isActive ? "bg-green-400 hover:bg-green-600" : "bg-gray-300 hover:bg-gray-500"
            } disabled:opacity-50`}
          />
        ) : (
          <div className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 bg-blue-300" title="공유받은 페이지" />
        )}

        <div className="flex-1 min-w-0">
          <h3
            ref={titleRef as React.RefObject<HTMLHeadingElement>}
            className="font-semibold text-gray-900 cursor-default select-none"
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
          >
            {page.title}
          </h3>
          <HoverPreview slug={page.slug} visible={hoverVisible} anchorRef={titleRef} />
          <p className="text-sm text-gray-600 mt-0.5">/p/{page.slug}</p>

          <div className="flex items-center gap-3 mt-2 text-sm text-gray-500 flex-wrap">
            {/* L6: Loss aversion — 미사용 경고 */}
            {page.viewCount === 0 && (
              <span className="inline-flex items-center gap-1 text-red-600 font-medium bg-red-50 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                미사용
              </span>
            )}
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
                  <p className="text-sm font-semibold text-gray-600">퍼널 전환 그래프</p>
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
                        <span className="text-[10px] text-gray-600 w-8 shrink-0">{b.rate}%</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
          {isShared ? (
            /* 공유받은 페이지 — 내 페이지로 복사만 */
            <button
              onClick={() => onCloneShared(page.id)}
              disabled={cloningId === page.id}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
              title="내 페이지로 복사"
            >
              {cloningId === page.id ? "복사중..." : <><Files className="w-3.5 h-3.5" /> 내 페이지로 복사</>}
            </button>
          ) : (
            <>
              <button
                onClick={() => onCreateShortLink(page)}
                className="flex items-center gap-1 px-2 py-1.5 hover:bg-gray-100 rounded-lg text-gray-500 text-sm"
                title="숏링크 만들기"
              >
                {copiedLinkId === page.id ? (
                  <><Check className="w-4 h-4 text-green-500" /><span className="text-green-500">복사됨</span></>
                ) : (
                  <><Link2 className="w-4 h-4" /><span>숏링크</span></>
                )}
              </button>
              <a
                href={`/p/${page.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                title="새 탭에서 열기"
              >
                <Globe className="w-4 h-4" />
              </a>
              <button
                onClick={() => onCopyLink(page.slug)}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                title="링크 복사"
              >
                {copied === page.slug
                  ? <span className="text-sm text-green-500 font-medium">복사됨</span>
                  : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={() => onClone(page.id)}
                disabled={cloningId === page.id}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 disabled:opacity-50"
                title="복제 (사본 만들기)"
              >
                {cloningId === page.id ? <span className="text-sm text-blue-500">복제중...</span> : <Files className="w-4 h-4" />}
              </button>
              <button
                onClick={() => onShare(page.id, page.title)}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                title="공유"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <Link
                href={`/landing-pages/${page.id}?tab=registrations`}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 relative"
                title="등록자 목록"
              >
                <Users className="w-4 h-4" />
                {page._count && page._count.registrations > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                    {page._count.registrations > 9 ? "9+" : page._count.registrations}
                  </span>
                )}
              </Link>
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
                href={`/landing-pages/${page.id}`}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                title="편집"
              >
                <Pencil className="w-4 h-4" />
              </Link>
              <button
                onClick={() => onDelete(page.id, page.title)}
                disabled={deletingId === page.id}
                className="p-2 hover:bg-red-50 rounded-lg text-gray-600 hover:text-red-500 disabled:opacity-50"
                title="삭제"
              >
                {deletingId === page.id ? <span className="text-sm text-red-400">삭제중...</span> : <Trash2 className="w-4 h-4" />}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────
export default function LandingPagesPage() {
  const router = useRouter();
  const [pages, setPages]             = useState<LandingPage[]>([]);
  const [sharedPages, setSharedPages] = useState<SharedPage[]>([]);
  const [loading, setLoading]         = useState(true);
  const [copied, setCopied]           = useState<string | null>(null);
  const [statsMap, setStatsMap]       = useState<Record<string, LandingStats>>({});
  const [loadingStats, setLoadingStats] = useState<string | null>(null);
  const [cloningId,   setCloningId]   = useState<string | null>(null);
  const [togglingId,  setTogglingId]  = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [shareModal,  setShareModal]  = useState<{ id: string; title: string } | null>(null);
  const [showShared,  setShowShared]  = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const loadPages = useCallback(async () => {
    const res = await fetch("/api/landing-pages");
    const d   = await res.json();
    if (d.ok) {
      setPages(d.pages ?? []);
      setSharedPages(d.sharedPages ?? []);
    }
  }, []);

  useEffect(() => {
    loadPages().finally(() => setLoading(false));
  }, [loadPages]);

  const loadStats = async (pageId: string) => {
    if (loadingStats) return; // 이미 로딩 중이면 중복 요청 방지

    // 현재 표시된 모든 페이지 중 아직 로드되지 않은 페이지들 수집
    const allPages = [...pages, ...sharedPages];
    const pagesToLoad = [pageId, ...allPages
      .filter(p => p.id !== pageId && !statsMap[p.id])
      .map(p => p.id)
    ].slice(0, 20); // 최대 20개까지만 배치 (너무 많으면 쿼리 성능 저하)

    setLoadingStats(pageId);
    try {
      const res = await fetch('/api/landing-pages/batch-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageIds: pagesToLoad }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatsMap((prev) => ({ ...prev, ...data.stats }));
      }
    } finally {
      setLoadingStats(null);
    }
  };

  const createShortLink = async (page: LandingPage) => {
    const landingUrl = `${window.location.origin}/p/${page.slug}`;
    const res = await fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUrl: landingUrl, title: `${page.title} 랜딩링크`, autoGroupId: page.groupId ?? undefined }),
    });
    const d = await res.json();
    if (d.ok) {
      navigator.clipboard.writeText(`${window.location.origin}/l/${d.link.code}`);
      setCopiedLinkId(page.id);
      setTimeout(() => setCopiedLinkId(null), 2000);
    }
  };

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/p/${slug}`);
    setCopied(slug);
    setTimeout(() => setCopied(null), 2000);
  };

  const toggleActive = async (page: LandingPage) => {
    setTogglingId(page.id);
    const res = await fetch(`/api/landing-pages/${page.id}`, {
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
    const res = await fetch(`/api/landing-pages/${pageId}/clone`, { method: "POST" });
    const data = await res.json();
    if (data.ok) {
      await loadPages();
      router.push(`/landing-pages/${data.page.id}`);
    }
    setCloningId(null);
  };

  const cloneSharedPage = async (pageId: string) => {
    setCloningId(pageId);
    const res = await fetch(`/api/landing-pages/${pageId}/clone-shared`, { method: "POST" });
    const data = await res.json();
    if (data.ok) {
      await loadPages();
      router.push(`/landing-pages/${data.page.id}`);
    } else {
      alert(data.message ?? "복사에 실패했습니다.");
    }
    setCloningId(null);
  };

  const deletePage = async (pageId: string, title: string) => {
    if (!confirm(`"${title}" 페이지를 삭제하시겠습니까?\n삭제하면 복구할 수 없습니다.`)) return;
    setDeletingId(pageId);
    const res = await fetch(`/api/landing-pages/${pageId}`, { method: "DELETE" });
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
      ids.map((id) => fetch(`/api/landing-pages/${id}`, { method: "DELETE" }).then((r) => r.json()))
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

  const openShareModal = (id: string, title: string) => setShareModal({ id, title });
  const closeShareModal = () => setShareModal(null);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* L6: Loss aversion — 경쟁사 위험 경고 배너 */}
      {pages.length === 0 && (
        <div className="mb-4 bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-bold text-red-900">아직 랜딩페이지가 없습니다</p>
              <p className="text-sm text-red-800 mt-1">
                경쟁사는 이미 고객을 모으고 있습니다.
                <span className="font-semibold"> 지금 만들지 않으면 고객 기회를 놓칠 수 있습니다.</span>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-navy-900">랜딩페이지</h1>
          <p className="text-sm text-gray-500 mt-0.5">총 {pages.length}개{sharedPages.length > 0 ? ` · 공유받음 ${sharedPages.length}개` : ""}</p>
        </div>
        <Link
          href="/landing-pages/new"
          className="flex items-center gap-1.5 bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy-700 transition-colors shadow-sm hover:shadow-md"
          title="새 랜딩페이지를 만들어 고객을 모으세요"
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
            <span className="text-sm text-gray-500">전체 선택</span>
          </label>
          {selectedIds.size > 0 && (
            <button
              onClick={bulkDelete}
              disabled={bulkDeleting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
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
        <div className="space-y-6">
          {/* 내 페이지 */}
          <div className="space-y-3">
            {pages.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-4xl mb-3">📄</p>
                <p className="font-medium text-gray-700">랜딩페이지가 없습니다</p>
                <p className="text-sm text-gray-600 mt-1">+ 새 페이지 버튼으로 만들어보세요</p>
              </div>
            ) : (
              pages.map((page) => (
                <PageCard
                  key={page.id}
                  page={page}
                  isShared={false}
                  isSelected={selectedIds.has(page.id)}
                  statsMap={statsMap}
                  loadingStats={loadingStats}
                  cloningId={cloningId}
                  togglingId={togglingId}
                  copiedLinkId={copiedLinkId}
                  copied={copied}
                  deletingId={deletingId}
                  sharingId={null}
                  onToggle={toggleActive}
                  onClone={clonePage}
                  onCloneShared={cloneSharedPage}
                  onCreateShortLink={createShortLink}
                  onCopyLink={copyLink}
                  onDelete={deletePage}
                  onShare={openShareModal}
                  onLoadStats={loadStats}
                  onToggleSelect={toggleSelect}
                />
              ))
            )}
          </div>

          {/* 공유받은 페이지 섹션 */}
          {sharedPages.length > 0 && (
            <div>
              <button
                onClick={() => setShowShared((v) => !v)}
                className="flex items-center gap-2 text-sm font-semibold text-blue-700 mb-3"
              >
                <Share2 className="w-4 h-4" />
                받은 함 ({sharedPages.length})
                {showShared ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {showShared && (
                <div className="space-y-3">
                  {sharedPages.map((page) => (
                    <PageCard
                      key={page.id}
                      page={page}
                      isShared={true}
                      isSelected={false}
                      statsMap={statsMap}
                      loadingStats={loadingStats}
                      cloningId={cloningId}
                      togglingId={togglingId}
                      copiedLinkId={copiedLinkId}
                      copied={copied}
                      deletingId={deletingId}
                      sharingId={null}
                      onToggle={toggleActive}
                      onClone={clonePage}
                      onCloneShared={cloneSharedPage}
                      onCreateShortLink={createShortLink}
                      onCopyLink={copyLink}
                      onDelete={deletePage}
                      onShare={openShareModal}
                      onLoadStats={loadStats}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 공유 모달 */}
      {shareModal && (
        <ShareModal
          pageId={shareModal.id}
          pageTitle={shareModal.title}
          onClose={closeShareModal}
        />
      )}
    </div>
  );
}
