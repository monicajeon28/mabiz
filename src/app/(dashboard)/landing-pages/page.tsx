"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Eye, Copy, Edit2, Globe, Files, Power, Link2, Check } from "lucide-react";
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

type LandingStats = {
  viewCount:    number;
  registered:   number;
  funnelEntered: number;
  purchased:    number;
  rates: {
    visitToRegister:  number;
    registerToFunnel: number;
    funnelToPurchase: number;
    visitToPurchase:  number;
  };
};

export default function LandingPagesPage() {
  const router = useRouter();
  const [pages, setPages]   = useState<LandingPage[]>([]);
  const [loading, setLoading]       = useState(true);
  const [copied, setCopied]         = useState<string | null>(null);
  const [statsMap, setStatsMap]     = useState<Record<string, LandingStats>>({});
  const [loadingStats, setLoadingStats] = useState<string | null>(null);
  const [cloningId,   setCloningId]     = useState<string | null>(null);
  const [togglingId,  setTogglingId]    = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  const loadStats = async (pageId: string) => {
    if (loadingStats === pageId) return;
    // statsMap에서 제거 후 재로딩 (새로고침 지원)
    setStatsMap(prev => { const n = { ...prev }; delete n[pageId]; return n; });
    setLoadingStats(pageId);
    try {
      const res  = await fetch(`/api/landing-pages/${pageId}/stats`);
      const data = await res.json();
      if (data.ok) setStatsMap(prev => ({ ...prev, [pageId]: data.stats }));
    } finally {
      setLoadingStats(null);
    }
  };

  useEffect(() => {
    fetch("/api/landing-pages")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setPages(d.pages); })
      .finally(() => setLoading(false));
  }, []);

  const createShortLink = async (page: LandingPage) => {
    const landingUrl = `${window.location.origin}/p/${page.slug}`;
    const res = await fetch('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUrl: landingUrl,
        title: `${page.title} 랜딩링크`,
        autoGroupId: page.groupId ?? undefined,
      }),
    });
    const d = await res.json();
    if (d.ok) {
      navigator.clipboard.writeText(`${window.location.origin}/l/${d.link.code}`);
      setCopiedLinkId(page.id);
      setTimeout(() => setCopiedLinkId(null), 2000);
    }
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/p/${slug}`;
    navigator.clipboard.writeText(url);
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
    if (data.ok) {
      setPages((prev) => prev.map((p) => p.id === page.id ? { ...p, isActive: !p.isActive } : p));
    }
    setTogglingId(null);
  };

  const clonePage = async (pageId: string) => {
    setCloningId(pageId);
    const res = await fetch(`/api/landing-pages/${pageId}/clone`, { method: "POST" });
    const data = await res.json();
    if (data.ok) {
      // 목록 새로고침 후 새 페이지 편집화면으로 이동
      const listRes = await fetch("/api/landing-pages");
      const listData = await listRes.json();
      if (listData.ok) setPages(listData.pages);
      router.push(`/landing-pages/${data.page.id}`);
    }
    setCloningId(null);
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-navy-900">랜딩페이지</h1>
          <p className="text-sm text-gray-500 mt-0.5">총 {pages.length}개</p>
        </div>
        <Link
          href="/landing-pages/new"
          className="flex items-center gap-1.5 bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> 새 페이지
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : pages.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📄</p>
          <p className="font-medium text-gray-700">랜딩페이지가 없습니다</p>
          <p className="text-sm text-gray-400 mt-1">+ 새 페이지 버튼으로 만들어보세요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pages.map((page) => (
            <div
              key={page.id}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start gap-3">
                {/* isActive 토글 */}
                <button
                  onClick={() => toggleActive(page)}
                  disabled={togglingId === page.id}
                  title={page.isActive ? "비활성화" : "활성화"}
                  className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 transition-colors ${
                    page.isActive ? "bg-green-400 hover:bg-green-600" : "bg-gray-300 hover:bg-gray-500"
                  } disabled:opacity-50`}
                />

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900">{page.title}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">/p/{page.slug}</p>

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
                    <button
                      onClick={() => loadStats(page.id)}
                      className="text-blue-500 hover:underline"
                    >
                      {loadingStats === page.id ? "로딩..." : statsMap[page.id] ? "새로고침" : "📊 상세 지표"}
                    </button>
                  </div>

                  {/* 3단 퍼널 지표 */}
                  {statsMap[page.id] && (() => {
                    const s = statsMap[page.id]!;
                    return (
                      <div className="mt-3 bg-gray-50 rounded-lg p-3">
                        <p className="text-xs font-semibold text-gray-600 mb-2">퍼널 전환 현황</p>
                        <div className="flex items-center gap-1 text-xs flex-wrap">
                          <span className="bg-white border border-gray-200 rounded px-2 py-1">
                            방문 <strong>{s.viewCount.toLocaleString()}</strong>
                          </span>
                          <span className="text-gray-400">→ {s.rates.visitToRegister}%</span>
                          <span className="bg-blue-50 border border-blue-200 rounded px-2 py-1">
                            등록 <strong>{s.registered}</strong>
                          </span>
                          <span className="text-gray-400">→ {s.rates.registerToFunnel}%</span>
                          <span className="bg-purple-50 border border-purple-200 rounded px-2 py-1">
                            퍼널 <strong>{s.funnelEntered}</strong>
                          </span>
                          <span className="text-gray-400">→ {s.rates.funnelToPurchase}%</span>
                          <span className={`border rounded px-2 py-1 font-semibold ${
                            s.purchased > 0
                              ? "bg-green-50 border-green-300 text-green-700"
                              : "bg-gray-50 border-gray-200 text-gray-400"
                          }`} title="phone 기반 근사치">
                            구매 <strong>{s.purchased}</strong>*
                          </span>
                        </div>
                        {s.viewCount > 0 && s.purchased > 0 && (
                          <p className="text-xs text-green-600 font-medium mt-1.5">
                            전체 전환율: {s.rates.visitToPurchase}%
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* 액션 버튼 */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => createShortLink(page)}
                    className="flex items-center gap-1 px-2 py-1.5 hover:bg-gray-100 rounded-lg text-gray-500 text-xs"
                    title="숏링크 만들기"
                  >
                    {copiedLinkId === page.id ? (
                      <>
                        <Check className="w-4 h-4 text-green-500" />
                        <span className="text-green-500">복사됨</span>
                      </>
                    ) : (
                      <>
                        <Link2 className="w-4 h-4" />
                        <span>숏링크</span>
                      </>
                    )}
                  </button>
                  <a
                    href={`/p/${page.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                    title="미리보기"
                  >
                    <Globe className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => copyLink(page.slug)}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                    title="링크 복사"
                  >
                    {copied === page.slug ? (
                      <span className="text-xs text-green-500 font-medium">복사됨</span>
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => clonePage(page.id)}
                    disabled={cloningId === page.id}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 disabled:opacity-50"
                    title="복제"
                  >
                    {cloningId === page.id
                      ? <span className="text-xs text-blue-500">복제중...</span>
                      : <Files className="w-4 h-4" />}
                  </button>
                  <Link
                    href={`/landing-pages/${page.id}?tab=registrations`}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 relative"
                    title="등록자 목록"
                  >
                    <Eye className="w-4 h-4" />
                    {page._count && page._count.registrations > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                        {page._count.registrations > 9 ? "9+" : page._count.registrations}
                      </span>
                    )}
                  </Link>
                  <Link
                    href={`/landing-pages/${page.id}`}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                    title="편집"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
