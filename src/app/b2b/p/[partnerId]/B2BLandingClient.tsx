"use client";

import { useState, useRef, useEffect } from "react";
import DOMPurify from "isomorphic-dompurify";

interface PaymentConfig {
  type: "onetime" | "subscription";
  productName: string;
  productPrice: number;
  cycleDay: number;
  expireDate: string;
}

interface FormField {
  id: string;
  name: string;
  required: boolean;
  type?: string;
  placeholder?: string;
  options?: string[];
}

interface FormConfigType {
  fields?: FormField[];
  footer?: string;
}

interface Props {
  pageId: string;
  partnerId: string;
  htmlContent: string;
  editorMode: string;
  commentEnabled: boolean;
  payment?: PaymentConfig;
  buttonTitle?: string;
  completionPageUrl?: string;
  footerText?: string;
  formConfig: Record<string, unknown> | null;
  comments: Array<{
    id: string;
    authorName: string;
    content: string;
    createdAt: string;
  }>;
}

type Comment = {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
};

/**
 * 폼 필드 값 추출 헬퍼 함수
 * Issue 17 (Agent J): Form 필드 선택자 패턴 통일 — 반복 코드 제거
 * name 어트리뷰트 → placeholder fallback → type 기반 순서
 *
 * @param form HTML form 엘리먼트
 * @param fieldName 필드 이름 (name 어트리뷰트)
 * @param fallbackPatterns placeholder에서 찾을 패턴들
 * @returns trim된 필드 값 또는 빈 문자열
 */
function getFormFieldValue(
  form: HTMLFormElement,
  fieldName: string,
  fallbackPatterns: string[]
): string {
  // 첫 번째: name 어트리뷰트로 정확히 찾기
  const byName = form.querySelector(
    `input[name="${fieldName}"]`
  ) as HTMLInputElement | null;
  if (byName && byName.value?.trim()) {
    return byName.value.trim();
  }

  // 두 번째: placeholder 패턴 매칭
  for (const pattern of fallbackPatterns) {
    const byPlaceholder = form.querySelector(
      `input[placeholder*="${pattern}"]`
    ) as HTMLInputElement | null;
    if (byPlaceholder && byPlaceholder.value?.trim()) {
      return byPlaceholder.value.trim();
    }
  }

  return "";
}

/**
 * formConfig 검증 및 필드 추출 헬퍼 함수
 * P1 버그 수정: formConfig 타입 안전성 강화 — as 타입 어설션 제거, 런타임 검증 추가
 * DRY 원칙: L227-236, L247-259 반복 코드 통합
 *
 * @param fc 폼 설정 객체 (Record<string, unknown> | null)
 * @returns 검증된 FormField 배열 (유효하지 않으면 [])
 */
function validateAndExtractFields(fc: unknown): FormField[] {
  if (!fc || typeof fc !== 'object') return [];
  if (!('fields' in fc)) return [];

  const fields = (fc as Record<string, unknown>).fields;
  if (!Array.isArray(fields)) return [];

  return fields.filter((f: unknown) => {
    if (!f || typeof f !== 'object') return false;
    if (!('id' in f) || !('name' in f)) return false;
    return true;
  }) as FormField[];
}

/**
 * 봇 방어: honeypot + 시간 기반 검증
 * P1 P0: handleSubmit 함수 분해 — 보안 검증 분리
 *
 * @param form HTML form 엘리먼트
 * @param loadedAt 페이지 로드 시간
 * @returns 봇이 아니면 true, 봇으로 판단되면 false
 */
function validateBotDefense(form: HTMLFormElement, loadedAt: number): boolean {
  const hpVal = (form.querySelector('input[name="website"]') as HTMLInputElement)?.value ?? "";
  if (hpVal.trim()) return false;
  if (Date.now() - loadedAt < 1500) return false;
  return true;
}

/**
 * 폼 데이터 검증 (이름, 전화번호 등)
 * P1 P0: handleSubmit 함수 분해 — 입력 검증 분리
 *
 * @param nameVal 이름
 * @param phoneVal 전화번호
 * @returns 검증 오류 메시지 또는 null (유효함)
 */
