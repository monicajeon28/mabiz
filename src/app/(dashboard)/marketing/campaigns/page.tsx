'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';
import type { Campaign } from '@/types/marketing';

export default function MarketingCampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState('');

  useEffect(() => {
    fetch('/api/csrf-token')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setCsrfToken(d.token);
      })
      .catch((err) => logger.error('[CSRF token fetch]', { err }));
  }, []);

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/marketing/campaigns');
      if (!res.ok) throw new Error('캠페인 목록을 불러올 수 없습니다.');

      const data = await res.json();
      if (!data.campaigns || !Array.isArray(data.campaigns)) {
        throw new Error('캠페인 데이터 형식이 잘못되었습니다.');
      }
      setCampaigns(data.campaigns);
    } catch (err) {
      logger.error('[MarketingCampaignsPage]', { err });
      setError(err instanceof Error ? err.message : '오류 발생');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleDelete = async (id: string) => {
    if (!confirm('이 캠페인을 삭제하시겠습니까?')) return;

    const previousCampaigns = campaigns;
    setCampaigns((prev) => prev.filter((c) => c.id !== id));

    try {
      const res = await fetch(`/api/marketing/campaigns/${id}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': csrfToken || '',
        },
      });
      if (!res.ok) throw new Error('삭제 실패');
    } catch (err) {
      logger.error('[handleDelete]', { err });
      setCampaigns(previousCampaigns);
      alert('삭제에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const STATUS_BADGE_STYLES = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    SENDING: 'bg-blue-100 text-blue-800',
    SENT: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-800',
  };

  const getStatusBadge = (status: string) =>
    STATUS_BADGE_STYLES[status as keyof typeof STATUS_BADGE_STYLES] || STATUS_BADGE_STYLES.PENDING;

  if (loading) {
    return (
      <div className="space-y-6">
        {/* 헤더 스켈레톤 */}
        <div className="flex items-center justify-between">
          <div className="h-8 w-40 bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-10 w-32 bg-gray-100 rounded-lg animate-pulse" />
        </div>

        {/* 테이블 행 스켈레톤 3개 */}
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">마케팅 캠페인</h1>
          <p className="text-gray-600 mt-1">그룹별 메시지 발송 + 완전 추적</p>
        </div>
        <Link href="/marketing/campaigns/new">
          <Button className="bg-blue-600 hover:bg-blue-700">+ 새 캠페인</Button>
        </Link>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* 캠페인 목록 */}
      {campaigns.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-600">생성된 캠페인이 없습니다.</p>
          <Link href="/marketing/campaigns/new" className="text-blue-600 hover:underline mt-2 inline-block">
            첫 캠페인을 만들어보세요
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">캠페인명</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">그룹</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">상태</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">통계</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">작업</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign, idx) => (
                <tr key={campaign.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-6 py-4">
                    <Link href={`/marketing/campaigns/${campaign.id}`} className="text-blue-600 hover:underline font-medium focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 rounded">
                      {campaign.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm">{campaign.group.name}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(campaign.status)}`}>
                      {campaign.status === 'PENDING' && '대기'}
                      {campaign.status === 'SENDING' && '발송 중'}
                      {campaign.status === 'SENT' && '발송 완료'}
                      {campaign.status === 'FAILED' && '실패'}
                      {campaign.status === 'CANCELLED' && '취소'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    발송 {campaign.sentCount}/{campaign.totalCount} • 열람 {campaign.openedCount} • 클릭 {campaign.clickedCount}
                  </td>
                  <td className="px-6 py-4 text-sm space-x-2">
                    <Link href={`/marketing/campaigns/${campaign.id}`}>
                      <Button variant="outline" size="sm">보기</Button>
                    </Link>
                    <button
                      onClick={() => handleDelete(campaign.id)}
                      className="text-red-600 hover:text-red-700 text-sm"
                      aria-label={`${campaign.title} 캠페인 삭제`}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* 페이지네이션 (P2-4) */}
          {campaigns.length > 10 && (
            <div className="px-6 py-4 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-400">페이지네이션 추가 예정</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
