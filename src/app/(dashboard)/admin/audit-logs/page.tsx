'use client';

import { useEffect, useState } from 'react';
import { getMabizSession } from '@/lib/auth';
import type { MabizAuthContext } from '@/lib/auth';
import { logger } from '@/lib/logger';

interface AuditLogEntry {
  id: number;
  action: string;
  table: string;
  recordId?: string;
  userId: string;
  organizationId?: string;
  status: 'ALLOWED' | 'DENIED';
  reason?: string;
  details?: Record<string, any>;
  createdAt: string;
}

interface SecurityEvent {
  id: number;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userId: string;
  organizationId?: string;
  description: string;
  details?: Record<string, any>;
  createdAt: string;
}

export default function AuditLogsPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    action: 'ALL',
    status: 'ALL',
    severity: 'ALL',
    startDate: '',
    endDate: '',
  });
  const [ctx, setCtx] = useState<MabizAuthContext | null>(null);

  // 초기 로드
  useEffect(() => {
    loadData();
  }, [filter]);

  async function loadData() {
    try {
      setLoading(true);

      // 감시 로그 파라미터
      const auditParams = new URLSearchParams();
      if (filter.action !== 'ALL') auditParams.set('action', filter.action);
      if (filter.status !== 'ALL') auditParams.set('status', filter.status);
      if (filter.startDate) auditParams.set('startDate', filter.startDate);
      if (filter.endDate) auditParams.set('endDate', filter.endDate);

      // 보안 이벤트 파라미터
      const secParams = new URLSearchParams();
      if (filter.severity !== 'ALL') secParams.set('severity', filter.severity);
      if (filter.startDate) secParams.set('startDate', filter.startDate);
      if (filter.endDate) secParams.set('endDate', filter.endDate);
      secParams.set('limit', '100');

      const [auditRes, secRes] = await Promise.all([
        fetch(`/api/admin/audit-logs?${auditParams.toString()}`),
        fetch(`/api/admin/security-events?${secParams.toString()}`),
      ]);

      if (auditRes.ok) {
        const data = await auditRes.json();
        if (data.ok) {
          setAuditLogs(data.data ?? []);
        }
      }

      if (secRes.ok) {
        const data = await secRes.json();
        if (data.ok) {
          setSecurityEvents(data.data ?? []);
        }
      }

      setLoading(false);
    } catch (error) {
      logger.error('Error loading audit logs:', error);
      setLoading(false);
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border border-red-300';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border border-orange-300';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
      case 'LOW':
        return 'bg-blue-100 text-blue-800 border border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-300';
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'DENIED'
      ? 'bg-red-100 text-red-800'
      : 'bg-green-100 text-green-800';
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'SELECT':
        return 'bg-blue-100 text-blue-800';
      case 'INSERT':
        return 'bg-green-100 text-green-800';
      case 'UPDATE':
        return 'bg-yellow-100 text-yellow-800';
      case 'DELETE':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="space-y-8">
        {/* 헤더 */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">감시 로그</h1>
          <p className="mt-2 text-gray-600">
            모든 CommissionLedger 접근 기록 및 보안 이벤트를 모니터링합니다.
          </p>
        </div>

        {/* 필터 섹션 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">필터</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* 액션 필터 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                액션
              </label>
              <select
                value={filter.action}
                onChange={(e) =>
                  setFilter({ ...filter, action: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="ALL">모두</option>
                <option value="SELECT">SELECT</option>
                <option value="INSERT">INSERT</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>

            {/* 상태 필터 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                상태
              </label>
              <select
                value={filter.status}
                onChange={(e) =>
                  setFilter({ ...filter, status: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="ALL">모두</option>
                <option value="ALLOWED">허용됨</option>
                <option value="DENIED">거부됨</option>
              </select>
            </div>

            {/* 심각도 필터 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                심각도
              </label>
              <select
                value={filter.severity}
                onChange={(e) =>
                  setFilter({ ...filter, severity: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="ALL">모두</option>
                <option value="CRITICAL">심각</option>
                <option value="HIGH">높음</option>
                <option value="MEDIUM">중간</option>
                <option value="LOW">낮음</option>
              </select>
            </div>

            {/* 시작 날짜 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                시작 날짜
              </label>
              <input
                type="date"
                value={filter.startDate}
                onChange={(e) =>
                  setFilter({ ...filter, startDate: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            {/* 종료 날짜 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                종료 날짜
              </label>
              <input
                type="date"
                value={filter.endDate}
                onChange={(e) =>
                  setFilter({ ...filter, endDate: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>
        </div>

        {/* 감시 로그 섹션 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              접근 로그 ({auditLogs.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    시간
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    사용자
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    액션
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    테이블
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    상태
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    사유
                  </th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      접근 로그가 없습니다.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-gray-200 hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {log.userId}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2 py-1 rounded text-sm font-semibold ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {log.table}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2 py-1 rounded text-sm font-semibold ${getStatusColor(log.status)}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {log.reason || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 보안 이벤트 섹션 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              보안 이벤트 ({securityEvents.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    시간
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    심각도
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    이벤트 타입
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    사용자
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    설명
                  </th>
                </tr>
              </thead>
              <tbody>
                {securityEvents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      보안 이벤트가 없습니다.
                    </td>
                  </tr>
                ) : (
                  securityEvents.map((event) => (
                    <tr
                      key={event.id}
                      className={`border-b border-gray-200 hover:bg-gray-50 ${
                        event.severity === 'CRITICAL' ? 'bg-red-50' : ''
                      }`}
                    >
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(event.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block px-2 py-1 rounded text-sm font-semibold ${getSeverityColor(event.severity)}`}
                        >
                          {event.severity}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {event.type}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {event.userId}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {event.description}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 예정된 기능 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">
            향후 기능 (개발 예정)
          </h3>
          <ul className="list-disc list-inside space-y-2 text-blue-800">
            <li>
              <strong>실시간 알림</strong>: CRITICAL/HIGH 보안 이벤트 발생시 실시간 푸시 알림
            </li>
            <li>
              <strong>자동 리포트</strong>: 주간/월간 감시 로그 리포트 자동 생성 및 이메일 발송
            </li>
            <li>
              <strong>이상 탐지</strong>: 비정상적인 접근 패턴 감지 및 경고
            </li>
            <li>
              <strong>데이터 내보내기</strong>: 감시 로그를 CSV/Excel로 내보내기
            </li>
            <li>
              <strong>통합 대시보드</strong>: Slack/Teams 연동으로 보안팀에 실시간 알림
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
