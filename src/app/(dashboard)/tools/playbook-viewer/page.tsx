"use client";

import { useState, useEffect } from "react";
import { Copy, Check, ChevronDown, BookOpen, Loader2 } from "lucide-react";
import { detectSegment, SEGMENT_PROFILES, SEGMENT_RECOMMENDED_TECHNIQUES } from "@/lib/segment-detector";
import type { Segment } from "@/lib/segment-detector";

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

const PSYCHOLOGY_BADGES = {
  "Loss Aversion": { bg: "bg-purple-100", text: "text-purple-800", label: "손실회피", desc: "손실을 이익보다 2배 크게 인지" },
  "Social Proof": { bg: "bg-pink-100", text: "text-pink-800", label: "사회증명", desc: "남과 같은 행동을 추종" },
  "Narrative Transportation": { bg: "bg-blue-100", text: "text-blue-800", label: "내러티브", desc: "스토리텔링으로 감정 몰입" },
  "Priming": { bg: "bg-green-100", text: "text-green-800", label: "프라이밍", desc: "사전 자극으로 판단 영향" },
  "Scarcity": { bg: "bg-orange-100", text: "text-orange-800", label: "희소성", desc: "제한된 시간/수량으로 긴급성 생성" },
  "Commitment": { bg: "bg-red-100", text: "text-red-800", label: "약속의일관성", desc: "작은 약속→큰 약속으로 확대" },
};

const SHINMIN_STEPS = {
  "1": { label: "Step 1: 라포 형성", color: "bg-blue-100 text-blue-800", emoji: "👋" },
  "2": { label: "Step 2: 니즈 SPIN", color: "bg-green-100 text-green-800", emoji: "❓" },
  "3": { label: "Step 3: 욕망 증폭", color: "bg-purple-100 text-purple-800", emoji: "✨" },
  "4": { label: "Step 4: 감정 피크", color: "bg-pink-100 text-pink-800", emoji: "❤️" },
  "5": { label: "Step 5: 클로징", color: "bg-red-100 text-red-800", emoji: "🎯" },
};

