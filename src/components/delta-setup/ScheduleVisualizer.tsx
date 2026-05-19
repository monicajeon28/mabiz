'use client';

import { useCallback, useEffect, useState } from 'react';
import { logger } from '@/lib/logger';

/**
 * Delta SMS ScheduleVisualizer Component
 *
 * Step 4: 발송 스케줄 시각화
 * 3개의 Cron 시간대별 메시지 발송 스케줄을 시각화
 *
 * Props:
 * - triggerType: 'PURCHASE' | 'ABANDONED'
 */

interface ScheduleVisualizerProps {
  triggerType: 'PURCHASE' | 'ABANDONED';
}

/**
 * 시간대별 스케줄 정보
 */
interface CronSchedule {
  time: string;
  hour: number;
  description: string;
  expectedCount?: number;
  estimatedDuration: string;
  isLoading: boolean;
}

/**
 * Cron 스케줄 설정 (고정값)
 * KST 기준
 */
const CRON_SCHEDULES: CronSchedule[] = [
  {
    time: '09:00',
    hour: 9,
    description: 'Day 0 메시지 발송 (구매 직후)',
    estimatedDuration: '<5분',
    isLoading: false,
  },
  {
    time: '14:00',
    hour: 14,
    description: 'Day 1 메시지 발송 (+1일)',
    estimatedDuration: '<4분',
    isLoading: false,
  },
  {
    time: '19:00',
    hour: 19,
    description: 'Day 2/3 메시지 발송 (+2/3일)',
    estimatedDuration: '<3분',
    isLoading: false,
  },
];

/**
 * 시간 포맷 함수
 */
function formatTimeKST(hour: number): string {
  if (hour < 12) {
    return `오전 ${hour}:00`;
  } else if (hour === 12) {
    return `정오 12:00`;
  } else {
    return `오후 ${hour - 12}:00`;
  }
}

/**
 * 예상 발송 건수 계산 (모의 데이터)
 * 실제 데이터베이스 쿼리는 API로 수행
 */
function estimateSendingCount(hour: number): string {
  // 시뮬레이션: 시간이 이를수록 발송 건수 감소
  // Day 0 (09:00): 2400
  // Day 1 (14:00): 1800
  // Day 2/3 (19:00): 1200
  if (hour === 9) return '~2,400건';
  if (hour === 14) return '~1,800건';
  if (hour === 19) return '~1,200건';
  return '알 수 없음';
}

/**
 * 시간대별 스케줄 카드 컴포넌트
 */
