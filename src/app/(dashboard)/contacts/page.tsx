"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search, Plus, Filter, Phone, MessageSquare } from "lucide-react";

type Contact = {
  id: string;
  name: string;
  phone: string;
  type: string;
  cruiseInterest: string | null;
  lastContactedAt: string | null;
  groups: { group: { id: string; name: string; color: string | null } }[];
  _count: { callLogs: number };
};

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  LEAD:         { label: "잠재", color: "bg-blue-100 text-blue-700" },
  CUSTOMER:     { label: "구매완료", color: "bg-green-100 text-green-700" },
  UNSUBSCRIBED: { label: "수신거부", color: "bg-gray-100 text-gray-500" },
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [groups, setGroups] = useState<{ id: string; name: string; funnelId: string | null }[]>([]);
  const [bulkGroupId, setBulkGroupId] = useState<string>("");
  const [assigning, setAssigning] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "30" });
    if (q) params.set("q", q);
    if (type) params.set("type", type);

    const res = await fetch(`/api/contacts?${params}`);
    const data = await res.json();
    if (data.ok) {
      setContacts(data.contacts);
      setTotal(data.total);
    }
    setLoading(false);
  }, [q, type, page]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  useEffect(() => {
    fetch("/api/groups").then(r => r.json()).then(d => { if (d.ok) setGroups(d.groups ?? []); });
  }, []);

  const quickAssign = async (contactId: string, groupId: string) => {
    if (!groupId) return;
    setAssigning(contactId);
    await fetch(`/api/groups/${groupId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId }),
    });
    setAssigning(null);
  };

  const bulkAssignUnassigned = async () => {
    if (!bulkGroupId) return;
    const unassigned = contacts.filter((c) => c.groups.length === 0);
    for (const c of unassigned) {
      await quickAssign(c.id, bulkGroupId);
    }
    fetchContacts();
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-navy-900">고객 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">총 {total.toLocaleString()}명</p>
        </div>
        <Link
          href="/contacts/new"
          className="flex items-center gap-1.5 bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> 고객 추가
        </Link>
      </div>

      {/* 검색 + 필터 */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="이름, 전화번호 검색"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={type}
            onChange={(e) => { setType(e.target.value); setPage(1); }}
            className="pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm appearance-none bg-white focus:outline-none focus:border-gold-500"
          >
            <option value="">전체</option>
            <option value="LEAD">잠재고객</option>
            <option value="CUSTOMER">구매완료</option>
          </select>
        </div>
      </div>

      {/* 미배정 고객 일괄 배정 */}
      {groups.length > 0 && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <span className="text-sm text-amber-800 font-medium shrink-0">
            미배정 일괄 배정
          </span>
          <select
            value={bulkGroupId}
            onChange={(e) => setBulkGroupId(e.target.value)}
            className="text-sm border border-amber-300 rounded-lg px-2 py-1.5 flex-1 max-w-[200px] bg-white focus:outline-none focus:border-amber-500"
          >
            <option value="">그룹 선택...</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name} {g.funnelId ? "🔄" : ""}</option>
            ))}
          </select>
          <button
            onClick={bulkAssignUnassigned}
            disabled={!bulkGroupId}
            className="text-sm px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-40 transition-colors shrink-0"
          >
            배정 ({contacts.filter((c) => c.groups.length === 0).length}명)
          </button>
        </div>
      )}

      {/* 고객 목록 */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">👥</p>
          <p className="font-medium">고객이 없습니다</p>
          <p className="text-sm mt-1">위 버튼으로 고객을 추가해보세요.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => {
            const typeInfo = TYPE_LABELS[c.type] ?? { label: c.type, color: "bg-gray-100 text-gray-600" };
            return (
              <Link
                key={c.id}
                href={`/contacts/${c.id}`}
                className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3 hover:border-gold-300 hover:shadow-sm transition-all group"
              >
                {/* 아바타 */}
                <div className="w-10 h-10 rounded-full bg-navy-900 text-white flex items-center justify-center text-sm font-bold shrink-0">
                  {c.name[0]}
                </div>

                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{c.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeInfo.color}`}>
                      {typeInfo.label}
                    </span>
                    {c.groups.slice(0, 2).map((g) => (
                      <span
                        key={g.group.id}
                        className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
                      >
                        {g.group.name}
                      </span>
                    ))}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5 flex items-center gap-3">
                    <span>{c.phone}</span>
                    {c.cruiseInterest && <span className="text-gold-500">{c.cruiseInterest}</span>}
                    {c._count.callLogs > 0 && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {c._count.callLogs}회
                      </span>
                    )}
                  </div>
                  {/* 빠른 그룹 배정 */}
                  {groups.length > 0 && (
                    <div className="flex items-center gap-1 mt-2" onClick={(e) => e.preventDefault()}>
                      <select
                        className="text-xs border border-gray-200 rounded px-1.5 py-1 flex-1 max-w-[180px] bg-white focus:outline-none"
                        defaultValue=""
                        onChange={(e) => {
                          e.stopPropagation();
                          if (e.target.value) quickAssign(c.id, e.target.value);
                          e.target.value = "";
                        }}
                      >
                        <option value="">그룹 배정...</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>{g.name} {g.funnelId ? "🔄" : ""}</option>
                        ))}
                      </select>
                      {assigning === c.id && <span className="text-xs text-gray-400">배정 중...</span>}
                    </div>
                  )}
                </div>

                {/* 빠른 액션 (PC hover) */}
                <div className="hidden md:flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.preventDefault(); window.location.href = `tel:${c.phone}`; }}
                    className="p-2 rounded-lg hover:bg-blue-50 text-blue-600"
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.preventDefault(); }}
                    className="p-2 rounded-lg hover:bg-green-50 text-green-600"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* 페이지네이션 */}
      {total > 30 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            이전
          </button>
          <span className="px-3 py-1.5 text-sm text-gray-600">
            {page} / {Math.ceil(total / 30)}
          </span>
          <button
            disabled={page >= Math.ceil(total / 30)}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
