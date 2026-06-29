"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, Users, MessageSquare, ImageIcon, Code, Upload, X, GripVertical, BarChart2, Share2, Mail } from "lucide-react";
import dynamic from "next/dynamic";
import { RegistrationsTab } from "./components/RegistrationsTab";
import { CommentsTab } from "./components/CommentsTab";
import FormBuilder, { FormField } from "@/components/forms/FormBuilder";
import { MAX_IMAGE_UPLOAD_BYTES, GIF_MAX_UPLOAD_BYTES, prepareImageForUpload } from "@/lib/client-image-compress";
import { Block, BlocksConfig } from "@/lib/landing-page-blocks";

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
  publicReady?: boolean;  // false면 드라이브 공개권한 부여 실패 → 라이브 미리보기 잠시 지연
};

// CTA 심리학 맵 (new/page.tsx와 대칭)
const CTA_PSYCHOLOGY_MAP: Record<string, { emoji: string; text: string; psychology: string; description: string; bgColor: string; borderColor: string; hoverBgColor: string }> = {
  default: {
    emoji: '✓',
    text: '신청하기',
    psychology: '기본 액션',
    description: '모든 방문자를 위한 표준 신청 버튼입니다.',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    hoverBgColor: 'hover:bg-gray-200',
  },
  urgent:  {
    emoji: '⚡',
    text: '지금 신청하기',
    psychology: '긴박감',
    description: '긴급함과 즉시 행동 필요성을 강조합니다. 마감 임박, 한정 시간 오퍼에 최적입니다.',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-300',
    hoverBgColor: 'hover:bg-red-100',
  },
  explore: {
    emoji: '👑',
    text: '제한된 자리 예약',
    psychology: '희소성',
    description: '한정된 자리 또는 수량이 있음을 암시합니다. FOMO 심리로 즉시 결정을 유도합니다.',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-300',
    hoverBgColor: 'hover:bg-yellow-100',
  },
  reserve: {
    emoji: '🔥',
    text: '마감 전 신청',
    psychology: '손실회피',
    description: '마감 시간을 강조하여 기회를 놓칠 수 있다는 두려움을 유발합니다.',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-300',
    hoverBgColor: 'hover:bg-orange-100',
  },
};

