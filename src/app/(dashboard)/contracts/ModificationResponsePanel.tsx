"use client";

import React, { useState } from "react";
import {
  CheckCircle,
  XCircle,
  Lightbulb,
  Send,
  ChevronRight,
  AlertCircle,
  Clock,
  X,
} from "lucide-react";

interface ModificationResponsePanelProps {
  requestId: string;
  fieldName: string;
  newValue: string;
  reason?: string;
  status: string;
  responseMessage?: string;
  expiresAt: Date;
  onApprove: () => Promise<void>;
  onReject: (message: string) => Promise<void>;
  onProposeAlternative: (value: string, reason: string) => Promise<void>;
  onClose: () => void;
}

type PanelAction = "view" | "reject" | "alternative";

export function ModificationResponsePanel({
  requestId,
  fieldName,
  newValue,
  reason,
  status,
  responseMessage,
  expiresAt,
  onApprove,
  onReject,
  onProposeAlternative,
  onClose,
}: ModificationResponsePanelProps) {
  const [action, setAction] = useState<PanelAction>("view");
  const [rejectionReason, setRejectionReason] = useState("");
  const [alternativeValue, setAlternativeValue] = useState("");
  const [alternativeReason, setAlternativeReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const isCompleted = !["REQUESTED"].includes(status);
  const remainingDays = Math.ceil(
    (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const isExpiring = remainingDays <= 2;

  const handleApprove = async () => {
    setError("");
    setIsLoading(true);
    try {
      await onApprove();
      onClose();
    } catch (err: any) {
      setError(err.message || "승인 처리 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setError("거절 사유를 입력해주세요");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      await onReject(rejectionReason);
      onClose();
    } catch (err: any) {
      setError(err.message || "거절 처리 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleProposeAlternative = async () => {
    if (!alternativeValue.trim()) {
      setError("대안 값을 입력해주세요");
      return;
    }
    if (!alternativeReason.trim()) {
      setError("대안 근거를 입력해주세요");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      await onProposeAlternative(alternativeValue, alternativeReason);
      onClose();
    } catch (err: any) {
      setError(err.message || "대안 제시 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 필드명 라벨화
  const getFieldLabel = (name: string) => {
    const labels: Record<string, string> = {
      tripDate: "📅 여행 날짜",
      roomType: "🏨 객실 타입",
      roomCategory: "🛏️ 객실 카테고리",
      price: "💰 가격",
      passengerName: "👤 탑승자명",
      passengerCount: "👥 탑승자 수",
      specialRequest: "💬 특별 요청",
      dietaryRestriction: "🍽️ 식이 제한",
      pickupLocation: "📍 픽업 위치",
      returnDate: "🔄 복귀 날짜",
    };
    return labels[name] || name;
  };

  // 상태 배지
  const getStatusBadge = () => {
    const badges: Record<string, { label: string; color: string; icon: string }> = {
      REQUESTED: {
        label: "검토 중",
        color: "bg-yellow-100 text-yellow-800",
        icon: "⏳",
      },
      APPROVED: {
        label: "승인됨",
        color: "bg-green-100 text-green-800",
        icon: "✅",
      },
      REJECTED: { label: "거절됨", color: "bg-red-100 text-red-800", icon: "❌" },
      ALTERNATIVE_PROPOSED: {
        label: "대안 제시",
        color: "bg-purple-100 text-purple-800",
        icon: "💡",
      },
      EXPIRED: { label: "만료됨", color: "bg-gray-100 text-gray-800", icon: "⏰" },
      COMPLETED: {
        label: "완료됨",
        color: "bg-blue-100 text-blue-800",
        icon: "✨",
      },
    };

    const badge = badges[status] || badges.REQUESTED;
    return badge;
  };

  const statusBadge = getStatusBadge();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-lg w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-300">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 sm:p-6 flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
              🔍 수정 요청 검토
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              수정 요청 #{requestId.substring(0, 8)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="닫기"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="p-4 sm:p-6 space-y-6">
          {/* 상태 배지 */}
          <div className="flex items-center justify-between">
            <span
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm ${statusBadge.color}`}
            >
              <span>{statusBadge.icon}</span>
              {statusBadge.label}
            </span>
            {isExpiring && status === "REQUESTED" && (
              <span className="text-sm font-medium text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {remainingDays}일 남음
              </span>
            )}
          </div>

          {/* 요청 내용 */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-900 font-semibold mb-3">
              📋 수정 요청 내용
            </p>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-blue-700 opacity-75 mb-1">항목</p>
                <p className="font-semibold text-blue-950">
                  {getFieldLabel(fieldName)}
                </p>
              </div>

              <div className="flex items-center justify-between p-2 bg-white bg-opacity-50 rounded">
                <div>
                  <p className="text-xs text-blue-700 opacity-75 mb-1">신규 값</p>
                  <code className="font-mono font-bold text-blue-900">
                    {newValue}
                  </code>
                </div>
                <ChevronRight className="w-5 h-5 text-blue-400" />
              </div>

              {reason && (
                <div>
                  <p className="text-xs text-blue-700 opacity-75 mb-1">요청 사유</p>
                  <p className="text-blue-900 italic">"{reason}"</p>
                </div>
              )}
            </div>
          </div>

          {/* 관리자 응답 (이미 처리된 경우) */}
          {isCompleted && responseMessage && (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-700 font-semibold mb-2">
                📝 관리자 응답
              </p>
              <p className="text-gray-800 leading-relaxed">{responseMessage}</p>
            </div>
          )}

          {/* 에러 메시지 */}
          {error && (
            <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* 유효기한 정보 */}
          <div className="flex items-start gap-3 p-3.5 bg-blue-50 border border-blue-200 rounded-lg">
            <Clock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">유효기한</p>
              <p>
                {expiresAt.toLocaleDateString("ko-KR")}{" "}
                {expiresAt.toLocaleTimeString("ko-KR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              {remainingDays > 0 && (
                <p className="text-xs opacity-80 mt-1">
                  약 {remainingDays}일 {Math.abs(24 - (Date.now() % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))}시간 남음
                </p>
              )}
            </div>
          </div>

          {/* 액션 선택 */}
          {!isCompleted ? (
            <div className="space-y-4">
              {action === "view" ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={handleApprove}
                    disabled={isLoading}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all active:scale-95"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        처리 중
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        ✅ 승인
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setAction("reject")}
                    disabled={isLoading}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 font-medium transition-all"
                  >
                    <XCircle className="w-5 h-5" />
                    ❌ 거절
                  </button>

                  <button
                    onClick={() => setAction("alternative")}
                    disabled={isLoading}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50 font-medium transition-all"
                  >
                    <Lightbulb className="w-5 h-5" />
                    💡 대안 제시
                  </button>
                </div>
              ) : action === "reject" ? (
                <div className="space-y-4 bg-red-50 p-4 rounded-lg border border-red-200">
                  <h4 className="font-semibold text-red-900 flex items-center gap-2">
                    <XCircle className="w-5 h-5" />
                    거절 사유 입력
                  </h4>

                  <textarea
                    value={rejectionReason}
                    onChange={(e) =>
                      setRejectionReason(e.target.value.substring(0, 500))
                    }
                    placeholder="거절 사유를 명확하게 설명해주세요. 이 메시지는 고객에게 전달됩니다."
                    maxLength={500}
                    className="w-full px-4 py-3 border border-red-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                    rows={4}
                  />
                  <p className="text-xs text-red-700">
                    {rejectionReason.length}/500자
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={handleReject}
                      disabled={isLoading || !rejectionReason.trim()}
                      className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium transition-all flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          처리 중
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          거절 처리
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setAction("view")}
                      disabled={isLoading}
                      className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition-all"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : action === "alternative" ? (
                <div className="space-y-4 bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <h4 className="font-semibold text-purple-900 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5" />
                    대안 제시
                  </h4>

                  <div>
                    <label className="block text-sm font-medium text-purple-900 mb-2">
                      대안 값
                    </label>
                    <input
                      type="text"
                      value={alternativeValue}
                      onChange={(e) => setAlternativeValue(e.target.value)}
                      placeholder="우리가 제시하는 대안값 (예: 스탠다드 객실)"
                      className="w-full px-4 py-2.5 border border-purple-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-purple-900 mb-2">
                      대안 근거
                    </label>
                    <textarea
                      value={alternativeReason}
                      onChange={(e) =>
                        setAlternativeReason(e.target.value.substring(0, 300))
                      }
                      placeholder="왜 이 대안이 고객의 상황에 더 적합한지 설명해주세요."
                      maxLength={300}
                      className="w-full px-4 py-3 border border-purple-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                      rows={3}
                    />
                    <p className="text-xs text-purple-700 mt-1">
                      {alternativeReason.length}/300자
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded border border-purple-300 text-sm text-purple-800">
                    <p className="font-medium mb-1">⏰ 기본 절차</p>
                    <p>
                      고객에게 이 대안을 제시하면, 고객은 3일의 추가 검토 시간을 받게 됩니다.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleProposeAlternative}
                      disabled={
                        isLoading ||
                        !alternativeValue.trim() ||
                        !alternativeReason.trim()
                      }
                      className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium transition-all flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          처리 중
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          대안 제시
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setAction("view")}
                      disabled={isLoading}
                      className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition-all"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="p-4 bg-gray-100 rounded-lg text-center border border-gray-300">
              <p className="text-sm text-gray-700 font-medium">
                💬 이미 처리된 요청입니다.
              </p>
              <p className="text-xs text-gray-600 mt-1">
                상태: <span className="font-semibold">{statusBadge.label}</span>
              </p>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4 sm:p-6 text-center">
          <p className="text-xs text-gray-600">
            📋 이 요청의 모든 변경사항은 감사 로그에 기록됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
