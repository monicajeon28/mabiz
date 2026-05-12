"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ImageIcon, Code, Upload, X, GripVertical, Plus, Trash2, Smartphone } from "lucide-react";
import dynamic from "next/dynamic";
import { ImageLibraryModal } from "@/components/image-library/ImageLibraryModal";

const HtmlEditor = dynamic(
  () => import("@/components/editor/HtmlEditor").then((m) => m.HtmlEditor),
  { ssr: false, loading: () => <div className="h-96 bg-gray-100 animate-pulse rounded-xl" /> }
);

type UploadedImage = {
  id: string; assetId: string; url: string; driveFileId: string;
  fullUrl?: string;  // 라이브러리 이미지는 원본 URL 별도 보관
  width: number; height: number; mimeType: string; fileName: string; sortOrder: number;
};

/** 라이브러리 HTML에서 Drive fileId + 썸네일 URL 추출 */
function extractDriveInfo(html: string): { url: string; driveFileId: string; fullUrl: string } | null {
  const srcset = html.match(/srcset="([^"]+)"/)?.[1];
  const src    = html.match(/src="([^"]+)"/)?.[1];
  const rawUrl = srcset ?? src;
  if (!rawUrl) return null;
  try {
    const u = new URL(rawUrl);
    // drive.google.com/thumbnail?id=FILE_ID
    if (u.hostname === "drive.google.com" && u.searchParams.get("id")) {
      const fileId = u.searchParams.get("id")!;
      return {
        url:         `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`,
        fullUrl:     `https://drive.google.com/thumbnail?id=${fileId}&sz=w1920`,
        driveFileId: fileId,
      };
    }
    // lh3.googleusercontent.com/d/FILE_ID=w...
    if (u.hostname === "lh3.googleusercontent.com") {
      const fileId = u.pathname.split("/d/")[1]?.split("=")[0] ?? "";
      if (fileId) return {
        url:         `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`,
        fullUrl:     `https://drive.google.com/thumbnail?id=${fileId}&sz=w1920`,
        driveFileId: fileId,
      };
    }
    return null;
  } catch { return null; }
}
type FieldToggle = { enabled: boolean; required: boolean };

const FIELD_LABELS: Record<string, string> = {
  phone: "연락처", name: "이름", email: "이메일",
  gender: "성별", birthDate: "생년월일", address: "주소", marketingConsent: "마케팅동의",
};

