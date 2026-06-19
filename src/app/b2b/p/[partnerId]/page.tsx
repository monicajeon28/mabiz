'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import DOMPurify from 'dompurify';
import { useParams } from 'next/navigation';
import { ArrowRight, X, Loader2, CheckCircle2, Ship, Phone, User } from 'lucide-react';
import { L6TimingBanner } from '@/components/b2b/L6TimingBanner';

// ─── 타입 ──────────────────────────────────────────────────
interface PartnerInfo {
  name: string;
  affiliateCode: string | null;
}

interface TemplateData {
  htmlContent: string | null;
}

interface L6Config {
  enabled: boolean;
  hoursRemaining?: string;
  seatsAvailable?: string;
  currentPrice?: string;
  tomorrowPrice?: string;
  discount?: string;
}

// ─── 패키지 옵션 ────────────────────────────────────────────
const PACKAGE_OPTIONS = [
  { value: '330', label: '스탠다드 패키지 -- 330만원' },
  { value: '540', label: '프리미엄 패키지 -- 540만원' },
  { value: '750', label: '럭셔리 패키지 -- 750만원' },
];

// ─── 메모이즈된 HTML 렌더러 ──────────────────────────────────
const TemplateHtml = memo(function TemplateHtml({ html }: { html: string }) {
  // DOMPurify로 XSS 방지: DB에서 가져온 htmlContent는 입력 시 sanitize되지만
  // 렌더링 시점에도 이중 방어 (Defense-in-Depth)
  const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
});

