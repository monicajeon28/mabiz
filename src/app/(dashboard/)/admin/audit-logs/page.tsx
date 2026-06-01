'use client';

import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface AuditLog {
  id: bigint;
  action: string;
  resourceType: string;
  resourceId: string | null;
  userId: string | null;
  ipAddress: string | null;
  status: string;
  piiFieldsAccessed: string[];
  purpose: string | null;
  durationMs: number | null;
  createdAt: string;
  errorMessage: string | null;
}

interface AuditLogsResponse {
  ok: boolean;
  logs: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

const ACTION_COLOR: Record<string, string> = {
  'READ': 'bg-blue-100 text-blue-800',
  'WRITE': 'bg-purple-100 text-purple-800',
  'DELETE': 'bg-red-100 text-red-800',
  'EXPORT': 'bg-orange-100 text-orange-800',
  'LOGIN': 'bg-green-100 text-green-800',
  'LOGOUT': 'bg-gray-100 text-gray-800',
};

const STATUS_ICON: Record<string, string> = {
  'SUCCESS': '✅',
  'FAILED': '❌',
  'DENIED': '🚫',
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 필터 상태
  const [selectedOrg, setSelectedOrg] = useState('');
  const [userId, setUserId] = useState('');
  const [action, setAction] = useState('');
  const [status, setStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 페이지 상태
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // 상세보기 모달
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = async (pageNum: number = 1) => {
    try {
      setLoading(true);
      setError(null);

      const orgId = selectedOrg || localStorage.getItem('defaultOrgId');
      if (!orgId) {
        setError('조직을 선택해주세요');
        return;
      }

      const params = new URLSearchParams();
      params.set('organizationId', orgId);
      params.set('limit', pageSize.toString());
      params.set('offset', ((pageNum - 1) * pageSize).toString());

      if (userId) params.set('userId', userId);
      if (action) params.set('action', action);
      if (status) params.set('status', status);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const response = await fetch(`/api/admin/compliance/audit-logs?${params}`);

      if (!response.ok) {
        throw new Error('로그 로드 실패');
      }

      const result: AuditLogsResponse = await response.json();
      setLogs(result.logs);
      setTotal(result.total);
      setPage(result.page);
      setHasMore(result.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  };

  // 필터 변경 시 첫 페이지로
  const handleFilterChange = () => {
    setPage(1);
    fetchLogs(1);
  };

  useEffect(() => {
    fetchLogs(1);
  }, [pageSize]);

  return (
    <div className="space-y-6 p-8 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">감시 로그</h1>
        <p className="text-sm text-gray-500 mt-2">
          모든 PII 접근, 수정, 삭제 작업의 중앙 기록
        </p>
      </div>

      {/* 필터 패널 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">필터</h2>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">사용자 ID</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="사용자 검색"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">액션</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">전체</option>
              <option value="READ">READ</option>
              <option value="WRITE">WRITE</option>
              <option value="DELETE">DELETE</option>
              <option value="EXPORT">EXPORT</option>
              <option value="LOGIN">LOGIN</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">상태</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">전체</option>
              <option value="SUCCESS">성공</option>
              <option value="FAILED">실패</option>
              <option value="DENIED">거부</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">시작 날짜</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">종료 날짜</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">결과 수</label>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="25">25개</option>
              <option value="50">50개</option>
              <option value="100">100개</option>
            </select>
          </div>

          <div className="col-span-2 flex gap-2 items-end">
            <button
              onClick={handleFilterChange}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700"
            >
              <Search className="w-4 h-4 inline mr-2" />
              검색
            </button>
            <button
              onClick={() => {
                setUserId('');
                setAction('');
                setStatus('');
                setStartDate('');
                setEndDate('');
              }}
              className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-300"
            >
              초기화
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* 로그 테이블 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">시간</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">사용자</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">액션</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">리소스</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">PII 필드</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">상태</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">IP</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    로드 중...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    로그가 없습니다
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {format(new Date(log.createdAt), 'MM/dd HH:mm:ss', { locale: ko })}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{log.userId || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-block px-2 py-1 rounded text-sm font-semibold ${ACTION_COLOR[log.action] || 'bg-gray-100'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div>{log.resourceType}</div>
                      {log.resourceId && <div className="text-sm text-gray-600">{log.resourceId}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {log.piiFieldsAccessed.length > 0 ? (
                        <div className="flex gap-1 flex-wrap">
                          {log.piiFieldsAccessed.slice(0, 3).map((field) => (
                            <span key={field} className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded text-sm">
                              {field}
                            </span>
                          ))}
                          {log.piiFieldsAccessed.length > 3 && (
                            <span className="text-sm text-gray-500">+{log.piiFieldsAccessed.length - 3}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-600 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="text-lg">{STATUS_ICON[log.status] || '❓'}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 font-mono text-sm">{log.ipAddress || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        <div className="px-4 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="text-sm text-gray-600">
            총 <strong>{total}</strong>개 (페이지 {page}/{Math.ceil(total / pageSize)})
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fetchLogs(page - 1)}
              disabled={page === 1 || loading}
              className="px-3 py-1 border border-gray-300 rounded text-sm font-medium disabled:opacity-50"
            >
              이전
            </button>
            <button
              onClick={() => fetchLogs(page + 1)}
              disabled={!hasMore || loading}
              className="px-3 py-1 border border-gray-300 rounded text-sm font-medium disabled:opacity-50"
            >
              다음
            </button>
          </div>
        </div>
      </div>

      {/* 상세보기 모달 */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">감시 로그 상세</h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 uppercase tracking-wide">시간</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {format(new Date(selectedLog.createdAt), 'PPP p', { locale: ko })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 uppercase tracking-wide">사용자</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">{selectedLog.userId || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 uppercase tracking-wide">액션</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    <span className={`inline-block px-2 py-1 rounded text-sm font-semibold ${ACTION_COLOR[selectedLog.action]}`}>
                      {selectedLog.action}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 uppercase tracking-wide">상태</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {selectedLog.status} {STATUS_ICON[selectedLog.status]}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 uppercase tracking-wide">리소스</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {selectedLog.resourceType} {selectedLog.resourceId && `(${selectedLog.resourceId})`}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 uppercase tracking-wide">IP</p>
                  <p className="text-sm font-mono text-gray-900 mt-1">{selectedLog.ipAddress || '-'}</p>
                </div>
              </div>

              {selectedLog.piiFieldsAccessed.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 uppercase tracking-wide">PII 필드</p>
                  <div className="flex gap-2 flex-wrap mt-2">
                    {selectedLog.piiFieldsAccessed.map((field) => (
                      <span key={field} className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">
                        {field}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedLog.durationMs && (
                <div>
                  <p className="text-sm text-gray-500 uppercase tracking-wide">소요시간</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">{selectedLog.durationMs}ms</p>
                </div>
              )}

              {selectedLog.errorMessage && (
                <div>
                  <p className="text-sm text-gray-500 uppercase tracking-wide">에러 메시지</p>
                  <p className="text-sm text-red-600 mt-1 font-mono">{selectedLog.errorMessage}</p>
                </div>
              )}

              {selectedLog.purpose && (
                <div>
                  <p className="text-sm text-gray-500 uppercase tracking-wide">목적</p>
                  <p className="text-sm text-gray-900 mt-1">{selectedLog.purpose}</p>
                </div>
              )}
            </div>

            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setSelectedLog(null)}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-300 w-full"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
