"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Copy, Check, BookOpen, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { detectSegment, SEGMENT_PROFILES, SEGMENT_RECOMMENDED_TECHNIQUES } from "@/lib/segment-detector";
import { CRUISE_PRODUCTS, PRODUCT_CODES } from "@/constants/products";
import { ERROR_MESSAGES } from "@/lib/error-messages";
import { logger } from "@/lib/logger";
import { useToast } from "@/lib/api/use-toast";
import { VoicePlayback } from "./VoicePlayback";
import { ScriptNotes } from "./ScriptNotes";
import {
  CALL_SITUATIONS,
  suggestCallSituations,
  getSituationLabel,
} from "@/lib/playbook/call-situations";
import type { CallSituation } from "@/lib/playbook/call-situations";
import type { Segment } from "@/lib/segment-detector";
import type { ProductCode } from "@/constants/products";
import type { LensType } from "@/lib/types/lens";

type PlaybookItem = {
  id: string;
  type: string;
  title: string;
  content: string;
  priority: number;
  scriptTab: string;
  productCode: string;
  sectionOrder: number;
  psychology?: string;
  shinminStep?: string;
  monikaAmplifyLevel?: string;
  source?: string;
  notes?: string;
  pasonaStage?: string;
  effectivenessScore?: number;
  day0Template?: string;
  day1Template?: string;
  day2Template?: string;
  day3Template?: string;
  psychologyLens?: "L6" | "L10";
  lossAversionVariant?: string;
  immediateClosingVariant?: string;
};

type PersonalizationVar = {
  key: string;
  label: string;
  example: string;
};

type ClosingSignal = {
  id: string;
  text: string;
  checked: boolean;
};

const CUSTOMER_SEGMENTS = [
  { key: "ALL", label: "모든 고객" },
  { key: "A", label: "A: 30대 커플" },
  { key: "B", label: "B: 40대 가족" },
  { key: "C", label: "C: 중년 부부" },
  { key: "D", label: "D: 50-60대" },
  { key: "E", label: "E: 60대+" },
];

const PASONA_STAGE_BADGES: Record<string, { color: string; label: string; icon: string }> = {
  problem: { color: "bg-red-100 text-red-800", label: "문제 인식", icon: "⚠️" },
  affinity: { color: "bg-yellow-100 text-yellow-800", label: "공감", icon: "🤝" },
  solution: { color: "bg-green-100 text-green-800", label: "해결책", icon: "💡" },
  offer: { color: "bg-blue-100 text-blue-800", label: "조건", icon: "🎁" },
};

const PSYCHOLOGY_BADGES: Record<string, { bg: string; text: string; label: string; desc: string }> = {
  "Loss Aversion": { bg: "bg-purple-100", text: "text-purple-800", label: "손실회피", desc: "손실을 이익보다 2배 크게 인지" },
  "Social Proof": { bg: "bg-pink-100", text: "text-pink-800", label: "사회증명", desc: "남과 같은 행동을 추종" },
  "Narrative Transportation": { bg: "bg-blue-100", text: "text-blue-800", label: "내러티브", desc: "스토리텔링으로 감정 몰입" },
  "Priming": { bg: "bg-green-100", text: "text-green-800", label: "프라이밍", desc: "사전 자극으로 판단 영향" },
  "Scarcity": { bg: "bg-orange-100", text: "text-orange-800", label: "희소성", desc: "제한된 시간/수량으로 긴급성 생성" },
  "Commitment": { bg: "bg-red-100", text: "text-red-800", label: "약속의일관성", desc: "작은 약속→큰 약속으로 확대" },
};

const SHINMIN_STEPS: Record<string, { label: string; color: string; emoji: string }> = {
  "1": { label: "1단계: 친밀감 쌓기", color: "bg-blue-100 text-blue-800", emoji: "👋" },
  "2": { label: "2단계: 니즈 파악 (모니카 전략)", color: "bg-green-100 text-green-800", emoji: "❓" },
  "3": { label: "3단계: 욕구 키우기", color: "bg-purple-100 text-purple-800", emoji: "✨" },
  "4": { label: "4단계: 감정 절정", color: "bg-pink-100 text-pink-800", emoji: "❤️" },
  "5": { label: "5단계: 계약 마무리", color: "bg-red-100 text-red-800", emoji: "🎯" },
};

