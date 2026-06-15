"use client";

import React, { useState, useEffect } from "react";
import { Phone, MessageSquare, Calendar, Zap, AlertCircle } from "lucide-react";

interface CallItem {
  contactId: string;
  name: string;
  phone: string;
  priority: number;
  funnelStage: string;
  psyLens: string;
  psyTip: string;
  daysSince: number;
  lastSmsStatus?: string;
}

export function CallListView() {
  const [callList, setCallList] = useState<CallItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCallList = async () => {
      try {
        const res = await fetch("/api/dashboard/call-list-priority");
        if (!res.ok) throw new Error("콜리스트 로드 실패");
        const data = await res.json();
        setCallList(data);
      } catch (err) {
        console.error("콜리스트 로드 실패", err);
        setError(err instanceof Error ? err.message : "알 수 없는 오류");
      } finally {
        setLoading(false);
      }
    };

    fetchCallList();
  }, []);

  const handleCall = async (contactId: string, phone: string, name: string) => {
    try {
      await fetch("/api/contacts/call-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          phone,
          name,
          timestamp: new Date().toISOString(),
          duration: 0,
        }),
      });

      alert(`📞 ${name}님(${phone})에게 전화를 거세요.\n통화 기록이 저장되었습니다.`);
    } catch (err) {
      console.error("통화 기록 저장 실패", err);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600 mb-3"></div>
        <p className="text-gray-600">콜리스트 로드 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-900">콜리스트 로드 실패</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (callList.length === 0) {
    return (
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
        <Calendar className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-600">통화 대상이 없습니다</p>
      </div>
    );
  }

  const highPriority = callList.filter((c) => c.priority >= 500);
  const mediumPriority = callList.filter(
    (c) => c.priority >= 200 && c.priority < 500
  );
  const lowPriority = callList.filter((c) => c.priority < 200);

  return (
    <div className="p-6 bg-white min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">오늘의 콜 리스트</h1>
        <p className="text-gray-600 mt-1 text-sm">
          🔥 {highPriority.length}명 높음 | 📌 {mediumPriority.length}명 중간 | 📅{" "}
          {lowPriority.length}명 낮음 (총 {callList.length}명)
        </p>
      </div>

      {/* 높은 우선도 */}
      {highPriority.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-red-600" />
            <h2 className="text-lg font-bold text-red-600">
              🔥 높음 (지금 전화하세요)
            </h2>
          </div>
          <div className="space-y-3">
            {highPriority.slice(0, 10).map((item) => (
              <CallListCard
                key={item.contactId}
                item={item}
                onCall={handleCall}
              />
            ))}
          </div>
          {highPriority.length > 10 && (
            <p className="text-sm text-gray-500 mt-2">
              외 {highPriority.length - 10}명
            </p>
          )}
        </div>
      )}

      {/* 중간 우선도 */}
      {mediumPriority.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-yellow-600" />
            <h2 className="text-lg font-bold text-yellow-600">
              📌 중간 (내일 전화 가능)
            </h2>
          </div>
          <div className="space-y-3">
            {mediumPriority.slice(0, 10).map((item) => (
              <CallListCard
                key={item.contactId}
                item={item}
                onCall={handleCall}
              />
            ))}
          </div>
          {mediumPriority.length > 10 && (
            <p className="text-sm text-gray-500 mt-2">
              외 {mediumPriority.length - 10}명
            </p>
          )}
        </div>
      )}

      {/* 낮은 우선도 */}
      {lowPriority.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-bold text-gray-500">
              📅 낮음 (주말에 전화)
            </h2>
          </div>
          <div className="space-y-3">
            {lowPriority.slice(0, 10).map((item) => (
              <CallListCard
                key={item.contactId}
                item={item}
                onCall={handleCall}
              />
            ))}
          </div>
          {lowPriority.length > 10 && (
            <p className="text-sm text-gray-500 mt-2">
              외 {lowPriority.length - 10}명
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CallListCard({
  item,
  onCall,
}: {
  item: CallItem;
  onCall: (contactId: string, phone: string, name: string) => void;
}) {
  const priorityColor =
    item.priority >= 500
      ? "bg-red-50 border-red-200"
      : item.priority >= 200
        ? "bg-yellow-50 border-yellow-200"
        : "bg-gray-50 border-gray-200";

  return (
    <div
      className={`p-4 rounded-lg border ${priorityColor} hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <p className="font-bold text-lg text-gray-900">{item.name}</p>
          <p className="text-sm text-gray-600">{item.phone}</p>
        </div>
        <button
          onClick={() => onCall(item.contactId, item.phone, item.name)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium whitespace-nowrap ml-3 transition-colors"
        >
          📞 전화
        </button>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">퍼널 단계:</span>
          <span className="font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded">
            {item.funnelStage}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600">신청 후:</span>
          <span className="font-medium">{item.daysSince}일</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600">심리학 렌즈:</span>
          <span className="font-medium bg-purple-100 text-purple-800 px-2 py-1 rounded">
            {item.psyLens}
          </span>
        </div>
        <div className="bg-blue-100 p-3 rounded border-l-4 border-blue-400 mt-2">
          <p className="text-blue-800 font-medium text-sm">{item.psyTip}</p>
        </div>
      </div>
    </div>
  );
}
