'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { VariantCard } from '@/components/campaigns/VariantCard';
import { VariantStats } from '@/components/campaigns/VariantStats';
import { logger } from '@/lib/logger';
import { useToast } from '@/lib/api/use-toast';
import type { CampaignDetail, Variant, VariantContent, StatsData } from '@/types/marketing';

const STATUS_LABEL: Record<CampaignDetail['status'], string> = {
  DRAFT: '임시저장',
  PENDING: '대기 중',
  SENDING: '발송 중',
  SENT: '발송 완료',
  FAILED: '실패',
  CANCELLED: '취소됨',
};

export default function VariantPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const { toast } = useToast();

  const mountedRef = useRef(true);
  const mutationCtrlRef = useRef<AbortController | null>(null);  // UI-VARIANTS-009: mutation 후 refetch 취소 가능

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('manage');

  // 의도적 경로 분리:
  // - 캠페인 상세: /api/marketing/campaigns/${campaignId} (마케팅 모듈)
  // - Variant CRUD + 통계: /api/campaigns/${campaignId}/variants (캠페인 공용 모듈)
  // 미래 리팩토링 시 /api/marketing/ 하위로 통합 고려
  const loadData = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);

      // Campaign 정보 조회
      const campaignRes = await fetch(`/api/marketing/campaigns/${campaignId}`, { signal });
      if (campaignRes.ok) {
        const campaignData = await campaignRes.json();
        if (mountedRef.current) setCampaign(campaignData.campaign);
      }

      // Variant 목록 조회
      const variantsRes = await fetch(`/api/campaigns/${campaignId}/variants`, { signal });
      if (variantsRes.ok) {
        const variantsData = await variantsRes.json();
        if (variantsData.ok) {
          if (mountedRef.current) setVariants(variantsData.variants);
        }
      }

      // 통계 조회
      const statsRes = await fetch(`/api/campaigns/${campaignId}/variants/stats`, { signal });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.ok) {
          if (mountedRef.current) setStats(statsData);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      logger.error('[loadData]', { error });
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      mutationCtrlRef.current?.abort();  // UI-VARIANTS-009: 언마운트 시 진행 중인 refetch 취소
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  const handleCreateVariant = async (variantKey: 'A' | 'B', content: VariantContent) => {
    try {
      setSaving(true);

      const res = await fetch(`/api/campaigns/${campaignId}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantKey, ...content }),
      });

      const data = await res.json();

      if (!data.ok) {
        toast({ title: 'Variant 생성 실패', description: data.error || '다시 시도해주세요.', variant: 'destructive' });
        return;
      }

      setVariants([...variants, data.variant]);
      toast({ title: `Variant ${variantKey} 생성 완료` });
      // UI-VARIANTS-009: AbortController로 refetch 취소 가능하게 변경
      if (mountedRef.current) {
        mutationCtrlRef.current?.abort();
        mutationCtrlRef.current = new AbortController();
        await loadData(mutationCtrlRef.current.signal);
      }
    } catch (error) {
      logger.error('[handleCreateVariant]', { error });
      toast({ title: '오류 발생', description: 'Variant 생성 중 문제가 발생했습니다.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateVariant = async (variantKey: 'A' | 'B', content: VariantContent) => {
    try {
      setSaving(true);

      const res = await fetch(`/api/campaigns/${campaignId}/variants/${variantKey}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content),
      });

      const data = await res.json();

      if (!data.ok) {
        toast({ title: 'Variant 수정 실패', description: data.error || '다시 시도해주세요.', variant: 'destructive' });
        return;
      }

      setVariants(variants.map(v => (v.variantKey === variantKey ? data.variant : v)));
      toast({ title: `Variant ${variantKey} 수정 완료` });
      if (mountedRef.current) {
        mutationCtrlRef.current?.abort();
        mutationCtrlRef.current = new AbortController();
        await loadData(mutationCtrlRef.current.signal);
      }
    } catch (error) {
      logger.error('[handleUpdateVariant]', { error });
      toast({ title: '오류 발생', description: 'Variant 수정 중 문제가 발생했습니다.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVariant = async (variantKey: 'A' | 'B') => {
    try {
      setSaving(true);

      const res = await fetch(`/api/campaigns/${campaignId}/variants/${variantKey}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!data.ok) {
        toast({ title: 'Variant 삭제 실패', description: data.error || '다시 시도해주세요.', variant: 'destructive' });
        return;
      }

      setVariants(variants.filter(v => v.variantKey !== variantKey));
      toast({ title: `Variant ${variantKey} 삭제 완료` });
      if (mountedRef.current) {
        mutationCtrlRef.current?.abort();
        mutationCtrlRef.current = new AbortController();
        await loadData(mutationCtrlRef.current.signal);
      }
    } catch (error) {
      logger.error('[handleDeleteVariant]', { error });
      toast({ title: '오류 발생', description: 'Variant 삭제 중 문제가 발생했습니다.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  const variantA = variants.find(v => v.variantKey === 'A');
  const variantB = variants.find(v => v.variantKey === 'B');

  return (
    <div className="space-y-6 p-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-3xl font-bold">🔬 A/B 테스트 관리</h1>
        <p className="text-gray-600 mt-2">
          {campaign?.title} — <span className="font-semibold">{campaign ? STATUS_LABEL[campaign.status] : ''}</span>
        </p>
      </div>

      {/* DRAFT 아님 경고 — API와 일치: DRAFT만 Variant 수정 가능 */}
      {campaign?.status !== 'DRAFT' && (
        <div className="border border-yellow-200 bg-yellow-50 text-yellow-800 p-4 rounded">
          발송 중이거나 완료된 캠페인입니다. Variant를 수정할 수 없습니다. 새 캠페인을 만들어주세요.
        </div>
      )}

      {/* 탭 */}
      <div className="space-y-4">
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('manage')}
            className={`px-4 py-2 border-b-2 transition ${activeTab === 'manage' ? 'border-blue-500 text-blue-600 font-semibold' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
          >
            ✏️ Variant 관리
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-2 border-b-2 transition ${activeTab === 'stats' ? 'border-blue-500 text-blue-600 font-semibold' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
          >
            📊 성과 분석
          </button>
        </div>

        {activeTab === 'manage' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <VariantCard
                variant="A"
                data={variantA}
                onSave={(content) => handleCreateVariant('A', content)}
                onUpdate={(content) => handleUpdateVariant('A', content)}
                onDelete={() => handleDeleteVariant('A')}
                isLoading={saving}
                isDraftOnly={campaign?.status === 'DRAFT'}
              />
              <VariantCard
                variant="B"
                data={variantB}
                onSave={(content) => handleCreateVariant('B', content)}
                onUpdate={(content) => handleUpdateVariant('B', content)}
                onDelete={() => handleDeleteVariant('B')}
                isLoading={saving}
                isDraftOnly={campaign?.status === 'DRAFT'}
              />
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-6">
            {stats ? (
              <VariantStats stats={stats} onRefresh={loadData} />
            ) : (
              <div className="border border-gray-200 bg-gray-50 text-gray-600 p-4 rounded">
                발송 이력이 없어서 통계를 표시할 수 없습니다.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