const MONIKA_AMPLIFY_LEVELS: Record<string, string> = {
  "1": "눈 떠주기",
  "2": "필요성 공감",
  "3": "감정 증폭",
  "4": "행동 유도",
};

const PERSONALIZATION_VARS: PersonalizationVar[] = [
  { key: "[이름]", label: "고객 이름", example: "김철수" },
  { key: "[전화번호]", label: "고객 전화번호", example: "010-1234-5678" },
  { key: "[담당자]", label: "담당 상담사 이름", example: "이모니카" },
  { key: "[상품명]", label: "관심 상품명", example: "카리브 럭셔리 7박 크루즈" },
  { key: "[출발일]", label: "예정 출발일", example: "2026-08-15" },
  { key: "[가격]", label: "상품 가격 (만원)", example: "1,850" },
  { key: "[출발지]", label: "출발 도시", example: "마이애미" },
  { key: "[목적지]", label: "목적지 도시", example: "카리브해" },
  { key: "[일정]", label: "여행 일정 (박수)", example: "7박 8일" },
  { key: "[객실유형]", label: "선호 객실 유형", example: "발코니 스위트" },
];

const DAY_0_3_SCHEDULE = [
  { day: 0, label: "Day 0", stage: "초대 + 문제 인식", time: "즉시 발송", icon: "🔔", color: "bg-red-50" },
  { day: 1, label: "Day 1", stage: "자극 + 솔루션", time: "24시간 후", icon: "📢", color: "bg-yellow-50" },
  { day: 2, label: "Day 2", stage: "오퍼 + 좁혀진범위", time: "48시간 후", icon: "💰", color: "bg-green-50" },
  { day: 3, label: "Day 3", stage: "긴박감 + 최종 액션", time: "72시간 후", icon: "⚡", color: "bg-purple-50" },
];

const L6_LOSS_AVERSION_TECHNIQUES = [
  "❌ 기회 비용 강조: '지금 예약하지 않으면 [출발일] 좌석 없을 수 있습니다'",
  "⏰ 타이밍 희소성: '이 가격은 [YYYY-MM-DD]까지만 유효합니다'",
  "📉 가격 상승 경고: '한 달 뒤 가격은 [current_price + 300]만원으로 오릅니다'",
  "🚫 재구매 불가: '이 시즌 [상품명]은 재고가 [N]개뿐입니다'",
  "👥 경쟁 심화: '[경쟁사명]에서도 같은 일정을 판매하고 있습니다'",
];

const L10_IMMEDIATE_CLOSING_TECHNIQUES = [
  "⚡ 즉시 구매 프레임: '지금 바로 신청하면 5분 내에 예약 확정됩니다'",
  "🎁 제한된 보너스: '오늘 예약 고객에게만 [bonus_name] 무료 추가'",
  "✅ 간편 결제: '신용카드 한 장으로 [N]분 안에 완료되는 간편 결제'",
  "🏆 VIP 우대: '지금 예약하면 [특전명](가격: [amount])을 무료로 드립니다'",
  "📱 모바일 원클릭: '앱에서 원클릭으로 선약금 [amount]만 결제하면 끝'",
];

const CLOSING_SIGNALS: ClosingSignal[] = [
  { id: "1", text: "언제까지 가능해요?", checked: false },
  { id: "2", text: "어떻게 예약해요?", checked: false },
  { id: "3", text: "3연속 Yes 답변", checked: false },
  { id: "4", text: "구체적 날짜/인원 언급", checked: false },
  { id: "5", text: "예산/결제방식 질문", checked: false },
  { id: "6", text: "동반자 의사 확인", checked: false },
  { id: "7", text: "지금 예약 vs 나중 선택", checked: false },
];

