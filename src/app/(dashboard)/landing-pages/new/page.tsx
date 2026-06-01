"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ImageIcon, Code, Upload, X, GripVertical, Plus, Trash2, Smartphone, Copy, Check } from "lucide-react";
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
  const router      = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const [showLibrary, setShowLibrary]     = useState(false);
  const [libraryPurpose, setLibraryPurpose] = useState<"content" | "ogImage">("content");
  const [copyPopup, setCopyPopup]         = useState<string | null>(null);
  const [copied, setCopied]               = useState(false);

  // OG 이미지 / SEO
  const [exposureTitle, setExposureTitle] = useState("");
  const [exposureImage, setExposureImage] = useState("");   // Drive 썸네일 URL

  // 그룹 인라인 추가
  const [showAddGroup, setShowAddGroup]   = useState(false);
  const [newGroupName, setNewGroupName]   = useState("");
  const [addingGroup, setAddingGroup]     = useState(false);

  // 결제
  const [paymentEnabled, setPaymentEnabled]   = useState(false);
  // 댓글
  const [commentEnabled, setCommentEnabled]   = useState(false);
  const [commentCount, setCommentCount]       = useState(5);
  const [commentDateFrom, setCommentDateFrom] = useState("2024-01-01");
  const [commentDateTo, setCommentDateTo]     = useState("2025-12-31");
  // 푸터
  const [footer, setFooter]                   = useState("");
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
  const [b2bEduType, setB2bEduType] = useState<"" | "INQUIRER" | "BUYER">("")


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
  <input type="checkbox" checked style="margin-top:2px;width:16px;height:16px;accent-color:#1E2D4E;">
  <span>마케팅 정보 수신에 동의합니다</span>
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
            const previewUrl = img.driveFileId
              ? `/api/landing-pages/images/proxy?id=${img.driveFileId}`
              : img.url;
            return `<img src="${previewUrl}" alt="" style="width:100%;display:block;${ar}" loading="lazy">`;
          }).join("\n")}</div>`
        : `<div style="height:180px;display:flex;align-items:center;justify-content:center;background:#f7f8fc;color:#bbb;font-family:sans-serif;font-size:13px">이미지를 업로드하면 여기에 표시됩니다</div>`;
    }

    const SAMPLE_NAMES = ["김미영", "박준호", "이수진", "최지원", "정현석", "한소희", "임재현", "오지영", "서민준", "윤지영", "강태양", "신예진", "조현우", "백지수", "류하은"];
    const SAMPLE_TEXTS = [
      "정말 잊지 못할 여행이었어요! 서비스도 친절하고 너무 좋았습니다.",
      "가족들과 함께 다녀왔는데 모두 만족했어요. 강력 추천합니다 😊",
      "크루즈 여행이 이렇게 좋은 줄 몰랐어요. 다음에도 꼭 이용할게요!",
      "직원분들이 너무 친절하셨어요. 식사도 맛있고 즐거웠습니다.",
      "처음 크루즈 여행인데 이렇게 편안할 수 없었어요. 꼭 다시 오고 싶어요!",
      "일정이 알차고 가이드 설명도 정말 좋았어요. 다음에 또 올게요.",
      "깨끗하고 넓은 객실, 맛있는 음식, 최고의 여행이었습니다.",
      "아이들도 너무 좋아했어요. 가족 여행으로 완벽한 선택이었습니다.",
      "가격 대비 퀄리티가 너무 좋아요. 친구들에게도 추천했어요!",
      "담당자분이 꼼꼼하게 안내해 주셔서 처음인데도 전혀 불안하지 않았어요.",
      "경치가 정말 아름다웠어요. 사진도 엄청 찍었어요 📸",
      "음식이 정말 다양하고 맛있었어요. 매일 뷔페가 기다려졌어요.",
      "처음부터 끝까지 완벽한 서비스였어요. 다음에 또 예약할게요.",
      "가족 모두 잊지 못할 추억을 만들었어요. 정말 감사합니다!",
      "여행 계획부터 귀국까지 세심하게 챙겨주셔서 너무 편했어요.",
    ];
    const fromMs = new Date(commentDateFrom || "2024-01-01").getTime();
    const toMs   = new Date(commentDateTo   || "2025-12-31").getTime();
    const safeRange = isNaN(fromMs) || isNaN(toMs) || fromMs > toMs
      ? { from: new Date("2024-01-01").getTime(), to: new Date("2025-12-31").getTime() }
      : { from: fromMs, to: toMs };
    const commentItems = Array.from({ length: Math.min(commentCount || 5, 15) }, (_, i) => {
      const seed    = (i * 1234567) % 1000000;
      const ratio   = (seed % 997) / 997;
      const ts      = safeRange.from + Math.floor(ratio * (safeRange.to - safeRange.from));
      const d       = new Date(ts);
      const dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
      return { name: SAMPLE_NAMES[i % SAMPLE_NAMES.length], text: SAMPLE_TEXTS[i % SAMPLE_TEXTS.length], date: dateStr };
    });
    const commentBlock = commentEnabled ? `
