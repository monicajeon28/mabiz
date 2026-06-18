'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';
import { useToast } from '@/lib/api/use-toast';
import type { CampaignDetail, CampaignStats, CampaignConversionRates } from '@/types/marketing';

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const { toast } = useToast();

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const campaignLoadedRef = useRef(false);  // UI-CAMPAIGNS-005: stale closure 없이 초기 로드 여부 추적
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [conversionRates, setConversionRates] = useState<CampaignConversionRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);  // UI-CAMPAIGNS-005: 폴링 실패는 별도 상태
  const retryCtrlRef = useRef<AbortController | null>(null);

  const fetchCampaignData = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/marketing/campaigns/${campaignId}/track`, { signal });
      if (!res.ok) throw new Error('데이터를 불러올 수 없습니다.');

      const data = await res.json();
      setCampaign(data.campaign);
      campaignLoadedRef.current = true;
      setStats(data.stats);
      setConversionRates(data.conversionRates);
      setPollError(null);  // 성공 시 이전 폴링 에러 클리어

      // 발송 중이면 자동으로 새로고침
      setRefreshInterval((prev) => {
        if (data.campaign.status === 'SENDING' && !prev) return 2000;
        if (data.campaign.status !== 'SENDING' && prev) return null;
        return prev;
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      logger.error('[fetchCampaignData]', { err });
      // UI-CAMPAIGNS-005: 초기 로드 실패는 fetchError, 폴링 실패는 pollError로 분리
      // campaignLoadedRef로 stale closure 없이 초기 로드 여부를 판단
      if (!campaignLoadedRef.current) {
        setFetchError('데이터를 불러올 수 없습니다.');
      } else {
        setPollError('데이터 갱신에 실패했습니다. 잠시 후 다시 시도됩니다.');
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    const controller = new AbortController();
    fetchCampaignData(controller.signal);
    return () => controller.abort();
  }, [fetchCampaignData]);

  // 자동 새로고침
  useEffect(() => {
    if (!refreshInterval) return;

    const controller = new AbortController();
    const timer = setInterval(() => fetchCampaignData(controller.signal), refreshInterval);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [refreshInterval, fetchCampaignData]);

  const handleSend = async () => {
    if (isSending) return;
    setIsSending(true);
    try {
      const res = await fetch(`/api/marketing/campaigns/${campaignId}/send`, {
        method: 'POST',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        toast({
          title: '발송 실패',
          description: (errData as { message?: string }).message ?? '다시 시도해주세요.',
          variant: 'destructive',
        });
        return;
      }

      toast({ title: '캠페인 발송이 시작되었습니다!' });
      // setRefreshInterval(2000) 설정 후 useEffect 폴링이 즉시 시작되므로 별도 fetchCampaignData() 호출 불필요
      // AbortSignal 없는 직접 호출은 언마운트 후 setState 경고를 유발하므로 제거
      setRefreshInterval(2000);
    } catch (err) {
      logger.error('[handleSend]', { err });
      toast({ title: '발송 실패', description: '네트워크 오류가 발생했습니다.', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (fetchError && !campaign) {
    return (
      <div className="text-center p-8">
        <p className="text-red-500 mb-4">{fetchError}</p>
        <Button
          onClick={() => {
            retryCtrlRef.current?.abort();
            retryCtrlRef.current = new AbortController();
            fetchCampaignData(retryCtrlRef.current.signal);
          }}
          variant="outline"
        >
          다시 시도
        </Button>
      </div>
    );
  }

  if (!campaign || !stats || !conversionRates) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-600">캠페인을 찾을 수 없습니다.</p>
      </div>
    );
  }

  const getStatusColor = (status: CampaignDetail['status']) => {
    const colors: Record<CampaignDetail['status'], string> = {
      DRAFT: 'text-gray-700 bg-gray-50',
      PENDING: 'text-yellow-700 bg-yellow-50',
      SENDING: 'text-blue-700 bg-blue-50',
      SENT: 'text-green-700 bg-green-50',
      FAILED: 'text-red-700 bg-red-50',
      CANCELLED: 'text-gray-500 bg-gray-50',
    };
    return colors[status] ?? colors.PENDING;
  };

  return (
    <div className="space-y-6">
      {/* UI-CAMPAIGNS-005: 폴링 실패 배너 — campaign이 있어도 표시 */}
      {pollError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-700 text-sm">
          ⚠️ {pollError}
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{campaign.title}</h1>
          <p className="text-gray-600 mt-2">
            생성일: {new Date(campaign.createdAt).toLocaleString('ko-KR')}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className={`px-3 py-1 rounded-lg font-medium ${getStatusColor(campaign.status)}`}>
            {campaign.status === 'DRAFT' && '임시저장'}
            {campaign.status === 'PENDING' && '대기 중'}
            {campaign.status === 'SENDING' && '발송 중'}
            {campaign.status === 'SENT' && '발송 완료'}
            {campaign.status === 'FAILED' && '실패'}
            {campaign.status === 'CANCELLED' && '취소됨'}
          </span>
          <Button
            variant="outline"
            onClick={() => router.push(`/marketing/campaigns/${campaignId}/variants`)}
          >
            🔬 A/B 테스트
          </Button>
          {['PENDING', 'DRAFT'].includes(campaign.status) && (
            <Button
              onClick={handleSend}
              disabled={isSending}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              {isSending ? '발송 중...' : '지금 발송'}
            </Button>
          )}
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* 발송 카드 */}
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <p className="text-sm text-blue-700 font-medium">발송</p>
          <p className="text-2xl font-bold text-blue-900">{stats.sent}</p>
          <p className="text-xs text-blue-600 mt-1">
            {stats.total > 0 ? `${((stats.sent / stats.total) * 100).toFixed(1)}%` : '0%'} of {stats.total}
          </p>
        </div>

        {/* 열람 카드 */}
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <p className="text-sm text-green-700 font-medium">열람</p>
          <p className="text-2xl font-bold text-green-900">{stats.opened}</p>
          <p className="text-xs text-green-600 mt-1">{conversionRates.openRate}%</p>
        </div>

        {/* 클릭 카드 */}
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <p className="text-sm text-purple-700 font-medium">클릭</p>
          <p className="text-2xl font-bold text-purple-900">{stats.clicked}</p>
          <p className="text-xs text-purple-600 mt-1">{conversionRates.clickRate}%</p>
        </div>

        {/* 신청 카드 */}
        <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
          <p className="text-sm text-orange-700 font-medium">신청</p>
          <p className="text-2xl font-bold text-orange-900">{stats.registered}</p>
          <p className="text-xs text-orange-600 mt-1">{conversionRates.registrationRate}%</p>
        </div>

        {/* 전체 카드 */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <p className="text-sm text-gray-700 font-medium">대상</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-600 mt-1">Total</p>
        </div>
      </div>

      {/* 퍼널 다이어그램 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-6">전환 퍼널</h2>

        <div className="space-y-4">
          {[
            { label: '발송', count: stats.sent, color: 'bg-blue-500' },
            { label: '열람', count: stats.opened, color: 'bg-green-500' },
            { label: '클릭', count: stats.clicked, color: 'bg-purple-500' },
            { label: '신청', count: stats.registered, color: 'bg-orange-500' },
          ].map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{item.label}</span>
                <span className="text-sm text-gray-600">{item.count}명</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-6 overflow-hidden">
                <div
                  className={`${item.color} h-full flex items-center justify-center text-white text-xs font-medium`}
                  style={{
                    width: stats.total > 0 ? `${Math.min(100, (item.count / stats.total) * 100)}%` : '0%',
                  }}
                >
                  {stats.total > 0 && `${((item.count / stats.total) * 100).toFixed(1)}%`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 실시간 갱신 알림 */}
      {campaign.status === 'SENDING' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-700">
          ⏱️ 실시간으로 데이터를 갱신하고 있습니다... (2초마다)
        </div>
      )}
    </div>
  );
}
