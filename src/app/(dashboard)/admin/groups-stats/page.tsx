"use client";

import { useState, useEffect } from "react";
import { Users, BarChart2, RefreshCw } from "lucide-react";

type GroupStat = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  memberCount: number;
  orgId: string;
  orgName: string;
  ownerName: string;
  isShared: boolean;
  nameUsedBy: number;
  createdAt: string;
};

type TopName = { name: string; count: number };

export default function GroupsStatsPage() {
  const [groups,   setGroups]   = useState<GroupStat[]>([]);
  const [topNames, setTopNames] = useState<TopName[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [orgFilter, setOrgFilter] = useState("");
  const [orgs,     setOrgs]     = useState<{ id: string; name: string }[]>([]);

  const load = async (orgId?: string, signal?: AbortSignal) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: "200" });
      if (orgId) params.set("orgId", orgId);
      const [res, orgRes] = await Promise.all([
        fetch(`/api/admin/groups-stats?${params}`, { signal }).then(r => r.json()),
        orgs.length === 0 ? fetch("/api/admin/organizations?limit=100", { signal }).then(r => r.json()) : Promise.resolve(null),
      ]);
      if (res.ok) {
        setGroups(res.groups ?? []);
        setTopNames(res.topGroupNames ?? []);
        setTotal(res.total ?? 0);
      }
      if (orgRes?.ok && orgRes.organizations) {
        setOrgs(orgRes.organizations.map((o: { id: string; name: string }) => ({ id: o.id, name: o.name })));
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // 요청 중단, 에러 무시
      }
      console.error('Failed to load groups stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    if (isMounted) {
      load(undefined, controller.signal);
    }

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-navy-900 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-indigo-500" /> 그룹 현황
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">전체 {total.toLocaleString()}개 그룹 · 마케팅 참고용</p>
        </div>
        <button
          onClick={() => load(orgFilter || undefined)}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" /> 새로고침
        </button>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-4">
        <select
          value={orgFilter}
          onChange={e => { setOrgFilter(e.target.value); load(e.target.value || undefined); }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none"
        >
          <option value="">전체 조직</option>
          {orgs.map(o => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>

      {/* TOP 그룹명 인사이트 */}
      {topNames.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-5">
          <p className="text-sm font-semibold text-indigo-700 mb-2">많이 사용되는 그룹명 TOP 10</p>
          <div className="flex flex-wrap gap-2">
            {topNames.map(t => (
              <span key={t.name} className="px-2.5 py-1 bg-white border border-indigo-200 text-indigo-700 rounded-full text-sm font-medium">
                {t.name} <span className="text-indigo-400">·{t.count}곳</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 그룹 목록 테이블 */}
      {loading ? (
        <div className="space-y-2">
          {[0,1,2,3,4].map(i => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <p className="text-center text-sm text-gray-600 py-12">그룹이 없습니다.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-500">그룹명</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-500">조직</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-500">생성자</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-500">고객수</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-500">생성일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {groups.map(g => (
                <tr key={g.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: g.color ?? "#6B7280" }}
                      />
                      <span className="font-medium text-gray-800">{g.name}</span>
                      {g.isShared && (
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">공유</span>
                      )}
                      {g.nameUsedBy > 1 && (
                        <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">{g.nameUsedBy}곳</span>
                      )}
                    </div>
                    {g.description && (
                      <p className="text-sm text-gray-600 mt-0.5 ml-4">{g.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{g.orgName}</td>
                  <td className="px-4 py-3 text-gray-600">{g.ownerName}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="flex items-center justify-end gap-1 text-gray-700">
                      <Users className="w-3.5 h-3.5 text-gray-600" />
                      {g.memberCount.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 text-sm">
                    {new Date(g.createdAt).toLocaleDateString("ko-KR")}
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
