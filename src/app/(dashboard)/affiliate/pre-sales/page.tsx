'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { useRouter } from 'next/navigation';
import { Users, Search } from 'lucide-react';

interface PreSalesProfile {
  id: number;
  affiliateCode: string;
  displayName: string;
  name: string | null;
  status: string;
}

export default function PreSalesPage() {
  const { role } = useSession();
  const router = useRouter();
  const [profiles, setProfiles] = useState<PreSalesProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [total, setTotal] = useState(0);
  const [contactCounts, setContactCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (role === undefined) return;
    if (role !== 'GLOBAL_ADMIN') {
      router.push('/dashboard');
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ type: 'PRE_SALES', ...(q ? { q } : {}) });
        const res = await fetch(`/api/affiliate-issuance?${params}`);
        const json = await res.json();
        if (json.ok) {
          setProfiles(json.profiles ?? []);
          setTotal(json.total ?? 0);
        }
      } catch {
        // silent — 네트워크 오류 무시
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [role, q, router]);

  // 유입 고객 수 로딩 (관리자 전용 API)
  useEffect(() => {
    if (role !== 'GLOBAL_ADMIN') return;
    fetch('/api/affiliate/pre-sales/contacts')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.items) {
          const map: Record<string, number> = {};
          (d.items as Array<{ affiliateCode: string | null; contactCount: number }>).forEach((c) => {
            if (c.affiliateCode) map[c.affiliateCode] = c.contactCount;
          });
          setContactCounts(map);
        }
      })
      .catch(() => {});
  }, [role]);

  if (!role || role !== 'GLOBAL_ADMIN') return null;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">마케터 현황</h1>
          <p className="text-sm text-gray-500 mt-1">총 {total}명의 마케터 파트너</p>
        </div>
        <a
          href="/affiliate-issuance"
          className="bg-gray-900 text-white px-4 py-3 rounded-lg text-sm font-medium hover:bg-gray-700 min-h-[48px] flex items-center"
        >
          신규 발급
        </a>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="이름 또는 코드 검색"
          className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm min-h-[48px]"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">불러오는 중...</div>
      ) : profiles.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">마케터 파트너가 없습니다</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-sm font-medium text-gray-500 pb-3 pr-4">코드</th>
                <th className="text-left text-sm font-medium text-gray-500 pb-3 pr-4">표시 이름</th>
                <th className="text-left text-sm font-medium text-gray-500 pb-3 pr-4">실명</th>
                <th className="text-left text-sm font-medium text-gray-500 pb-3 pr-4">유입고객</th>
                <th className="text-left text-sm font-medium text-gray-500 pb-3">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {profiles.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="py-3 pr-4 text-sm font-mono text-blue-600">{p.affiliateCode}</td>
                  <td className="py-3 pr-4 text-sm text-gray-900">{p.displayName}</td>
                  <td className="py-3 pr-4 text-sm text-gray-500">{p.name ?? '-'}</td>
                  <td className="py-3 pr-4 text-sm text-gray-700">
                    {(contactCounts[p.affiliateCode] ?? 0).toLocaleString()}명
                  </td>
                  <td className="py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {p.status === 'ACTIVE' ? '활성' : '비활성'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
