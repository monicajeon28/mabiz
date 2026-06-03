'use client';

import { useState, useEffect, useCallback } from 'react';

interface CountdownTimerProps {
  targetDate: string; // "2026-06-30 23:59:59"
  onComplete?: () => void;
  onTimeChange?: (remaining: number) => void;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

type ColorType = 'green' | 'yellow' | 'red';

function calculateTimeRemaining(targetDate: string): TimeRemaining {
  const target = new Date(targetDate).getTime();
  const now = new Date().getTime();
  const total = Math.max(0, target - now);

  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  const hours = Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((total % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((total % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds, total };
}

function getColorByTime(total: number): ColorType {
  const hours = total / (1000 * 60 * 60);
  if (hours >= 24) return 'green';
  if (hours >= 1) return 'yellow';
  return 'red';
}

export default function CountdownTimer({ targetDate, onComplete, onTimeChange }: CountdownTimerProps) {
  const [time, setTime] = useState<TimeRemaining>(() => calculateTimeRemaining(targetDate));
  const [color, setColor] = useState<ColorType>(() => getColorByTime(calculateTimeRemaining(targetDate).total));
  const [isComplete, setIsComplete] = useState(false);

  const formatTime = useCallback((num: number) => String(num).padStart(2, '0'), []);

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = calculateTimeRemaining(targetDate);
      setTime(remaining);
      setColor(getColorByTime(remaining.total));

      if (onTimeChange) onTimeChange(remaining.total);

      if (remaining.total <= 0 && !isComplete) {
        setIsComplete(true);
        if (onComplete) onComplete();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate, onComplete, onTimeChange, isComplete]);

  if (isComplete) {
    return (
      <div className="text-center">
        <div className="text-4xl font-bold text-red-600">신청 마감</div>
        <p className="text-gray-500 text-sm mt-2">신청이 종료되었습니다.</p>
      </div>
    );
  }

  const colorConfig = {
    green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
    yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' },
    red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
  };

  const c = colorConfig[color];
  const animate = color === 'red' ? 'animate-pulse' : '';

  return (
    <div className={`rounded-lg border-2 p-6 text-center ${c.bg} ${c.border} ${animate}`}>
      <div className={`text-sm font-semibold ${c.text} mb-2`}>신청 마감까지</div>
      <div className={`text-5xl font-mono font-bold ${c.text}`}>
        {time.days > 0 && `${time.days}일 `}
        {formatTime(time.hours)}:{formatTime(time.minutes)}:{formatTime(time.seconds)}
      </div>
      <p className={`text-xs mt-3 ${c.text} opacity-75`}>지금 신청하세요!</p>
    </div>
  );
}
