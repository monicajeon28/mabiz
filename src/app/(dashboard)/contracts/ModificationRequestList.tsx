"use client";

import React, { useMemo } from "react";
import {
  Clock,
  CheckCircle,
  XCircle,
  Lightbulb,
  AlertCircle,
  Calendar,
} from "lucide-react";

interface ModificationRequest {
  id: string;
  fieldName: string;
  newValue: string;
  reason?: string;
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "ALTERNATIVE_PROPOSED" | "EXPIRED";
  requestedAt: Date;
  expiresAt: Date;
  appliedLenses?: string[];
  responseMessage?: string;
}

interface ModificationRequestListProps {
  requests: ModificationRequest[];
  onSelectRequest: (requestId: string) => void;
  isLoading?: boolean;
}

type FilterStatus = "ALL" | "REQUESTED" | "APPROVED" | "REJECTED" | "ALTERNATIVE_PROPOSED" | "EXPIRED";

const STATUS_CONFIG: Record<
  ModificationRequest["status"],
  { badge: string; icon: React.ReactNode; color: string; bgColor: string }
> = {
  REQUESTED: {
    badge: "검토 중",
    icon: <Clock className="w-3 h-3" />,
    color: "text-yellow-700",
    bgColor: "bg-yellow-50 border-yellow-200",
  },
  APPROVED: {
    badge: "승인됨",
    icon: <CheckCircle className="w-3 h-3" />,
    color: "text-green-700",
    bgColor: "bg-green-50 border-green-200",
  },
  REJECTED: {
    badge: "거절됨",
    icon: <XCircle className="w-3 h-3" />,
    color: "text-red-700",
    bgColor: "bg-red-50 border-red-200",
  },
  ALTERNATIVE_PROPOSED: {
    badge: "대안 제시",
    icon: <Lightbulb className="w-3 h-3" />,
    color: "text-purple-700",
    bgColor: "bg-purple-50 border-purple-200",
  },
  EXPIRED: {
    badge: "만료됨",
    icon: <AlertCircle className="w-3 h-3" />,
    color: "text-gray-700",
    bgColor: "bg-gray-50 border-gray-200",
  },
};

const FIELD_LABELS: Record<string, string> = {
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

export function ModificationRequestList({
  requests,
  onSelectRequest,
  isLoading = false,
}: ModificationRequestListProps) {
  const [filter, setFilter] = React.useState<FilterStatus>("ALL");

  const filtered = useMemo(() => {
    if (filter === "ALL") return requests;
    return requests.filter((r) => r.status === filter);
  }, [requests, filter]);

  const statusTabs: FilterStatus[] = [
    "ALL",
    "REQUESTED",
    "APPROVED",
    "REJECTED",
    "ALTERNATIVE_PROPOSED",
    "EXPIRED",
  ];

  const getStatusLabel = (status: FilterStatus) => {
    const labels: Record<FilterStatus, string> = {
      ALL: "전체",
      REQUESTED: "검토 중",
      APPROVED: "승인됨",
      REJECTED: "거절됨",
      ALTERNATIVE_PROPOSED: "대안 제시",
      EXPIRED: "만료됨",
    };
    return labels[status];
  };

  const getRemainingTime = (expiresAt: Date) => {
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();

    if (diff < 0) return "만료됨";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
      return `${days}일 ${hours}시간`;
    } else if (hours > 0) {
      return `${hours}시간`;
    } else {
      return "곧 만료";
    }
  };

  const getFieldLabel = (fieldName: string) => {
    return FIELD_LABELS[fieldName] || fieldName;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold mb-4">📋 수정 요청 목록</h3>
        <div className="flex justify-center py-12">
          <div className="animate-pulse flex items-center gap-2">
            <div className="w-5 h-5 bg-blue-500 rounded-full animate-bounce"></div>
            <span className="text-gray-600">로딩 중...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-bold mb-4">📋 수정 요청 목록</h3>

        {/* 필터 탭 */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {statusTabs.map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                filter === status
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {getStatusLabel(status)}
              {status !== "ALL" && (
                <span className="ml-2 text-xs opacity-70">
                  ({requests.filter((r) => r.status === status).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 요청 목록 */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {requests.length === 0
              ? "아직 수정 요청이 없습니다."
              : "해당하는 수정 요청이 없습니다."}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            필요한 경우 위의 양식에서 수정 요청을 작성해주세요.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((request) => {
            const statusConfig = STATUS_CONFIG[request.status];
            return (
              <button
                key={request.id}
                onClick={() => onSelectRequest(request.id)}
                className={`w-full text-left p-4 border border-gray-200 rounded-lg transition-all hover:shadow-md hover:border-gray-300 active:scale-98 ${statusConfig.bgColor}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-3 flex-1">
                    <span className="text-2xl mt-0.5">
                      {getFieldLabel(request.fieldName).charAt(0)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">
                        {getFieldLabel(request.fieldName)}
                      </p>
                      <p className="text-xs text-gray-600 mt-1 truncate">
                        신규 값:{" "}
                        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-medium text-gray-800">
                          {request.newValue.substring(0, 30)}
                          {request.newValue.length > 30 ? "..." : ""}
                        </code>
                      </p>
                    </div>
                  </div>

                  {/* 상태 배지 */}
                  <div
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ml-2 ${statusConfig.color} bg-white border ${statusConfig.color.replace("text-", "border-").replace("-700", "-300")}`}
                  >
                    {statusConfig.icon}
                    {statusConfig.badge}
                  </div>
                </div>

                {/* 요청 사유 */}
                {request.reason && (
                  <p className="text-sm text-gray-700 mb-2 italic leading-relaxed">
                    💭 "{request.reason.substring(0, 60)}
                    {request.reason.length > 60 ? "..." : ""}"
                  </p>
                )}

                {/* 심리학 렌즈 (있을 경우) */}
                {request.appliedLenses && request.appliedLenses.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {request.appliedLenses.map((lens) => (
                      <span
                        key={lens}
                        className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium"
                      >
                        {lens}
                      </span>
                    ))}
                  </div>
                )}

                {/* 타임스탬프 */}
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {request.requestedAt.toLocaleDateString("ko-KR")}
                  </span>
                  {request.status === "EXPIRED" ? (
                    <span className="text-red-600 font-medium">만료됨</span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {getRemainingTime(request.expiresAt)}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* 요약 통계 */}
      {requests.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">전체</p>
              <p className="text-lg font-bold text-gray-900">{requests.length}</p>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <p className="text-xs text-yellow-600 mb-1">검토 중</p>
              <p className="text-lg font-bold text-yellow-700">
                {requests.filter((r) => r.status === "REQUESTED").length}
              </p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-xs text-green-600 mb-1">승인</p>
              <p className="text-lg font-bold text-green-700">
                {requests.filter((r) => r.status === "APPROVED").length}
              </p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <p className="text-xs text-purple-600 mb-1">대안</p>
              <p className="text-lg font-bold text-purple-700">
                {requests.filter((r) => r.status === "ALTERNATIVE_PROPOSED").length}
              </p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-xs text-red-600 mb-1">거절</p>
              <p className="text-lg font-bold text-red-700">
                {requests.filter((r) => r.status === "REJECTED").length}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
