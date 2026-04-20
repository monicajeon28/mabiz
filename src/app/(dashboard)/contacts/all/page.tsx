"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Filter, Building2 } from "lucide-react";

type ContactAll = {
  id: string;
  name: string;
  phone: string;
  type: string;
  purchasedAt: string | null;
  updatedAt: string;
  tags: string[] | null;
  organizationId: string;
  organization: { name: string } | null;
};

type OrgOption = { id: string; name: string };

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  LEAD:         { label: "잠재",     color: "bg-blue-100 text-blue-700" },
  CUSTOMER:     { label: "구매완료", color: "bg-green-100 text-green-700" },
  UNSUBSCRIBED: { label: "수신거부", color: "bg-gray-100 text-gray-500" },
};

export default function ContactsAllPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  // /api/auth/me 로 역할 확인
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (!d.ok) { router.replace('/contacts'); return; }
        setRole(d.role);
        setAuthLoaded(true);
        if (d.role !== 'GLOBAL_ADMIN') router.replace('/contacts');
      })
      .catch(() => router.replace('/contacts'));
  }, [router]);

  const [contacts, setContacts] = useState<ContactAll[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [selectedOrg, setSelectedOrg] = useState('');

  // 조직 목록 로드
  useEffect(() => {
    fetch('/api/org/list')
      .then(r => r.json())
      .then(d => {
        if (d.ok) setOrgs(d.orgs ?? []);
      });
  }, []);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({
      page: String(page),
      limit: '30',
      ...(selectedOrg ? { orgId: selectedOrg } : {}),
      ...(q ? { q } : {}),
      ...(typeFilter ? { type: typeFilter } : {}),
    });
    try {
      const res = await fetch(`/api/contacts/all?${params}`);
      if (!res.ok) throw new Error('서버 오류');
      const data = await res.json() as { ok: boolean; contacts?: ContactAll[]; total?: number };
      if (!data.ok) throw new Error('데이터 로드 실패');
      setContacts(data.contacts ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError('고객 목록을 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }, [page, selectedOrg, q, typeFilter]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  // 동적 태그 목록
  const allTags = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach(c => (c.tags ?? []).forEach(t => set.add(t)));
    return Array.from(set).sort();
  }, [contacts]);

  // GLOBAL_ADMIN 인증 전에는 아무것도 렌더링하지 않음
  if (!authLoaded || role !== 'GLOBAL_ADMIN') {
    return null;
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-navy-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-gold-500" />
            전체 고객 관리 <span className="text-sm font-normal text-gray-400">(관리자)</span>
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">총 {total.toLocaleString()}명 · 전 조직 통합 뷰</p>
        </div>
      </div>

      {/* 검색 + 필터 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {/* 조직 필터 */}
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={selectedOrg}
            onChange={e => { setSelectedOrg(e.target.value); setPage(1); }}
            className="pl-9 pr-8 py-2 border border-gray-200 rounded-xl text-sm appearance-none bg-white focus:outline-none focus:border-gold-500"
          >
            <option value="">전체 조직</option>
            {orgs.map(o => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>

        {/* 검색 */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="이름, 전화번호 검색"
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gold-500"
          />
        </div>

        {/* 유형 필터 */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={typeFilter}
            onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
            className="pl-9 pr-8 py-2 border border-gray-200 rounded-xl text-sm appearance-none bg-white focus:outline-none focus:border-gold-500"
          >
            <option value="">전체 유형</option>
            <option value="LEAD">잠재고객</option>
            <option value="CUSTOMER">구매완료</option>
          </select>
        </div>
      </div>

      {/* 태그 칩 (읽기 전용 — 현재 페이지 데이터 기준) */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pb-3">
          {allTags.map(tag => (
            <span
              key={tag}
              className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="text-center py-12">
          <p className="text-red-500 text-sm mb-3">{error}</p>
          <button onClick={fetchContacts} className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm">
            다시 시도
          </button>
        </div>
      )}

      {/* 고객 목록 */}
      {!error && loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !error && contacts.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">👥</p>
          <p className="font-medium">고객이 없습니다</p>
          <p className="text-sm mt-1">검색 조건이나 조직 필터를 변경해보세요.</p>
        </div>
      ) : !error ? (
        <div className="space-y-2">
          {contacts.map(c => {
            const typeInfo = TYPE_LABELS[c.type] ?? { label: c.type, color: 'bg-gray-100 text-gray-600' };
            return (
              <div
                key={c.id}
                className="bg-white rounded-xl border border-gray-200 hover:border-gold-300 hover:shadow-sm transition-all px-4 py-3 flex items-center gap-3"
              >
                {/* 아바타 */}
                <div className="w-10 h-10 rounded-full bg-navy-900 text-white flex items-center justify-center text-sm font-bold shrink-0">
                  {c.name[0]}
                </div>

                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{c.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeInfo.color}`}>
                      {typeInfo.label}
                    </span>
                    {(c.tags ?? []).slice(0, 2).map(tag => (
                      <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5 flex items-center gap-3 flex-wrap">
                    <span>{c.phone}</span>
                    <span className="text-xs text-gray-400">
                      업데이트 {new Date(c.updatedAt).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                </div>

                {/* 조직명 */}
                <div className="shrink-0 text-right">
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-navy-50 text-navy-700 border border-navy-100 font-medium">
                    <Building2 className="w-3 h-3" />
                    {c.organization?.name ?? '미지정'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* 페이지네이션 */}
      {total > 30 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            이전
          </button>
          <span className="px-3 py-1.5 text-sm text-gray-600">
            {page} / {Math.ceil(total / 30)}
          </span>
          <button
            disabled={page >= Math.ceil(total / 30)}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
