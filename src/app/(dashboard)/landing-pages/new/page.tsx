"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ImageIcon, Code, Upload, X, GripVertical, Plus, Trash2, Smartphone, Copy, Check } from "lucide-react";
import dynamic from "next/dynamic";
import { ImageLibraryModal } from "@/components/image-library/ImageLibraryModal";
import { MAX_IMAGE_UPLOAD_BYTES, prepareImageForUpload } from "@/lib/client-image-compress";
import { BlockEditor } from "./BlockEditor";
import { Block, BlocksConfig } from "@/lib/landing-page-blocks";
import { LandingPageMetrics } from "./LandingPageMetrics";

// ═════════════════════════════════════════════════════════════
// Step 1-5: Russell Brunson 형식 기반 에디터 상수
// ═════════════════════════════════════════════════════════════

type PageFormat = 'squeeze' | 'vsl' | 'webinar' | 'funnel' | 'tripwire' | 'downsell' | 'launch' | 'hybrid';

const FORMAT_EMOJI: Record<PageFormat, string> = {
  squeeze: '🤏',
  vsl: '🎥',
  webinar: '📺',
  funnel: '🔗',
  tripwire: '⚡',
  downsell: '💰',
  launch: '🚀',
  hybrid: '🎯',
};

const FORMAT_LABELS: Record<PageFormat, string> = {
  squeeze: '상품 신청 받기',
  vsl: '영상으로 소개',
  webinar: '설명회 참가',
  funnel: '단계별 안내',
  tripwire: '특가 상품',
  downsell: '대안 상품',
  launch: '상품 런칭',
  hybrid: '자유 형식',
};

// 형식별 기대 전환율
const EXPECTED_CONVERSION_BY_FORMAT: Record<PageFormat, { baseline: number; optimized: number; lift: number }> = {
  squeeze: { baseline: 15, optimized: 45, lift: 200 },
  vsl: { baseline: 18, optimized: 52, lift: 189 },
  webinar: { baseline: 12, optimized: 48, lift: 300 },
  funnel: { baseline: 8, optimized: 35, lift: 338 },
  tripwire: { baseline: 25, optimized: 60, lift: 140 },
  downsell: { baseline: 30, optimized: 65, lift: 117 },
  launch: { baseline: 20, optimized: 55, lift: 175 },
  hybrid: { baseline: 22, optimized: 58, lift: 164 },
};

// 형식별 최소 이미지 권장 개수
const MIN_IMAGES_BY_FORMAT: Record<PageFormat, number> = {
  squeeze: 2,
  vsl: 1,
  webinar: 3,
  funnel: 4,
  tripwire: 2,
  downsell: 3,
  launch: 5,
  hybrid: 3,
};

// 형식별 필수 이미지 필드
const IMAGE_FIELDS_BY_FORMAT: Record<PageFormat, Array<{ name: string; required: boolean }>> = {
  squeeze: [{ name: 'Hero Image', required: true }],
  vsl: [{ name: 'Video Thumbnail', required: true }],
  webinar: [
    { name: 'Header Image', required: true },
    { name: 'Speaker Photo', required: true },
    { name: 'Social Proof Image', required: true },
  ],
  funnel: [
    { name: 'Step 1 Image', required: true },
    { name: 'Step 2 Image', required: true },
    { name: 'Step 3 Image', required: true },
    { name: 'Step 4 Image', required: true },
  ],
  tripwire: [
    { name: 'Hero Image', required: true },
    { name: 'Offer Image', required: false },
  ],
  downsell: [
    { name: 'Product Image', required: true },
    { name: 'Testimonial', required: false },
    { name: 'Guarantee Badge', required: false },
  ],
  launch: [
    { name: 'Banner', required: true },
    { name: 'Product 1', required: true },
    { name: 'Product 2', required: true },
    { name: 'Social Proof', required: true },
    { name: 'CTA Hero', required: true },
  ],
  hybrid: [
    { name: 'Header', required: true },
    { name: 'Content', required: false },
    { name: 'CTA', required: false },
  ],
};

// CTA 심리학 맵
const CTA_PSYCHOLOGY_MAP: Record<string, { emoji: string; text: string; psychology: string }> = {
  default: { emoji: '✓', text: '신청하기', psychology: '기본 액션' },
  urgency: { emoji: '⚡', text: '지금 신청하기', psychology: '긴박감' },
  exclusive: { emoji: '👑', text: '제한된 자리 예약', psychology: '희소성' },
  fomo: { emoji: '🔥', text: '마감 전 신청', psychology: '손실회피' },
};

