'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from '@/hooks/useSession';
import { logger } from '@/lib/logger';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

type Tab = 'events' | 'dlq';

interface WebhookEvent {
  id: string;
  eventId: string;
  webhookType: string;
  status: string;
  errorMessage: string | null;
  processedAt: string;
}

interface DLQEntry {
  id: string;
  webhookType: string;
  failureReason: string;
  status: string;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  format: string;
}

interface Pagination { total: number; page: number; pageSize: number; totalPages: number; }

const STATUS_STYLES: Record<string, string> = {
  SUCCESS: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  RESOLVED: 'bg-gray-100 text-gray-600',
};

export default function WebhookLogsPage() {
  const { session } = useSession();
  const [tab, setTab] = useState<Tab>('events');
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [dlqEntries, setDlqEntries] = useState<DLQEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, pageSize: 20, totalPages: 1 });
  const [summary, setSummary] = useState<Record<string, number>>({});
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (page = 1) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ tab, page: String(page), limit: '20' });
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilter) {
        if (tab === 'events') params.set('status', statusFilter);
        else params.set('dlqStatus', statusFilter);
      }

      const res = await fetch(`/api/admin/webhook-logs?${params}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error('데이터 조회 실패');
      const data = await res.json();

      if (tab === 'events') {
        setEvents(data.data || []);
        setSummary(data.summary || {});
      } else {
        setDlqEntries(data.data || []);
        setSummary(data.summary || {});
      }
      setPagination(data.pagination || { total: 0, page: 1, pageSize: 20, totalPages: 1 });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      logger.error('[WebhookLogsPage]', { err });
      setError(err instanceof Error ? err.message : '오류 발생');
    } finally {
      setLoading(false);
    }
  }, [tab, typeFilter, statusFilter]);

  useEffect(() => { fetchData(1); }, [fetchData]);

  if (session?.role !== 'GLOBAL_ADMIN') {
    return (
      <div className="p-8 text-center text-red-600 font-medium">
        어드민 전용 페이지입니다.
      </div>
    );
  }

  const fmtDate = (d: string) => new Date(d).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">웹훅 로그</h1>
        <p className="text-sm text-gray-500 mt-1">외부 시스템 수신 이력 및 DLQ 현황</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {tab === 'events' ? (
          <>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-xs text-green-600 font-medium">성공</p>
              <p className="text-2xl font-bold text-green-700">{(summary.successCount ?? 0).toLocaleString()}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <p className="text-xs text-red-600 font-medium">실패</p>
              <p className="text-2xl font-bold text-red-700">{(summary.failedCount ?? 0).toLocaleString()}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 col-span-2">
              <p className="text-xs text-blue-600 font-medium">전체 이벤트</p>
              <p className="text-2xl font-bold text-blue-700">{(summary.total ?? 0).toLocaleString()}</p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-yellow-50 rounded-lg p-4">
              <p className="text-xs text-yellow-600 font-medium">대기</p>
              <p className="text-2xl font-bold text-yellow-700">{(summary.pending ?? 0).toLocaleString()}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-xs text-blue-600 font-medium">처리중</p>
              <p className="text-2xl font-bold text-blue-700">{(summary.processing ?? 0).toLocaleString()}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-xs text-green-600 font-medium">완료</p>
              <p className="text-2xl font-bold text-green-700">{(summary.resolved ?? 0).toLocaleString()}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <p className="text-xs text-red-600 font-medium">최종실패</p>
              <p className="text-2xl font-bold text-red-700">{(summary.failed ?? 0).toLocaleString()}</p>
            </div>
          </>
        )}
      </div>

      {/* 탭 + 필터 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-2">
          {(['events', 'dlq'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setStatusFilter(''); setTypeFilter(''); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                tab === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {t === 'events' ? '수신 이력' : 'DLQ 재시도'}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            placeholder="webhook 타입 필터"
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-44"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">전체 상태</option>
            {tab === 'events' ? (
              <>
                <option value="SUCCESS">SUCCESS</option>
                <option value="FAILED">FAILED</option>
              </>
            ) : (
              <>
                <option value="PENDING">PENDING</option>
                <option value="PROCESSING">PROCESSING</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="FAILED">FAILED</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* 에러 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      )}

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : tab === 'events' ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">타입</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">이벤트 ID</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">상태</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">에러</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">처리일시</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">데이터가 없습니다.</td>
                </tr>
              ) : events.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-blue-700">{e.webhookType}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 max-w-xs truncate">{e.eventId}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[e.status] || STATUS_STYLES.PENDING}`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-red-600 max-w-xs truncate">{e.errorMessage || '-'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(e.processedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">타입</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">상태</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">재시도</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">다음 재시도</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">실패 사유</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">발생일시</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dlqEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">DLQ가 비어있습니다.</td>
                </tr>
              ) : dlqEntries.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-blue-700">{d.webhookType}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[d.status] || STATUS_STYLES.PENDING}`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">{d.retryCount}/{d.maxRetries}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {d.nextRetryAt ? fmtDate(d.nextRetryAt) : d.resolvedAt ? `완료 ${fmtDate(d.resolvedAt)}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-xs text-red-600 max-w-xs truncate">{d.failureReason}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(d.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* 페이지네이션 */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">총 {pagination.total}건 · {pagination.page}/{pagination.totalPages} 페이지</p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => fetchData(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(pagination.page - 2, pagination.totalPages - 4)) + i;
                return (
                  <button
                    key={p}
                    onClick={() => fetchData(p)}
                    className={`px-2.5 py-1 rounded text-xs border ${p === pagination.page ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => fetchData(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
