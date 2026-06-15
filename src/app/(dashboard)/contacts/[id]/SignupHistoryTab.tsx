"use client";

import React, { useState, useEffect } from "react";
import { Calendar, MapPin, Hash } from "lucide-react";

interface SignupRecord {
  index: number;
  landingPageId?: string;
  landingPageTitle?: string;
  groupId?: string;
  groupName?: string;
  createdAt: string;
  email?: string;
  phone?: string;
  daysSinceLanding?: number;
}

interface SignupHistoryTabProps {
  contactId: string;
}

export function SignupHistoryTab({ contactId }: SignupHistoryTabProps) {
  const [history, setHistory] = useState<SignupRecord[]>([]);
  const [signupCount, setSignupCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/contacts/${contactId}/signup-history`, {
          credentials: "include",
        });
        const data = await res.json();
        if (data.ok) {
          setSignupCount(data.signupCount);
          setHistory(data.history || []);
        }
      } catch (err) {
        console.error("신청 이력 로드 실패", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [contactId]);

  if (loading) {
    return <div className="p-4 text-center text-gray-500">로드 중...</div>;
  }

  if (history.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>신청 이력이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* 신청 횟수 요약 */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <p className="text-sm text-gray-600">총 신청 횟수</p>
        <p className="text-3xl font-bold text-blue-600">{signupCount}번</p>
      </div>

      {/* 신청 이력 리스트 */}
      <div className="space-y-3">
        {history.map((record) => (
          <div
            key={`${record.index}-${record.createdAt}`}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            {/* 헤더: 신청 번호 + 날짜 */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {/* 신청 번호 배지 */}
                <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-full font-bold text-sm">
                  {record.index}
                </div>
                <div>
                  <p className="font-bold text-gray-900">
                    {record.index === 1
                      ? "첫 신청"
                      : record.index === 2
                      ? "두 번째 신청"
                      : `${record.index}번째 신청`}
                  </p>
                  <p className="text-xs text-gray-500">
                    {record.daysSinceLanding !== undefined
                      ? `${record.daysSinceLanding}일 전`
                      : ""}
                  </p>
                </div>
              </div>

              {/* 신청 날짜/시간 */}
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {new Date(record.createdAt).toLocaleDateString("ko-KR")}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(record.createdAt).toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>

            {/* 상세 정보 */}
            <div className="space-y-2 border-t border-gray-100 pt-3 mt-3">
              {/* 랜딩페이지 */}
              {record.landingPageTitle && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-600">랜딩페이지</p>
                    <p className="text-sm font-medium text-gray-900">
                      {record.landingPageTitle}
                    </p>
                  </div>
                </div>
              )}

              {/* 그룹 */}
              {record.groupName && (
                <div className="flex items-start gap-2">
                  <Hash className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-600">그룹</p>
                    <p className="text-sm font-medium text-gray-900">
                      {record.groupName}
                    </p>
                  </div>
                </div>
              )}

              {/* 신청 연락처 */}
              {(record.email || record.phone) && (
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-600">신청 연락처</p>
                    <p className="text-sm text-gray-900">
                      {record.phone && <span>{record.phone}</span>}
                      {record.email && record.phone && <span> / </span>}
                      {record.email && <span>{record.email}</span>}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 재신청 표시 */}
            {record.index > 1 && (
              <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                🔄 재신청: Day 0부터 새로운 문자 퍼널 시작됨
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
