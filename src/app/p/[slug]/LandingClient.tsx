"use client";

import { useState, useRef, useEffect } from "react";
import DOMPurify from "dompurify";
import { logger } from "@/lib/logger";
import { CountdownTimer } from "@/components/landing/CountdownTimer";
import { StockGaugeWidget } from "@/components/landing/StockGaugeWidget";
import { L6LossAnchorSection } from "@/components/landing/L6LossAnchorSection";
import LiveSocialProof from "@/components/landing/LiveSocialProof";
import { isB2BPage, PAGE_TYPES, B2B_CTA_TEXT, B2B_COMPLETION_MESSAGE } from '@/lib/page-types';

// P0-8: URL 프로토콜 검증 헬퍼
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

interface PaymentConfig {
  type:         "onetime" | "subscription";
  productName:  string;
  productPrice: number;
  cycleDay:     number;
  expireDate:   string;
}

interface L6Config {
  enabled: boolean;
  priceAnchors?: Array<{day: number; price: number; label: string}>;
  stockConfig?: {
    currentStock: number;
    totalStock: number;
    weeklyBurnRate: number;
    weeksToZero: number;
    countdownTarget: string;
  };
  hoursUntilIncrease?: number;
}

interface Props {
  pageId:            string;
  slug:              string;
  htmlContent:       string;
  commentEnabled:    boolean;
  payment?:          PaymentConfig;
  buttonTitle?:      string;
  completionPageUrl?: string;
  footer?:           string;
  l6Config?:         L6Config;
}

type Comment = {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
  authorRole?: string;       // 'visitor' | 'operator'(운영자 답변)
  likeCount?: number;
  parentId?: string | null;
  replies?: Comment[];        // 최상위 질문에만 존재
};

/**
 * 공개 랜딩페이지 클라이언트 컴포넌트
 * - HTML 콘텐츠 렌더링
 * - 폼 submit 인터셉트 → register API 호출
 * - 완료 화면 표시
 */
