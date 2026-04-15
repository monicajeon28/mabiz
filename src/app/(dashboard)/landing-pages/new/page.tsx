"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import dynamic from "next/dynamic";

const HtmlEditor = dynamic(
  () => import("@/components/editor/HtmlEditor").then((m) => m.HtmlEditor),
  { ssr: false, loading: () => <div className="h-96 bg-gray-100 animate-pulse rounded-xl" /> }
);

const STARTER_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>랜딩페이지 제목</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Pretendard', sans-serif; color: #111827; }
    .hero { background: linear-gradient(135deg, #1E2D4E 0%, #2A4080 100%); color: white; padding: 60px 20px; text-align: center; }
    .hero h1 { font-size: clamp(24px, 5vw, 48px); font-weight: 800; margin-bottom: 16px; }
    .hero p { font-size: 18px; opacity: 0.9; margin-bottom: 32px; }
    .cta-btn { display: inline-block; background: #C9A84C; color: #1E2D4E; padding: 16px 40px; border-radius: 999px; font-weight: 700; font-size: 18px; text-decoration: none; }
    .section { padding: 60px 20px; max-width: 800px; margin: 0 auto; }
    .form-box { background: #f7f8fc; border-radius: 16px; padding: 32px; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; font-weight: 600; margin-bottom: 6px; }
    .form-group input { width: 100%; padding: 12px; border: 1px solid #e2e6ef; border-radius: 8px; font-size: 16px; }
    .submit-btn { width: 100%; background: #1E2D4E; color: white; padding: 16px; border: none; border-radius: 8px; font-size: 18px; font-weight: 700; cursor: pointer; }
  </style>
</head>
<body>
  <div class="hero">
    <h1>🚢 지중해 크루즈 특가</h1>
    <p>지금 신청하고 얼리버드 혜택을 받으세요!</p>
    <a href="#form" class="cta-btn">지금 신청하기</a>
  </div>

  <div class="section" id="form">
    <h2 style="text-align:center;margin-bottom:32px;font-size:28px;">신청 정보 입력</h2>
    <div class="form-box">
      <div class="form-group">
        <label>이름</label>
        <input type="text" placeholder="홍길동">
      </div>
      <div class="form-group">
        <label>연락처</label>
        <input type="tel" placeholder="010-1234-5678">
      </div>
      <button class="submit-btn">신청하기</button>
    </div>
  </div>
</body>
</html>`;

export default function NewLandingPage() {
  const router  = useRouter();
  const [title, setTitle]       = useState("");
  const [slug, setSlug]         = useState("");
  const [html, setHtml]         = useState(STARTER_HTML);
  const [preview, setPreview]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [groups, setGroups]     = useState<{ id: string; name: string; funnelId: string | null }[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  useEffect(() => {
    fetch("/api/groups").then((r) => r.json()).then((data) => {
      if (data.ok) setGroups(data.groups ?? []);
    });
  }, []);

  const handleTitleChange = (t: string) => {
    setTitle(t);
    if (!slug) {
      setSlug(t.toLowerCase().replace(/[^a-z0-9가-힣]/g, "-").replace(/-+/g, "-"));
    }
  };

  const save = async () => {
    if (!title.trim() || !slug.trim()) {
      setError("제목과 슬러그를 입력하세요.");
      return;
    }
    setSaving(true);
    setError("");
    const res  = await fetch("/api/landing-pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, slug, htmlContent: html, groupId: selectedGroupId || null }),
    });
    const data = await res.json();
    if (data.ok) {
      router.push(`/landing-pages/${data.page.id}`);
    } else {
      setError(data.message ?? "저장 실패");
      setSaving(false);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white shrink-0">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 flex items-center gap-3">
          <input
            type="text"
            placeholder="랜딩페이지 제목"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="flex-1 text-lg font-semibold border-0 focus:outline-none bg-transparent"
          />
          <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg">
            <span>/p/</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="bg-transparent border-0 focus:outline-none w-32 text-gray-600"
              placeholder="my-page"
            />
          </div>
        </div>
        <button
          onClick={() => setPreview(!preview)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${
            preview ? "bg-navy-900 text-white" : "bg-gray-100 text-gray-700"
          }`}
        >
          <Eye className="w-4 h-4" />
          {preview ? "에디터" : "미리보기"}
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="bg-gold-500 text-navy-900 px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-gold-300 disabled:opacity-50"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>

      {error && <p className="text-red-500 text-sm px-4 py-2 bg-red-50">{error}</p>}

      {/* 설정 패널 */}
      <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 shrink-0">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
            등록 고객 자동 배정 그룹
          </label>
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="flex-1 max-w-sm border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-gold-500 bg-white"
          >
            <option value="">그룹 미지정 (자동 배정 없음)</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} {g.funnelId ? "🔄" : ""}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-400">🔄 = 퍼널 연결됨 — 등록 즉시 자동 문자 발송</p>
        </div>
      </div>

      {/* 에디터 / 미리보기 */}
      <div className="flex-1 overflow-hidden">
        {preview ? (
          <iframe
            srcDoc={html}
            className="w-full h-full border-0"
            title="미리보기"
            sandbox="allow-scripts allow-same-origin"
          />
        ) : (
          <div className="h-full overflow-y-auto p-4">
            <HtmlEditor value={html} onChange={setHtml} height="calc(100vh - 200px)" />
          </div>
        )}
      </div>
    </div>
  );
}
