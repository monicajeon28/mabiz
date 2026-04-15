"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Eye, Copy, Share2, Edit2, Globe } from "lucide-react";

type LandingPage = {
  id: string;
  title: string;
  slug: string;
  isActive: boolean;
  viewCount: number;
  createdAt: string;
  _count?: { registrations: number };
};

export default function LandingPagesPage() {
  const [pages, setPages]   = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied]   = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/landing-pages")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setPages(d.pages); })
      .finally(() => setLoading(false));
  }, []);

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/p/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(slug);
    setTimeout(() => setCopied(null), 2000);
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
                {/* 상태 인디케이터 */}
                <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${page.isActive ? "bg-green-400" : "bg-gray-300"}`} />

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900">{page.title}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">/p/{page.slug}</p>

                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" /> {page.viewCount.toLocaleString()}회 조회
                    </span>
                    {page._count && (
                      <span>신청 {page._count.registrations}명</span>
                    )}
                    <span>{new Date(page.createdAt).toLocaleDateString("ko-KR")}</span>
                  </div>
                </div>

                {/* 액션 버튼 */}
                <div className="flex items-center gap-1.5 shrink-0">
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
