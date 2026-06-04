"use client";

import { useState, useEffect, useRef, use, Suspense } from "react";
import { useSearchParams } from "next/navigation";

// ─── 타입 정의 ────────────────────────────────────────────────────────────────
type Companion = {
  name: string;
  birthDate: string;
  relation: string;
  phone: string;
};

type DocData = {
  productName?: string;
  buyerName?: string;
  amount?: number;
  departureDate?: string;
  nights?: number;
  paymentMethod?: string;
  paidAt?: string;
  cancellationPolicy?: string[];
  specialTerms?: string;
  companyName?: string;
  signedAt?: string;
  signStatus?: string;
  customerSignedAt?: string;
};

type Step = "loading" | "error" | "contract" | "companions" | "signature" | "done";

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────
function formatKRW(amount: number) {
  return amount.toLocaleString("ko-KR") + "원";
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

// ─── 단계 표시기 ───────────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: number }) {
  const steps = ["계약서 확인", "동행자 입력", "전자서명"];
  return (
    <div className="flex items-center justify-center gap-2 py-4 px-6">
      {steps.map((label, i) => {
        const idx = i + 1;
        const isActive = idx === current;
        const isDone = idx < current;
        return (
          <div key={i} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  isActive
                    ? "bg-[#1a2e4a] text-white"
                    : isDone
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {isDone ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  idx
                )}
              </div>
              <span
                className={`text-xs font-medium ${
                  isActive ? "text-[#1a2e4a]" : isDone ? "text-green-600" : "text-gray-400"
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-8 h-0.5 mb-4 transition-colors ${
                  isDone ? "bg-green-400" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── 메인 콘텐츠 (useSearchParams 사용) ──────────────────────────────────────
function SignPageContent({ params }: { params: Promise<{ docId: string }> }) {
  const { docId } = use(params);
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [step, setStep] = useState<Step>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [isTokenError, setIsTokenError] = useState(false);
  const [docData, setDocData] = useState<DocData | null>(null);

  // 동행자 상태
  const [travelCount, setTravelCount] = useState(1);
  const [soloTravel, setSoloTravel] = useState(false);
  const [companions, setCompanions] = useState<Companion[]>([]);

  // 서명 상태
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completedAt, setCompletedAt] = useState("");

  // P0-3: 이중 제출 방지 ref
  const submitLockRef = useRef(false);

  // P1-5: 드로잉 거리 추적 ref
  const drawnDistanceRef = useRef(0);
  const lastDrawPosRef = useRef<{ x: number; y: number } | null>(null);

  // ── 토큰 검증 (P1-3: AbortController 메모리 누수 방지) ─────────────────────
  useEffect(() => {
    if (!docId || !token) {
      setErrorMsg("유효하지 않은 링크입니다.");
      setIsTokenError(true);
      setStep("error");
      return;
    }
    const controller = new AbortController();
    fetch(`/api/documents/purchase-contract/sign?docId=${docId}&token=${token}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) {
          setErrorMsg(d.message ?? "링크가 유효하지 않거나 만료되었습니다.");
          setIsTokenError(true);
          setStep("error");
          return;
        }
        // P0-1: d.data → d.doc
        setDocData(d.doc as DocData);
        setSignerName(d.doc?.buyerName ?? "");
        // P0-1: d.alreadySigned 로 변경
        if (d.alreadySigned) {
          // P0-1: d.signedAt 으로 변경
          setCompletedAt(d.signedAt ?? "");
          setStep("done");
          return;
        }
        setStep("contract");
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setErrorMsg("서버 연결 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
        setStep("error");
      });
    return () => controller.abort();
  }, [docId, token]);

  // ── 동행자 배열 동기화 (P1-4: 감소 시 기존 데이터 보존) ───────────────────
  useEffect(() => {
    if (soloTravel) {
      setCompanions([]);
      return;
    }
    setCompanions((prev) => {
      const extraCount = Math.max(0, travelCount - 1);
      if (extraCount > prev.length) {
        return [
          ...prev,
          ...Array.from({ length: extraCount - prev.length }, () => ({
            name: "",
            birthDate: "",
            relation: "",
            phone: "",
          })),
        ];
      }
      return prev.slice(0, extraCount);
    });
  }, [travelCount, soloTravel]);

  // ── 캔버스 초기화 (P1-1: Retina DPI + P1-2: ResizeObserver) ───────────────
  useEffect(() => {
    if (step !== "signature") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    function initCanvas() {
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.offsetWidth;
      canvas.width = w * dpr;
      canvas.height = 200 * dpr;
      canvas.style.height = "200px";
      ctx.scale(dpr, dpr);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, 200);
      ctx.strokeStyle = "#1a2e4a";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }

    initCanvas();

    // P1-2: ResizeObserver 캔버스 재초기화
    const ro = new ResizeObserver(() => {
      initCanvas();
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [step]);

  // ── 캔버스 드로잉 ──────────────────────────────────────────────────────────
  // P2-1: touchend changedTouches 사용, null 반환 가능
  function getPos(
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ): { x: number; y: number } | null {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e || "changedTouches" in e) {
      const touch =
        ("touches" in e ? e.touches[0] : null) ??
        ("changedTouches" in e ? (e as React.TouchEvent<HTMLCanvasElement>).changedTouches[0] : null);
      if (!touch) return null;
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: ((e as React.MouseEvent<HTMLCanvasElement>).clientX - rect.left) * scaleX,
      y: ((e as React.MouseEvent<HTMLCanvasElement>).clientY - rect.top) * scaleY,
    };
  }

  function startDraw(
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    setIsDrawing(true);
    const pos = getPos(e, canvas);
    if (!pos) return;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    // P1-5: 드로잉 시작 시 lastPos 초기화
    lastDrawPosRef.current = pos;
  }

  function draw(
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e, canvas);
    if (!pos) return;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    // P1-5: 드로잉 거리 누적
    const dx = pos.x - (lastDrawPosRef.current?.x ?? pos.x);
    const dy = pos.y - (lastDrawPosRef.current?.y ?? pos.y);
    drawnDistanceRef.current += Math.sqrt(dx * dx + dy * dy);
    lastDrawPosRef.current = pos;
    if (drawnDistanceRef.current > 20) setHasSigned(true);
  }

  function endDraw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    setIsDrawing(false);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // P1-5: 거리 및 위치 초기화
    drawnDistanceRef.current = 0;
    lastDrawPosRef.current = null;
    setHasSigned(false);
  }

  // ── 제출 (P0-2, P0-3, P1-6 적용) ─────────────────────────────────────────
  async function handleSubmit() {
    if (!hasSigned || !signerName.trim()) return;

    // P0-3: 이중 제출 방지
    if (submitLockRef.current) return;
    submitLockRef.current = true;

    const canvas = canvasRef.current;
    if (!canvas) {
      submitLockRef.current = false;
      return;
    }

    // P2-5: 서명 이미지 크기 클라이언트 검증
    const signatureImage = canvas.toDataURL("image/png");
    if (signatureImage.length > 500_000) {
      alert("서명 이미지가 너무 큽니다. 지우기 후 다시 서명해 주세요.");
      submitLockRef.current = false;
      return;
    }

    // P1-6: fetch 타임아웃
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    setSubmitting(true);
    try {
      const res = await fetch("/api/documents/purchase-contract/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          docId,
          token,
          companions,
          signatureImage,
          signerName: signerName.trim(),
        }),
      });

      // P0-3: 409 응답 시 done 화면으로
      if (res.status === 409) {
        setCompletedAt(new Date().toISOString());
        setStep("done");
        return;
      }

      const data = await res.json() as { ok: boolean; message?: string; signedAt?: string };
      if (data.ok) {
        // P0-2: signedAt 수신
        setCompletedAt(data.signedAt ?? new Date().toISOString());
        setStep("done");
      } else {
        setErrorMsg(data.message ?? "제출 중 오류가 발생했습니다.");
        setStep("error");
      }
    } catch (err) {
      // P1-6: AbortError → 타임아웃 메시지
      if (err instanceof Error && err.name === "AbortError") {
        setErrorMsg("요청 시간 초과. 잠시 후 다시 시도해 주세요.");
      } else {
        setErrorMsg("서버 연결 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      }
      setStep("error");
    } finally {
      clearTimeout(timeoutId);
      setSubmitting(false);
      submitLockRef.current = false;
    }
  }

  // ── 동행자 필드 유효성 검증 ────────────────────────────────────────────────
  function isCompanionsValid() {
    if (soloTravel || travelCount === 1) return true;
    return companions.every(
      (c) =>
        c.name.trim() &&
        c.birthDate &&
        c.relation &&
        c.phone.replace(/[^0-9]/g, "").length >= 10
    );
  }

  // ── 렌더링 ─────────────────────────────────────────────────────────────────

  // 로딩
  if (step === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#1a2e4a] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-lg">계약서를 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  // 에러 (P2-3: "다시 시도" 버튼, 토큰 오류 시 제외)
  if (step === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-lg">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">링크 오류</h2>
          <p className="text-base text-gray-500 leading-relaxed">{errorMsg}</p>
          {!isTokenError && (
            <button
              onClick={() => {
                setErrorMsg("");
                setStep("signature");
              }}
              className="mt-6 w-full bg-[#1a2e4a] text-white text-base font-bold py-3 rounded-2xl hover:bg-[#243d5e] transition-colors"
            >
              다시 시도
            </button>
          )}
          <p className="text-sm text-gray-400 mt-4">
            문제가 계속되면 담당 에이전트에게 연락해 주세요.
          </p>
        </div>
      </div>
    );
  }

  // 완료
  if (step === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-lg">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">서명이 완료되었습니다!</h2>
          <p className="text-base text-gray-500 mb-4">
            담당 에이전트에게 알림이 전송되었습니다.
          </p>
          {completedAt && (
            <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-600">
              <span className="font-medium">서명 일시:</span>{" "}
              {new Date(completedAt).toLocaleString("ko-KR", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          )}
          <p className="text-sm text-gray-400 mt-6">
            이 창은 닫으셔도 됩니다.
          </p>
        </div>
      </div>
    );
  }

  // ── 메인 레이아웃 ──────────────────────────────────────────────────────────
  const currentStepNum = step === "contract" ? 1 : step === "companions" ? 2 : 3;

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center py-0 sm:py-8">
      <div className="w-full max-w-[640px] bg-white sm:rounded-2xl sm:shadow-xl flex flex-col min-h-screen sm:min-h-0">
        {/* 헤더 */}
        <div className="bg-[#1a2e4a] px-6 py-5 sm:rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#93c5fd] text-sm font-medium tracking-wide">CRUISEDOT</p>
              <h1 className="text-white text-xl font-bold mt-0.5">구매계약서</h1>
            </div>
            <div className="text-right">
              <p className="text-[#93c5fd] text-xs">크루즈닷</p>
              <p className="text-white text-sm font-semibold mt-0.5">
                {docData?.buyerName ?? ""}
              </p>
            </div>
          </div>
        </div>

        {/* 단계 표시기 */}
        <StepIndicator current={currentStepNum} />

        {/* ── 단계 1: 계약서 내용 확인 ── */}
        {step === "contract" && docData && (
          <div className="flex flex-col flex-1 px-5 pb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">계약서 내용을 확인해 주세요</h2>

            {/* 계약 정보 카드 */}
            <div className="bg-[#f0f5ff] rounded-2xl p-5 mb-5 border border-[#c7d9f7]">
              <h3 className="text-base font-bold text-[#1a2e4a] mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                계약 상세
              </h3>
              <div className="space-y-3">
                <InfoRow label="구매자명" value={docData.buyerName ?? "-"} />
                <InfoRow label="상품명" value={docData.productName ?? "-"} highlight />
                {docData.departureDate && (
                  <InfoRow
                    label="출발일"
                    value={`${formatDate(docData.departureDate)}${docData.nights ? ` (${docData.nights}박)` : ""}`}
                  />
                )}
                <InfoRow
                  label="결제금액"
                  value={docData.amount ? formatKRW(docData.amount) : "-"}
                  bold
                  blue
                />
                <InfoRow label="결제방법" value={docData.paymentMethod ?? "-"} />
                {docData.paidAt && (
                  <InfoRow label="결제일시" value={formatDate(docData.paidAt)} />
                )}
              </div>
            </div>

            {/* 취소/환불 규정 (P2-2: 하드코딩 폴백 제거) */}
            <div className="bg-amber-50 rounded-2xl p-5 mb-5 border border-amber-200">
              <h3 className="text-base font-bold text-amber-800 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                취소 / 환불 규정
              </h3>
              <ul className="space-y-2">
                {(Array.isArray(docData.cancellationPolicy) ? docData.cancellationPolicy : []).length > 0
                  ? (Array.isArray(docData.cancellationPolicy) ? docData.cancellationPolicy : []).map((policy, i) => (
                      <li key={i} className="flex items-start gap-2 text-base text-amber-900">
                        <span className="text-amber-500 mt-0.5 flex-shrink-0">•</span>
                        {policy}
                      </li>
                    ))
                  : (
                      <li className="flex items-start gap-2 text-base text-amber-900">
                        <span className="text-amber-500 mt-0.5 flex-shrink-0">•</span>
                        취소/환불 규정은 담당 에이전트에게 문의하세요.
                      </li>
                    )
                }
              </ul>
            </div>

            {/* 특약사항 */}
            {docData.specialTerms && (
              <div className="bg-gray-50 rounded-2xl p-5 mb-5 border border-gray-200">
                <h3 className="text-base font-bold text-gray-700 mb-2">특약사항</h3>
                <p className="text-base text-gray-600 leading-relaxed whitespace-pre-line">
                  {docData.specialTerms}
                </p>
              </div>
            )}

            <div className="mt-auto pt-4">
              <button
                onClick={() => setStep("companions")}
                className="w-full bg-[#1a2e4a] text-white text-lg font-bold py-4 rounded-2xl hover:bg-[#243d5e] transition-colors active:scale-95"
              >
                내용 확인 완료, 다음 →
              </button>
              <p className="text-center text-sm text-gray-400 mt-3">
                위 내용을 충분히 확인하신 후 다음 단계로 진행해 주세요.
              </p>
            </div>
          </div>
        )}

        {/* ── 단계 2: 동행자 정보 입력 ── */}
        {step === "companions" && (
          <div className="flex flex-col flex-1 px-5 pb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">동행자 정보 입력</h2>
            <p className="text-base text-gray-500 mb-6">
              여행자 여권 정보 등록에 필요합니다.
            </p>

            {/* 혼자 여행 체크박스 */}
            <label className="flex items-center gap-3 bg-gray-50 rounded-2xl p-4 mb-5 cursor-pointer border-2 border-transparent checked:border-[#1a2e4a]">
              <input
                type="checkbox"
                checked={soloTravel}
                onChange={(e) => {
                  setSoloTravel(e.target.checked);
                  if (e.target.checked) setTravelCount(1);
                }}
                className="w-5 h-5 accent-[#1a2e4a] flex-shrink-0"
              />
              <span className="text-base font-medium text-gray-700">
                혼자 여행합니다 (동행자 없음)
              </span>
            </label>

            {!soloTravel && (
              <>
                {/* 인원 선택 */}
                <div className="mb-6">
                  <label className="text-base font-bold text-gray-800 mb-3 block">
                    나 포함 총 몇 명이 여행하시나요?
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        onClick={() => setTravelCount(n)}
                        className={`w-12 h-12 rounded-xl text-base font-bold transition-colors ${
                          travelCount === n
                            ? "bg-[#1a2e4a] text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-gray-400 mt-2">
                    구매자 본인(1명)은 자동 포함됩니다.
                  </p>
                </div>

                {/* 동행자 카드 */}
                {companions.length > 0 && (
                  <div className="space-y-4 mb-4">
                    {companions.map((companion, i) => (
                      <div
                        key={i}
                        className="bg-gray-50 rounded-2xl p-5 border border-gray-200"
                      >
                        <h4 className="text-base font-bold text-[#1a2e4a] mb-4">
                          동행자 {i + 1}
                        </h4>
                        <div className="space-y-4">
                          {/* 이름 */}
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                              이름 <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={companion.name}
                              onChange={(e) => {
                                const next = [...companions];
                                next[i] = { ...next[i]!, name: e.target.value };
                                setCompanions(next);
                              }}
                              placeholder="홍길동"
                              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#1a2e4a]"
                            />
                          </div>
                          {/* 생년월일 */}
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                              생년월일 <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="date"
                              value={companion.birthDate}
                              onChange={(e) => {
                                const next = [...companions];
                                next[i] = { ...next[i]!, birthDate: e.target.value };
                                setCompanions(next);
                              }}
                              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#1a2e4a]"
                            />
                          </div>
                          {/* 관계 */}
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                              관계 <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={companion.relation}
                              onChange={(e) => {
                                const next = [...companions];
                                next[i] = { ...next[i]!, relation: e.target.value };
                                setCompanions(next);
                              }}
                              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#1a2e4a] bg-white"
                            >
                              <option value="">선택하세요</option>
                              <option value="배우자">배우자</option>
                              <option value="자녀">자녀</option>
                              <option value="부모">부모</option>
                              <option value="형제자매">형제자매</option>
                              <option value="친구">친구</option>
                              <option value="기타">기타</option>
                            </select>
                          </div>
                          {/* 연락처 */}
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                              연락처 <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="tel"
                              inputMode="numeric"
                              value={companion.phone}
                              onChange={(e) => {
                                const cleaned = e.target.value.replace(/[^0-9]/g, "");
                                const next = [...companions];
                                next[i] = { ...next[i]!, phone: cleaned };
                                setCompanions(next);
                              }}
                              placeholder="01012345678"
                              maxLength={11}
                              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#1a2e4a]"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <div className="mt-auto pt-4">
              <button
                onClick={() => setStep("signature")}
                disabled={!isCompanionsValid()}
                className="w-full bg-[#1a2e4a] text-white text-lg font-bold py-4 rounded-2xl hover:bg-[#243d5e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              >
                다음 →
              </button>
              <button
                onClick={() => setStep("contract")}
                className="w-full text-gray-500 text-base py-3 mt-2 hover:text-gray-700 transition-colors"
              >
                ← 이전으로
              </button>
            </div>
          </div>
        )}

        {/* ── 단계 3: 전자서명 ── */}
        {step === "signature" && (
          <div className="flex flex-col flex-1 px-5 pb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">계약서에 서명해 주세요</h2>
            <p className="text-base text-gray-500 mb-6">
              아래 영역에 본인의 서명을 해주세요
            </p>

            {/* 서명 캔버스 */}
            <div className="mb-6">
              <div className="border-2 border-[#1a2e4a] rounded-2xl overflow-hidden bg-white relative">
                <canvas
                  ref={canvasRef}
                  className="w-full touch-none cursor-crosshair block"
                  style={{ height: "200px" }}
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={endDraw}
                />
                {!hasSigned && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-gray-300 text-base">여기에 서명하세요</p>
                  </div>
                )}
              </div>
              <div className="flex justify-end mt-2">
                <button
                  onClick={clearCanvas}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  지우기
                </button>
              </div>
            </div>

            {/* 서명자 이름 확인 */}
            <div className="mb-8">
              <label className="text-base font-bold text-gray-800 mb-2 block">
                서명자 성함 확인{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder={docData?.buyerName ?? "구매자 성함"}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#1a2e4a]"
              />
            </div>

            {/* 법적 안내 */}
            <div className="bg-blue-50 rounded-2xl p-4 mb-6 border border-blue-100">
              <p className="text-sm text-blue-800 leading-relaxed">
                위 서명은 「전자서명법」에 따른 전자서명으로, 본 구매계약서에 법적 효력을 가집니다.
                서명 완료 후에는 수정이 불가합니다.
              </p>
            </div>

            <div className="mt-auto">
              <button
                onClick={handleSubmit}
                disabled={!hasSigned || !signerName.trim() || submitting}
                className="w-full bg-[#1a2e4a] text-white text-lg font-bold py-4 rounded-2xl hover:bg-[#243d5e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 flex items-center justify-center gap-2"
              >
                {submitting && (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {submitting ? "처리 중..." : "서명 완료 및 제출"}
              </button>
              <button
                onClick={() => setStep("companions")}
                disabled={submitting}
                className="w-full text-gray-500 text-base py-3 mt-2 hover:text-gray-700 transition-colors disabled:opacity-40"
              >
                ← 이전으로
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 정보 행 컴포넌트 ───────────────────────────────────────────────────────────
function InfoRow({
  label,
  value,
  highlight,
  bold,
  blue,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  bold?: boolean;
  blue?: boolean;
}) {
  return (
    <div className={`flex justify-between items-start gap-4 py-2 border-b border-[#dce8f7] last:border-0 ${highlight ? "bg-[#e8f0fe] -mx-2 px-2 rounded-lg" : ""}`}>
      <span className="text-sm text-gray-500 flex-shrink-0 mt-0.5">{label}</span>
      <span
        className={`text-base text-right leading-relaxed ${
          bold ? "font-bold" : "font-medium"
        } ${blue ? "text-[#2b6cb0]" : "text-gray-900"}`}
      >
        {value}
      </span>
    </div>
  );
}

// ─── 페이지 진입점 (Suspense 래퍼) ───────────────────────────────────────────
export default function ContractSignPage({
  params,
}: {
  params: Promise<{ docId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-[#1a2e4a] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500 text-lg">로딩 중...</p>
          </div>
        </div>
      }
    >
      <SignPageContent params={params} />
    </Suspense>
  );
}
