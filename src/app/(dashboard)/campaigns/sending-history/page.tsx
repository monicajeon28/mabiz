'use client';

import { useEffect, useState } from 'react';
import { useAuthContext } from '@/lib/auth-context';
import { useToast } from '@/lib/api/use-toast';

interface SendingRecord {
  id: string;
  contact: {
    name: string;
    phone?: string;
    email?: string;
  };
  campaign: {
    title: string;
  };
  channel: string;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED' | 'RETRY_SCHEDULED' | 'ABANDONED';
  sentAt?: string;
  failureReason?: string;
  failureUserMsg?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
}

export default function SendingHistoryPage() {
  const { toast } = useToast();

  const [records, setRecords] = useState<SendingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'failed' | 'sent'>('all');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. 발송 이력 조회
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  async function fetchRecords() {
    try {
      setLoading(true);
      const statusParam = filter !== 'all' ? `&status=${filter.toUpperCase()}` : '';
      const response = await fetch(
        `/api/campaigns/sending-history?limit=100${statusParam}`
      );

      if (!response.ok) {
        throw new Error('발송 이력 조회 실패');
      }

      const data = await response.json();
      setRecords(data.histories || []);
    } catch (err) {
      toast({
        title: '오류',
        description: err instanceof Error ? err.message : '발송 이력 조회에 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRecords();
  }, [filter]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. 메시지 재전송
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  async function handleResend(recordId: string) {
    try {
      setResendingId(recordId);

      const response = await fetch(
        `/api/campaigns/sending-history/${recordId}/resend`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      );

      const data = await response.json();

      if (response.ok) {
        toast({
          title: '성공',
          description: data.message || '메시지가 성공적으로 전송되었습니다.',
          variant: 'success',
        });
        // 목록 새로 고침
        await fetchRecords();
      } else {
        toast({
          title: '오류',
          description: data.error || '재전송 실패',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: '오류',
        description: '네트워크 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setResendingId(null);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. 상태별 배지 색상
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
      default:
        return status;
    }
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. 마크업
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">발송 이력을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">발송 이력</h1>
          <p className="text-gray-600 mt-2">캠페인 메시지 발송 현황을 확인하고 실패한 메시지를 재전송할 수 있습니다.</p>
        </div>

        {/* 필터 */}
        <div className="mb-6 flex gap-3">
          {(['all', 'failed', 'sent'] as const).map((option) => (
            <button
              key={option}
              onClick={() => setFilter(option)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === option
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {option === 'all' ? '전체' : option === 'failed' ? '실패만' : '성공만'}
            </button>
          ))}
        </div>

        {/* 테이블 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {records.length === 0 ? (
            <div className="p-8 text-center text-gray-600">
              <p className="text-lg">발송 이력이 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">수신자</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">캠페인</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">채널</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">상태</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">실패 사유</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">재시도</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">조치</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {records.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                      {/* 수신자 */}
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{record.contact.name}</p>
                          <p className="text-sm text-gray-600">
                            {record.contact.phone || record.contact.email || 'N/A'}
                          </p>
                        </div>
                      </td>

                      {/* 캠페인 */}
                      <td className="px-6 py-4">
                        <p className="text-gray-900">{record.campaign.title}</p>
                      </td>

                      {/* 채널 */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                          {record.channel === 'SMS' ? '문자' : '이메일'}
                        </span>
                      </td>

                      {/* 상태 */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(record.status)}`}>
                          {getStatusLabel(record.status)}
                        </span>
                      </td>

                      {/* 실패 사유 */}
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600">
                          {record.failureUserMsg || (record.status === 'SENT' ? '-' : '알 수 없음')}
                        </p>
                      </td>

                      {/* 재시도 횟수 */}
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600">
                          {record.retryCount}/{record.maxRetries}
                        </p>
                      </td>

                      {/* 조치 */}
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleResend(record.id)}
                          disabled={resendingId === record.id || record.status === 'SENT'}
                          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                            record.status === 'SENT'
                              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                              : 'bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-400'
                          }`}
                        >
                          {resendingId === record.id ? '처리중...' : '🔄 재전송'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 통계 요약 */}
        {records.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <p className="text-gray-600 text-sm mb-2">전체</p>
              <p className="text-3xl font-bold text-gray-900">{records.length}</p>
            </div>
            <div className="bg-white rounded-lg p-6 border border-green-200 bg-green-50">
              <p className="text-gray-600 text-sm mb-2">성공</p>
              <p className="text-3xl font-bold text-green-600">
                {records.filter(r => r.status === 'SENT').length}
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 border border-red-200 bg-red-50">
              <p className="text-gray-600 text-sm mb-2">실패</p>
              <p className="text-3xl font-bold text-red-600">
                {records.filter(r => r.status === 'FAILED').length}
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 border border-yellow-200 bg-yellow-50">
              <p className="text-gray-600 text-sm mb-2">대기 중</p>
              <p className="text-3xl font-bold text-yellow-600">
                {records.filter(r => r.status === 'PENDING' || r.status === 'RETRY_SCHEDULED').length}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