export default function PlaybookViewerPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<PlaybookItem[]>([]);
  const [selectedPhase, setSelectedPhase] = useState<number | null>(0);
  const [selectedSegment, setSelectedSegment] = useState("ALL");
  const [selectedProductCode, setSelectedProductCode] = useState<ProductCode | "ALL">("ALL");
  const [copied, setCopied] = useState<string | null>(null);
  const [closingSignals, setClosingSignals] = useState<ClosingSignal[]>(CLOSING_SIGNALS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [detectedSegment, setDetectedSegment] = useState<Segment>("A");
  const [selectedPsychologyLens, setSelectedPsychologyLens] = useState<"L6" | "L10" | null>(null);
  const [contactLens, setContactLens] = useState<LensType | null>(null);
  const [selectedSituation, setSelectedSituation] = useState<CallSituation | null>(null);
  const [sampleCustomer, setSampleCustomer] = useState({
    name: "",
    phone: "",
    agentName: "",
    productName: "",
    departDate: "",
    price: "",
    departure: "",
    destination: "",
    duration: "",
    roomType: "",
  });

  useEffect(() => {
    const ageStr = searchParams.get("age") || "0";
    const age = /^\d+$/.test(ageStr) ? parseInt(ageStr, 10) : undefined;
    const maritalStatus = searchParams.get("maritalStatus") || undefined;
    const childrenCountStr = searchParams.get("childrenCount") || "0";
    const childrenCount = /^\d+$/.test(childrenCountStr) ? parseInt(childrenCountStr, 10) : 0;
    const segmentOverride = searchParams.get("segment") || undefined;

    if (age || segmentOverride) {
      const detected = detectSegment({ age, maritalStatus, childrenCount, segmentOverride });
      setDetectedSegment(detected);
      setSelectedSegment(detected);
      logger.log("[PlaybookViewer] URL 파라미터로 세그먼트 자동 감지", { detected, age, maritalStatus, childrenCount });
    }

    const lensParam = searchParams.get("lens") as LensType | null;
    const validLenses: LensType[] = ["L0","L1","L2","L3","L4","L5","L6","L7","L8","L9","L10"];
    if (lensParam && validLenses.includes(lensParam)) {
      setContactLens(lensParam);
    }

    const phaseParam = searchParams.get("phase");
    if (phaseParam !== null && /^\d+$/.test(phaseParam)) {
      setSelectedPhase(parseInt(phaseParam, 10));
    }
  }, [searchParams]);

  useEffect(() => {
    fetchPlaybooks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPhase, selectedSegment, selectedProductCode]);

  const fetchPlaybooks = async () => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (selectedPhase !== null) params.append("phase", selectedPhase.toString());
      if (selectedSegment && selectedSegment !== "ALL") {
        params.append("customerSegment", selectedSegment);
      }
      if (selectedProductCode && selectedProductCode !== "ALL") {
        params.append("productCode", selectedProductCode);
      }

      const res = await fetch(`/api/tools/playbook?${params.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setItems((data.items || []) as PlaybookItem[]);
      } else {
        setError(ERROR_MESSAGES.PLAYBOOK_PARSE_ERROR);
        logger.error("[PlaybookViewer]", { action: "fetch-playbooks", status: "error", error: "API returned error" });
      }
    } catch (err) {
      logger.error("[PlaybookViewer]", {
        action: "fetch-playbooks",
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
      setError(ERROR_MESSAGES.PLAYBOOK_LOAD_FAILED);
    } finally {
      setLoading(false);
    }
  };

  const trackScriptClick = useCallback((scriptId: string) => {
    if (!scriptId) return;
    fetch("/api/tools/click-tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scriptId, event: "click" }),
      keepalive: true,
    }).catch(() => {});
  }, []);

  const copy = useCallback((text: string, scriptId?: string) => {
    if (scriptId) trackScriptClick(scriptId);
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopied(text);
        toast({ title: "복사 완료", description: "스크립트가 클립보드에 복사되었습니다.", variant: "success" });
        setTimeout(() => setCopied(null), 2000);
        logger.log("[PlaybookViewer]", { action: "copy-script", textLength: text.length, status: "success" });
      })
      .catch((err) => {
        logger.error("[PlaybookViewer]", { action: "copy-script", error: err instanceof Error ? err.message : "Unknown error", status: "failed" });
        toast({ title: "복사 실패", description: "클립보드 접근 권한이 없거나 HTTPS 환경이 아닙니다.", variant: "destructive" });
      });
  }, [toast, trackScriptClick]);

  const toggleClosingSignal = useCallback((id: string) => {
    setClosingSignals((prev) => prev.map((s) => (s.id === id ? { ...s, checked: !s.checked } : s)));
    logger.log("[PlaybookViewer]", { action: "toggle-closing-signal", signalId: id, status: "success" });
  }, []);

  const closingCount = useMemo(() => closingSignals.filter((s) => s.checked).length, [closingSignals]);

  const recommendedSituations = useMemo<CallSituation[]>(() => {
    if (contactLens) return suggestCallSituations(contactLens);
    return ["PRICE_OBJECTION", "HEALTH_CONCERN", "REFUND_REQUEST", "COMPLAINT",
            "FOOD_CONSULTATION", "UPSELL", "REBOOKING", "CONTRACT_RENEWAL"] as CallSituation[];
  }, [contactLens]);

  const handleSegmentChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSegment(e.target.value);
    const segmentName = e.target.options?.[e.target.selectedIndex]?.text || e.target.value;
    toast({ title: "필터 변경", description: `세그먼트: ${segmentName}로 변경했습니다.`, variant: "default" });
    logger.log("[PlaybookViewer]", { action: "filter-segment", segment: e.target.value, status: "success" });
  }, [toast]);

  const handlePhaseChange = useCallback((phase: number | null) => {
    setSelectedPhase(phase);
    const phaseName = phase === null ? "전체 Phase" : `Phase ${phase}`;
    toast({ title: "필터 변경", description: `${phaseName}로 변경했습니다.`, variant: "default" });
    logger.log("[PlaybookViewer]", { action: "filter-phase", phase, status: "success" });
  }, [toast]);

  const handleProductChange = useCallback((code: ProductCode | "ALL") => {
    setSelectedProductCode(code);
    const productName = code === "ALL" ? "전체 상품" : (CRUISE_PRODUCTS[code]?.name || code);
    toast({ title: "필터 변경", description: `상품: ${productName}로 변경했습니다.`, variant: "default" });
    logger.log("[PlaybookViewer]", { action: "filter-product", product: code, status: "success" });
  }, [toast]);

  const personalizeContent = useCallback((content: string): string => {
    return content
      .replace(/\[이름\]/g, sampleCustomer.name)
      .replace(/\[전화번호\]/g, sampleCustomer.phone)
      .replace(/\[담당자\]/g, sampleCustomer.agentName)
      .replace(/\[상품명\]/g, sampleCustomer.productName)
      .replace(/\[출발일\]/g, sampleCustomer.departDate)
      .replace(/\[가격\]/g, sampleCustomer.price)
      .replace(/\[출발지\]/g, sampleCustomer.departure)
      .replace(/\[목적지\]/g, sampleCustomer.destination)
      .replace(/\[일정\]/g, sampleCustomer.duration)
      .replace(/\[객실유형\]/g, sampleCustomer.roomType);
  }, [sampleCustomer]);

  const phases = Array.from({ length: 10 }, (_, i) => i);

  const filteredItems = selectedPhase !== null
    ? items.filter((i) => i.sectionOrder === selectedPhase)
    : items;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">

        {/* 헤더 */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <BookOpen className="w-7 h-7 text-navy-900 flex-shrink-0" />
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-navy-900 leading-tight">크루즈닷 콜 플레이북 v1.0</h1>
                <p className="text-sm text-gray-600 mt-0.5">신민형 5단계 통합 스크립트 라이브러리</p>
              </div>
            </div>
            <div className="relative w-full sm:w-auto">
              <label htmlFor="segment-select" className="block text-sm font-medium text-gray-700 mb-1">세그먼트</label>
              <select
                id="segment-select"
                value={selectedSegment}
                onChange={handleSegmentChange}
                className="w-full appearance-none bg-white border-2 border-gray-300 rounded-lg px-4 py-2 pr-8 text-sm font-medium text-gray-900 hover:border-navy-900 focus:outline-none focus:border-navy-900"
              >
                {CUSTOMER_SEGMENTS.map((seg) => (
                  <option key={seg.key} value={seg.key}>{seg.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 세그먼트 감지 박스 */}
        <div className="mb-5 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {SEGMENT_PROFILES[detectedSegment].emoji} {SEGMENT_PROFILES[detectedSegment].name}
              </p>
              <p className="text-sm text-gray-600 mt-1">{SEGMENT_PROFILES[detectedSegment].desc}</p>
            </div>
            <div className="text-3xl font-bold text-indigo-600">{detectedSegment}</div>
          </div>
          <div className="mt-3 flex gap-2 flex-wrap">
            {SEGMENT_RECOMMENDED_TECHNIQUES[detectedSegment].map((tech) => (
              <span key={tech} className="inline-block px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded font-medium">{tech}</span>
            ))}
          </div>
        </div>

        {/* Phase 필터 */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-sm font-semibold text-gray-700">Phase:</label>
            <button
              onClick={() => handlePhaseChange(null)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                selectedPhase === null ? "bg-navy-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              전체
            </button>
            {phases.map((p) => (
              <button
                key={p}
                onClick={() => handlePhaseChange(p)}
                className={`w-10 h-10 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                  selectedPhase === p ? "bg-navy-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* 상품 필터 */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-5">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-sm font-semibold text-gray-700">상품:</label>
            <button
              onClick={() => handleProductChange("ALL")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedProductCode === "ALL" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              전체
            </button>
            {PRODUCT_CODES.map((code) => {
              const product = CRUISE_PRODUCTS[code as ProductCode];
              return product ? (
                <button
                  key={code}
                  onClick={() => handleProductChange(code as ProductCode)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                    selectedProductCode === code ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <span>{product.emoji}</span>
                  {product.name}
                </button>
              ) : null;
            })}
          </div>
        </div>

        {/* 상황별 오프닝 패널 */}
        <div className="mb-5 bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-900">
              📌 상황별 오프닝 라인
              {contactLens && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded font-semibold">{contactLens} 추천순</span>
              )}
            </h2>
            <select
              value={contactLens ?? ""}
              onChange={(e) => setContactLens((e.target.value as LensType) || null)}
              aria-label="렌즈 선택"
              className="text-xs border border-gray-300 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:border-indigo-500"
            >
              <option value="">렌즈 선택 안 함</option>
              {(["L0","L1","L2","L3","L4","L5","L6","L7","L8","L9","L10"] as LensType[]).map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {recommendedSituations.map((situation) => {
              const script = CALL_SITUATIONS[situation];
              const isSelected = selectedSituation === situation;
              return (
                <button
                  key={situation}
                  onClick={() => setSelectedSituation(isSelected ? null : situation)}
                  className={`text-left p-2 rounded-lg border-2 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                    isSelected ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-indigo-300"
                  }`}
                >
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-base">{script.emoji}</span>
                    <span className={`text-xs font-semibold px-1 py-0.5 rounded ${
                      script.tier === "CORE" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                    }`}>
                      {script.tier === "CORE" ? "필수" : "성장"}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-gray-800 mb-0.5">{getSituationLabel(situation)}</p>
                  <p className="text-xs text-gray-500 line-clamp-2">{script.openingLines[0].text}</p>
                </button>
              );
            })}
          </div>

          {selectedSituation && (
            <div className="mt-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-indigo-900 text-sm">
                  {CALL_SITUATIONS[selectedSituation].emoji} {getSituationLabel(selectedSituation)} — 오프닝 3가지
                </h3>
                <span className="text-xs text-indigo-600 font-medium">
                  주요 렌즈: {CALL_SITUATIONS[selectedSituation].primaryLens}
                </span>
              </div>
              <div className="space-y-2">
                {CALL_SITUATIONS[selectedSituation].openingLines.map((line, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-3 border border-indigo-100">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-sm font-bold text-gray-800">{idx + 1}. {line.text}</span>
                      <span className="flex-shrink-0 text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded font-medium">{line.lensLabel}</span>
                    </div>
                    <p className="text-xs text-gray-500 italic">{line.rationale}</p>
                  </div>
                ))}
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-sm font-semibold text-yellow-800">이의 대응</p>
                <p className="text-sm text-yellow-700 mt-1">{CALL_SITUATIONS[selectedSituation].rebuttal}</p>
              </div>
            </div>
          )}
        </div>

        {/* 유틸리티 패널: 클로징 신호 + 심리학 렌즈 + Day 0-3 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* 클로징 신호 */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900 text-sm">클로징 신호 7종</h3>
              <span className={`inline-block px-2 py-1 text-xs font-bold rounded-full ${
                closingCount >= 3 ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
              }`}>
                {closingCount}/7
              </span>
            </div>
            <div className="space-y-1.5">
              {closingSignals.map((signal) => (
                <div key={signal.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <input
                    id={`signal-${signal.id}`}
                    type="checkbox"
                    checked={signal.checked}
                    onChange={() => toggleClosingSignal(signal.id)}
                    className="w-4 h-4 rounded text-green-600 cursor-pointer flex-shrink-0"
                  />
                  <label htmlFor={`signal-${signal.id}`} className="text-xs text-gray-700 flex-1 cursor-pointer">{signal.text}</label>
                </div>
              ))}
            </div>
            {closingCount >= 3 && (
              <p className="mt-2 text-xs font-semibold text-green-700 text-center">✅ 지금이 클로징 타이밍!</p>
            )}
          </div>

          {/* 심리학 렌즈 */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-bold text-gray-900 text-sm mb-3">🎯 심리학 렌즈</h3>
            <div className="space-y-2 mb-3">
              <button
                onClick={() => setSelectedPsychologyLens(selectedPsychologyLens === "L6" ? null : "L6")}
                className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedPsychologyLens === "L6" ? "bg-orange-500 text-white" : "bg-orange-100 text-orange-800 hover:bg-orange-200"
                }`}
              >
                ⏰ L6 손실회피/타이밍
              </button>
              <button
                onClick={() => setSelectedPsychologyLens(selectedPsychologyLens === "L10" ? null : "L10")}
                className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedPsychologyLens === "L10" ? "bg-red-500 text-white" : "bg-red-100 text-red-800 hover:bg-red-200"
                }`}
              >
                ⚡ L10 즉시구매 클로징
              </button>
            </div>
            {selectedPsychologyLens === "L6" && (
              <div className="p-2 bg-orange-50 border-l-4 border-orange-500 rounded text-xs text-orange-700 space-y-1">
                {L6_LOSS_AVERSION_TECHNIQUES.map((tech, i) => <p key={i}>{tech}</p>)}
              </div>
            )}
            {selectedPsychologyLens === "L10" && (
              <div className="p-2 bg-red-50 border-l-4 border-red-500 rounded text-xs text-red-700 space-y-1">
                {L10_IMMEDIATE_CLOSING_TECHNIQUES.map((tech, i) => <p key={i}>{tech}</p>)}
              </div>
            )}
            {!selectedPsychologyLens && (
              <p className="text-xs text-gray-400 text-center">렌즈를 선택하면 기법이 표시됩니다</p>
            )}
          </div>

          {/* Day 0-3 일정 */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-bold text-gray-900 text-sm mb-3">📅 Day 0-3 문자 일정</h3>
            <div className="space-y-2">
              {DAY_0_3_SCHEDULE.map((day) => (
                <div key={day.day} className={`p-2 rounded-lg border border-gray-200 ${day.color}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-base">{day.icon}</span>
                    <div>
                      <p className="text-xs font-semibold text-gray-900">{day.label}: {day.stage}</p>
                      <p className="text-xs text-gray-500">{day.time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 개인화 미리채우기 */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <h3 className="text-sm font-bold text-gray-900 mb-3">✏️ 고객 정보 미리 채우기 (선택사항 — 스크립트 [변수] 자동 치환)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-2">
            <input type="text" value={sampleCustomer.name} onChange={(e) => setSampleCustomer({ ...sampleCustomer, name: e.target.value })} placeholder="이름" className="px-2 py-1.5 text-xs border rounded bg-white focus:outline-none focus:border-indigo-400" />
            <input type="text" value={sampleCustomer.productName} onChange={(e) => setSampleCustomer({ ...sampleCustomer, productName: e.target.value })} placeholder="상품명" className="px-2 py-1.5 text-xs border rounded bg-white focus:outline-none focus:border-indigo-400" />
            <input type="text" value={sampleCustomer.price} onChange={(e) => setSampleCustomer({ ...sampleCustomer, price: e.target.value })} placeholder="가격(만원)" className="px-2 py-1.5 text-xs border rounded bg-white focus:outline-none focus:border-indigo-400" />
            <input type="text" value={sampleCustomer.departDate} onChange={(e) => setSampleCustomer({ ...sampleCustomer, departDate: e.target.value })} placeholder="출발일" className="px-2 py-1.5 text-xs border rounded bg-white focus:outline-none focus:border-indigo-400" />
            <input type="text" value={sampleCustomer.agentName} onChange={(e) => setSampleCustomer({ ...sampleCustomer, agentName: e.target.value })} placeholder="담당자명" className="px-2 py-1.5 text-xs border rounded bg-white focus:outline-none focus:border-indigo-400" />
          </div>
          <div className="flex flex-wrap gap-1">
            {PERSONALIZATION_VARS.map((v) => (
              <span key={v.key} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded font-mono" title={v.label}>{v.key}</span>
            ))}
          </div>
        </div>

        {/* 스크립트 카드 목록 — 전체 펼쳐짐 */}
        <div className="space-y-4">
          {loading && (
            <div className="flex items-center justify-center h-48 bg-white rounded-xl">
              <Loader2 className="w-5 h-5 animate-spin text-navy-900 mr-2" />
              <span className="text-gray-600 text-sm font-medium">스크립트 로드 중...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800"><span className="font-semibold">⚠️ 오류:</span> {error}</p>
            </div>
          )}

          {!loading && !error && filteredItems.length === 0 && (
            <div className="text-center p-8 bg-white rounded-xl">
              <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">검색 결과가 없습니다.</p>
              <p className="text-xs text-gray-400 mt-1">다른 필터를 시도해주세요.</p>
            </div>
          )}

          {!loading && !error && filteredItems.length > 0 &&
            filteredItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
              >
                {/* 카드 헤더 — 배지 모음 */}
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2 flex-wrap">
                  <span className="inline-block px-2.5 py-1 bg-navy-900 text-white text-xs font-semibold rounded">
                    Phase {item.sectionOrder}
                  </span>
                  <span className="inline-block px-2.5 py-1 bg-gray-200 text-gray-700 text-xs rounded font-medium">
                    {item.type}
                  </span>
                  {item.productCode !== "ALL" && (
                    <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">{item.productCode}</span>
                  )}
                  {item.pasonaStage && PASONA_STAGE_BADGES[item.pasonaStage] && (
                    <span className={`inline-block px-2 py-0.5 text-xs rounded font-medium ${PASONA_STAGE_BADGES[item.pasonaStage].color}`}>
                      {PASONA_STAGE_BADGES[item.pasonaStage].icon} {PASONA_STAGE_BADGES[item.pasonaStage].label}
                    </span>
                  )}
                  {item.shinminStep && SHINMIN_STEPS[item.shinminStep] && (
                    <span className={`inline-block px-2 py-0.5 text-xs rounded font-medium ${SHINMIN_STEPS[item.shinminStep].color}`}>
                      {SHINMIN_STEPS[item.shinminStep].emoji} {SHINMIN_STEPS[item.shinminStep].label}
                    </span>
                  )}
                  {item.effectivenessScore && (
                    <span className="inline-block px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded font-medium">
                      효과도 {item.effectivenessScore}%
                    </span>
                  )}
                  {item.psychology && PSYCHOLOGY_BADGES[item.psychology] && (
                    <span className={`inline-block px-2 py-0.5 text-xs rounded font-medium ${PSYCHOLOGY_BADGES[item.psychology].bg} ${PSYCHOLOGY_BADGES[item.psychology].text}`}>
                      {PSYCHOLOGY_BADGES[item.psychology].label}
                    </span>
                  )}
                </div>

                {/* 카드 본문 */}
                <div className="p-5">
                  <h3 className="font-bold text-gray-900 text-base mb-4 leading-tight">{item.title}</h3>

                  {/* 음성 재생 */}
                  <div className="mb-3">
                    <VoicePlayback text={item.content} scriptId={item.id} title="음성 재생" />
                  </div>

                  {/* 스크립트 전문 (전체 펼침) */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-3 border border-gray-200">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {personalizeContent(item.content)}
                    </p>
                  </div>

                  {/* 복사 버튼 */}
                  <button
                    onClick={() => copy(personalizeContent(item.content), item.id)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-800 transition-colors mb-4"
                  >
                    {copied === personalizeContent(item.content) ? (
                      <><Check className="w-4 h-4" /> 복사됨</>
                    ) : (
                      <><Copy className="w-4 h-4" /> 클립보드 복사</>
                    )}
                  </button>

                  {/* 모니카 욕망 증폭 레벨 */}
                  {item.type === "AMPLIFY" && item.monikaAmplifyLevel && MONIKA_AMPLIFY_LEVELS[item.monikaAmplifyLevel] && (
                    <div className="bg-purple-50 border-l-4 border-purple-500 rounded p-3 mb-4">
                      <p className="text-sm font-semibold text-purple-900 mb-1">모니카 욕망 증폭</p>
                      <p className="text-sm font-bold text-purple-900">
                        레벨 {item.monikaAmplifyLevel}: {MONIKA_AMPLIFY_LEVELS[item.monikaAmplifyLevel]}
                      </p>
                      <ul className="text-xs text-purple-700 mt-2 list-disc list-inside space-y-0.5">
                        {item.monikaAmplifyLevel === "1" && (<><li>호기심 유발로 고객의 관심 끌기</li><li>"이것도 포함되나요?" 형식의 질문</li></>)}
                        {item.monikaAmplifyLevel === "2" && (<><li>사회적 증거로 필요성 공감</li><li>"다른 분들도..." 멘트 활용</li></>)}
                        {item.monikaAmplifyLevel === "3" && (<><li>5감각 앵커링으로 감정 증폭</li><li>럭셔리/가족 이미지 자극</li></>)}
                        {item.monikaAmplifyLevel === "4" && (<><li>희소성으로 행동 유도</li><li>"지금 신청하면..." 클로징</li></>)}
                      </ul>
                    </div>
                  )}

                  {/* 심리학 이론 설명 */}
                  {item.psychology && PSYCHOLOGY_BADGES[item.psychology] && (
                    <p className="text-xs text-gray-400 mb-3 italic">{PSYCHOLOGY_BADGES[item.psychology].desc}</p>
                  )}

                  {/* 출처 */}
                  {item.source && (
                    <p className="text-xs text-gray-400 mb-3">출처: <span className="font-medium text-gray-500">{item.source}</span></p>
                  )}

                  {/* 메모 */}
                  <ScriptNotes scriptId={item.id} />
                </div>
              </motion.div>
            ))
          }
        </div>

        {/* 모니카 멘트 6단계 참고 (하단) */}
        <div className="mt-6 p-4 bg-indigo-50 border-l-4 border-indigo-500 rounded-xl">
          <h3 className="text-sm font-semibold text-indigo-900 mb-2">📊 모니카 멘트 — 고객 마음 여는 6단계</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-indigo-700">
            <p><span className="font-semibold">① 문제 짚기</span> — 고객 고민 먼저 알아주기</p>
            <p><span className="font-semibold">② 마음 흔들기</span> — 고민의 중요성 강조</p>
            <p><span className="font-semibold">③ 해결책 보여주기</span> — 상품으로 풀어드리기</p>
            <p><span className="font-semibold">④ 구체적 제안</span> — 가격·혜택 명확히</p>
            <p><span className="font-semibold">⑤ 선택 좁히기</span> — 결정하기 쉽게 정리</p>
            <p><span className="font-semibold">⑥ 행동 권하기</span> — 지금 바로 결정하도록</p>
          </div>
        </div>

      </div>
    </div>
  );
}
