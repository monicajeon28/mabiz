'use client';

import { useState, useEffect, useRef } from 'react';
import { DashboardHomeStats } from '@/types/dashboard';

/**
 * useCallListRefresh
 *
 * 5분 폴링으로 대시보드 홈 데이터 자동 새로고침
 * - 초기 로드 즉시 실행
 * - 5분마다 자동 폴링
 * - 네트워크 오류 시 최대 3회 재시도 (5초 간격)
 *
 * @param intervalSeconds 폴링 간격 (기본값: 300초 = 5분)
 * @returns { stats, loading, error, manualRefresh }
 */
export function useCallListRefresh(intervalSeconds = 300) {
  const [stats, setStats] = useState<DashboardHomeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const retryCountRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchDashboardStats = async () => {
    try {
      const res = await fetch('/api/dashboard/home-stats');

      if (!res.ok) {
        throw new Error(`API 오류: ${res.status}`);
      }

      const data = await res.json();

      if (data.ok && data.stats) {
        setStats(data.stats);
        setError(null);
        retryCountRef.current = 0; // 성공 시 재시도 카운트 리셋

        // 개발 환경에서 폴링 로그
        if (process.env.NODE_ENV === 'development') {
          console.log('[Dashboard] 폴링 성공:', new Date().toLocaleTimeString('ko-KR'));
        }
      } else {
        throw new Error(data.error || '데이터 파싱 실패');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '알 수 없는 오류';
      setError(errorMsg);

      // 재시도 로직 (최대 3회)
      if (retryCountRef.current < 3) {
        retryCountRef.current++;
        console.warn(`[Dashboard] 폴링 실패 (${retryCountRef.current}/3): ${errorMsg}`);

        // 5초 후 재시도
        const retryTimer = setTimeout(fetchDashboardStats, 5000);
        return () => clearTimeout(retryTimer);
      } else {
        console.error('[Dashboard] 재시도 3회 초과:', errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 초기 로드
    fetchDashboardStats();

    // 5분(또는 지정된 간격)마다 폴링
    intervalRef.current = setInterval(fetchDashboardStats, intervalSeconds * 1000);

    // 클린업
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [intervalSeconds]);

  // 수동 새로고침 함수
  const manualRefresh = async () => {
    setLoading(true);
    retryCountRef.current = 0;
    await fetchDashboardStats();
  };

  return { stats, loading, error, manualRefresh };
}