export default function EditLandingPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);
  // stale closure 방지: 최신 save 함수를 항상 참조하기 위한 ref
  const saveRef = useRef<() => Promise<void>>(async () => {});
  const [_success, setSuccess]   = useState("");

  const [tab, setTab]           = useState<"editor" | "registrations" | "comments" | "stats" | "share">(
    searchParams.get("tab") === "registrations" ? "registrations" :
    searchParams.get("tab") === "comments"      ? "comments"      :
    searchParams.get("tab") === "stats"         ? "stats"         :
    searchParams.get("tab") === "share"         ? "share"         : "editor"
  );
  const [title, setTitle]       = useState("");
  const [slug, setSlug]         = useState("");
  const [html, setHtml]         = useState("");
  const [unsaved, setUnsaved]   = useState(false);
  const [editorMode, setEditorMode] = useState<"html" | "image">("html");
  const [preview, setPreview]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [saveMsg, setSaveMsg]   = useState("");
  const [uploadProgress, setUploadProgress] = useState({ processed: 0, total: 0, percent: 0 });
  // AI 카피 생성 모달
  const [aiModalOpen, setAiModalOpen]       = useState(false);
  const [aiProductName, setAiProductName]   = useState("");
  const [aiTargetAudience, setAiTargetAudience] = useState("");
  const [aiTone, setAiTone]                 = useState("");
  const [aiGenerating, setAiGenerating]     = useState(false);
  const [aiError, setAiError]               = useState("");

  // 이미지 모드
  const [images, setImages]     = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragIdx, setDragIdx]   = useState<number | null>(null);
  // 이름+연락처 입력 시 "그룹 관리(/groups)"로 연결 — 대그룹=카테고리, 소그룹=그룹명(랜딩페이지 제목)
  const [groupCategories, setGroupCategories] = useState<string[]>([]); // 대그룹(카테고리) 후보 = 불러오기
  const [parentCategory, setParentCategory]   = useState<string>("");   // 선택된 대그룹(카테고리)
  const [addingCategory, setAddingCategory]   = useState(false);        // 대그룹 직접 추가 모드
  const [newCategory, setNewCategory]         = useState("");           // 새 대그룹 이름
  const [subGroupName, setSubGroupName]       = useState("");           // 소그룹(=랜딩페이지 제목)

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
  type MgrComment = { id: string; authorName: string; content: string; isAutoGenerated: boolean; createdAt: string };
  const [comments,      setComments]     = useState<MgrComment[]>([]);
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

  // 공유 (OWNER + GLOBAL_ADMIN) — 조직 단위 공유
  type ShareEntry   = { id: string; sharedToOrgId: string; sharedToOrgName: string; isGlobal: boolean; sharedByName: string | null; createdAt: string };
  type ShareableOrg = { orgId: string; label: string };
  const [shares,        setShares]        = useState<ShareEntry[]>([]);
  const [shareableOrgs, setShareableOrgs] = useState<ShareableOrg[]>([]);
  const [shareOrgId,    setShareOrgId]    = useState("");
  const [shareMsg,    setShareMsg]    = useState("");
  const [b2bEduType, setB2bEduType] = useState<"" | "INQUIRER" | "BUYER">("");

  // new/page.tsx에서 이식한 추가 편집 필드
  const [exposureTitle, setExposureTitle]       = useState("");
  const [exposureImage, setExposureImage]       = useState("");
  const [buttonTitle, setButtonTitle]           = useState("");
  const [completionPageUrl, setCompletionPageUrl] = useState("");
  const [headerScript, setHeaderScript]         = useState("");
  const [description, setDescription]           = useState("");
  const [footer, setFooter]                     = useState("");
  const [showAdvanced, setShowAdvanced]         = useState(false);
  const [formFields, setFormFields] = useState<FormField[]>([
    { id: 'name', name: 'name', label: '이름', type: 'text', required: true, placeholder: '이름을 입력하세요' },
    { id: 'phone', name: 'phone', label: '전화번호', type: 'tel', required: true, placeholder: '010-0000-0000' },
    { id: 'email', name: 'email', label: '이메일', type: 'email', required: false, placeholder: 'example@email.com' },
  ]);
  const [additionalFields, setAdditionalFields] = useState<{ id: string; name: string; required: boolean }[]>([]);
  // 블록 에디터 상태 (blocksConfig 복원용)
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<BlocksConfig['selectedFeatures']>({
    video: false, timer: false, testimonial: false, faq: false,
  });
  // CTA 유형 (new/page.tsx와 대칭)
  const [ctaType, setCtaType] = useState<string>('default');
  // Task 1-5: 초기 데이터 로딩 — HTTP 에러 처리 추가
  useEffect(() => {
    const ctrl = new AbortController();
    const { signal } = ctrl;
    Promise.all([
      fetch(`/api/landing-pages/${id}`, { signal }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }).catch((e) => { if (e?.name === 'AbortError') throw e; return { ok: false }; }),
      fetch("/api/groups", { signal }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }).catch((e) => { if (e?.name === 'AbortError') throw e; return { ok: false }; }),
      fetch("/api/landing-pages/shareable-orgs", { signal }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }).catch((e) => { if (e?.name === 'AbortError') throw e; return { ok: false }; }),
    ]).then(([pageData, groupData, shareableOrgsData]) => {
      if (pageData.ok && pageData.page) {
        setTitle(pageData.page.title ?? "");
        setSlug(pageData.page.slug ?? "");
        setHtml(pageData.page.htmlContent ?? "");
        setEditorMode(pageData.page.editorMode === "image" ? "image" : "html");
        // 대그룹(카테고리)/소그룹(그룹명) prefill — 연결된 그룹이 있으면 그 값, 없으면 소그룹은 제목 기본값
        {
          const grp = pageData.page.group as { name?: string; category?: string | null } | null | undefined;
          if (grp) {
            setSubGroupName(grp.name ?? "");
            setParentCategory(grp.category ?? "");
          } else {
            setSubGroupName(pageData.page.title ?? "");
          }
        }
        setCommentEnabled(pageData.page.commentEnabled ?? false);
        setPaymentEnabled(pageData.page.paymentEnabled ?? false);
        // 이메일 설정
        setRegEmailEnabled(pageData.page.regEmailEnabled ?? false);
        setRegEmailSubject(pageData.page.regEmailSubject ?? "");
        setRegEmailContent(pageData.page.regEmailContent ?? "");
        // 이미지 로드
        if (pageData.page.images && Array.isArray(pageData.page.images) && pageData.page.images.length) {
          setImages(pageData.page.images.map((img: { id: string; sortOrder: number; altText?: string; imageAsset: { id: string; driveFileId: string; originalFileName: string; mimeType: string; width: number; height: number } }) => ({
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
        setExpireDate(pageData.page.expireDate ? pageData.page.expireDate.split("T")[0] : "");
        const fc = pageData.page.formConfig as { b2bEduType?: string; fields?: FormField[]; footer?: string; additionalFields?: { id: string; name: string; required: boolean }[] } | null;
        setB2bEduType((fc?.b2bEduType as "" | "INQUIRER" | "BUYER") ?? "");
        if (fc?.fields && Array.isArray(fc.fields)) setFormFields(fc.fields);
        if (fc?.footer) setFooter(fc.footer);
        if (fc?.additionalFields && Array.isArray(fc.additionalFields)) setAdditionalFields(fc.additionalFields);
        // 추가 편집 필드
        setExposureTitle(pageData.page.exposureTitle ?? "");
        setExposureImage(pageData.page.exposureImage ?? "");
        setButtonTitle(pageData.page.buttonTitle ?? "");
        setCompletionPageUrl(pageData.page.completionPageUrl ?? "");
        setHeaderScript(pageData.page.headerScript ?? "");
        setDescription(pageData.page.description ?? "");
        // 커뮤니티 Q&A: ON/OFF만(commentEnabled은 별도 로드). 개수·날짜 설정 폐지.
        // blocksConfig 복원 — new/page.tsx와 대칭: { blocks, selectedFeatures }
        if (pageData.page.blocksConfig) {
          try {
            const parsed = JSON.parse(
              typeof pageData.page.blocksConfig === 'string'
                ? pageData.page.blocksConfig
                : JSON.stringify(pageData.page.blocksConfig)
            ) as BlocksConfig;
            if (parsed.blocks && Array.isArray(parsed.blocks)) {
              setBlocks(parsed.blocks);
            }
            if (parsed.selectedFeatures && typeof parsed.selectedFeatures === 'object') {
              setSelectedFeatures(parsed.selectedFeatures);
            }
          } catch {
            // blocksConfig 파싱 실패는 조용히 무시 (레거시 데이터)
          }
        }
        // ctaType 복원 — new/page.tsx와 대칭
        if (pageData.page.ctaType) {
          setCtaType(pageData.page.ctaType);
        }
      }
      if (groupData.ok) setGroupCategories(groupData.categories ?? []);
      if (shareableOrgsData.ok && shareableOrgsData.orgs) {
        setShareableOrgs(shareableOrgsData.orgs.map((o: { orgId: string; label: string }) => ({ orgId: o.orgId, label: o.label })));
      }
      if (!signal.aborted) setLoading(false);
    }).catch((e) => { if (e?.name !== 'AbortError') setLoading(false); });
    return () => ctrl.abort();
  }, [id]);

  // Task 1-5: loadStats — HTTP 에러 처리 추가
  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const res  = await fetch(`/api/landing-pages/${id}/stats`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.ok) setStats(data.stats);
    } catch {
      setError("통계를 불러오지 못했습니다.");
    } finally {
      setStatsLoading(false);
    }
  };

  // Task 1-5: loadShares — HTTP 에러 처리 추가
  const loadShares = async () => {
    try {
      const res  = await fetch(`/api/landing-pages/${id}/share`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.ok) setShares(data.shares ?? []);
    } catch { /* 권한 없는 역할은 조용히 무시 */ }
  };

  const saveEmailSettings = async () => {
    setEmailSaveMsg("");
    try {
      const res = await fetch(`/api/landing-pages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regEmailEnabled, regEmailSubject: regEmailSubject || null, regEmailContent: regEmailContent || null }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data) throw new Error("Response parsing failed");
      setEmailSaveMsg(data.ok ? "저장됐어요!" : "저장 실패");
    } catch (err) {
      setEmailSaveMsg(`저장 실패: ${err instanceof Error ? err.message : "알 수 없음"}`);
    }
  };

  const addShare = async () => {
    if (!shareOrgId) return;
    setShareMsg("");
    try {
      const res = await fetch(`/api/landing-pages/${id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sharedToOrgId: shareOrgId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.ok) {
        setShareMsg("공유 완료!");
        setShareOrgId("");
        loadShares();
      } else {
        setShareMsg(data.message ?? "공유 실패");
      }
    } catch (err) {
      setShareMsg(`공유 실패: ${err instanceof Error ? err.message : "알 수 없음"}`);
    }
  };

  // Task 1-5: removeShare — HTTP 에러 처리 추가
  const removeShare = async (sharedToOrgId: string) => {
    try {
      const res = await fetch(`/api/landing-pages/${id}/share?sharedToOrgId=${encodeURIComponent(sharedToOrgId)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setShares((prev) => prev.filter((s) => s.sharedToOrgId !== sharedToOrgId));
    } catch {
      setError("공유 취소 실패");
    }
  };

  // Task 1-5: loadRegistrations — HTTP 에러 처리 추가
  const loadRegistrations = async (p: number) => {
    setRegLoading(true);
    try {
      const res = await fetch(`/api/landing-pages/${id}/registrations?page=${p}&limit=20`);
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
    if (shareMsg) {
      const timerId = setTimeout(() => setShareMsg(""), 2500);
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
  }, [emailSaveMsg, shareMsg, saveMsg]);

  // T28: Auto-save — 5초 debounce (html 변경 시)
  // saveRef.current를 사용해 stale closure 방지 (save 함수가 title/slug 등 state를 캡처하므로)
  useEffect(() => {
    if (loading) return; // 초기 로딩 중에는 트리거하지 않음
    setUnsaved(true);
    const timer = setTimeout(() => {
      saveRef.current().then(() => setUnsaved(false)).catch(() => {/* save() 내부에서 에러 처리 */});
    }, 5000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html]);

  // T28: beforeunload — 미저장 시 경고
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (unsaved) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [unsaved]);

  useEffect(() => {
    if (tab === "registrations") loadRegistrations(1);
    if (tab === "comments")      loadComments();
    if (tab === "stats")         loadStats();
    if (tab === "share")         loadShares();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, id]);

  // Task 1-5: loadComments — HTTP 에러 처리 추가
  const loadComments = async () => {
    try {
      const res = await fetch(`/api/landing-pages/${id}/comments`);
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
      const res = await fetch(`/api/landing-pages/${id}/comments?commentId=${commentId}`, { method: "DELETE" });
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
      const res = await fetch(`/api/landing-pages/${id}`, {
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
      const res = await fetch(`/api/landing-pages/${id}/comments/generate`, {
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
    // Windows 드래그 시 MIME이 빈 문자열일 수 있어 확장자도 함께 판정(new 페이지와 통일)
    const isImage = file.type.startsWith("image/") || /\.(jpe?g|png|gif|webp|bmp)$/i.test(file.name);
    if (!isImage) return { ok: false, error: `${file.name}: 이미지 형식 아님` };
    // GIF는 압축 없이 원본 전송 → 본문 한도(~4.5MB) 직격. 4MB 사전 차단으로 정직 안내.
    const isGif = file.type === "image/gif" || /\.gif$/i.test(file.name);
    if (isGif && file.size > GIF_MAX_UPLOAD_BYTES) {
      return { ok: false, error: `${file.name}: 움직이는 GIF는 약 4MB까지 가능합니다. 용량을 줄이거나 JPG·PNG로 올려주세요.` };
    }
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) return { ok: false, error: `${file.name}: 100MB 초과` };

    const uploadFile = await prepareImageForUpload(file);
    const formData = new FormData();
    formData.append("file", uploadFile);
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
    // 윈도우 드래그 시 MIME 빈값 → 확장자도 함께 판정(uploadSingleFile과 통일)
    const validFiles = Array.from(files).filter(
      (f) => f.type.startsWith("image/") || /\.(jpe?g|png|gif|webp|bmp)$/i.test(f.name),
    );

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
      // GIF는 움직임 유지를 위해 원본 스트리밍(공개 엔드포인트), 그 외는 lh3 썸네일(=w1200) 사용
      // (lh3 =w1200은 GIF를 정지 프레임으로 재인코딩하므로 GIF에 쓰면 안 됨)
      const src = img.mimeType === "image/gif"
        ? `/api/public/landing-image?id=${encodedFileId}`
        : `https://lh3.googleusercontent.com/d/${encodedFileId}=w1200`;
      const ar = img.width && img.height ? `aspect-ratio:${img.width}/${img.height};` : "";
      return `<img src="${src}" alt="${altText}" style="width:100%;display:block;${ar}" loading="lazy" />`;
    }).join("\n");

    // Task 1-1: 더미 데이터 제거, 동적 폼 생성, footer 텍스트 사용
    const formFieldsHtml = buildFormFields();
    const encodedButtonTitle = encodeHtml(buttonTitle || (paymentEnabled ? (paymentType === "subscription" ? "정기결제 시작하기" : "결제하기") : (CTA_PSYCHOLOGY_MAP[ctaType]?.text || "신청하기")));
    const encodedFooter = footer ? encodeHtml(footer) : "";

    // CTA 타입별 버튼 색상
    const buttonColorMap: Record<string, string> = {
      default: '#9CA3AF', // 회색
      urgent: '#EF4444',  // 빨강
      explore: '#FBBF24', // 노랑
      reserve: '#F97316', // 주황
    };
    const buttonColor = buttonColorMap[ctaType] || '#FF6B35';

    if (imgTags.length === 0 || !Array.isArray(images)) return `<div style="margin:0;padding:0;line-height:0;background:#fff;"></div>`;

    return `<div style="margin:0;padding:0;line-height:0;background:#fff;">\n${imgTags}\n</div>\n<form style="max-width:480px;margin:0 auto;padding:32px 20px 48px;background:#fff;font-family:'Pretendard',sans-serif;"><h3 style="text-align:center;font-size:22px;font-weight:700;color:#1a1a1a;margin:0 0 8px;">지금 바로 신청하세요</h3><p style="text-align:center;font-size:14px;color:#888;margin:0 0 24px;">상담 신청 후 담당자가 연락드립니다</p>${formFieldsHtml}<button type="submit" style="width:100%;padding:16px;background:${buttonColor};color:#fff;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;">${encodedButtonTitle}</button>${encodedFooter ? `<p style="text-align:center;font-size:12px;color:#999;margin-top:12px;">${encodedFooter}</p>` : ""}</form>`;
  };

  // 모드 전환 — 두 형식이 서로 침범하지 않도록 안전하게 전환
  // 이미지형 → HTML형: HTML 에디터가 비어 있으면 현재 이미지로 만든 HTML을 채워 "내용 사라짐" 방지
  // (이미 작성한 HTML이 있으면 덮어쓰지 않음)
  const switchMode = (mode: "html" | "image") => {
    if (mode === editorMode) return;
    if (mode === "html" && editorMode === "image" && !html.trim() && images.length > 0) {
      setHtml(buildHtmlFromImages());
    }
    setEditorMode(mode);
  };

  // T42: AI 카피 생성 — PASONA 기반 HTML 카피 생성 후 에디터에 삽입
  const generateAiCopy = async () => {
    if (!aiProductName.trim() || !aiTargetAudience.trim()) {
      setAiError("상품명과 타겟 고객을 모두 입력하세요.");
      return;
    }
    setAiGenerating(true);
    setAiError("");
    try {
      const res = await fetch(`/api/landing-pages/${id}/generate-copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: aiProductName,
          targetAudience: aiTargetAudience,
          tone: aiTone || undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.ok && data.htmlContent) {
        setHtml((prev) => (prev ? prev + "\n\n" + data.htmlContent : data.htmlContent));
        setUnsaved(true);
        setAiModalOpen(false);
        setAiProductName("");
        setAiTargetAudience("");
        setAiTone("");
        setSaveMsg("AI 카피가 에디터에 삽입됐어요!");
      } else {
        setAiError(data.message ?? "카피 생성에 실패했습니다.");
      }
    } catch (err) {
      setAiError(`생성 실패: ${err instanceof Error ? err.message : "알 수 없음"}`);
    } finally {
      setAiGenerating(false);
    }
  };

  // Task 1-5: save 함수 — HTTP 에러 처리 추가
  const save = async () => {
    if (!title.trim() || !slug.trim()) { setError("제목과 슬러그를 입력하세요."); return; }
    // 이미지형인데 이미지가 없으면 저장 차단 — 기존 내용(HTML)이 빈 폼으로 덮어써지는 사고 방지
    if (editorMode === "image" && images.length === 0) {
      setError("이미지형은 이미지를 1장 이상 올린 뒤 저장하세요. (HTML형으로 작업하려면 상단에서 HTML형을 선택하세요)");
      return;
    }
    // 결제 ON이면 상품명·금액(100원 이상) 필수 — 안 넣으면 공개페이지에서 결제가 막힘(PayApp 최소금액)
    if (paymentEnabled) {
      const pp = parseInt(productPrice, 10);
      if (!productName.trim() || !pp || pp < 100) {
        setError("결제 기능을 켜면 상품명과 결제금액(100원 이상)을 입력해야 결제하기 버튼이 작동합니다.");
        return;
      }
    }
    setSaving(true);
    setError("");

    try {
      const content = editorMode === "image" ? buildHtmlFromImages() : html;
      const res = await fetch(`/api/landing-pages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, slug, htmlContent: content, editorMode,
          // 이름+연락처 입력 시 배정 그룹: 대그룹=카테고리, 소그룹=그룹명. 서버가 그룹 관리에 생성/연결
          ...(subGroupName.trim()
            ? {
                groupCategory: addingCategory ? (newCategory.trim() || null) : (parentCategory || null),
                groupSubName: subGroupName.trim(),
              }
            : { groupId: null }),
          paymentEnabled,
          infoCollection: true,
          formConfig: {
            ...(b2bEduType ? { b2bEduType } : {}),
            fields: formFields,
            additionalFields,
            ...(footer ? { footer } : {}),
          },
          ...(exposureTitle     ? { exposureTitle }                     : { exposureTitle: null }),
          ...(exposureImage     ? { exposureImage }                     : { exposureImage: null }),
          ...(buttonTitle       ? { buttonTitle }                       : { buttonTitle: null }),
          ...(completionPageUrl ? { completionPageUrl }                 : { completionPageUrl: null }),
          ...(headerScript      ? { headerScript }                      : { headerScript: null }),
          ...(description       ? { description }                       : { description: null }),
          commentEnabled,
          // blocksConfig 저장 — new/page.tsx와 대칭
          ...(blocks.length > 0 ? {
            blocksConfig: JSON.stringify({ blocks, selectedFeatures } as BlocksConfig),
          } : {}),
          ...(paymentEnabled ? {
            paymentType, productName: productName || null,
            productPrice: parseInt(productPrice, 10) || null,
            ...(paymentType === "subscription" ? { cycleDay: parseInt(cycleDay, 10) || 1, expireDate: expireDate || null } : {}),
          } : {}),
        }),
      });
      // Task 1-5: res.ok 체크 추가
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      if (!data) throw new Error("Response parsing failed");
      if (data.ok) {
        // Task 1: setTimeout 제거 - useEffect cleanup이 자동으로 처리함 (줄 291-311)
        setSaveMsg("저장됐어요!");
        setUnsaved(false); // T28: 저장 성공 시 unsaved 해제
        // 새 대그룹(카테고리)을 추가했으면 선택값으로 확정하고, 대그룹 목록 새로고침
        if (addingCategory && newCategory.trim()) {
          setParentCategory(newCategory.trim());
          setAddingCategory(false);
          setNewCategory("");
        }
        fetch("/api/groups")
          .then((r) => (r.ok ? r.json() : { ok: false }))
          .then((d) => { if (d.ok) setGroupCategories(d.categories ?? []); })
          .catch(() => {});
      } else {
        throw new Error(data.message ?? "저장 실패");
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : "알 수 없음";
      setSaveMsg("");
      setError(`저장 실패: ${error}`);
    } finally {
      setSaving(false);
    }
  };
  // 매 렌더마다 saveRef를 최신 save로 갱신 (auto-save stale closure 방지)
  saveRef.current = save;

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
          onChange={(e) => {
            const newTitle = e.target.value;
            setTitle(newTitle);
            // T32: slug가 비어있을 때만 자동 생성
            if (!slug) {
              const autoSlug = newTitle.toLowerCase().replace(/[^a-z0-9가-힣]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
              setSlug(autoSlug);
            }
          }}
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
            <Users className="w-3 h-3" /> 등록자 {regTotal > 0 ? `(${regTotal})` : null}
          </button>
          <button
            onClick={() => setTab("comments")}
            className={`px-3 py-1.5 font-medium flex items-center gap-1 transition-colors ${tab === "comments" ? "bg-navy-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}
          >
            <MessageSquare className="w-3 h-3" /> 후기 {comments.length > 0 ? `(${comments.length})` : null}
          </button>
          <button
            onClick={() => setTab("stats")}
            className={`px-3 py-1.5 font-medium flex items-center gap-1 transition-colors ${tab === "stats" ? "bg-navy-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}
          >
            <BarChart2 className="w-3 h-3" /> 통계
          </button>
          <button
            onClick={() => setTab("share")}
            className={`px-3 py-1.5 font-medium flex items-center gap-1 transition-colors ${tab === "share" ? "bg-navy-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}
          >
            <Share2 className="w-3 h-3" /> 공유
          </button>
        </div>
        {tab === "editor" && (
          <>
            {/* 모드 토글 */}
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button onClick={() => switchMode("image")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${editorMode === "image" ? "bg-white text-navy-900 shadow-sm" : "text-gray-500"}`}>
                <ImageIcon className="w-3 h-3" /> 이미지형
              </button>
              <button onClick={() => switchMode("html")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${editorMode === "html" ? "bg-white text-navy-900 shadow-sm" : "text-gray-500"}`}>
                <Code className="w-3 h-3" /> HTML형
              </button>
            </div>
            <button
              onClick={() => setPreview(!preview)}
              className={`p-1.5 rounded-lg transition-colors ${preview ? "bg-blue-100 text-blue-600 ring-2 ring-blue-500" : "text-gray-500 hover:text-navy-900"}`}
              title={preview ? "미리보기 끄기" : "미리보기"}
            >
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
              <label className="text-xs text-gray-500 whitespace-nowrap">슬러그</label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="url-slug"
                className="border border-gray-200 rounded px-2 py-1 text-xs w-40 focus:outline-none focus:border-gold-500"
              />
            </div>
            <div className="flex items-center gap-2 flex-1 flex-wrap">
              <label className="text-xs text-gray-500 whitespace-nowrap">이름·연락처 입력 시 배정</label>
              {/* 대그룹 = 카테고리 (불러오기 / 추가하기) */}
              <span className="text-xs text-gray-400">대그룹</span>
              {addingCategory ? (
                <>
                  <input
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="새 대그룹(카테고리) 이름"
                    className="border border-gray-200 rounded px-2 py-1 text-xs w-40 focus:outline-none focus:border-gold-500"
                  />
                  <button
                    type="button"
                    onClick={() => { setAddingCategory(false); setNewCategory(""); }}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >취소</button>
                </>
              ) : (
                <select
                  value={parentCategory}
                  onChange={(e) => {
                    if (e.target.value === "__new__") { setAddingCategory(true); }
                    else { setParentCategory(e.target.value); }
                  }}
                  className="border border-gray-200 rounded px-2 py-1 text-xs w-40 focus:outline-none focus:border-gold-500"
                >
                  <option value="">(대그룹 없음)</option>
                  {groupCategories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value="__new__">+ 추가하기…</option>
                </select>
              )}
              {/* 소그룹 = 그룹명 (기본값: 랜딩페이지 제목) */}
              <span className="text-xs text-gray-400">소그룹</span>
              <input
                value={subGroupName}
                onChange={(e) => setSubGroupName(e.target.value)}
                placeholder="소그룹 제목 (예: 랜딩페이지 제목)"
                className="border border-gray-200 rounded px-2 py-1 text-xs flex-1 max-w-xs focus:outline-none focus:border-gold-500"
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
          {/* CTA 버튼 선택 */}
          <div className="px-4 py-4 bg-white border-b border-gray-100 shrink-0">
            <p className="text-sm font-semibold text-gray-800 mb-3">신청 버튼 문구를 선택하세요</p>
            <div className="space-y-2">
              {Object.entries(CTA_PSYCHOLOGY_MAP).map(([key, value]) => (
                <label
                  key={key}
                  className={`flex flex-col p-4 border-2 rounded-lg cursor-pointer transition ${
                    ctaType === key
                      ? `${value.bgColor} ${value.borderColor} shadow-md`
                      : `border-gray-200 hover:${value.borderColor}`
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="cta-edit"
                      value={key}
                      checked={ctaType === key}
                      onChange={(e) => setCtaType(e.target.value)}
                      className="mt-1 w-4 h-4 accent-amber-400 shrink-0"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{value.emoji}</span>
                        <span className="font-semibold text-gray-800">{value.text}</span>
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-white border border-gray-200 text-gray-600">
                          {value.psychology}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 ml-6">{value.description}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* B2B 문의자 자동 연결 */}
          <div className="flex items-center gap-3 px-4 py-2 bg-indigo-50 border-b border-indigo-100 shrink-0">
            <label className="text-xs font-medium text-indigo-700">B2B 자동 등록</label>
            <select
              value={b2bEduType}
              onChange={(e) => setB2bEduType(e.target.value as "" | "INQUIRER" | "BUYER")}
              className="text-xs border border-indigo-200 rounded-lg px-2 py-1 bg-white focus:outline-none"
            >
              <option value="">사용 안 함</option>
              <option value="INQUIRER">교육 문의자로 등록</option>
              <option value="BUYER">교육 구매자로 등록</option>
            </select>
            {b2bEduType && <span className="text-xs text-indigo-500">신청 시 자동으로 교육 {b2bEduType === 'INQUIRER' ? '문의자' : '구매자'}로 저장됩니다</span>}
          </div>
          {/* 고급 설정 (폼 필드 / 노출 / 완료 URL / 헤더 스크립트) */}
          <div className="border-b border-gray-100 shrink-0">
            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              <span>추가 설정 (신청 항목 · 공유 제목/이미지 · 완료 후 이동 · 광고 추적 코드)</span>
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
                {/* 추가 입력 항목 (additionalFields) */}
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1.5">추가 입력 항목</p>
                  <p className="text-xs text-gray-400 mb-2">신청 폼에 추가할 자유 입력 항목을 설정합니다.</p>
                  <div className="space-y-2">
                    {additionalFields.map((af) => (
                      <div key={af.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded px-2 py-1.5">
                        <span className="flex-1 text-xs text-gray-700">{af.name}</span>
                        <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={af.required}
                            onChange={() =>
                              setAdditionalFields((prev) =>
                                prev.map((f) => f.id === af.id ? { ...f, required: !f.required } : f)
                              )
                            }
                            className="w-3.5 h-3.5"
                          />
                          필수
                        </label>
                        <button
                          type="button"
                          onClick={() => setAdditionalFields((prev) => prev.filter((f) => f.id !== af.id))}
                          className="text-red-400 hover:text-red-600 text-xs px-1"
                          title="삭제"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-1">
                      <input
                        id="additionalFieldInput"
                        type="text"
                        placeholder="항목명 입력 (예: 직급, 부서, 메모)"
                        className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const input = e.currentTarget;
                            const val = input.value.trim();
                            if (!val) return;
                            setAdditionalFields((prev) => [
                              ...prev,
                              { id: `af_${Date.now()}`, name: val, required: false },
                            ]);
                            input.value = '';
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const input = document.getElementById('additionalFieldInput') as HTMLInputElement | null;
                          const val = input?.value.trim() ?? '';
                          if (!val) return;
                          setAdditionalFields((prev) => [
                            ...prev,
                            { id: `af_${Date.now()}`, name: val, required: false },
                          ]);
                          if (input) input.value = '';
                        }}
                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                      >
                        추가
                      </button>
                    </div>
                  </div>
                </div>
                {/* 푸터 */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 w-24 shrink-0">폼 하단 텍스트</label>
                  <input
                    value={footer}
                    onChange={(e) => setFooter(e.target.value)}
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
                  <label className="text-xs text-gray-500 w-24 shrink-0">신청 완료 후 이동</label>
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
                  <label className="text-xs text-gray-500 w-24 shrink-0 mt-1">광고 추적 코드</label>
                  <textarea
                    value={headerScript}
                    onChange={(e) => setHeaderScript(e.target.value)}
                    placeholder="페이스북/구글 광고 추적 코드를 붙여넣으세요"
                    rows={2}
                    className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-blue-400 resize-y"
                  />
                </div>
                {/* 커뮤니티 Q&A 게시판 설정 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                    <input type="checkbox" checked={commentEnabled} onChange={(e) => { setCommentEnabled(e.target.checked); }} className="w-3 h-3" />
                    커뮤니티 Q&amp;A 게시판 (질문·답변)
                  </label>
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
          {/* T42: AI 카피 생성 버튼 — HTML형 에디터 전용 */}
          {!preview && editorMode === "html" && (
            <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-50 to-blue-50 border-b border-violet-100 shrink-0">
              <button
                onClick={() => { setAiModalOpen(true); setAiError(""); }}
                className="flex items-center gap-1.5 bg-violet-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-violet-700 transition-colors"
              >
                ✨ AI 카피 생성
              </button>
              <span className="text-xs text-violet-500">PASONA 기반 크루즈 랜딩 카피를 자동 생성합니다</span>
            </div>
          )}

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
                    <p className="text-xs text-gray-400 mt-1">JPG · PNG · WebP는 자동 압축되어 큰 파일도 OK / 움직이는 GIF는 약 4MB까지 · 가로 1200px 넘으면 자동 축소</p>
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
                            <img src={`/api/landing-pages/images/proxy?id=${img.driveFileId}`} alt={img.fileName || '랜딩페이지 이미지'} className="w-full h-full object-cover" loading="lazy" onError={(e) => { const el = (e.target as HTMLImageElement); el.src = '/static/image-placeholder.svg'; console.error('Image load failed:', img.driveFileId); }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{img.fileName}</p>
                            <p className="text-xs text-gray-400">{img.width}x{img.height} · {img.mimeType}</p>
                            {img.publicReady === false && (
                              <p className="text-xs text-amber-600 mt-0.5">⏳ 미리보기 준비 중 — 목록엔 정상 저장됨</p>
                            )}
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
                      <p className="text-lg font-medium">이미지를 업로드하면 랜딩페이지가 자동으로 만들어집니다</p>
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
              <h2 className="text-base font-semibold text-gray-800">신청자 흐름 통계</h2>
              <button onClick={loadStats} className="text-xs text-gray-500 hover:text-navy-900 underline">새로고침</button>
            </div>
            {statsLoading ? (
              <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={`stat-skeleton-${i}`} className="h-14 bg-gray-200 animate-pulse rounded-xl" />)}</div>
            ) : stats ? (
              <>
                {/* 5단계 퍼널 카드 */}
                {[
                  { label: "방문",   value: stats.viewCount,    color: "bg-gray-100 text-gray-700",   rate: null },
                  { label: "신청",   value: stats.registered,   color: "bg-blue-100 text-blue-700",   rate: `방문→신청 ${stats.rates.visitToRegister}%` },
                  { label: "이메일", value: stats.emailSent,    color: "bg-indigo-100 text-indigo-700", rate: `신청→이메일 ${stats.rates.registerToEmail}%` },
                  { label: "자동문자", value: stats.funnelEntered, color: "bg-amber-100 text-amber-700",  rate: `신청→자동문자 ${stats.rates.registerToFunnel}%` },
                  { label: "구매",   value: stats.purchased,    color: "bg-green-100 text-green-700",  rate: `자동문자→구매 ${stats.rates.funnelToPurchase}%` },
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

      {/* T42: AI 카피 생성 모달 */}
      {aiModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setAiModalOpen(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-base font-bold text-gray-900 mb-1">✨ AI 카피 생성</h2>
            <p className="text-xs text-gray-500 mb-4">상품명과 타겟 고객 정보를 입력하면 크루즈 랜딩 HTML 카피를 자동으로 만들어드립니다.</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">상품명 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={aiProductName}
                  onChange={(e) => setAiProductName(e.target.value)}
                  placeholder="예: 지중해 크루즈 7박 8일"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
                  disabled={aiGenerating}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">타겟 고객 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={aiTargetAudience}
                  onChange={(e) => setAiTargetAudience(e.target.value)}
                  placeholder="예: 50대 부부, 은퇴 후 첫 여행을 계획 중인 분"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
                  disabled={aiGenerating}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">말투/톤 (선택)</label>
                <input
                  type="text"
                  value={aiTone}
                  onChange={(e) => setAiTone(e.target.value)}
                  placeholder="예: 따뜻하고 감성적인 톤, 신뢰감 있는 전문가 말투"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
                  disabled={aiGenerating}
                />
              </div>
            </div>

            {aiError && (
              <p className="mt-3 text-xs text-red-500">{aiError}</p>
            )}

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setAiModalOpen(false); setAiError(""); }}
                disabled={aiGenerating}
                className="flex-1 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40"
              >
                취소
              </button>
              <button
                onClick={generateAiCopy}
                disabled={aiGenerating || !aiProductName.trim() || !aiTargetAudience.trim()}
                className="flex-1 bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                {aiGenerating ? "생성 중..." : "카피 생성"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 공유 탭 — OWNER + GLOBAL_ADMIN */}
      {tab === "share" && (
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <div className="max-w-lg mx-auto">
            <h2 className="text-base font-semibold text-gray-800 mb-4">파트너 공유</h2>
            <p className="text-xs text-gray-500 mb-4">지사장(OWNER)에게 이 랜딩페이지를 공유합니다. 공유받은 파트너는 이 페이지를 조회할 수 있습니다.</p>

            {/* 공유 추가 */}
            <div className="flex gap-2 mb-4">
              <select
                value={shareOrgId}
                onChange={(e) => setShareOrgId(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-navy-500"
              >
                <option value="">대리점 선택</option>
                {shareableOrgs.map((o) => (
                  <option key={o.orgId} value={o.orgId}>{o.label}</option>
                ))}
              </select>
              <button
                onClick={addShare}
                disabled={!shareOrgId}
                className="bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-navy-800"
              >공유</button>
            </div>
            {shareMsg && <p className={`text-xs mb-3 ${shareMsg.includes("실패") ? "text-red-500" : "text-green-600"}`}>{shareMsg}</p>}

            {/* 공유 목록 */}
            {shares.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">공유된 대리점이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {shares.map((s) => (
                  <div key={s.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{s.sharedToOrgName}</p>
                      <p className="text-xs text-gray-400">{new Date(s.createdAt).toLocaleDateString("ko-KR")} 공유</p>
                    </div>
                    <button
                      onClick={() => removeShare(s.sharedToOrgId)}
                      className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded"
                    >취소</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
