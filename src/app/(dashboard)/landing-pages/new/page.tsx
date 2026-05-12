"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, ImageIcon, Code, Upload, X, GripVertical, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
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
      <div class="form-group"><label>이름</label><input type="text" placeholder="홍길동"></div>
      <div class="form-group"><label>연락처</label><input type="tel" placeholder="010-1234-5678"></div>
      <button class="submit-btn">신청하기</button>
    </div>
  </div>
</body>
</html>`;

type UploadedImage = {
  id: string;
  assetId: string;
  url: string;
  driveFileId: string;
  width: number;
  height: number;
  mimeType: string;
  fileName: string;
  sortOrder: number;
};

export default function NewLandingPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 공통 state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [editorMode, setEditorMode] = useState<"html" | "image">("image");
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [groups, setGroups] = useState<{ id: string; name: string; funnelId: string | null }[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");

  // HTML 모드
  const [html, setHtml] = useState(STARTER_HTML);

  // 이미지 모드
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [savedPageId, setSavedPageId] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // 결제 설정
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [paymentType, setPaymentType] = useState<"onetime" | "subscription">("onetime");
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [cycleDay, setCycleDay] = useState("1");
  const [expireDate, setExpireDate] = useState("");

  // 고급 설정
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [buttonTitle, setButtonTitle] = useState("");
  const [completionPageUrl, setCompletionPageUrl] = useState("");
  const [headerScript, setHeaderScript] = useState("");
  const [category, setCategory] = useState("");
  const [pageGroup, setPageGroup] = useState("");
  const [description, setDescription] = useState("");

  // 폼 필드 설정
  const [formFieldsEnabled, setFormFieldsEnabled] = useState(false);
  type FieldToggle = { enabled: boolean; required: boolean };
  const [formFields, setFormFields] = useState<Record<string, FieldToggle>>({
    name: { enabled: true, required: true },
    phone: { enabled: true, required: true },
    email: { enabled: false, required: false },
    gender: { enabled: false, required: false },
    birthDate: { enabled: false, required: false },
    address: { enabled: false, required: false },
    marketingConsent: { enabled: false, required: false },
  });
  const [additionalFields, setAdditionalFields] = useState<{ id: string; name: string; required: boolean }[]>([]);

  useEffect(() => {
    fetch("/api/groups").then((r) => r.json()).then((data) => {
      if (data.ok) setGroups(data.groups ?? []);
    });
  }, []);

  const handleTitleChange = (t: string) => {
    setTitle(t);
    if (!slug) setSlug(t.toLowerCase().replace(/[^a-z0-9가-힣]/g, "-").replace(/-+/g, "-"));
  };

  // 이미지형: 먼저 페이지 생성 (이미지 업로드에 landingPageId 필요)
  const ensurePage = useCallback(async (): Promise<string | null> => {
    if (savedPageId) return savedPageId;
    if (!title.trim()) { setError("제목을 먼저 입력하세요."); return null; }
    const s = slug.trim() || title.toLowerCase().replace(/[^a-z0-9가-힣]/g, "-").replace(/-+/g, "-");
    setSlug(s);

    const res = await fetch("/api/landing-pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, slug: s, htmlContent: "", editorMode: "image", groupId: selectedGroupId || null }),
    });
    const data = await res.json();
    if (!data.ok) { setError(data.message ?? "페이지 생성 실패"); return null; }
    setSavedPageId(data.page.id);
    return data.page.id;
  }, [savedPageId, title, slug, selectedGroupId]);

  // 이미지 업로드
  const uploadFiles = async (files: FileList) => {
    const pageId = await ensurePage();
    if (!pageId) return;

    setUploading(true);
    setError("");

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 20 * 1024 * 1024) { setError(`${file.name}: 20MB 초과`); continue; }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("landingPageId", pageId);
      formData.append("sortOrder", String(images.length + i));

      try {
        const res = await fetch("/api/landing-pages/images", { method: "POST", body: formData });
        const data = await res.json();
        if (data.ok) {
          setImages((prev) => [...prev, data.image]);
        } else {
          setError(data.message ?? `${file.name} 업로드 실패`);
        }
      } catch {
        setError(`${file.name} 업로드 중 오류`);
      }
    }
    setUploading(false);
  };

  // 드래그 순서 변경
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const newImages = [...images];
    const [moved] = newImages.splice(dragIdx, 1);
    newImages.splice(idx, 0, moved);
    setImages(newImages);
    setDragIdx(idx);
  };
  const handleDragEnd = async () => {
    setDragIdx(null);
    if (!savedPageId) return;
    await fetch("/api/landing-pages/images", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ landingPageId: savedPageId, imageIds: images.map((img) => img.id) }),
    });
  };

  // 이미지 삭제
  const removeImage = async (id: string) => {
    await fetch("/api/landing-pages/images", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  // 이미지형 → htmlContent 자동 생성
  const buildHtmlFromImages = (): string => {
    const imgTags = images.map((img) => {
      const src = `https://lh3.googleusercontent.com/d/${img.driveFileId}=w1200`;
      const ar = img.width && img.height ? `aspect-ratio:${img.width}/${img.height};` : "";
      return `<img src="${src}" alt="랜딩페이지 이미지" style="width:100%;display:block;${ar}" loading="lazy" />`;
    }).join("\n");

    return `<div style="margin:0;padding:0;line-height:0;background:#fff;">
${imgTags}
</div>
<form style="max-width:480px;margin:0 auto;padding:32px 20px 48px;background:#fff;font-family:'Pretendard',sans-serif;">
  <h3 style="text-align:center;font-size:22px;font-weight:700;color:#1a1a1a;margin:0 0 8px;">지금 바로 신청하세요</h3>
  <p style="text-align:center;font-size:14px;color:#888;margin:0 0 24px;">상담 신청 후 담당자가 연락드립니다</p>
  <input type="text" name="name" placeholder="이름" required style="width:100%;padding:14px 16px;border:1px solid #ddd;border-radius:10px;font-size:15px;margin-bottom:12px;box-sizing:border-box;outline:none;" />
  <input type="tel" name="phone" placeholder="연락처 (010-0000-0000)" required style="width:100%;padding:14px 16px;border:1px solid #ddd;border-radius:10px;font-size:15px;margin-bottom:16px;box-sizing:border-box;outline:none;" />
  <button type="submit" style="width:100%;padding:16px;background:#FF6B35;color:#fff;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;">신청하기</button>
</form>`;
  };

  // 공통 설정 객체
  const getAdvancedSettings = () => ({
    ...(buttonTitle ? { buttonTitle } : {}),
    ...(completionPageUrl ? { completionPageUrl } : {}),
    ...(headerScript ? { headerScript } : {}),
    ...(category ? { category } : {}),
    ...(pageGroup ? { pageGroup } : {}),
    ...(description ? { description } : {}),
    ...(formFieldsEnabled ? {
      infoCollection: true,
      formConfig: { fields: formFields, additionalFields },
    } : {}),
  });

  const getPaymentSettings = () => paymentEnabled ? {
    paymentEnabled: true, paymentType, productName,
    productPrice: parseInt(productPrice) || 0,
    ...(paymentType === "subscription" ? { cycleDay: parseInt(cycleDay), expireDate } : {}),
  } : {};

  // 저장
  const save = async () => {
    if (!title.trim() || !slug.trim()) { setError("제목과 슬러그를 입력하세요."); return; }
    setSaving(true);
    setError("");

    const common = {
      title, slug, groupId: selectedGroupId || null,
      ...getAdvancedSettings(), ...getPaymentSettings(),
    };

    if (editorMode === "image") {
      const pageId = savedPageId || (await ensurePage());
      if (!pageId) { setSaving(false); return; }
      const generatedHtml = buildHtmlFromImages();
      const res = await fetch(`/api/landing-pages/${pageId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...common, htmlContent: generatedHtml, editorMode: "image" }),
      });
      const data = await res.json();
      if (data.ok) router.push(`/landing-pages/${pageId}`);
      else { setError(data.message ?? "저장 실패"); setSaving(false); }
    } else {
      const res = await fetch("/api/landing-pages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...common, htmlContent: html, editorMode: "html" }),
      });
      const data = await res.json();
      if (data.ok) router.push(`/landing-pages/${data.page.id}`);
      else { setError(data.message ?? "저장 실패"); setSaving(false); }
    }
  };

  // 이미지형 미리보기 HTML
  const previewHtml = editorMode === "image" ? buildHtmlFromImages() : html;

  return (
    <div className="h-screen flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white shrink-0">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 flex items-center gap-3">
          <input
            type="text" placeholder="랜딩페이지 제목" value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="flex-1 text-lg font-semibold border-0 focus:outline-none bg-transparent"
          />
          <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg">
            <span>/p/</span>
            <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)}
              className="bg-transparent border-0 focus:outline-none w-32 text-gray-600" placeholder="my-page" />
          </div>
        </div>

        {/* 모드 토글 */}
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button onClick={() => setEditorMode("image")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              editorMode === "image" ? "bg-white text-navy-900 shadow-sm" : "text-gray-500"}`}>
            <ImageIcon className="w-4 h-4" /> 이미지형
          </button>
          <button onClick={() => setEditorMode("html")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              editorMode === "html" ? "bg-white text-navy-900 shadow-sm" : "text-gray-500"}`}>
            <Code className="w-4 h-4" /> HTML형
          </button>
        </div>

        <button onClick={() => setPreview(!preview)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${
            preview ? "bg-navy-900 text-white" : "bg-gray-100 text-gray-700"}`}>
          <Eye className="w-4 h-4" /> {preview ? "에디터" : "미리보기"}
        </button>
        <button onClick={save} disabled={saving}
          className="bg-gold-500 text-navy-900 px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-gold-300 disabled:opacity-50">
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>

      {error && <p className="text-red-500 text-sm px-4 py-2 bg-red-50">{error}</p>}

      {/* 설정 패널 */}
      <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 shrink-0">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">등록 고객 자동 배정 그룹</label>
          <select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)}
            className="flex-1 max-w-sm border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-gold-500 bg-white">
            <option value="">그룹 미지정 (자동 배정 없음)</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name} {g.funnelId ? "🔄" : ""}</option>)}
          </select>
          <p className="text-xs text-gray-400">🔄 = 퍼널 연결됨 — 등록 즉시 자동 문자 발송</p>
        </div>
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-200">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap flex items-center gap-2">
            <input type="checkbox" checked={paymentEnabled} onChange={(e) => setPaymentEnabled(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
            결제 기능 활성화
          </label>
        </div>
        {paymentEnabled && (
          <div className="flex flex-wrap items-center gap-3 mt-2 pl-6">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">결제 유형</label>
              <select value={paymentType} onChange={(e) => setPaymentType(e.target.value as "onetime" | "subscription")}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm bg-white">
                <option value="onetime">일반 결제</option>
                <option value="subscription">정기 결제 (월)</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">상품명</label>
              <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)}
                placeholder="크루즈 여행 상품" className="border border-gray-300 rounded-lg px-2 py-1 text-sm w-40" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">금액</label>
              <input type="number" value={productPrice} onChange={(e) => setProductPrice(e.target.value)}
                placeholder="100000" className="border border-gray-300 rounded-lg px-2 py-1 text-sm w-28" />
              <span className="text-xs text-gray-400">원</span>
            </div>
            {paymentType === "subscription" && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">매월 결제일</label>
                  <select value={cycleDay} onChange={(e) => setCycleDay(e.target.value)}
                    className="border border-gray-300 rounded-lg px-2 py-1 text-sm bg-white">
                    {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}일</option>)}
                    <option value="90">말일</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">만료일</label>
                  <input type="date" value={expireDate} onChange={(e) => setExpireDate(e.target.value)}
                    className="border border-gray-300 rounded-lg px-2 py-1 text-sm" />
                </div>
              </>
            )}
          </div>
        )}

        {/* 고급 설정 (접이식) */}
        <div className="mt-3 pt-3 border-t border-gray-200">
          <button onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900">
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            고급 설정
          </button>
          {showAdvanced && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">신청 버튼 텍스트</label>
                  <input type="text" value={buttonTitle} onChange={(e) => setButtonTitle(e.target.value)}
                    placeholder="신청하기 (기본)" className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">완료 후 이동 URL</label>
                  <input type="url" value={completionPageUrl} onChange={(e) => setCompletionPageUrl(e.target.value)}
                    placeholder="https://..." className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">카테고리</label>
                  <input type="text" value={category} onChange={(e) => setCategory(e.target.value)}
                    placeholder="크루즈 / 교육 / 이벤트" className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">페이지 그룹</label>
                  <input type="text" value={pageGroup} onChange={(e) => setPageGroup(e.target.value)}
                    placeholder="2024 상반기" className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">페이지 설명 (관리용)</label>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="내부 메모용" className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">헤더 스크립트 (픽셀/GA 코드)</label>
                <textarea value={headerScript} onChange={(e) => setHeaderScript(e.target.value)}
                  placeholder="<!-- Facebook Pixel, Google Analytics 등 -->"
                  rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-mono" />
              </div>

              {/* 폼 필드 ON/OFF */}
              <div className="pt-3 border-t border-gray-100">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-3">
                  <input type="checkbox" checked={formFieldsEnabled} onChange={(e) => setFormFieldsEnabled(e.target.checked)} className="w-4 h-4 rounded" />
                  신청 폼 필드 커스텀
                </label>
                {formFieldsEnabled && (
                  <div className="space-y-2 pl-6">
                    {Object.entries(formFields).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-3">
                        <label className="flex items-center gap-2 w-32 text-sm">
                          <input type="checkbox" checked={val.enabled}
                            onChange={() => setFormFields((prev) => ({
                              ...prev, [key]: { enabled: !prev[key].enabled, required: !prev[key].enabled ? prev[key].required : false },
                            }))} className="w-4 h-4 rounded" />
                          {{ name: "이름", phone: "연락처", email: "이메일", gender: "성별", birthDate: "생년월일", address: "주소", marketingConsent: "마케팅동의" }[key]}
                        </label>
                        <label className="flex items-center gap-1 text-xs text-gray-400">
                          <input type="checkbox" checked={val.required} disabled={!val.enabled}
                            onChange={() => setFormFields((prev) => ({ ...prev, [key]: { ...prev[key], required: !prev[key].required } }))}
                            className="w-3 h-3 rounded" />
                          필수
                        </label>
                      </div>
                    ))}
                    {/* 커스텀 질문 */}
                    <div className="mt-3 pt-2 border-t border-gray-100">
                      <p className="text-xs text-gray-500 mb-2">추가 질문</p>
                      {additionalFields.map((f, idx) => (
                        <div key={f.id} className="flex items-center gap-2 mb-2">
                          <input type="text" value={f.name}
                            onChange={(e) => setAdditionalFields((prev) => prev.map((p, i) => i === idx ? { ...p, name: e.target.value } : p))}
                            placeholder="질문 내용" className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm" />
                          <label className="flex items-center gap-1 text-xs text-gray-400">
                            <input type="checkbox" checked={f.required}
                              onChange={() => setAdditionalFields((prev) => prev.map((p, i) => i === idx ? { ...p, required: !p.required } : p))}
                              className="w-3 h-3" /> 필수
                          </label>
                          <button onClick={() => setAdditionalFields((prev) => prev.filter((_, i) => i !== idx))}
                            className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                      <button onClick={() => setAdditionalFields((prev) => [...prev, { id: crypto.randomUUID(), name: "", required: false }])}
                        className="flex items-center gap-1 text-xs text-gold-600 hover:text-gold-800 mt-1">
                        <Plus className="w-3.5 h-3.5" /> 질문 추가
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 에디터 / 미리보기 */}
      <div className="flex-1 overflow-hidden">
        {preview ? (
          <iframe srcDoc={previewHtml} className="w-full h-full border-0" title="미리보기" sandbox="allow-scripts" />
        ) : editorMode === "html" ? (
          <div className="h-full overflow-y-auto p-4">
            <HtmlEditor value={html} onChange={setHtml} height="calc(100vh - 200px)" />
          </div>
        ) : (
          /* 이미지형 에디터 */
          <div className="h-full overflow-y-auto p-6 bg-gray-50">
            <div className="max-w-2xl mx-auto">
              {/* 업로드 영역 */}
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors mb-6 ${
                  uploading ? "border-gold-400 bg-gold-50" : "border-gray-300 hover:border-gold-400 hover:bg-gray-100"
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files); }}
              >
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-600">
                  {uploading ? "업로드 중..." : "이미지를 드래그하거나 클릭하여 업로드"}
                </p>
                <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP → 자동 WebP 변환 / GIF → 압축 유지 / 최대 20MB</p>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ""; }} />
              </div>

              {/* 이미지 목록 (드래그 순서 변경) */}
              {images.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">이미지 {images.length}장 — 드래그로 순서 변경</p>
                  {images.map((img, idx) => (
                    <div
                      key={img.id}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-3 bg-white rounded-xl border p-3 transition-all ${
                        dragIdx === idx ? "border-gold-400 shadow-lg scale-[1.02]" : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <GripVertical className="w-5 h-5 text-gray-300 cursor-grab shrink-0" />
                      <div className="w-20 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{img.fileName}</p>
                        <p className="text-xs text-gray-400">{img.width}x{img.height} · {img.mimeType}</p>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">#{idx + 1}</span>
                      <button onClick={() => removeImage(img.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {images.length === 0 && !uploading && (
                <div className="text-center py-12 text-gray-400">
                  <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">이미지를 업로드하면 랜딩페이지가 자동으로 만들어집니다</p>
                  <p className="text-sm mt-2">이미지가 세로로 쌓이고, 맨 아래에 신청 폼이 자동으로 붙습니다</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
