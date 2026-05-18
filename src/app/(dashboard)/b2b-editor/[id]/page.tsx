"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, Users, MessageSquare, ImageIcon, Code, Upload, X, GripVertical, BarChart2, Mail } from "lucide-react";
import dynamic from "next/dynamic";
import { RegistrationsTab } from "../../landing-pages/[id]/components/RegistrationsTab";
import { CommentsTab } from "../../landing-pages/[id]/components/CommentsTab";
import FormBuilder, { FormField } from "@/components/forms/FormBuilder";
import { B2BLandingComment } from "@prisma/client";

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

type UploadedImage = {
  id: string; assetId: string; url: string; driveFileId: string;
  width: number; height: number; mimeType: string; fileName: string; sortOrder: number;
  altText?: string;
};

export default function EditB2BPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab]           = useState<"editor" | "registrations" | "comments" | "stats">(
    searchParams.get("tab") === "registrations" ? "registrations" :
    searchParams.get("tab") === "comments"      ? "comments"      :
    searchParams.get("tab") === "stats"         ? "stats"         : "editor"
  );
  const [title, setTitle]       = useState("");
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [html, setHtml]         = useState("");
  const [editorMode, setEditorMode] = useState<"html" | "image">("html");
  const [preview, setPreview]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [saveMsg, setSaveMsg]   = useState("");
  const [uploadProgress, setUploadProgress] = useState({ processed: 0, total: 0, percent: 0 });
  const [success, setSuccess]   = useState("");

  // 이미지 모드
  const [images, setImages]     = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragIdx, setDragIdx]   = useState<number | null>(null);

  // 결제 설정
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [paymentType, setPaymentType]       = useState<"onetime" | "subscription">("onetime");
  const [productName, setProductName]       = useState("");
  const [productPrice, setProductPrice]     = useState("");
  const [cycleDay, setCycleDay]             = useState("1");
  const [expireDate, setExpireDate]         = useState("");

  // 등록자 목록
  const [registrations, setRegistrations]     = useState<Registration[]>([]);
  const [regTotal,       setRegTotal]          = useState(0);
  const [regPage,        setRegPage]           = useState(1);
  const [regLoading,     setRegLoading]        = useState(false);

  // 댓글 관리
  const [comments,      setComments]     = useState<B2BLandingComment[]>([]);
  const [commentEnabled, setCommentEnabled] = useState(false);
  const [genCount,      setGenCount]     = useState(5);
  const [generating,    setGenerating]   = useState(false);
  const [commentMsg,    setCommentMsg]   = useState("");

  // 이메일 설정
  const [regEmailEnabled, setRegEmailEnabled] = useState(false);
  const [regEmailSubject, setRegEmailSubject] = useState("");
  const [regEmailContent, setRegEmailContent] = useState("");
  const [emailSaveMsg,    setEmailSaveMsg]    = useState("");

  // 5단계 통계
  type LandingStats = {
    viewCount: number; registered: number; emailSent: number;
    funnelEntered: number; purchased: number;
    rates: { visitToRegister: number; registerToEmail: number; registerToFunnel: number; funnelToPurchase: number; visitToPurchase: number };
  };
  const [stats,        setStats]        = useState<LandingStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // new/page.tsx에서 이식한 추가 편집 필드
  const [exposureTitle, setExposureTitle]       = useState("");
  const [exposureImage, setExposureImage]       = useState("");
  const [buttonTitle, setButtonTitle]           = useState("");
  const [completionPageUrl, setCompletionPageUrl] = useState("");
  const [headerScript, setHeaderScript]         = useState("");
  const [description, setDescription]           = useState("");
  const [footerText, setFooterText]             = useState("");
  const [commentCount, setCommentCount]         = useState(5);
  const [commentDateFrom, setCommentDateFrom]   = useState("2024-01-01");
  const [commentDateTo, setCommentDateTo]       = useState("2025-12-31");
  const [showAdvanced, setShowAdvanced]         = useState(false);
  const [formFields, setFormFields] = useState<FormField[]>([
    { id: 'name', name: 'name', label: '이름', type: 'text', required: true, placeholder: '이름을 입력하세요' },
    { id: 'phone', name: 'phone', label: '전화번호', type: 'tel', required: true, placeholder: '010-1234-5678' },
    { id: 'email', name: 'email', label: '이메일', type: 'email', required: false, placeholder: 'user@company.co.kr' },
  ]);
  const FIELD_LABELS: Record<string, string> = {
    phone: "연락처", name: "이름", email: "이메일",
    gender: "성별", birthDate: "생년월일", address: "주소", marketingConsent: "마케팅동의",
  };

  // Task 1-5: 초기 데이터 로딩 — HTTP 에러 처리 추가
  useEffect(() => {
    Promise.all([
      fetch(`/api/b2b-landing/${id}`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }).catch(() => ({ ok: false })),
    ]).then(([pageData]) => {
      if (pageData.ok && pageData.page) {
        setTitle(pageData.page.title ?? "");
        setPartnerId(pageData.page.partnerId ?? null);
        setHtml(pageData.page.htmlContent ?? "");
        setEditorMode(pageData.page.editorMode === "image" ? "image" : "html");
        setCommentEnabled(pageData.page.commentEnabled ?? false);
        setPaymentEnabled(pageData.page.paymentEnabled ?? false);
        // 이메일 설정
        setRegEmailEnabled(pageData.page.regEmailEnabled ?? false);
        setRegEmailSubject(pageData.page.regEmailSubject ?? "");
        setRegEmailContent(pageData.page.regEmailContent ?? "");
        // 이미지 로드
        if ((pageData.page.images ?? []).length) {
          setImages((pageData.page.images ?? []).map((img: { id: string; sortOrder: number; altText?: string; imageAsset: { id: string; driveFileId: string; originalFileName: string; mimeType: string; width: number; height: number } }) => ({
            id: img.id, assetId: img.imageAsset.id,
            url: `https://drive.google.com/thumbnail?id=${img.imageAsset.driveFileId}&sz=w800`,
            driveFileId: img.imageAsset.driveFileId, width: img.imageAsset.width || 0,
            height: img.imageAsset.height || 0, mimeType: img.imageAsset.mimeType || "",
            fileName: img.imageAsset.originalFileName, sortOrder: img.sortOrder,
            altText: img.altText,
          })));
        }
        setPaymentType(pageData.page.paymentType ?? "onetime");
        setProductName(pageData.page.productName ?? "");
        setProductPrice(String(pageData.page.productPrice ?? ""));
        setCycleDay(String(pageData.page.cycleDay ?? "1"));
        setExpireDate(pageData.page.expireDate ? (pageData.page.expireDate?.split("T") ?? [])[0] ?? "" : "");
        const fc = pageData.page.formConfig;
        if (fc && typeof fc === 'object' && 'fields' in fc) {
          const fields = (fc as Record<string, unknown>).fields;
          if (Array.isArray(fields) && fields.every((f: unknown) => f && typeof f === 'object' && 'id' in f)) {
            setFormFields(fields as FormField[]);
          }
        }
        if (fc && typeof fc === 'object' && 'footerText' in fc) {
          const footerText = (fc as Record<string, unknown>).footerText;
          if (typeof footerText === 'string') {
            setFooterText(footerText);
          }
        }
        // 추가 편집 필드
        setExposureTitle(pageData.page.exposureTitle ?? "");
        setExposureImage(pageData.page.exposureImage ?? "");
        setButtonTitle(pageData.page.buttonTitle ?? "");
        setCompletionPageUrl(pageData.page.completionPageUrl ?? "");
        setHeaderScript(pageData.page.headerScript ?? "");
        setDescription(pageData.page.description ?? "");
        // 댓글 설정
        const cc = pageData.page.commentConfig;
        if (cc && typeof cc === 'object') {
          const count = (cc as Record<string, unknown>).count;
          const dateFrom = (cc as Record<string, unknown>).dateFrom;
          const dateTo = (cc as Record<string, unknown>).dateTo;
          if (typeof count === 'number') setCommentCount(count);
          if (typeof dateFrom === 'string') setCommentDateFrom(dateFrom);
          if (typeof dateTo === 'string') setCommentDateTo(dateTo);
        }
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  // Task 1-5: loadStats — HTTP 에러 처리 추가
  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const res  = await fetch(`/api/b2b-landing/${id}/stats`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.ok) setStats(data.stats);
    } catch {
      setError("통계를 불러오지 못했습니다.");
    } finally {
      setStatsLoading(false);
    }
  };

  const saveEmailSettings = async () => {
    setEmailSaveMsg("");
    try {
      const res = await fetch(`/api/b2b-landing/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regEmailEnabled, regEmailSubject: regEmailSubject || null, regEmailContent: regEmailContent || null }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEmailSaveMsg(data.ok ? "저장됐어요!" : "저장 실패");
    } catch (err) {
      setEmailSaveMsg(`저장 실패: ${err instanceof Error ? err.message : "알 수 없음"}`);
    }
  };

  // Task 1-5: loadRegistrations — HTTP 에러 처리 추가
  const loadRegistrations = async (p: number) => {
    setRegLoading(true);
    try {
      const res = await fetch(`/api/b2b-landing/${id}/registrations?page=${p}&limit=20`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.ok) {
        setRegistrations(data.registrations);
        setRegTotal(data.total);
        setRegPage(p);
      }
    } catch {
      setError("등록자 목록을 불러오지 못했습니다.");
    } finally {
      setRegLoading(false);
    }
  };

  // Task 1-4: 메모리 누수 수정 — setTimeout cleanup 통합
  useEffect(() => {
    const timeoutIds: NodeJS.Timeout[] = [];

    if (emailSaveMsg) {
      const timerId = setTimeout(() => setEmailSaveMsg(""), 2500);
      timeoutIds.push(timerId);
    }
    if (saveMsg) {
      const timerId = setTimeout(() => setSaveMsg(""), 2000);
      timeoutIds.push(timerId);
    }

    // cleanup 함수에서 clearTimeout
    return () => {
      timeoutIds.forEach((id) => clearTimeout(id));
    };
  }, [emailSaveMsg, saveMsg]);

  useEffect(() => {
    if (tab === "registrations") loadRegistrations(1);
    if (tab === "comments")      loadComments();
    if (tab === "stats")         loadStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, id]);

  // Task 1-5: loadComments — HTTP 에러 처리 추가
  const loadComments = async () => {
    try {
      const res = await fetch(`/api/b2b-landing/${id}/comments`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.ok) setComments(data.comments);
    } catch {
      setCommentMsg("후기 목록을 불러오지 못했습니다.");
    }
  };

  // Task 1-5: deleteComment — HTTP 에러 처리 추가
  const deleteComment = async (commentId: string) => {
    try {
      const res = await fetch(`/api/b2b-landing/${id}/comments?commentId=${commentId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.ok) setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      setCommentMsg("삭제 실패");
    }
  };

  // Task 1-5: toggleCommentEnabled — HTTP 에러 처리 추가
  const toggleCommentEnabled = async () => {
    const next = !commentEnabled;
    try {
      const res = await fetch(`/api/b2b-landing/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentEnabled: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.ok) setCommentEnabled(next);
    } catch {
      setCommentMsg("변경 실패");
    }
  };

  // Task 1-5: generateComments — HTTP 에러 처리 추가
  const generateComments = async () => {
    setGenerating(true);
    setCommentMsg("");
    try {
      const res = await fetch(`/api/b2b-landing/${id}/comments/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: genCount }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.ok) {
        setComments((prev) => [...data.comments, ...prev]);
        setCommentMsg(`✅ ${data.comments.length}개 AI 후기 생성 완료`);
      } else {
        setCommentMsg("생성 실패. 다시 시도하세요.");
      }
    } catch {
      setCommentMsg("생성 중 오류 발생");
    } finally {
      setGenerating(false);
    }
  };

  // Task 1-2 & 1-5: 이미지 업로드 — 배치 처리 + HTTP 에러 처리 + Race Condition 해결
  const uploadSingleFile = async (file: File, sortOrder: number): Promise<{ ok: boolean; image?: UploadedImage; error?: string }> => {
    if (!file.type.startsWith("image/")) return { ok: false, error: `${file.name}: 이미지 형식 아님` };
    if (file.size > 20 * 1024 * 1024) return { ok: false, error: `${file.name}: 20MB 초과` };

    const formData = new FormData();
    formData.append("file", file);
    formData.append("landingPageId", id);
    formData.append("sortOrder", String(sortOrder));

    try {
      const res = await fetch("/api/landing-pages/images", { method: "POST", body: formData });
      // Task 1-5: res.ok 체크 추가
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // JSON parsing 에러 처리
      if (!data.ok) return { ok: false, error: data.message ?? `${file.name} 업로드 실패` };
      return { ok: true, image: data.image };
    } catch (err) {
      return { ok: false, error: `${file.name} 업로드 중 오류: ${err instanceof Error ? err.message : '알 수 없음'}` };
    }
  };

  const uploadFiles = async (files: FileList) => {
    setUploading(true);
    setError("");
    setUploadProgress({ processed: 0, total: files.length, percent: 0 });

    const successImages: UploadedImage[] = [];
    const failedErrors: string[] = [];
    const validFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));

    // Task 6: 빈 배열 검증
    if (validFiles.length === 0) {
      setError("이미지 파일이 없습니다.");
      setUploading(false);
      return;
    }

    // Task 3: Race condition 방지 - 루프 시작 전에 초기 이미지 개수 고정
    const initialImageCount = images.length;

    // Task 1-2: 배치 처리 (3개씩)
    for (let i = 0; i < validFiles.length; i += 3) {
      const batch = validFiles.slice(i, i + 3);
      // Task 3: Race condition 해결 - initialImageCount 고정값 사용
      const sortOrder = initialImageCount + successImages.length;

      // Task 1-2: Promise.allSettled() 사용
      const results = await Promise.allSettled(
        batch.map((file, idx) => uploadSingleFile(file, sortOrder + idx))
      );

      results.forEach((result, idx) => {
        if (result.status === "fulfilled") {
          if (result.value.ok && result.value.image) {
            successImages.push(result.value.image);
          } else if (result.value.error) {
            failedErrors.push(result.value.error);
          }
        } else {
          failedErrors.push(`${batch[idx].name}: 업로드 실패`);
        }
      });

      // Task 1-2: 진행률 상태 업데이트
      const processed = Math.min(i + 3, validFiles.length);
      const percent = Math.round((processed / validFiles.length) * 100);
      setUploadProgress({ processed, total: validFiles.length, percent });
    }

    // Task 1-2: 결과 수집 및 메시지 표시
    if (successImages.length > 0) {
      setImages((prev) => [...prev, ...successImages]);
      if (failedErrors.length > 0) {
        setSuccess(`✅ ${successImages.length}개 성공, ❌ ${failedErrors.length}개 실패: ${failedErrors.slice(0, 2).join(", ")}${failedErrors.length > 2 ? "..." : ""}`);
      } else {
        setSuccess(`✅ ${successImages.length}개 모두 업로드 완료`);
      }
    } else {
      setError(failedErrors.length > 0 ? failedErrors[0] : "업로드 실패");
    }

    // Task 1-2: setUploading(false)는 루프 완료 후에만
    setUploading(false);
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const n = [...images]; const [m] = n.splice(dragIdx, 1); n.splice(idx, 0, m);
    setImages(n); setDragIdx(idx);
  };

  // Task 1-3 & 1-5: handleDragEnd — 상태 불일치 수정 + HTTP 에러 처리
  const handleDragEnd = async () => {
    setDragIdx(null);
    const previousImages = [...images]; // Task 1-3: previousImages 백업

    try {
      const res = await fetch("/api/landing-pages/images", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ landingPageId: id, imageIds: images.map((img) => img.id) }),
      });
      // Task 1-5: res.ok 체크 추가
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      // Task 1-3: data.ok 체크 추가
      if (!data.ok) throw new Error(data.message ?? "순서 변경 실패");

      setSuccess("이미지 순서가 변경되었습니다.");
    } catch (err) {
      // Task 1-3: 실패 시 setImages(previousImages) 롤백
      setImages(previousImages);
      setError(`순서 변경 실패: ${err instanceof Error ? err.message : "알 수 없음"}`);
    }
  };

  // Task 1-3 & 1-5: removeImage — 상태 불일치 수정 + HTTP 에러 처리
  const removeImage = async (imgId: string) => {
    const previousImages = [...images]; // Task 1-3: previousImages 백업
    setImages((prev) => prev.filter((img) => img.id !== imgId)); // Task 1-3: 낙관적 업데이트

    try {
      const res = await fetch("/api/landing-pages/images", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: imgId }),
      });
      // Task 1-5: res.ok 체크 추가
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      // Task 1-3: data.ok 체크 추가
      if (!data.ok) throw new Error(data.message ?? "삭제 실패");

      setSuccess("이미지가 삭제되었습니다.");
    } catch (err) {
      // Task 1-3: 실패 시 setImages(previousImages) 롤백
      setImages(previousImages);
      setError(`이미지 삭제 실패: ${err instanceof Error ? err.message : "알 수 없음"}`);
    }
  };

  // Task 1-1: encodeHtml 함수 추가 (HTML 엔티티 인코딩으로 XSS 방지)
  const encodeHtml = (text: string): string => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
  };

  // Task 1-1: buildFormFields 재사용 함수 (폼 필드 동적 생성)
  const buildFormFields = (): string => {
    let html = "";
    formFields.forEach((field) => {
      const placeholder = encodeHtml(field.placeholder || field.label);
      const required = field.required ? "required" : "";

      if (field.type === "text" || field.type === "tel" || field.type === "email") {
        html += `<input type="${field.type}" name="${field.name}" placeholder="${placeholder}" ${required} style="width:100%;padding:14px 16px;border:1px solid #ddd;border-radius:10px;font-size:15px;margin-bottom:12px;box-sizing:border-box;outline:none;" />`;
      } else if (field.type === "select") {
        const options = field.options?.map(opt => `<option value="${encodeHtml(opt)}">${encodeHtml(opt)}</option>`).join('') || '';
        html += `<select name="${field.name}" ${required} style="width:100%;padding:14px 16px;border:1px solid #ddd;border-radius:10px;font-size:15px;margin-bottom:12px;box-sizing:border-box;outline:none;"><option value="">선택하세요</option>${options}</select>`;
      } else if (field.type === "checkbox") {
        html += `<label style="display:flex;align-items:center;gap:8px;margin-bottom:12px;"><input type="checkbox" name="${field.name}" style="width:16px;height:16px;" /><span style="font-size:13px;color:#666;">${encodeHtml(field.label)}</span></label>`;
      }
    });
    return html;
  };

  // Task 1-1: buildHtmlFromImages 수정 — XSS 방지 + 동적 폼 생성
  const buildHtmlFromImages = (): string => {
    const imgTags = images.map((img, idx) => {
      // Task 1-1: img.driveFileId 인코딩
      const encodedFileId = encodeHtml(img.driveFileId);
      // Task 1-1: altText 동적화
      const altText = encodeHtml(img.altText || `이미지 ${idx + 1}/${images.length}`);
      const src = `https://lh3.googleusercontent.com/d/${encodedFileId}=w1200`;
      const ar = img.width && img.height ? `aspect-ratio:${img.width}/${img.height};` : "";
      return `<img src="${src}" alt="${altText}" style="width:100%;display:block;${ar}" loading="lazy" />`;
    }).join("\n");

    // Task 1-1: 더미 데이터 제거, 동적 폼 생성, footerText 사용
    const formFieldsHtml = buildFormFields();
    const encodedButtonTitle = encodeHtml(buttonTitle || "신청하기");
    const encodedFooterText = footerText ? encodeHtml(footerText) : "";

    return `<div style="margin:0;padding:0;line-height:0;background:#fff;">\n${imgTags}\n</div>\n<form style="max-width:480px;margin:0 auto;padding:32px 20px 48px;background:#fff;font-family:'Pretendard',sans-serif;"><h3 style="text-align:center;font-size:22px;font-weight:700;color:#1a1a1a;margin:0 0 8px;">지금 바로 신청하세요</h3><p style="text-align:center;font-size:14px;color:#888;margin:0 0 24px;">상담 신청 후 담당자가 연락드립니다</p>${formFieldsHtml}<button type="submit" style="width:100%;padding:16px;background:#FF6B35;color:#fff;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;">${encodedButtonTitle}</button>${encodedFooterText ? `<p style="text-align:center;font-size:12px;color:#999;margin-top:12px;">${encodedFooterText}</p>` : ""}</form>`;
  };

  // save 함수 헬퍼: 페이지 페이로드 구성
  const buildPagePayload = () => {
    const content = editorMode === "image" ? buildHtmlFromImages() : html;
    return {
      title, partnerId, htmlContent: content, editorMode,
      paymentEnabled,
      infoCollection: true,
      formConfig: {
        fields: formFields,
        ...(footerText ? { footerText } : {}),
      },
      ...(exposureTitle     ? { exposureTitle }                     : { exposureTitle: null }),
      ...(exposureImage     ? { exposureImage }                     : { exposureImage: null }),
      ...(buttonTitle       ? { buttonTitle }                       : { buttonTitle: null }),
      ...(completionPageUrl ? { completionPageUrl }                 : { completionPageUrl: null }),
      ...(headerScript      ? { headerScript }                      : { headerScript: null }),
      ...(description       ? { description }                       : { description: null }),
      commentEnabled,
      commentConfig: commentEnabled ? { count: commentCount, dateFrom: commentDateFrom, dateTo: commentDateTo } : undefined,
      ...(paymentEnabled ? {
        paymentType, productName: productName || null,
        productPrice: parseInt(productPrice) || null,
        ...(paymentType === "subscription" ? { cycleDay: parseInt(cycleDay), expireDate: expireDate || null } : {}),
      } : {}),
    };
  };

  // save 함수 헬퍼: API 호출
  const savePageToAPI = async (payload: ReturnType<typeof buildPagePayload>) => {
    const res = await fetch(`/api/b2b-landing/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  // save 함수 헬퍼: 에러 처리
  const handleSaveError = (err: unknown) => {
    setSaveMsg("");
    setError(`저장 실패: ${err instanceof Error ? err.message : "알 수 없음"}`);
  };

  // Task 1-5: save 함수 — 분리된 헬퍼 함수 사용
  const save = async () => {
    if (!title.trim()) { setError("제목을 입력하세요."); return; }
    setSaving(true);
    setError("");

    try {
      const payload = buildPagePayload();
      const data = await savePageToAPI(payload);
      if (data.ok) {
        setSaveMsg("저장됐어요!");
      } else {
        throw new Error(data.message ?? "저장 실패");
      }
    } catch (err) {
      handleSaveError(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="h-screen bg-gray-50 animate-pulse" />;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-700" aria-label="뒤로 가기">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="B2B 페이지 제목"
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
          <button
            onClick={() => setTab("comments")}
            className={`px-3 py-1.5 font-medium flex items-center gap-1 transition-colors ${tab === "comments" ? "bg-navy-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}
          >
            <MessageSquare className="w-3 h-3" /> 후기 {comments.length > 0 && `(${comments.length})`}
          </button>
          <button
            onClick={() => setTab("stats")}
            className={`px-3 py-1.5 font-medium flex items-center gap-1 transition-colors ${tab === "stats" ? "bg-navy-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}
          >
            <BarChart2 className="w-3 h-3" /> 통계
          </button>
        </div>
        {tab === "editor" && (
          <>
            {/* 모드 토글 */}
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button onClick={() => setEditorMode("image")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${editorMode === "image" ? "bg-white text-navy-900 shadow-sm" : "text-gray-500"}`}
                aria-label="이미지형 에디터 선택">
                <ImageIcon className="w-3 h-3" /> 이미지형
              </button>
              <button onClick={() => setEditorMode("html")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${editorMode === "html" ? "bg-white text-navy-900 shadow-sm" : "text-gray-500"}`}
                aria-label="HTML형 에디터 선택">
                <Code className="w-3 h-3" /> HTML형
              </button>
            </div>
            <button onClick={() => setPreview(!preview)} className="text-gray-500 hover:text-navy-900 p-1.5" aria-label={preview ? "미리보기 종료" : "미리보기 시작"}>
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

      {/* 에디터 탭 */}
      {tab === "editor" && (
        <>
          {/* 설정 바 */}
          <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 whitespace-nowrap">파트너 ID</label>
              <input
                value={partnerId || ""}
                onChange={(e) => setPartnerId(e.target.value || null)}
                placeholder="파트너 ID (선택사항)"
                className="border border-gray-200 rounded px-2 py-1 text-xs w-40 focus:outline-none focus:border-gold-500"
              />
            </div>
            {/* 결제 설정 */}
            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100">
              <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                <input type="checkbox" checked={paymentEnabled} onChange={(e) => setPaymentEnabled(e.target.checked)} className="w-3.5 h-3.5" />
                결제 기능
              </label>
              {paymentEnabled && (
                <>
                  <select value={paymentType} onChange={(e) => setPaymentType(e.target.value as "onetime" | "subscription")} className="border border-gray-200 rounded px-2 py-1 text-xs">
                    <option value="onetime">일반 결제</option>
                    <option value="subscription">정기 결제</option>
                  </select>
                  <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="상품명" className="border border-gray-200 rounded px-2 py-1 text-xs w-28" />
                  <input type="number" value={productPrice} onChange={(e) => setProductPrice(e.target.value)} placeholder="금액" className="border border-gray-200 rounded px-2 py-1 text-xs w-20" />
                  <span className="text-xs text-gray-400">원</span>
                  {paymentType === "subscription" && (
                    <>
                      <select value={cycleDay} onChange={(e) => setCycleDay(e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-xs">
                        {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}일</option>)}
                        <option value="90">말일</option>
                      </select>
                      <input type="date" value={expireDate} onChange={(e) => setExpireDate(e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-xs" />
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 고급 설정 (폼 필드 / 노출 / 완료 URL / 헤더 스크립트) */}
          <div className="border-b border-gray-100 shrink-0">
            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              <span>고급 설정 (폼 필드 · 노출 제목/이미지 · 완료 URL · 헤더 스크립트)</span>
              <span>{showAdvanced ? "▲" : "▼"}</span>
            </button>
            {showAdvanced && (
              <div className="px-4 py-3 bg-white space-y-3">
                {/* 폼 필드 빌더 */}
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1.5">신청 폼 필드 (드래그로 순서 변경 가능)</p>
                  <FormBuilder
                    initialFields={formFields}
                    onChange={setFormFields}
                  />
                </div>
                {/* 푸터 */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 w-24 shrink-0">폼 하단 텍스트</label>
                  <input
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    placeholder="예: 개인정보 수집에 동의합니다"
                    className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400"
                  />
                </div>
                {/* 신청 버튼 이름 */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 w-24 shrink-0">신청 버튼 이름</label>
                  <input
                    value={buttonTitle}
                    onChange={(e) => setButtonTitle(e.target.value)}
                    placeholder="예: 무료 상담 신청하기"
                    className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400"
                  />
                </div>
                {/* 완료 후 이동 URL */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 w-24 shrink-0">완료 후 이동 URL</label>
                  <input
                    value={completionPageUrl}
                    onChange={(e) => setCompletionPageUrl(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400"
                  />
                </div>
                {/* 노출 제목 (OG) */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 w-24 shrink-0">카카오 공유 제목</label>
                  <input
                    value={exposureTitle}
                    onChange={(e) => setExposureTitle(e.target.value)}
                    placeholder="SNS 공유 시 표시될 제목"
                    className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400"
                  />
                </div>
                {/* 설명 */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 w-24 shrink-0">페이지 설명</label>
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="SNS 공유 시 표시될 설명"
                    className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400"
                  />
                </div>
                {/* 헤더 스크립트 */}
                <div className="flex items-start gap-2">
                  <label className="text-xs text-gray-500 w-24 shrink-0 mt-1">헤더 스크립트</label>
                  <textarea
                    value={headerScript}
                    onChange={(e) => setHeaderScript(e.target.value)}
                    placeholder="<script>...</script> 픽셀 코드 등"
                    rows={2}
                    className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-blue-400 resize-y"
                  />
                </div>
                {/* 댓글 설정 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                    <input type="checkbox" checked={commentEnabled} onChange={(e) => { setCommentEnabled(e.target.checked); }} className="w-3 h-3" />
                    AI 후기 생성
                  </label>
                  {commentEnabled && (
                    <>
                      <input type="number" min={1} max={30} value={commentCount}
                        onChange={(e) => setCommentCount(parseInt(e.target.value) || 5)}
                        className="border border-gray-200 rounded px-2 py-1 text-xs w-14"
                      />
                      <span className="text-xs text-gray-400">개, 기간:</span>
                      <input type="date" value={commentDateFrom} onChange={(e) => setCommentDateFrom(e.target.value)}
                        className="border border-gray-200 rounded px-2 py-1 text-xs"
                      />
                      <span className="text-xs text-gray-400">~</span>
                      <input type="date" value={commentDateTo} onChange={(e) => setCommentDateTo(e.target.value)}
                        className="border border-gray-200 rounded px-2 py-1 text-xs"
                      />
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          {/* 신청 완료 이메일 설정 */}
          <div className="flex flex-wrap items-start gap-3 px-4 py-2 bg-blue-50 border-b border-blue-100 shrink-0">
            <label className="text-xs font-medium text-blue-700 flex items-center gap-1.5 mt-1">
              <Mail className="w-3.5 h-3.5" />
              신청 완료 이메일
              <input type="checkbox" checked={regEmailEnabled} onChange={(e) => setRegEmailEnabled(e.target.checked)} className="w-3.5 h-3.5 ml-1" />
              <span className={`ml-0.5 ${regEmailEnabled ? "text-blue-600" : "text-gray-400"}`}>{regEmailEnabled ? "ON" : "OFF"}</span>
            </label>
            {regEmailEnabled && (
              <>
                <input
                  type="text"
                  value={regEmailSubject}
                  onChange={(e) => setRegEmailSubject(e.target.value)}
                  placeholder="이메일 제목 (예: [이름]님, 신청이 완료되었습니다)"
                  className="border border-blue-200 rounded px-2 py-1 text-xs w-72 focus:outline-none focus:border-blue-500"
                />
                <textarea
                  value={regEmailContent}
                  onChange={(e) => setRegEmailContent(e.target.value)}
                  placeholder="이메일 본문 ([고객명] 변수 사용 가능, HTML 태그 허용)"
                  rows={2}
                  className="border border-blue-200 rounded px-2 py-1 text-xs w-96 resize-y focus:outline-none focus:border-blue-500"
                />
              </>
            )}
            <button
              onClick={saveEmailSettings}
              className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-blue-700"
            >저장</button>
            {emailSaveMsg && <span className={`text-xs mt-1 ${emailSaveMsg.includes("실패") ? "text-red-500" : "text-green-600"}`}>{emailSaveMsg}</span>}
          </div>
          <div className="flex-1 overflow-hidden">
            {preview ? (
              <iframe srcDoc={editorMode === "image" ? buildHtmlFromImages() : html} className="w-full h-full border-0" title="preview" sandbox="allow-scripts" />
            ) : editorMode === "html" ? (
              <HtmlEditor value={html} onChange={setHtml} />
            ) : (
              /* 이미지형 에디터 */
              <div className="h-full overflow-y-auto p-6 bg-gray-50">
                <div className="max-w-2xl mx-auto">
                  <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors mb-6 ${uploading ? "border-gold-400 bg-gold-50" : "border-gray-300 hover:border-gold-400 hover:bg-gray-100"}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files); }}
                  >
                    <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-600">
                      {uploading
                        ? `업로드 중... (${uploadProgress.processed}/${uploadProgress.total}) ${uploadProgress.percent}%`
                        : "이미지를 드래그하거나 클릭하여 업로드"}
                    </p>
                    {uploading && uploadProgress.total > 0 && (
                      <div className="w-full bg-gray-200 rounded-full h-2 my-3">
                        <div
                          style={{ width: `${uploadProgress.percent}%` }}
                          className="bg-gold-500 h-full rounded-full transition-all duration-300"
                        />
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP → 자동 WebP 변환 / GIF → 압축 유지 / 최대 20MB</p>
                    {!uploading && (
                      <p className="text-xs text-blue-600 mt-2">💡 팁: 최대 5개씩 선택하면 빠릅니다. (3~5개 동시 처리)</p>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                      onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ""; }} />
                  </div>
                  {images.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-gray-700">이미지 {images.length}장 — 드래그로 순서 변경</p>
                      {images.map((img, idx) => (
                        <div key={img.id} draggable onDragStart={() => handleDragStart(idx)}
                          onDragOver={(e) => handleDragOver(e, idx)} onDragEnd={handleDragEnd}
                          className={`flex items-center gap-3 bg-white rounded-xl border p-3 transition-all ${dragIdx === idx ? "border-gold-400 shadow-lg scale-[1.02]" : "border-gray-200 hover:border-gray-300"}`}>
                          <GripVertical className="w-5 h-5 text-gray-300 cursor-grab shrink-0" />
                          <div className="w-20 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                            <img src={img.url} alt="" className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{img.fileName}</p>
                            <p className="text-xs text-gray-400">{img.width}x{img.height} · {img.mimeType}</p>
                          </div>
                          <span className="text-xs text-gray-400 shrink-0">#{idx + 1}</span>
                          <button onClick={() => removeImage(img.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {images.length === 0 && !uploading && (
                    <div className="text-center py-12 text-gray-400">
                      <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
                      <p className="text-lg font-medium">이미지를 업로드하면 B2B페이지가 자동으로 만들어집니다</p>
                      <p className="text-sm mt-2">이미지가 세로로 쌓이고, 맨 아래에 신청 폼이 자동으로 붙습니다</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* 등록자 목록 탭 */}
      {tab === "registrations" && (
        <RegistrationsTab
          registrations={registrations}
          regTotal={regTotal}
          regPage={regPage}
          regLoading={regLoading}
          onPageChange={loadRegistrations}
        />
      )}

      {/* 댓글 관리 탭 */}
      {tab === "comments" && (
        <CommentsTab
          comments={comments}
          commentEnabled={commentEnabled}
          genCount={genCount}
          generating={generating}
          commentMsg={commentMsg}
          onToggleEnabled={toggleCommentEnabled}
          onGenCountChange={setGenCount}
          onGenerate={generateComments}
          onDelete={deleteComment}
        />
      )}

      {/* 통계 탭 — 5단계 퍼널 */}
      {tab === "stats" && (
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-800">퍼널 전환 통계</h2>
              <button onClick={loadStats} className="text-xs text-gray-500 hover:text-navy-900 underline">새로고침</button>
            </div>
            {statsLoading ? (
              <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-gray-200 animate-pulse rounded-xl" />)}</div>
            ) : stats ? (
              <>
                {/* 5단계 퍼널 카드 */}
                {[
                  { label: "방문",   value: stats.viewCount,    color: "bg-gray-100 text-gray-700",   rate: null },
                  { label: "신청",   value: stats.registered,   color: "bg-blue-100 text-blue-700",   rate: `방문→신청 ${stats.rates.visitToRegister}%` },
                  { label: "이메일", value: stats.emailSent,    color: "bg-indigo-100 text-indigo-700", rate: `신청→이메일 ${stats.rates.registerToEmail}%` },
                  { label: "퍼널",   value: stats.funnelEntered, color: "bg-amber-100 text-amber-700",  rate: `신청→퍼널 ${stats.rates.registerToFunnel}%` },
                  { label: "구매",   value: stats.purchased,    color: "bg-green-100 text-green-700",  rate: `퍼널→구매 ${stats.rates.funnelToPurchase}%` },
                ].map((s, idx) => (
                  <div key={s.label}>
                    <div className={`flex items-center justify-between rounded-xl px-4 py-3 ${s.color}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold w-4 text-center opacity-50">{idx + 1}</span>
                        <span className="text-sm font-semibold">{s.label}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        {s.rate && <span className="text-xs opacity-70">{s.rate}</span>}
                        <span className="text-xl font-bold tabular-nums">{s.value.toLocaleString()}</span>
                      </div>
                    </div>
                    {idx < 4 && (
                      <div className="flex justify-center py-1 text-gray-300 text-xs">▼</div>
                    )}
                  </div>
                ))}
                <div className="mt-4 p-3 bg-gray-100 rounded-xl text-xs text-gray-500">
                  최종 전환율 (방문→구매): <span className="font-bold text-gray-700">{stats.rates.visitToPurchase}%</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">통계를 불러오지 못했습니다.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
