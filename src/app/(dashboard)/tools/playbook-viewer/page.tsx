"use client";

import { useState, useEffect } from "react";
import { Copy, Check, ChevronDown, BookOpen } from "lucide-react";

type PlaybookItem = {
  id: string;
  type: string;
  title: string;
  content: string;
  priority: number;
  scriptTab: string;
  productCode: string;
  sectionOrder: number;
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
  "Loss Aversion": { bg: "bg-purple-100", text: "text-purple-800", label: "손실회피 (Kahneman)" },
  "Social Proof": { bg: "bg-pink-100", text: "text-pink-800", label: "사회증명 (Cialdini)" },
  "Narrative Transportation": { bg: "bg-blue-100", text: "text-blue-800", label: "내러티브 (Green&Brock)" },
  "Priming": { bg: "bg-green-100", text: "text-green-800", label: "프라이밍" },
  "Scarcity": { bg: "bg-orange-100", text: "text-orange-800", label: "희소성 (Cialdini)" },
  "Commitment": { bg: "bg-red-100", text: "text-red-800", label: "약속의 일관성 (Cialdini)" },
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

  useEffect(() => {
    fetchPlaybooks();
  }, [selectedPhase, selectedSegment]);

  const fetchPlaybooks = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedPhase !== null) params.append("phase", selectedPhase.toString());
      if (selectedSegment && selectedSegment !== "ALL") {
        params.append("customerSegment", selectedSegment);
      }

      const res = await fetch(`/api/tools/playbook?${params.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setItems(data.items || []);
        // 첫 번째 아이템 자동 선택
        if (data.items?.length > 0) {
          setSelectedItem(data.items[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch playbooks:", err);
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
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <p className="text-gray-400">로딩 중...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center">
                <p className="text-gray-400">선택된 필터에 맞는 스크립트가 없습니다.</p>
              </div>
            ) : (
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
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Phase</h4>
                  <span className="inline-block px-3 py-1.5 bg-navy-900 text-white text-sm rounded-full font-medium">
                    Phase {selectedItem.sectionOrder}
                  </span>
                </div>
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
