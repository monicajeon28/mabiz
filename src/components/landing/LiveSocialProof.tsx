"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface LiveStats {
  viewersNow: number;
  recentRegistrants: string[];
}

interface Props {
  pageId: string;
}

export default function LiveSocialProof({ pageId }: Props) {
  const [stats, setStats] = useState<LiveStats>({ viewersNow: 0, recentRegistrants: [] });
  const [toastName, setToastName] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  // 현재 순환 중인 인덱스
  const toastIndexRef = useRef(0);
  const toastTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/landing-pages/${pageId}/live-stats`);
      if (!res.ok) return;
      const data: LiveStats = await res.json();
      setStats(data);
    } catch {
      // 네트워크 오류 시 조용히 무시
    }
  }, [pageId]);

  // 30초마다 폴링
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // 토스트 순환 (5초마다)
  useEffect(() => {
    if (stats.recentRegistrants.length === 0) {
      setToastVisible(false);
      if (toastTimerRef.current) {
        clearInterval(toastTimerRef.current);
        toastTimerRef.current = null;
      }
      return;
    }

    // 즉시 첫 토스트 표시
    toastIndexRef.current = 0;
    setToastName(stats.recentRegistrants[0]);
    setToastVisible(true);

    if (toastTimerRef.current) clearInterval(toastTimerRef.current);

    toastTimerRef.current = setInterval(() => {
      toastIndexRef.current =
        (toastIndexRef.current + 1) % stats.recentRegistrants.length;
      const next = stats.recentRegistrants[toastIndexRef.current];

      // 짧은 fade-out → 새 이름 설정 → fade-in
      setToastVisible(false);
      setTimeout(() => {
        setToastName(next);
        setToastVisible(true);
      }, 300);
    }, 5_000);

    return () => {
      if (toastTimerRef.current) {
        clearInterval(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, [stats.recentRegistrants]);

  const showViewers = stats.viewersNow >= 3;
  const showToast = toastVisible && toastName !== null;

  if (!showViewers && !showToast) return null;

  return (
    <>
      {/* 우측 하단 고정 (모바일: 하단 중앙) */}
      <div
        className="
          fixed z-50 flex flex-col gap-2 items-end
          bottom-6 right-4
          sm:bottom-6 sm:right-4
          max-sm:bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)]
          max-sm:left-1/2 max-sm:-translate-x-1/2 max-sm:right-auto max-sm:items-center
        "
        aria-live="polite"
        aria-atomic="false"
      >
        {/* 실시간 방문자 배지 */}
        {showViewers && (
          <div
            className="
              flex items-center gap-2
              bg-white shadow-lg rounded-xl
              px-4 py-2.5
              text-sm font-semibold text-gray-800
              border border-gray-100
              whitespace-nowrap
            "
          >
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            지금 {stats.viewersNow}명이 보는 중
          </div>
        )}

        {/* 최근 신청 토스트 */}
        {showToast && (
          <div
            className={`
              flex items-center gap-2
              bg-white shadow-lg rounded-xl
              px-4 py-2.5
              text-sm font-medium text-gray-700
              border border-gray-100
              whitespace-nowrap
              transition-opacity duration-300
              ${toastVisible ? "opacity-100" : "opacity-0"}
            `}
          >
            <span className="text-green-500 text-base">&#10003;</span>
            <span>
              <span className="font-bold text-gray-900">{toastName}</span>
              님이 방금 신청하셨어요!
            </span>
          </div>
        )}
      </div>
    </>
  );
}
