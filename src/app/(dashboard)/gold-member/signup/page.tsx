"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronLeft, Check, AlertCircle, Loader2 } from "lucide-react";

type SignupStep = "info" | "plan" | "payment" | "confirm";
type PaymentMethod = "card" | "account";
type PlanType = "A" | "B";

interface FormData {
  name: string;
  phone: string;
  email: string;
  planType: PlanType;
  paymentMethod: PaymentMethod;
  paymentDay: number;
  agreeTerms: boolean;
}

const PLAN_INFO = {
  A: {
    name: "기본 플랜",
    monthlyPrice: 33000,
    totalMonths: 12,
    totalPrice: 396000,
    benefits: [
      "연 2회 건강검진 (140개 병원)",
      "월 혜택 (건강보험, 여행보험)",
      "주 1회 라이브방송 접근권",
      "전담 매니저 배정",
    ],
  },
  B: {
    name: "프리미엄 플랜",
    monthlyPrice: 66000,
    totalMonths: 12,
    totalPrice: 792000,
    benefits: [
      "연 4회 건강검진 (140개 병원)",
      "월 혜택 (건강보험, 여행보험, 스파)",
      "주 3회 라이브방송 + 1:1 컨설팅",
      "전담 매니저 + VIP 지원팀",
      "크루즈 50% 할인권",
    ],
  },
};

