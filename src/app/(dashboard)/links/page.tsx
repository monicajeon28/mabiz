"use client";
import { useState, useEffect } from "react";
import { Copy, Check, Link2, Plus, MousePointer, X, Users } from "lucide-react";
import { showError } from "@/components/ui/Toast";

type ShortLink = {
  id: string; code: string; title: string | null;
  targetUrl: string; category: string | null;
  clickCount: number; createdAt: string;
  contactId: string | null;
  autoGroupId: string | null;
};

type GroupResult = { id: string; name: string; memberCount?: number };
type GroupMemberStatus = { id: string; name: string; phone: string; clicked: boolean; clickedAt: string | null };
type ClickLog = { id: string; contactId: string | null; clickedAt: string };
type ClickStats = {
  clickCount: number;
  clicks: ClickLog[];
  groupName?: string | null;
  groupStatus?: GroupMemberStatus[];
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

const QUICK_URLS = [
  { label: '🚢 크루즈닷 메인',   url: 'https://www.cruisedot.co.kr' },
  { label: '⭐ 골드 멤버십',      url: 'https://www.cruisedot.co.kr/gold' },
  { label: '🇯🇵 일본 크루즈',    url: 'https://www.cruisedot.co.kr/mall?cat=japan' },
  { label: '🇪🇺 지중해 크루즈',  url: 'https://www.cruisedot.co.kr/mall?cat=mediterranean' },
];

export default function LinksPage() {
  const [links,         setLinks]         = useState<ShortLink[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [showForm,      setShowForm]      = useState(false);
  const [copied,        setCopied]        = useState<string | null>(null);
  const [title,         setTitle]         = useState('');
  const [targetUrl,     setTargetUrl]     = useState('');
  const [creating,      setCreating]      = useState(false);
  const [clickStats,    setClickStats]    = useState<Record<string, ClickStats>>({});
  const [loadingClicks, setLoadingClicks] = useState<string | null>(null);
  const [openClickId,   setOpenClickId]   = useState<string | null>(null);

  // 그룹 연결
  const [linkToGroup,    setLinkToGroup]    = useState(false);
  const [groups,         setGroups]         = useState<GroupResult[]>([]);
  const [selectedGroup,  setSelectedGroup]  = useState<GroupResult | null>(null);
  const [groupsLoading,  setGroupsLoading]  = useState(false);

  const load = async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      const res = await fetch('/api/links', { signal });
      const d = await res.json();
      if (d.ok) setLinks(d.links ?? []);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // 요청 중단, 에러 무시
      }
      showError('링크 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    if (isMounted) {
      load(controller.signal);
    }

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  // 그룹 목록 로드
  useEffect(() => {
    if (!linkToGroup || groups.length > 0) return;
    setGroupsLoading(true);
    fetch('/api/groups?limit=100')
      .then(r => r.json())
      .then((d: { ok: boolean; groups?: GroupResult[] }) => {
        if (d.ok && d.groups) setGroups(d.groups);
      })
      .catch(() => {})
      .finally(() => setGroupsLoading(false));
  }, [linkToGroup, groups.length]);

  const resetForm = () => {
    setShowForm(false); setTitle(''); setTargetUrl('');
    setLinkToGroup(false); setSelectedGroup(null);
  };

  const create = async () => {
    if (!targetUrl.trim()) { showError('URL을 입력해주세요'); return; }
    if (linkToGroup && !selectedGroup) { showError('연결할 그룹을 선택해주세요'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl,
          title: title || null,
          autoGroupId: selectedGroup?.id ?? null,
        }),
      });
      const d = await res.json() as { ok: boolean };
      if (!d.ok) throw new Error();
      resetForm();
      load();
    } catch { showError('링크 생성 실패'); }
    finally { setCreating(false); }
  };

  const toggleClicks = async (linkId: string) => {
    if (openClickId === linkId) { setOpenClickId(null); return; }
    setOpenClickId(linkId);
    if (clickStats[linkId]) return;
    setLoadingClicks(linkId);
    try {
      const res = await fetch(`/api/links/${linkId}/clicks`);
      const d = await res.json() as { ok: boolean; clickCount?: number; clicks?: ClickLog[] };
      if (d.ok) setClickStats(prev => ({ ...prev, [linkId]: { clickCount: d.clickCount ?? 0, clicks: d.clicks ?? [] } }));
    } finally { setLoadingClicks(null); }
  };

  const copyUrl = (code: string) => {
    navigator.clipboard.writeText(`${APP_URL}/l/${code}`);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">🔗 상담 링크</h1>
          <p className="text-sm text-gray-500 mt-1">클릭 추적 + 고객별 개인 추적링크 + 자동 퍼널 연동</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> 새 링크
        </button>
      </div>

      {/* 빠른 생성 */}
      <div className="bg-gray-50 rounded-xl p-4 mb-6">
        <p className="text-sm font-medium text-gray-500 mb-3">빠른 링크 생성</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_URLS.map((q) => (
            <button key={q.url}
              onClick={() => { setTargetUrl(q.url); setTitle(q.label); setShowForm(true); }}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:border-blue-300">
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* 생성 폼 */}
      {showForm && (
        <div className="border rounded-xl p-4 mb-6 bg-white shadow-sm">
          <p className="text-sm font-semibold mb-3">새 숏링크 생성</p>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="제목 (예: 5월 지중해 특가)" className="w-full border rounded-lg px-3 py-2 text-sm mb-2" />
          <input value={targetUrl} onChange={e => setTargetUrl(e.target.value)}
            placeholder="연결할 URL (https://...)" className="w-full border rounded-lg px-3 py-2 text-sm mb-3" />

          {/* 그룹 연결 토글 */}
          <label className="flex items-center gap-2 text-sm mb-3 cursor-pointer select-none">
            <input type="checkbox" checked={linkToGroup}
              onChange={e => { setLinkToGroup(e.target.checked); setSelectedGroup(null); }}
              className="w-4 h-4 rounded" />
            <Users className="w-4 h-4 text-blue-500" />
            <span className="font-medium text-gray-700">그룹 연결 (그룹 클릭 추적)</span>
          </label>

          {linkToGroup && (
            <div className="mb-3">
              {groupsLoading ? (
                <p className="text-sm text-gray-500">그룹 로딩 중...</p>
              ) : selectedGroup ? (
                <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                  <span className="text-blue-700 font-medium">👥 {selectedGroup.name}</span>
                  <button onClick={() => setSelectedGroup(null)} className="text-blue-400 hover:text-blue-600">✕</button>
                </div>
              ) : (
                <select
                  onChange={e => {
                    const g = groups.find(g => g.id === e.target.value);
                    if (g) setSelectedGroup(g);
                  }}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  defaultValue=""
                >
                  <option value="" disabled>— 그룹 선택 —</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              )}
              {selectedGroup && (
                <p className="text-xs text-gray-500 mt-1">
                  SMS 발송 시 각 고객에게 개인화 링크를 자동 생성합니다
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={create} disabled={creating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {creating ? '생성 중...' : '생성'}
            </button>
            <button onClick={resetForm} className="px-4 py-2 border rounded-lg text-sm">취소</button>
          </div>
        </div>
      )}

      {/* 링크 목록 */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : links.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <Link2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>아직 생성된 링크가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {links.map(link => (
            <div key={link.id} className="border rounded-xl bg-white shadow-sm overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{link.title ?? link.targetUrl}</p>
                      {link.autoGroupId && (
                        <span className="shrink-0 px-1.5 py-0.5 bg-blue-100 text-blue-600 text-sm rounded-full flex items-center gap-1">
                          <Users className="w-3 h-3" /> 그룹링크
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-blue-600 mt-0.5">{APP_URL}/l/{link.code}</p>
                    <p className="text-sm text-gray-600 mt-0.5 truncate">{link.targetUrl}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleClicks(link.id)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium text-gray-600 transition-colors">
                      <MousePointer className="w-3 h-3" />
                      {clickStats[link.id]?.clickCount ?? link.clickCount ?? 0}회
                      {loadingClicks === link.id && ' ...'}
                    </button>
                    <button onClick={() => copyUrl(link.code)} className="p-2 hover:bg-gray-100 rounded-lg">
                      {copied === link.code ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-500" />}
                    </button>
                  </div>
                </div>
              </div>
              {openClickId === link.id && clickStats[link.id] && (
                <div className="bg-gray-50 border-t px-4 py-3">
                  {clickStats[link.id].groupStatus && clickStats[link.id].groupStatus!.length > 0 ? (
                    // 그룹 클릭 현황 테이블
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">
                        👥 {clickStats[link.id].groupName} 클릭 현황
                        ({clickStats[link.id].groupStatus!.filter(m => m.clicked).length}/{clickStats[link.id].groupStatus!.length}명 확인)
                      </p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {clickStats[link.id].groupStatus!.map(member => (
                          <div key={member.id} className="flex items-center justify-between text-sm px-2 py-1 rounded hover:bg-gray-50">
                            <div className="flex items-center gap-2">
                              <span>{member.clicked ? '✅' : '⏳'}</span>
                              <span className="text-gray-700">{member.name}</span>
                              <span className="text-gray-400 text-xs">{member.phone}</span>
                            </div>
                            {member.clickedAt && (
                              <span className="text-xs text-gray-400">
                                {new Date(member.clickedAt).toLocaleDateString('ko-KR')}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      {link.autoGroupId && (
                        <p className="text-xs text-gray-400 mt-2">
                          SMS 발송 시: <code className="bg-gray-100 px-1 rounded">/l/{link.code}?c={'{고객ID}'}</code> 형태로 발송하세요
                        </p>
                      )}
                    </div>
                  ) : (clickStats[link.id]?.clicks ?? []).length === 0 ? (
                    <p className="text-sm text-gray-600 text-center py-2">클릭 기록이 없습니다</p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {(clickStats[link.id]?.clicks ?? []).map(c => (
                        <div key={c.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">
                            {new Date(c.clickedAt).toLocaleDateString('ko-KR', {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                          <span className="text-gray-600">{c.contactId ? '등록 고객' : '비회원'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
