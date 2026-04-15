"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import dynamic from "next/dynamic";

const HtmlEditor = dynamic(
  () => import("@/components/editor/HtmlEditor").then((m) => m.HtmlEditor),
  { ssr: false, loading: () => <div className="h-96 bg-gray-100 animate-pulse rounded-xl" /> }
);

export default function EditLandingPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [title, setTitle]       = useState("");
  const [slug, setSlug]         = useState("");
  const [html, setHtml]         = useState("");
  const [preview, setPreview]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [saveMsg, setSaveMsg]   = useState("");
  const [groups, setGroups]     = useState<{ id: string; name: string; funnelId: string | null }[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  useEffect(() => {
    // 기존 데이터 + 그룹 목록 병렬 로드
    Promise.all([
      fetch(`/api/landing-pages/${id}`).then((r) => r.json()),
      fetch("/api/groups").then((r) => r.json()),
    ]).then(([pageData, groupData]) => {
      if (pageData.ok && pageData.page) {
        setTitle(pageData.page.title ?? "");
        setSlug(pageData.page.slug ?? "");
        setHtml(pageData.page.htmlContent ?? "");
        setSelectedGroupId(pageData.page.groupId ?? "");
      }
      if (groupData.ok) setGroups(groupData.groups ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const save = async () => {
    if (!title.trim() || !slug.trim()) {
      setError("제목과 슬러그를 입력하세요.");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/landing-pages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, slug, htmlContent: html, groupId: selectedGroupId || null }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.ok) {
      setSaveMsg("저장됐어요!");
      setTimeout(() => setSaveMsg(""), 2000);
    } else {
      setError(data.message ?? "저장 실패");
    }
  };

  if (loading) return <div className="h-screen bg-gray-50 animate-pulse" />;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="랜딩페이지 제목"
          className="flex-1 text-base font-semibold bg-transparent outline-none"
        />
        <button onClick={() => setPreview(!preview)} className="text-gray-500 hover:text-navy-900 p-1.5">
          <Eye className="w-4 h-4" />
        </button>
        {error && <span className="text-xs text-red-500">{error}</span>}
        {saveMsg && <span className="text-xs text-green-600">{saveMsg}</span>}
        <button
          onClick={save}
          disabled={saving}
          className="bg-navy-900 text-white px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>

      {/* 설정 바 */}
      <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 whitespace-nowrap">슬러그</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="url-slug"
            className="border border-gray-200 rounded px-2 py-1 text-xs w-40 focus:outline-none focus:border-gold-500"
          />
        </div>
        <div className="flex items-center gap-2 flex-1">
          <label className="text-xs text-gray-500 whitespace-nowrap">등록 고객 배정 그룹</label>
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="border border-gray-200 rounded px-2 py-1 text-xs flex-1 max-w-xs focus:outline-none focus:border-gold-500"
          >
            <option value="">그룹 미지정</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} {g.funnelId ? "🔄" : ""}
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-400">🔄 = 등록 즉시 자동 문자</span>
        </div>
      </div>

      {/* 에디터 / 프리뷰 */}
      <div className="flex-1 overflow-hidden">
        {preview ? (
          <iframe srcDoc={html} className="w-full h-full border-0" title="preview" />
        ) : (
          <HtmlEditor value={html} onChange={setHtml} />
        )}
      </div>
    </div>
  );
}
