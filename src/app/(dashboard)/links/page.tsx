"use client";
import { useState, useEffect } from "react";
import { Copy, Check, Link2, Plus, MousePointer, X, Users, Trash2, RotateCcw } from "lucide-react";
import { showError, showSuccess } from "@/components/ui/Toast";

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

// 어필리에이트 코드를 붙인 빠른 링크 목록 (code가 없으면 기본 URL 사용)
function buildQuickUrls(affiliateCode: string | null) {
  const ref = affiliateCode ? `?ref=${affiliateCode}` : '';
  return [
    { label: '🚢 크루즈닷 메인',  url: `https://www.cruisedot.co.kr/${ref}`,       desc: '크루즈닷 홈페이지' },
    { label: '⭐ 골드 멤버십',     url: `https://www.cruisedot.co.kr/gold${ref}`,   desc: '골드 멤버십 안내' },
  ];
}

export default function LinksPage() {
  const [links,         setLinks]         = useState<ShortLink[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [showForm,      setShowForm]      = useState(false);
  const [copied,        setCopied]        = useState<string | null>(null);
  const [title,         setTitle]         = useState('');
  const [targetUrl,     setTargetUrl]     = useState('');
  const [creating,      setCreating]      = useState(false);
  const [quickCreating, setQuickCreating] = useState(false);
  const [clickStats,    setClickStats]    = useState<Record<string, ClickStats>>({});
  const [loadingClicks, setLoadingClicks] = useState<string | null>(null);
  const [openClickId,   setOpenClickId]   = useState<string | null>(null);
  const [affiliateCode, setAffiliateCode] = useState<string | null>(null);

  // 삭제(휴지통)·복원
  const [showTrash, setShowTrash] = useState(false);
  const [trash,     setTrash]     = useState<ShortLink[]>([]);
  const [busyId,    setBusyId]    = useState<string | null>(null);
  const loadTrash = async () => {
    try {
      const res = await fetch('/api/links?deleted=1');
      const d = await res.json();
      if (d.ok) setTrash(d.links ?? []);
    } catch { /* 무시 */ }
  };
  const deleteLink = async (id: string) => {
    if (!confirm('이 링크를 삭제할까요?\n(휴지통에서 다시 복원할 수 있어요)')) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/links/${id}`, { method: 'DELETE' });
      const d = await res.json();
      if (d.ok) { setLinks(prev => prev.filter(l => l.id !== id)); showSuccess('삭제했습니다. 휴지통에서 복원할 수 있어요.'); }
      else showError(d.message ?? '삭제 실패');
    } catch { showError('삭제 실패'); } finally { setBusyId(null); }
  };
  const restoreLink = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/links/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'restore' }),
      });
      const d = await res.json();
      if (d.ok) { setTrash(prev => prev.filter(l => l.id !== id)); showSuccess('복원했습니다.'); load(); }
      else showError(d.message ?? '복원 실패');
    } catch { showError('복원 실패'); } finally { setBusyId(null); }
  };

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

    // 어필리에이트 코드 로드 (빠른 링크에 자동 붙이기용)
    fetch('/api/my/affiliate')
      .then(r => r.json())
      .then((d: { ok: boolean; affiliateCode?: string | null }) => {
        if (d.ok && d.affiliateCode) setAffiliateCode(d.affiliateCode);
      })
      .catch(() => {});

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
      const d = await res.json() as { ok: boolean; link?: { code?: string } };
      if (!d.ok) throw new Error();
      // 생성된 링크 자동 복사 + 알림
      const newCode = d.link?.code;
      if (newCode) {
        const newUrl = `${APP_URL}/l/${newCode}`;
        try {
          await navigator.clipboard.writeText(newUrl);
          showSuccess(`${newUrl} 링크가 복사되었어요`, '링크 생성 완료');
        } catch {
          showSuccess('링크가 생성되었어요', '링크 생성 완료');
        }
      } else {
        showSuccess('링크가 생성되었어요', '링크 생성 완료');
      }
      resetForm();
      load();
    } catch { showError('링크 생성 실패'); }
    finally { setCreating(false); }
  };

  // 원클릭: 랜덤 단축링크 즉시 만들기 (폼 없이 바로 생성 + 클립보드 복사)
  const quickCreate = async () => {
    if (quickCreating) return;
    setQuickCreating(true);
    try {
      const ref = affiliateCode ? `?ref=${affiliateCode}` : '';
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl: `https://www.cruisedot.co.kr/${ref}`,
          title: '상담 링크',
        }),
      });
      const d = await res.json() as { ok: boolean; link?: { code?: string } };
      if (!d.ok || !d.link?.code) throw new Error();
      const newUrl = `${APP_URL}/l/${d.link.code}`;
      try {
        await navigator.clipboard.writeText(newUrl);
        showSuccess(`${newUrl} 링크가 복사되었어요`, '링크 생성 완료');
      } catch {
        showSuccess('링크가 생성되었어요', '링크 생성 완료');
      }
      load();
    } catch {
      showError('링크 생성 실패');
    } finally {
      setQuickCreating(false);
    }
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
        <div className="flex items-center gap-2">
          <button onClick={quickCreate} disabled={quickCreating}
            className="flex items-center gap-2 px-5 min-h-[48px] bg-green-600 hover:bg-green-700 text-white rounded-lg text-base font-semibold disabled:opacity-50 transition-colors">
            <Link2 className="w-5 h-5" />
            {quickCreating ? '만드는 중...' : '바로 링크 만들기'}
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 min-h-[48px] border border-gray-300 text-gray-700 rounded-lg text-base font-medium hover:bg-gray-50 transition-colors">
            <Plus className="w-5 h-5" /> 직접 만들기
          </button>
        </div>
      </div>

      {/* 원클릭 안내 */}
      <div className="bg-green-50 border border-green-100 rounded-xl p-4 mb-4">
        <p className="text-base text-green-800">
          <strong>「바로 링크 만들기」</strong> 버튼을 누르면 <strong>내 추적링크가 즉시 만들어지고 자동 복사</strong>돼요. 그대로 고객에게 붙여넣기 하세요.
        </p>
      </div>

      {/* 빠른 생성 */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-1">
          <p className="text-base font-semibold text-blue-900">⚡ 빠른 링크 생성</p>
          {affiliateCode && (
            <span className="text-sm text-blue-700 bg-blue-100 px-3 py-1 rounded-full font-medium">
              내 코드: <strong>{affiliateCode}</strong>
            </span>
          )}
        </div>
        <p className="text-sm text-blue-600 mb-4">
          버튼을 누르면 <strong>내 어필리에이트 코드가 자동으로 붙은</strong> 링크가 만들어져요
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {buildQuickUrls(affiliateCode).map((q) => (
            <button
              key={q.label}
              onClick={() => { setTargetUrl(q.url); setTitle(q.label); setShowForm(true); }}
              className="flex items-center gap-3 px-4 py-3 bg-white border border-blue-200 rounded-xl text-left hover:border-blue-400 hover:bg-blue-50 transition-colors min-h-[56px]"
            >
              <span className="text-2xl">{q.label.split(' ')[0]}</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">{q.label.split(' ').slice(1).join(' ')}</p>
                <p className="text-xs text-gray-500">{q.desc}</p>
              </div>
            </button>
          ))}
        </div>
        {!affiliateCode && (
          <p className="text-xs text-gray-500 mt-3">※ 어필리에이트 코드가 없으면 기본 링크로 생성됩니다</p>
        )}
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

      {/* 휴지통 토글 */}
      {!loading && (
        <div className="mb-3 flex justify-end">
          <button
            onClick={() => { const next = !showTrash; setShowTrash(next); if (next) loadTrash(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${showTrash ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
          >
            <Trash2 className="w-4 h-4" /> {showTrash ? '휴지통 닫기' : '삭제한 링크 (휴지통)'}
          </button>
        </div>
      )}

      {/* 휴지통 — 삭제된 링크 복원 */}
      {showTrash && (
        <div className="mb-4 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-4">
          <p className="mb-3 text-sm font-bold text-gray-700">🗑 삭제한 링크 — 복원하려면 ↩ 버튼을 누르세요</p>
          {trash.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">삭제한 링크가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {trash.map(link => (
                <div key={link.id} className="flex items-center justify-between gap-3 rounded-lg bg-white border px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate text-gray-700">{link.title ?? link.targetUrl}</p>
                    <p className="text-sm text-gray-500 truncate">{APP_URL}/l/{link.code}</p>
                  </div>
                  <button onClick={() => restoreLink(link.id)} disabled={busyId === link.id}
                    className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    <RotateCcw className="w-4 h-4" /> 복원
                  </button>
                </div>
              ))}
            </div>
          )}
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
                    <button onClick={() => deleteLink(link.id)} disabled={busyId === link.id}
                      className="p-2 hover:bg-red-50 rounded-lg disabled:opacity-50" title="삭제 (휴지통으로)">
                      <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
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
                        {clickStats[link.id].groupStatus!.map(member => {
                          const personalUrl = `${APP_URL}/l/${link.code}?c=${member.id}`;
                          return (
                          <div key={member.id} className="flex items-center justify-between text-sm px-2 py-1 rounded hover:bg-gray-50 group">
                            <div className="flex items-center gap-2">
                              <span>{member.clicked ? '✅' : '⏳'}</span>
                              <span className="text-gray-700">{member.name}</span>
                              <span className="text-gray-400 text-xs">{member.phone}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {member.clickedAt && (
                                <span className="text-xs text-gray-400">
                                  {new Date(member.clickedAt).toLocaleDateString('ko-KR')}
                                </span>
                              )}
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(personalUrl);
                                  setCopied(member.id);
                                  setTimeout(() => setCopied(null), 2000);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-opacity"
                                title="개인화 URL 복사"
                              >
                                {copied === member.id
                                  ? <Check className="w-3 h-3 text-green-500" />
                                  : <Copy className="w-3 h-3 text-gray-400" />}
                              </button>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        각 고객 행에 마우스를 올리면 개인화 URL 복사 버튼이 나타납니다
                      </p>
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
