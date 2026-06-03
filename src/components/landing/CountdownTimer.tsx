"use client";

import { useState, useEffect } from "react";

interface CountdownTimerProps {
  targetDate: Date;
  onExpire?: () => void;
  /* [L6 타이밍 손실회피] 색상 단계: 1일 이상(초록) → 6시간-1일(황색) → 1시간-6시간(주황) → 1시간미만(빨강+펄스) */
}

type UrgencyLevel = "safe" | "warning" | "alert" | "critical";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMinutes: number;
}

/**
 * [심리학 렌즈] L6 타이밍 손실회피 + L10 즉시구매 클로징
 * - L6: 가격인상 타이밍으로 손실감 유발 (시간 흐를수록 비용증가)
 * - L10: 마감 직전 긴박감으로 즉시 구매 결정 유도
 */
export function CountdownTimer({ targetDate, onExpire }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [urgencyLevel, setUrgencyLevel] = useState<UrgencyLevel>("safe");

  // 긴박감 레벨 판정: 시간 기반 색상 + 애니메이션 전략
  const getUrgencyLevel = (tl: TimeLeft | null): UrgencyLevel => {
    if (!tl) return "critical";
    const totalHours = tl.days * 24 + tl.hours;
    if (totalHours >= 24) return "safe"; // 1일 이상: 초록 (안전)
    if (totalHours >= 6) return "warning"; // 6시간-1일: 황색 (경고)
    if (totalHours >= 1) return "alert"; // 1시간-6시간: 주황 (주의)
    return "critical"; // 1시간 미만: 빨강 + 펄스 (긴급)
  };

  useEffect(() => {
    const calculateTimeLeft = (): TimeLeft | null => {
      const now = Date.now();
      const diff = targetDate.getTime() - now;

      if (diff <= 0) {
        onExpire?.();
        return null;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      const totalMinutes = Math.floor(diff / (1000 * 60));

      return { days, hours, minutes, seconds, totalMinutes };
    };

    const initial = calculateTimeLeft();
    setTimeLeft(initial);
    setUrgencyLevel(getUrgencyLevel(initial));

    // [T19] 1시간 미만이면 1초, 이상이면 60초 간격으로 업데이트
    const getInterval = (tl: TimeLeft | null) =>
      tl && tl.days === 0 && tl.hours < 1 ? 1000 : 60000;

    let timerId: ReturnType<typeof setInterval>;
    let currentInterval = getInterval(initial);

    const tick = () => {
      const result = calculateTimeLeft();
      setTimeLeft(result);
      setUrgencyLevel(getUrgencyLevel(result));

      if (result === null) {
        clearInterval(timerId);
        return;
      }

      const nextInterval = getInterval(result);
      if (nextInterval !== currentInterval) {
        currentInterval = nextInterval;
        clearInterval(timerId);
        timerId = setInterval(tick, nextInterval);
      }
    };

    timerId = setInterval(tick, currentInterval);

    return () => clearInterval(timerId);
  }, [targetDate, onExpire]);

  const days = timeLeft?.days ?? 0;
  const hours = timeLeft?.hours ?? 0;
  const minutes = timeLeft?.minutes ?? 0;

  // [L6 심리학] 색상 및 배경 매핑
  const colorConfig: Record<
    UrgencyLevel,
    {
      textColor: string;
      bgColor: string;
      borderColor: string;
      labelColor: string;
      separatorClass: string;
      shouldPulse: boolean;
    }
  > = {
    safe: {
      textColor: "text-green-700",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      labelColor: "text-green-600",
      separatorClass: "text-green-600",
      shouldPulse: false,
    },
    warning: {
      textColor: "text-yellow-700",
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200",
      labelColor: "text-yellow-600",
      separatorClass: "text-yellow-600",
      shouldPulse: false,
    },
    alert: {
      textColor: "text-orange-700",
      bgColor: "bg-orange-50",
      borderColor: "border-orange-200",
      labelColor: "text-orange-600",
      separatorClass: "text-orange-600",
      shouldPulse: false,
    },
    critical: {
      textColor: "text-red-700",
      bgColor: "bg-red-50",
      borderColor: "border-red-300",
      labelColor: "text-red-600",
      separatorClass: "text-red-600 animate-pulse",
      shouldPulse: true,
    },
  };

  const colors = colorConfig[urgencyLevel];

  // [L10 클로징] 마감 임박 시 강조 문구
  const urgencyLabel = {
    safe: "신청 마감까지",
    warning: "📢 마감까지",
    alert: "⚠️ 긴급 마감까지",
    critical: "🔴 즉시 신청! 마감까지",
  }[urgencyLevel];

  return (
    <div
      className={`${colors.bgColor} border-2 ${colors.borderColor} rounded-2xl p-6 md:p-8 mb-6 transition-all duration-500 ${
        urgencyLevel === "critical" ? "shadow-lg shadow-red-300" : ""
      }`}
    >
      {/* 헤더: 마감 임박 강조 메시지 */}
      <div className="mb-4 text-center">
        <p className={`text-sm md:text-base font-bold ${colors.labelColor}`}>
          {urgencyLabel}
        </p>
      </div>

      {/* 메인 타이머 */}
      <div className="flex items-center justify-center gap-1 md:gap-3 mb-4">
        {/* 일 */}
        <div className="flex flex-col items-center">
          <span
            className={`text-4xl md:text-5xl font-bold font-mono ${colors.textColor} transition-colors duration-300 ${
              urgencyLevel === "critical" ? "animate-pulse" : ""
            }`}
          >
            {String(days).padStart(2, "0")}
          </span>
          <span className={`text-xs md:text-sm font-medium mt-2 ${colors.labelColor}`}>
            일
          </span>
        </div>

        {/* 구분자 */}
        <span className={`text-2xl md:text-4xl font-bold ${colors.separatorClass} mx-1`}>
          :
        </span>

        {/* 시간 */}
        <div className="flex flex-col items-center">
          <span
            className={`text-4xl md:text-5xl font-bold font-mono ${colors.textColor} transition-colors duration-300 ${
              urgencyLevel === "critical" ? "animate-pulse" : ""
            }`}
          >
            {String(hours).padStart(2, "0")}
          </span>
          <span className={`text-xs md:text-sm font-medium mt-2 ${colors.labelColor}`}>
            시간
          </span>
        </div>

        {/* 구분자 */}
        <span className={`text-2xl md:text-4xl font-bold ${colors.separatorClass} mx-1`}>
          :
        </span>

        {/* 분 */}
        <div className="flex flex-col items-center">
          <span
            className={`text-4xl md:text-5xl font-bold font-mono ${colors.textColor} transition-colors duration-300 ${
              urgencyLevel === "critical" ? "animate-pulse" : ""
            }`}
          >
            {String(minutes).padStart(2, "0")}
          </span>
          <span className={`text-xs md:text-sm font-medium mt-2 ${colors.labelColor}`}>
            분
          </span>
        </div>
      </div>

      {/* [L6 심리학] 강화된 손실회피 메시지 */}
      {urgencyLevel !== "safe" && (
        <div className="mt-4 text-center">
          <p
            className={`text-sm font-semibold ${colors.labelColor} ${
              urgencyLevel === "critical" ? "animate-pulse" : ""
            }`}
          >
            {urgencyLevel === "warning" &&
              "⏰ 6시간 내 가격 인상 예정입니다"}
            {urgencyLevel === "alert" &&
              "⚠️ 1시간 내 신청하면 현재 가격 적용됩니다"}
            {urgencyLevel === "critical" &&
              "🔴 마감 직전! 지금 신청해야 합니다"}
          </p>
        </div>
      )}
    </div>
  );
}