// ─── 신청 폼 컴포넌트 ──────────────────────────────────────
function LeadForm({ partnerId }: { partnerId: string }) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    packageInterest: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    const trimmedName = form.name.trim();
    const trimmedPhone = form.phone.trim().replace(/[^0-9]/g, '');

    if (!trimmedName || trimmedName.length < 2) {
      setError('이름을 정확히 입력해주세요.');
      return;
    }

    if (!trimmedPhone || !/^01([016789])(\d{3,4})(\d{4})$/.test(trimmedPhone)) {
      setError('올바른 휴대폰 번호를 입력해주세요.');
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch(`/api/public/b2b/p/${partnerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          phone: trimmedPhone,
          packageInterest: form.packageInterest || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.message ?? '등록 중 오류가 발생했습니다.');
        return;
      }

      setSubmitted(true);
    } catch {
      setError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-10">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">신청 완료!</h2>
        <p className="text-gray-500 text-sm">담당자가 빠르게 연락드리겠습니다.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* 이름 */}
      <div>
        <label htmlFor="lead-name" className="block text-sm font-medium text-gray-700 mb-1">
          이름 <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            id="lead-name"
            name="name"
            type="text"
            value={form.name}
            onChange={handleChange}
            placeholder="홍길동"
            disabled={submitting}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>
      </div>

      {/* 연락처 */}
      <div>
        <label htmlFor="lead-phone" className="block text-sm font-medium text-gray-700 mb-1">
          연락처 <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            id="lead-phone"
            name="phone"
            type="tel"
            value={form.phone}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9-]/g, '');
              setForm((prev) => ({ ...prev, phone: value }));
            }}
            placeholder="010-0000-0000"
            disabled={submitting}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>
      </div>

      {/* 관심 패키지 */}
      <div>
        <label htmlFor="lead-package" className="block text-sm font-medium text-gray-700 mb-1">
          관심 패키지
        </label>
        <div className="relative">
          <Ship className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            id="lead-package"
            name="packageInterest"
            value={form.packageInterest}
            onChange={handleChange}
            disabled={submitting}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white appearance-none"
          >
            <option value="">선택 안 함</option>
            {PACKAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* 제출 버튼 */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-2 mt-2"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>처리 중...</span>
          </>
        ) : (
          <>
            <span>상담 신청하기</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  );
}

// ─── 메인 페이지 컴포넌트 ────────────────────────────────────
export default function PartnerB2BLandingPage() {
  const params = useParams();
  const partnerId = params?.partnerId as string;

  const [partner, setPartner] = useState<PartnerInfo | null>(null);
  const [template, setTemplate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [l6Config, setL6Config] = useState<L6Config | null>(null);

  // 파트너 정보 + 템플릿 조회
  useEffect(() => {
    if (!partnerId) return;

    let cancelled = false;

    async function load() {
      try {
        // 파트너 정보 조회 (공개 API)
        const infoRes = await fetch(`/api/public/b2b/p/${partnerId}?info=1`);
        if (!infoRes.ok) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const infoData = await infoRes.json();
        if (!cancelled) {
          setPartner(infoData.partner);

          // affiliateCode 쿠키 저장 (파트너 추적)
          if (infoData.partner?.affiliateCode) {
            document.cookie = `affiliate_code=${infoData.partner.affiliateCode};path=/;max-age=${60 * 60 * 24 * 30};SameSite=Lax`;
          }

          // L6 렌즈 설정 추출 (formConfig.l6Config)
          const fc = infoData.landingPage?.formConfig;
          if (fc && typeof fc === 'object') {
            const l6 = (fc as Record<string, unknown>).l6Config;
            if (l6 && typeof l6 === 'object' && (l6 as Record<string, unknown>).enabled === true) {
              setL6Config(l6 as L6Config);
            }
          }
        }

        // 파트너별 템플릿 조회
        const tplRes = await fetch(`/api/b2b/templates?partnerId=${partnerId}`);
        if (tplRes.ok) {
          const tplData = await tplRes.json();
          if (!cancelled && tplData.htmlContent) {
            setTemplate(tplData.htmlContent);
          }
        }
        // 템플릿이 없으면 template은 null → 기본 폼만 표시
      } catch {
        // 네트워크 오류 시 기본 폼 표시
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [partnerId]);

  // ── 로딩 중 ──
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">페이지를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // ── 파트너 없음 ──
  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <X className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-700 mb-2">유효하지 않은 링크입니다</h1>
          <p className="text-gray-500 text-sm">파트너 정보를 찾을 수 없습니다.</p>
        </div>
      </div>
    );
  }

  // ── 템플릿 HTML이 있는 경우: 템플릿 렌더링 + 폼 삽입 ──
  if (template) {
    // <!-- FORM_PLACEHOLDER --> 마커로 폼 삽입 위치 결정
    const parts = template.split('<!-- FORM_PLACEHOLDER -->');

    return (
      <div className="min-h-screen bg-white">
        {parts.length > 1 ? (
          // 템플릿 안에 FORM_PLACEHOLDER가 있으면 그 위치에 폼 삽입
          parts.map((part, i) => (
            <div key={i}>
              <TemplateHtml html={part} />
              {i < parts.length - 1 && (
                <div className="max-w-md mx-auto px-4 py-8">
                  {/* L6 렌즈: 타이밍/손실회피 배너 (formConfig.l6Config 기반) */}
                  {l6Config?.enabled && (
                    <L6TimingBanner
                      hoursRemaining={parseInt(l6Config.hoursRemaining ?? "24")}
                      seatsAvailable={parseInt(l6Config.seatsAvailable ?? "5")}
                      currentPrice={parseInt(l6Config.currentPrice ?? "3300000")}
                      tomorrowPrice={parseInt(l6Config.tomorrowPrice ?? "3450000")}
                      earlyBookingDiscount={parseInt(l6Config.discount ?? "15")}
                    />
                  )}
                  <LeadForm partnerId={partnerId} />
                </div>
              )}
            </div>
          ))
        ) : (
          // 마커가 없으면 템플릿 아래에 폼 배치
          <>
            <TemplateHtml html={template} />
            <div className="max-w-md mx-auto px-4 py-8">
              {/* L6 렌즈: 타이밍/손실회피 배너 */}
              <L6TimingBanner
                hoursRemaining={24}
                seatsAvailable={5}
                currentPrice={3300000}
                tomorrowPrice={3450000}
                earlyBookingDiscount={15}
              />
              <LeadForm partnerId={partnerId} />
            </div>
          </>
        )}

        <p className="text-center text-xs text-gray-400 pb-6">
          입력하신 정보는 상담 목적으로만 사용됩니다.
        </p>
      </div>
    );
  }

  // ── 템플릿 없음: 기본 폼 페이지 (기존 /b2b/[orgSlug] 스타일 참고) ──
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
        {/* L6 렌즈: 타이밍/손실회피 배너 (formConfig.l6Config 기반) */}
        {l6Config?.enabled && (
          <L6TimingBanner
            hoursRemaining={parseInt(l6Config.hoursRemaining ?? "24")}
            seatsAvailable={parseInt(l6Config.seatsAvailable ?? "5")}
            currentPrice={parseInt(l6Config.currentPrice ?? "3300000")}
            tomorrowPrice={parseInt(l6Config.tomorrowPrice ?? "3450000")}
            earlyBookingDiscount={parseInt(l6Config.discount ?? "15")}
          />
        )}

        {/* 헤더 */}
        <div className="mb-8 text-center">
          <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Ship className="w-7 h-7 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {partner?.name ? `${partner.name} 파트너` : '파트너'} 상담 신청
          </h1>
          <p className="text-sm text-gray-500">
            정보를 남겨주시면 담당자가 빠르게 연락드립니다.
          </p>
        </div>

        {/* 신청 폼 */}
        <LeadForm partnerId={partnerId} />
      </div>

      <p className="mt-6 text-xs text-gray-400 text-center">
        입력하신 정보는 상담 목적으로만 사용됩니다.
      </p>

      {/* ── 수익인증 섹션 (기존 /b2b/[orgSlug] 스타일) ─────────── */}
      <div className="w-full max-w-md mt-10 space-y-8">
        {/* 본업 수익인증 */}
        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
            <h3 className="text-white font-bold text-lg">본업 수익인증</h3>
            <p className="text-blue-100 text-xs mt-1">크루즈닷 파트너 실제 수익 내역</p>
          </div>
          <div className="p-4 space-y-3">
            <img
              src="/images/income-proof/main-income.jpg"
              alt="본업 크루즈닷 수익인증"
              className="w-full rounded-lg border border-gray-100"
              loading="lazy"
            />
            <img
              src="/images/income-proof/side-income.jpg"
              alt="크루즈닷 수익인증"
              className="w-full rounded-lg border border-gray-100"
              loading="lazy"
            />
            <div className="flex items-center gap-2 pt-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-gray-500">매월 정산 / 투명한 수익 구조</span>
            </div>
          </div>
        </div>

        {/* 주부 수익인증 */}
        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
          <div className="bg-gradient-to-r from-pink-500 to-rose-500 px-6 py-4">
            <h3 className="text-white font-bold text-lg">주부 수익인증</h3>
            <p className="text-pink-100 text-xs mt-1">육아와 병행하며 만드는 나만의 수익</p>
          </div>
          <div className="p-4">
            <img
              src="/images/income-proof/housewife-income.jpg"
              alt="주부 크루즈닷 수익인증"
              className="w-full rounded-lg border border-gray-100"
              loading="lazy"
            />
            <div className="mt-3 bg-pink-50 rounded-lg p-3">
              <p className="text-xs text-pink-700 font-medium">
                "아이 재우고 틈틈이 했는데, 매달 통장에 찍히니까 진짜 뿌듯해요"
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <div className="w-2 h-2 bg-pink-500 rounded-full animate-pulse" />
              <span className="text-xs text-gray-500">시간 자유 / 재택 가능 / 경력단절 무관</span>
            </div>
          </div>
        </div>

        {/* 프리랜서 임산부 국가지원 */}
        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
          <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-4">
            <h3 className="text-white font-bold text-lg">프리랜서 임산부 국가지원</h3>
            <p className="text-violet-100 text-xs mt-1">고용노동부 출산급여 150만원 수령 가능</p>
          </div>
          <div className="p-4">
            <img
              src="/images/income-proof/freelancer-support.jpg"
              alt="프리랜서 임산부 국가지원"
              className="w-full rounded-lg border border-gray-100"
              loading="lazy"
            />
            <div className="mt-3 bg-violet-50 rounded-lg p-3 space-y-1">
              <p className="text-xs text-violet-700 font-medium">
                크루즈닷 파트너 활동 = 프리랜서 경력 인정
              </p>
              <p className="text-xs text-violet-600">
                출산 시 고용노동부에서 <span className="font-bold">150만원</span> 출산급여 수령 가능
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
              <span className="text-xs text-gray-500">국가 지원 / 프리랜서 경력 인정 / 출산급여</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
