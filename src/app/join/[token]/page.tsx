"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth, SignIn } from "@clerk/nextjs";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";

// 수당 조건 (법적 조항)
const TERMS = [
  "판매 수당은 해당 여행 완료 후 지급됩니다.",
  "프리랜서 계약으로, 수당 지급 시 3.3% 원천징수가 적용됩니다.",
  "수당 계산 기준: 고객 결제 완료 + 여행 출발 완료 확인 후",
  "고객 개인정보(실명, 연락처)는 본인에게 노출되지 않습니다.",
  "판매 성과(상품명, 금액)는 조회 가능합니다.",
];

export default function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router    = useRouter();
  const { isSignedIn, userId } = useAuth();

  const [step,          setStep]          = useState<"loading" | "info" | "signin" | "accept" | "done" | "error">("loading");
  const [orgName,       setOrgName]       = useState("");
  const [note,          setNote]          = useState("");
  const [errorMsg,      setErrorMsg]      = useState("");
  const [displayName,   setDisplayName]   = useState("");
  const [agreed,        setAgreed]        = useState(false);
  const [accepting,     setAccepting]     = useState(false);

  useEffect(() => {
    fetch(`/api/join/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) { setErrorMsg(d.message ?? "유효하지 않은 초대입니다."); setStep("error"); return; }
        setOrgName(d.orgName);
        setNote(d.note ?? "");
        setStep(isSignedIn ? "accept" : "info");
      })
      .catch(() => { setErrorMsg("오류가 발생했습니다."); setStep("error"); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // 로그인 후 accept 단계로
  useEffect(() => {
    if (isSignedIn && step === "signin") setStep("accept");
    if (isSignedIn && step === "info")   setStep("accept");
  }, [isSignedIn, step]);

  const accept = async () => {
    if (!agreed || !displayName.trim()) return;
    setAccepting(true);
    const res  = await fetch(`/api/join/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, agreedToTerms: true }),
    });
    const data = await res.json();
    setAccepting(false);
    if (data.ok) {
      setStep("done");
      setTimeout(() => router.push("/dashboard"), 2500);
    } else {
      setErrorMsg(data.message ?? "가입 실패");
      setStep("error");
    }
  };

  // 로딩
  if (step === "loading") return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
    </div>
  );

  // 에러
  if (step === "error") return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-lg">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="font-bold text-gray-900 mb-2">초대 링크 오류</p>
        <p className="text-sm text-gray-500">{errorMsg}</p>
      </div>
    </div>
  );

  // 완료
  if (step === "done") return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-lg">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <p className="font-bold text-gray-900 mb-2">가입 완료!</p>
        <p className="text-sm text-gray-500">{orgName} 판매원으로 등록됐습니다.<br />대시보드로 이동합니다...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-navy-900 to-navy-800 flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="bg-navy-900 px-6 py-5 text-center">
          <p className="text-2xl mb-1">🚢</p>
          <h1 className="text-lg font-bold text-white">크루즈닷 판매원 초대</h1>
          <p className="text-sm text-navy-200 mt-1">{orgName}</p>
          {note && <p className="text-xs text-navy-300 mt-0.5">{note}</p>}
        </div>

        <div className="p-6">
          {/* 수당 조건 동의서 */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
            <p className="text-sm font-bold text-amber-800 mb-3">📋 판매원 수당 조건 확인</p>
            <ul className="space-y-1.5">
              {TERMS.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-amber-900">
                  <span className="text-amber-500 font-bold shrink-0 mt-0.5">•</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* 로그인 단계 */}
          {(step === "info" || step === "signin") && !isSignedIn && (
            <div className="space-y-4">
              <p className="text-sm text-center text-gray-600">
                가입을 완료하려면 로그인/회원가입이 필요합니다.
              </p>
              <SignIn
                appearance={{ elements: { rootBox: "w-full", card: "shadow-none border-0 p-0" } }}
                fallbackRedirectUrl={`/join/${token}`}
              />
            </div>
          )}

          {/* 수락 단계 */}
          {step === "accept" && isSignedIn && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  표시 이름 (이름 또는 닉네임) *
                </label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="홍길동"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gold-500"
                />
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-navy-900"
                />
                <span className="text-sm text-gray-700">
                  위 수당 조건을 모두 확인했으며, 동의합니다.
                  <br />
                  <span className="text-xs text-gray-400">(여행 완료 후 지급 / 3.3% 원천징수 적용)</span>
                </span>
              </label>

              <button
                onClick={accept}
                disabled={accepting || !agreed || !displayName.trim()}
                className="w-full bg-navy-900 text-white py-3 rounded-xl font-medium hover:bg-navy-700 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {accepting && <Loader2 className="w-4 h-4 animate-spin" />}
                {accepting ? "처리 중..." : "동의하고 판매원 등록 완료"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