const PAYMENT_METHODS = {
  card: { label: "신용카드 (자동납부)", icon: "💳" },
  account: { label: "계좌이체 (매월 자동이체)", icon: "🏦" },
};

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<SignupStep>("info");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<FormData>({
    name: "",
    phone: "",
    email: "",
    planType: "A",
    paymentMethod: "card",
    paymentDay: 1,
    agreeTerms: false,
  });

  // 폰 번호 포맷팅
  const formatPhone = (value: string) => {
    const digits = value.replace(/[^0-9]/g, "");
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, phone: formatPhone(e.target.value) });
  };

  const validateStep = (currentStep: SignupStep): boolean => {
    setError("");
    switch (currentStep) {
      case "info":
        if (!form.name.trim()) {
          setError("이름을 입력해주세요.");
          return false;
        }
        if (!form.phone.replace(/[^0-9]/g, "").match(/^01[0-9]\d{7,8}$/)) {
          setError("올바른 휴대폰 번호를 입력해주세요.");
          return false;
        }
        if (!form.email.includes("@")) {
          setError("올바른 이메일을 입력해주세요.");
          return false;
        }
        return true;

      case "plan":
        return true;

      case "payment":
        return true;

      case "confirm":
        if (!form.agreeTerms) {
          setError("약관에 동의해주세요.");
          return false;
        }
        return true;

      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!validateStep(step)) return;

    const steps: SignupStep[] = ["info", "plan", "payment", "confirm"];
    const currentIdx = steps.indexOf(step);
    if (currentIdx < steps.length - 1) {
      setStep(steps[currentIdx + 1]);
    }
  };

  const handleBack = () => {
    const steps: SignupStep[] = ["info", "plan", "payment", "confirm"];
    const currentIdx = steps.indexOf(step);
    if (currentIdx > 0) {
      setStep(steps[currentIdx - 1]);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep("confirm")) return;

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/gold-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.replace(/[^0-9]/g, ""),
          email: form.email.trim(),
          courseType: form.planType,
          joinDate: new Date().toISOString().split("T")[0],
          paymentDay: form.paymentDay,
          paymentMethod: form.paymentMethod,
          totalPayments: PLAN_INFO[form.planType].totalMonths,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "가입 처리 중 오류가 발생했습니다.");
        return;
      }

      // 가입 완료 페이지로 이동
      router.push(`/gold-member/success?id=${data.id}`);
    } catch (err) {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const plan = PLAN_INFO[form.planType];
  const stepLabels = {
    info: "기본정보",
    plan: "플랜 선택",
    payment: "결제 방법",
    confirm: "약관 동의",
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            골드회원 신청
          </h1>
          <p className="text-gray-600 text-sm sm:text-base">
            40-60대를 위한 건강한 크루즈 여행 플랜
          </p>
        </div>

        {/* 진행률 표시 */}
        <div className="mb-8">
          <div className="flex justify-between mb-3">
            {Object.entries(stepLabels).map(([stepKey, label], idx) => (
              <div key={stepKey} className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mb-2 font-semibold text-sm sm:text-base transition-colors ${
                    step === stepKey
                      ? "bg-blue-600 text-white"
                      : idx < Object.keys(stepLabels).indexOf(step)
                      ? "bg-green-600 text-white"
                      : "bg-gray-300 text-gray-600"
                  }`}
                >
                  {idx < Object.keys(stepLabels).indexOf(step) ? (
                    <Check className="w-5 h-5 sm:w-6 sm:h-6" />
                  ) : (
                    idx + 1
                  )}
                </div>
                <p className="text-xs sm:text-sm text-gray-600 text-center">{label}</p>
              </div>
            ))}
          </div>
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{
                width: `${((Object.keys(stepLabels).indexOf(step) + 1) / Object.keys(stepLabels).length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* 콘텐츠 */}
        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 mb-6">
          {error && (
            <div className="flex gap-3 p-4 mb-6 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Step 1: 기본정보 */}
          {step === "info" && (
            <div className="space-y-5">
              <h2 className="text-xl font-bold text-gray-900 mb-6">기본 정보 입력</h2>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  이름 *
                </label>
                <input
                  type="text"
                  maxLength={50}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="예: 김영희"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  휴대폰 번호 *
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={handlePhoneChange}
                  placeholder="010-0000-0000"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  월 결제 알림과 고객 지원을 위해 사용됩니다.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  이메일 *
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="example@email.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  계약서와 영수증이 이메일로 발송됩니다.
                </p>
              </div>

              {/* 심리학 요소: 신뢰 증강 */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  ✓ 입력하신 정보는 은행 수준의 보안으로 관리됩니다.
                </p>
              </div>
            </div>
          )}

          {/* Step 2: 플랜 선택 */}
          {step === "plan" && (
            <div className="space-y-5">
              <h2 className="text-xl font-bold text-gray-900 mb-6">플랜 선택</h2>

              <div className="grid gap-4 sm:grid-cols-2">
                {(["A", "B"] as const).map((planType) => {
                  const p = PLAN_INFO[planType];
                  const isSelected = form.planType === planType;
                  return (
                    <button
                      key={planType}
                      onClick={() => setForm({ ...form, planType })}
                      className={`p-6 rounded-lg border-2 transition-all text-left ${
                        isSelected
                          ? "border-blue-600 bg-blue-50"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      <h3 className="font-bold text-lg mb-2 text-gray-900">{p.name}</h3>
                      <p className="text-2xl font-bold text-blue-600 mb-4">
                        월 {p.monthlyPrice.toLocaleString()}원
                      </p>
                      <ul className="space-y-2 mb-4">
                        {p.benefits.map((benefit, idx) => (
                          <li key={idx} className="flex gap-2 text-sm text-gray-700">
                            <span className="text-blue-600 font-bold">✓</span>
                            {benefit}
                          </li>
                        ))}
                      </ul>

                      {/* 심리학 요소: 희소성/사회적 증명 */}
                      {planType === "B" && (
                        <div className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-1 rounded w-fit">
                          인기 플랜
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* 심리학 요소: 손실회피 강화 */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-900 font-semibold mb-2">
                  ⚠️ 건강검진은 가입 직후부터 예약 가능합니다.
                </p>
                <p className="text-xs text-amber-800">
                  평균 대기일: 2주 이내 | 140개 병원 선택 가능
                </p>
              </div>
            </div>
          )}

          {/* Step 3: 결제 방법 */}
          {step === "payment" && (
            <div className="space-y-5">
              <h2 className="text-xl font-bold text-gray-900 mb-6">결제 방법</h2>

              <div className="space-y-3">
                {(["card", "account"] as const).map((method) => {
                  const m = PAYMENT_METHODS[method];
                  const isSelected = form.paymentMethod === method;
                  return (
                    <button
                      key={method}
                      onClick={() => setForm({ ...form, paymentMethod: method })}
                      className={`w-full p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${
                        isSelected
                          ? "border-blue-600 bg-blue-50"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      <input
                        type="radio"
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-5 h-5"
                      />
                      <span className="text-2xl">{m.icon}</span>
                      <span className="font-semibold text-gray-900">{m.label}</span>
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  결제일 선택
                </label>
                <select
                  value={form.paymentDay}
                  onChange={(e) => setForm({ ...form, paymentDay: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[...Array(28)].map((_, i) => {
                    const day = i + 1;
                    return (
                      <option key={day} value={day}>
                        {day}일 (매월 자동 결제)
                      </option>
                    );
                  })}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  결제 3일 전 알림을 받습니다.
                </p>
              </div>

              {/* 심리학 요소: 신뢰 강화 */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-900">
                  🔒 결제 정보는 암호화되어 보호됩니다. (PCI-DSS 준수)
                </p>
              </div>
            </div>
          )}

          {/* Step 4: 약관 동의 */}
          {step === "confirm" && (
            <div className="space-y-5">
              <h2 className="text-xl font-bold text-gray-900 mb-6">약관 동의</h2>

              <div className="max-h-64 overflow-y-auto p-4 bg-gray-50 border border-gray-300 rounded-lg text-xs text-gray-700 space-y-3">
                <div>
                  <h4 className="font-bold mb-1">제 1조 골드회원 이용약관</h4>
                  <p>
                    본 계약은 고객과 크루즈닷몰이 체결하는 골드회원 서비스 제공에 관한
                    모든 사항을 규정합니다...
                  </p>
                </div>
                <div>
                  <h4 className="font-bold mb-1">제 2조 개인정보 처리</h4>
                  <p>
                    고객의 개인정보는 별도의 개인정보처리방침에 따라 보호되며, 결제
                    및 서비스 제공 목적으로만 사용됩니다...
                  </p>
                </div>
                <div>
                  <h4 className="font-bold mb-1">제 3조 환불 및 취소</h4>
                  <p>
                    가입 후 7일 이내 전액 환불이 가능합니다. 이후 월 단위로 취소 가능하며,
                    남은 개월 수는 환불되지 않습니다...
                  </p>
                </div>
              </div>

              <label className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                <input
                  type="checkbox"
                  checked={form.agreeTerms}
                  onChange={(e) => setForm({ ...form, agreeTerms: e.target.checked })}
                  className="w-5 h-5 mt-0.5 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm font-semibold text-gray-900">
                  위 약관에 모두 동의하고, 골드회원 가입을 신청합니다.
                </span>
              </label>

              {/* 최종 요약 */}
              <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700">플랜</span>
                  <span className="font-semibold text-gray-900">{plan.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">월 결제액</span>
                  <span className="font-semibold text-blue-600">
                    {plan.monthlyPrice.toLocaleString()}원
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">총 기간</span>
                  <span className="font-semibold text-gray-900">
                    {plan.totalMonths}개월 ({plan.totalPrice.toLocaleString()}원)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">결제 방법</span>
                  <span className="font-semibold text-gray-900">
                    {PAYMENT_METHODS[form.paymentMethod].label}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-700">결제일</span>
                  <span className="font-semibold text-gray-900">매월 {form.paymentDay}일</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 버튼 */}
        <div className="flex gap-3 sm:gap-4">
          <button
            onClick={handleBack}
            disabled={step === "info" || loading}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="hidden sm:inline">이전</span>
          </button>

          {step !== "confirm" ? (
            <button
              onClick={handleNext}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <span className="hidden sm:inline">다음</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading || !form.agreeTerms}
              className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="hidden sm:inline">처리 중...</span>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  <span className="hidden sm:inline">가입하기</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* 하단 안내 */}
        <p className="text-center text-xs sm:text-sm text-gray-600 mt-6">
          문제가 있으신가요? <a href="tel:02-1234-5678" className="text-blue-600 font-semibold hover:underline">고객 지원 전화</a>로 연락주세요.
        </p>
      </div>
    </div>
  );
}