function validateFormData(nameVal: string, phoneVal: string): string | null {
  if (!nameVal.trim()) {
    return "이름을 입력해 주세요.";
  }

  const trimmedPhone = phoneVal.trim();
  if (!trimmedPhone) {
    return "연락처를 입력해 주세요.";
  }

  const rawPhone = trimmedPhone.replace(/[^0-9]/g, "");
  if (!rawPhone || !/^01[016789]\d{7,8}$/.test(rawPhone)) {
    return "올바른 휴대폰 번호를 입력해 주세요. (예: 010-1234-5678)";
  }

  return null;
}

/**
 * B2B 신청 API 호출
 * P1 P0: handleSubmit 함수 분해 — API 호출 분리
 *
 * @param partnerId 파트너 ID
 * @param data 신청 데이터
 * @returns API 응답 { ok: boolean, duplicate?: boolean, message?: string, ... }
 */
async function submitRegistration(
  partnerId: string,
  data: Record<string, unknown>
): Promise<{ ok?: boolean; duplicate?: boolean; message?: string }> {
  const res = await fetch(`/api/public/b2b/p/${partnerId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

/**
 * B2B 공개 랜딩페이지 클라이언트 컴포넌트
 * - HTML/이미지 콘텐츠 렌더링
 * - 동적 폼 필드 렌더링 (formConfig 기반)
 * - 폼 submit 인터셉트 → register API 호출
 * - honeypot + loadedAt 봇 가드
 * - 댓글 표시 (commentEnabled=true인 경우)
 */
export function B2BLandingClient({
  pageId,
  partnerId,
  htmlContent,
  editorMode,
  commentEnabled,
  payment,
  buttonTitle,
  completionPageUrl,
  footerText,
  formConfig,
  comments: initialComments,
}: Props) {
  const [done, setDone] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [registeredName, setRegisteredName] = useState("");
  const [registeredPhone, setRegisteredPhone] = useState("");

  // 댓글
  const [comments, setComments] = useState<Comment[]>(initialComments ?? []);
  const [commentForm, setCommentForm] = useState({ authorName: "", content: "" });
  const [posting, setPosting] = useState(false);
  const [commentMsg, setCommentMsg] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false);
  const loadTimeRef = useRef<number>(Date.now());
  const formConfigRef = useRef<Record<string, unknown> | null>(null);

  // 에러 토스트 4초 자동 dismiss
  useEffect(() => {
    if (phoneError || fieldError) {
      const timer = setTimeout(
        () => {
          setPhoneError("");
          setFieldError("");
        },
        4000
      );
      return () => clearTimeout(timer);
    }
  }, [phoneError, fieldError]);

  // 재방문 체크
  useEffect(() => {
    try {
      if (localStorage.getItem(`registered_b2b_${partnerId}`)) {
        setAlreadyRegistered(true);
      }
    } catch {}
  }, [partnerId]);

  // 댓글 로드 (초기 comments prop으로 제공됨)
  useEffect(() => {
    if (!commentEnabled || initialComments.length > 0) return;
    // 서버에서 이미 제공했으므로 추가 로드 불필요
  }, [commentEnabled, initialComments]);

  const postComment = async () => {
    if (!commentForm.authorName.trim() || !commentForm.content.trim()) return;
    setPosting(true);
    setCommentMsg("");
    try {
      const res = await fetch(`/api/public/b2b/p/${partnerId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(commentForm),
      });
      const data = await res.json();
      if (data.ok) {
        setComments((prev) => [data.comment, ...prev]);
        setCommentForm({ authorName: "", content: "" });
        setCommentMsg("후기가 등록됐습니다!");
      } else {
        setCommentMsg(data.message ?? "등록 실패");
      }
    } catch {
      setCommentMsg("네트워크 오류가 발생했습니다.");
    }
    setPosting(false);
  };

  // useEffect 내에서 formConfigRef 업데이트
  useEffect(() => {
    formConfigRef.current = formConfig;
  }, [formConfig]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // buttonTitle 반영 — 폼 내 submit 버튼 텍스트 교체
    if (buttonTitle) {
      container
        .querySelectorAll<HTMLButtonElement>(
          'form button[type="submit"], form button:not([type])'
        )
        .forEach((btn) => {
          btn.textContent = buttonTitle;
        });
    }

    const handleSubmit = async (e: Event) => {
      e.preventDefault();
      if (submittingRef.current) return;

      const form = e.target as HTMLFormElement;

      // 단계 1: 봇 방어 검증
      if (!validateBotDefense(form, loadTimeRef.current)) {
        setDone(true); // 봇으로 판단 → 조용히 성공 처리
        return;
      }

      // 단계 2: 폼 필드 수집
      const fields = validateAndExtractFields(formConfigRef.current);
      const nameVal = getFormFieldValue(form, "name", ["이름", "성명", "name"]);
      const phoneVal = getFormFieldValue(form, "phone", ["전화", "휴대", "연락", "phone"]);
      const emailVal = (form.querySelector('input[type="email"]') as HTMLInputElement | null)?.value ?? "";
      const companyVal = (form.querySelector('input[name="company"]') as HTMLInputElement | null)?.value ?? "";

      // 커스텀 필드 수집
      const customFields: Record<string, string> = {};
      fields.forEach((f: FormField) => {
        const el = form.querySelector(
          `input[name="field_${f.id}"], textarea[name="field_${f.id}"], select[name="field_${f.id}"]`
        ) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
        if (el && el.value?.trim()) {
          customFields[f.id] = el.value.trim();
        }
      });

      const metadata: Record<string, unknown> = {};
      if (Object.keys(customFields).length) {
        metadata.customFields = customFields;
      }
      const hasMetadata = Object.keys(metadata).length > 0;

      // 단계 3: 입력 검증
      const validationError = validateFormData(nameVal, phoneVal);
      if (validationError) {
        if (validationError.includes("이름")) {
          setFieldError(validationError);
        } else {
          setPhoneError(validationError);
        }
        return;
      }
      setPhoneError("");
      setFieldError("");

      // 단계 4: API 호출
      submittingRef.current = true;
      setSubmitting(true);
      try {
        const data = await submitRegistration(partnerId, {
          name: nameVal,
          phone: phoneVal,
          email: emailVal || undefined,
          company: companyVal || undefined,
          loadedAt: loadTimeRef.current,
          ...(hasMetadata ? { metadata } : {}),
        });

        if (data.ok) {
          setIsDuplicate(!!data.duplicate);
          setRegisteredName(nameVal);
          setRegisteredPhone(phoneVal);
          setDone(true);
          try {
            localStorage.setItem(`registered_b2b_${partnerId}`, "1");
          } catch {}
          if (completionPageUrl) {
            window.location.href = completionPageUrl;
            return;
          }
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          setFieldError(
            data.message ?? "등록에 실패했습니다. 다시 시도해 주세요."
          );
        }
      } catch {
        setFieldError(
          "네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
        );
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    };

    // 폼 submit 이벤트 인터셉트
    const forms = container.querySelectorAll("form");

    // [WO-15] Honeypot input 주입 (봇 유인 — display:none 금지)
    forms.forEach((form) => {
      if (form.querySelector('input[name="website"]')) return; // 중복 방지
      const hp = document.createElement("input");
      hp.type = "text";
      hp.name = "website";
      hp.autocomplete = "off";
      hp.tabIndex = -1;
      hp.setAttribute("aria-hidden", "true");
      hp.style.cssText =
        "position:absolute;left:-9999px;opacity:0;height:0;overflow:hidden;";
      form.appendChild(hp);
    });

    forms.forEach((f) => f.addEventListener("submit", handleSubmit));

    return () => {
      forms.forEach((f) => f.removeEventListener("submit", handleSubmit));
    };
  }, [pageId, partnerId]);

  if (done || alreadyRegistered) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-900 to-blue-800 px-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
          <div className="text-5xl mb-4">🤝</div>
          <h1 className="text-xl font-bold text-blue-900 mb-2">
            {alreadyRegistered || isDuplicate
              ? "이미 신청이 접수되었습니다!"
              : "신청이 완료됐어요!"}
          </h1>
          <p className="text-gray-600 text-sm leading-relaxed">
            {alreadyRegistered || isDuplicate
              ? "담당자가 곧 연락드릴 예정이에요."
              : payment
                ? "결제를 진행하시면 예약이 확정됩니다."
                : "담당자가 빠르면 1시간 이내로 연락드립니다."}
          </p>

          {/* 결제 버튼 (결제 설정이 있는 경우) */}
          {payment && !alreadyRegistered && (
            <div className="mt-4 p-4 bg-blue-50 rounded-xl">
              <p className="text-sm font-semibold text-gray-800 mb-1">
                {payment.productName}
              </p>
              <p className="text-2xl font-bold text-blue-900 mb-3">
                {payment.productPrice.toLocaleString()}원
                {payment.type === "subscription" && (
                  <span className="text-sm font-normal text-gray-500">
                    {" "}
                    /월
                  </span>
                )}
              </p>
              <button
                onClick={async () => {
                  setPaymentLoading(true);
                  try {
                    const res = await fetch("/api/public/payapp/request", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        type: payment.type,
                        goodname: payment.productName,
                        price: payment.productPrice,
                        customerName: registeredName,
                        customerPhone: registeredPhone,
                        landingPageId: pageId,
                        ...(payment.type === "subscription"
                          ? {
                              cycleDay: payment.cycleDay,
                              expireDate: payment.expireDate,
                            }
                          : {}),
                      }),
                    });
                    const data = await res.json();
                    if (data.ok && data.payUrl) {
                      window.location.href = data.payUrl;
                    } else {
                      setFieldError(
                        data.message ?? "결제 요청에 실패했습니다."
                      );
                    }
                  } catch {
                    setFieldError("네트워크 오류가 발생했습니다.");
                  } finally {
                    setPaymentLoading(false);
                  }
                }}
                disabled={paymentLoading}
                className="w-full bg-emerald-600 text-white min-h-[48px] flex items-center justify-center rounded-xl text-base font-bold hover:bg-emerald-500 transition-colors disabled:opacity-50"
              >
                {paymentLoading
                  ? "결제 준비 중..."
                  : payment.type === "subscription"
                    ? "정기결제 시작하기"
                    : "결제하기"}
              </button>
              <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                판매자: 마비즈스쿨 원격평생교육원 | 사업자번호: {process.env.NEXT_PUBLIC_B2B_BUSINESS_ID} |
                대표: {process.env.NEXT_PUBLIC_B2B_ADMIN_NAME}
                <br />
                통신판매업: 제 2024-대전서구-2845 호
              </p>
            </div>
          )}

          <div className="mt-4 space-y-3">
            <a
              href={`https://pf.kakao.com/${process.env.NEXT_PUBLIC_B2B_KAKAO_CHANNEL_ID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-yellow-400 text-gray-900 min-h-[44px] flex items-center justify-center rounded-xl text-sm font-bold hover:bg-yellow-300 transition-colors"
            >
              카카오톡 상담 시작하기
            </a>
            <a
              href={`tel:${process.env.NEXT_PUBLIC_B2B_PHONE}`}
              className="block w-full bg-blue-900 text-white min-h-[44px] flex items-center justify-center rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors"
            >
              전화 상담 ({process.env.NEXT_PUBLIC_B2B_PHONE})
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
          <div className="mt-4 p-3 bg-blue-50 rounded-xl">
            <p className="text-xs text-blue-700 font-medium">
              B2B 파트너 전문 상담팀이 최적의 솔루션을 안내해드립니다.
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
          <div className="bg-white rounded-xl px-6 py-4 text-sm font-medium text-blue-900">
            신청 중...
          </div>
        </div>
      )}

      {/* HTML 콘텐츠 또는 이미지 렌더링 */}
      <div
        ref={containerRef}
        role="main"
        aria-label="B2B 랜딩페이지 콘텐츠"
      >
        {editorMode === "html" ? (
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlContent, {
            ALLOWED_TAGS: ['b', 'i', 'u', 'p', 'br', 'strong', 'em', 'a', 'img', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'span', 'div'],
            ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'style'],
            KEEP_CONTENT: true
          }) }} />
        ) : (
          // 이미지 모드: htmlContent를 이미지로 취급
          htmlContent && (
            <div className="w-full">
              <img
                src={htmlContent}
                alt="B2B 랜딩페이지 콘텐츠"
                className="w-full h-auto"
              />
            </div>
          )
        )}

        {/* 동적 폼 필드 렌더링 (formConfig.fields 기반) */}
        {formConfig && (
          <div className="max-w-2xl mx-auto px-4 py-8">
            <form className="space-y-4 bg-white rounded-xl p-6 shadow-md">
              {/* 기본 필드들 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  placeholder="이름을 입력해주세요"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  연락처 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  placeholder="010-1234-5678"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이메일
                </label>
                <input
                  type="email"
                  name="email"
                  placeholder="user@company.co.kr"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  회사명
                </label>
                <input
                  type="text"
                  name="company"
                  placeholder="회사명을 입력해주세요"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* formConfig.fields 기반 커스텀 필드들 */}
              {formConfig && typeof formConfig === 'object' && 'fields' in formConfig && Array.isArray((formConfig as any).fields)
                ? (formConfig as any).fields.map((field: FormField) => {
                  const fieldKey = `field_${field.id}`;
                  const requiredMark = field.required ? (
                    <span className="text-red-500">*</span>
                  ) : null;

                  if (field.type === "select" && field.options) {
                  return (
                    <div key={field.id}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {field.name} {requiredMark}
                      </label>
                      <select
                        name={fieldKey}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 bg-white"
                        required={field.required}
                      >
                        <option value="">선택해주세요</option>
                        {field.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }

                if (field.type === "textarea") {
                  return (
                    <div key={field.id}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {field.name} {requiredMark}
                      </label>
                      <textarea
                        name={fieldKey}
                        placeholder={field.placeholder || ""}
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
                        required={field.required}
                      />
                    </div>
                  );
                }

                // 기본: text input
                return (
                  <div key={field.id}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.name} {requiredMark}
                    </label>
                    <input
                      type={field.type || "text"}
                      name={fieldKey}
                      placeholder={field.placeholder || ""}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
                      required={field.required}
                    />
                  </div>
                );
                })
                : null}

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-3 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors mt-6"
              >
                {buttonTitle || "상담 신청하기"}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* 방문자 후기 댓글 섹션 */}
      {commentEnabled && (
        <div className="max-w-2xl mx-auto px-4 pb-12 pt-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            💬 고객 후기 {comments.length > 0 && `(${comments.length})`}
          </h2>

          {/* 댓글 목록 */}
          {comments.length > 0 && (
            <div className="space-y-3 mb-6">
              {comments.map((c) => (
                <div key={c.id} className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-800">
                      {c.authorName}
                    </span>
                    <span className="text-xs text-gray-400 ml-auto">
                      {new Date(c.createdAt).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {c.content}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* 후기 작성 폼 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">후기 남기기</p>
            <input
              type="text"
              placeholder="이름"
              value={commentForm.authorName}
              onChange={(e) =>
                setCommentForm({
                  ...commentForm,
                  authorName: e.target.value,
                })
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            <textarea
              placeholder="B2B 상담 후기를 남겨주세요 (500자 이내)"
              value={commentForm.content}
              onChange={(e) =>
                setCommentForm({
                  ...commentForm,
                  content: e.target.value,
                })
              }
              rows={3}
              maxLength={500}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-500"
            />
            {commentMsg && (
              <p
                className={`text-xs ${
                  commentMsg.includes("됐") ? "text-green-600" : "text-red-500"
                }`}
              >
                {commentMsg}
              </p>
            )}
            <button
              onClick={postComment}
              disabled={
                posting ||
                !commentForm.authorName.trim() ||
                !commentForm.content.trim()
              }
              className="w-full bg-blue-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {posting ? "등록 중..." : "후기 등록"}
            </button>
          </div>
        </div>
      )}

      {/* 푸터 */}
      {footerText && (
        <footer className="max-w-2xl mx-auto px-4 py-8 border-t border-gray-100 text-center text-xs text-gray-400 leading-relaxed">
          {footerText.split("\n").map((line, i) => (
            <span key={i}>
              {line}
              {i < footerText.split("\n").length - 1 && <br />}
            </span>
          ))}
        </footer>
      )}
    </div>
  );
}
