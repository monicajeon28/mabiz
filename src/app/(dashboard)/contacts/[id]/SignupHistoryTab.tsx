"use client";

import React, { useState, useEffect } from "react";
import { UI_ICONS } from "@/constants/ui-icons";

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
  // 신청 출처/기기 (어디서·무엇으로 신청했는지)
  productName?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  deviceType?: string | null; // mobile | desktop
  referer?: string | null;
  utmSource?: string | null;
}

// 기기 종류를 50대 친화 한글 라벨로 변환
function deviceLabelOf(deviceType?: string | null): string | null {
  if (deviceType === "mobile") return "📱 휴대폰";
  if (deviceType === "desktop") return "💻 데스크톱(PC)";
  return null;
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
            {(() => {
              const createdDate = new Date(record.createdAt);
              const dateStr = createdDate.toLocaleDateString("ko-KR");
              const timeStr = createdDate.toLocaleTimeString("ko-KR", {
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
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
                    <p className="text-sm font-medium text-gray-900">{dateStr}</p>
                    <p className="text-xs text-gray-500">{timeStr}</p>
                  </div>
                </div>
              );
            })()}

            {/* 상세 정보 */}
            <div className="space-y-2 border-t border-gray-100 pt-3 mt-3">
              {/* 랜딩페이지 */}
              {record.landingPageTitle && (
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5 flex-shrink-0">📄</span>
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
                  <span className="text-gray-400 mt-0.5 flex-shrink-0">👥</span>
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
                  <span className="text-gray-400 mt-0.5 flex-shrink-0">📞</span>
                  <div>
                    <p className="text-xs text-gray-600">신청 연락처</p>
                    <p className="text-base text-gray-900">
                      {record.phone && <span>{record.phone}</span>}
                      {record.email && record.phone && <span> / </span>}
                      {record.email && <span>{record.email}</span>}
                    </p>
                  </div>
                </div>
              )}

              {/* 신청 상품 — 어떤 상품으로 신청했는지 */}
              {record.productName && (
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5 flex-shrink-0">🚢</span>
                  <div>
                    <p className="text-xs text-gray-600">신청 상품</p>
                    <p className="text-base font-medium text-gray-900">{record.productName}</p>
                  </div>
                </div>
              )}

              {/* 유입경로 — 어떤 광고/채널을 통해 들어왔는지 */}
              {record.utmSource && (
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5 flex-shrink-0">🧭</span>
                  <div>
                    <p className="text-xs text-gray-600">유입경로</p>
                    <p className="text-base text-gray-900">{record.utmSource}</p>
                  </div>
                </div>
              )}

              {/* 신청 위치(IP) / 기기 — 어디서·어떤 기기로 신청했는지 */}
              {(record.ip || record.deviceType || record.referer || record.userAgent) && (
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5 flex-shrink-0">📍</span>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-600">신청 위치 · 기기</p>
                    {deviceLabelOf(record.deviceType) && (
                      <p className="text-base text-gray-900">기기: {deviceLabelOf(record.deviceType)}</p>
                    )}
                    {record.ip && (
                      <p className="text-base text-gray-900">
                        신청 위치(IP): <span className="font-mono">{record.ip}</span>
                      </p>
                    )}
                    {record.referer && (
                      <p className="text-xs text-gray-400 break-all mt-0.5" title={record.referer}>
                        접속경로: {record.referer}
                      </p>
                    )}
                    {record.userAgent && (
                      <p className="text-xs text-gray-400 break-all mt-0.5" title={record.userAgent}>
                        {record.userAgent}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 재신청 표시 */}
            {record.index > 1 && (
              <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                {UI_ICONS.REFRESH} 재신청: Day 0부터 새로운 문자 퍼널 시작됨
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
