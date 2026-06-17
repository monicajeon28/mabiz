'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from '@/hooks/useSession';
import { useToast } from '@/lib/api/use-toast';
import { Copy, Plus, DollarSign } from 'lucide-react';

type Tab = 'link' | 'campaigns' | 'contacts' | 'commission';

interface AffiliateLink {
  id: number;
  code: string;
  campaignName?: string;
  clicks: number;
  createdAt: string;
}

interface MyLinkData {
  affiliateCode: string;
  linkUrl: string;
  links: AffiliateLink[];
  monthlySales: number;
  totalCommission: number;
}

interface AffiliateContact {
  id: string;
  name: string;
  phone: string | null;
  type: string;
  createdAt: string;
}

interface SalesPageItem {
  id: string;
  title: string;
  revenue: number;
  conversionRate: number;
  salesCount: number;
}

interface MonthlySalesData {
  month: string;
  totalRevenue: number;
  conversionRate: number;
  avgOrderAmount: number;
  topProducts: Array<{ productName: string; salesCount: number }>;
  pages: SalesPageItem[];
}

export default function AffiliateApplyPage() {
  const { role } = useSession();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('link');
  const [data, setData] = useState<MyLinkData | null>(null);
  const [contacts, setContacts] = useState<AffiliateContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [campaignName, setCampaignName] = useState('');
  const [creating, setCreating] = useState(false);

  // 수당 내역 탭 상태
  const [salesData, setSalesData] = useState<MonthlySalesData | null>(null);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesMonth, setSalesMonth] = useState(new Date().toISOString().slice(0, 7));

  const fetchMyLink = useCallback(async () => {
    try {
      const res = await fetch('/api/affiliate/my-link');
      if (!res.ok) return;
      const json = await res.json();
      if (json.ok) setData(json.data);
    } catch {
      toast({ title: '링크 정보를 불러오지 못했습니다.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchContacts = useCallback(async () => {
    if (!data?.affiliateCode) return;
    try {
      const res = await fetch(`/api/affiliate/contacts?affiliateCode=${encodeURIComponent(data.affiliateCode)}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.ok) setContacts(json.contacts ?? []);
    } catch {
      toast({ title: '유입 고객을 불러오지 못했습니다.', variant: 'destructive' });
    }
  }, [data?.affiliateCode, toast]);

  const loadSales = useCallback(async () => {
    setSalesLoading(true);
    try {
      const res = await fetch(`/api/affiliate/my-sales?month=${salesMonth}`);
      const json = await res.json();
      if (json.ok) setSalesData(json.data ?? null);
    } catch {
      /* 무시 */
    } finally {
      setSalesLoading(false);
    }
  }, [salesMonth]);

  useEffect(() => { fetchMyLink(); }, [fetchMyLink]);

  useEffect(() => {
    if (activeTab === 'contacts') fetchContacts();
  }, [activeTab, fetchContacts]);

  useEffect(() => {
    if (activeTab === 'commission') loadSales();
  }, [activeTab, loadSales]);

  if (!role) return null;

  if (role === 'AGENT' || role === 'GLOBAL_ADMIN') {
    return (
      <div className="p-8 text-center text-gray-500 text-base">
        이 페이지에 접근할 권한이 없습니다.
      </div>
    );
  }

  const handleCreateCampaign = async () => {
    if (!campaignName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/affiliate/my-link/create-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignName: campaignName.trim() }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: '캠페인 링크가 생성되었습니다.' });
        setCampaignName('');
        fetchMyLink();
      } else {
        toast({ title: json.error || '생성에 실패했습니다.', variant: 'destructive' });
      }
    } catch {
      toast({ title: '네트워크 오류가 발생했습니다.', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} 복사됨` });
  };

  const tabClass = (tab: Tab) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[48px] ${
      activeTab === tab
        ? 'bg-gray-900 text-white'
        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
    }`;

  if (loading) {
    return <div className="p-8 text-center text-gray-400 text-base">불러오는 중...</div>;
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-gray-500 text-base">
        어필리에이트 프로필이 없습니다. 관리자에게 문의하세요.
      </div>
    );
  }

  const cruisedotBase =
    typeof window !== 'undefined'
      ? (process.env.NEXT_PUBLIC_CRUISEDOT_BASE_URL ?? 'https://cruisedot.co.kr')
      : 'https://cruisedot.co.kr';

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">내 어필리에이트</h1>
        <p className="text-base text-gray-500 mt-1">
          내 추천 링크와 유입 고객, 수당을 확인하세요.
        </p>
      </div>

      {/* 탭 */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        <button className={tabClass('link')} onClick={() => setActiveTab('link')}>
          내 링크
        </button>
        <button className={tabClass('campaigns')} onClick={() => setActiveTab('campaigns')}>
          캠페인 링크
        </button>
        <button className={tabClass('contacts')} onClick={() => setActiveTab('contacts')}>
          유입 고객
        </button>
        <button className={tabClass('commission')} onClick={() => setActiveTab('commission')}>
          수당 내역
        </button>
      </div>

      {/* 내 링크 탭 */}
      {activeTab === 'link' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <p className="text-sm text-gray-500 mb-2">내 기본 추천 링크</p>
            <div className="flex items-center gap-2">
              <p className="text-base font-mono text-gray-800 flex-1 truncate break-all">
                {data.linkUrl}
              </p>
              <button
                onClick={() => copyText(data.linkUrl, '링크')}
                className="flex items-center gap-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50 min-h-[48px] whitespace-nowrap"
              >
                <Copy className="w-4 h-4" /> 복사
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">추천 코드: {data.affiliateCode}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-500">이번달 판매</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {data.monthlySales.toLocaleString()}건
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-500">누적 수당</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                ₩{data.totalCommission.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 캠페인 링크 탭 */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCampaign(); }}
              placeholder="캠페인 이름 (예: 인스타그램 광고)"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-base min-h-[48px]"
            />
            <button
              onClick={handleCreateCampaign}
              disabled={creating || !campaignName.trim()}
              className="flex items-center gap-1 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-50 min-h-[48px]"
            >
              <Plus className="w-4 h-4" /> 생성
            </button>
          </div>

          {data.links.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">
              캠페인 링크가 없습니다. 위에서 생성해보세요.
            </p>
          ) : (
            <div className="space-y-2">
              {data.links.map((link) => (
                <div
                  key={link.id}
                  className="bg-white border border-gray-200 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {link.campaignName ?? link.code}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        클릭 {link.clicks.toLocaleString()}회
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        copyText(
                          `${cruisedotBase}/?ref=${link.code}`,
                          '캠페인 링크'
                        )
                      }
                      className="p-2 hover:bg-gray-100 rounded-lg min-h-[48px] min-w-[48px] flex items-center justify-center flex-shrink-0"
                    >
                      <Copy className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 유입 고객 탭 */}
      {activeTab === 'contacts' && (
        <div>
          {contacts.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">
              유입된 고객이 없습니다.
            </p>
          ) : (
            <div className="space-y-2">
              {contacts.map((c) => (
                <div
                  key={c.id}
                  className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">{c.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {c.phone ?? '-'} ·{' '}
                      {new Date(c.createdAt).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full whitespace-nowrap flex-shrink-0">
                    {c.type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 수당 내역 탭 */}
      {activeTab === 'commission' && (
        <div className="space-y-4">
          {/* 월 선택 */}
          <select
            value={salesMonth}
            onChange={(e) => setSalesMonth(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-[48px]"
          >
            {Array.from({ length: 12 }, (_, i) => {
              const d = new Date();
              d.setMonth(d.getMonth() - i);
              const val = d.toISOString().slice(0, 7);
              return (
                <option key={val} value={val}>
                  {val}
                </option>
              );
            })}
          </select>

          {salesLoading ? (
            <div className="text-center py-8 text-gray-400 text-sm">불러오는 중...</div>
          ) : !salesData ? (
            <div className="text-center py-8 text-gray-400">
              <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">수당 내역이 없습니다.</p>
            </div>
          ) : (
            <>
              {/* 월 요약 카드 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-sm text-gray-500">이달 총 매출</p>
                  <p className="text-xl font-bold text-green-700 mt-1">
                    ₩{salesData.totalRevenue.toLocaleString()}
                  </p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-sm text-gray-500">전환율</p>
                  <p className="text-xl font-bold text-blue-700 mt-1">
                    {salesData.conversionRate}%
                  </p>
                </div>
              </div>

              {/* 페이지별 수당 내역 테이블 */}
              {salesData.pages.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-6">
                  이 달에 판매 내역이 없습니다.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left text-gray-500 font-medium px-4 py-3">페이지</th>
                        <th className="text-right text-gray-500 font-medium px-4 py-3">판매건수</th>
                        <th className="text-right text-gray-500 font-medium px-4 py-3">매출</th>
                        <th className="text-right text-gray-500 font-medium px-4 py-3">전환율</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {salesData.pages.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-800 truncate max-w-[160px]">
                            {s.title}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">
                            {s.salesCount.toLocaleString()}건
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-green-600">
                            ₩{s.revenue.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-500">
                            {s.conversionRate}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="text-xs text-gray-400 text-right">
                평균 주문금액: ₩{salesData.avgOrderAmount.toLocaleString()}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
