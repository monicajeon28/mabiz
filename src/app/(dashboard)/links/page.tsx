"use client";
import { useState, useEffect, useRef } from "react";
import { Copy, Check, Link2, Plus, MousePointer, User, X } from "lucide-react";
import { showError } from "@/components/ui/Toast";

type ShortLink = {
  id: string; code: string; title: string | null;
  targetUrl: string; category: string | null;
  clickCount: number; createdAt: string;
  contactId: string | null;
};

type ContactResult = { id: string; name: string; phone: string };
type ClickLog = { id: string; contactId: string | null; clickedAt: string };
type ClickStats = { clickCount: number; clicks: ClickLog[] };

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

  // 고객 연결
  const [linkToContact,     setLinkToContact]     = useState(false);
  const [contactSearch,     setContactSearch]     = useState('');
  const [contactResults,    setContactResults]    = useState<ContactResult[]>([]);
  const [selectedContact,   setSelectedContact]   = useState<ContactResult | null>(null);
  const [searchingContact,  setSearchingContact]  = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // 고객 검색 디바운스
  useEffect(() => {
    if (!linkToContact || contactSearch.length < 2) {
      setContactResults([]);
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearchingContact(true);
      try {
        const res = await fetch(`/api/contacts?q=${encodeURIComponent(contactSearch)}&limit=8`);
        const d = await res.json() as { ok: boolean; contacts?: ContactResult[] };
        if (d.ok) setContactResults(d.contacts ?? []);
      } finally {
        setSearchingContact(false);
      }
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [contactSearch, linkToContact]);

  const resetForm = () => {
    setShowForm(false); setTitle(''); setTargetUrl('');
    setLinkToContact(false); setContactSearch('');
    setContactResults([]); setSelectedContact(null);
  };

  const create = async () => {
    if (!targetUrl.trim()) { showError('URL을 입력해주세요'); return; }
    if (linkToContact && !selectedContact) { showError('연결할 고객을 선택해주세요'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl,
          title: title || null,
          contactId: selectedContact?.id ?? null,
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

          {/* 고객 연결 토글 */}
          <label className="flex items-center gap-2 text-sm mb-3 cursor-pointer select-none">
            <input type="checkbox" checked={linkToContact}
              onChange={e => { setLinkToContact(e.target.checked); setSelectedContact(null); setContactSearch(''); }}
              className="w-4 h-4 rounded" />
            <User className="w-4 h-4 text-blue-500" />
            <span className="font-medium text-gray-700">특정 고객에게 연결 (개인 추적링크)</span>
          </label>

          {linkToContact && (
            <div className="relative mb-3">
              {selectedContact ? (
                <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                  <span className="text-blue-700 font-medium">
                    {selectedContact.name} ({selectedContact.phone})
                  </span>
                  <button onClick={() => { setSelectedContact(null); setContactSearch(''); }}
                    className="text-blue-400 hover:text-blue-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <input value={contactSearch} onChange={e => setContactSearch(e.target.value)}
                    placeholder="고객 이름 또는 전화번호 검색..."
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                  {searchingContact && (
                    <p className="text-sm text-gray-600 mt-1 ml-1">검색 중...</p>
                  )}
                  {contactResults.length > 0 && (
                    <div className="absolute z-10 w-full bg-white border rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                      {contactResults.map(c => (
                        <button key={c.id} onClick={() => { setSelectedContact(c); setContactSearch(''); setContactResults([]); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                          <span className="font-medium">{c.name}</span>
                          <span className="text-gray-600 text-sm">{c.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              <p className="text-sm text-gray-600 mt-1">
                고객별 링크를 사용하면 문자 발송 시 누가 클릭했는지 추적됩니다.
              </p>
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
                      {link.contactId && (
                        <span className="shrink-0 px-1.5 py-0.5 bg-blue-100 text-blue-600 text-sm rounded-full flex items-center gap-1">
                          <User className="w-3 h-3" /> 개인링크
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
              {openClickId === link.id && (
                <div className="bg-gray-50 border-t px-4 py-3">
                  {(clickStats[link.id]?.clicks ?? []).length === 0 ? (
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
