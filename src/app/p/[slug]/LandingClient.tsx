"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  pageId:       string;
  htmlContent:  string;
}

/**
 * 공개 랜딩페이지 클라이언트 컴포넌트
 * - HTML 콘텐츠 렌더링
 * - 폼 submit 인터셉트 → register API 호출
 * - 완료 화면 표시
 */
export function LandingClient({ pageId, htmlContent }: Props) {
  const [done,       setDone]       = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const containerRef  = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false); // stale closure 방지용 ref

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleSubmit = async (e: Event) => {
      e.preventDefault();
      if (submittingRef.current) return;

      const form  = e.target as HTMLFormElement;
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

      const nameVal  = name?.value  ?? "";
      const phoneVal = phone?.value ?? "";
      const emailVal = email?.value ?? "";

      if (!nameVal.trim() || !phoneVal.trim()) return;

      submittingRef.current = true;
      setSubmitting(true);
      try {
        const res  = await fetch(`/api/landing-pages/${pageId}/register`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ name: nameVal, phone: phoneVal, email: emailVal || undefined }),
        });
        const data = await res.json();
        if (data.ok) {
          setIsDuplicate(!!data.isDuplicate);
          setDone(true);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    };

    // 폼 submit 이벤트 인터셉트
    const forms = container.querySelectorAll("form");
    forms.forEach((f) => f.addEventListener("submit", handleSubmit));

    // submit-btn 클래스 버튼 클릭 인터셉트 (form 태그 없는 경우 대비)
    const btn = container.querySelector(".submit-btn, button[type='submit']");
    btn?.addEventListener("click", (e) => {
      const form = btn.closest("form");
      if (!form) {
        e.preventDefault();
        const syntheticForm = { target: container.querySelector("form") ?? container };
        handleSubmit(syntheticForm as unknown as Event);
      }
    });

    return () => {
      forms.forEach((f) => f.removeEventListener("submit", handleSubmit));
    };
  }, [pageId, submitting]);

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-navy-900 to-navy-800 px-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
          <div className="text-5xl mb-4">🚢</div>
          <h1 className="text-xl font-bold text-navy-900 mb-2">
            {isDuplicate ? "이미 신청하셨습니다!" : "신청이 완료됐어요!"}
          </h1>
          <p className="text-gray-600 text-sm leading-relaxed">
            {isDuplicate
              ? "이미 접수된 연락처입니다.\n담당자가 곧 연락드릴 예정이에요."
              : "담당자가 빠르면 1시간 이내로 연락드립니다.\n잠시만 기다려 주세요 😊"}
          </p>
          <div className="mt-6 p-3 bg-gold-50 rounded-xl">
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
      {submitting && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl px-6 py-4 text-sm font-medium text-navy-900">
            신청 중...
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </div>
  );
}
