"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth, SignIn } from "@clerk/nextjs";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { showError } from '@/components/ui/Toast';

// ─── 어필리에이트 판매원 계약서 (법적 효력) ────────────────────
const CONTRACT_SECTIONS = [
  {
    title: "제1조 (계약의 성격 및 당사자)",
    content: "본 계약은 크루즈닷(이하 \"회사\")과 어필리에이트 판매원(이하 \"판매원\") 간의 독립 용역 계약으로, 판매원은 독립 프리랜서(개인사업자)로 활동합니다. 고용관계가 아니며, 4대 보험은 적용되지 않습니다.",
  },
  {
    title: "제2조 (수당 지급 조건)",
    content: "• 수당은 고객의 여행 출발 완료 확인 후 지급됩니다.\n• 프리랜서 계약으로 수당 지급 시 3.3% 원천징수가 적용됩니다.\n• 마지막 정산 수당의 30%는 마지막 지급일로부터 60일 후, 환불·민원 확정 이후 지급됩니다.\n• 판매원 본인·배우자·직계가족 명의 구매에 대한 수당은 지급하지 않습니다.",
  },
  {
    title: "제3조 (환불·Clawback 정책)",
    content: "수당 지급 후 6개월 내 해당 고객 환불 발생 시 수당 전액을 환수합니다. 미지급 수당이 없어 상계가 불가한 경우, 청구일로부터 14일 이내 반환해야 합니다.",
  },
  {
    title: "제4조 (비밀유지 의무)",
    content: "판매원은 업무를 통해 알게 된 고객 DB, 수수료율, 내부 운영 정보 등 회사의 영업비밀을 계약 종료 후 3년간 제3자에게 누설하거나 경쟁 목적으로 사용할 수 없습니다.",
  },
  {
    title: "제5조 (경업금지)",
    content: "판매원은 계약 기간 중 및 종료 후 1년간, 회사와 동종 업종(크루즈·해외여행 판매)에서 경쟁 활동을 할 수 없습니다.",
  },
  {
    title: "제6조 (콘텐츠 무단 사용 금지)",
    content: "회사가 제공한 랜딩페이지, 홍보 자료, 교육 콘텐츠를 무단 복제하거나 타 플랫폼에 사용하는 행위를 금합니다.",
  },
  {
    title: "제7조 (직거래·플랫폼 우회 금지)",
    content: "고객을 회사 시스템 외부로 유도하거나 직거래하는 행위, 플랫폼을 우회하는 행위를 엄격히 금지합니다.",
  },
  {
    title: "제8조 (SNS·공개 발언 제한)",
    content: "회사를 비방하거나 허위 사실을 유포하는 행위를 금합니다. (SNS, 온라인 커뮤니티, 언론 포함. 일시 게시 후 삭제도 위반으로 간주) 불만이 있는 경우 내부 채널을 통해 해결합니다.",
  },
  {
    title: "제9조 (위약벌 — 최대 3,000만원)",
    content: "■ 비밀유지 위반:\n  • 경미한 누설: 위약벌 200만원\n  • 고객 DB·수수료율 유출: 위약벌 1,000만원\n  • 경쟁사 제공 목적 고의 유출: 위약벌 2,000만원\n■ 경업금지 위반: 위약벌 1,000만원\n■ 콘텐츠 무단복제: 위약벌 3,000만원\n■ 직거래·플랫폼 우회: 위반 거래 금액의 20% + 위약벌 500만원\n■ 시스템 침해(해킹·크롤링·DB 무단 접근): 위약벌 3,000만원 + 형사고발\n■ 조직 이탈 유도: 위약벌 1,000만원 + 이탈 1인당 300만원 가중\n실손해액이 위약벌을 초과하는 경우 초과분을 추가 청구할 수 있습니다.",
  },
  {
    title: "제10조 (개인정보 보호)",
    content: "업무 수행 중 취득한 고객 개인정보(이름, 연락처 등)를 허가된 업무 외 목적으로 사용·저장·공유·판매하는 행위를 금하며, 위반 시 개인정보보호법에 따른 민·형사상 책임을 집니다.",
  },
  {
    title: "제11조 (디지털 서명의 법적 효력)",
    content: "본 계약서에 성명을 직접 입력하는 행위는 「전자서명법」에 따른 디지털 서명으로 법적 효력을 가집니다. 판매원은 본 계약서의 모든 조항을 읽고 이해한 후 서명합니다.",
  },
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
  const [signature,     setSignature]     = useState("");     // 디지털 서명 (실명 일치)
  const [agreed,        setAgreed]        = useState(false);
  const [allChecked,    setAllChecked]    = useState(false);  // 전체 동의
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
    if (!agreed || !allChecked || !displayName.trim()) return;
    // 디지털 서명 = 입력한 이름과 일치해야 함
    if (signature.trim() !== displayName.trim()) {
      showError("디지털 서명이 이름과 일치하지 않습니다.");
      return;
    }
    setAccepting(true);
    const res  = await fetch(`/api/join/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, agreedToTerms: true, signature }),
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
          {/* 계약 요약 (로그인 전 간략 표시) */}
          {!isSignedIn && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
              <p className="text-sm font-bold text-amber-800 mb-2">⚠️ 계약 전 필수 확인</p>
              <ul className="space-y-1 text-xs text-amber-900">
                <li>• 수당은 여행 완료 후 지급 (3.3% 원천징수)</li>
                <li>• 고객 DB 무단 사용 시 위약벌 최대 3,000만원</li>
                <li>• 콘텐츠 무단복제 시 위약벌 3,000만원 + 형사고발</li>
                <li>• 로그인 후 전체 계약서 확인 및 서명 필요</li>
              </ul>
            </div>
          )}

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
            <div className="space-y-5">
              {/* 이름 입력 */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">실명 *</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="홍길동 (계약서 서명에 사용됩니다)"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gold-500"
                />
              </div>

              {/* 계약서 본문 */}
              <div>
                <p className="text-sm font-bold text-gray-800 mb-2">📋 어필리에이트 판매원 계약서</p>
                <div className="border border-gray-200 rounded-xl h-56 overflow-y-auto p-4 bg-gray-50 text-xs text-gray-700 space-y-4">
                  {CONTRACT_SECTIONS.map((sec, i) => (
                    <div key={i}>
                      <p className="font-bold text-gray-900 mb-1">{sec.title}</p>
                      <p className="whitespace-pre-line leading-relaxed">{sec.content}</p>
                    </div>
                  ))}
                  <div className="border-t pt-3 text-gray-500">
                    <p>본 계약서는 전자서명 시 법적 효력이 발생합니다.</p>
                    <p>계약 체결일: {new Date().toLocaleDateString("ko-KR")}</p>
                    <p>회사: 크루즈닷 / 파트너: {displayName || "(서명 후 기재)"}</p>
                  </div>
                </div>
              </div>

              {/* 전체 동의 체크 */}
              <label className="flex items-start gap-3 cursor-pointer bg-amber-50 border border-amber-200 rounded-xl p-3">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={(e) => setAllChecked(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-navy-900"
                />
                <span className="text-sm text-amber-900 font-medium">
                  위 계약서 전체 내용을 읽고 이해했으며, 모든 조항에 동의합니다.
                  <br />
                  <span className="text-xs font-normal text-amber-700">위약벌 최대 3,000만원 조항 포함 / 3.3% 원천징수 / 여행 완료 후 수당 지급</span>
                </span>
              </label>

              {/* 디지털 서명 */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  디지털 서명 — 위 실명을 그대로 입력하세요 *
                  <span className="text-xs text-gray-400 ml-1">(전자서명법 적용)</span>
                </label>
                <input
                  value={signature}
                  onChange={(e) => { setSignature(e.target.value); setAgreed(e.target.value.trim() === displayName.trim() && e.target.value.trim() !== ""); }}
                  placeholder={displayName || "홍길동"}
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none font-semibold ${
                    signature && signature.trim() === displayName.trim()
                      ? "border-green-400 bg-green-50 text-green-800"
                      : "border-gray-200 focus:border-gold-500"
                  }`}
                />
                {signature && signature.trim() !== displayName.trim() && (
                  <p className="text-xs text-red-500 mt-1">실명과 일치하지 않습니다.</p>
                )}
                {signature && signature.trim() === displayName.trim() && displayName.trim() && (
                  <p className="text-xs text-green-600 mt-1">✅ 서명 일치 확인</p>
                )}
              </div>

              <button
                onClick={accept}
                disabled={accepting || !agreed || !allChecked || !displayName.trim() || signature.trim() !== displayName.trim()}
                className="w-full bg-navy-900 text-white py-3 rounded-xl font-medium hover:bg-navy-700 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {accepting && <Loader2 className="w-4 h-4 animate-spin" />}
                {accepting ? "처리 중..." : "계약서 서명 완료 — 판매원 등록"}
              </button>
              <p className="text-xs text-center text-gray-400">
                서명 완료 시 본 계약서가 법적 효력을 가집니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
