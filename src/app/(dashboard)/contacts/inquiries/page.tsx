"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Plus, Phone, MessageSquare, CheckCircle, Clock, XCircle, Upload, X, FileSpreadsheet } from "lucide-react";

type Contact = {
  id: string;
  name: string;
  phone: string;
  type: string;
  cruiseInterest: string | null;
  lastContactedAt: string | null;
  leadScore: number;
  tags: string[] | null;
  groups: { group: { id: string; name: string; color: string | null } }[];
  _count: { callLogs: number };
};

const getLeadTier = (score: number) => {
  if (score >= 70) return { label: "🔥 HOT",  color: "bg-red-100 text-red-700" };
  if (score >= 30) return { label: "☀️ WARM", color: "bg-orange-100 text-orange-600" };
  if (score >= 0)  return { label: "❄️ COLD", color: "bg-blue-50 text-blue-500" };
  return               { label: "💤 LOST", color: "bg-gray-100 text-gray-400" };
};

type QuickCallResult = "INTERESTED" | "PENDING" | "REJECTED";

const QUICK_CALL_OPTIONS: { result: QuickCallResult; label: string; icon: React.ReactNode; color: string }[] = [
  { result: "INTERESTED", label: "관심", icon: <CheckCircle className="w-3.5 h-3.5" />, color: "bg-green-100 text-green-700 hover:bg-green-200" },
  { result: "PENDING",    label: "보류", icon: <Clock className="w-3.5 h-3.5" />,        color: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200" },
  { result: "REJECTED",   label: "거절", icon: <XCircle className="w-3.5 h-3.5" />,      color: "bg-red-100 text-red-700 hover:bg-red-200" },
];

function getDaysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
}

function formatDaysSince(dateStr: string | null): string {
  const days = getDaysSince(dateStr);
  if (days === null) return "처음 연락";
  const d = Math.floor(days);
  if (d === 0) return "오늘 연락";
  return `${d}일 전 연락`;
}

