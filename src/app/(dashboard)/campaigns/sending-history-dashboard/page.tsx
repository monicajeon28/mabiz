'use client';

import { useEffect, useState, useCallback } from 'react';
// import { useAuthContext } from '@/lib/auth-context';  // TODO: Fix auth import
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/lib/api/use-toast';

interface StatsData {
  period: string;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  retryScheduled: number;
  abandoned: number;
  successRate: string;
  failureRate: string;
  byChannel: {
    SMS?: { sent: number; failed: number; rate: string };
    EMAIL?: { sent: number; failed: number; rate: string };
  };
  topFailureReasons: Array<{ reason: string; count: number; percent: string }>;
}

interface FailureRecord {
  id: string;
  contact: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  channel: string;
  status: string;
  failureReason?: string;
  failureUserMsg?: string;
  sentAt?: string;
  nextRetryAt?: string;
  retryCount: number;
  maxRetries: number;
}

export default function SendingHistoryDashboardPage() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get('campaignId') || '';
  const { toast } = useToast();

  const [stats, setStats] = useState<StatsData | null>(null);
  const [failures, setFailures] = useState<FailureRecord[]>([]);
  const [period, setPeriod] = useState<'1d' | '7d' | '30d'>('7d');
  const [statusFilter, setStatusFilter] = useState<'FAILED' | 'ABANDONED'>('FAILED');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalFailures, setTotalFailures] = useState(0);
  const [loading, setLoading] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [failuresKey, setFailuresKey] = useState(0);

  // L6: Constant pageSize to prevent re-renders
  const pageSize = 50;

  // 처음 로드 (P0: AbortController 추가)
  useEffect(() => {
    if (!campaignId) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    (async () => {
      try {
        const response = await fetch(
          `/api/campaigns/sending-history/stats?campaignId=${campaignId}&period=${period}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error('통계 조회 실패');
        }

        const data = await response.json();
        if (data.ok) {
          setStats(data.stats);
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          toast({
            title: '오류',
            description: err instanceof Error ? err.message : '통계 조회에 실패했습니다.',
            variant: 'destructive',
          });
        }
      }
    })();

    const controller2 = new AbortController();
    const timeoutId2 = setTimeout(() => controller2.abort(), 10000);

    (async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/campaigns/sending-history/failures?campaignId=${campaignId}&status=${statusFilter}&limit=${pageSize}&offset=0`,
          { signal: controller2.signal }
        );

        if (!response.ok) {
          throw new Error('실패 목록 조회 실패');
        }

        const data = await response.json();
        if (data.ok) {
          setFailures(data.failures || []);
          setTotalFailures(data.total || 0);
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          toast({
            title: '오류',
            description: err instanceof Error ? err.message : '실패 목록 조회에 실패했습니다.',
            variant: 'destructive',
          });
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(timeoutId2);
      controller.abort();
      controller2.abort();
    };
  }, [campaignId]);

  // 기간 변경 시 (P0: AbortController + toast 의존성 제거)
  useEffect(() => {
    if (!campaignId) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    (async () => {
      try {
        const response = await fetch(
          `/api/campaigns/sending-history/stats?campaignId=${campaignId}&period=${period}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error('통계 조회 실패');
        }

        const data = await response.json();
        if (data.ok) {
          setStats(data.stats);
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          toast({
            title: '오류',
            description: err instanceof Error ? err.message : '통계 조회에 실패했습니다.',
            variant: 'destructive',
          });
        }
      }
    })();

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [campaignId, period, toast]);

  // 상태 필터 변경 시 (P0: AbortController + 의존성 수정)
  useEffect(() => {
    if (!campaignId) return;
    setCurrentPage(0);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    (async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/campaigns/sending-history/failures?campaignId=${campaignId}&status=${statusFilter}&limit=${pageSize}&offset=0`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error('실패 목록 조회 실패');
        }

        const data = await response.json();
        if (data.ok) {
          setFailures(data.failures || []);
          setTotalFailures(data.total || 0);
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          toast({
            title: '오류',
            description: err instanceof Error ? err.message : '실패 목록 조회에 실패했습니다.',
            variant: 'destructive',
          });
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [campaignId, statusFilter, toast]);

  // 페이지 변경 시 (P0: AbortController + 의존성 수정)
  useEffect(() => {
    if (!campaignId) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    (async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/campaigns/sending-history/failures?campaignId=${campaignId}&status=${statusFilter}&limit=${pageSize}&offset=${currentPage * pageSize}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error('실패 목록 조회 실패');
        }

        const data = await response.json();
        if (data.ok) {
          setFailures(data.failures || []);
          setTotalFailures(data.total || 0);
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          toast({
            title: '오류',
            description: err instanceof Error ? err.message : '실패 목록 조회에 실패했습니다.',
            variant: 'destructive',
          });
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [campaignId, statusFilter, currentPage, toast, failuresKey]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. 메시지 재전송 (P0: AbortController 추가)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const handleResend = useCallback(async (recordId: string) => {
    try {
      setResendingId(recordId);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(
        `/api/campaigns/sending-history/${recordId}/resend`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      const data = await response.json();

      if (response.ok) {
        toast({
          title: '성공',
          description: data.message || '메시지가 성공적으로 재전송되었습니다.',
          variant: 'success',
        });
        // 목록 새로 고침
        setFailuresKey(k => k + 1);
      } else {
        toast({
          title: '오류',
          description: data.error || '재전송 실패',
          variant: 'destructive',
        });
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        toast({
          title: '오류',
          description: '네트워크 오류가 발생했습니다.',
          variant: 'destructive',
        });
      }
    } finally {
      setResendingId(null);
    }
  }, [toast]);

  if (!campaignId) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <p className="text-yellow-800 font-medium">캠페인이 선택되지 않았습니다.</p>
            <p className="text-yellow-700 text-sm mt-2">캠페인을 선택한 후 대시보드를 확인하세요.</p>
          </div>
        </div>
      </div>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. 상태별 배지 색상
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SENT':
        return 'bg-green-100 text-green-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'RETRY_SCHEDULED':
        return 'bg-blue-100 text-blue-800';
      case 'ABANDONED':
        return 'bg-gray-100 text-gray-800';
      case 'SKIPPED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'SENT':
        return '발송 완료';
      case 'FAILED':
        return '발송 실패';
      case 'PENDING':
        return '발송 대기';
      case 'RETRY_SCHEDULED':
        return '재시도 예정';
      case 'ABANDONED':
        return '재시도 포기';
      case 'SKIPPED':
        return '건너뜀';
      default:
        return status;
    }
  };

  const getFailureReasonLabel = (reason: string) => {
    const reasonMap: Record<string, string> = {
      INVALID_EMAIL: '유효하지 않은 이메일',
      INVALID_PHONE: '유효하지 않은 휴대폰',
      OPT_OUT: '수신거부 고객',
      QUOTA_EXCEEDED: '일일 한도 초과',
      SYSTEM_ERROR: 'CRM 내부 오류',
      PROVIDER_ERROR: 'SMS/Email 서비스 오류',
      NETWORK_ERROR: '네트워크 오류',
      BOUNCE: '이메일 반송',
    };
    return reasonMap[reason] || reason;
  };

  const totalPages = Math.ceil(totalFailures / pageSize);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {/* 헤더 */}
        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">발송 현황</h1>
            <p className="text-gray-600 mt-2">
              캠페인 ID: <span className="font-mono text-sm">{campaignId}</span>
            </p>
          </div>

          {/* 기간 선택 */}
          <div className="flex gap-2">
            {(['1d', '7d', '30d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                  period === p
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
                aria-label={`${p === '1d' ? '1일' : p === '7d' ? '7일' : '30일'} 기간 선택`}
              >
                {p === '1d' ? '1일' : p === '7d' ? '7일' : '30일'}
              </button>
            ))}
          </div>
        </div>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {/* KPI 카드 (4개) */}
        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {stats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* 총 발송 */}
            <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
              <p className="text-gray-600 text-sm mb-2 font-medium">총 발송</p>
              <p className="text-4xl font-bold text-gray-900">{stats.total.toLocaleString()}</p>
              <p className="text-gray-500 text-xs mt-2">건</p>
            </div>

            {/* 성공 */}
            <div className="bg-white rounded-lg p-6 border border-green-200 bg-green-50 shadow-sm">
              <p className="text-green-700 text-sm mb-2 font-medium">성공</p>
              <p className="text-4xl font-bold text-green-600">{stats.sent.toLocaleString()}</p>
              <p className="text-green-600 text-xs mt-2">건</p>
            </div>

            {/* 실패 */}
            <div className="bg-white rounded-lg p-6 border border-red-200 bg-red-50 shadow-sm">
              <p className="text-red-700 text-sm mb-2 font-medium">실패</p>
              <p className="text-4xl font-bold text-red-600">{stats.failed.toLocaleString()}</p>
              <p className="text-red-600 text-xs mt-2">건</p>
            </div>

            {/* 성공률 */}
            <div className="bg-white rounded-lg p-6 border border-blue-200 bg-blue-50 shadow-sm">
              <p className="text-blue-700 text-sm mb-2 font-medium">성공률</p>
              <p className="text-4xl font-bold text-blue-600">{stats.successRate}</p>
              <p className="text-blue-600 text-xs mt-2">/ 100%</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white rounded-lg p-6 border border-gray-200 h-28 animate-pulse"
              >
                <div className="h-4 bg-gray-200 rounded w-20 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-32"></div>
              </div>
            ))}
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {/* 상태별 분포 차트 */}
        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {stats ? (
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">상태별 분포</h2>

            <div className="space-y-4">
              {/* 성공 */}
              {stats.total > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">성공</span>
                    <span className="text-sm font-medium text-green-600">
                      {stats.sent.toLocaleString()} ({((stats.sent / stats.total) * 100).toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${(stats.sent / stats.total) * 100}%` }}
                      aria-label={`성공 ${((stats.sent / stats.total) * 100).toFixed(1)}%`}
                    ></div>
                  </div>
                </div>
              )}

              {/* 실패 */}
              {stats.total > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">실패</span>
                    <span className="text-sm font-medium text-red-600">
                      {stats.failed.toLocaleString()} ({((stats.failed / stats.total) * 100).toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-red-500 h-2 rounded-full"
                      style={{ width: `${(stats.failed / stats.total) * 100}%` }}
                      aria-label={`실패 ${((stats.failed / stats.total) * 100).toFixed(1)}%`}
                    ></div>
                  </div>
                </div>
              )}

              {/* 건너뜀 */}
              {stats.total > 0 && stats.skipped > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">건너뜀</span>
                    <span className="text-sm font-medium text-gray-600">
                      {stats.skipped.toLocaleString()} ({((stats.skipped / stats.total) * 100).toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gray-400 h-2 rounded-full"
                      style={{ width: `${(stats.skipped / stats.total) * 100}%` }}
                      aria-label={`건너뜀 ${((stats.skipped / stats.total) * 100).toFixed(1)}%`}
                    ></div>
                  </div>
                </div>
              )}

              {/* 재시도 예정 */}
              {stats.total > 0 && stats.retryScheduled > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">재시도 예정</span>
                    <span className="text-sm font-medium text-blue-600">
                      {stats.retryScheduled.toLocaleString()} ({((stats.retryScheduled / stats.total) * 100).toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${(stats.retryScheduled / stats.total) * 100}%` }}
                      aria-label={`재시도 예정 ${((stats.retryScheduled / stats.total) * 100).toFixed(1)}%`}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {/* 채널별 성공률 & 실패 원인 */}
        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {stats ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* 채널별 성공률 */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">채널별 성공률</h2>

              <div className="space-y-4">
                {Object.entries(stats.byChannel).map(([channel, data]) => (
                  <div key={channel}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        {channel === 'SMS' ? '문자 (SMS)' : '이메일'}
                      </span>
                      <span className="text-sm font-medium">
                        {data.sent}/{data.sent + data.failed}
                        <span className="text-green-600 ml-2">✅ {data.rate}</span>
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{
                          width:
                            data.sent + data.failed > 0
                              ? `${(data.sent / (data.sent + data.failed)) * 100}%`
                              : '0%',
                        }}
                        aria-label={`${channel} 성공률 ${data.rate}`}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 실패 원인 분석 */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">실패 원인 분석</h2>

              {stats.topFailureReasons.length > 0 ? (
                <div className="space-y-3">
                  {stats.topFailureReasons.map((reason, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-700 w-6">
                          {idx + 1}.
                        </span>
                        <span className="text-sm text-gray-700">
                          {getFailureReasonLabel(reason.reason)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium text-gray-900">
                          {reason.count}건
                        </span>
                        <span className="text-sm text-gray-600 ml-2">({reason.percent})</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">실패 원인이 없습니다.</p>
              )}
            </div>
          </div>
        ) : null}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {/* 실패 목록 테이블 */}
        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* 헤더 */}
          <div className="border-b border-gray-200 p-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  실패한 메시지
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  총 {totalFailures.toLocaleString()}건
                </p>
              </div>

              {/* 상태 필터 */}
              <div className="flex gap-2">
                {(['FAILED', 'ABANDONED'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      setStatusFilter(status);
                      setCurrentPage(0);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      statusFilter === status
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    aria-label={`${status === 'FAILED' ? '실패' : '포기'} 상태 필터`}
                  >
                    {status === 'FAILED' ? '실패' : '포기'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 테이블 */}
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">실패 목록을 불러오는 중...</p>
            </div>
          ) : failures.length === 0 ? (
            <div className="p-8 text-center text-gray-600">
              <p className="text-lg">실패한 메시지가 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-sm font-semibold text-gray-900"
                      aria-label="수신자"
                    >
                      수신자
                    </th>
                    <th
                      className="px-6 py-3 text-left text-sm font-semibold text-gray-900"
                      aria-label="채널"
                    >
                      채널
                    </th>
                    <th
                      className="px-6 py-3 text-left text-sm font-semibold text-gray-900"
                      aria-label="실패 사유"
                    >
                      실패 사유
                    </th>
                    <th
                      className="px-6 py-3 text-left text-sm font-semibold text-gray-900"
                      aria-label="재시도"
                    >
                      재시도
                    </th>
                    <th
                      className="px-6 py-3 text-left text-sm font-semibold text-gray-900"
                      aria-label="조치"
                    >
                      조치
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {failures.map((failure) => (
                    <tr key={failure.id} className="hover:bg-gray-50 transition-colors">
                      {/* 수신자 */}
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">
                            {failure.contact.name}
                          </p>
                          <p className="text-sm text-gray-600">
                            {failure.contact.phone ||
                              failure.contact.email ||
                              'N/A'}
                          </p>
                        </div>
                      </td>

                      {/* 채널 */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                          {failure.channel === 'SMS' ? '문자' : '이메일'}
                        </span>
                      </td>

                      {/* 실패 사유 */}
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600">
                          {failure.failureUserMsg ||
                            getFailureReasonLabel(
                              failure.failureReason || 'UNKNOWN'
                            )}
                        </p>
                      </td>

                      {/* 재시도 */}
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600">
                          {failure.retryCount}/{failure.maxRetries}
                        </p>
                      </td>

                      {/* 조치 */}
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleResend(failure.id)}
                          disabled={
                            resendingId === failure.id ||
                            failure.status === 'SENT'
                          }
                          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                            failure.status === 'SENT'
                              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                              : 'bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-400'
                          }`}
                          aria-label={`${failure.contact.name} 메시지 재전송`}
                        >
                          {resendingId === failure.id ? '처리중...' : '🔄'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 페이지네이션 */}
          {totalFailures > pageSize && (
            <div className="border-t border-gray-200 p-6 flex justify-between items-center">
              <p className="text-sm text-gray-600">
                {totalFailures > 0
                  ? `${currentPage * pageSize + 1}-${Math.min((currentPage + 1) * pageSize, totalFailures)} / ${totalFailures}건`
                  : '0건'}
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                  className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                  aria-label="이전 페이지"
                >
                  ← 이전
                </button>

                <div className="flex items-center gap-2 px-4">
                  <span className="text-sm text-gray-700">
                    {currentPage + 1}/{totalPages}
                  </span>
                </div>

                <button
                  onClick={() =>
                    setCurrentPage(
                      Math.min(totalPages - 1, currentPage + 1)
                    )
                  }
                  disabled={currentPage === totalPages - 1}
                  className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                  aria-label="다음 페이지"
                >
                  다음 →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
