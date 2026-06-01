"use client";

import { useState, useEffect } from "react";

interface CountdownTimerProps {
  targetDate: Date;
  onExpire?: () => void;
}

export function CountdownTimer({ targetDate, onExpire }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    // 초기 계산
    const calculateTimeLeft = () => {
      const now = Date.now();
      const diff = targetDate.getTime() - now;

      if (diff <= 0) {
        onExpire?.();
        return null;
      }

      return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      };
    };

    const initial = calculateTimeLeft();
    setTimeLeft(initial);

    // [T19] 1시간 미만이면 1초, 이상이면 60초 간격으로 업데이트
    const getInterval = (tl: typeof initial) =>
      tl && tl.days === 0 && tl.hours < 1 ? 1000 : 60000;

    let timerId: ReturnType<typeof setInterval>;
    let currentInterval = getInterval(initial);

    const tick = () => {
      const result = calculateTimeLeft();
      setTimeLeft(result);
      if (result === null) {
        clearInterval(timerId);
        return;
      }
      // 남은 시간에 따라 간격이 바뀌면 interval 재등록
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

  return (
    <div className="flex items-center justify-center gap-2 mb-3">
      <div className="flex flex-col items-center">
        <span className="text-3xl md:text-4xl font-bold text-red-600 font-mono">
          {String(days).padStart(2, "0")}
        </span>
        <span className="text-sm text-gray-600 font-medium mt-1">일</span>
      </div>
      <span className="text-2xl text-red-600 font-bold mx-1 animate-pulse">:</span>
      <div className="flex flex-col items-center">
        <span className="text-3xl md:text-4xl font-bold text-red-600 font-mono">
          {String(hours).padStart(2, "0")}
        </span>
        <span className="text-sm text-gray-600 font-medium mt-1">시간</span>
      </div>
      <span className="text-2xl text-red-600 font-bold mx-1 animate-pulse">:</span>
      <div className="flex flex-col items-center">
        <span className="text-3xl md:text-4xl font-bold text-red-600 font-mono">
          {String(minutes).padStart(2, "0")}
        </span>
        <span className="text-sm text-gray-600 font-medium mt-1">분</span>
      </div>
    </div>
  );
}
