'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VariantCard } from '@/components/campaigns/VariantCard';
import { VariantStats } from '@/components/campaigns/VariantStats';
import { logger } from '@/lib/logger';

interface Variant {
  id: string;
  variantKey: 'A' | 'B';
  smsBody?: string;
  emailSubject?: string;
  emailBody?: string;
  trafficSplit: number;
  isActive: boolean;
  createdAt: string;
}

interface Campaign {
  id: string;
  title: string;
  status: 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'CANCELED';
}

interface StatsData {
  variants: Record<string, {
    sent: number;
    success: number;
    failure: number;
    successRate: number;
  }>;
  analysis: {
    chiSquare?: {
      chi2: number;
      pValue: number;
      isSignificant: boolean;
    };
    cramersV: number;
    recommendation?: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    interpretation: string;
  };
  metadata: {
    sampleSizeRecommendation?: string;
  };
}

export default function VariantPage() {
  const params = useParams();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('manage');

  useEffect(() => {
    loadData();
  }, [campaignId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Campaign 정보 조회
      const campaignRes = await fetch(`/api/marketing/campaigns/${campaignId}`);
      if (campaignRes.ok) {
        const campaignData = await campaignRes.json();
        setCampaign(campaignData.campaign);
      }

      // Variant 목록 조회
      const variantsRes = await fetch(`/api/campaigns/${campaignId}/variants`);
      if (variantsRes.ok) {
        const variantsData = await variantsRes.json();
        if (variantsData.ok) {
          setVariants(variantsData.variants);
        }
      }

      // 통계 조회
      const statsRes = await fetch(`/api/campaigns/${campaignId}/variants/stats`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.ok) {
          setStats(statsData);
        }
      }
    } catch (error) {
      logger.error('[loadData]', { error });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVariant = async (variantKey: 'A' | 'B', content: any) => {
    try {
      setSaving(true);

      const res = await fetch(`/api/campaigns/${campaignId}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantKey, ...content }),
      });

      const data = await res.json();

      if (!data.ok) {
        alert(data.error || 'Variant 생성 실패');
        return;
      }

      setVariants([...variants, data.variant]);
      alert(`Variant ${variantKey} 생성되었습니다.`);
      await loadData();
    } catch (error) {
      logger.error('[handleCreateVariant]', { error });
      alert('Variant 생성 중 오류 발생');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateVariant = async (variantKey: 'A' | 'B', content: any) => {
    try {
      setSaving(true);

      const res = await fetch(`/api/campaigns/${campaignId}/variants/${variantKey}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content),
      });

      const data = await res.json();

      if (!data.ok) {
        alert(data.error || 'Variant 수정 실패');
        return;
      }

      setVariants(variants.map(v => (v.variantKey === variantKey ? data.variant : v)));
      alert(`Variant ${variantKey} 수정되었습니다.`);
      await loadData();
    } catch (error) {
      logger.error('[handleUpdateVariant]', { error });
      alert('Variant 수정 중 오류 발생');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVariant = async (variantKey: 'A' | 'B') => {
    if (!confirm(`Variant ${variantKey}를 삭제하시겠어요?`)) {
      return;
    }

    try {
      setSaving(true);

      const res = await fetch(`/api/campaigns/${campaignId}/variants/${variantKey}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!data.ok) {
        alert(data.error || 'Variant 삭제 실패');
        return;
      }

      setVariants(variants.filter(v => v.variantKey !== variantKey));
      alert(`Variant ${variantKey} 삭제되었습니다.`);
      await loadData();
    } catch (error) {
      logger.error('[handleDeleteVariant]', { error });
      alert('Variant 삭제 중 오류 발생');
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
          {campaign?.title} — <span className="font-semibold">{campaign?.status}</span>
        </p>
      </div>

      {/* DRAFT 아님 경고 */}
      {campaign?.status !== 'DRAFT' && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertDescription className="text-yellow-800">
            발송 중이거나 완료된 캠페인입니다. Variant를 수정할 수 없습니다. 새 캠페인을 만들어주세요.
          </AlertDescription>
        </Alert>
      )}

      {/* 탭 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="manage">✏️ Variant 관리</TabsTrigger>
          <TabsTrigger value="stats">📊 성과 분석</TabsTrigger>
        </TabsList>

        <TabsContent value="manage" className="space-y-6">
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
        </TabsContent>

        <TabsContent value="stats" className="space-y-6">
          {stats ? (
            <VariantStats stats={stats} onRefresh={loadData} />
          ) : (
            <Alert>
              <AlertDescription>발송 이력이 없어서 통계를 표시할 수 없습니다.</AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