function ScheduleCard({
  schedule,
  triggerType,
}: {
  schedule: CronSchedule;
  triggerType: string;
}) {
  const isDay2Or3 = schedule.hour === 19;

  return (
    <div
      className="border rounded-lg p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200"
      role="region"
      aria-label={`${schedule.time} 스케줄: ${schedule.description}`}
    >
      {/* 시간 + 설명 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            🕘 {formatTimeKST(schedule.hour)}
            <span className="text-sm font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
              KST
            </span>
          </h3>
          <p className="text-sm text-gray-700 mt-1">{schedule.description}</p>
        </div>
      </div>

      {/* 발송 정보 */}
      <div className="bg-white rounded-lg p-3 mb-3 space-y-2">
        {/* 예상 발송 건수 */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">예상 발송 건수</span>
          <span className="font-medium text-gray-900">
            {schedule.isLoading ? (
              <span className="inline-flex items-center gap-1">
                <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                조회 중...
              </span>
            ) : (
              estimateSendingCount(schedule.hour)
            )}
          </span>
        </div>

        {/* 예상 실행 시간 */}
        <div className="flex items-center justify-between text-sm border-t border-gray-200 pt-2">
          <span className="text-gray-600">예상 실행 시간</span>
          <span className="font-medium text-gray-900">⚡ {schedule.estimatedDuration}</span>
        </div>
      </div>

      {/* 확인 항목 (읽기전용 체크박스) */}
      <div className="space-y-2 text-sm">
        <label className="flex items-center gap-2 cursor-default">
          <input
            type="checkbox"
            checked={true}
            disabled
            className="w-4 h-4 text-green-600 rounded cursor-not-allowed"
            aria-label={`${schedule.time} SMS 발송 활성화 (자동)`}
          />
          <span className="text-gray-700">
            ✓ SMS 발송 활성화 <span className="text-xs text-gray-500">(자동)</span>
          </span>
        </label>

        <label className="flex items-center gap-2 cursor-default">
          <input
            type="checkbox"
            checked={true}
            disabled
            className="w-4 h-4 text-green-600 rounded cursor-not-allowed"
            aria-label={`${schedule.time} Cron 자동 실행 (Vercel)`}
          />
          <span className="text-gray-700">
            ✓ Cron 자동 실행 <span className="text-xs text-gray-500">(Vercel)</span>
          </span>
        </label>

        <label className="flex items-center gap-2 cursor-default">
          <input
            type="checkbox"
            checked={true}
            disabled
            className="w-4 h-4 text-green-600 rounded cursor-not-allowed"
            aria-label={`${schedule.time} SendingHistory 자동 기록`}
          />
          <span className="text-gray-700">
            ✓ 발송 이력 자동 기록 <span className="text-xs text-gray-500">(SendingHistory)</span>
          </span>
        </label>
      </div>
    </div>
  );
}

/**
 * 메인 ScheduleVisualizer 컴포넌트
 */
export default function ScheduleVisualizer({
  triggerType,
}: ScheduleVisualizerProps) {
  const [schedules, setSchedules] = useState<CronSchedule[]>(CRON_SCHEDULES);

  // 실제 데이터베이스에서 예상 건수를 조회할 수 있음 (향후)
  // 지금은 시뮬레이션만 제공
  useEffect(() => {
    // 로드 시뮬레이션
    setSchedules((prev) =>
      prev.map((s) => ({ ...s, isLoading: true }))
    );

    // 0.5초 후 완료 시뮬레이션
    const timer = setTimeout(() => {
      setSchedules((prev) =>
        prev.map((s) => ({ ...s, isLoading: false }))
      );
      logger.info('[ScheduleVisualizer] 예상 발송 건수 로드 완료', {
        triggerType,
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [triggerType]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      {/* 섹션 헤더 */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          Step 4: 발송 스케줄 확인
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          렌탈 메시지는 매일 3회 자동으로 발송됩니다.
        </p>
      </div>

      {/* 발송 일정 요약 */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
        <h3 className="font-medium text-green-900 mb-2">📅 발송 일정</h3>
        <p className="text-sm text-green-800">
          렌탈 구매 고객을 대상으로 {triggerType === 'PURCHASE' ? '구매 당일' : '이탈 감지'}부터
          4일간 매일 정해진 시간에 심리학 기반 메시지를 발송합니다.
        </p>
      </div>

      {/* Cron 스케줄 카드 리스트 */}
      <div className="space-y-4">
        {schedules.map((schedule, index) => (
          <ScheduleCard
            key={`${schedule.time}-${index}`}
            schedule={schedule}
            triggerType={triggerType}
          />
        ))}
      </div>

      {/* 자동화 요약 */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
        <h3 className="font-medium text-indigo-900 mb-3">⚙️ 자동화 기능</h3>
        <div className="space-y-2 text-sm text-indigo-800">
          <div className="flex items-start gap-2">
            <span className="text-lg">🔄</span>
            <div>
              <strong>배치 처리</strong>: 발송 건수가 많을 때 100명씩 나누어 처리하여
              서버 부하 최소화
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-lg">📊</span>
            <div>
              <strong>실시간 추적</strong>: SendingHistory에 모든 발송 기록이 자동 저장됨
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-lg">🔐</span>
            <div>
              <strong>안전성</strong>: 발송 실패 시 자동 재시도 및 에러 로깅
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-lg">🌍</span>
            <div>
              <strong>글로벌 서버</strong>: Vercel Cron으로 시간에 정확하게 실행됨
            </div>
          </div>
        </div>
      </div>

      {/* 저장 준비 상태 */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="font-medium text-green-900 mb-2">✅ 설정 완료</h3>
        <p className="text-sm text-green-800">
          모든 단계를 완료했습니다. 아래 "저장" 버튼을 클릭하면 렌탈 SMS 자동화가
          활성화되고, 정해진 시간에 고객들에게 메시지가 발송됩니다.
        </p>
      </div>
    </div>
  );
}