<div style="max-width:480px;margin:0 auto;padding:24px 20px 40px;font-family:-apple-system,BlinkMacSystemFont,'Pretendard',sans-serif">
  <h3 style="font-size:16px;font-weight:700;color:#1a1a1a;margin:0 0 16px;padding-bottom:12px;border-bottom:2px solid #f0f0f0">💬 고객 후기</h3>
  ${commentItems.map(c => `<div style="padding:12px 0;border-bottom:1px solid #f5f5f5">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <div style="width:28px;height:28px;border-radius:50%;background:#1E2D4E;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700">${c.name[0]}</div>
      <span style="font-size:13px;font-weight:600;color:#333">${c.name}</span>
      <span style="font-size:11px;color:#bbb;margin-left:auto">${c.date}</span>
    </div>
    <p style="font-size:13px;color:#555;line-height:1.6;margin:0">${c.text}</p>
  </div>`).join("")}
  <p style="font-size:11px;color:#bbb;text-align:center;margin-top:14px">저장 후 AI 후기 자동 생성 가능</p>
</div>` : "";

    const footerBlock = footer.trim() ? `
<footer style="max-width:480px;margin:0 auto;padding:20px 20px 40px;text-align:center;font-size:11px;color:#aaa;line-height:1.9;font-family:-apple-system,BlinkMacSystemFont,'Pretendard',sans-serif;border-top:1px solid #f0f0f0">
  ${footer.replace(/\n/g, "<br>")}
