'use client';

import { useEffect, useState } from 'react';

interface BackupStats {
  timestamp: string;
  today: {
    total: number;
    success: number;
    failure: number;
    successRate: string;
  };
  pending: number;
  failedJobs: number;
  status: string;
}

export default function BackupStatusPage() {
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/backup-status-proxy', {
        signal,
      });
      const data = await res.json();
      setStats(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // 요청 중단, 에러 무시
      }
      setError('백업 상태를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    const init = async () => {
      if (isMounted) {
        await fetchStats(controller.signal);
      }
    };
    init();

    // 5분마다 자동 새로고침
    const interval = setInterval(() => {
      if (isMounted) {
        fetchStats(controller.signal);
      }
    }, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      controller.abort();
    };
  }, []);

  if (loading) {
    return <div className="p-6 text-center">불러오는 중...</div>;
  }

  if (!stats) {
    return <div className="p-6 text-center">데이터를 불러올 수 없습니다</div>;
  }

  const isHealthy = stats.status === 'HEALTHY';
  const statusColor = isHealthy ? 'bg-green-100 border-green-400' : 'bg-yellow-100 border-yellow-400';
  const statusText = isHealthy ? '✅ 정상' : '⚠️ 경고';

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">🔄 백업 시스템 상태</h1>

      {/* 상태 카드 */}
      <div className={`p-6 rounded-lg border-2 mb-6 ${statusColor}`}>
        <h2 className="text-xl font-bold">{statusText}</h2>
        <p className="text-sm text-gray-600 mt-2">
          마지막 업데이트: {lastUpdated?.toLocaleTimeString('ko-KR')}
        </p>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="p-4 mb-6 rounded-lg border-2 bg-red-50 border-red-400 text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* 오늘의 통계 */}
      <div className="bg-white border rounded-lg p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">📊 오늘의 통계</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="bg-blue-50 p-4 rounded">
            <p className="text-gray-600 text-sm">총 작업</p>
            <p className="text-2xl font-bold text-blue-600">{stats.today.total}</p>
          </div>
          <div className="bg-green-50 p-4 rounded">
            <p className="text-gray-600 text-sm">성공</p>
            <p className="text-2xl font-bold text-green-600">{stats.today.success}</p>
          </div>
          <div className="bg-red-50 p-4 rounded">
            <p className="text-gray-600 text-sm">실패</p>
            <p className="text-2xl font-bold text-red-600">{stats.today.failure}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded">
            <p className="text-gray-600 text-sm">성공률</p>
            <p className="text-2xl font-bold text-purple-600">{stats.today.successRate}</p>
          </div>
        </div>
      </div>

      {/* 현재 상황 */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">⏳ 현재 상황</h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-yellow-50 rounded">
            <span className="text-gray-700">대기 중인 작업</span>
            <span className="text-2xl font-bold text-yellow-600">{stats.pending}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-red-50 rounded">
            <span className="text-gray-700">해결되지 않은 실패</span>
            <span className="text-2xl font-bold text-red-600">{stats.failedJobs}</span>
          </div>
        </div>
      </div>

      {/* 새로고침 버튼 */}
      <div className="mt-6">
        <button
          onClick={() => fetchStats()}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
        >
          🔄 새로고침
        </button>
      </div>

      {/* 참고 */}
      <div className="mt-6 p-4 bg-gray-50 rounded text-sm text-gray-600">
        <p>💡 <strong>팁:</strong> 이 페이지는 5분마다 자동으로 새로고침됩니다.</p>
        <p>🔔 <strong>문제:</strong> 실패가 많으면 관리자에게 보고하세요!</p>
      </div>
    </div>
  );
}
