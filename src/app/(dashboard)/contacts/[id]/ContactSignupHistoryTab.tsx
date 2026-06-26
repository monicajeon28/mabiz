"use client";

/**
 * ContactSignupHistoryTab — 신청 이력 표시
 * - 신청 횟수별 표시 (1차, 2차, 3차...)
 * - 각 신청 간 일수 계산 (D-day 형식)
 * - 타임스탬프 표시
 * - VIP 고객: 응답 시간 표시
 */

import { useEffect, useState } from "react";
import { Contact, SignupHistoryEntry } from "@/types/contact";
import { isVIPCustomer } from "@/constants/source-types";
import { UI_ICONS } from "@/constants/ui-icons";

// Helper: 날짜 필드 확인 (date 우선, 없으면 createdAt)
function getSignupDate(obj: unknown): string | null {
  if (typeof obj !== "object" || obj === null) return null;
  const o = obj as { date?: string; createdAt?: string };
  return o.date || o.createdAt || null;
}

// Helper: 출처/기기 필드 추출
function getSourceInfo(obj: unknown): { ip?: string | null; userAgent?: string | null; deviceType?: string | null; referer?: string | null } {
  if (typeof obj !== "object" || obj === null) return {};
  const o = obj as { ip?: string | null; userAgent?: string | null; deviceType?: string | null; referer?: string | null };
  return { ip: o.ip, userAgent: o.userAgent, deviceType: o.deviceType, referer: o.referer };
}

// Helper: 응답 시간 필드 확인
function hasResponseTime(obj: unknown): obj is { responseTime?: number } {
  return typeof obj === "object" && obj !== null && "responseTime" in obj;
}

export default function ContactSignupHistoryTab({ contact }: { contact: Contact }) {
  // prop의 signupHistory가 비어있을 수 있어(목록 응답에 미포함), 전용 API로 보강 조회.
  // 응답에 IP/기기 필드(ip, userAgent, deviceType, referer)가 그대로 포함된다.
  const [fetched, setFetched] = useState<SignupHistoryEntry[] | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/contacts/${contact.id}/signup-history`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok && Array.isArray(d.history)) setFetched(d.history as SignupHistoryEntry[]);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
      });
    return () => ctrl.abort();
  }, [contact.id]);

  const propSignups = Array.isArray(contact.signupHistory) ? contact.signupHistory : [];
  const signups: SignupHistoryEntry[] = fetched ?? propSignups;
  const isVIP = isVIPCustomer(contact.sourceType);

  if (signups.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-gray-400">신청 이력이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {signups.map((signup, idx) => {
        // signup이 객체인지 확인 (date 우선, 없으면 createdAt)
        const date = getSignupDate(signup);

        if (!date) return null;

        const nextSignup = signups[idx + 1];
        const nextDate = getSignupDate(nextSignup);

        // 신청 출처/기기 정보
        const { ip, userAgent, deviceType, referer } = getSourceInfo(signup);
        const hasSourceInfo = !!(ip || userAgent || deviceType || referer);
        const deviceLabel = deviceType === "mobile" ? "📱 휴대폰" : deviceType === "desktop" ? "💻 PC" : null;

        // signupDate를 한 번만 생성
        const signupDate = new Date(date);

        const daysDiff = nextDate
          ? (() => {
              const curTime = signupDate.getTime();
              const nxtTime = new Date(nextDate).getTime();
              if (isNaN(curTime) || isNaN(nxtTime)) return null;
              return Math.floor((nxtTime - curTime) / (1000 * 60 * 60 * 24));
            })()
          : null;

        const formattedDate = isNaN(signupDate.getTime())
          ? "날짜 오류"
          : signupDate.toLocaleString("ko-KR", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            });

        // VIP 고객인 경우 응답 시간 표시
        const responseTime = isVIP && hasResponseTime(signup) ? signup.responseTime : null;

        return (
          <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <p className="text-sm font-semibold text-gray-900">
                {idx + 1}차 신청
              </p>
              {idx === signups.length - 1 && (
                <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
                  최근
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mb-2">
              {UI_ICONS.DATE} {formattedDate}
            </p>
            {/* 신청 IP / 기기 — 어디서·어떤 기기로 신청했는지 */}
            {hasSourceInfo && (
              <div className="mt-2 mb-2 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 space-y-1">
                <p className="text-[11px] font-semibold text-gray-600">신청 IP / 기기</p>
                {deviceLabel && (
                  <p className="text-xs text-gray-700">{deviceLabel}</p>
                )}
                {ip && (
                  <p className="text-xs text-gray-700">
                    IP: <span className="font-mono">{ip}</span>
                  </p>
                )}
                {userAgent && (
                  <p className="text-[11px] text-gray-400 break-all" title={userAgent}>
                    {userAgent}
                  </p>
                )}
                {referer && (
                  <p className="text-[11px] text-gray-400 break-all" title={referer}>
                    접속경로: {referer}
                  </p>
                )}
              </div>
            )}
            {daysDiff !== null && (
              <p className="text-xs text-gray-400">
                {UI_ICONS.CHART} 다음 신청까지: <span className="font-semibold">{daysDiff}일</span>
              </p>
            )}
            {/* VIP 고객: 응답 시간 표시 */}
            {isVIP && responseTime && (
              <p className="text-xs text-green-600 mt-2 font-medium">
                {UI_ICONS.SUCCESS} {responseTime}시간 내 응답 완료
              </p>
            )}
            {isVIP && !responseTime && idx === signups.length - 1 && (
              <p className="text-xs text-orange-600 mt-2 font-medium">
                {UI_ICONS.PENDING} 응답 대기 중
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
