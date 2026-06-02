'use client';

import { useEffect, useState } from 'react';

interface CountdownTimerProps {
  remainingSeats?: number;
  deadlineMinutes?: number; // 몇 분 후 마감인지 (기본값: 10080분 = 7일)
}

export default function CountdownTimer({
  remainingSeats = 10,
  deadlineMinutes = 10080 // 7일
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    // 초기 계산
    const deadline = new Date();
    deadline.setMinutes(deadline.getMinutes() + deadlineMinutes);

    const updateTimer = () => {
      const now = new Date();
      const diff = deadline.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [deadlineMinutes]);

  if (!timeLeft) {
    return <div className="text-gray-400">계산 중...</div>;
  }

  // 남은 석수 감소 애니메이션 (실제로는 DB에서 조회해야 함)
  const seatsPercentage = (remainingSeats / 100) * 100;

  return (
    <div className="space-y-6">
      {/* 타이머 박스 */}
      <div className="grid grid-cols-4 gap-3 max-w-md mx-auto">
        {/* 일 */}
        <div className="bg-white rounded-lg p-4 text-center shadow-lg hover:shadow-xl transition-shadow">
          <div className="text-3xl font-bold text-red-600">
            {String(timeLeft.days).padStart(2, '0')}
          </div>
          <div className="text-sm text-gray-600 font-semibold">일</div>
        </div>

        {/* 시간 */}
        <div className="bg-white rounded-lg p-4 text-center shadow-lg hover:shadow-xl transition-shadow">
          <div className="text-3xl font-bold text-orange-600">
            {String(timeLeft.hours).padStart(2, '0')}
          </div>
          <div className="text-sm text-gray-600 font-semibold">시간</div>
        </div>

        {/* 분 */}
        <div className="bg-white rounded-lg p-4 text-center shadow-lg hover:shadow-xl transition-shadow">
          <div className="text-3xl font-bold text-yellow-600">
            {String(timeLeft.minutes).padStart(2, '0')}
          </div>
          <div className="text-sm text-gray-600 font-semibold">분</div>
        </div>

        {/* 초 */}
        <div className="bg-white rounded-lg p-4 text-center shadow-lg hover:shadow-xl transition-shadow">
          <div className="text-3xl font-bold text-green-600">
            {String(timeLeft.seconds).padStart(2, '0')}
          </div>
          <div className="text-sm text-gray-600 font-semibold">초</div>
        </div>
      </div>

      {/* 남은 석수 */}
      <div className="max-w-md mx-auto">
        <div className="flex justify-between items-center mb-2">
          <p className="text-gray-700 font-semibold">남은 석수</p>
          <p className="text-2xl font-bold text-red-600">{remainingSeats}석</p>
        </div>
        <div className="w-full bg-gray-300 rounded-full h-4 overflow-hidden">
          <div
            className="bg-gradient-to-r from-red-500 to-red-600 h-full transition-all duration-300 animate-pulse"
            style={{ width: `${Math.min(seatsPercentage, 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-600 mt-2 text-center">
          ⚠️ 석수가 줄어들고 있습니다. 지금 바로 신청하세요!
        </p>
      </div>

      {/* 긴박감 텍스트 */}
      <div className="text-center">
        {timeLeft.days === 0 && timeLeft.hours <= 6 ? (
          <p className="text-red-600 font-bold text-lg animate-pulse">
            🔴 오늘 중 신청해야 합니다!
          </p>
        ) : timeLeft.days === 0 ? (
          <p className="text-orange-600 font-bold">
            ⏰ {timeLeft.hours}시간 {timeLeft.minutes}분 남았습니다
          </p>
        ) : (
          <p className="text-gray-700">
            ✅ {timeLeft.days}일 내 신청하면 평생 30% 할인
          </p>
        )}
      </div>
    </div>
  );
}