// Day 0-3 SMS 템플릿
const SMS_TEMPLATES_BY_FORMAT: Record<PageFormat, Record<string, { text: string; psychology: string }>> = {
  squeeze: {
    day0: { text: '[마비즈] 크루즈 여행 특별 정보 전달받기로 선택하셨어요! 놓칠 수 없는 5가지 기밀 노하우를 공개합니다.', psychology: 'PASONA-P' },
    day1: { text: '[마비즈] 실제 고객들이 크루즈로 가족 추억 만든 방법 공개. 당신의 걱정도 이렇게 해결됩니다!', psychology: 'PASONA-S' },
    day2: { text: '[마비즈] 💎 VIP 크루즈 패키지 특가 정보 단독 공개. 평생 이 가격 다시 안 나옵니다.', psychology: 'PASONA-O' },
    day3: { text: '[마비즈] 예약 마감 24시간 남음! 지금 신청하면 5백만원 혜택 추가. 링크: www.mabiz.io', psychology: 'PASONA-A' },
  },
  vsl: {
    day0: { text: '[마비즈] 크루즈 여행 영상 공개했어요. 16분 영상이 당신의 모든 의문을 풀어줄 거예요.', psychology: 'PASONA-P' },
    day1: { text: '[마비즈] 영상 보신 분들의 반응 "우와... 이렇게 저렴한데 이 수준이라니"', psychology: 'PASONA-S' },
    day2: { text: '[마비즈] 🎁 영상 시청자 한정 선물 이벤트. 신청하면 크루즈 선상 스파 무료!', psychology: 'PASONA-O' },
    day3: { text: '[마비즈] 마감 임박! 영상 할인 쿠폰은 오늘까지만 유효합니다.', psychology: 'PASONA-A' },
  },
  webinar: {
    day0: { text: '[마비즈] 웨비나 참석 감사합니다! 다시 보기 링크를 보내드렸어요.', psychology: 'PASONA-P' },
    day1: { text: '[마비즈] 웨비나 참석자들이 공유한 실제 크루즈 스토리를 더 보고 싶으신가요?', psychology: 'PASONA-S' },
    day2: { text: '[마비즈] 🌟 웨비나 특가: 오늘 신청자 한정 + 여행 가이드북 무료!', psychology: 'PASONA-O' },
    day3: { text: '[마비즈] 웨비나 특가는 오늘 자정에 종료됩니다!', psychology: 'PASONA-A' },
  },
  funnel: {
    day0: { text: '[마비즈] Step 1 완료! 다음 단계로 진행하셨어요. Step 2를 확인해보세요.', psychology: 'PASONA-P' },
    day1: { text: '[마비즈] 제가 Step 1에서 놓친 게 있을까봐 연락했어요. 궁금한 거 있으신가요?', psychology: 'PASONA-S' },
    day2: { text: '[마비즈] 💎 특별 오퍼! Step 2 신청 고객들은 추가 20% 할인받으세요!', psychology: 'PASONA-O' },
    day3: { text: '[마비즈] 남은 Step은 2개. 오늘 완료하면 VIP 해석 무료!', psychology: 'PASONA-A' },
  },
  tripwire: {
    day0: { text: '[마비즈] 초저가 스타터 상품 신청 완료! 이제 업그레이드 옵션을 보여드릴게요.', psychology: 'PASONA-P' },
    day1: { text: '[마비즈] 97% 고객들이 선택하는 업그레이드 패키지를 확인해보세요.', psychology: 'PASONA-S' },
    day2: { text: '[마비즈] ⚡ 오늘 업그레이드 신청 시 추가 5백만원 상품권 증정!', psychology: 'PASONA-O' },
    day3: { text: '[마비즈] 마감! 업그레이드 특가는 오늘 자정까지만 유효합니다.', psychology: 'PASONA-A' },
  },
  downsell: {
    day0: { text: '[마비즈] 신청감사합니다! 하지만 예산이 맞지 않으신가요? 더 저렴한 옵션이 있습니다.', psychology: 'PASONA-P' },
    day1: { text: '[마비즈] 다운셀 패키지도 기본 기능은 모두 포함돼요. 실제 사용자 후기 확인하세요.', psychology: 'PASONA-S' },
    day2: { text: '[마비즈] 💰 지금 다운셀 신청 시 1개월 무료 추가!', psychology: 'PASONA-O' },
    day3: { text: '[마비즈] 다운셀 무료 추가 혜택은 오늘까지만 유효합니다!', psychology: 'PASONA-A' },
  },
  launch: {
    day0: { text: '[마비즈] 런칭 감사합니다! 5가지 상품 중 어떤 걸 원하시나요?', psychology: 'PASONA-P' },
    day1: { text: '[마비즈] 각 상품별 고객 만족도 공개! 가장 인기 있는 건?', psychology: 'PASONA-S' },
    day2: { text: '[마비즈] 🎁 런칭 한정 번들 세트. 개별 구매보다 30% 저렴!', psychology: 'PASONA-O' },
    day3: { text: '[마비즈] 런칭 특가는 이 주말이 마지막입니다!', psychology: 'PASONA-A' },
  },
  hybrid: {
    day0: { text: '[마비즈] 신청해주셨어요! 다음 단계를 확인해보세요.', psychology: 'PASONA-P' },
    day1: { text: '[마비즈] 혹시 질문이 있으신가요? 이 문제 대부분 이렇게 해결돼요!', psychology: 'PASONA-S' },
    day2: { text: '[마비즈] 💝 신청자 한정 특별 혜택 확인하세요!', psychology: 'PASONA-O' },
    day3: { text: '[마비즈] 마감 임박! 지금 신청하시면 추가 보너스를 드립니다!', psychology: 'PASONA-A' },
  },
};

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

  // Step 1-5: Russell Brunson 형식 선택
  const [pageFormat, setPageFormat]     = useState<PageFormat>('hybrid');
  const [expectedMetrics, setExpectedMetrics] = useState<{ current: number; target: number; lift: number }>({ current: 22, target: 58, lift: 164 });
  const [showExpectationModal, setShowExpectationModal] = useState(false);
  const [ctaType, setCtaType]           = useState<string>('default');
  const [smsDayRange, setSmsDayRange]   = useState<'0-3' | null>(null);

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

  // 블록 에디터 상태
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [showBlockEditor, setShowBlockEditor] = useState(false);
  const [selectedFeatures, setSelectedFeatures] = useState({
    video: false,
    timer: false,
    testimonial: false,
    faq: false,
  });

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
    const ctrl = new AbortController();
    fetch("/api/groups", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setGroups(d.groups ?? []); })
      .catch(err => { if (err instanceof Error && err.name === 'AbortError') return; });
    return () => ctrl.abort();
  }, []);

  // Step 1: 형식 변경 시 기대값 자동 계산
  useEffect(() => {
    const metric = EXPECTED_CONVERSION_BY_FORMAT[pageFormat];
    setExpectedMetrics({
      current: metric.baseline,
      target: metric.optimized,
      lift: metric.lift,
    });
  }, [pageFormat]);

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
  }, [editorMode, html, images, formFields, additionalFields, paymentEnabled, productName, productPrice, paymentType, buttonTitle, headerScript, commentEnabled, commentCount, commentDateFrom, commentDateTo, footer]);

  // state 변경 시 즉시 재계산 — srcDoc prop 변경으로 브라우저가 iframe 재렌더링
  const previewHtml = useMemo(() => buildPreviewHtml(), [buildPreviewHtml]);

  // ──────────────────────────────────────────────
  // 이미지 업로드 / 정렬 / 삭제
  // ──────────────────────────────────────────────
  const ensurePage = async (): Promise<string | null> => {
    if (savedPageId) return savedPageId;
    // 제목이 없으면 임시 제목/슬러그 자동 생성 (나중에 수정 가능)
    const autoTitle = title.trim() || `랜딩페이지 ${new Date().toLocaleDateString("ko-KR")}`;
    const autoSlug  = slug.trim() || `page-${Date.now()}`;
    if (!title.trim()) setTitle(autoTitle);
    if (!slug.trim())  setSlug(autoSlug);
    const s = autoSlug;
    const res  = await fetch("/api/landing-pages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: autoTitle, slug: s, htmlContent: "", editorMode: "image", groupId: selectedGroupId && selectedGroupId.trim() ? selectedGroupId : null }),
    });
    const data = await res.json();
    if (!data.ok) { setError(data.message ?? "페이지 생성 실패"); return null; }
    setSavedPageId(data.page.id);
    return data.page.id;
  };

  const uploadFiles = async (files: File[]) => {
    setError("");
    let pageId: string | null = null;
    try { pageId = await ensurePage(); } catch (e) { setError(`페이지 생성 오류: ${e instanceof Error ? e.message : String(e)}`); return; }
    if (!pageId) return;
    setUploading(true);
    let uploaded = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isImage = file.type.startsWith("image/") || /\.(jpe?g|png|gif|webp|bmp)$/i.test(file.name);
      if (!isImage) continue;
      if (file.size > MAX_IMAGE_UPLOAD_BYTES) { setError(`${file.name}: 100MB 초과`); continue; }

      try {
        const uploadFile = await prepareImageForUpload(file);
        // 편집기와 동일한 검증된 단일 POST 경로 사용 (취약한 resumable upload-url/finalize 대신)
        // 서버가 GIF는 압축 유지, JPG/PNG/WebP는 WebP 변환 후 Drive 백업까지 처리
        const formData = new FormData();
        formData.append("file", uploadFile);
        formData.append("landingPageId", pageId);
        formData.append("sortOrder", String(images.length + uploaded));

        const res = await fetch("/api/landing-pages/images", { method: "POST", body: formData });
        const data = res.ok ? await res.json() : await res.json().catch(() => null);
        if (data?.ok && data.image) {
          setImages((prev) => [...prev, data.image]);
          uploaded++;
        } else {
          setError(data?.message || `${file.name}: 업로드 실패`);
        }
      } catch (e) {
        setError(`${file.name}: ${e instanceof Error ? e.message : String(e)}`);
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

    // AbortController로 10초 타임아웃 설정 (P1-2: Timeout 에러 핸들링)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const common = {
        title, slug, groupId: selectedGroupId && selectedGroupId.trim() ? selectedGroupId : null,
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
        // Step 1-5: Russell Brunson 형식, CTA, SMS 자동화 추가
        pageFormat,
        ctaType,
        ...(smsDayRange ? { smsDayRange } : {}),
        ...(paymentEnabled ? {
          paymentEnabled: true, paymentType, productName,
          productPrice: parseInt(productPrice) || 0,
          ...(paymentType === "subscription" ? { cycleDay: parseInt(cycleDay), expireDate } : {}),
        } : {}),
        // Phase C: 블록 에디터 데이터 저장
        ...(blocks.length > 0 ? {
          blocksConfig: JSON.stringify({
            blocks: blocks,
            selectedFeatures: selectedFeatures,
          } as BlocksConfig),
        } : {}),
      };

      // Phase C: 블록 에디터 모드 확인
      let htmlToSave = html;
      let editorModeToSave = editorMode;

      if (blocks.length > 0) {
        // 블록으로부터 HTML 생성
        htmlToSave = buildBlocksHtml();
        editorModeToSave = "html"; // 블록도 최종적으로 HTML로 저장
      } else if (editorMode === "image") {
        const imgTags = images.map((img) => {
          const src = img.mimeType === "image/gif"
            ? `/api/public/landing-image?id=${img.driveFileId}`
            : (img.fullUrl ?? `https://drive.google.com/thumbnail?id=${img.driveFileId}&sz=w1920`);
          const ar  = img.width && img.height ? `aspect-ratio:${img.width}/${img.height};` : "";
          return `<img src="${src}" alt="" style="width:100%;display:block;${ar}" loading="lazy">`;
        }).join("\n");
        htmlToSave = `<div style="line-height:0;">\n${imgTags}\n</div>`;
      }

      if (blocks.length > 0 || editorMode === "image") {
        const pageId = savedPageId || (await ensurePage());
        if (!pageId) { setSaving(false); return; }
        const res  = await fetch(`/api/landing-pages/${pageId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...common, htmlContent: htmlToSave, editorMode: editorModeToSave }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (data.ok) router.push(`/landing-pages/${pageId}`);
        else { setError(data.message ?? "저장 실패"); setSaving(false); }
      } else {
        const res  = await fetch("/api/landing-pages", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...common, htmlContent: htmlToSave, editorMode: "html" }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (data.ok) router.push(`/landing-pages/${data.page.id}`);
        else { setError(data.message ?? "저장 실패"); setSaving(false); }
      }
    } catch (err) {
      // 타임아웃 감지 (P1-2: Timeout 에러 핸들링)
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("저장 시간 초과 (10초). 네트워크 연결을 확인하고 다시 시도해주세요.");
      } else if (err instanceof Error) {
        setError(`저장 실패: ${err.message}`);
      } else {
        setError("저장 실패: 알 수 없는 오류");
      }
      setSaving(false);
    } finally {
      clearTimeout(timeoutId);
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

  // URL을 안전하게 검증하는 헬퍼 함수 (XSS 공격 방지)
  const isValidImageUrl = (url: string): boolean => {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      // http, https, data만 허용 (javascript: 프로토콜 차단)
      return ['http:', 'https:', 'data:'].includes(parsed.protocol);
    } catch {
      // URL 파싱 실패 = 유효하지 않은 URL
      return false;
    }
  };

  // 블록 기반 페이지 HTML 생성
  const buildBlocksHtml = useCallback((): string => {
    if (blocks.length === 0) return "";

    let html = "";
    blocks.forEach((block: any) => {
      switch (block.type) {
        case "heading": {
          const headingAlign = block.data.align || "center";
          const sizeMap: Record<string, string> = { small: "16px", medium: "24px", large: "32px", xl: "48px" };
          const headingSize = sizeMap[block.data.fontSize || "large"] || "32px";
          html += `<div style="text-align:${headingAlign};margin:24px 0;padding:0 20px">
            <h1 style="font-size:${headingSize};font-weight:bold;color:#1a1a1a;margin:0">${block.data.text}</h1>
          </div>`;
          break;
        }

        case "body": {
          const bodyBlock = block as any;
          html += `<div style="margin:16px 0;padding:0 20px">
            <p style="font-size:16px;color:#555;line-height:1.6;margin:0">${bodyBlock.data.text.replace(/\n/g, "<br>")}</p>
          </div>`;
          break;
        }

        case "image": {
          const imgBlock = block as any;
          const imgUrl = imgBlock.data.url;
          // URL 검증: javascript: 프로토콜 차단
          if (!isValidImageUrl(imgUrl)) {
            console.warn(`Invalid image URL: ${imgUrl}`);
            break;  // 유효하지 않은 URL은 렌더링 스킵
          }
          const ar =
            imgBlock.data.aspectRatio && imgBlock.data.width && imgBlock.data.height
              ? `aspect-ratio:${imgBlock.data.aspectRatio};`
              : "";
          html += `<div style="margin:20px 0;line-height:0">
            <img src="${encodeURI(imgUrl)}" alt="${imgBlock.data.alt}" style="width:100%;display:block;${ar}" loading="lazy">
          </div>`;
          break;
        }

        case "cta": {
          const ctaBlock = block as any;
          const colors: Record<string, string> = {
            blue: "#1E2D4E",
            red: "#dc2626",
            green: "#16a34a",
            yellow: "#eab308",
            dark: "#000",
          };
          const bg = colors[ctaBlock.data.color] || "#1E2D4E";
          const sizeMap: Record<string, string> = { small: "12px 24px", medium: "15px 32px", large: "18px 40px" };
          const size = sizeMap[ctaBlock.data.size || "medium"] || "15px 32px";
          html += `<div style="text-align:center;margin:24px 0;padding:0 20px">
            <button style="background:${bg};color:#fff;border:none;border-radius:8px;padding:${size};font-size:16px;font-weight:bold;cursor:pointer">${ctaBlock.data.text}</button>
          </div>`;
          break;
        }

        case "divider": {
          html += `<div style="margin:32px 0;border-top:1px solid #e5e7eb"></div>`;
          break;
        }

        case "footer": {
          const footerBlock = block as any;
          html += `<footer style="text-align:${footerBlock.data.align || "center"};margin:32px 0;padding:20px;color:#999;font-size:12px">${footerBlock.data.text.replace(/\n/g, "<br>")}</footer>`;
          break;
        }

        case "video": {
          const videoBlock = block as any;
          const videoUrl = videoBlock.data.url;
          // URL 검증: javascript: 프로토콜 차단
          if (videoUrl && isValidImageUrl(videoUrl)) {
            html += `<div style="margin:24px 0;padding:0 20px">
              <iframe width="100%" height="400" src="${encodeURI(videoUrl)}" frameborder="0" ${videoBlock.data.autoplay ? "autoplay" : ""} ${videoBlock.data.loop ? "loop" : ""} allowfullscreen></iframe>
            </div>`;
          } else if (videoUrl) {
            console.warn(`Invalid video URL: ${videoUrl}`);
          }
          break;
        }

        case "timer": {
          const timerBlock = block as any;
          if (timerBlock.data.enabled) {
            html += `<div style="text-align:center;margin:24px 0;padding:20px;background:#fff3cd;border-radius:8px">
              <p style="margin:0 0 10px;color:#856404">${timerBlock.data.title || "마감까지"}</p>
              <div id="timer-${timerBlock.id}" style="font-size:24px;font-weight:bold;color:#dc3545">계산 중...</div>
              <script>
                const deadline = new Date('${timerBlock.data.deadline}').getTime();
                setInterval(() => {
                  const now = new Date().getTime();
                  const diff = deadline - now;
                  if (diff > 0) {
                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
                    const mins = Math.floor((diff / 1000 / 60) % 60);
                    const secs = Math.floor((diff / 1000) % 60);
                    document.getElementById('timer-${timerBlock.id}').textContent = days + '일 ' + hours + '시간 ' + mins + '분 ' + secs + '초';
                  }
                }, 1000);
              </script>
            </div>`;
          }
          break;
        }

        case "testimonial": {
          const testimonialBlock = block as any;
          html += `<div style="margin:24px 0;padding:0 20px">
            <h3 style="font-size:20px;font-weight:bold;margin:0 0 16px">💬 고객 후기</h3>
            <div style="display:grid;gap:12px">
              ${testimonialBlock.data.items
                .map(
                  (item: any) =>
                    `<div style="padding:12px;border:1px solid #e5e7eb;border-radius:8px">
                  <p style="margin:0 0 8px;font-size:14px;color:#555">"${item.text}"</p>
                  <p style="margin:0;font-size:12px;font-weight:bold;color:#333">- ${item.author}${item.role ? " (" + item.role + ")" : ""}</p>
                </div>`
                )
                .join("")}
            </div>
          </div>`;
          break;
        }

        case "faq": {
          const faqBlock = block as any;
          html += `<div style="margin:24px 0;padding:0 20px">
            <h3 style="font-size:20px;font-weight:bold;margin:0 0 16px">❓ 자주 묻는 질문</h3>
            <div style="display:grid;gap:8px">
              ${faqBlock.data.items
                .map(
                  (item: any) =>
                    `<details style="padding:12px;border:1px solid #e5e7eb;border-radius:8px">
                  <summary style="font-weight:bold;cursor:pointer">Q. ${item.question}</summary>
                  <p style="margin:8px 0 0;color:#555">A. ${item.answer}</p>
                </details>`
                )
                .join("")}
            </div>
          </div>`;
          break;
        }
      }
    });

    return html;
  }, [blocks]);

  // 블록 에디터 모달이 열리면 기존 HTML 파싱 → 블록으로 변환 (추후)
  const handleOpenBlockEditor = () => {
    setShowBlockEditor(true);
  };

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

        {/* 블록 에디터 모달 */}
        {showBlockEditor && (
          <div className="fixed inset-0 bg-black/50 z-50 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
              <h2 className="font-bold text-gray-900">블록 에디터</h2>
              <button
                onClick={() => setShowBlockEditor(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <BlockEditor
                blocks={blocks}
                onBlocksChange={setBlocks}
                selectedFeatures={selectedFeatures}
                onFeaturesChange={setSelectedFeatures}
              />
            </div>
          </div>
        )}

        {/* Step 1: 기대효과 팝업 모달 */}
        {showExpectationModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md shadow-2xl">
              <h3 className="text-lg font-bold mb-4 text-gray-900">이 형식 선택 시 기대 효과</h3>
              <div className="space-y-4 mb-6">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-600 font-medium mb-1">현재 기대 전환율</p>
                  <p className="text-2xl font-bold text-gray-900">{expectedMetrics.current}%</p>
                </div>
                <div className="flex items-center justify-center">
                  <div className="text-2xl text-yellow-500">⬇️</div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-green-600 font-medium mb-1">심리학 최적화 후</p>
                  <p className="text-2xl font-bold text-gray-900">{expectedMetrics.target}%</p>
                  <p className="text-sm text-green-600 font-semibold mt-1">+{expectedMetrics.lift}% 증가</p>
                </div>
              </div>
              <button
                onClick={() => setShowExpectationModal(false)}
                className="w-full bg-yellow-400 text-yellow-900 font-bold py-2.5 rounded-lg hover:bg-yellow-500 transition-colors"
              >
                확인 후 계속하기
              </button>
            </div>
          </div>
        )}

        {/* 스크롤 본문 */}
        <div className="flex-1 overflow-y-auto">

          {/* 퀵스타트 카드 */}
          <div className="px-4 py-4 bg-yellow-50 border-b border-yellow-200">
            <p className="text-sm font-bold text-yellow-900 mb-3">⚡ 빠르게 시작하기</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  setPageFormat('squeeze');
                  setTitle('크루즈 멤버십 신청');
                  setCtaType('urgency');
                }}
                className="p-3 bg-white rounded-xl border-2 border-yellow-300 hover:border-yellow-500 hover:shadow-md transition text-left"
              >
                <div className="text-2xl mb-1">🚢</div>
                <div className="text-xs font-bold text-gray-800">크루즈 상품 신청</div>
                <div className="text-xs text-gray-500 mt-0.5">신청 폼 바로 생성</div>
              </button>
              <button
                onClick={() => {
                  setPageFormat('funnel');
                  setTitle('무료 상담 신청');
                  setCtaType('default');
                }}
                className="p-3 bg-white rounded-xl border-2 border-blue-200 hover:border-blue-400 hover:shadow-md transition text-left"
              >
                <div className="text-2xl mb-1">📞</div>
                <div className="text-xs font-bold text-gray-800">무료 상담 신청</div>
                <div className="text-xs text-gray-500 mt-0.5">상담 연결 페이지</div>
              </button>
              <button
                onClick={() => {
                  setPageFormat('webinar');
                  setTitle('설명회 참가 신청');
                  setCtaType('urgency');
                }}
                className="p-3 bg-white rounded-xl border-2 border-green-200 hover:border-green-400 hover:shadow-md transition text-left"
              >
                <div className="text-2xl mb-1">🎓</div>
                <div className="text-xs font-bold text-gray-800">설명회 참가</div>
                <div className="text-xs text-gray-500 mt-0.5">설명회 신청 페이지</div>
              </button>
            </div>
          </div>

          {/* Step 1: 형식 선택 카드 */}
          <div className="px-4 py-4 bg-white border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800 mb-3">어떤 페이지를 만드실 건가요?</p>
            <div className="grid grid-cols-4 gap-2">
              {(['squeeze', 'vsl', 'webinar', 'funnel', 'tripwire', 'downsell', 'launch', 'hybrid'] as PageFormat[]).map(fmt => (
                <button
                  key={fmt}
                  onClick={() => setPageFormat(fmt)}
                  className={`p-3 rounded-lg border-2 text-center transition ${
                    pageFormat === fmt
                      ? 'border-yellow-400 bg-yellow-50 shadow-md'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-1">{FORMAT_EMOJI[fmt]}</div>
                  <div className="text-xs font-bold text-gray-700">{FORMAT_LABELS[fmt]}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: 이미지 필드 + 위험신호 */}
          <div className="px-4 py-3 bg-white border-b border-gray-100">
            {(() => {
              const requiredFields = IMAGE_FIELDS_BY_FORMAT[pageFormat].filter(f => f.required);
              const completionRate = requiredFields.length > 0
                ? Math.round((Math.min(images.length, requiredFields.length) / requiredFields.length) * 100)
                : 100;
              return (
                <>
                  {completionRate < 100 && (
                    <div className="mb-3 p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
                      <div className="flex justify-between mb-2">
                        <p className="text-sm font-bold text-blue-700">필수 이미지 필드</p>
                        <span className="text-sm font-bold text-blue-600">{completionRate}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-blue-500 transition-all"
                          style={{ width: `${completionRate}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {pageFormat !== 'hybrid' && images.length < MIN_IMAGES_BY_FORMAT[pageFormat] && (
                    <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                      <p className="text-sm font-bold text-yellow-700">제안해요</p>
                      <p className="text-sm text-yellow-600 mt-1">
                        {FORMAT_LABELS[pageFormat]} 형식은 {MIN_IMAGES_BY_FORMAT[pageFormat]}장 이상을 권장합니다.
                      </p>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Step 2-C: L2/L10 성과 지표 (Step 2 완료 후 표시) */}
          {(() => {
            const requiredFields = IMAGE_FIELDS_BY_FORMAT[pageFormat].filter(f => f.required);
            const completionRate = requiredFields.length > 0
              ? Math.round((Math.min(images.length, requiredFields.length) / requiredFields.length) * 100)
              : 100;
            return (
              <div className="px-4 py-3 bg-white border-b border-gray-100">
                <LandingPageMetrics format={pageFormat} title={title} completionRate={completionRate} />
              </div>
            );
          })()}

          {/* Step 2-B: 그룹 선택 (퍼널 설정) */}
          <div className="px-4 py-4 bg-white border-b border-gray-100">
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
              <h3 className="text-sm font-bold mb-3 text-blue-900">📋 신청자를 어느 그룹으로 넣을까요?</h3>

              <label className="block text-sm font-medium mb-3 text-gray-700">
                신청한 고객을 자동으로 넣어줄 그룹을 선택해주세요
              </label>

              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:border-blue-400 bg-white"
              >
                <option value="">-- 그룹을 선택하세요 --</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name} {g.funnelId ? "📱 자동 발송" : "⚠️ 미연결"}
                  </option>
                ))}
              </select>

              {/* 선택 후 배너 */}
              {selectedGroupId && (
                <div className="mt-3 p-3 bg-green-100 border-l-4 border-green-500 rounded">
                  <p className="text-sm text-green-700 font-bold">
                    ✓ {groups.find(g => g.id === selectedGroupId)?.name || "그룹"}에 자동 메시지가 시작됩니다
                  </p>
                </div>
              )}

              {/* 그룹 미선택 경고 */}
              {selectedGroupId === "" && groups.length > 0 && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm text-yellow-800">
                    <strong>⚠️ 그룹을 선택하지 않으면 자동 문자가 발송되지 않습니다.</strong>
                  </p>
                </div>
              )}

              {/* 그룹이 없을 때 안내 */}
              {selectedGroupId === "" && groups.length === 0 && (
                <div className="mt-3 p-3 bg-yellow-100 border-l-4 border-yellow-500 rounded">
                  <p className="text-sm text-yellow-700">
                    ⚠️ 사용 가능한 그룹이 없습니다. 먼저 그룹을 생성해주세요.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Step 3: CTA 선택지 */}
          <div className="px-4 py-4 bg-white border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800 mb-3">신청 버튼 문구를 골라주세요</p>
            <div className="space-y-2">
              {Object.entries(CTA_PSYCHOLOGY_MAP).map(([key, value]) => (
                <label
                  key={key}
                  className="flex items-center p-3 border-2 rounded-lg hover:bg-gray-50 cursor-pointer transition"
                  style={{ borderColor: ctaType === key ? '#f59e0b' : '#e5e7eb' }}
                >
                  <input
                    type="radio"
                    name="cta"
                    value={key}
                    checked={ctaType === key}
                    onChange={(e) => setCtaType(e.target.value)}
                    className="mr-3 w-4 h-4 accent-yellow-400"
                  />
                  <span className="text-lg mr-2">{value.emoji}</span>
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-gray-700">{value.text}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 에디터 모드 + 그룹 + 블록 에디터 버튼 */}
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
              <button
                onClick={handleOpenBlockEditor}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors text-gray-500 hover:text-purple-700`}
                title="블록 기반 에디터 (베타)"
              >
                🧩 블록
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
              <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">📨 등록 즉시 Day 0 메시지 발송</span>
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
                    <p className="text-sm text-gray-600 mt-1">JPG · PNG · WebP · GIF / 최대 100MB</p>
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
                  placeholder={CTA_PSYCHOLOGY_MAP[ctaType]?.text || "신청하기 (기본값)"}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
              </div>

              {/* 자동 문자 발송 설정 */}
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-bold text-sm mb-3 text-blue-700">📨 자동 문자 발송</h4>
                <label className="flex items-center mb-3">
                  <input
                    type="checkbox"
                    checked={smsDayRange === '0-3'}
                    onChange={(e) => setSmsDayRange(e.target.checked ? '0-3' : null)}
                    className="mr-2 w-4 h-4 accent-blue-500"
                  />
                  <span className="text-sm text-blue-700">신청 후 4일간 자동 발송 켜기</span>
                </label>

                {smsDayRange === '0-3' && SMS_TEMPLATES_BY_FORMAT[pageFormat] && (
                  <div className="space-y-2 mt-3 max-h-48 overflow-y-auto">
                    {Object.entries(SMS_TEMPLATES_BY_FORMAT[pageFormat]).map(([dayKey, config]) => (
                      <div key={dayKey} className="p-2 bg-white rounded border border-blue-100">
                        <span className="font-bold text-blue-600 text-xs">
                          {dayKey === 'day0' ? '신청 당일' : dayKey === 'day1' ? '1일 후' : dayKey === 'day2' ? '2일 후' : '3일 후'}:
                        </span>
                        <p className="text-sm text-gray-600 mt-1 leading-tight">{config.text.substring(0, 90)}...</p>
                      </div>
                    ))}
                  </div>
                )}
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
                    <img src={`/api/landing-pages/images/proxy?id=${exposureImage?.match(/id=([^&]+)/)?.[1] ?? ""}`}
                      alt="OG 이미지" className="w-20 h-14 object-cover rounded-lg border border-gray-200" loading="lazy"
                      onError={(e) => { const el = (e.target as HTMLImageElement); el.src = '/static/image-placeholder.svg'; console.error('OG image load failed'); }} />
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
                  loading="lazy"
                  onError={(e) => { const el = (e.target as HTMLImageElement); el.style.opacity = '0.3'; el.style.backgroundColor = '#f3f4f6'; }}
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