export default function NewLandingPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iframeRef    = useRef<HTMLIFrameElement>(null);

  const [title, setTitle]               = useState("");
  const [slug, setSlug]                 = useState("");
  const [editorMode, setEditorMode]     = useState<"html" | "image">("image");
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState("");
  const [groups, setGroups]             = useState<{ id: string; name: string; funnelId: string | null }[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");

  // HTML 에디터 — 백지 시작
  const [html, setHtml] = useState("");

  // 이미지 모드
  const [images, setImages]         = useState<UploadedImage[]>([]);
  const [uploading, setUploading]   = useState(false);
  const [savedPageId, setSavedPageId] = useState<string | null>(null);
  const [dragIdx, setDragIdx]       = useState<number | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);

  // 결제
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [paymentType, setPaymentType]       = useState<"onetime" | "subscription">("onetime");
  const [productName, setProductName]       = useState("");
  const [productPrice, setProductPrice]     = useState("");
  const [cycleDay, setCycleDay]             = useState("1");
  const [expireDate, setExpireDate]         = useState("");

  // 기타
  const [buttonTitle, setButtonTitle]           = useState("");
  const [completionPageUrl, setCompletionPageUrl] = useState("");
  const [headerScript, setHeaderScript]           = useState("");
  const [description, setDescription]             = useState("");

  // 폼 필드
  const [formFields, setFormFields] = useState<Record<string, FieldToggle>>({
    phone:             { enabled: true,  required: true  },
    name:              { enabled: true,  required: true  },
    email:             { enabled: false, required: false },
    gender:            { enabled: false, required: false },
    birthDate:         { enabled: false, required: false },
    address:           { enabled: false, required: false },
    marketingConsent:  { enabled: false, required: false },
  });
  const [additionalFields, setAdditionalFields] = useState<{ id: string; name: string; required: boolean }[]>([]);


  useEffect(() => {
    fetch("/api/groups").then((r) => r.json()).then((d) => {
      if (d.ok) setGroups(d.groups ?? []);
    });
  }, []);

  const handleTitleChange = (t: string) => {
    setTitle(t);
    if (!slug) setSlug(t.toLowerCase().replace(/[^a-z0-9가-힣]/g, "-").replace(/-+/g, "-"));
  };

  // ──────────────────────────────────────────────
  // buildPreviewHtml: 현재 state → 완전한 HTML 문서
  // ──────────────────────────────────────────────
  const buildPreviewHtml = useCallback((): string => {
    const req = (r: boolean) => r ? " <span style='color:#e53e3e;font-size:11px'>*</span>" : "";

    const fieldHtmls = Object.entries(formFields)
      .filter(([, v]) => v.enabled)
      .map(([key, val]) => {
        if (key === "marketingConsent") return `
<label style="display:flex;align-items:flex-start;gap:8px;font-size:13px;color:#555;cursor:pointer;padding:6px 0;">
  <input type="checkbox" style="margin-top:2px;width:16px;height:16px;accent-color:#1E2D4E;" ${val.required ? "required" : ""}>
  <span>마케팅 정보 수신에 동의합니다${req(val.required)}</span>
</label>`;
        if (key === "gender") return `
<div style="margin-bottom:12px">
  <label style="display:block;font-size:13px;font-weight:600;color:#333;margin-bottom:5px">${FIELD_LABELS[key]}${req(val.required)}</label>
  <select style="width:100%;padding:11px 13px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:15px;background:#fff;outline:none" ${val.required ? "required" : ""}>
    <option value="">선택해주세요</option><option value="male">남성</option><option value="female">여성</option>
  </select>
</div>`;
        const type = key === "email" ? "email" : key === "birthDate" ? "date" : key === "phone" ? "tel" : "text";
        const ph   = key === "phone" ? "010-0000-0000" : key === "email" ? "example@email.com" : `${FIELD_LABELS[key]} 입력`;
        return `
<div style="margin-bottom:12px">
  <label style="display:block;font-size:13px;font-weight:600;color:#333;margin-bottom:5px">${FIELD_LABELS[key]}${req(val.required)}</label>
  <input type="${type}" placeholder="${ph}" style="width:100%;padding:11px 13px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:15px;outline:none;box-sizing:border-box" ${val.required ? "required" : ""}>
</div>`;
      });

    additionalFields.forEach((f) => {
      if (!f.name.trim()) return;
      fieldHtmls.push(`
<div style="margin-bottom:12px">
  <label style="display:block;font-size:13px;font-weight:600;color:#333;margin-bottom:5px">${f.name}${req(f.required)}</label>
  <input type="text" placeholder="${f.name} 입력" style="width:100%;padding:11px 13px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:15px;outline:none;box-sizing:border-box" ${f.required ? "required" : ""}>
</div>`);
    });

    const paymentBlock = paymentEnabled ? `
<div style="margin:16px 0 12px;padding:14px 16px;background:#fffbeb;border-radius:10px;border:1px solid #f0d060">
  <p style="font-size:12px;font-weight:600;color:#7c5700;margin:0 0 3px">결제 금액</p>
  <p style="font-size:24px;font-weight:800;color:#1a1a1a;margin:0">${productPrice ? Number(productPrice).toLocaleString() : "0"}원${paymentType === "subscription" ? "/월" : ""}</p>
  ${productName ? `<p style="font-size:12px;color:#666;margin:3px 0 0">${productName}</p>` : ""}
</div>` : "";

    const formBlock = fieldHtmls.length > 0 || paymentEnabled ? `
<div style="max-width:480px;margin:0 auto;padding:28px 20px 48px;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Pretendard',sans-serif">
  ${title ? `<h3 style="text-align:center;font-size:19px;font-weight:700;color:#1a1a1a;margin:0 0 4px">${title}</h3>` : ""}
  <p style="text-align:center;font-size:13px;color:#888;margin:0 0 20px">상담 신청 후 담당자가 연락드립니다</p>
  <form>
    ${fieldHtmls.join("\n    ")}
    ${paymentBlock}
    <button type="submit" style="width:100%;padding:15px;background:#1E2D4E;color:#fff;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;margin-top:6px">${buttonTitle || "신청하기"}</button>
  </form>
</div>` : "";

    let bodyContent: string;
    if (editorMode === "html") {
      bodyContent = html.trim() || `<div style="height:180px;display:flex;align-items:center;justify-content:center;background:#f7f8fc;color:#bbb;font-family:sans-serif;font-size:13px">HTML을 입력하면 여기에 표시됩니다</div>`;
    } else {
      bodyContent = images.length > 0
        ? `<div style="line-height:0">${images.map((img) => {
            const ar = img.width && img.height ? `aspect-ratio:${img.width}/${img.height};` : "";
            return `<img src="${img.url}" alt="" style="width:100%;display:block;${ar}" loading="lazy">`;
          }).join("\n")}</div>`
        : `<div style="height:180px;display:flex;align-items:center;justify-content:center;background:#f7f8fc;color:#bbb;font-family:sans-serif;font-size:13px">이미지를 업로드하면 여기에 표시됩니다</div>`;
    }

    return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#fff;}</style>
${headerScript || ""}
</head>
<body>
${bodyContent}
${formBlock}
</body>
</html>`;
  }, [editorMode, html, images, formFields, additionalFields, paymentEnabled, productName, productPrice, paymentType, buttonTitle, title, headerScript]);

  // state 변경 시마다 iframe에 직접 write (srcDoc 방식은 기존 iframe 업데이트 안 됨)
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(buildPreviewHtml());
    doc.close();
  }, [buildPreviewHtml]);

  // ──────────────────────────────────────────────
  // 이미지 업로드 / 정렬 / 삭제
  // ──────────────────────────────────────────────
  const ensurePage = useCallback(async (): Promise<string | null> => {
    if (savedPageId) return savedPageId;
    if (!title.trim()) { setError("제목을 먼저 입력하세요."); return null; }
    const s = slug.trim() || title.toLowerCase().replace(/[^a-z0-9가-힣]/g, "-").replace(/-+/g, "-");
    setSlug(s);
    const res  = await fetch("/api/landing-pages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, slug: s, htmlContent: "", editorMode: "image", groupId: selectedGroupId || null }),
    });
    const data = await res.json();
    if (!data.ok) { setError(data.message ?? "페이지 생성 실패"); return null; }
    setSavedPageId(data.page.id);
    return data.page.id;
  }, [savedPageId, title, slug, selectedGroupId]);

  const uploadFiles = async (files: FileList) => {
    const pageId = await ensurePage();
    if (!pageId) return;
    setUploading(true); setError("");
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 20 * 1024 * 1024) { setError(`${file.name}: 20MB 초과`); continue; }
      const fd = new FormData();
      fd.append("file", file); fd.append("landingPageId", pageId); fd.append("sortOrder", String(images.length + i));
      try {
        const res  = await fetch("/api/landing-pages/images", { method: "POST", body: fd });
        const data = await res.json();
        if (data.ok) setImages((prev) => [...prev, data.image]);
        else setError(data.message ?? `${file.name} 업로드 실패`);
      } catch { setError(`${file.name} 업로드 중 오류`); }
    }
    setUploading(false);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const arr = [...images]; const [moved] = arr.splice(dragIdx, 1); arr.splice(idx, 0, moved);
    setImages(arr); setDragIdx(idx);
  };
  const handleDragEnd = async () => {
    setDragIdx(null);
    if (!savedPageId) return;
    await fetch("/api/landing-pages/images", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ landingPageId: savedPageId, imageIds: images.map((i) => i.id) }),
    });
  };
  const removeImage = async (id: string) => {
    await fetch("/api/landing-pages/images", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
    });
    setImages((prev) => prev.filter((i) => i.id !== id));
  };

  // 이미지 라이브러리에서 선택 시
  const handleLibraryInsert = useCallback((html: string) => {
    if (editorMode === "html") {
      // HTML 에디터 모드: 코드 끝에 삽입
      setHtml((prev) => prev + "\n" + html);
      return;
    }
    // 이미지 모드: Drive URL 파싱 → images 배열에 추가
    const info = extractDriveInfo(html);
    if (!info) return;
    setImages((prev) => [...prev, {
      id:          crypto.randomUUID(),
      assetId:     info.driveFileId,
      url:         info.url,
      fullUrl:     info.fullUrl,
      driveFileId: info.driveFileId,
      width: 0, height: 0,
      mimeType:    "image/webp",
      fileName:    "라이브러리 이미지",
      sortOrder:   prev.length,
    }]);
  }, [editorMode]);

  // ──────────────────────────────────────────────
  // 저장
  // ──────────────────────────────────────────────
  const save = async () => {
    if (!title.trim() || !slug.trim()) { setError("제목과 슬러그를 입력하세요."); return; }
    setSaving(true); setError("");

    const common = {
      title, slug, groupId: selectedGroupId || null,
      infoCollection: true, formConfig: { fields: formFields, additionalFields },
      ...(buttonTitle        ? { buttonTitle }        : {}),
      ...(completionPageUrl  ? { completionPageUrl }  : {}),
      ...(headerScript       ? { headerScript }       : {}),
      ...(description        ? { description }        : {}),
      ...(paymentEnabled ? {
        paymentEnabled: true, paymentType, productName,
        productPrice: parseInt(productPrice) || 0,
        ...(paymentType === "subscription" ? { cycleDay: parseInt(cycleDay), expireDate } : {}),
      } : {}),
    };

    if (editorMode === "image") {
      const pageId = savedPageId || (await ensurePage());
      if (!pageId) { setSaving(false); return; }
      const imgTags = images.map((img) => {
        const src = img.fullUrl
          ?? `https://drive.google.com/thumbnail?id=${img.driveFileId}&sz=w1920`;
        const ar  = img.width && img.height ? `aspect-ratio:${img.width}/${img.height};` : "";
        return `<img src="${src}" alt="" style="width:100%;display:block;${ar}" loading="lazy">`;
      }).join("\n");
      const generatedHtml = `<div style="line-height:0;">\n${imgTags}\n</div>`;
      const res  = await fetch(`/api/landing-pages/${pageId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...common, htmlContent: generatedHtml, editorMode: "image" }),
      });
      const data = await res.json();
      if (data.ok) router.push(`/landing-pages/${pageId}`);
      else { setError(data.message ?? "저장 실패"); setSaving(false); }
    } else {
      const res  = await fetch("/api/landing-pages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...common, htmlContent: html, editorMode: "html" }),
      });
      const data = await res.json();
      if (data.ok) router.push(`/landing-pages/${data.page.id}`);
      else { setError(data.message ?? "저장 실패"); setSaving(false); }
    }
  };

  const toggleField    = (key: string) => setFormFields((p) => ({ ...p, [key]: { enabled: !p[key].enabled, required: !p[key].enabled ? p[key].required : false } }));
  const toggleRequired = (key: string) => setFormFields((p) => ({ ...p, [key]: { ...p[key], required: !p[key].required } }));

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ═══════════════════ LEFT: 설정 + 에디터 ═══════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* 헤더 */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-white shrink-0">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <input
            type="text" placeholder="랜딩페이지 제목" value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="flex-1 text-base font-semibold border-0 focus:outline-none bg-transparent min-w-0"
          />
          <div className="flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2.5 py-1.5 rounded-lg shrink-0">
            <span>/p/</span>
            <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)}
              className="bg-transparent border-0 focus:outline-none w-24 text-gray-600" placeholder="my-page" />
          </div>
          <button onClick={save} disabled={saving}
            className="shrink-0 bg-[#C9A84C] text-[#1E2D4E] px-5 py-2 rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>

        {error && <p className="text-red-500 text-xs px-4 py-2 bg-red-50 border-b border-red-100 shrink-0">{error}</p>}

        {/* 스크롤 본문 */}
        <div className="flex-1 overflow-y-auto">

          {/* 에디터 모드 + 그룹 */}
          <div className="px-4 py-3 bg-white border-b border-gray-100 flex items-center gap-3 flex-wrap">
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button onClick={() => setEditorMode("image")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${editorMode === "image" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
                <ImageIcon className="w-4 h-4" /> 이미지형
              </button>
              <button onClick={() => setEditorMode("html")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${editorMode === "html" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
                <Code className="w-4 h-4" /> HTML형
              </button>
            </div>
            <select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)}
              className="flex-1 max-w-xs border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-yellow-400">
              <option value="">그룹 미지정 (자동 배정 없음)</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}{g.funnelId ? " 🔄" : ""}</option>)}
            </select>
            {groups.find((g) => g.id === selectedGroupId)?.funnelId && (
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">🔄 등록 즉시 자동 문자</span>
            )}
          </div>

          {/* 에디터 */}
          <div className="p-4">
            {editorMode === "html" ? (
              <HtmlEditor value={html} onChange={setHtml} height="420px" />
            ) : (
              <div>
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${uploading ? "border-yellow-400 bg-yellow-50" : "border-gray-300 hover:border-yellow-400 hover:bg-gray-50"}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files); }}
                >
                  <Upload className="w-9 h-9 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-600">{uploading ? "업로드 중..." : "이미지 드래그 또는 클릭"}</p>
                  <p className="text-xs text-gray-400 mt-1">JPG · PNG · WebP · GIF / 최대 20MB</p>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ""; }} />
                </div>
                {/* 라이브러리에서 추가 */}
                <button
                  type="button"
                  onClick={() => setShowLibrary(true)}
                  className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 bg-white rounded-xl text-sm font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
                >
                  <ImageIcon className="w-4 h-4" />
                  Drive 라이브러리에서 추가
                </button>
                {images.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-medium text-gray-500">이미지 {images.length}장 · 드래그로 순서 변경</p>
                    {images.map((img, idx) => (
                      <div key={img.id} draggable
                        onDragStart={() => setDragIdx(idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center gap-3 bg-white rounded-xl border p-3 transition-all cursor-grab ${dragIdx === idx ? "border-yellow-400 shadow-md opacity-80" : "border-gray-200 hover:border-gray-300"}`}>
                        <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
                        <div className="w-14 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                          <img src={img.url} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate text-gray-700">{img.fileName}</p>
                          <p className="text-xs text-gray-400">{img.width}×{img.height} · {img.mimeType}</p>
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">#{idx + 1}</span>
                        <button onClick={() => removeImage(img.id)} className="p-1 text-gray-300 hover:text-red-500 rounded shrink-0">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {images.length === 0 && !uploading && (
                  <div className="mt-6 text-center text-gray-400 text-sm">
                    <p>이미지를 업로드하면 랜딩페이지가 자동으로 만들어집니다</p>
                    <p className="text-xs mt-1 text-gray-300">이미지가 세로로 쌓이고 맨 아래에 신청 폼이 붙습니다</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ──── 신청 폼 필드 ──── */}
          <div className="mx-4 mb-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">신청 폼 필드</p>
              <p className="text-xs text-gray-400 mt-0.5">파란색 = 폼에 표시됨 · 체크 = 필수 입력</p>
            </div>
            <div className="p-4">
              <div className="space-y-2 mb-4">
                {Object.entries(formFields).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-3 h-9">
                    <button
                      onClick={() => toggleField(key)}
                      className={`w-32 shrink-0 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${val.enabled ? "bg-blue-500 text-white shadow-sm" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${val.enabled ? "bg-white" : "bg-gray-400"}`} />
                      {FIELD_LABELS[key]}
                    </button>
                    {val.enabled && (
                      <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
                        <input type="checkbox" checked={val.required} onChange={() => toggleRequired(key)}
                          className="w-4 h-4 rounded border-gray-300 accent-blue-500" />
                        필수
                      </label>
                    )}
                  </div>
                ))}
              </div>

              {/* 추가 질문 */}
              <div className="pt-3 border-t border-gray-100 space-y-2">
                <p className="text-xs font-medium text-gray-500 mb-2">추가 질문</p>
                {additionalFields.map((f, idx) => (
                  <div key={f.id} className="flex items-center gap-2">
                    <input type="text" value={f.name}
                      onChange={(e) => setAdditionalFields((p) => p.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                      placeholder="질문 내용 입력" className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                    <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer shrink-0">
                      <input type="checkbox" checked={f.required}
                        onChange={() => setAdditionalFields((p) => p.map((x, i) => i === idx ? { ...x, required: !x.required } : x))}
                        className="w-3.5 h-3.5 accent-blue-500" /> 필수
                    </label>
                    <button onClick={() => setAdditionalFields((p) => p.filter((_, i) => i !== idx))}
                      className="p-1 text-gray-300 hover:text-red-500 rounded shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
                <button onClick={() => setAdditionalFields((p) => [...p, { id: crypto.randomUUID(), name: "", required: false }])}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1">
                  <Plus className="w-3.5 h-3.5" /> 질문 추가
                </button>
              </div>

              {/* 버튼 텍스트 */}
              <div className="pt-3 border-t border-gray-100 flex items-center gap-2 mt-3">
                <label className="text-xs text-gray-500 shrink-0 w-20">버튼 텍스트</label>
                <input type="text" value={buttonTitle} onChange={(e) => setButtonTitle(e.target.value)}
                  placeholder="신청하기 (기본값)" className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            </div>
          </div>

          {/* ──── 결제 설정 ──── */}
          <div className="mx-4 mb-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between bg-gray-50 border-b border-gray-100">
              <div>
                <p className="text-sm font-semibold text-gray-800">결제 설정</p>
                <p className="text-xs text-gray-400 mt-0.5">신청 폼에 결제 금액 섹션 표시</p>
              </div>
              <button onClick={() => setPaymentEnabled(!paymentEnabled)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${paymentEnabled ? "bg-blue-500 text-white shadow-sm" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}>
                {paymentEnabled ? "ON" : "OFF"}
              </button>
            </div>
            {paymentEnabled && (
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray-500 w-16 shrink-0">결제 유형</label>
                  <select value={paymentType} onChange={(e) => setPaymentType(e.target.value as "onetime" | "subscription")}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-blue-400">
                    <option value="onetime">일반 결제 (1회)</option>
                    <option value="subscription">정기 결제 (월)</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray-500 w-16 shrink-0">상품명</label>
                  <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)}
                    placeholder="크루즈 여행 상품" className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray-500 w-16 shrink-0">금액</label>
                  <input type="number" value={productPrice} onChange={(e) => setProductPrice(e.target.value)}
                    placeholder="100000" className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                  <span className="text-xs text-gray-400 shrink-0">원{paymentType === "subscription" ? "/월" : ""}</span>
                </div>
                {paymentType === "subscription" && (
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-gray-500 w-16 shrink-0">매월</label>
                    <select value={cycleDay} onChange={(e) => setCycleDay(e.target.value)}
                      className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none">
                      {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}일</option>)}
                      <option value="90">말일</option>
                    </select>
                    <label className="text-xs text-gray-500 shrink-0">만료일</label>
                    <input type="date" value={expireDate} onChange={(e) => setExpireDate(e.target.value)}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ──── 기타 설정 ──── */}
          <div className="mx-4 mb-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">기타 설정</p>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-500 w-24 shrink-0">완료 후 이동 URL</label>
                <input type="url" value={completionPageUrl} onChange={(e) => setCompletionPageUrl(e.target.value)}
                  placeholder="https://..." className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-500 w-24 shrink-0">페이지 설명</label>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="관리용 내부 메모" className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">헤더 스크립트 (픽셀 · GA 코드)</label>
                <textarea value={headerScript} onChange={(e) => setHeaderScript(e.target.value)}
                  placeholder="<!-- Facebook Pixel, Google Analytics 등 -->"
                  rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-400 resize-none" />
              </div>
            </div>
          </div>

        </div>{/* end 스크롤 */}
      </div>{/* end LEFT */}

      {/* ═══════════════════ RIGHT: 실시간 iPhone 미리보기 ═══════════════════ */}
      <div className="w-[380px] shrink-0 bg-[#1a1a2e] border-l border-gray-700 flex flex-col">
        {/* 상단 바 */}
        <div className="px-4 py-3 flex items-center gap-2 border-b border-white/10">
          <Smartphone className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-300">실시간 미리보기</span>
          <span className="ml-auto flex items-center gap-1 text-xs text-green-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            LIVE
          </span>
        </div>

        {/* iPhone 프레임 */}
        <div className="flex-1 overflow-hidden flex items-start justify-center py-8 px-6">
          <div className="relative w-[280px]" style={{ userSelect: "none" }}>
            {/* 폰 외곽 */}
            <div className="absolute inset-0 rounded-[40px] pointer-events-none z-10"
              style={{ background: "#2d3748", boxShadow: "0 0 0 1.5px #4a5568, 0 24px 64px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)" }} />
            {/* 노치 */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 w-20 h-5 bg-[#2d3748] rounded-b-2xl" />
            {/* 홈 바 */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 w-16 h-1 bg-white/30 rounded-full" />
            {/* 스크린 */}
            <div className="relative mx-[10px] mt-[8px] mb-[8px] rounded-[32px] overflow-hidden bg-white"
              style={{ height: "580px" }}>
              <iframe
                ref={iframeRef}
                className="w-full h-full border-0"
                title="실시간 미리보기"
                style={{ display: "block" }}
              />
            </div>
          </div>
        </div>
      </div>

    {/* 이미지 라이브러리 모달 */}
    <ImageLibraryModal
      open={showLibrary}
      onClose={() => setShowLibrary(false)}
      onInsert={handleLibraryInsert}
    />
    </div>
  );
}
