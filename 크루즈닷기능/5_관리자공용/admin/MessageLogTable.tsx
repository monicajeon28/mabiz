'use client';

import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';
import ResendConfirmDialog from './ResendConfirmDialog';
import type { MessageLogEntry, PaginationInfo } from '@/lib/schemas/admin-message-schema';

interface Props {
  onRefresh?: () => void;
}

export default function MessageLogTable({ onRefresh }: Props) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('');
  const [channel, setChannel] = useState<string>('');
  const [search, setSearch] = useState('');
  const [logs, setLogs] = useState<MessageLogEntry[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // 로그 조회
  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        ...(status && { status }),
        ...(channel && { channel }),
        ...(search && { search }),
      });

      const res = await fetch(`/api/admin/messages/logs?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.ok && data.data) {
        setLogs(data.data.logs);
        setPagination(data.data.pagination);
      } else {
        setError(data.error || '로그 조회에 실패했습니다');
        logger.warn('[MESSAGE_LOG_TABLE] 로그 조회 실패', {
          error: data.error,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류';
      setError(message);
      logger.error('[MESSAGE_LOG_TABLE] 로그 조회 오류', {
        error: message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [page, status, channel, search]);

  // 초기 로드 및 필터 변경 시
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // 상태 배지
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs md:text-sm font-medium">
            ✅ 발송 완료
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs md:text-sm font-medium">
            ❌ 발송 실패
          </span>
        );
      case 'WAITING':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs md:text-sm font-medium">
            ⏳ 대기 중
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs md:text-sm font-medium">
            ⌛ 예정
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs md:text-sm font-medium">
            {status}
          </span>
        );
    }
  };

  // 채널 배지
  const getChannelBadge = (channel: string) => {
    const lowerChannel = channel?.toLowerCase() || '';
    if (lowerChannel === 'sms') {
      return <span className="text-xs md:text-sm">📱 SMS</span>;
    }
    if (lowerChannel === 'email') {
      return <span className="text-xs md:text-sm">📧 이메일</span>;
    }
    if (lowerChannel === 'kakao') {
      return <span className="text-xs md:text-sm">💬 카카오</span>;
    }
    return <span className="text-xs md:text-sm">{channel}</span>;
  };

  // 필터 변경 시 페이지 1로 리셋
  const handleFilterChange = (key: 'status' | 'channel' | 'search', value: string) => {
    setPage(1);
    if (key === 'status') setStatus(value);
    if (key === 'channel') setChannel(value);
    if (key === 'search') setSearch(value);
  };

  // 재발송 성공 시 콜백
  const handleResendSuccess = () => {
    setConfirmOpen(false);
    setSelectedId(null);
    fetchLogs();
    onRefresh?.();
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* 필터 */}
      <div className="p-4 md:p-6 border-b border-gray-200 bg-gray-50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          {/* 검색 입력 */}
          <input
            type="text"
            placeholder="이름/전화로 검색"
            value={search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="w-full px-3 md:px-4 py-2 md:py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
          />

          {/* 상태 필터 */}
          <select
            value={status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="w-full px-3 md:px-4 py-2 md:py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
          >
            <option value="">모든 상태</option>
            <option value="SENT">발송 완료</option>
            <option value="FAILED">발송 실패</option>
            <option value="WAITING">대기 중</option>
            <option value="PENDING">예정</option>
          </select>

          {/* 채널 필터 */}
          <select
            value={channel}
            onChange={(e) => handleFilterChange('channel', e.target.value)}
            className="w-full px-3 md:px-4 py-2 md:py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
          >
            <option value="">모든 채널</option>
            <option value="SMS">SMS</option>
            <option value="Email">이메일</option>
            <option value="Kakao">카카오톡</option>
          </select>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="px-4 md:px-6 py-3 bg-red-50 border-b border-red-200 text-red-700 text-sm md:text-base">
          {error}
        </div>
      )}

      {/* 로딩 상태 */}
      {isLoading && (
        <div className="px-4 md:px-6 py-8 text-center text-gray-600 text-sm md:text-base">
          로딩 중...
        </div>
      )}

      {/* 테이블 */}
      {!isLoading && logs.length === 0 ? (
        <div className="px-4 md:px-6 py-8 text-center text-gray-600 text-sm md:text-base">
          발송 기록이 없습니다
        </div>
      ) : (
        <>
          {/* 데스크톱 테이블 (md 이상) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">이름</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">전화</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">상태</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">채널</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">발송시간</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">제어</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-900">{log.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{log.phone}</td>
                    <td className="px-6 py-4 text-sm">{getStatusBadge(log.status)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{getChannelBadge(log.channel)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {log.sentAt ? new Date(log.sentAt).toLocaleString('ko-KR') : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {log.status === 'FAILED' && (
                        <button
                          onClick={() => {
                            setSelectedId(log.id);
                            setConfirmOpen(true);
                          }}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs font-medium"
                        >
                          재발송
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 모바일 카드 뷰 (md 미만) */}
          <div className="md:hidden space-y-2 p-4">
            {logs.map((log) => (
              <div
                key={log.id}
                className="border border-gray-200 rounded-lg p-4 space-y-2 bg-white"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{log.name}</p>
                    <p className="text-xs text-gray-600">{log.phone}</p>
                  </div>
                  <div>{getStatusBadge(log.status)}</div>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-600 py-2 border-t border-gray-100">
                  <span>{getChannelBadge(log.channel)}</span>
                  <span>{log.sentAt ? new Date(log.sentAt).toLocaleString('ko-KR') : '-'}</span>
                </div>
                {log.status === 'FAILED' && (
                  <button
                    onClick={() => {
                      setSelectedId(log.id);
                      setConfirmOpen(true);
                    }}
                    className="w-full mt-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs font-medium h-10 flex items-center justify-center"
                  >
                    재발송
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* 페이지네이션 */}
      {pagination && !isLoading && logs.length > 0 && (
        <div className="px-4 md:px-6 py-4 border-t border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50">
          <p className="text-xs md:text-sm text-gray-600">
            총 {pagination.total}개 중{' '}
            {(pagination.page - 1) * pagination.limit + 1}-
            {Math.min(pagination.page * pagination.limit, pagination.total)}번째
          </p>
          <div className="flex gap-2">
            <button
              disabled={pagination.page === 1 || isLoading}
              onClick={() => setPage(Math.max(1, pagination.page - 1))}
              className="px-3 md:px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-xs md:text-sm font-medium h-10"
            >
              이전
            </button>
            <button
              disabled={!pagination.hasMore || isLoading}
              onClick={() => setPage(pagination.page + 1)}
              className="px-3 md:px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-xs md:text-sm font-medium h-10"
            >
              다음
            </button>
          </div>
        </div>
      )}

      {/* 재발송 확인 다이얼로그 */}
      {selectedId && (
        <ResendConfirmDialog
          open={confirmOpen}
          logId={selectedId}
          onClose={() => {
            setConfirmOpen(false);
            setSelectedId(null);
          }}
          onSuccess={handleResendSuccess}
        />
      )}
    </div>
  );
}
