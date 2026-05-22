'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CampaignRow } from '@/components/marketing/CampaignRow';
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
        if (d.ok) {
          setCsrfToken(d.token);
        } else {
          logger.warn('[CSRF token]', { message: d.message });
          // TODO (P3): toast 또는 사용자 알림 추가
        }
      })
      .catch((err) => {
        logger.error('[CSRF token fetch]', { err });
        // TODO (P3): 에러 토스트 추가 - "보안 토큰을 불러올 수 없습니다"
      });
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
    // TODO (P3): confirm() → Modal dialog 변경, alert() → Toast notification 변경
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
                <CampaignRow
                  key={campaign.id}
                  campaign={campaign}
                  isEven={idx % 2 === 0}
                  onDelete={handleDelete}
                  statusBadgeClassName={getStatusBadge(campaign.status)}
                />
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
