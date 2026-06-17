'use client';
import { useState, useEffect, useCallback } from 'react';
import { Search, ExternalLink, Copy } from 'lucide-react';
import { useSession } from '@/hooks/useSession';
import { useToast } from '@/lib/api/use-toast';

type CampaignLink = {
  id: number;
  code: string;
  campaignName: string | null;
  isActive: boolean;
  clickCount: number;
};

type OrgLinkItem = {
  orgId: string;
  orgName: string;
  affiliateCode: string | null;
  profileStatus: string | null;
  baseUrl: string | null;
  campaigns: CampaignLink[];
};

export default function AdminLinksPage() {
  const { role } = useSession();
  const { toast } = useToast();
  const [items, setItems] = useState<OrgLinkItem[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchLinks = useCallback(async () => {
    if (role !== 'GLOBAL_ADMIN') { setLoading(false); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (q) params.set('q', q);
      const res = await fetch(`/api/affiliate/links/all?${params}`);
      const data = await res.json();
      if (data.ok) { setItems(data.items ?? []); setTotal(data.total ?? 0); }
    } catch {
      toast({ title: '불러오기 실패', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [role, q, page, toast]);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  if (role !== 'GLOBAL_ADMIN') {
    return <div className='p-6 text-gray-500'>접근 권한이 없습니다.</div>;
  }

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: '링크 복사 완료', variant: 'success' });
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className='p-6 max-w-6xl mx-auto'>
      <div className='mb-6'>
        <h1 className='text-xl font-bold text-gray-900'>추천링크 관리</h1>
        <p className='text-sm text-gray-500 mt-1'>전체 대리점의 추천링크와 캠페인링크를 확인합니다</p>
      </div>
      <div className='relative mb-4'>
        <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
        <input
          type='text'
          placeholder='조직명 검색...'
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          className='pl-9 pr-4 py-3 w-full border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500'
        />
      </div>
      {loading ? (
        <div className='text-center py-12 text-gray-500'>불러오는 중...</div>
      ) : (
        <div className='space-y-4'>
          {items.map((item) => (
            <div key={item.orgId} className='bg-white border border-gray-200 rounded-xl p-5'>
              <div className='flex items-center justify-between mb-3'>
                <div>
                  <span className='font-semibold text-gray-900'>{item.orgName}</span>
                  {item.affiliateCode && (
                    <span className='ml-2 text-xs text-gray-500'>코드: {item.affiliateCode}</span>
                  )}
                </div>
                {item.profileStatus && (
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    item.profileStatus === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>{item.profileStatus}</span>
                )}
              </div>
              {item.baseUrl && (
                <div className='flex items-center gap-2 mb-3 bg-gray-50 rounded-lg p-3'>
                  <span className='text-sm text-gray-700 flex-1 truncate'>{item.baseUrl}</span>
                  <button
                    onClick={() => copyUrl(item.baseUrl!)}
                    className='p-1.5 text-gray-500 hover:text-blue-600 min-h-[44px] min-w-[44px] flex items-center justify-center'
                    aria-label='링크 복사'
                  >
                    <Copy className='w-4 h-4' />
                  </button>
                  <a
                    href={item.baseUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='p-1.5 text-gray-500 hover:text-blue-600 min-h-[44px] min-w-[44px] flex items-center justify-center'
                    aria-label='새 탭에서 열기'
                  >
                    <ExternalLink className='w-4 h-4' />
                  </a>
                </div>
              )}
              {item.campaigns.length > 0 && (
                <div>
                  <p className='text-xs text-gray-500 mb-2'>캠페인링크 {item.campaigns.length}개</p>
                  <div className='space-y-1'>
                    {item.campaigns.slice(0, 5).map((c) => (
                      <div key={c.id} className='flex items-center gap-2 text-sm'>
                        <span className='text-gray-700 flex-1 truncate'>
                          {c.campaignName ?? c.code}
                        </span>
                        <span className='text-xs text-gray-400'>클릭 {c.clickCount}회</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>{c.isActive ? '활성' : '중지'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!item.affiliateCode && (
                <p className='text-sm text-amber-600'>어필리에이트 프로필이 연결되지 않았습니다</p>
              )}
            </div>
          ))}
          {items.length === 0 && (
            <div className='text-center py-12 text-gray-400'>검색 결과가 없습니다</div>
          )}
        </div>
      )}
      {total > 20 && (
        <div className='flex justify-center gap-2 mt-6'>
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className='px-4 py-2 border rounded-lg text-sm disabled:opacity-40 min-h-[44px]'
          >
            이전
          </button>
          <span className='px-4 py-2 text-sm text-gray-500'>{page} / {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className='px-4 py-2 border rounded-lg text-sm disabled:opacity-40 min-h-[44px]'
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
