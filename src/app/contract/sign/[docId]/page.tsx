"use client";

import { useState, useEffect, useRef, use, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ContractBody, {
  type ContractBodyData,
  type ContractBodyCompanion,
  type SignatureMap,
  type SignaturePointId,
} from "@/app/(dashboard)/documents-approval/_components/ContractBody";

// ─── 타입 정의 ────────────────────────────────────────────────────────────────
type Companion = {
  name: string;
  birthDate: string;
  relation: string;
  phone: string;
};

type InputField = {
  id: string;
  label: string;
  type: "text" | "email" | "phone" | "date" | "select" | "number";
  required: boolean;
  placeholder?: string;
  pattern?: string;
  options?: Array<{ label: string; value: string }>;
};

// GET 응답 doc (SPEC 화이트리스트 + ContractBody 가 쓰는 동적 필드)
type SignDocResponse = {
  id?: string;
  buyerName?: string | null;
  buyerTel?: string | null;
  agentName?: string | null;
  productName?: string | null;
  amount?: number | null;
  departureDate?: string | null;
  nights?: number | null;
  includedItems?: string[];
  excludedItems?: string[];
  hasGuide?: "Y" | "N" | "";
  refundPolicy?: { label: string; value: string }[] | null;
  refundPolicyLines?: { label: string; value: string }[] | null;
  specialTerms?: string | null;
  contractDetails?: Record<string, unknown> | null;
  companions?: ContractBodyCompanion[];
  signatures?: SignatureMap;
  marketingConsent?: boolean;
  signStatus?: string;
};

type Step = "loading" | "error" | "contract" | "info" | "companions" | "signature" | "done";

// ─── 서명점 (순차 서명: 필수 5개 + 선택 마케팅) ────────────────────────────────
const REQUIRED_POINTS: SignaturePointId[] = [
  "privacy_collect",
  "privacy_3rd",
  "terms_handover",
  "special_terms_ack",
  "main",
];
const POINT_LABELS: Record<SignaturePointId, string> = {
  privacy_collect: "개인정보 수집·이용 동의 (필수)",
  privacy_3rd: "개인정보 제3자 제공 동의 (필수)",
  privacy_mkt: "마케팅 활용 동의 (선택)",
  terms_handover: "여행약관 교부 확인",
  special_terms_ack: "크루즈 특별약관 교부 확인",
  main: "계약 전체 대표 서명",
  vendor_seal: "여행업자",
};
// 개인정보 필수 2개는 체크 없이 다음 불가
const REQUIRE_CHECK = new Set<SignaturePointId>(["privacy_collect", "privacy_3rd"]);

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────
function buildBodyData(doc: SignDocResponse | null): ContractBodyData {
  if (!doc) return {};
  // GET 응답은 includedItems/excludedItems/hasGuide 를 contractDetails 안에 담아 내려준다(SPEC 화이트리스트).
  // ContractBody 는 이 3개를 data 최상위에서 읽으므로, 최상위에 없으면 contractDetails 에서 끌어올린다.
  const cd = (doc.contractDetails ?? {}) as Record<string, unknown>;
  const cdArr = (k: string): string[] | undefined =>
    Array.isArray(cd[k]) ? (cd[k] as string[]) : undefined;
  const cdGuide: "Y" | "N" | undefined =
    cd.hasGuide === "Y" || cd.hasGuide === "N" ? cd.hasGuide : undefined;
  return {
    buyerName: doc.buyerName ?? null,
    buyerTel: doc.buyerTel ?? null,
    productName: doc.productName ?? null,
    amount: doc.amount ?? null,
    departureDate: doc.departureDate ?? null,
    nights: doc.nights ?? null,
    includedItems: doc.includedItems ?? cdArr("includedItems"),
    excludedItems: doc.excludedItems ?? cdArr("excludedItems"),
    hasGuide: doc.hasGuide ?? cdGuide,
    refundPolicy: doc.refundPolicy ?? undefined,
    refundPolicyLines: doc.refundPolicyLines ?? undefined,
    specialTerms: doc.specialTerms ?? null,
    companions: doc.companions,
    contractDetails: (doc.contractDetails ?? undefined) as ContractBodyData["contractDetails"],
  };
}

// ─── 단계 표시기 ───────────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: number }) {
  const steps = ["계약서 확인", "내 정보", "동행자", "전자서명"];
  return (
    <div className="flex items-center justify-center gap-2 py-4 px-4">
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
              <div className={`w-6 h-0.5 mb-4 transition-colors ${isDone ? "bg-green-400" : "bg-gray-200"}`} />
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

  // 계약서 본문 데이터 + 담당자(스냅샷)
  const [docData, setDocData] = useState<SignDocResponse | null>(null);
  const [agentName, setAgentName] = useState<string | null>(null);

  // 내 정보 입력 (inputFields)
  const [inputFields, setInputFields] = useState<InputField[]>([]);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  // 동행자 상태
  const [travelCount, setTravelCount] = useState(1);
  const [soloTravel, setSoloTravel] = useState(false);
  const [companions, setCompanions] = useState<Companion[]>([]);

  // 서명 상태 (순차)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [currentSignIndex, setCurrentSignIndex] = useState(0); // 0..REQUIRED_POINTS.length
  const [signatures, setSignatures] = useState<SignatureMap>({});
  const [agreedMap, setAgreedMap] = useState<Partial<Record<SignaturePointId, boolean>>>({});
  const [mktChoice, setMktChoice] = useState<null | "sign" | "skip">(null);
  const [submittedSignatures, setSubmittedSignatures] = useState<SignatureMap | null>(null);
  const [marketingConsent, setMarketingConsent] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [completedAt, setCompletedAt] = useState("");
  // 서명완료 후 공개 PDF 다운로드 토큰(서버가 발급) — signToken은 서명 시 무효화되므로 별도 사용
  const [pdfToken, setPdfToken] = useState("");

  // 이중 제출 방지 ref
  const submitLockRef = useRef(false);
  // 드로잉 거리 추적 ref
  const drawnDistanceRef = useRef(0);
  const lastDrawPosRef = useRef<{ x: number; y: number } | null>(null);
  // 네트워크 오류 재시도 카운터
  const [retryCount, setRetryCount] = useState(0);

  const inMktPhase = currentSignIndex >= REQUIRED_POINTS.length;
  const activePoint: SignaturePointId | null = inMktPhase
    ? (mktChoice === "sign" ? "privacy_mkt" : null)
    : (REQUIRED_POINTS[currentSignIndex] ?? null);
  const signerName = (inputValues["signerName"] ?? docData?.buyerName ?? "").toString().trim();
  // 서명 캔버스가 화면에 떠 있는 단계인가
  const canvasVisible = step === "signature" && (!inMktPhase || mktChoice === "sign");

  // ── 토큰 검증 + 계약서 로드 ───────────────────────────────────────────────
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

        const doc: SignDocResponse | null = (d.doc as SignDocResponse) ?? null;
        setDocData(doc);
        setAgentName(doc?.agentName ?? null);

        // 내 정보 입력 필드 + 기본값(Contact 자동 채우기)
        const fields: InputField[] = Array.isArray(d.inputFields) ? (d.inputFields as InputField[]) : [];
        setInputFields(fields);
        const defaults = (d.inputFieldDefaults ?? null) as Record<string, unknown> | null;
        const initVals: Record<string, string> = {};
        fields.forEach((f) => {
          const v = defaults?.[f.id];
          initVals[f.id] = v != null ? String(v) : "";
        });
        if (!initVals["signerName"] && doc?.buyerName) initVals["signerName"] = doc.buyerName;
        setInputValues(initVals);

        // 기존 동행자 복원(있으면)
        if (Array.isArray(doc?.companions) && doc.companions.length > 0) {
          const restored = doc.companions.map((c) => ({
            name: c.name ?? "",
            birthDate: c.birthDate ?? "",
            relation: c.relation ?? "",
            phone: c.phone ?? "",
          }));
          setCompanions(restored);
          setTravelCount(restored.length + 1);
        }

        if (d.alreadySigned) {
          setCompletedAt(d.signedAt ?? "");
          setSubmittedSignatures(doc?.signatures ?? null);
          setMarketingConsent(!!doc?.marketingConsent);
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
  }, [docId, token, retryCount]);

  // ── 동행자 배열 동기화 (감소 시 기존 데이터 보존) ─────────────────────────
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

  // ── 캔버스 초기화 (Retina DPI + ResizeObserver) ───────────────────────────
  useEffect(() => {
    if (!canvasVisible) return;
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
    // 단계/서명점 전환 시 새 빈 캔버스로 시작
    drawnDistanceRef.current = 0;
    lastDrawPosRef.current = null;

    const ro = new ResizeObserver(() => initCanvas());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [canvasVisible, currentSignIndex, mktChoice]);

  // ── 캔버스 드로잉 ──────────────────────────────────────────────────────────
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

  function startDraw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
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
    lastDrawPosRef.current = pos;
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
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
    drawnDistanceRef.current = 0;
    lastDrawPosRef.current = null;
    setHasSigned(false);
  }

  // 현재 캔버스 서명 이미지 캡처 (크기 검증 포함)
  function captureSignature(): string | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const img = canvas.toDataURL("image/png");
    if (img.length > 500_000) {
      alert("서명 이미지가 너무 큽니다. 지우기 후 다시 서명해 주세요.");
      return null;
    }
    return img;
  }

  // ── 해당 약관 위치로 스크롤 ────────────────────────────────────────────────
  function scrollToClause(pointId: SignaturePointId | null) {
    if (!pointId || typeof document === "undefined") return;
    document.getElementById(`sign-point-${pointId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // 서명 슬롯 클릭 → 해당 서명점으로 이동
  function jumpToPoint(pointId: SignaturePointId) {
    if (pointId === "privacy_mkt") {
      setCurrentSignIndex(REQUIRED_POINTS.length);
      setMktChoice("sign");
    } else {
      const idx = REQUIRED_POINTS.indexOf(pointId);
      if (idx >= 0) {
        setCurrentSignIndex(idx);
        setMktChoice(null);
      }
    }
    setHasSigned(false);
  }

  // ── 필수 서명점 진행 ──────────────────────────────────────────────────────
  function advanceRequired() {
    const point = REQUIRED_POINTS[currentSignIndex];
    if (!point || !hasSigned) return;
    if (REQUIRE_CHECK.has(point) && !agreedMap[point]) return;
    const img = captureSignature();
    if (!img) return;
    setSignatures((prev) => ({
      ...prev,
      [point]: {
        role: "TRAVELER",
        image: img,
        signedByName: signerName,
        signedAt: new Date().toISOString(),
        agreed: REQUIRE_CHECK.has(point) ? !!agreedMap[point] : true,
      },
    }));
    setHasSigned(false);
    drawnDistanceRef.current = 0;
    lastDrawPosRef.current = null;
    setCurrentSignIndex((i) => i + 1);
  }

  // ── 마케팅 동의: 서명 후 제출 ──────────────────────────────────────────────
  function handleMktSignAndSubmit() {
    if (!hasSigned) return;
    const img = captureSignature();
    if (!img) return;
    const finalSigs: SignatureMap = {
      ...signatures,
      privacy_mkt: {
        role: "TRAVELER",
        image: img,
        signedByName: signerName,
        signedAt: new Date().toISOString(),
        agreed: true,
      },
    };
    void doSubmit(finalSigs, true);
  }

  // ── 제출 ───────────────────────────────────────────────────────────────────
  async function doSubmit(finalSignatures: SignatureMap, mkt: boolean) {
    if (submitLockRef.current) return;
    const mainImage = finalSignatures.main?.image;
    if (!mainImage) {
      setErrorMsg("대표 서명이 필요합니다. 다시 시도해 주세요.");
      setStep("error");
      return;
    }
    if (!signerName) {
      setErrorMsg("서명자 성함이 필요합니다.");
      setStep("error");
      return;
    }
    submitLockRef.current = true;

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
          signatures: finalSignatures,
          marketingConsent: mkt,
          signerName,
          inputValues,
          // 하위호환: 기존 PDF/Drive/완료판정이 쓰는 단일 main 서명 이미지
          signatureImage: mainImage,
        }),
      });

      if (res.status === 409) {
        setCompletedAt(new Date().toISOString());
        setSubmittedSignatures(finalSignatures);
        setMarketingConsent(mkt);
        setStep("done");
        return;
      }

      const data = (await res.json()) as { ok: boolean; message?: string; signedAt?: string; pdfDownloadToken?: string };
      if (data.ok) {
        setCompletedAt(data.signedAt ?? new Date().toISOString());
        setSubmittedSignatures(finalSignatures);
        setMarketingConsent(mkt);
        if (data.pdfDownloadToken) setPdfToken(data.pdfDownloadToken);
        setStep("done");
      } else {
        setErrorMsg(data.message ?? "제출 중 오류가 발생했습니다.");
        setStep("error");
      }
    } catch (err) {
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

  // ── 유효성 ─────────────────────────────────────────────────────────────────
  function isInfoValid() {
    return inputFields.every(
      (f) => !f.required || (inputValues[f.id] ?? "").toString().trim() !== ""
    );
  }
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

  const bodyData = buildBodyData(docData);

  // ── 렌더링: 로딩 ───────────────────────────────────────────────────────────
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

  // ── 렌더링: 에러 ───────────────────────────────────────────────────────────
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
                setIsTokenError(false);
                submitLockRef.current = false;
                setStep("loading");
                setRetryCount((c) => c + 1);
              }}
              className="mt-6 w-full bg-[#1a2e4a] text-white text-base font-bold py-3 rounded-2xl hover:bg-[#243d5e] transition-colors"
            >
              다시 시도
            </button>
          )}
          <p className="text-sm text-gray-400 mt-4">문제가 계속되면 담당자에게 연락해 주세요.</p>
        </div>
      </div>
    );
  }

  // ── 렌더링: 완료 ───────────────────────────────────────────────────────────
  if (step === "done") {
    const doneSignatures = submittedSignatures ?? docData?.signatures ?? undefined;
    return (
      <div className="min-h-screen bg-gray-100 flex justify-center py-0 sm:py-8">
        <div className="w-full max-w-[640px] bg-white sm:rounded-2xl sm:shadow-xl flex flex-col min-h-screen sm:min-h-0">
          <div className="px-5 pt-8 pb-6 text-center">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">서명이 완료되었습니다!</h2>
            <p className="text-base text-gray-500 mb-2">담당자에게 알림이 전송되었습니다.</p>
            <p className="text-sm text-blue-600 bg-blue-50 rounded-xl px-4 py-2 mb-4">
              입력하신 이메일로 계약서 사본이 발송됩니다 (수분 내 수신).
            </p>
            {completedAt && (
              <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-600 mb-4">
                <span className="font-medium">서명 일시:</span>{" "}
                {new Date(completedAt).toLocaleString("ko-KR", {
                  year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
                })}
              </div>
            )}
            {pdfToken ? (
              <button
                onClick={() =>
                  window.open(`/api/documents/${docId}/contract-pdf?token=${encodeURIComponent(pdfToken)}`, "_blank", "noopener,noreferrer")
                }
                className="w-full bg-[#1a2e4a] text-white text-lg font-bold py-4 rounded-2xl hover:bg-[#243d5e] transition-colors active:scale-95"
              >
                계약서 PDF 다운받기
              </button>
            ) : (
              <p className="text-sm text-gray-500 bg-gray-50 rounded-xl px-4 py-3">
                계약서 사본은 입력하신 이메일로 발송됩니다.
              </p>
            )}
          </div>

          {/* 서명 완료된 계약서 본문 재표시 */}
          {docData && (
            <div className="px-3 pb-8">
              <p className="mb-2 px-2 text-sm font-semibold text-gray-700">내 계약서</p>
              <ContractBody data={bodyData} agentName={agentName} signatures={doneSignatures} mode="preview" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── 메인 레이아웃 ──────────────────────────────────────────────────────────
  const currentStepNum = step === "contract" ? 1 : step === "info" ? 2 : step === "companions" ? 3 : 4;

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center py-0 sm:py-8">
      <div className="w-full max-w-[680px] bg-white sm:rounded-2xl sm:shadow-xl flex flex-col min-h-screen sm:min-h-0">
        {/* 헤더 */}
        <div className="bg-[#1a2e4a] px-6 py-5 sm:rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#93c5fd] text-sm font-medium tracking-wide">CRUISEDOT</p>
              <h1 className="text-white text-xl font-bold mt-0.5">구매계약서</h1>
            </div>
            <div className="text-right">
              <p className="text-[#93c5fd] text-xs">크루즈닷</p>
              <p className="text-white text-sm font-semibold mt-0.5">{docData?.buyerName ?? ""}</p>
            </div>
          </div>
        </div>

        {/* 단계 표시기 */}
        <StepIndicator current={currentStepNum} />

        {/* ── 단계 1: 계약서 전체 확인 ── */}
        {step === "contract" && (
          <div className="flex flex-col flex-1 px-3 pb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1 px-2">계약서 내용을 확인해 주세요</h2>
            <p className="text-base text-gray-500 mb-4 px-2">
              아래 계약서 전체 내용을 천천히 읽어보신 뒤 다음으로 진행해 주세요.
            </p>
            <div className="max-h-[60vh] overflow-y-auto rounded-2xl border border-gray-100">
              <ContractBody data={bodyData} agentName={agentName} mode="sign" />
            </div>
            <div className="mt-4 px-1">
              <button
                onClick={() => setStep("info")}
                className="w-full bg-[#1a2e4a] text-white text-lg font-bold py-4 rounded-2xl hover:bg-[#243d5e] transition-colors active:scale-95"
              >
                내용 확인 완료, 다음 →
              </button>
            </div>
          </div>
        )}

        {/* ── 단계 2: 내 정보 입력 ── */}
        {step === "info" && (
          <div className="flex flex-col flex-1 px-5 pb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">내 정보를 입력해 주세요</h2>
            <p className="text-base text-gray-500 mb-6">계약서에 들어갈 계약자 정보입니다.</p>

            <div className="space-y-4">
              {inputFields.map((f) => (
                <div key={f.id}>
                  <label className="text-base font-bold text-gray-800 mb-1.5 block">
                    {f.label} {f.required && <span className="text-red-500">*</span>}
                  </label>
                  {f.type === "select" && f.options ? (
                    <select
                      value={inputValues[f.id] ?? ""}
                      onChange={(e) => setInputValues((v) => ({ ...v, [f.id]: e.target.value }))}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#1a2e4a] bg-white"
                    >
                      <option value="">선택하세요</option>
                      {f.options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.type === "phone" ? "tel" : f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "email" ? "email" : "text"}
                      inputMode={f.type === "phone" ? "tel" : undefined}
                      value={inputValues[f.id] ?? ""}
                      onChange={(e) => setInputValues((v) => ({ ...v, [f.id]: e.target.value }))}
                      placeholder={f.placeholder ?? ""}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#1a2e4a]"
                    />
                  )}
                </div>
              ))}
              {inputFields.length === 0 && (
                <p className="text-base text-gray-400">추가로 입력할 정보가 없습니다. 다음으로 진행해 주세요.</p>
              )}
            </div>

            <div className="mt-auto pt-6">
              <button
                onClick={() => setStep("companions")}
                disabled={!isInfoValid()}
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

        {/* ── 단계 3: 동행자 정보 입력 ── */}
        {step === "companions" && (
          <div className="flex flex-col flex-1 px-5 pb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">동행자 정보 입력</h2>
            <p className="text-base text-gray-500 mb-6">여행자 여권 정보 등록에 필요합니다.</p>

            <label className="flex items-center gap-3 bg-gray-50 rounded-2xl p-4 mb-5 cursor-pointer border-2 border-transparent">
              <input
                type="checkbox"
                checked={soloTravel}
                onChange={(e) => {
                  setSoloTravel(e.target.checked);
                  if (e.target.checked) setTravelCount(1);
                }}
                className="w-5 h-5 accent-[#1a2e4a] flex-shrink-0"
              />
              <span className="text-base font-medium text-gray-700">혼자 여행합니다 (동행자 없음)</span>
            </label>

            {!soloTravel && (
              <>
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
                          travelCount === n ? "bg-[#1a2e4a] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-gray-400 mt-2">구매자 본인(1명)은 자동 포함됩니다.</p>
                </div>

                {companions.length > 0 && (
                  <div className="space-y-4 mb-4">
                    {companions.map((companion, i) => (
                      <div key={i} className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
                        <h4 className="text-base font-bold text-[#1a2e4a] mb-4">동행자 {i + 1}</h4>
                        <div className="space-y-4">
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
                onClick={() => setStep("info")}
                className="w-full text-gray-500 text-base py-3 mt-2 hover:text-gray-700 transition-colors"
              >
                ← 이전으로
              </button>
            </div>
          </div>
        )}

        {/* ── 단계 4: 전자서명 (순차) ── */}
        {step === "signature" && (
          <div className="flex flex-col flex-1 px-3 pb-6">
            {/* 진행 카운터 */}
            <div className="px-2 mb-3 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">전자서명</h2>
              {!inMktPhase && (
                <span className="rounded-full bg-[#1a2e4a] px-3 py-1 text-sm font-bold text-white">
                  서명 {currentSignIndex + 1} / {REQUIRED_POINTS.length}
                </span>
              )}
            </div>

            {/* 서명 카드 (필수 서명점) */}
            {!inMktPhase && activePoint && (
              <div className="mx-1 mb-5 rounded-2xl border-2 border-[#1a2e4a] bg-[#f0f5ff] p-4">
                <p className="text-lg font-bold text-[#1a2e4a] mb-1">
                  {currentSignIndex + 1}. {POINT_LABELS[activePoint]}
                </p>
                <p className="text-sm text-gray-600 mb-3">
                  아래 약관 내용을 확인하시고, 동의 후 서명해 주세요.
                </p>

                <button
                  type="button"
                  onClick={() => scrollToClause(activePoint)}
                  className="mb-3 w-full rounded-xl border-2 border-[#1a2e4a] bg-white py-2.5 text-base font-bold text-[#1a2e4a] hover:bg-blue-50"
                >
                  📄 이 약관 내용 보기
                </button>

                {/* 동의 체크박스 (개인정보 필수 2개) */}
                {REQUIRE_CHECK.has(activePoint) && (
                  <label className="mb-3 flex items-center gap-3 rounded-xl bg-white p-3 cursor-pointer border-2 border-gray-200">
                    <input
                      type="checkbox"
                      checked={!!agreedMap[activePoint]}
                      onChange={(e) => setAgreedMap((m) => ({ ...m, [activePoint]: e.target.checked }))}
                      className="w-5 h-5 accent-[#1a2e4a] flex-shrink-0"
                    />
                    <span className="text-base font-medium text-gray-700">
                      위 내용을 확인하였으며 동의합니다.
                    </span>
                  </label>
                )}

                {/* 서명 캔버스 */}
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
                    지우기
                  </button>
                </div>

                <button
                  onClick={advanceRequired}
                  disabled={!hasSigned || (REQUIRE_CHECK.has(activePoint) && !agreedMap[activePoint])}
                  className="mt-3 w-full bg-[#1a2e4a] text-white text-lg font-bold py-4 rounded-2xl hover:bg-[#243d5e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                >
                  {currentSignIndex + 1 < REQUIRED_POINTS.length ? "다음 서명 →" : "다음 (마지막 단계) →"}
                </button>
              </div>
            )}

            {/* 마케팅 동의 (선택) */}
            {inMktPhase && (
              <div className="mx-1 mb-5 rounded-2xl border-2 border-gray-300 bg-gray-50 p-4">
                <p className="text-lg font-bold text-gray-800 mb-1">마케팅 활용 동의 (선택)</p>
                <p className="text-sm text-gray-600 mb-3">
                  할인·신규 일정 등 소식을 받아보시려면 동의 후 서명해 주세요. 동의하지 않아도 계약은 정상 진행됩니다.
                </p>

                {mktChoice !== "sign" ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => { setMktChoice("sign"); setHasSigned(false); }}
                      className="w-full bg-[#1a2e4a] text-white text-lg font-bold py-4 rounded-2xl hover:bg-[#243d5e] transition-colors active:scale-95"
                    >
                      동의하고 서명하기
                    </button>
                    <button
                      onClick={() => { setMktChoice("skip"); void doSubmit(signatures, false); }}
                      disabled={submitting}
                      className="w-full bg-white text-gray-700 text-lg font-bold py-4 rounded-2xl border-2 border-gray-300 hover:bg-gray-100 transition-colors disabled:opacity-40 active:scale-95"
                    >
                      {submitting ? "제출 중..." : "동의 안 함 / 건너뛰고 제출"}
                    </button>
                  </div>
                ) : (
                  <>
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
                        지우기
                      </button>
                    </div>
                    <button
                      onClick={handleMktSignAndSubmit}
                      disabled={!hasSigned || submitting}
                      className="mt-3 w-full bg-[#1a2e4a] text-white text-lg font-bold py-4 rounded-2xl hover:bg-[#243d5e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                    >
                      {submitting ? "제출 중..." : "동의 서명 완료 및 제출"}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* 법적 안내 */}
            <div className="mx-1 mb-4 rounded-2xl bg-blue-50 p-4 border border-blue-100">
              <p className="text-sm text-blue-800 leading-relaxed">
                위 서명은 「전자서명법」에 따른 전자서명으로, 본 구매계약서에 법적 효력을 가집니다.
                서명 완료 후에는 수정이 불가합니다.
              </p>
            </div>

            {/* 참고: 계약서 본문 (현재 서명점 강조) */}
            <div className="max-h-[55vh] overflow-y-auto rounded-2xl border border-gray-100 mx-1">
              <ContractBody
                data={bodyData}
                agentName={agentName}
                signatures={signatures}
                mode="sign"
                activeSignPointId={activePoint}
                onRequestSign={jumpToPoint}
              />
            </div>

            <button
              onClick={() => setStep("companions")}
              disabled={submitting}
              className="w-full text-gray-500 text-base py-3 mt-3 hover:text-gray-700 transition-colors disabled:opacity-40"
            >
              ← 이전으로
            </button>
          </div>
        )}
      </div>
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
