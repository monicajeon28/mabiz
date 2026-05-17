'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Clock, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

type SuspensionStatus = 'SUSPENDED' | 'APPEALING' | 'RESOLVED';

interface Suspension {
  id: string;
  organizationId: string;
  partnerName: string;
  partnerRole: string;
  suspensionStatus: SuspensionStatus;
  suspensionReason: string;
  reasonDetails: Record<string, any>;
  suspendedAt: string;
  appealedAt?: string;
  appealMessage?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
}

export default function PartnerSuspensionsPage() {
  const [suspensions, setSuspensions] = useState<Suspension[]>([]);
  const [filter, setFilter] = useState<SuspensionStatus>('SUSPENDED');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    fetchSuspensions();
  }, [filter]);

  const fetchSuspensions = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/partner-suspensions?status=${filter}&limit=100`
      );
      const data = await res.json();
      if (data.ok) {
        setSuspensions(data.data.suspensions);
      }
    } catch (err) {
      console.error('조회 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (orgId: string, action: 'UNSUSPEND' | 'DENY_APPEAL') => {
    setProcessing(true);
    try {
      const res = await fetch(
        `/api/admin/partner-suspensions/${orgId}/resolve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, notes: resolveNotes }),
        }
      );

      if (res.ok) {
        alert(action === 'UNSUSPEND' ? '정지가 해제되었습니다' : '이의가 거절되었습니다');
        setSelectedId(null);
        setResolveNotes('');
        fetchSuspensions();
      } else {
        alert('처리 실패');
      }
    } catch (err) {
      console.error('오류:', err);
      alert('오류가 발생했습니다');
    } finally {
      setProcessing(false);
    }
  };

  const getIcon = (status: SuspensionStatus) => {
    switch (status) {
      case 'SUSPENDED':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'APPEALING':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'RESOLVED':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
    }
  };

  const getStatusLabel = (status: SuspensionStatus) => {
    switch (status) {
      case 'SUSPENDED':
        return '정지 중';
      case 'APPEALING':
        return '이의 제기';
      case 'RESOLVED':
        return '해제됨';
    }
  };

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case 'HIGH_REFUND':
        return '높은 환불율';
      case 'NO_REVENUE':
        return '매출 부진';
      case 'MANUAL':
        return '수동 정지';
      default:
        return reason;
    }
  };

  const getReasonDetails = (reason: string, details: Record<string, any>) => {
    if (reason === 'HIGH_REFUND') {
      return `환불율: ${details?.refundRate?.toFixed(1) || '?'}%`;
    } else if (reason === 'NO_REVENUE') {
      return `${details?.monthsAffected?.length || 5}개월 연속 매출 부진`;
    }
    return '-';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">파트너 정지 관리</h1>
        <p className="text-gray-600 mt-2">정지된 파트너를 관리하고 이의 제기를 처리합니다.</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {(['SUSPENDED', 'APPEALING', 'RESOLVED'] as const).map((s) => (
          <button
            key={s}
            onClick={() => {
              setFilter(s);
              setExpandedRow(null);
            }}
            className={`px-4 py-3 font-semibold border-b-2 transition-colors ${
              filter === s
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {getStatusLabel(s)}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : suspensions.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-lg">정지된 파트너가 없습니다</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">파트너명</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">역할</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">정지 사유</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">상세</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">정지일</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {suspensions.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-semibold text-gray-900">{s.partnerName}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {s.partnerRole === 'MANAGER'
                        ? '매니저'
                        : s.partnerRole === 'SALESPERSON'
                          ? '판매원'
                          : '사전영업'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getIcon(s.suspensionStatus)}
                      <span className="text-sm font-medium text-gray-900">
                        {getReasonLabel(s.suspensionReason)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {getReasonDetails(s.suspensionReason, s.reasonDetails)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {format(new Date(s.suspendedAt), 'yyyy-MM-dd', { locale: ko })}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() =>
                        setExpandedRow(expandedRow === s.id ? null : s.id)
                      }
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${
                          expandedRow === s.id ? 'rotate-180' : ''
                        }`}
                      />
                      상세
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 확장된 상세 행 */}
          {expandedRow && suspensions.find((s) => s.id === expandedRow) && (
            <div className="border-t bg-gray-50 px-6 py-6">
              {(() => {
                const s = suspensions.find((s) => s.id === expandedRow)!;
                return (
                  <div className="space-y-6">
                    {/* 정지 정보 */}
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">정지 정보</h4>
                      <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-lg border border-gray-200">
                        <div>
                          <p className="text-xs text-gray-500 font-medium">정지 상태</p>
                          <p className="text-sm font-semibold text-gray-900 mt-1">
                            {getStatusLabel(s.suspensionStatus)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-medium">정지 사유</p>
                          <p className="text-sm font-semibold text-gray-900 mt-1">
                            {getReasonLabel(s.suspensionReason)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-medium">정지일</p>
                          <p className="text-sm font-semibold text-gray-900 mt-1">
                            {format(new Date(s.suspendedAt), 'yyyy-MM-dd HH:mm', {
                              locale: ko,
                            })}
                          </p>
                        </div>
                        {s.resolvedAt && (
                          <div>
                            <p className="text-xs text-gray-500 font-medium">해제일</p>
                            <p className="text-sm font-semibold text-green-600 mt-1">
                              {format(new Date(s.resolvedAt), 'yyyy-MM-dd HH:mm', {
                                locale: ko,
                              })}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 이의 제기 정보 */}
                    {s.suspensionStatus === 'APPEALING' && (
                      <div className="bg-white p-4 rounded-lg border border-yellow-200 bg-yellow-50">
                        <h4 className="font-semibold text-gray-900 mb-2">이의 제기</h4>
                        <div className="text-sm text-gray-700">
                          <p className="text-xs text-gray-500 font-medium mb-1">이의 제기일</p>
                          <p className="mb-3">
                            {s.appealedAt
                              ? format(new Date(s.appealedAt), 'yyyy-MM-dd HH:mm', {
                                  locale: ko,
                                })
                              : '-'}
                          </p>
                          <p className="text-xs text-gray-500 font-medium mb-1">내용</p>
                          <p className="whitespace-pre-wrap">{s.appealMessage || '-'}</p>
                        </div>
                      </div>
                    )}

                    {/* 처리 버튼 */}
                    {s.suspensionStatus !== 'RESOLVED' && (
                      <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <h4 className="font-semibold text-gray-900 mb-3">처리</h4>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              처리 노트 (선택)
                            </label>
                            <textarea
                              value={
                                selectedId === s.id ? resolveNotes : ''
                              }
                              onChange={(e) => {
                                setSelectedId(s.id);
                                setResolveNotes(e.target.value);
                              }}
                              placeholder="처리 사유를 입력하세요"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              rows={3}
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                handleResolve(
                                  s.organizationId,
                                  'UNSUSPEND'
                                )
                              }
                              disabled={processing || selectedId !== s.id}
                              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                              {processing ? '처리 중...' : '정지 해제'}
                            </button>
                            {s.suspensionStatus === 'APPEALING' && (
                              <button
                                onClick={() =>
                                  handleResolve(
                                    s.organizationId,
                                    'DENY_APPEAL'
                                  )
                                }
                                disabled={processing || selectedId !== s.id}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                              >
                                {processing ? '처리 중...' : '거절'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 처리 완료 정보 */}
                    {s.suspensionStatus === 'RESOLVED' && (
                      <div className="bg-white p-4 rounded-lg border border-green-200 bg-green-50">
                        <div className="flex items-start gap-2">
                          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-green-900">정지가 해제되었습니다</p>
                            {s.resolutionNotes && (
                              <p className="text-sm text-green-800 mt-2">{s.resolutionNotes}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