</footer>` : "";

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
${commentBlock}
${footerBlock}
</body>
</html>`;
  }, [editorMode, html, images, formFields, additionalFields, paymentEnabled, productName, productPrice, paymentType, buttonTitle, title, headerScript, commentEnabled, commentCount, commentDateFrom, commentDateTo, footer]);

  // state 변경 시 즉시 재계산 — srcDoc prop 변경으로 브라우저가 iframe 재렌더링
  const previewHtml = useMemo(() => buildPreviewHtml(), [buildPreviewHtml]);

  // ──────────────────────────────────────────────
  // 이미지 업로드 / 정렬 / 삭제
  // ──────────────────────────────────────────────
  const ensurePage = useCallback(async (): Promise<string | null> => {
    if (savedPageId) return savedPageId;
    // 제목이 없으면 임시 제목/슬러그 자동 생성 (나중에 수정 가능)
    const autoTitle = title.trim() || `랜딩페이지 ${new Date().toLocaleDateString("ko-KR")}`;
    const autoSlug  = slug.trim() || `page-${Date.now()}`;
    if (!title.trim()) setTitle(autoTitle);
    if (!slug.trim())  setSlug(autoSlug);
    const s = autoSlug;
    const res  = await fetch("/api/landing-pages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: autoTitle, slug: s, htmlContent: "", editorMode: "image", groupId: selectedGroupId || null }),
    });
    const data = await res.json();
    if (!data.ok) { setError(data.message ?? "페이지 생성 실패"); return null; }
    setSavedPageId(data.page.id);
    return data.page.id;
  }, [savedPageId, title, slug, selectedGroupId]);

  const uploadFiles = async (files: File[]) => {
    setError("");
    let pageId: string | null = null;
    try {
      pageId = await ensurePage();
    } catch (e) {
      setError(`페이지 생성 오류: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    if (!pageId) return;
    setUploading(true);
    let uploaded = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Windows 드래그&드롭 시 file.type이 빈 문자열일 수 있어 확장자로도 검사
      const isImage = file.type.startsWith("image/") ||
        /\.(jpe?g|png|gif|webp|bmp)$/i.test(file.name);
      if (!isImage) continue;
      if (file.size > 20 * 1024 * 1024) { setError(`${file.name}: 20MB 초과`); continue; }
      const fd = new FormData();
      fd.append("file", file); fd.append("landingPageId", pageId); fd.append("sortOrder", String(images.length + uploaded));
      try {
        const res  = await fetch("/api/landing-pages/images", { method: "POST", body: fd });
        const data = await res.json();
        if (data.ok) { setImages((prev) => [...prev, data.image]); uploaded++; }
        else setError(data.message ?? `${file.name} 업로드 실패`);
      } catch (e) {
        setError(`${file.name} 업로드 중 오류: ${e instanceof Error ? e.message : String(e)}`);
      }
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
  const handleLibraryInsert = useCallback((rawHtml: string) => {
    const info = extractDriveInfo(rawHtml);

    // OG 이미지 목적
    if (libraryPurpose === "ogImage") {
      if (info) setExposureImage(info.url);
      return;
    }

    if (editorMode === "html") {
      // HTML 에디터 모드: clean <img> 태그 생성 → 에디터 삽입 + 복사 팝업
      const cleanTag = info
        ? `<img src="${info.url}" alt="" style="width:100%;display:block;" loading="lazy">`
        : rawHtml;
      setHtml((prev) => prev + "\n" + cleanTag);
      setCopyPopup(cleanTag);
      setCopied(false);
      return;
    }
    // 이미지 모드: Drive URL 파싱 → images 배열에 추가
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
  }, [editorMode, libraryPurpose]);

  // ──────────────────────────────────────────────
  // 저장
  // ──────────────────────────────────────────────
  const save = async () => {
    if (!title.trim() || !slug.trim()) { setError("제목과 슬러그를 입력하세요."); return; }
    setSaving(true); setError("");

    const common = {
      title, slug, groupId: selectedGroupId || null,
      commentEnabled,
      commentConfig: commentEnabled ? { count: commentCount, dateFrom: commentDateFrom, dateTo: commentDateTo } : undefined,
      ...(exposureTitle  ? { exposureTitle }                                   : {}),
      ...(exposureImage  ? { exposureImage }                                   : {}),
      infoCollection: true,
      formConfig: {
        fields: formFields, additionalFields,
        footer: footer.trim() || null,
        ...(b2bEduType ? { b2bEduType } : {}),
      },
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

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    setAddingGroup(true);
    try {
      const res  = await fetch("/api/groups", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGroupName.trim() }),
      });
      const data = await res.json();
      if (data.ok && data.group) {
        setGroups((prev) => [...prev, { id: data.group.id, name: data.group.name, funnelId: null }]);
        setSelectedGroupId(data.group.id);
        setNewGroupName(""); setShowAddGroup(false);
      }
    } finally { setAddingGroup(false); }
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
          <div className="flex items-center gap-1 text-sm text-gray-600 bg-gray-100 px-2.5 py-1.5 rounded-lg shrink-0">
            <span>/p/</span>
            <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)}
              className="bg-transparent border-0 focus:outline-none w-24 text-gray-600" placeholder="my-page" />
          </div>
          <button onClick={save} disabled={saving}
            className="shrink-0 bg-[#C9A84C] text-[#1E2D4E] px-5 py-2 rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>

        {error && <p className="text-red-500 text-sm px-4 py-2 bg-red-50 border-b border-red-100 shrink-0">{error}</p>}

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
              className="flex-1 max-w-[200px] border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-yellow-400">
              <option value="">그룹 미지정</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}{g.funnelId ? " 🔄" : ""}</option>)}
            </select>
            <button type="button" onClick={() => setShowAddGroup(!showAddGroup)}
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-blue-400 hover:text-blue-600 text-lg leading-none transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </button>
            {showAddGroup && (
              <div className="flex items-center gap-1 basis-full mt-1">
                <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createGroup()}
                  placeholder="새 그룹명" autoFocus
                  className="flex-1 border border-blue-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
                <button onClick={createGroup} disabled={addingGroup || !newGroupName.trim()}
                  className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                  {addingGroup ? "..." : "추가"}
                </button>
                <button onClick={() => { setShowAddGroup(false); setNewGroupName(""); }}
                  className="p-1.5 text-gray-600 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}
            {groups.find((g) => g.id === selectedGroupId)?.funnelId && (
              <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">🔄 등록 즉시 자동 문자</span>
            )}
          </div>

          {/* 에디터 */}
          <div className="p-4">
            {editorMode === "html" ? (
              <div className="space-y-2">
                <HtmlEditor value={html} onChange={setHtml} height="420px" />
                <button
                  type="button"
                  onClick={() => setShowLibrary(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 bg-white rounded-xl text-sm font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
                >
                  <ImageIcon className="w-4 h-4" />
                  Drive 라이브러리에서 이미지 HTML 가져오기
                </button>
              </div>
            ) : (
              <div>
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${uploading ? "border-yellow-400 bg-yellow-50" : "border-gray-300 hover:border-yellow-400 hover:bg-gray-50"}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const f = Array.from(e.dataTransfer.files); if (f.length) uploadFiles(f); }}
                >
                  <Upload className="w-9 h-9 text-gray-600 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-600">{uploading ? "업로드 중..." : "이미지 드래그 또는 클릭"}</p>
                  <p className="text-sm text-gray-600 mt-1">JPG · PNG · WebP · GIF / 최대 20MB</p>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; if (f.length) uploadFiles(f); }} />
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
                    <p className="text-sm font-medium text-gray-500">이미지 {images.length}장 · 드래그로 순서 변경</p>
                    {images.map((img, idx) => (
                      <div key={img.id} draggable
                        onDragStart={() => setDragIdx(idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center gap-3 bg-white rounded-xl border p-3 transition-all cursor-grab ${dragIdx === idx ? "border-yellow-400 shadow-md opacity-80" : "border-gray-200 hover:border-gray-300"}`}>
                        <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
                        <div className="w-14 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                          <img src={img.driveFileId ? `/api/landing-pages/images/proxy?id=${img.driveFileId}` : img.url} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate text-gray-700">{img.fileName}</p>
                          <p className="text-sm text-gray-600">{img.width}×{img.height} · {img.mimeType}</p>
                        </div>
                        <span className="text-sm text-gray-600 shrink-0">#{idx + 1}</span>
                        <button onClick={() => removeImage(img.id)} className="p-1 text-gray-300 hover:text-red-500 rounded shrink-0">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {images.length === 0 && !uploading && (
                  <div className="mt-6 text-center text-gray-600 text-sm">
                    <p>이미지를 업로드하면 랜딩페이지가 자동으로 만들어집니다</p>
                    <p className="text-sm mt-1 text-gray-300">이미지가 세로로 쌓이고 맨 아래에 신청 폼이 붙습니다</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ──── 신청 폼 필드 ──── */}
          <div className="mx-4 mb-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">신청 폼 필드</p>
              <p className="text-sm text-gray-600 mt-0.5">파란색 = 폼에 표시됨 · 체크 = 필수 입력</p>
            </div>
            <div className="p-4">
              <div className="space-y-2 mb-4">
                {Object.entries(formFields).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-3 h-9">
                    <button
                      onClick={() => toggleField(key)}
                      className={`w-32 shrink-0 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${val.enabled ? "bg-blue-500 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${val.enabled ? "bg-white" : "bg-gray-400"}`} />
                      {FIELD_LABELS[key]}
                    </button>
                    {val.enabled && (
                      <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
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
                <p className="text-sm font-medium text-gray-500 mb-2">추가 질문</p>
                {additionalFields.map((f, idx) => (
                  <div key={f.id} className="flex items-center gap-2">
                    <input type="text" value={f.name}
                      onChange={(e) => setAdditionalFields((p) => p.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                      placeholder="질문 내용 입력" className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                    <label className="flex items-center gap-1 text-sm text-gray-500 cursor-pointer shrink-0">
                      <input type="checkbox" checked={f.required}
                        onChange={() => setAdditionalFields((p) => p.map((x, i) => i === idx ? { ...x, required: !x.required } : x))}
                        className="w-3.5 h-3.5 accent-blue-500" /> 필수
                    </label>
                    <button onClick={() => setAdditionalFields((p) => p.filter((_, i) => i !== idx))}
                      className="p-1 text-gray-300 hover:text-red-500 rounded shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
                <button onClick={() => setAdditionalFields((p) => [...p, { id: crypto.randomUUID(), name: "", required: false }])}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mt-1">
                  <Plus className="w-3.5 h-3.5" /> 질문 추가
                </button>
              </div>

              {/* B2B 문의자 자동 연결 */}
              <div className="pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">B2B 문의자 자동 등록</p>
                    <p className="text-sm text-gray-600 mt-0.5">신청 시 교육 문의자/구매자로 자동 저장</p>
                  </div>
                  <select
                    value={b2bEduType}
                    onChange={(e) => setB2bEduType(e.target.value as "" | "INQUIRER" | "BUYER")}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-blue-400"
                  >
                    <option value="">사용 안 함</option>
                    <option value="INQUIRER">교육 문의자로 등록</option>
                    <option value="BUYER">교육 구매자로 등록</option>
                  </select>
                </div>
              </div>

              {/* 버튼 텍스트 */}
              <div className="pt-3 border-t border-gray-100 flex items-center gap-2 mt-3">
                <label className="text-sm text-gray-500 shrink-0 w-20">버튼 텍스트</label>
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
                <p className="text-sm text-gray-600 mt-0.5">신청 폼에 결제 금액 섹션 표시</p>
              </div>
              <button onClick={() => setPaymentEnabled(!paymentEnabled)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${paymentEnabled ? "bg-blue-500 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {paymentEnabled ? "ON" : "OFF"}
              </button>
            </div>
            {paymentEnabled && (
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-500 w-16 shrink-0">결제 유형</label>
                  <select value={paymentType} onChange={(e) => setPaymentType(e.target.value as "onetime" | "subscription")}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-blue-400">
                    <option value="onetime">일반 결제 (1회)</option>
                    <option value="subscription">정기 결제 (월)</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-500 w-16 shrink-0">상품명</label>
                  <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)}
                    placeholder="크루즈 여행 상품" className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-500 w-16 shrink-0">금액</label>
                  <input type="number" value={productPrice} onChange={(e) => setProductPrice(e.target.value)}
                    placeholder="100000" className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                  <span className="text-sm text-gray-600 shrink-0">원{paymentType === "subscription" ? "/월" : ""}</span>
                </div>
                {paymentType === "subscription" && (
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-500 w-16 shrink-0">매월</label>
                    <select value={cycleDay} onChange={(e) => setCycleDay(e.target.value)}
                      className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none">
                      {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}일</option>)}
                      <option value="90">말일</option>
                    </select>
                    <label className="text-sm text-gray-500 shrink-0">만료일</label>
                    <input type="date" value={expireDate} onChange={(e) => setExpireDate(e.target.value)}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ──── 댓글 / 후기 설정 ──── */}
          <div className="mx-4 mb-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between bg-gray-50 border-b border-gray-100">
              <div>
                <p className="text-sm font-semibold text-gray-800">고객 후기 댓글</p>
                <p className="text-sm text-gray-600 mt-0.5">랜딩페이지 하단에 후기 섹션 표시 · 저장 후 AI 댓글 자동 생성</p>
              </div>
              <button onClick={() => setCommentEnabled(!commentEnabled)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${commentEnabled ? "bg-blue-500 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {commentEnabled ? "ON" : "OFF"}
              </button>
            </div>
            {commentEnabled && (
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-500 w-20 shrink-0">후기 개수</label>
                  <input type="number" min={1} max={15} value={commentCount}
                    onChange={(e) => setCommentCount(Math.min(15, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="w-20 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                  <span className="text-sm text-gray-600">개 (최대 15)</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-500 w-20 shrink-0">날짜 범위</label>
                  <input type="date" value={commentDateFrom} onChange={(e) => setCommentDateFrom(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                  <span className="text-sm text-gray-600 shrink-0">~</span>
                  <input type="date" value={commentDateTo} onChange={(e) => setCommentDateTo(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <p className="text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">💡 저장 완료 후 랜딩페이지 관리에서 AI 후기 자동 생성 버튼을 사용하세요.</p>
              </div>
            )}
          </div>

          {/* ──── OG 이미지 / 링크 공유 설정 ──── */}
          <div className="mx-4 mb-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">링크 공유 썸네일 (OG)</p>
              <p className="text-sm text-gray-600 mt-0.5">카카오·SNS 공유 시 미리보기 제목·이미지</p>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-500 w-16 shrink-0">공유 제목</label>
                <input type="text" value={exposureTitle} onChange={(e) => setExposureTitle(e.target.value)}
                  placeholder="비워두면 랜딩페이지 제목 사용"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-1.5">썸네일 이미지</label>
                {exposureImage ? (
                  <div className="flex items-center gap-2">
                    <img src={`/api/landing-pages/images/proxy?id=${exposureImage.match(/id=([^&]+)/)?.[1] ?? ""}`}
                      alt="OG 이미지" className="w-20 h-14 object-cover rounded-lg border border-gray-200"
                      onError={(e) => { (e.target as HTMLImageElement).src = ""; }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-600 truncate">{exposureImage}</p>
                      <button onClick={() => setExposureImage("")} className="text-sm text-red-400 hover:text-red-600 mt-1">제거</button>
                    </div>
                  </div>
                ) : (
                  <button type="button"
                    onClick={() => { setLibraryPurpose("ogImage"); setShowLibrary(true); }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-dashed border-gray-300 bg-gray-50 rounded-xl text-sm font-medium text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
                    <ImageIcon className="w-4 h-4" />
                    Drive에서 썸네일 이미지 선택
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ──── 기타 설정 ──── */}
          <div className="mx-4 mb-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">기타 설정</p>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-500 w-24 shrink-0">완료 후 이동 URL</label>
                <input type="url" value={completionPageUrl} onChange={(e) => setCompletionPageUrl(e.target.value)}
                  placeholder="https://..." className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-500 w-24 shrink-0">페이지 설명</label>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="관리용 내부 메모" className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-1.5">푸터 텍스트</label>
                <textarea value={footer} onChange={(e) => setFooter(e.target.value)}
                  placeholder={"예) 사업자등록번호: 851-67-00338 | 대표: 전혜선\n주소: 서울시 강남구 테헤란로 123\n고객센터: 02-0000-0000 | 이메일: info@example.com"}
                  rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" />
                <p className="text-sm text-gray-600 mt-1">사업자 정보, 주소, 고객센터 등 랜딩페이지 하단에 표시됩니다</p>
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-1.5">헤더 스크립트 (픽셀 · GA 코드)</label>
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
          <Smartphone className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-300">실시간 미리보기</span>
          <span className="ml-auto flex items-center gap-1 text-sm text-green-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            LIVE
          </span>
        </div>

        {/* iPhone 프레임 */}
        <div className="flex-1 overflow-y-auto flex flex-col items-center py-8 px-6 gap-6">
          <div className="relative w-[280px]" style={{ userSelect: "none" }}>
            {/* 폰 외곽 — z-0: 스크린 뒤에서 베젤 역할 */}
            <div className="absolute inset-0 rounded-[40px] pointer-events-none z-0"
              style={{ background: "#2d3748", boxShadow: "0 0 0 1.5px #4a5568, 0 24px 64px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)" }} />
            {/* 스크린 — z-10: 폰 외곽 위에 표시 */}
            <div className="relative mx-[10px] mt-[8px] mb-[8px] rounded-[32px] overflow-hidden bg-white z-10"
              style={{ height: "580px" }}>
              <iframe
                srcDoc={previewHtml}
                className="w-full h-full border-0"
                title="실시간 미리보기"
                sandbox="allow-scripts allow-same-origin"
                style={{ display: "block" }}
              />
            </div>
            {/* 노치 — z-20: 스크린 위에 오버레이 */}
            <div className="absolute top-[8px] left-1/2 -translate-x-1/2 z-20 w-16 h-4 bg-[#2d3748] rounded-b-2xl pointer-events-none" />
            {/* 홈 바 — z-20 */}
            <div className="absolute bottom-[10px] left-1/2 -translate-x-1/2 z-20 w-14 h-1 bg-gray-400/40 rounded-full pointer-events-none" />
          </div>

          {/* OG 공유 카드 미리보기 */}
          {exposureImage && (
            <div className="w-[280px] shrink-0">
              <p className="text-sm text-gray-500 mb-2 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                카카오·SNS 공유 미리보기
              </p>
              <div className="bg-white rounded-xl overflow-hidden border border-white/10 shadow-lg">
                <img
                  src={(() => {
                    const m = exposureImage.match(/id=([^&]+)/);
                    return m ? `/api/landing-pages/images/proxy?id=${m[1]}` : exposureImage;
                  })()}
                  alt="OG 썸네일"
                  className="w-full h-36 object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <div className="px-3 py-2.5">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {exposureTitle || title || "랜딩페이지 제목"}
                  </p>
                  <p className="text-sm text-gray-600 mt-0.5">mabizcruisedot.com</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

    {/* 이미지 라이브러리 모달 */}
    <ImageLibraryModal
      open={showLibrary}
      onClose={() => { setShowLibrary(false); setLibraryPurpose("content"); }}
      onInsert={(html) => { handleLibraryInsert(html); setShowLibrary(false); setLibraryPurpose("content"); }}
    />

    {/* HTML 코드 복사 팝업 */}
    {copyPopup && (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setCopyPopup(null); setCopied(false); }}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <p className="font-semibold text-gray-800 text-sm">이미지 HTML 코드</p>
              <p className="text-sm text-gray-600 mt-0.5">에디터에 자동 삽입됨 · 코드를 직접 복사할 수도 있어요</p>
            </div>
            <button onClick={() => { setCopyPopup(null); setCopied(false); }} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-5 space-y-3">
            <pre className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm font-mono text-gray-700 overflow-x-auto whitespace-pre-wrap break-all max-h-52 leading-relaxed">{copyPopup}</pre>
            <button
              onClick={() => { navigator.clipboard.writeText(copyPopup); setCopied(true); }}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${copied ? "bg-green-500 text-white" : "bg-[#1E2D4E] text-white hover:opacity-90"}`}
            >
              {copied ? <><Check className="w-4 h-4" /> 복사됨!</> : <><Copy className="w-4 h-4" /> HTML 코드 복사</>}
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
