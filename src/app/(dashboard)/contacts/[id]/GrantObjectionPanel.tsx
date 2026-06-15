"use client";

import { useState } from "react";
import { ChevronDown, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/lib/api/use-toast";
import { logger } from "@/lib/logger";

interface GrantObjectionPanelProps {
  contactId: string;
  contactName: string;
  lensInfo?: Record<string, number>;
}

const LENS_COLORS = {
  L1: { bg: "#FFFACD", border: "#FFD700", label: "🔴 가격 민감도 (L1)" },
  L2: { bg: "#EBF5FB", border: "#4A90E2", label: "🔵 준비 복잡도 (L2)" },
  L3: { bg: "#F4ECF7", border: "#9B59B6", label: "🟣 경쟁사 비교 (L3)" },
  L6: { bg: "#FADBD8", border: "#E74C3C", label: "🔴 타이밍/손실 (L6)" },
  L10: { bg: "#D5F4E6", border: "#27AE60", label: "🟢 즉시 구매 (L10)" },
};

export function GrantObjectionPanel({
  contactId,
  contactName,
  lensInfo,
}: GrantObjectionPanelProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [activeLens, setActiveLens] = useState<"L1" | "L2" | "L3" | "L6" | "L10">("L1");
  const [selectedObjectionId, setSelectedObjectionId] = useState<string>("");
  const [selectedResponses, setSelectedResponses] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // 자동 감지: lensInfo에서 점수 높은 렌즈 우선 표시
  const activeLenses = (
    ["L1", "L2", "L3", "L6", "L10"] as const
  ).filter((lens) => (lensInfo?.[lens] ?? 0) > 0);

  // 샘플 이의 목록
  const sampleObjections = {
    L1: [
      { id: "obj-l1-001", question: "가격이 너무 비싼데요" },
      { id: "obj-l1-002", question: "할부가 가능한가요?" },
    ],
    L6: [
      { id: "obj-l6-001", question: "지금 바로 결정하기가 힘들어요" },
    ],
  };

  const currentObjections = (sampleObjections as any)[activeLens] || [];

  const getPreviewMessages = () => {
    if (!selectedResponses.size) return [];
    return ["선택한 응답이 여기 표시됩니다"];
  };

  const handleSendResponses = async () => {
    if (selectedResponses.size === 0) {
      toast({
        title: "선택 필요",
        description: "최소 1개 이상의 응답을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}/objection-send`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectionId: selectedObjectionId,
          lensId: activeLens,
          responseIds: Array.from(selectedResponses),
          messages: getPreviewMessages(),
        }),
      });

      const data = await res.json();
      if (data.ok) {
        toast({
          title: "발송 완료",
          description: `${data.message}`,
          variant: "default",
        });
        // 선택 초기화
        setSelectedResponses(new Set());
        setSelectedObjectionId("");
      } else {
        toast({
          title: "발송 실패",
          description: data.message || "다시 시도해주세요.",
          variant: "destructive",
        });
        logger.error("[GrantObjectionPanel] send error", { message: data.message });
      }
    } catch (err) {
      toast({
        title: "네트워크 오류",
        description: "발송에 실패했습니다.",
        variant: "destructive",
      });
      logger.error("[GrantObjectionPanel] network error", { err });
    } finally {
      setIsSending(false);
    }
  };

  // const objections = getObjectionsByLens(activeLens);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <span className="text-lg">🎯</span>
          고객 이의 대응 가이드
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="px-4 py-4 border-t border-gray-100 space-y-6">
          {/* Info Banner */}
          <div className="flex gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">고객 유형별 맞춤 이의 대응</p>
              <p className="text-xs mt-1">
                고객의 주요 이의를 선택하고 맞춤형 응답을 발송하세요. 점수가 자동으로
                업데이트됩니다.
              </p>
            </div>
          </div>

          {/* 렌즈 탭 */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {activeLenses.length > 0 ? (
              activeLenses.map((lens) => (
                <button
                  key={lens}
                  onClick={() => {
                    setActiveLens(lens);
                    setSelectedObjectionId("");
                    setSelectedResponses(new Set());
                  }}
                  className={`px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap transition-all ${
                    activeLens === lens
                      ? `bg-gray-900 text-white`
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                  style={
                    activeLens === lens
                      ? {
                          backgroundColor: LENS_COLORS[lens as keyof typeof LENS_COLORS].border,
                          color: "white",
                        }
                      : {}
                  }
                >
                  {LENS_COLORS[lens as keyof typeof LENS_COLORS].label}
                </button>
              ))
            ) : (
              <div className="text-xs text-gray-500">
                고객 유형 분석 정보가 없습니다. 상담 내용을 먼저 입력해주세요.
              </div>
            )}
          </div>

          {/* 이의 선택 */}
          {activeLenses.includes(activeLens) && (
            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-900">
                💬 고객의 이의 유형 선택
              </label>
              <select
                value={selectedObjectionId}
                onChange={(e) => {
                  setSelectedObjectionId(e.target.value);
                  setSelectedResponses(new Set());
                  setShowPreview(false);
                }}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">-- 이의 유형 선택 --</option>
                {currentObjections.map((obj: any) => (
                  <option key={obj.id} value={obj.id}>
                    💭 {obj.question}
                  </option>
                ))}
              </select>

              {/* 응답 선택 */}
              {selectedObjectionId && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-900">
                    ☑️ 발송할 응답 선택 (복수 선택 가능)
                  </label>
                  <div className="space-y-2 bg-gray-50 rounded-lg p-3 border border-gray-200">
                    {["immediate", "newlywed", "parent"].map((type) => (
                      <label
                        key={type}
                        className="flex items-start gap-3 p-2 rounded hover:bg-white transition-colors cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedResponses.has(type)}
                          onChange={(e) => {
                            const newSet = new Set(selectedResponses);
                            if (e.target.checked) {
                              newSet.add(type);
                            } else {
                              newSet.delete(type);
                            }
                            setSelectedResponses(newSet);
                          }}
                          className="w-4 h-4 mt-1 rounded border-gray-300 text-purple-600"
                        />
                        <div className="flex-1 text-sm">
                          <p className="font-medium text-gray-900">
                            {type === "immediate"
                              ? "📱 즉시 응답"
                              : type === "newlywed"
                              ? "👰 신혼부부 버전"
                              : "👨‍👩‍👧 자녀 있는 부모"}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            {type === "immediate"
                              ? "고객의 이의에 바로 대응하는 메시지"
                              : type === "newlywed"
                              ? "신혼부부 고객에게 맞춤형 메시지"
                              : "자녀가 있는 부모 고객을 위한 메시지"}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* 미리보기 */}
              {selectedResponses.size > 0 && (
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="w-full px-3 py-2 text-sm font-medium text-purple-600 bg-white border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors"
                >
                  {showPreview ? "📱 미리보기 닫기" : "📱 미리보기 보기"}
                </button>
              )}

              {/* 미리보기 패널 */}
              {showPreview && selectedResponses.size > 0 && (
                <div className="mt-4 space-y-3 bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-xs font-semibold text-gray-600 mb-3">
                    📱 발송될 메시지 미리보기
                  </p>

                  {getPreviewMessages().map((msg, idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-gray-300 rounded-lg p-3 space-y-1"
                    >
                      <p className="text-xs font-bold text-gray-700">
                        메시지 {idx + 1} / {getPreviewMessages().length}
                      </p>
                      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                        {msg}
                      </p>
                    </div>
                  ))}

                  <div className="mt-2 p-2 bg-yellow-50 rounded text-xs text-yellow-800">
                    💡 이 메시지들은 저장 후 SMS로 발송됩니다.
                  </div>
                </div>
              )}

              {/* 발송 버튼 */}
              {selectedResponses.size > 0 && (
                <button
                  onClick={handleSendResponses}
                  disabled={isSending}
                  className="w-full px-4 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isSending ? "발송 중..." : `이 응답 SMS 발송 (${selectedResponses.size}개)`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
