'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, XCircle, TrendingUp, Activity, Shield, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface ComplianceDashboardData {
  ok: boolean;
  summary: {
    totalActionsToday: number;
    piiAccessCountToday: number;
    suspiciousActivitiesCount: number;
    failedActionsToday: number;
    failedLoginAttemptsToday: number;
  };
  recentAnomalies: Array<{
    id: number;
    anomalyType: string;
    severity: string;
    riskScore: number;
    status: string;
    createdAt: string;
  }>;
  topPiiAccessors: Array<{
    userId: string;
    accessCount: number;
  }>;
  complianceStatus: Record<string, any>;
  riskScore: number;
  riskFactors: Record<string, number>;
  timestamp: string;
}

const SEVERITY_COLOR: Record<string, string> = {
  'LOW': 'bg-blue-50 border-blue-200 text-blue-700',
  'MEDIUM': 'bg-yellow-50 border-yellow-200 text-yellow-700',
  'HIGH': 'bg-orange-50 border-orange-200 text-orange-700',
  'CRITICAL': 'bg-red-50 border-red-200 text-red-700',
};

const SEVERITY_BADGE: Record<string, string> = {
  'LOW': 'bg-blue-100 text-blue-800',
  'MEDIUM': 'bg-yellow-100 text-yellow-800',
  'HIGH': 'bg-orange-100 text-orange-800',
  'CRITICAL': 'bg-red-100 text-red-800',
};

export default function ComplianceMonitoringPage() {
  const [data, setData] = useState<ComplianceDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 기본 조직 ID (나중에 동적으로 변경 가능)
        const orgId = selectedOrg || localStorage.getItem('defaultOrgId');
        if (!orgId) {
          setError('조직을 선택해주세요');
          return;
        }

        const response = await fetch(
          `/api/admin/compliance/monitoring?organizationId=${orgId}&daysBack=7`
        );

        if (!response.ok) {
          throw new Error('데이터 로드 실패');
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000); // 5분마다 새로고침

    return () => clearInterval(interval);
  }, [selectedOrg]);

  if (loading && !data) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-gray-500">로드 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const riskLevel =
    data.riskScore >= 80 ? 'CRITICAL' :
    data.riskScore >= 60 ? 'HIGH' :
    data.riskScore >= 40 ? 'MEDIUM' : 'LOW';

  return (
    <div className="space-y-6 p-8 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">규정 준수 모니터링</h1>
          <p className="text-sm text-gray-500 mt-2">
            마지막 업데이트: {format(new Date(data.timestamp), 'PPP p', { locale: ko })}
          </p>
        </div>

        <div className="text-right">
          <div className="text-4xl font-bold text-gray-900">{data.riskScore}</div>
          <div className={`text-sm font-medium mt-1 ${
            riskLevel === 'CRITICAL' ? 'text-red-600' :
            riskLevel === 'HIGH' ? 'text-orange-600' :
            riskLevel === 'MEDIUM' ? 'text-yellow-600' : 'text-green-600'
          }`}>
            {riskLevel === 'CRITICAL' ? '⚠️ 긴급' :
             riskLevel === 'HIGH' ? '⚠️ 높음' :
             riskLevel === 'MEDIUM' ? '⚠️ 중간' : '✅ 낮음'} 위험도
          </div>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">오늘 작업</p>
              <p className="text-2xl font-bold text-gray-900">{data.summary.totalActionsToday}</p>
            </div>
            <Activity className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">PII 접근</p>
              <p className="text-2xl font-bold text-gray-900">{data.summary.piiAccessCountToday}</p>
            </div>
            <Shield className="w-8 h-8 text-amber-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">의심 활동</p>
              <p className="text-2xl font-bold text-gray-900">{data.summary.suspiciousActivitiesCount}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">실패 작업</p>
              <p className="text-2xl font-bold text-gray-900">{data.summary.failedActionsToday}</p>
            </div>
            <XCircle className="w-8 h-8 text-gray-500" />
          </div>
        </div>
      </div>

      {/* 위험 요소 분석 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">위험 요소 분석</h2>
        <div className="space-y-4">
          {Object.entries(data.riskFactors).map(([factor, score]) => (
            <div key={factor}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">
                  {factor === 'failedLoginAttempts' && '🔓 실패 로그인 시도'}
                  {factor === 'suspiciousActivities' && '🚨 의심 활동'}
                  {factor === 'failedAuditActions' && '❌ 실패 감시'}
                  {factor === 'complianceGap' && '📋 규정 준수 격차'}
                </span>
                <span className="text-sm font-semibold text-gray-900">{Math.round(score as number)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-orange-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min((score as number) / 50 * 100, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 최근 이상 활동 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">최근 이상 활동</h2>
        {data.recentAnomalies.length > 0 ? (
          <div className="space-y-3">
            {data.recentAnomalies.slice(0, 10).map(anomaly => (
              <div
                key={anomaly.id}
                className={`p-3 rounded-lg border ${SEVERITY_COLOR[anomaly.severity] || SEVERITY_COLOR['LOW']}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{anomaly.anomalyType}</p>
                    <p className="text-xs mt-1 opacity-75">
                      {format(new Date(anomaly.createdAt), 'PPP p', { locale: ko })}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${SEVERITY_BADGE[anomaly.severity]}`}>
                      {anomaly.status}
                    </span>
                    <p className="text-xs mt-1 font-semibold">위험도: {anomaly.riskScore}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
            <p>최근 이상 활동이 없습니다</p>
          </div>
        )}
      </div>

      {/* 규정 준수 상태 */}
      <div className="grid grid-cols-2 gap-4">
        {Object.entries(data.complianceStatus).map(([regulation, status]: [string, any]) => (
          <div key={regulation} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 uppercase">{regulation}</h3>
              <div className="text-2xl font-bold text-gray-900">{status.completionRate}%</div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
              <div
                className={`h-3 rounded-full transition-all ${
                  status.completionRate >= 80 ? 'bg-green-500' :
                  status.completionRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${status.completionRate}%` }}
              />
            </div>
            <ul className="space-y-2 text-xs">
              {(status.items || []).slice(0, 5).map((item: any) => (
                <li key={item.id} className="flex items-center gap-2">
                  {item.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  )}
                  <span className={item.completed ? 'text-gray-600 line-through' : 'text-gray-700'}>
                    {item.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* 상위 PII 접근자 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">상위 PII 접근 사용자</h2>
        {data.topPiiAccessors.length > 0 ? (
          <div className="space-y-3">
            {data.topPiiAccessors.map((accessor, index) => (
              <div key={accessor.userId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </div>
                  <span className="font-medium text-gray-900">{accessor.userId}</span>
                </div>
                <span className="text-sm font-semibold text-gray-600">{accessor.accessCount}건</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center py-8 text-gray-500">데이터 없음</p>
        )}
      </div>

      {/* 안내 메시지 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          💡 <strong>팁:</strong> 이 대시보드는 5분마다 자동으로 새로고침됩니다.
          자세한 감시 로그는 <a href="/admin/audit-logs" className="underline font-medium">감시 로그</a> 페이지에서 확인하세요.
        </p>
      </div>
    </div>
  );
}
