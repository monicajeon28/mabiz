"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Copy, Check, ChevronDown, BookOpen, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { detectSegment, SEGMENT_PROFILES, SEGMENT_RECOMMENDED_TECHNIQUES } from "@/lib/segment-detector";
import { CRUISE_PRODUCTS, PRODUCT_CODES } from "@/constants/products";
import { ERROR_MESSAGES } from "@/lib/error-messages";
import { logger } from "@/lib/logger";
import { useToast } from "@/lib/api/use-toast";
import { VoicePlayback } from "./VoicePlayback";
import { ScriptNotes } from "./ScriptNotes";
import type { Segment } from "@/lib/segment-detector";
import type { ProductCode } from "@/constants/products";

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
  "1": { label: "Step 1: 라포 형성", color: "bg-blue-100 text-blue-800", emoji: "👋" },
  "2": { label: "Step 2: 니즈 SPIN", color: "bg-green-100 text-green-800", emoji: "❓" },
  "3": { label: "Step 3: 욕망 증폭", color: "bg-purple-100 text-purple-800", emoji: "✨" },
  "4": { label: "Step 4: 감정 피크", color: "bg-pink-100 text-pink-800", emoji: "❤️" },
  "5": { label: "Step 5: 클로징", color: "bg-red-100 text-red-800", emoji: "🎯" },
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
  const [selectedPhase, setSelectedPhase] = useState<number | null>(null);
  const [selectedSegment, setSelectedSegment] = useState("ALL");
  const [selectedProductCode, setSelectedProductCode] = useState<ProductCode | "ALL">("ALL");
  const [selectedItem, setSelectedItem] = useState<PlaybookItem | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [closingSignals, setClosingSignals] = useState<ClosingSignal[]>(CLOSING_SIGNALS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [detectedSegment, setDetectedSegment] = useState<Segment>("A");
  const [selectedPsychologyLens, setSelectedPsychologyLens] = useState<"L6" | "L10" | null>(null);
  const [showDay03Preview, setShowDay03Preview] = useState(false);
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

  // URL 파라미터로 Contact 정보를 받아 세그먼트 자동 감지
  // 예: /tools/playbook-viewer?age=42&maritalStatus=MARRIED&childrenCount=2
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
  }, [searchParams]);

  useEffect(() => {
    fetchPlaybooks();
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
        // 현재 선택 아이템 유지 (가능한 경우)
        const isCurrentItemInResults = (data.items || []).some((item: PlaybookItem) => item.id === selectedItem?.id);
        if (!isCurrentItemInResults && data.items?.length > 0) {
          setSelectedItem(data.items[0]);
        } else if (!data.items?.length) {
          setSelectedItem(null);
        }
      } else {
        setError(ERROR_MESSAGES.PLAYBOOK_PARSE_ERROR);
        logger.error("[PlaybookViewer]", {
          action: "fetch-playbooks",
          status: "error",
          error: "API returned error",
        });
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

  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopied(text);
        toast({
          title: "복사 완료",
          description: "스크립트가 클립보드에 복사되었습니다.",
          variant: "success",
        });
        setTimeout(() => setCopied(null), 2000);
        logger.log("[PlaybookViewer]", {
          action: "copy-script",
          textLength: text.length,
          status: "success",
        });
      })
      .catch((err) => {
        logger.error("[PlaybookViewer]", {
          action: "copy-script",
          error: err instanceof Error ? err.message : "Unknown error",
          status: "failed",
        });
        toast({
          title: "복사 실패",
          description: "클립보드 접근 권한이 없거나 HTTPS 환경이 아닙니다.",
          variant: "destructive",
        });
      });
  }, [toast]);

  const toggleClosingSignal = useCallback((id: string) => {
    setClosingSignals((prev) =>
      prev.map((s) => (s.id === id ? { ...s, checked: !s.checked } : s))
    );

    logger.log("[PlaybookViewer]", {
      action: "toggle-closing-signal",
      signalId: id,
      status: "success",
    });
  }, []);

  const closingCount = useMemo(
    () => closingSignals.filter((s) => s.checked).length,
    [closingSignals]
  );

  const handleSegmentChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSegment(e.target.value);

    const segmentName = e.target.options?.[e.target.selectedIndex]?.text || e.target.value;
    toast({
      title: "필터 변경",
      description: `세그먼트: ${segmentName}로 변경했습니다.`,
      variant: "default",
    });

    logger.log("[PlaybookViewer]", {
      action: "filter-segment",
      segment: e.target.value,
      status: "success",
    });
  }, [toast]);

  const handlePhaseChange = useCallback((phase: number | null) => {
    setSelectedPhase(phase);

    const phaseName = phase === null ? "전체 Phase" : `Phase ${phase}`;
    toast({
      title: "필터 변경",
      description: `${phaseName}로 변경했습니다.`,
      variant: "default",
    });

    logger.log("[PlaybookViewer]", {
      action: "filter-phase",
      phase,
      status: "success",
    });
  }, [toast]);

  const handleProductChange = useCallback((code: ProductCode | "ALL") => {
    setSelectedProductCode(code);

    const productName = code === "ALL" ? "전체 상품" : (CRUISE_PRODUCTS[code]?.name || code);
    toast({
      title: "필터 변경",
      description: `상품: ${productName}로 변경했습니다.`,
      variant: "default",
    });

    logger.log("[PlaybookViewer]", {
      action: "filter-product",
      product: code,
      status: "success",
    });
  }, [toast]);

  const personalizeContent = useCallback((content: string): string => {
    let result = content;
    result = result.replace(/\[이름\]/g, sampleCustomer.name);
    result = result.replace(/\[전화번호\]/g, sampleCustomer.phone);
    result = result.replace(/\[담당자\]/g, sampleCustomer.agentName);
    result = result.replace(/\[상품명\]/g, sampleCustomer.productName);
    result = result.replace(/\[출발일\]/g, sampleCustomer.departDate);
    result = result.replace(/\[가격\]/g, sampleCustomer.price);
    result = result.replace(/\[출발지\]/g, sampleCustomer.departure);
    result = result.replace(/\[목적지\]/g, sampleCustomer.destination);
    result = result.replace(/\[일정\]/g, sampleCustomer.duration);
    result = result.replace(/\[객실유형\]/g, sampleCustomer.roomType);
    return result;
  }, [sampleCustomer]);

  // Phase 버튼들
  const phases = Array.from({ length: 10 }, (_, i) => i);

  // 고객세그먼트별 필터링
  const filteredItems = selectedPhase !== null
    ? items.filter((i) => i.sectionOrder === selectedPhase)
    : items;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* 세그먼트 감지 박스 */}
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
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
              <span key={tech} className="inline-block px-2 py-1 bg-indigo-100 text-indigo-700 text-sm rounded font-medium">
                {tech}
              </span>
            ))}
          </div>
        </div>

        {/* 헤더 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-navy-900 flex-shrink-0" />
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-navy-900 leading-tight">크루즈닷 콜 플레이북 v1.0</h1>
                <p className="text-base text-gray-600 mt-1">신민형 5단계 통합 스크립트 라이브러리</p>
              </div>
            </div>

            {/* 고객세그먼트 드롭다운 */}
            <div className="relative w-full sm:w-auto">
              <label htmlFor="segment-select" className="block text-sm font-medium text-gray-700 mb-1">
                세그먼트
              </label>
              <select
                id="segment-select"
                value={selectedSegment}
                onChange={handleSegmentChange}
                className="w-full appearance-none bg-white border-2 border-gray-300 rounded-lg px-4 py-2 pr-10 text-base font-medium text-gray-900 hover:border-navy-900 focus:outline-none focus:border-navy-900 focus:ring-2 focus:ring-navy-900 focus:ring-offset-2"
              >
                {CUSTOMER_SEGMENTS.map((seg) => (
                  <option key={seg.key} value={seg.key}>
                    {seg.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Phase 필터 */}
        <motion.div
          className="bg-white rounded-xl shadow-sm p-4 mb-6"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-base font-semibold text-gray-700">Phase:</label>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handlePhaseChange(null)}
              className={`px-3 py-2 rounded-lg text-base font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                selectedPhase === null
                  ? "bg-navy-900 text-white focus:ring-navy-900"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-400"
              }`}
            >
              ALL
            </motion.button>
            {phases.map((p) => (
              <motion.button
                key={p}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handlePhaseChange(p)}
                className={`w-12 h-12 rounded-lg text-base font-semibold transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  selectedPhase === p
                    ? "bg-navy-900 text-white focus:ring-navy-900"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-400"
                }`}
              >
                {p}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* 상품 필터 */}
        <motion.div
          className="bg-white rounded-xl shadow-sm p-4 mb-6"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-base font-semibold text-gray-700">상품:</label>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleProductChange("ALL")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedProductCode === "ALL"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              전체 상품
            </motion.button>
            {PRODUCT_CODES.map((code) => {
              const product = CRUISE_PRODUCTS[code as ProductCode];
              return product ? (
                <motion.button
                  key={code}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleProductChange(code as ProductCode)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    selectedProductCode === code
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <span>{product.emoji}</span>
                  {product.name}
                </motion.button>
              ) : null;
            })}
          </div>
        </motion.div>

        {/* 메인 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 좌측: 스크립트 카드 목록 */}
          <div className="lg:col-span-2 space-y-3">
            {loading && (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-6 h-6 animate-spin text-navy-900 mr-3" />
                <span className="text-gray-600 font-medium">스크립트 로드 중...</span>
              </div>
            )}

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">
                  <span className="font-semibold">⚠️ 오류:</span> {error}
                </p>
              </div>
            )}

            {!loading && !error && filteredItems.length === 0 && (
              <div className="text-center p-8">
                <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">검색 결과가 없습니다.</p>
                <p className="text-sm text-gray-600 mt-1">다른 필터를 시도해주세요.</p>
              </div>
            )}

            {!loading && !error && filteredItems.length > 0 && (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`bg-white rounded-xl border-2 p-4 cursor-pointer transition-all ${
                    selectedItem?.id === item.id
                      ? "border-navy-900 shadow-md"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-start gap-3 justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="inline-block px-3 py-1.5 bg-navy-900 text-white text-base font-semibold rounded">
                          Phase {item.sectionOrder}
                        </span>
                        <span className="inline-block px-3 py-1.5 bg-gray-200 text-gray-700 text-base rounded font-medium">
                          {item.type}
                        </span>
                        {item.productCode !== "ALL" && (
                          <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded">
                            {item.productCode}
                          </span>
                        )}
                        {item.pasonaStage && PASONA_STAGE_BADGES[item.pasonaStage] && (
                          <span className={`inline-block px-2 py-1 text-sm rounded font-medium ${PASONA_STAGE_BADGES[item.pasonaStage].color}`}>
                            {PASONA_STAGE_BADGES[item.pasonaStage].icon} {PASONA_STAGE_BADGES[item.pasonaStage].label}
                          </span>
                        )}
                        {item.effectivenessScore && (
                          <span className="inline-block px-2 py-1 rounded text-sm font-medium bg-purple-100 text-purple-800">
                            효과도 {item.effectivenessScore}%
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-900 text-base mb-2 leading-tight">{item.title}</h3>
                      <p className="text-base text-gray-600 line-clamp-2 leading-relaxed">{item.content}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 우측: 고정 패널 */}
          <div className="lg:col-span-1 space-y-4">
            {/* 상세 정보 패널 */}
            {selectedItem ? (
              <div className="bg-white rounded-xl shadow-sm p-5 sticky top-6 max-h-[calc(100vh-120px)] overflow-y-auto space-y-5">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 leading-tight">{selectedItem.title}</h2>
                  {/* Voice Playback */}
                  <VoicePlayback text={selectedItem.content} scriptId={selectedItem.id} title="스크립트 음성 재생" />
                </div>

                {/* Script */}
                <div>
                  <h3 className="text-base font-semibold text-gray-700 uppercase mb-3 tracking-wide">상담사 멘트</h3>
                  <div className="bg-gray-50 rounded-lg p-4 mb-3 border border-gray-200">
                    <p className="text-base text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {selectedItem.content}
                    </p>
                  </div>
                  <button
                    onClick={() => copy(selectedItem.content)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-800 transition-colors"
                  >
                    {copied === selectedItem.content ? (
                      <>
                        <Check className="w-4 h-4" /> 복사됨
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" /> 클립보드 복사
                      </>
                    )}
                  </button>
                </div>

                {/* PASONA 단계 배지 */}
                {selectedItem?.pasonaStage && PASONA_STAGE_BADGES[selectedItem.pasonaStage] && (
                  <div>
                    <h3 className="text-base font-semibold text-gray-700 uppercase mb-3 tracking-wide">PASONA 단계</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-block px-3 py-1.5 rounded-lg text-sm font-semibold ${PASONA_STAGE_BADGES[selectedItem.pasonaStage].color}`}>
                        {PASONA_STAGE_BADGES[selectedItem.pasonaStage].icon} {PASONA_STAGE_BADGES[selectedItem.pasonaStage].label}
                      </span>
                      {selectedItem.effectivenessScore && (
                        <span className="inline-block px-3 py-1.5 rounded-lg text-sm font-semibold bg-purple-100 text-purple-800">
                          효과도 {selectedItem.effectivenessScore}%
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* 신민형 5단계 배지 */}
                {selectedItem?.shinminStep && SHINMIN_STEPS[selectedItem.shinminStep] && (
                  <div>
                    <h3 className="text-base font-semibold text-gray-700 uppercase mb-3 tracking-wide">신민형 5단계</h3>
                    <span className={`inline-block px-3 py-1.5 rounded-lg text-sm font-semibold ${SHINMIN_STEPS[selectedItem.shinminStep].color}`}>
                      {SHINMIN_STEPS[selectedItem.shinminStep].emoji} {SHINMIN_STEPS[selectedItem.shinminStep].label}
                    </span>
                  </div>
                )}

                {/* 모니카 욕망 증폭 레벨 */}
                {selectedItem?.type === "AMPLIFY" && selectedItem?.monikaAmplifyLevel && MONIKA_AMPLIFY_LEVELS[selectedItem.monikaAmplifyLevel] && (
                  <div className="bg-purple-50 border-l-4 border-purple-500 rounded p-4">
                    <p className="text-base font-semibold text-purple-900 uppercase mb-2">모니카 욕망 증폭</p>
                    <p className="text-base font-bold text-purple-900">
                      레벨 {selectedItem.monikaAmplifyLevel}: {MONIKA_AMPLIFY_LEVELS[selectedItem.monikaAmplifyLevel]}
                    </p>
                    <ul className="text-base text-purple-700 mt-3 list-disc list-inside space-y-1">
                      {selectedItem.monikaAmplifyLevel === "1" && (
                        <>
                          <li>호기심 유발로 고객의 관심 끌기</li>
                          <li>"이것도 포함되나요?" 형식의 질문</li>
                        </>
                      )}
                      {selectedItem.monikaAmplifyLevel === "2" && (
                        <>
                          <li>사회적 증거로 필요성 공감</li>
                          <li>"다른 분들도..." 멘트 활용</li>
                        </>
                      )}
                      {selectedItem.monikaAmplifyLevel === "3" && (
                        <>
                          <li>5감각 앵커링으로 감정 증폭</li>
                          <li>럭셔리/가족 이미지 자극</li>
                        </>
                      )}
                      {selectedItem.monikaAmplifyLevel === "4" && (
                        <>
                          <li>희소성으로 행동 유도</li>
                          <li>"지금 신청하면..." 클로징</li>
                        </>
                      )}
                    </ul>
                  </div>
                )}

                {/* 심리학 배지 */}
                {selectedItem?.psychology && PSYCHOLOGY_BADGES[selectedItem.psychology] && (
                  <div>
                    <h3 className="text-base font-semibold text-gray-700 uppercase mb-3 tracking-wide">심리학 이론</h3>
                    <div className={`inline-block px-3 py-2 rounded-lg text-base font-medium ${PSYCHOLOGY_BADGES[selectedItem.psychology].bg} ${PSYCHOLOGY_BADGES[selectedItem.psychology].text}`}>
                      {PSYCHOLOGY_BADGES[selectedItem.psychology].label}
                    </div>
                    <p className="text-base text-gray-600 mt-2">{PSYCHOLOGY_BADGES[selectedItem.psychology].desc}</p>
                  </div>
                )}

                {/* Loop 3: Psychology Lens 선택 */}
                <div>
                  <h3 className="text-base font-semibold text-gray-700 uppercase mb-3 tracking-wide">🎯 심리학 렌즈 적용</h3>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setSelectedPsychologyLens(selectedPsychologyLens === "L6" ? null : "L6")}
                      className={`flex-1 px-3 py-2 rounded-lg text-base font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                        selectedPsychologyLens === "L6"
                          ? "bg-orange-500 text-white focus:ring-orange-500"
                          : "bg-orange-100 text-orange-800 hover:bg-orange-200 focus:ring-orange-300"
                      }`}
                    >
                      ⏰ L6 (손실회피/타이밍)
                    </button>
                    <button
                      onClick={() => setSelectedPsychologyLens(selectedPsychologyLens === "L10" ? null : "L10")}
                      className={`flex-1 px-3 py-2 rounded-lg text-base font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                        selectedPsychologyLens === "L10"
                          ? "bg-red-500 text-white focus:ring-red-500"
                          : "bg-red-100 text-red-800 hover:bg-red-200 focus:ring-red-300"
                      }`}
                    >
                      ⚡ L10 (즉시구매)
                    </button>
                  </div>
                </div>

                {/* L6 손실회피/타이밍 기법 */}
                {selectedPsychologyLens === "L6" && (
                  <div className="p-4 bg-orange-50 border-l-4 border-orange-500 rounded">
                    <h3 className="text-base font-semibold text-orange-900 uppercase mb-3 tracking-wide">⏰ L6: 손실회피 + 타이밍</h3>
                    <p className="text-base text-orange-700 mb-3">고객이 지금 바로 결정해야 하는 심리적 이유를 강조합니다.</p>
                    <ul className="text-base text-orange-700 space-y-1.5">
                      {L6_LOSS_AVERSION_TECHNIQUES.map((tech, idx) => (
                        <li key={idx} className="list-none">{tech}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* L10 즉시구매 클로징 기법 */}
                {selectedPsychologyLens === "L10" && (
                  <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded">
                    <h3 className="text-base font-semibold text-red-900 uppercase mb-3 tracking-wide">⚡ L10: 즉시구매 클로징</h3>
                    <p className="text-base text-red-700 mb-3">구매 결정을 최대한 간편하게 만드는 강력한 클로징 기법입니다.</p>
                    <ul className="text-base text-red-700 space-y-1.5">
                      {L10_IMMEDIATE_CLOSING_TECHNIQUES.map((tech, idx) => (
                        <li key={idx} className="list-none">{tech}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* PASONA 프레임워크 설명 */}
                <div className="p-4 bg-indigo-50 border-l-4 border-indigo-500 rounded">
                  <h3 className="text-base font-semibold text-indigo-900 uppercase mb-3 tracking-wide">📊 PASONA 심리학 프레임워크</h3>
                  <div className="space-y-2 text-base text-indigo-700 leading-relaxed">
                    <p><span className="font-semibold">P</span>roblem: 고객의 문제 인식 → <span className="font-semibold">A</span>gitate: 문제의 심각성 강조</p>
                    <p><span className="font-semibold">S</span>olution: 해결책 제시 → <span className="font-semibold">O</span>ffer: 구체적 조건 제시</p>
                    <p><span className="font-semibold">N</span>arrow: 범위 좁혀서 결정 단순화 → <span className="font-semibold">A</span>ction: 지금 바로 행동</p>
                  </div>
                </div>

                {/* Day 0-3 PASONA 일정 */}
                <div>
                  <h3 className="text-base font-semibold text-gray-700 uppercase mb-3 tracking-wide">📅 Day 0-3 PASONA 일정</h3>
                  <div className="space-y-2">
                    {DAY_0_3_SCHEDULE.map((day) => (
                      <div key={day.day} className={`p-2 rounded-lg border border-gray-200 ${day.color}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{day.icon}</span>
                            <div>
                              <p className="text-base font-semibold text-gray-900">{day.label}: {day.stage}</p>
                              <p className="text-sm text-gray-600">{day.time}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowDay03Preview(!showDay03Preview)}
                    className="w-full mt-3 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-medium rounded-lg transition-colors"
                  >
                    {showDay03Preview ? "미리보기 닫기" : "🔍 동적 내용 미리보기"}
                  </button>
                </div>

                {/* Day 0-3 동적 미리보기 */}
                {showDay03Preview && selectedItem && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-4">
                    <h3 className="text-base font-semibold text-blue-900 uppercase tracking-wide">📝 개인화된 메시지 미리보기</h3>

                    {/* 샘플 고객 정보 편집 */}
                    <div className="space-y-3">
                      <p className="text-base font-medium text-gray-700">샘플 고객 정보 (미리보기용)</p>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={sampleCustomer.name}
                          onChange={(e) => setSampleCustomer({ ...sampleCustomer, name: e.target.value })}
                          placeholder="고객 이름"
                          className="col-span-2 px-2 py-1 text-sm border rounded bg-white"
                        />
                        <input
                          type="text"
                          value={sampleCustomer.productName}
                          onChange={(e) => setSampleCustomer({ ...sampleCustomer, productName: e.target.value })}
                          placeholder="상품명"
                          className="col-span-2 px-2 py-1 text-sm border rounded bg-white"
                        />
                        <input
                          type="text"
                          value={sampleCustomer.price}
                          onChange={(e) => setSampleCustomer({ ...sampleCustomer, price: e.target.value })}
                          placeholder="가격"
                          className="px-2 py-1 text-sm border rounded bg-white"
                        />
                        <input
                          type="text"
                          value={sampleCustomer.departDate}
                          onChange={(e) => setSampleCustomer({ ...sampleCustomer, departDate: e.target.value })}
                          placeholder="출발일"
                          className="px-2 py-1 text-sm border rounded bg-white"
                        />
                      </div>
                    </div>

                    {/* 개인화된 메시지 */}
                    <div className="bg-white rounded p-3 border border-blue-200">
                      <p className="text-base text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {personalizeContent(selectedItem.content)}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(personalizeContent(selectedItem.content))
                          .then(() => {
                            toast({
                              title: "복사 완료",
                              description: "개인화된 메시지가 클립보드에 복사되었습니다.",
                              variant: "success",
                            });
                          })
                          .catch((err) => {
                            logger.error("[PlaybookViewer]", {
                              action: "copy-personalized-content",
                              error: err instanceof Error ? err.message : "Unknown error",
                            });
                            toast({
                              title: "복사 실패",
                              description: "클립보드 접근 권한이 없거나 HTTPS 환경이 아닙니다.",
                              variant: "destructive",
                            });
                          });
                      }}
                      className="w-full px-2 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded transition-colors"
                    >
                      복사 (개인화됨)
                    </button>

                    {/* 사용된 변수 목록 */}
                    <div>
                      <p className="text-base font-medium text-gray-700 mb-2">사용 가능한 변수:</p>
                      <div className="flex flex-wrap gap-1">
                        {PERSONALIZATION_VARS.map((var_) => (
                          <span
                            key={var_.key}
                            className="px-2 py-1 bg-gray-200 text-gray-700 text-sm rounded font-mono"
                            title={var_.label}
                          >
                            {var_.key}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Type Badge */}
                <div>
                  <h3 className="text-base font-semibold text-gray-700 uppercase mb-3 tracking-wide">스크립트 유형</h3>
                  <span className="inline-block px-4 py-2 bg-blue-100 text-blue-800 text-base rounded-full font-medium">
                    {selectedItem.type}
                  </span>
                </div>

                {/* Customer Segment Badge */}
                <div>
                  <h3 className="text-base font-semibold text-gray-700 uppercase mb-3 tracking-wide">고객 세그먼트</h3>
                  <span className="inline-block px-4 py-2 bg-purple-100 text-purple-800 text-base rounded-full font-medium">
                    {selectedItem.productCode === "ALL" ? "모든 고객" : selectedItem.productCode}
                  </span>
                </div>

                {/* Phase */}
                <div>
                  <h3 className="text-base font-semibold text-gray-700 uppercase mb-3 tracking-wide">Phase</h3>
                  <span className="inline-block px-4 py-2 bg-navy-900 text-white text-base rounded-full font-medium">
                    Phase {selectedItem.sectionOrder}
                  </span>
                </div>

                {/* ScriptNotes 추가 */}
                <ScriptNotes scriptId={selectedItem.id} />

                {/* 데이터 소스 */}
                {selectedItem?.source && (
                  <div className="text-base text-gray-600 bg-gray-50 rounded p-3 border border-gray-200">
                    출처: <span className="font-medium text-gray-700">{selectedItem.source}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-5 sticky top-6">
                <p className="text-center text-gray-600 py-8">스크립트를 선택해주세요</p>
              </div>
            )}

            {/* 클로징 신호 위젯 */}
            <div className="bg-white rounded-xl shadow-sm p-5 sticky top-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 text-lg">클로징 신호 7종</h3>
                <span className="inline-block px-3 py-1.5 bg-green-100 text-green-800 text-base font-bold rounded-full">
                  {closingCount}/7
                </span>
              </div>
              <div className="space-y-2">
                {closingSignals.map((signal) => (
                  <div key={signal.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <input
                      id={`signal-${signal.id}`}
                      type="checkbox"
                      checked={signal.checked}
                      onChange={() => toggleClosingSignal(signal.id)}
                      className="w-5 h-5 rounded text-green-600 cursor-pointer flex-shrink-0"
                    />
                    <label
                      htmlFor={`signal-${signal.id}`}
                      className="text-base text-gray-700 flex-1 cursor-pointer"
                    >
                      {signal.text}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