export default function InquiriesPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [groups, setGroups] = useState<{ id: string; name: string; funnelId: string | null }[]>([]);
  const [bulkGroupId, setBulkGroupId] = useState<string>("");
  const [assigning, setAssigning] = useState<string | null>(null);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [quickCallId, setQuickCallId] = useState<string | null>(null);

  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ successCount: number; skipCount: number; errors: string[] } | null>(null);
  const [quickCallLoading, setQuickCallLoading] = useState(false);
  const [quickCallError, setQuickCallError] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "30", type: "LEAD" });
    if (q) params.set("q", q);

    const res = await fetch(`/api/contacts?${params}`);
    const data = await res.json();
    if (data.ok) {
      setContacts(data.contacts);
      setTotal(data.total);
    }
    setLoading(false);
  }, [q, page]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  useEffect(() => {
    fetch("/api/groups").then(r => r.json()).then(d => { if (d.ok) setGroups(d.groups ?? []); });
  }, []);

  const runImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    const form = new FormData();
    form.append("file", importFile);
    const res  = await fetch("/api/contacts/import", { method: "POST", body: form });
    const data = await res.json();
    if (data.ok) {
      setImportResult({ successCount: data.successCount, skipCount: data.skipCount, errors: data.errors ?? [] });
      fetchContacts();
    }
    setImporting(false);
  };

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

  const handleQuickCall = async (contactId: string, result: QuickCallResult) => {
    setQuickCallLoading(true);
    setQuickCallError(null);
    const resultLabel = result === "INTERESTED" ? "관심" : result === "PENDING" ? "보류" : "거절";
    const convictionScore = result === "INTERESTED" ? "8" : result === "PENDING" ? "5" : "2";
    try {
      const res = await fetch(`/api/contacts/${contactId}/call-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `[퀵기록] ${resultLabel}`,
          result,
          convictionScore,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setQuickCallError("콜 기록 저장에 실패했습니다.");
      } else {
        setQuickCallId(null);
        fetchContacts();
      }
    } catch {
      setQuickCallError("네트워크 오류가 발생했습니다.");
    } finally {
      setQuickCallLoading(false);
    }
  };

  const allTags = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach(c => (c.tags ?? []).forEach(t => set.add(t)));
    return Array.from(set).sort();
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    if (selectedTags.length === 0) return contacts;
    return contacts.filter(c =>
      selectedTags.every(t => (c.tags ?? []).includes(t))
    );
  }, [contacts, selectedTags]);

  const todayCallList = contacts
    .filter((c) => {
      const days = getDaysSince(c.lastContactedAt);
      if (days === null) return true;
      return days >= 3;
    })
    .sort((a, b) => (b.leadScore ?? 0) - (a.leadScore ?? 0))
    .slice(0, 5);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">

      {/* 엑셀 가져오기 모달 */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-green-600" /> 엑셀 고객 가져오기
              </h3>
              <button onClick={() => setShowImport(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 space-y-1">
              <p className="font-semibold">📋 엑셀 파일 형식</p>
              <p>• 필수: <strong>이름</strong>, <strong>전화번호</strong></p>
              <p>• 선택: 이메일, 관심크루즈, 예산, 메모, 유형</p>
              <p>• 중복 전화번호는 정보 업데이트됩니다</p>
            </div>

            <label className="block">
              <div className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                importFile ? "border-green-400 bg-green-50" : "border-gray-200 hover:border-navy-300"
              }`}>
                <Upload className={`w-8 h-8 mx-auto mb-2 ${importFile ? "text-green-500" : "text-gray-400"}`} />
                {importFile
                  ? <p className="text-sm font-medium text-green-700">{importFile.name}</p>
                  : <p className="text-sm text-gray-400">파일을 클릭하거나 드래그하세요<br />.xlsx, .xls 지원</p>
                }
              </div>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => { setImportFile(e.target.files?.[0] ?? null); setImportResult(null); }}
              />
            </label>

            {importResult && (
              <div className={`rounded-xl p-3 text-sm ${
                importResult.skipCount === 0 ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-800"
              }`}>
                <p className="font-semibold mb-1">
                  ✅ {importResult.successCount}명 등록 완료
                  {importResult.skipCount > 0 && ` / ⚠️ ${importResult.skipCount}건 건너뜀`}
                </p>
                {importResult.errors.slice(0, 3).map((e, i) => (
                  <p key={i} className="text-xs opacity-80">{e}</p>
                ))}
              </div>
            )}

            <button
              onClick={runImport}
              disabled={importing || !importFile}
              className="w-full bg-green-600 text-white py-2.5 rounded-xl font-medium hover:bg-green-700 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {importing ? <><Upload className="w-4 h-4 animate-bounce" /> 가져오는 중...</> : "가져오기 실행"}
            </button>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-bold text-navy-900">전화상담 문의고객</h1>
          <p className="text-sm text-gray-500 mt-0.5">총 {total.toLocaleString()}명</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowImport(true); setImportResult(null); setImportFile(null); }}
            className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            <Upload className="w-4 h-4" /> 엑셀 가져오기
          </button>
          <Link
            href="/contacts/new"
            className="flex items-center gap-1.5 bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> 고객 추가
          </Link>
        </div>
      </div>

      {/* 안내 배너 */}
      <div className="mb-4 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
        결제 전 상담 중인 잠재 고객 목록입니다
      </div>

      {/* 검색 */}
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
      </div>

      {/* 태그 칩 필터 */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-0 pb-3">
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTags(prev =>
                prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
              )}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedTags.includes(tag)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              #{tag}
            </button>
          ))}
          {selectedTags.length > 0 && (
            <button
              onClick={() => setSelectedTags([])}
              className="px-2.5 py-1 rounded-full text-xs text-gray-400 hover:text-gray-600"
            >
              초기화
            </button>
          )}
        </div>
      )}

      {/* 오늘 콜할 사람 */}
      {todayCallList.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
          <p className="text-sm font-semibold text-amber-800 mb-2">
            📞 오늘 콜할 사람 ({todayCallList.length}명)
          </p>
          <div className="space-y-1.5">
            {todayCallList.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => router.push(`/contacts/${c.id}`)}
                className="w-full text-left flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-amber-100 hover:border-amber-300 hover:shadow-sm transition-all text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{c.name}</span>
                  {(c.leadScore ?? 0) >= 70 && (
                    <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold">🔥 HOT</span>
                  )}
                </div>
                <span className="text-gray-500 flex items-center gap-3">
                  <a
                    href={`tel:${c.phone}`}
                    className="text-blue-600 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {c.phone}
                  </a>
                  <span className="text-xs text-amber-600">{formatDaysSince(c.lastContactedAt)}</span>
                  <span className="text-xs text-gray-400">{c.leadScore ?? 0}점</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 미배정 일괄 배정 */}
      {groups.length > 0 && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <span className="text-sm text-amber-800 font-medium shrink-0">미배정 일괄 배정</span>
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
      ) : filteredContacts.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📞</p>
          <p className="font-medium">{selectedTags.length > 0 ? '해당 태그를 보유한 고객이 없습니다' : '문의 고객이 없습니다'}</p>
          <p className="text-sm mt-1">{selectedTags.length > 0 ? '다른 태그를 선택해보세요.' : '위 버튼으로 고객을 추가해보세요.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredContacts.map((c) => {
            const tierInfo = getLeadTier(c.leadScore ?? 0);
            const isQuickCallOpen = quickCallId === c.id;
            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 hover:border-gold-300 hover:shadow-sm transition-all">
                <Link
                  href={`/contacts/${c.id}`}
                  className="flex items-center gap-3 px-4 py-3 group"
                >
                  <div className="w-10 h-10 rounded-full bg-navy-900 text-white flex items-center justify-center text-sm font-bold shrink-0">
                    {c.name[0]}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{c.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${tierInfo.color}`}>
                        {tierInfo.label}
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
                      <span className="text-xs text-amber-600">{formatDaysSince(c.lastContactedAt)}</span>
                    </div>
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

                  <div className="hidden md:flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); window.location.href = `tel:${c.phone}`; }}
                      className="p-2 rounded-lg hover:bg-blue-50 text-blue-600"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setQuickCallId(isQuickCallOpen ? null : c.id);
                        setQuickCallError(null);
                      }}
                      className={`p-2 rounded-lg transition-colors ${isQuickCallOpen ? "bg-green-100 text-green-700" : "hover:bg-green-50 text-green-600"}`}
                      title="빠른 콜 기록"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </div>
                </Link>

                {isQuickCallOpen && (
                  <div className="px-4 pb-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <span className="text-xs text-gray-500 shrink-0">콜 결과:</span>
                    {QUICK_CALL_OPTIONS.map((opt) => (
                      <button
                        key={opt.result}
                        type="button"
                        disabled={quickCallLoading}
                        onClick={() => handleQuickCall(c.id, opt.result)}
                        className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${opt.color}`}
                      >
                        {opt.icon}
                        {opt.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => { setQuickCallId(null); setQuickCallError(null); }}
                      className="text-xs text-gray-400 hover:text-gray-600 ml-1"
                    >
                      취소
                    </button>
                    {quickCallLoading && <span className="text-xs text-gray-400">저장 중...</span>}
                    {quickCallError && <span className="text-xs text-red-500">{quickCallError}</span>}
                  </div>
                )}
              </div>
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