export function LandingClient({
  pageId, slug, htmlContent, commentEnabled, payment, buttonTitle, completionPageUrl, footer, l6Config
}: Props) {
  const [done,        setDone]        = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [phoneError,  setPhoneError]  = useState("");
  const [fieldError,  setFieldError]  = useState("");
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [registeredName, setRegisteredName] = useState("");
  const [registeredPhone, setRegisteredPhone] = useState("");

  // 보장형 결제 구역 — 저장된 HTML에 신청폼이 없을 때(HTML/커스텀형 랜딩) 결제 동선 보장
  const [hasForm, setHasForm] = useState(true); // 기본 true(이미지형 깜빡임 방지) → 폼 없으면 useEffect에서 false
  const [payName, setPayName] = useState("");
  const [payPhone, setPayPhone] = useState("");

  // T38: Sticky CTA
  const [showStickyCta, setShowStickyCta] = useState(false);
  const formSectionRef = useRef<HTMLDivElement>(null);

  // 댓글
  const [comments,     setComments]    = useState<Comment[]>([]);
  const [commentForm,  setCommentForm] = useState({ authorName: "", content: "" });
  const [posting,      setPosting]     = useState(false);
  const [commentMsg,   setCommentMsg]  = useState("");
  // 티키타카 답글 — 한 번에 한 질문에만 답글창 열기
  const [replyTarget,  setReplyTarget] = useState<string | null>(null);
  const [replyForm,    setReplyForm]   = useState({ authorName: "", content: "" });
  const [replyPosting, setReplyPosting] = useState(false);
  const containerRef  = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false);
  const loadTimeRef = useRef<number>(Date.now());

  // P1-23: 스테일 클로저 방지용 Ref — useEffect 의존성 배열에서 제외
  const completionPageUrlRef = useRef(completionPageUrl);
  const l6ConfigRef = useRef(l6Config);
  const paymentRef = useRef(payment);
  useEffect(() => { completionPageUrlRef.current = completionPageUrl; }, [completionPageUrl]);
  useEffect(() => { l6ConfigRef.current = l6Config; }, [l6Config]);
  useEffect(() => { paymentRef.current = payment; }, [payment]);

  // 에러 토스트 4초 자동 dismiss
  useEffect(() => {
    if (phoneError || fieldError) {
      const timer = setTimeout(() => { setPhoneError(''); setFieldError(''); }, 4000);
      return () => clearTimeout(timer);
    }
  }, [phoneError, fieldError]);

  // 재방문 체크
  useEffect(() => {
    try {
      if (localStorage.getItem(`registered_${slug}`)) {
        setAlreadyRegistered(true);
      }
    } catch {}
  }, [slug]);

  // [P0-7] viewCount 업데이트 — 클라이언트에서 fire-and-forget으로 호출.
  // 서버 컴포넌트의 .catch(() => {}) 패턴을 대체합니다.
  // Vercel에서 응답 후 비동기 작업이 중단되는 문제를 우회하며,
  // IP 해시 dedup + 트랜잭션은 API 내부에서 처리됩니다.
  useEffect(() => {
    fetch(`/api/landing-pages/${pageId}/view`, { method: "POST" }).catch(() => {});
  }, [pageId]);

  // T38: IntersectionObserver — 폼 섹션이 뷰포트 밖으로 나가면 Sticky CTA 표시
  useEffect(() => {
    const target = formSectionRef.current ?? document.getElementById("landing-form");
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => { setShowStickyCta(!entry.isIntersecting); },
      { threshold: 0, rootMargin: "0px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  // T38: scrollToForm 헬퍼
  const scrollToForm = () => {
    const target = formSectionRef.current ?? document.getElementById("landing-form") ?? containerRef.current?.querySelector("form");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // 결제 플로우 시작 — PayApp 결제요청(/api/public/payapp/request) 호출 → 결제창으로 이동
  // 완료화면 버튼과 신청 직후 자동 결제 양쪽에서 공용으로 사용
  // paymentRef.current 사용 — 폼 submit 핸들러(스테일 클로저)에서 호출돼도 최신 결제설정 보장
  const startPayment = async (custName: string, custPhone: string) => {
    const pay = paymentRef.current;
    if (!pay) return;
    setPaymentLoading(true);
    try {
      const res = await fetch("/api/public/payapp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: pay.type,
          goodname: pay.productName,
          price: pay.productPrice,
          customerName: custName,
          customerPhone: custPhone,
          landingPageId: pageId,
          ...(pay.type === "subscription" ? {
            cycleDay: pay.cycleDay,
            expireDate: pay.expireDate,
          } : {}),
        }),
      });
      const data = await res.json();
      if (data.ok && data.payUrl) {
        if (isSafeUrl(data.payUrl)) {
          window.location.href = data.payUrl;
        } else {
          logger.error("[LandingClient] Payment URL validation failed");
          setFieldError("결제 URL이 유효하지 않습니다.");
        }
      } else {
        setFieldError(data.message ?? "결제 요청에 실패했습니다.");
      }
    } catch {
      setFieldError("네트워크 오류가 발생했습니다.");
    } finally {
      setPaymentLoading(false);
    }
  };
  // startPayment 최신본을 폼 submit 핸들러(고정 클로저)에서 호출하기 위한 Ref
  const startPaymentRef = useRef(startPayment);
  startPaymentRef.current = startPayment;

  // 보장형 결제 구역의 "결제하기" — 리드 캡처(신청 기록) 후 결제창으로.
  // 신청 기록 실패(중복 등)는 무시하고 결제는 진행(이 페이지의 목적은 결제).
  const submitGuaranteedPayment = async () => {
    const rawPhone = payPhone.replace(/[^0-9]/g, '');
    if (!payName.trim()) { setFieldError('이름을 입력해 주세요.'); return; }
    if (!rawPhone || !/^01[016789]\d{7,8}$/.test(rawPhone)) {
      setPhoneError('올바른 휴대폰 번호를 입력해 주세요. (예: 010-1234-5678)');
      return;
    }
    setFieldError(''); setPhoneError('');
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const utm = new URLSearchParams(window.location.search);
      const res = await fetch(`/api/landing-pages/${pageId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: payName, phone: payPhone, loadedAt: loadTimeRef.current,
          ...(utm.get('utm_source')   ? { utmSource:   utm.get('utm_source') }   : {}),
          ...(utm.get('utm_medium')   ? { utmMedium:   utm.get('utm_medium') }   : {}),
          ...(utm.get('utm_campaign') ? { utmCampaign: utm.get('utm_campaign') } : {}),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setRegisteredName(payName);
        setRegisteredPhone(payPhone);
        try { localStorage.setItem(`registered_${slug}`, '1'); } catch {}
        if (l6ConfigRef.current?.enabled && data.registrationId) {
          fetch(`/api/landing-pages/${pageId}/sms-trigger`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ registrationId: data.registrationId, messageType: 'l6_day0' }),
          }).catch(() => {});
        }
      }
    } catch {
      // 신청 기록 실패는 무시 — 결제 우선
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
    await startPayment(payName, payPhone);
  };

  // 댓글 로드
  useEffect(() => {
    if (!commentEnabled) return;
    fetch(`/api/public/landing/${slug}/comments`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setComments(d.comments ?? []); })
      .catch(() => {});
  }, [slug, commentEnabled]);

  const submitComment = async (opts: { parentId?: string; authorName: string; content: string }) => {
    const res = await fetch(`/api/public/landing/${slug}/comments`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        authorName: opts.authorName,
        content:    opts.content,
        ...(opts.parentId ? { parentId: opts.parentId } : {}),
      }),
    });
    return res.json();
  };

  // 새 질문(최상위) 등록
  const postQuestion = async () => {
    if (!commentForm.authorName.trim() || !commentForm.content.trim()) return;
    setPosting(true);
    setCommentMsg("");
    try {
      const data = await submitComment({ authorName: commentForm.authorName, content: commentForm.content });
      if (data.ok) {
        setComments((prev) => [{ ...data.comment, replies: [] }, ...prev]);
        setCommentForm({ authorName: "", content: "" });
        setCommentMsg("질문이 등록됐어요! 운영자와 다른 분들이 답해드려요.");
      } else {
        setCommentMsg(data.message ?? "등록 실패");
      }
    } catch {
      setCommentMsg("네트워크 오류가 발생했습니다.");
    }
    setPosting(false);
  };

  // 질문에 답글 등록(티키타카)
  const postReply = async (questionId: string) => {
    if (!replyForm.authorName.trim() || !replyForm.content.trim()) return;
    setReplyPosting(true);
    try {
      const data = await submitComment({ parentId: questionId, authorName: replyForm.authorName, content: replyForm.content });
      if (data.ok) {
        setComments((prev) => prev.map((q) =>
          q.id === questionId ? { ...q, replies: [...(q.replies ?? []), data.comment] } : q
        ));
        setReplyForm({ authorName: "", content: "" });
        setReplyTarget(null);
      }
    } catch {
      // 무시 — 사용자는 재시도 가능
    }
    setReplyPosting(false);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // buttonTitle 반영 — 폼 내 submit 버튼 텍스트 교체
    // 우선순위: 명시적 buttonTitle > 결제 활성 시 "결제하기" > B2B 기본문구
    const submitBtns = container.querySelectorAll<HTMLButtonElement>('form button[type="submit"], form button:not([type])');
    if (buttonTitle) {
      submitBtns.forEach((btn) => { btn.textContent = buttonTitle; });
    } else if (paymentRef.current) {
      // 결제 설정 ON → 버튼을 "결제하기"(정기결제는 "정기결제 시작하기")로 표시
      // 신청 직후 PayApp 결제창으로 자동 연결됨
      const payLabel = paymentRef.current.type === "subscription" ? "정기결제 시작하기" : "결제하기";
      submitBtns.forEach((btn) => { btn.textContent = payLabel; });
    } else if (isB2BPage(slug)) {
      // B2B 페이지의 기본 버튼 문구 (Loss Aversion #5)
      submitBtns.forEach((btn) => { btn.textContent = B2B_CTA_TEXT; });
    }

    const handleSubmit = async (e: Event) => {
      e.preventDefault();
      if (submittingRef.current) return;

      const form  = e.target as HTMLFormElement;

      // [WO-15] Honeypot 체크
      const hpVal = (form.querySelector('input[name="website"]') as HTMLInputElement)?.value ?? '';
      if (hpVal.trim()) {
        setDone(true); // 조용히 성공 처리
        return;
      }

      // [WO-15] 시간 기반 방어 (1.5초 미만 = 봇)
      // [P2-14] 현재: 클라이언트 타이밍 체크 유지 (loadTimeRef 초기값 변경 없음).
      // 향후 개선: POST body에 submittedAt: Date.now() 포함 → 서버에서
      //   if (Date.now() - submittedAt > 10 * 60 * 1000) → 400 반환.
      //   단, 봇이 submittedAt 조작 가능하므로 honeypot + IP rate limit(분당 5건)과 함께 적용 권장.
      if (Date.now() - loadTimeRef.current < 1500) {
        setDone(true);
        return;
      }

      // name 우선순위: name 어트리뷰트 → placeholder 포함 → type=text 첫번째
      const name  = (
        form.querySelector('input[name="name"]') ??
        form.querySelector('input[placeholder*="이름"]') ??
        form.querySelector('input[type="text"]')
      ) as HTMLInputElement | null;
      const phone = (
        form.querySelector('input[name="phone"]') ??
        form.querySelector('input[type="tel"]') ??
        form.querySelector('input[placeholder*="연락"], input[placeholder*="전화"]')
      ) as HTMLInputElement | null;
      const email = form.querySelector('input[type="email"]') as HTMLInputElement | null;

      // 추가 필드 수집
      const genderEl    = form.querySelector('select[name="gender"], input[name="gender"]') as HTMLInputElement | null;
      const birthDateEl = form.querySelector('input[name="birthDate"]') as HTMLInputElement | null;
      const addressEl   = form.querySelector('input[name="address"]') as HTMLInputElement | null;
      const consentEl   = form.querySelector('input[name="marketingConsent"]') as HTMLInputElement | null;

      const nameVal  = name?.value  ?? "";
      const phoneVal = phone?.value ?? "";
      const emailVal = email?.value ?? "";

      // 커스텀 질문 수집 (name="custom_xxx")
      const customFields: Record<string, string> = {};
      form.querySelectorAll<HTMLInputElement>('input[name^="custom_"]').forEach((el) => {
        if (el.value.trim()) customFields[el.name] = el.value.trim();
      });

      // metadata 조립
      const metadata: Record<string, unknown> = {};
      if (genderEl?.value)    metadata.gender = genderEl.value;
      if (birthDateEl?.value) metadata.birthDate = birthDateEl.value;
      if (addressEl?.value)   metadata.address = addressEl.value;
      if (consentEl?.checked) metadata.marketingConsent = true;
      if (Object.keys(customFields).length) metadata.customFields = customFields;
      const hasMetadata = Object.keys(metadata).length > 0;

      // [WO-15] 전화번호 형식 사전 검증 (UX — 값이 있는데 형식 오류면 에러 표시)
      const rawPhone = phoneVal.replace(/[^0-9]/g, '');
      if (rawPhone && !/^01[016789]\d{7,8}$/.test(rawPhone)) {
        setPhoneError('올바른 휴대폰 번호를 입력해 주세요. (예: 010-1234-5678)');
        return;
      }
      setPhoneError('');

      if (!nameVal.trim() || !phoneVal.trim()) {
        setFieldError('이름과 연락처를 입력해 주세요.');
        return;
      }
      setFieldError('');

      // UTM 파라미터 파싱 (window.location.search)
      const utmParams = new URLSearchParams(window.location.search);
      const utmSource   = utmParams.get('utm_source')   || undefined;
      const utmMedium   = utmParams.get('utm_medium')   || undefined;
      const utmCampaign = utmParams.get('utm_campaign') || undefined;

      submittingRef.current = true;
      setSubmitting(true);
      try {
        const res  = await fetch(`/api/landing-pages/${pageId}/register`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            name: nameVal, phone: phoneVal, email: emailVal || undefined,
            loadedAt: loadTimeRef.current,
            ...(utmSource   ? { utmSource }   : {}),
            ...(utmMedium   ? { utmMedium }   : {}),
            ...(utmCampaign ? { utmCampaign } : {}),
            ...(hasMetadata ? { metadata } : {}),
          }),
        });
        const data = await res.json();
        if (data.ok) {
          setIsDuplicate(!!data.isDuplicate);
          setRegisteredName(nameVal);
          setRegisteredPhone(phoneVal);
          setDone(true);
          try { localStorage.setItem(`registered_${slug}`, '1'); } catch {}

          // L6 Day 0 SMS 트리거 (자동 발송 백그라운드)
          // P1-24: phoneNumber/customerName을 클라이언트에서 전달하지 않음
          // 서버가 registrationId로 Contact를 조회하여 전화번호를 직접 사용
          // P1-23: l6ConfigRef.current 사용 — 스테일 클로저 방지
          if (l6ConfigRef.current?.enabled && data.registrationId) {
            try {
              fetch(`/api/landing-pages/${pageId}/sms-trigger`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  registrationId: data.registrationId,
                  messageType: "l6_day0",
                }),
              }).catch(() => {}); // 백그라운드 작업 - 에러 무시
            } catch {}
          }

          // 결제 설정이 켜져 있으면 신청 직후 바로 PayApp 결제창으로 이동
          // (버튼 라벨은 "결제하기"로 표시됨 — 신청+결제를 한 번에 진행)
          if (paymentRef.current) {
            window.scrollTo({ top: 0, behavior: "smooth" });
            await startPaymentRef.current(nameVal, phoneVal);
            // startPayment가 결제창으로 이동시키거나 실패 시 에러를 표시.
            // 결제 실패 시에도 신청은 완료된 상태이므로 완료화면(결제 버튼 재시도 가능)을 보여준다.
            return;
          }

          // P1-23: completionPageUrlRef.current 사용 — 스테일 클로저 방지
          if (completionPageUrlRef.current) {
            if (isSafeUrl(completionPageUrlRef.current)) {
              window.location.href = completionPageUrlRef.current;
            } else {
              logger.warn("[LandingClient] Unsafe completion URL blocked");
            }
            return;
          }
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          setFieldError(data.message ?? '등록에 실패했습니다. 다시 시도해 주세요.');
        }
      } catch {
        setFieldError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    };

    // 폼 submit 이벤트 인터셉트
    const forms = container.querySelectorAll("form");
    // 폼이 하나도 없으면(HTML/커스텀형) 보장형 결제 구역을 렌더하도록 신호
    setHasForm(forms.length > 0);

    // [WO-15] Honeypot input 주입 (봇 유인 — display:none 금지)
    forms.forEach((form) => {
      if (form.querySelector('input[name="website"]')) return; // 중복 방지
      const hp = document.createElement('input');
      hp.type = 'text';
      hp.name = 'website';
      hp.autocomplete = 'off';
      hp.tabIndex = -1;
      hp.setAttribute('aria-hidden', 'true');
      hp.style.cssText = 'position:absolute;left:-9999px;opacity:0;height:0;overflow:hidden;';
      form.appendChild(hp);
    });

    forms.forEach((f) => f.addEventListener("submit", handleSubmit));

    // submit-btn 클래스 버튼 클릭 인터셉트 (form 태그 없는 경우 대비)
    const btn = container.querySelector(".submit-btn, button[type='submit']");
    const handleBtnClick = (e: Event) => {
      const form = (btn as Element).closest("form");
      if (!form) {
        e.preventDefault();
        const syntheticForm = { target: container.querySelector("form") ?? container };
        handleSubmit(syntheticForm as unknown as Event);
      }
    };
    btn?.addEventListener("click", handleBtnClick);

    return () => {
      forms.forEach((f) => f.removeEventListener("submit", handleSubmit));
      btn?.removeEventListener("click", handleBtnClick);
    };
  // submitting은 submittingRef로 처리 → 의존성 제거 (중복 주입 방지)
  }, [pageId, slug]);

  if (done || alreadyRegistered) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-navy-900 to-navy-800 px-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
          <div className="text-5xl mb-4">🚢</div>
          <h1 className="text-xl font-bold text-navy-900 mb-2">
            {alreadyRegistered || isDuplicate ? "이미 신청이 접수되었습니다!" : "신청이 완료됐어요!"}
          </h1>
          <p className="text-gray-600 text-sm leading-relaxed">
            {alreadyRegistered || isDuplicate
              ? "담당자가 곧 연락드릴 예정이에요."
              : payment
                ? "결제를 진행하시면 예약이 확정됩니다."
                : isB2BPage(slug)
                  ? B2B_COMPLETION_MESSAGE
                  : "담당자가 빠르면 1시간 이내로 연락드립니다."}
          </p>

          {/* 결제 버튼 (결제 설정이 있는 경우 — 재방문자도 표시) */}
          {payment && (
            <div className="mt-4 p-4 bg-blue-50 rounded-xl">
              <p className="text-sm font-semibold text-gray-800 mb-1">{payment.productName}</p>
              <p className="text-2xl font-bold text-navy-900 mb-3">
                {payment.productPrice.toLocaleString()}원
                {payment.type === "subscription" && <span className="text-sm font-normal text-gray-500"> /월</span>}
              </p>
              <button
                onClick={() => startPayment(registeredName, registeredPhone)}
                disabled={paymentLoading}
                className="w-full bg-emerald-600 text-white min-h-[48px] flex items-center justify-center rounded-xl text-base font-bold hover:bg-emerald-500 transition-colors disabled:opacity-50"
              >
                {paymentLoading ? "결제 준비 중..." : payment.type === "subscription" ? "정기결제 시작하기" : "결제하기"}
              </button>
              <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                판매자: 마비즈스쿨 원격평생교육원 | 사업자번호: 851-67-00338 | 대표: 전혜선<br />
                통신판매업: 제 2024-대전서구-2845 호
              </p>
            </div>
          )}

          <div className="mt-4 space-y-3">
            <a
              href={`https://pf.kakao.com/${process.env.NEXT_PUBLIC_KAKAO_CHANNEL_ID || "_cruisedot"}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-yellow-400 text-gray-900 min-h-[44px] flex items-center justify-center rounded-xl text-sm font-bold hover:bg-yellow-300 transition-colors"
            >
              카카오톡 상담 시작하기
            </a>
            <a
              href={`tel:${process.env.NEXT_PUBLIC_PHONE_NUMBER || "1899-4798"}`}
              className="block w-full bg-navy-900 text-white min-h-[44px] flex items-center justify-center rounded-xl text-sm font-bold hover:bg-navy-700 transition-colors"
            >
              전화 상담 ({process.env.NEXT_PUBLIC_PHONE_NUMBER || "1899-4798"})
            </a>
          </div>
          {alreadyRegistered && (
            <button
              onClick={() => setAlreadyRegistered(false)}
              className="mt-4 text-xs text-gray-400 underline hover:text-gray-600"
            >
              다시 신청하기
            </button>
          )}
          <div className="mt-4 p-3 bg-gold-50 rounded-xl">
            <p className="text-xs text-gold-700 font-medium">
              크루즈닷 전문 상담팀이 최적의 크루즈를 안내해드립니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      {(phoneError || fieldError) && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg animate-pulse">
          {phoneError || fieldError}
        </div>
      )}
      {submitting && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl px-6 py-4 text-sm font-medium text-navy-900">
            신청 중...
          </div>
        </div>
      )}

      {/* L6 Loss Aversion 섹션 (활성화된 경우) */}
      {l6Config?.enabled && l6Config.priceAnchors && l6Config.stockConfig && (
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Price Anchor 섹션 */}
          <L6LossAnchorSection
            priceAnchors={l6Config.priceAnchors}
            hoursUntilIncrease={l6Config.hoursUntilIncrease ?? 48}
          />

          {/* Stock Gauge + Countdown 섹션 */}
          <div className="bg-white rounded-2xl p-6 md:p-8 border border-gray-200 mb-8 space-y-6">
            <StockGaugeWidget
              currentStock={l6Config.stockConfig.currentStock}
              totalStock={l6Config.stockConfig.totalStock}
              weeklyBurnRate={l6Config.stockConfig.weeklyBurnRate}
              weeksToZero={l6Config.stockConfig.weeksToZero}
            />

            <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-xl p-5 border-2 border-red-300 text-center">
              <h3 className="text-base font-bold text-gray-900 mb-4">⏰ {l6Config.hoursUntilIncrease ?? 48}시간 후 가격 인상</h3>
              <CountdownTimer
                targetDate={new Date(l6Config.stockConfig.countdownTarget)}
              />
              <p className="text-sm text-gray-700 mt-3">
                가격: <span className="font-bold text-green-600">{l6Config.priceAnchors[0].price.toLocaleString('ko-KR')}원</span> →{" "}
                <span className="font-bold text-red-600">{(l6Config.priceAnchors[1]?.price ?? l6Config.priceAnchors[0].price).toLocaleString('ko-KR')}원</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* B2B 페이지용 SPIN + Loss Aversion 섹션 (slug이 'b2b'로 시작하는 경우) */}
      {isB2BPage(slug) && (
        <div className="max-w-4xl mx-auto px-4 py-12 border-b border-gray-200">
          {/* SPIN S→P→I 섹션 */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              당신의 팀이 정말 충분히 쉬고 있나요?
            </h2>
            <p className="text-lg text-gray-700 mb-6">
              지속적인 업무 스트레스는 팀의 창의성을 낮추고,
              <span className="font-semibold"> 이직률</span>을 높입니다.
            </p>

            {/* Implication Box - Loss Aversion #1 */}
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg mb-4">
              <p className="text-sm font-bold text-red-800 mb-2">
                💭 10년 뒤 당신의 팀은
              </p>
              <p className="text-sm text-red-700">
                "그때 함께하는 시간을 가질 걸" 이라고 말할 거예요.
              </p>
              <p className="text-xs text-red-600 mt-2">
                팀 결속력이 약해진 후에 돌이키기는 어렵습니다.
              </p>
            </div>
          </div>

          {/* Loss Aversion #5, #7: 시간 + 가격 제한 */}
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-8">
            <p className="text-sm font-bold text-yellow-900 mb-2">⏰ 조조 할인 (6월 말까지)</p>
            <p className="text-base font-bold text-yellow-900">
              330만원 / 이후: 480만원
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              1주 후 신청하면 150만원 추가 비용이 발생합니다.
            </p>
          </div>

          {/* 팀빌딩의 실제 효과 (Need-Payoff) */}
          <div className="mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">팀빌딩 크루즈의 실제 효과</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2">팀 결속력</h4>
                <p className="text-xs text-blue-700 mb-2">
                  일상에서는 볼 수 없는 동료의 모습을 경험합니다.
                </p>
                <p className="text-xs font-semibold text-blue-600">
                  팀 신뢰도 +38% (참여 기업 평균)
                </p>
              </div>

              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-semibold text-green-900 mb-2">창의성 향상</h4>
                <p className="text-xs text-green-700 mb-2">
                  새로운 환경에서 아이디어가 나옵니다.
                </p>
                <p className="text-xs font-semibold text-green-600">
                  팀 프로젝트 만족도 +45%
                </p>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <h4 className="font-semibold text-purple-900 mb-2">이직률 감소</h4>
                <p className="text-xs text-purple-700 mb-2">
                  "함께하는 팀"의 경험이 충성도를 높입니다.
                </p>
                <p className="text-xs font-semibold text-purple-600">
                  연 이직률 -22% (3년 데이터)
                </p>
              </div>
            </div>
          </div>

          {/* Loss Aversion #10: 사회적 증명 */}
          <div className="bg-gray-50 border-l-4 border-gray-400 p-4 rounded-lg">
            <p className="text-sm font-bold text-gray-800 mb-1">
              📊 같은 업계 경쟁사 80%
            </p>
            <p className="text-sm text-gray-700">
              는 이미 팀빌딩 크루즈를 경험했습니다.
            </p>
            <p className="text-xs text-gray-600 mt-2">
              "우리만 못 가면, 팀원들이 다른 회사로 흘러나갑니다"
            </p>
          </div>
        </div>
      )}

      {/* T38: formSectionRef 앵커 — 폼 섹션 상단에 위치 */}
      <div ref={formSectionRef} id="landing-form" />

      <div
        ref={containerRef}
        role="main"
        aria-label="랜딩페이지 콘텐츠"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlContent, {
          // 폼(input/select/label 등)·표·미디어까지 허용 — 서버 sanitizeHtml에서 1차 정제된 콘텐츠.
          // 누락 시 이미지형 페이지의 신청 폼/이미지 레이아웃이 사라짐.
          ALLOWED_TAGS: [
            'b', 'i', 'u', 'p', 'br', 'hr', 'strong', 'em', 'a', 'img', 'picture', 'source',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
            'span', 'div', 'section', 'article', 'header', 'footer', 'figure', 'figcaption',
            'table', 'thead', 'tbody', 'tr', 'td', 'th',
            'form', 'label', 'input', 'select', 'option', 'textarea', 'button',
            'details', 'summary', 'mark', 'small', 'sub', 'sup',
          ],
          // style/width/height/loading 추가 — 이미지 width:100% 등 인라인 스타일 보존(모바일 깨짐 방지).
          // 폼 필드는 name/type/placeholder 등을 유지해야 제출 핸들러가 값을 읽음.
          ALLOWED_ATTR: [
            'href', 'src', 'srcset', 'alt', 'title', 'class', 'id', 'style', 'role',
            'width', 'height', 'loading', 'target', 'rel',
            'name', 'type', 'placeholder', 'value', 'required', 'disabled', 'checked',
            'maxlength', 'min', 'max', 'step', 'pattern', 'autocomplete', 'readonly',
            'rows', 'cols', 'selected', 'for', 'colspan', 'rowspan',
            'data-*', 'aria-label', 'aria-hidden',
          ],
          KEEP_CONTENT: true
        }) }}
      />

      {/* 보장형 결제 구역 — 페이지 HTML에 신청폼이 없을 때(HTML/커스텀형) 결제 동선 보장.
          이미지형(폼 자동주입)은 hasForm=true라 숨김 → 버튼 중복 없음. */}
      {payment && !hasForm && !done && !alreadyRegistered && (
        <div className="max-w-md mx-auto px-4 pb-12 pt-4">
          <div className="bg-white border-2 border-emerald-200 rounded-2xl p-6 shadow-sm">
            <p className="text-base font-semibold text-gray-800 mb-1">{payment.productName}</p>
            <p className="text-3xl font-bold text-navy-900 mb-4">
              {payment.productPrice.toLocaleString()}원
              {payment.type === "subscription" && <span className="text-base font-normal text-gray-500"> /월</span>}
            </p>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="이름"
                value={payName}
                onChange={(e) => setPayName(e.target.value)}
                maxLength={30}
                className="w-full border border-gray-300 rounded-xl px-4 min-h-[48px] text-base focus:outline-none focus:border-emerald-500"
              />
              <input
                type="tel"
                placeholder="연락처 (010-1234-5678)"
                value={payPhone}
                onChange={(e) => setPayPhone(e.target.value)}
                maxLength={20}
                className="w-full border border-gray-300 rounded-xl px-4 min-h-[48px] text-base focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={submitGuaranteedPayment}
                disabled={paymentLoading || submitting}
                className="w-full bg-emerald-600 text-white min-h-[52px] flex items-center justify-center rounded-xl text-lg font-bold hover:bg-emerald-500 transition-colors disabled:opacity-50"
              >
                {paymentLoading ? "결제 준비 중..." : payment.type === "subscription" ? "정기결제 시작하기" : "결제하기"}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-3 leading-relaxed">
              판매자: 마비즈스쿨 원격평생교육원 | 사업자번호: 851-67-00338 | 대표: 전혜선<br />
              통신판매업: 제 2024-대전서구-2845 호
            </p>
          </div>
        </div>
      )}

      {/* 커뮤니티 Q&A(티키타카) 섹션 — 질문↔답글, 운영자도 함께 답변 */}
      {commentEnabled && (
        <div className="max-w-xl mx-auto px-4 pb-12 pt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-1">
            💬 궁금한 점 물어보세요 {comments.length > 0 && `(${comments.length})`}
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            운영자와 방문자가 함께 답하는 커뮤니티예요. 무엇이든 편하게 물어보세요.
          </p>

          {/* 질문 목록 (각 질문에 답글 스레드) */}
          {comments.length > 0 ? (
            <div className="space-y-4 mb-6">
              {comments.map((q) => (
                <div key={q.id} className="bg-gray-50 rounded-xl p-4">
                  {/* 질문 */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base font-semibold text-gray-800">{q.authorName}</span>
                    {q.authorRole === "operator" && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">운영자</span>
                    )}
                    <span className="text-xs text-gray-400 ml-auto">
                      {new Date(q.createdAt).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                  <p className="text-base text-gray-700 leading-relaxed whitespace-pre-wrap">{q.content}</p>

                  {/* 답글들 */}
                  {(q.replies?.length ?? 0) > 0 && (
                    <div className="mt-3 space-y-2 pl-4 border-l-2 border-gray-200">
                      {q.replies!.map((r) => (
                        <div key={r.id}>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-semibold text-gray-700">{r.authorName}</span>
                            {r.authorRole === "operator" && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700">운영자</span>
                            )}
                            <span className="text-[11px] text-gray-400 ml-auto">
                              {new Date(r.createdAt).toLocaleDateString("ko-KR")}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{r.content}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 답글 달기 */}
                  {replyTarget === q.id ? (
                    <div className="mt-3 pl-4 space-y-2">
                      <input
                        type="text"
                        placeholder="이름"
                        value={replyForm.authorName}
                        onChange={(e) => setReplyForm({ ...replyForm, authorName: e.target.value })}
                        maxLength={30}
                        className="w-full border border-gray-300 rounded-lg px-3 min-h-[44px] text-base focus:outline-none focus:border-blue-500"
                      />
                      <textarea
                        placeholder="답글을 입력하세요 (500자 이내)"
                        value={replyForm.content}
                        onChange={(e) => setReplyForm({ ...replyForm, content: e.target.value })}
                        rows={2}
                        maxLength={500}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base resize-none focus:outline-none focus:border-blue-500"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => postReply(q.id)}
                          disabled={replyPosting || !replyForm.authorName.trim() || !replyForm.content.trim()}
                          className="flex-1 bg-blue-600 text-white min-h-[44px] rounded-lg text-base font-medium hover:bg-blue-500 disabled:opacity-50"
                        >
                          {replyPosting ? "등록 중..." : "답글 등록"}
                        </button>
                        <button
                          onClick={() => { setReplyTarget(null); setReplyForm({ authorName: "", content: "" }); }}
                          className="px-4 min-h-[44px] text-base text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setReplyTarget(q.id); setReplyForm({ authorName: "", content: "" }); }}
                      className="mt-2 text-sm text-blue-600 font-medium hover:underline"
                    >
                      💬 답글 달기
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-blue-50 rounded-xl p-5 mb-6 text-center">
              <p className="text-base text-gray-700 font-medium">아직 질문이 없어요. 첫 질문을 남겨보세요!</p>
              <p className="text-sm text-gray-500 mt-1">운영자가 확인 후 답해드려요.</p>
            </div>
          )}

          {/* 새 질문 작성 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-base font-semibold text-gray-700">질문 남기기</p>
            <input
              type="text"
              placeholder="이름"
              value={commentForm.authorName}
              onChange={(e) => setCommentForm({ ...commentForm, authorName: e.target.value })}
              maxLength={50}
              className="w-full border border-gray-300 rounded-lg px-3 min-h-[48px] text-base focus:outline-none focus:border-gold-500"
            />
            <textarea
              placeholder="여행에 대해 궁금한 점을 물어보세요 (500자 이내)"
              value={commentForm.content}
              onChange={(e) => setCommentForm({ ...commentForm, content: e.target.value })}
              rows={3}
              maxLength={500}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base resize-none focus:outline-none focus:border-gold-500"
            />
            {commentMsg && (
              <p className={`text-sm ${commentMsg.includes("됐") || commentMsg.includes("등록됐") ? "text-green-600" : "text-red-500"}`}>
                {commentMsg}
              </p>
            )}
            <button
              onClick={postQuestion}
              disabled={posting || !commentForm.authorName.trim() || !commentForm.content.trim()}
              className="w-full bg-navy-900 text-white min-h-[48px] rounded-lg text-base font-medium hover:bg-navy-700 disabled:opacity-50"
            >
              {posting ? "등록 중..." : "질문 올리기"}
            </button>
          </div>
        </div>
      )}
      {footer && (
        <footer className="max-w-xl mx-auto px-4 py-8 border-t border-gray-100 text-center text-xs text-gray-400 leading-relaxed">
          {footer.split('\n').map((line, i) => (
            <span key={i}>{line}{i < footer.split('\n').length - 1 && <br />}</span>
          ))}
        </footer>
      )}

      {/* 실시간 소셜 증명 위젯 */}
      <LiveSocialProof pageId={pageId} />

      {/* T38: Sticky CTA 바 — 모바일 전용, 폼 섹션이 뷰포트 밖일 때 표시 */}
      {showStickyCta && !done && !alreadyRegistered && (
        <div className="fixed bottom-0 left-0 right-0 bg-blue-600 text-white p-4 z-50 flex justify-between items-center md:hidden shadow-2xl">
          <span className="text-sm font-semibold">{buttonTitle || '지금 신청하기'}</span>
          <button
            onClick={scrollToForm}
            className="bg-white text-blue-600 px-4 py-2 rounded-full text-sm font-bold hover:bg-blue-50 transition-colors"
          >
            신청 →
          </button>
        </div>
      )}
    </div>
  );
}
