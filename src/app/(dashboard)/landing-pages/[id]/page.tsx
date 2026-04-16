"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, Users, ChevronLeft, ChevronRight } from "lucide-react";
import dynamic from "next/dynamic";

type Registration = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  utmSource: string | null;
  funnelStarted: boolean;
  createdAt: string;
};

const HtmlEditor = dynamic(
  () => import("@/components/editor/HtmlEditor").then((m) => m.HtmlEditor),
  { ssr: false, loading: () => <div className="h-96 bg-gray-100 animate-pulse rounded-xl" /> }
);

export default function EditLandingPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const [tab, setTab]           = useState<"editor" | "registrations">(
    searchParams.get("tab") === "registrations" ? "registrations" : "editor"
  );
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

  // 등록자 목록
  const [registrations, setRegistrations]     = useState<Registration[]>([]);
  const [regTotal,       setRegTotal]          = useState(0);
  const [regPage,        setRegPage]           = useState(1);
  const [regLoading,     setRegLoading]        = useState(false);

  useEffect(() => {
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

  const loadRegistrations = async (p: number) => {
    setRegLoading(true);
    const res = await fetch(`/api/landing-pages/${id}/registrations?page=${p}&limit=20`);
    const data = await res.json();
    if (data.ok) {
      setRegistrations(data.registrations);
      setRegTotal(data.total);
      setRegPage(p);
    }
    setRegLoading(false);
  };

  useEffect(() => {
    if (tab === "registrations") loadRegistrations(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, id]);

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
        {/* 탭 전환 */}
        <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs">
          <button
            onClick={() => setTab("editor")}
            className={`px-3 py-1.5 font-medium transition-colors ${tab === "editor" ? "bg-navy-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}
          >편집</button>
          <button
            onClick={() => setTab("registrations")}
            className={`px-3 py-1.5 font-medium flex items-center gap-1 transition-colors ${tab === "registrations" ? "bg-navy-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}
          >
            <Users className="w-3 h-3" /> 등록자 {regTotal > 0 && `(${regTotal})`}
          </button>
        </div>
        {tab === "editor" && (
          <>
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
          </>
        )}
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

      {/* 에디터 탭 */}
      {tab === "editor" && (
        <>
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
          <div className="flex-1 overflow-hidden">
            {preview ? (
              <iframe srcDoc={html} className="w-full h-full border-0" title="preview" />
            ) : (
              <HtmlEditor value={html} onChange={setHtml} />
            )}
          </div>
        </>
      )}

      {/* 등록자 목록 탭 */}
      {tab === "registrations" && (
        <div className="flex-1 overflow-y-auto p-4">
          {regLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : registrations.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">아직 등록자가 없습니다.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-3">총 <strong>{regTotal}</strong>명 등록</p>
              <div className="space-y-2">
                {registrations.map((r) => (
                  <div key={r.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{r.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{r.phone}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleString("ko-KR")}</p>
                      <div className="flex items-center gap-1.5 justify-end mt-0.5">
                        {r.funnelStarted && (
                          <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-medium">퍼널진입</span>
                        )}
                        {r.utmSource && (
                          <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">{r.utmSource}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* 페이지네이션 */}
              {regTotal > 20 && (
                <div className="flex items-center justify-center gap-3 mt-4">
                  <button
                    onClick={() => loadRegistrations(regPage - 1)}
                    disabled={regPage === 1}
                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-gray-500">{regPage} / {Math.ceil(regTotal / 20)}</span>
                  <button
                    onClick={() => loadRegistrations(regPage + 1)}
                    disabled={regPage >= Math.ceil(regTotal / 20)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