const MONIKA_AMPLIFY_LEVELS = {
  "1": "눈 떠주기",
  "2": "필요성 공감",
  "3": "감정 증폭",
  "4": "행동 유도",
};

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
  const [items, setItems] = useState<PlaybookItem[]>([]);
  const [selectedPhase, setSelectedPhase] = useState<number | null>(null);
  const [selectedSegment, setSelectedSegment] = useState("ALL");
  const [selectedItem, setSelectedItem] = useState<PlaybookItem | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [closingSignals, setClosingSignals] = useState<ClosingSignal[]>(CLOSING_SIGNALS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [detectedSegment, setDetectedSegment] = useState<Segment>("A");

  useEffect(() => {
    fetchPlaybooks();
  }, [selectedPhase, selectedSegment]);

  const fetchPlaybooks = async () => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (selectedPhase !== null) params.append("phase", selectedPhase.toString());
      if (selectedSegment && selectedSegment !== "ALL") {
        params.append("customerSegment", selectedSegment);
      }

      const res = await fetch(`/api/tools/playbook?${params.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setItems(data.items || []);
        // 현재 선택 아이템 유지 (가능한 경우)
        const isCurrentItemInResults = (data.items || []).some(item => item.id === selectedItem?.id);
        if (!isCurrentItemInResults && data.items?.length > 0) {
          setSelectedItem(data.items[0]);
        } else if (!data.items?.length) {
          setSelectedItem(null);
        }
      } else {
        setError("스크립트 데이터를 불러오지 못했습니다.");
      }
    } catch (err) {
      console.error("Failed to fetch playbooks:", err);
      setError("스크립트를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const toggleClosingSignal = (id: string) => {
    setClosingSignals(
      closingSignals.map((s) => (s.id === id ? { ...s, checked: !s.checked } : s))
    );
  };

  const closingCount = closingSignals.filter((s) => s.checked).length;

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
              <p className="text-xs text-gray-600 mt-1">{SEGMENT_PROFILES[detectedSegment].desc}</p>
            </div>
            <div className="text-3xl font-bold text-indigo-600">{detectedSegment}</div>
          </div>
          <div className="mt-3 flex gap-2 flex-wrap">
            {SEGMENT_RECOMMENDED_TECHNIQUES[detectedSegment].map((tech) => (
              <span key={tech} className="inline-block px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded font-medium">
                {tech}
              </span>
            ))}
          </div>
        </div>

        {/* 헤더 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-navy-900" />
              <div>
                <h1 className="text-2xl font-bold text-navy-900">크루즈닷 콜 플레이북 v1.0</h1>
                <p className="text-sm text-gray-500">신민형 5단계 통합 스크립트 라이브러리</p>
              </div>
            </div>

            {/* 고객세그먼트 드롭다운 */}
            <div className="relative w-full sm:w-auto">
              <select
                value={selectedSegment}
                onChange={(e) => setSelectedSegment(e.target.value)}
                className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 text-sm font-medium text-gray-900 hover:border-navy-900 focus:outline-none focus:border-navy-900"
              >
                {CUSTOMER_SEGMENTS.map((seg) => (
                  <option key={seg.key} value={seg.key}>
                    {seg.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Phase 필터 */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-700">Phase:</span>
            <button
              onClick={() => setSelectedPhase(null)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedPhase === null
                  ? "bg-navy-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              ALL
            </button>
            {phases.map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPhase(p)}
                className={`w-10 h-10 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center ${
                  selectedPhase === p
                    ? "bg-navy-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

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
                <p className="text-xs text-gray-400 mt-1">다른 필터를 시도해주세요.</p>
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
                        <span className="inline-block px-2 py-1 bg-navy-900 text-white text-xs font-semibold rounded">
                          Phase {item.sectionOrder}
                        </span>
                        <span className="inline-block px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded">
                          {item.type}
                        </span>
                        {item.productCode !== "ALL" && (
                          <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                            {item.productCode}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-900 text-sm mb-2">{item.title}</h3>
                      <p className="text-sm text-gray-600 line-clamp-2">{item.content}</p>
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
              <div className="bg-white rounded-xl shadow-sm p-5 sticky top-6 max-h-[calc(100vh-120px)] overflow-y-auto">
                <h2 className="text-lg font-bold text-gray-900 mb-4">{selectedItem.title}</h2>

                {/* Script */}
                <div className="mb-5">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">상담사 멘트</h4>
                  <div className="bg-gray-50 rounded-lg p-3 mb-2">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
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

                {/* 신민형 5단계 배지 */}
                {selectedItem?.shinminStep && (
                  <div className="mb-5">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">신민형 5단계</h4>
                    <span className={`inline-block px-3 py-1.5 rounded-lg text-sm font-semibold ${SHINMIN_STEPS[selectedItem.shinminStep]?.color}`}>
                      {SHINMIN_STEPS[selectedItem.shinminStep]?.emoji} {SHINMIN_STEPS[selectedItem.shinminStep]?.label}
                    </span>
                  </div>
                )}

                {/* 모니카 욕망 증폭 레벨 */}
                {selectedItem?.type === "AMPLIFY" && selectedItem?.monikaAmplifyLevel && (
                  <div className="mb-5 bg-purple-50 border-l-4 border-purple-500 rounded p-3">
                    <p className="text-xs font-semibold text-purple-900 uppercase mb-1">모니카 욕망 증폭</p>
                    <p className="text-sm font-bold text-purple-900">
                      레벨 {selectedItem.monikaAmplifyLevel}: {MONIKA_AMPLIFY_LEVELS[selectedItem.monikaAmplifyLevel]}
                    </p>
                    <ul className="text-xs text-purple-700 mt-2 list-disc list-inside">
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
                {selectedItem?.psychology && (
                  <div className="mb-5">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">심리학 이론</h4>
                    <div className={`inline-block px-3 py-1.5 rounded-lg text-sm font-medium ${PSYCHOLOGY_BADGES[selectedItem.psychology]?.bg} ${PSYCHOLOGY_BADGES[selectedItem.psychology]?.text}`}>
                      {PSYCHOLOGY_BADGES[selectedItem.psychology]?.label}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{PSYCHOLOGY_BADGES[selectedItem.psychology]?.desc}</p>
                  </div>
                )}

                {/* Type Badge */}
                <div className="mb-5">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">스크립트 유형</h4>
                  <span className="inline-block px-3 py-1.5 bg-blue-100 text-blue-800 text-sm rounded-full font-medium">
                    {selectedItem.type}
                  </span>
                </div>

                {/* Customer Segment Badge */}
                <div className="mb-5">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">고객 세그먼트</h4>
                  <span className="inline-block px-3 py-1.5 bg-purple-100 text-purple-800 text-sm rounded-full font-medium">
                    {selectedItem.productCode === "ALL" ? "모든 고객" : selectedItem.productCode}
                  </span>
                </div>

                {/* Phase */}
                <div className="mb-5">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Phase</h4>
                  <span className="inline-block px-3 py-1.5 bg-navy-900 text-white text-sm rounded-full font-medium">
                    Phase {selectedItem.sectionOrder}
                  </span>
                </div>

                {/* 데이터 소스 */}
                {selectedItem?.source && (
                  <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 border border-gray-200">
                    출처: <span className="font-medium text-gray-700">{selectedItem.source}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-5 sticky top-6">
                <p className="text-center text-gray-400 py-8">스크립트를 선택해주세요</p>
              </div>
            )}

            {/* 클로징 신호 위젯 */}
            <div className="bg-white rounded-xl shadow-sm p-5 sticky top-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 text-sm">클로징 신호 7종</h3>
                <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded">
                  {closingCount}/7
                </span>
              </div>
              <div className="space-y-2">
                {closingSignals.map((signal) => (
                  <label
                    key={signal.id}
                    className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={signal.checked}
                      onChange={() => toggleClosingSignal(signal.id)}
                      className="w-4 h-4 rounded text-green-600"
                    />
                    <span className="text-sm text-gray-700 flex-1">{signal.text}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
