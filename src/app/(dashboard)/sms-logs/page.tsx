'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import ABTestDashboard from './components/ab-test-dashboard';

interface SmsLogRow {
  id: string;
  phone: string;
  contentPreview: string;
  status: 'SENT' | 'FAILED' | 'PENDING';
  messageType: 'SMS' | 'KAKAO' | 'EMAIL';
  channel: string;
  sentAt: string;
  openedAt?: string | null;
  clickedAt?: string | null;
  segmentCode?: string | null;
  psychologyLens?: string | null;
  abTestGroup?: string | null;
}

interface SmsLogsApiResponse {
  ok: boolean;
  logs: SmsLogRow[];
  summary: {
    total: number;
    sent: number;
    failed: number;
    blocked: number;
  };
  page: number;
  pageSize: number;
  totalPages: number;
}

interface StatsApiResponse {
  ok: boolean;
  stats: {
    total: number;
    sent: number;
    failed: number;
    blocked: number;
    successRate: number;
    byChannel: Record<string, { sent: number; failed: number }>;
  };
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function SmsLogsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [days, setDays] = useState(7);
  const [messageTypeFilter, setMessageTypeFilter] = useState<'ALL' | 'SMS' | 'KAKAO' | 'EMAIL'>('ALL');

  // 로그 데이터 조회
  const { data: logsData, isLoading: logsLoading } = useSWR<SmsLogsApiResponse>(
    `/api/sms-logs?days=${days}&page=${page}&take=${pageSize}&messageType=${messageTypeFilter === 'ALL' ? '' : messageTypeFilter}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  // 통계 데이터 조회
  const { data: statsData } = useSWR<StatsApiResponse>(
    `/api/sms-logs/stats?days=${days}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const stats = statsData?.stats;

  const logs = logsData?.logs || [];
  const totalPages = logsData?.totalPages || 1;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">SMS/Kakao/Email Logs</h1>
          <p className="text-gray-600 mt-2">Message delivery and performance analytics</p>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500">Total Sent</div>
              <div className="mt-2 flex items-baseline">
                <div className="text-2xl font-bold text-gray-900">{stats.sent.toLocaleString()}</div>
                <div className="ml-2 text-sm text-gray-500">({stats.total} tracked)</div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500">Failed</div>
              <div className="mt-2 flex items-baseline">
                <div className="text-2xl font-bold text-red-600">{stats.failed.toLocaleString()}</div>
                <div className="ml-2 text-sm text-gray-500">
                  {stats.sent > 0 ? `${((stats.failed / stats.sent) * 100).toFixed(1)}%` : '0%'}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500">Success Rate</div>
              <div className="mt-2 flex items-baseline">
                <div className="text-2xl font-bold text-green-600">
                  {(stats.successRate * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500">Blocked</div>
              <div className="mt-2 flex items-baseline">
                <div className="text-2xl font-bold text-yellow-600">{stats.blocked.toLocaleString()}</div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500">Date Range</div>
              <div className="mt-2 text-sm text-gray-900 font-medium">{days} days</div>
              <button
                onClick={() => setDays(7)}
                className={`mt-2 text-xs px-2 py-1 rounded ${days === 7 ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-700'}`}
              >
                7D
              </button>
              <button
                onClick={() => setDays(30)}
                className={`mt-2 ml-2 text-xs px-2 py-1 rounded ${days === 30 ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-700'}`}
              >
                30D
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-4 items-center bg-white p-4 rounded-lg shadow">
          <div>
            <label className="text-sm font-medium text-gray-700">Message Type</label>
            <select
              value={messageTypeFilter}
              onChange={(e) => {
                setMessageTypeFilter(e.target.value as any);
                setPage(1);
              }}
              className="mt-1 block w-full md:w-48 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">All Messages</option>
              <option value="SMS">SMS Only</option>
              <option value="KAKAO">Kakao Only</option>
              <option value="EMAIL">Email Only</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Page Size</label>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value));
                setPage(1);
              }}
              className="mt-1 block w-full md:w-24 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Channel</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lens</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">A/B</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logsLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    No logs found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.phone}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 truncate">{log.contentPreview}...</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {log.messageType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.channel}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          log.status === 'SENT'
                            ? 'bg-green-100 text-green-800'
                            : log.status === 'FAILED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.psychologyLens || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {log.abTestGroup ? (
                        <span className={`inline-flex px-2 py-1 text-xs rounded-full font-bold ${log.abTestGroup === 'A' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                          {log.abTestGroup}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.sentAt
                        ? formatDistanceToNow(new Date(log.sentAt), { addSuffix: true, locale: ko })
                        : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Page <span className="font-medium">{page}</span> of{' '}
                    <span className="font-medium">{totalPages}</span>
                  </p>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`px-3 py-1 text-sm rounded ${
                        page === p
                          ? 'bg-blue-500 text-white font-bold'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* A/B Test Dashboard */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">A/B Test Performance</h2>
          <ABTestDashboard orgId="current" />
        </div>
      </div>
    </div>
  );
}
