"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Plus, Filter, Phone, MessageSquare, CheckCircle, Clock, XCircle, Upload, X, FileSpreadsheet, Loader2, Share2, FolderDown } from "lucide-react";
import { logger } from "@/lib/logger";

type Contact = {
  id: string;
  name: string;
  phone: string;
  type: string;
  cruiseInterest: string | null;
  lastContactedAt: string | null;
  departureDate: string | null;
  leadScore: number;
  tags: string[] | null;
  groups: { group: { id: string; name: string; color: string | null } }[];
  _count: { callLogs: number };
  lastTransferredTo: {
    name: string;
    orgName: string;
    logId: string;
    transferType: string;
    canRecall: boolean;
  } | null;
};

const getLeadTier = (score: number) => {
  if (score >= 70) return { label: "🔥 HOT",  color: "bg-red-100 text-red-700" };
  if (score >= 30) return { label: "☀️ WARM", color: "bg-orange-100 text-orange-600" };
  if (score >= 0)  return { label: "❄️ COLD", color: "bg-blue-50 text-blue-500" };
  return               { label: "💤 LOST", color: "bg-gray-100 text-gray-400" };
};

type QuickCallResult = "INTERESTED" | "PENDING" | "REJECTED";

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  // 신규 상태값
  "잠재고객":  { label: "잠재고객",  color: "bg-blue-100 text-blue-700" },
  "문자":      { label: "문자",      color: "bg-sky-100 text-sky-700" },
  "부재":      { label: "부재",      color: "bg-yellow-100 text-yellow-700" },
  "3일부재":   { label: "3일부재",   color: "bg-orange-100 text-orange-700" },
  "소통":      { label: "소통",      color: "bg-purple-100 text-purple-700" },
  "구매완료":  { label: "구매완료",  color: "bg-green-100 text-green-700" },
  "VIP":       { label: "VIP",       color: "bg-gold-100 text-gold-700 font-bold" },
  "수신거부":  { label: "수신거부",  color: "bg-gray-100 text-gray-500" },
  // 기존 영문 코드 (하위 호환)
  LEAD:         { label: "잠재고객",  color: "bg-blue-100 text-blue-700" },
  CUSTOMER:     { label: "구매완료",  color: "bg-green-100 text-green-700" },
  UNSUBSCRIBED: { label: "수신거부",  color: "bg-gray-100 text-gray-500" },
};

const QUICK_CALL_OPTIONS: { result: QuickCallResult; label: string; icon: React.ReactNode; color: string }[] = [
  { result: "INTERESTED", label: "관심", icon: <CheckCircle className="w-3.5 h-3.5" />, color: "bg-green-100 text-green-700 hover:bg-green-200" },
  { result: "PENDING",    label: "보류", icon: <Clock className="w-3.5 h-3.5" />,        color: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200" },
  { result: "REJECTED",   label: "거절", icon: <XCircle className="w-3.5 h-3.5" />,      color: "bg-red-100 text-red-700 hover:bg-red-200" },
];

function getDDay(departureDateStr: string | null): { label: string; urgent: boolean } | null {
  if (!departureDateStr) return null;
  const diff = Math.ceil((new Date(departureDateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff > 0) return { label: `D-${diff}`, urgent: diff <= 14 };
  if (diff === 0) return { label: "D-DAY", urgent: true };
  return { label: `D+${Math.abs(diff)}`, urgent: false };
}

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

export default function ContactsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [groups, setGroups] = useState<{ id: string; name: string; funnelId: string | null }[]>([]);
  const [bulkGroupId, setBulkGroupId] = useState<string>("");
  const [assigning, setAssigning] = useState<string | null>(null);

  // 태그 필터 상태
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagBlast, setShowTagBlast] = useState(false);

  // 전체 백업
  const [backingUp,     setBackingUp]     = useState(false);
  const [backupMsg,     setBackupMsg]     = useState("");
  const backupMsgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 백업 메시지 타이머 cleanup
  useEffect(() => {
    return () => {
      if (backupMsgTimerRef.current) clearTimeout(backupMsgTimerRef.current);
    };
  }, []);

  const handleOrgBackup = async () => {
    setBackingUp(true);
    setBackupMsg("");
    try {
      const res  = await fetch("/api/backup/org", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setBackupMsg(`✅ ${data.count}명 Drive 백업 완료`);
        if (backupMsgTimerRef.current) clearTimeout(backupMsgTimerRef.current);
        backupMsgTimerRef.current = setTimeout(() => setBackupMsg(""), 4000);
      } else {
        setBackupMsg("❌ 백업 실패");
      }
    } catch {
      setBackupMsg("❌ 네트워크 오류");
    } finally {
      setBackingUp(false);
    }
  };

  // 그룹 필터
  const [filterGroupId,  setFilterGroupId]  = useState("");
  const [showGroupBlast, setShowGroupBlast] = useState(false);

  // 담당자 할당
  type AssignStat = { userId: string; displayName: string; role: string; count: number };
  const [assignStats, setAssignStats] = useState<AssignStat[]>([]);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [filterAssignedTo, setFilterAssignedTo] = useState("");
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [bulkAssignTarget, setBulkAssignTarget] = useState("");
  const [bulkAssigning, setBulkAssigning] = useState(false);

  // 복수 선택 + 공유
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set());
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareSections,  setShareSections]  = useState<{ label: string; members: { id: string; displayName: string | null; loginId: string; orgName: string }[] }[]>([]);
  const [shareTarget,    setShareTarget]    = useState("");
  const [shareSearch,    setShareSearch]    = useState("");
  const [sharing,        setSharing]        = useState(false);
  const [shareResult,    setShareResult]    = useState("");

  // 그룹 추가 모달 (목록에서)
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupAddForContact, setGroupAddForContact] = useState<string | null>(null); // 배정할 contactId
  const [newGroupName, setNewGroupName] = useState("");
  const [groupAdding, setGroupAdding] = useState(false);
  const [groupAddError, setGroupAddError] = useState("");

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredContacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredContacts.map((c: { id: string }) => c.id)));
    }
  };

  const openShareModal = async () => {
    if (selectedIds.size === 0) return;
    setShareResult("");
    setShareTarget("");
    setShareSearch("");
    const res = await fetch("/api/org/agents").then(r => r.json());
    if (res.ok) setShareSections(res.sections ?? []);
    setShowShareModal(true);
  };

  const handleBulkShare = async () => {
    if (!shareTarget || selectedIds.size === 0) return;
    setSharing(true);
    const results = await Promise.allSettled(
      Array.from(selectedIds).map((contactId) =>
        fetch(`/api/contacts/${contactId}/send-db`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUserId: shareTarget }),
        }).then((r) => r.json())
      )
    );
    let ok = 0;
    let fail = 0;
    results.forEach((r) => {
      if (r.status === 'fulfilled' && r.value.ok) {
        ok++;
      } else {
        fail++;
        const reason = r.status === 'rejected' ? r.reason : r.value;
        logger.error('[bulkShare failed]', { reason });
      }
    });
    setSharing(false);
    setShareResult(`✅ ${ok}건 전달 완료${fail > 0 ? ` / ❌ ${fail}건 실패` : ""}`);
    setSelectedIds(new Set());
    fetchContacts();
    // [L6] setTimeout: cleanup 처리됨 (아래 useEffect 참고)
  };

  const handleAddGroup = async () => {
    const name = newGroupName.trim();
    if (!name) { setGroupAddError("그룹 이름을 입력해주세요."); return; }
    setGroupAdding(true);
    setGroupAddError("");
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!data.ok) { setGroupAddError(data.error ?? "그룹 생성 실패"); return; }
      const newGroup = { id: data.group.id, name: data.group.name, funnelId: data.group.funnelId ?? null };
      setGroups((prev) => [...prev, newGroup]);

      // 그룹 생성 즉시 해당 고객에게 배정
      if (groupAddForContact) {
        await fetch(`/api/groups/${newGroup.id}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactIds: [groupAddForContact] }),
        });
        setContacts(prev => prev.map(c =>
          c.id === groupAddForContact && !c.groups.some(g => g.group.id === newGroup.id)
            ? { ...c, groups: [...c.groups, { group: { id: newGroup.id, name: newGroup.name, color: null } }] }
            : c
        ));
      }

      setNewGroupName("");
      setGroupModalOpen(false);
      setGroupAddForContact(null);
    } catch {
      setGroupAddError("서버 오류가 발생했습니다.");
    } finally {
      setGroupAdding(false);
    }
  };

  // 회수 처리
  const [recalling, setRecalling] = useState<string | null>(null); // contactId

  const handleRecall = async (contactId: string, logId: string) => {
    if (!confirm("전달한 DB를 회수하시겠습니까? 상대방이 더 이상 해당 고객을 볼 수 없게 됩니다.")) return;
    setRecalling(contactId);
    try {
      const res = await fetch(`/api/contacts/${contactId}/recall-db`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId }),
      });
      const data = await res.json();
      if (data.ok) {
        setContacts(prev => prev.map(c =>
          c.id === contactId ? { ...c, lastTransferredTo: null } : c
        ));
      } else {
        alert(data.message ?? "회수에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setRecalling(null);
    }
  };

  // 퀵 콜 상태
  const [quickCallId,    setQuickCallId]    = useState<string | null>(null);

  // 엑셀 가져오기 (WO-27A)
  const [showImport,    setShowImport]    = useState(false);
  const [importFile,    setImportFile]    = useState<File | null>(null);
  const [importing,     setImporting]     = useState(false);
  const [importResult,  setImportResult]  = useState<{ successCount: number; skipCount: number; errors: string[] } | null>(null);
  const [quickCallLoading, setQuickCallLoading] = useState(false);
  const [quickCallError, setQuickCallError] = useState<string | null>(null);

  const fetchContacts = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "30" });
    if (q)                        params.set("q",          q);
    if (type)                     params.set("type",       type);
    if (filterGroupId)            params.set("groupId",    filterGroupId);
    if (filterAssignedTo)         params.set("assignedTo", filterAssignedTo);
    if (selectedTags.length > 0)  params.set("tags",       selectedTags.join(","));

    try {
      const res = await fetch(`/api/contacts?${params}`, { signal });
      const data = await res.json();
      if (data.ok) {
        setContacts(data.contacts);
        setTotal(data.total);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      logger.error("[fetchContacts failed]", { err });
    } finally {
      setLoading(false);
    }
  }, [q, type, page, filterGroupId, filterAssignedTo, selectedTags]);

  useEffect(() => {
    const controller = new AbortController();
    fetchContacts(controller.signal);
    return () => controller.abort();
  }, [fetchContacts]);
  useEffect(() => { setPage(1); }, [filterGroupId, filterAssignedTo, selectedTags]);

  // [L6] setTimeout cleanup (백업 메시지 자동 숨김)
  useEffect(() => {
    if (!backupMsg) return;
    const timer = setTimeout(() => setBackupMsg(""), 4000);
    return () => clearTimeout(timer);
  }, [backupMsg]);

  // 담당자 할당 통계와 그룹 로드 (의존성: 없음 - 마운트 시 1회만)
  // 그룹/담당자 정보는 자주 변경되지 않으므로, 필요시 수동으로 갱신

  // 할당 통계 + 그룹 목록 로드
  useEffect(() => {
    fetch("/api/groups").then(r => r.json()).then(d => { if (d.ok) setGroups(d.groups ?? []); });
    fetch("/api/contacts/assign-stats").then(r => r.json()).then(d => {
      if (d.ok) { setAssignStats(d.stats ?? []); setUnassignedCount(d.unassigned ?? 0); }
    }).catch(err => {
      logger.error('[assign-stats failed]', { err });
    });
  }, []);

  // [L6] setTimeout cleanup (공유 결과 메시지 자동 숨김)
  useEffect(() => {
    if (!shareResult) return;
    const timer = setTimeout(() => { setShowShareModal(false); setShareResult(""); }, 2000);
    return () => clearTimeout(timer);
  }, [shareResult]);

  const doBulkAssign = async () => {
    if (selectedIds.size === 0) return;
    setBulkAssigning(true);
    const res = await fetch("/api/contacts/bulk-assign", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactIds: Array.from(selectedIds), assignToUserId: bulkAssignTarget || null }),
    });
    const data = await res.json();
    setBulkAssigning(false);
    if (data.ok) {
      setShowBulkAssign(false);
      setSelectedIds(new Set());
      fetchContacts();
      // 통계 갱신
      fetch("/api/contacts/assign-stats").then(r => r.json()).then(d => {
        if (d.ok) { setAssignStats(d.stats); setUnassignedCount(d.unassigned); }
      });
    } else { alert(data.message ?? "할당 실패"); }
  };

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

    // 기존 그룹 제거 후 새 그룹 배정 (그룹은 1개만) — 병렬 처리
    const contact = contacts.find(c => c.id === contactId);
    if (contact && contact.groups.length > 0) {
      await Promise.all(
        contact.groups.map((g) =>
          fetch(`/api/groups/${g.group.id}/members`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contactIds: [contactId] }),
          })
        )
      );
    }

    await fetch(`/api/groups/${groupId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactIds: [contactId] }),
    });

    // 로컬 상태 업데이트 (새 그룹만 표시)
    const grp = groups.find(g => g.id === groupId);
    if (grp) {
      setContacts(prev => prev.map(c =>
        c.id === contactId
          ? { ...c, groups: [{ group: { id: grp.id, name: grp.name, color: null } }] }
          : c
      ));
    }
    setAssigning(null);
  };

  const bulkAssignUnassigned = async () => {
    if (!bulkGroupId) return;
    const unassigned = contacts.filter((c) => c.groups.length === 0);
    if (unassigned.length === 0) return;
    // 단일 배치 API 호출 (그룹 없는 고객이므로 기존 그룹 제거 불필요)
    await fetch(`/api/groups/${bulkGroupId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactIds: unassigned.map((c) => c.id) }),
    });
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

  // 동적 태그 목록 수집
  const allTags = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach(c => (c.tags ?? []).forEach(t => set.add(t)));
    return Array.from(set).sort();
  }, [contacts]);

  // 태그 필터는 DB 레벨에서 처리 (fetchContacts의 tags 파라미터로 전달)
  const filteredContacts = contacts;

  // 오늘 콜할 사람: LEAD + (연락 없음 OR 3일 이상 연락 없음) → 리드 스코어 높은 순
  const todayCallList = contacts
    .filter((c) => {
      if (c.type !== "LEAD") return false;
      const days = getDaysSince(c.lastContactedAt);
      if (days === null) return true;
      return days >= 3;
    })
    .sort((a, b) => (b.leadScore ?? 0) - (a.leadScore ?? 0))  // HOT 먼저
    .slice(0, 5);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">

      {/* 그룹 추가 모달 */}
      {groupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setGroupModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">새 그룹 추가</h3>
              <button onClick={() => setGroupModalOpen(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                autoFocus
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddGroup(); } }}
                placeholder="그룹 이름 입력"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-900/20"
              />
              {groupAddError && <p className="text-xs text-red-500">{groupAddError}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setGroupModalOpen(false)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
                >취소</button>
                <button
                  onClick={handleAddGroup}
                  disabled={groupAdding}
                  className="flex-1 py-2.5 bg-navy-900 text-white text-sm rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {groupAdding && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  그룹 추가
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

            {/* 형식 안내 + 샘플 다운로드 */}
            <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 space-y-1">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold">📋 엑셀 파일 형식</p>
                <a
                  href="/api/contacts/sample"
                  download="cruisedot_import_sample.xlsx"
                  className="flex items-center gap-1 text-green-700 font-semibold bg-green-100 hover:bg-green-200 px-2 py-1 rounded-lg text-xs transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> 샘플 다운로드
                </a>
              </div>
              <p>• 필수: <strong>이름</strong>, <strong>전화번호</strong></p>
              <p>• 선택: 이메일, 관심크루즈, 예산, 메모, 유형</p>
              <p>• 유형: "잠재고객" 또는 "구매완료" (기본: 잠재고객)</p>
              <p>• 중복 전화번호는 정보 업데이트됩니다</p>
            </div>

            {/* 파일 선택 */}
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

            {/* 결과 */}
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
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-navy-900">고객 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">총 {total.toLocaleString()}명</p>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={openShareModal}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              공유 ({selectedIds.size}명)
            </button>
          )}
          {selectedTags.length > 0 && (
            <button
              onClick={() => setShowTagBlast(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              태그 SMS ({filteredContacts.length}명)
            </button>
          )}
          {filterGroupId && (
            <button
              onClick={() => setShowGroupBlast(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              그룹 SMS ({total}명)
            </button>
          )}
          <button
            onClick={handleOrgBackup}
            disabled={backingUp}
            className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            title="고객 전체를 Drive에 Excel 백업"
          >
            {backingUp
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <FolderDown className="w-4 h-4" />
            }
            전체 백업
          </button>
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

      {/* 백업 결과 토스트 */}
      {backupMsg && (
        <div className={`mb-3 px-4 py-2.5 rounded-xl text-sm font-medium ${backupMsg.startsWith("✅") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
          {backupMsg}
        </div>
      )}

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
            <option value="잠재고객">잠재고객</option>
            <option value="문자">문자</option>
            <option value="부재">부재</option>
            <option value="3일부재">3일부재</option>
            <option value="소통">소통</option>
            <option value="구매완료">구매완료</option>
            <option value="VIP">VIP</option>
            <option value="수신거부">수신거부</option>
          </select>
        </div>
        {/* 그룹 필터 드롭다운 */}
        {groups.length > 0 && (
          <div className="relative">
            <select
              value={filterGroupId}
              onChange={(e) => setFilterGroupId(e.target.value)}
              className={`pl-3 pr-8 py-2 border rounded-lg text-sm appearance-none bg-white focus:outline-none ${filterGroupId ? "border-green-400 text-green-700 font-medium" : "border-gray-200 focus:border-gold-500"}`}
            >
              <option value="">그룹 전체</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        )}
        {/* 담당자 필터 */}
        {assignStats.length > 0 && (
          <div className="relative">
            <select
              value={filterAssignedTo}
              onChange={(e) => setFilterAssignedTo(e.target.value)}
              className={`pl-3 pr-8 py-2 border rounded-lg text-sm appearance-none bg-white focus:outline-none ${filterAssignedTo ? "border-purple-400 text-purple-700 font-medium" : "border-gray-200 focus:border-gold-500"}`}
            >
              <option value="">담당자 전체</option>
              <option value="unassigned">미배정 ({unassignedCount})</option>
              {assignStats.map((s) => (
                <option key={s.userId} value={s.userId}>{s.displayName} ({s.count})</option>
              ))}
            </select>
          </div>
        )}
        {/* 일괄 할당 버튼 */}
        {selectedIds.size > 0 && assignStats.length > 0 && (
          <button onClick={() => setShowBulkAssign(true)}
            className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
            선택 {selectedIds.size}명 담당자 할당
          </button>
        )}
      </div>

      {/* 담당자별 통계 바 */}
      {assignStats.length > 0 && (
        <div className="flex gap-2 flex-wrap px-0 pb-2">
          {assignStats.filter(s => s.count > 0).map((s) => (
            <button key={s.userId} onClick={() => setFilterAssignedTo(s.userId === filterAssignedTo ? "" : s.userId)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${filterAssignedTo === s.userId ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-purple-100"}`}>
              {s.displayName} <span className="font-bold">{s.count}</span>
            </button>
          ))}
          {unassignedCount > 0 && (
            <button onClick={() => setFilterAssignedTo(filterAssignedTo === "unassigned" ? "" : "unassigned")}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${filterAssignedTo === "unassigned" ? "bg-red-600 text-white" : "bg-red-50 text-red-600 hover:bg-red-100"}`}>
              미배정 <span className="font-bold">{unassignedCount}</span>
            </button>
          )}
        </div>
      )}

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
      ) : filteredContacts.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">👥</p>
          <p className="font-medium">{selectedTags.length > 0 ? '해당 태그를 보유한 고객이 없습니다' : '고객이 없습니다'}</p>
          <p className="text-sm mt-1">{selectedTags.length > 0 ? '다른 태그를 선택해보세요.' : '위 버튼으로 고객을 추가해보세요.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* 전체선택 행 */}
          {filteredContacts.length > 0 && (
            <div className="flex items-center gap-2 px-2 pb-1">
              <input
                type="checkbox"
                checked={selectedIds.size === filteredContacts.length && filteredContacts.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded cursor-pointer accent-purple-600"
              />
              <span className="text-xs text-gray-400">
                {selectedIds.size > 0 ? `${selectedIds.size}명 선택됨` : "전체 선택"}
              </span>
            </div>
          )}
          {filteredContacts.map((c) => {
            const typeInfo = TYPE_LABELS[c.type] ?? { label: c.type, color: "bg-gray-100 text-gray-600" };
            const tierInfo = getLeadTier(c.leadScore ?? 0);
            const isQuickCallOpen = quickCallId === c.id;
            const isSelected = selectedIds.has(c.id);
            return (
              <div key={c.id} className={`bg-white rounded-xl border transition-all ${isSelected ? "border-purple-400 shadow-sm" : "border-gray-200 hover:border-gold-300 hover:shadow-sm"}`}>
                <div className="flex items-center gap-3 px-4 py-3 group">
                  {/* 체크박스 */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(c.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded cursor-pointer accent-purple-600 shrink-0"
                  />
                <Link
                  href={`/contacts/${c.id}`}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  {/* 아바타 */}
                  <div className="w-10 h-10 rounded-full bg-navy-900 text-white flex items-center justify-center text-sm font-bold shrink-0">
                    {c.name[0]}
                  </div>

                  {/* 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{c.name}</span>
                      {/* 리드 스코어 뱃지 — HOT만 강조, WARM/COLD는 서브로 */}
                      {c.type === "LEAD" && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${tierInfo.color}`}>
                          {tierInfo.label}
                        </span>
                      )}
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
                    <div className="text-sm text-gray-500 mt-0.5 flex items-center gap-3 flex-wrap">
                      <span>{c.phone}</span>
                      {c.cruiseInterest && <span className="text-gold-500">{c.cruiseInterest}</span>}
                      {c._count.callLogs > 0 && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {c._count.callLogs}회
                        </span>
                      )}
                      {/* D-day 뱃지 */}
                      {(() => {
                        const dday = getDDay(c.departureDate);
                        if (!dday) return null;
                        return (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${dday.urgent ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                            ✈️ {dday.label}
                          </span>
                        );
                      })()}
                    </div>
                    {/* 태그 칩 */}
                    {(c.tags ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {(c.tags ?? []).slice(0, 5).map((tag) => (
                          <span key={tag} className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">#{tag}</span>
                        ))}
                        {(c.tags ?? []).length > 5 && (
                          <span className="text-xs text-gray-400">+{(c.tags ?? []).length - 5}</span>
                        )}
                      </div>
                    )}
                    {/* 빠른 그룹 배정 */}
                    <div className="flex items-center gap-2 mt-2" onClick={(e) => e.preventDefault()}>
                      {groups.length > 0 && (
                        <select
                          className="text-xs border border-gray-200 rounded px-1.5 py-1 max-w-[180px] bg-white focus:outline-none"
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
                      )}
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setGroupAddError(""); setNewGroupName(""); setGroupAddForContact(c.id); setGroupModalOpen(true); }}
                        className="flex items-center gap-0.5 text-xs text-navy-700 hover:text-navy-900 font-medium"
                      >
                        <Plus className="w-3 h-3" /> 그룹 추가
                      </button>
                      {assigning === c.id && <span className="text-xs text-gray-400">배정 중...</span>}
                    </div>
                  </div>

                  {/* 전달됨 뱃지 + 회수 버튼 */}
                  {c.lastTransferredTo && (
                    <div className="flex flex-col items-end gap-1 shrink-0 ml-1">
                      <div className="flex items-center gap-1 bg-purple-50 border border-purple-200 rounded-lg px-2 py-1">
                        <span className="text-xs text-purple-500">→</span>
                        <div className="text-right">
                          <p className="text-xs font-medium text-purple-700 leading-tight">{c.lastTransferredTo.name}</p>
                          <p className="text-[10px] text-purple-400 leading-tight">{c.lastTransferredTo.orgName}</p>
                        </div>
                      </div>
                      {c.lastTransferredTo.canRecall && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRecall(c.id, c.lastTransferredTo!.logId);
                          }}
                          disabled={recalling === c.id}
                          className="text-[10px] text-red-400 hover:text-red-600 hover:underline disabled:opacity-50"
                        >
                          {recalling === c.id ? "회수 중..." : "회수"}
                        </button>
                      )}
                    </div>
                  )}

                  {/* 빠른 액션 (PC hover) */}
                  <div className="hidden md:flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a
                      href={`tel:${c.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 rounded-lg hover:bg-blue-50 text-blue-600"
                      aria-label={`전화 걸기: ${c.name}`}
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setQuickCallId(isQuickCallOpen ? null : c.id);
                        setQuickCallError(null);
                      }}
                      className={`p-2 rounded-lg transition-colors ${isQuickCallOpen ? "bg-green-100 text-green-700" : "hover:bg-green-50 text-green-600"}`}
                      aria-label="빠른 콜 기록"
                      title="빠른 콜 기록"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </div>
                </Link>
                </div>{/* end flex items-center gap-3 */}

                {/* 퀵 콜 기록 인라인 폼 */}
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

      {/* 복수 선택 공유 모달 */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-purple-500" />
                DB 전달 ({selectedIds.size}명)
              </h3>
              <button onClick={() => setShowShareModal(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>

            {/* 연관 검색 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                autoFocus
                value={shareSearch}
                onChange={(e) => { setShareSearch(e.target.value); setShareTarget(""); }}
                placeholder="이름 / 닉네임 / 아이디 검색..."
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-purple-400"
              />
            </div>
            {(() => {
              const sel = shareSections.flatMap(s => s.members).find(m => m.id === shareTarget);
              const q   = shareSearch.trim().toLowerCase();
              const filtered = shareSections.map(sec => ({
                ...sec,
                members: sec.members.filter(m =>
                  !q ||
                  (m.displayName ?? "").toLowerCase().includes(q) ||
                  m.loginId.toLowerCase().includes(q) ||
                  m.orgName.toLowerCase().includes(q)
                ),
              })).filter(sec => sec.members.length > 0);
              return (
                <>
                  {sel && (
                    <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-xl px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-purple-200 text-purple-800 flex items-center justify-center text-xs font-bold shrink-0">
                          {(sel.displayName ?? sel.loginId)[0]}
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-purple-800">{sel.displayName ?? sel.loginId}</span>
                          <span className="text-xs text-purple-400 ml-1.5">{sel.loginId}</span>
                          <span className="text-xs text-purple-400 ml-1.5">· {sel.orgName}</span>
                        </div>
                      </div>
                      <button onClick={() => setShareTarget("")} className="text-purple-400 hover:text-purple-600 text-xl leading-none">×</button>
                    </div>
                  )}
                  {(!shareTarget || shareSearch) && (
                    <div className="space-y-1 max-h-56 overflow-y-auto">
                      {filtered.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-6">검색 결과 없음</p>
                      ) : filtered.map((section) => (
                        <details key={section.label} open>
                          <summary className="flex items-center justify-between px-2 py-1.5 cursor-pointer text-xs font-semibold text-gray-500 hover:text-gray-700 select-none list-none">
                            <span>{section.label}</span>
                            <span className="text-gray-300">{section.members.length}명</span>
                          </summary>
                          <div className="space-y-0.5 mt-0.5 mb-2">
                            {section.members.map((m) => (
                              <button
                                key={m.id}
                                onClick={() => { setShareTarget(m.id); setShareSearch(""); }}
                                className="w-full text-left px-3 py-2 rounded-xl text-sm bg-gray-50 hover:bg-purple-50 text-gray-700 transition-colors flex items-center gap-2.5"
                              >
                                <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold shrink-0">
                                  {(m.displayName ?? m.loginId)[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{m.displayName ?? m.loginId}</p>
                                  <p className="text-xs text-gray-400 truncate">{m.loginId} · {m.orgName}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </details>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}

            {shareResult && (
              <p className={`text-sm font-medium ${shareResult.startsWith("✅") ? "text-green-600" : "text-red-500"}`}>{shareResult}</p>
            )}

            <button
              onClick={handleBulkShare}
              disabled={sharing || !shareTarget}
              className="w-full bg-purple-600 text-white py-2.5 rounded-xl font-medium hover:bg-purple-700 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {sharing ? "전달 중..." : <><Share2 className="w-4 h-4" /> {selectedIds.size}명 전달하기</>}
            </button>
          </div>
        </div>
      )}

      {/* TagBlast 모달 */}
      {showTagBlast && (
        <TagBlastModal
          tags={selectedTags}
          onClose={() => setShowTagBlast(false)}
        />
      )}

      {/* GroupBlast 모달 */}
      {showGroupBlast && filterGroupId && (
        <GroupBlastModal
          groupId={filterGroupId}
          groupName={groups.find(g => g.id === filterGroupId)?.name ?? ""}
          onClose={() => setShowGroupBlast(false)}
        />
      )}

      {/* 일괄 담당자 할당 모달 */}
      {showBulkAssign && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h2 className="text-lg font-bold text-navy-900 mb-2">담당자 할당</h2>
            <p className="text-sm text-gray-500 mb-4">선택한 {selectedIds.size}명의 고객을 할당합니다</p>
            <select value={bulkAssignTarget} onChange={(e) => setBulkAssignTarget(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm mb-4">
              <option value="">미배정 (담당자 없음)</option>
              {assignStats.map((s) => (
                <option key={s.userId} value={s.userId}>{s.displayName} ({s.role}) — 현재 {s.count}명</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setShowBulkAssign(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">
                취소
              </button>
              <button onClick={doBulkAssign} disabled={bulkAssigning}
                className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 disabled:opacity-50">
                {bulkAssigning ? "할당 중..." : "할당하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GroupBlastModal({
  groupId, groupName, onClose
}: { groupId: string; groupName: string; onClose: () => void }) {
  const [tab, setTab] = useState<'template' | 'direct'>('direct');
  const [message, setMessage] = useState('');
  const [templates, setTemplates] = useState<{ id: string; name: string; content: string }[]>([]);
  const [preview, setPreview] = useState<{ willSend: number; isOverLimit: boolean; overLimitMsg: string | null } | null>(null);
  const [step, setStep] = useState<'write' | 'preview' | 'done'>('write');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/tools/sms-templates')
      .then(r => r.json())
      .then(d => { if (d.ok) setTemplates(d.templates ?? []); });
  }, []);

  const handlePreview = async () => {
    if (!message.trim()) return;
    setSending(true);
    setSendError(null);
    const res = await fetch('/api/contacts/group-blast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, message, dryRun: true }),
    });
    const d = await res.json();
    if (d.ok) {
      setPreview(d);
      setStep('preview');
    } else {
      setSendError(d.message ?? '오류가 발생했습니다.');
    }
    setSending(false);
  };

  const handleSend = async () => {
    setSending(true);
    setSendError(null);
    const res = await fetch('/api/contacts/group-blast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, message, dryRun: false }),
    });
    const d = await res.json();
    if (d.ok) {
      setStep('done');
    } else {
      setSendError(d.message ?? '발송에 실패했습니다.');
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">그룹 SMS 발송</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              &quot;{groupName}&quot; 그룹 고객 전체
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        <div className="p-5">
          {step === 'write' && (
            <>
              <div className="flex gap-2 mb-4">
                {(['direct', 'template'] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      tab === t ? 'bg-navy-900 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                    {t === 'direct' ? '직접 입력' : '템플릿 선택'}
                  </button>
                ))}
              </div>

              {tab === 'direct' ? (
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="발송할 메시지를 입력하세요&#10;[고객명] 또는 [이름] 으로 이름 치환 가능"
                  className="w-full border rounded-xl p-3 text-sm h-32 resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {templates.map(t => (
                    <button key={t.id} onClick={() => { setMessage(t.content); setTab('direct'); }}
                      className="w-full text-left px-3 py-2.5 border rounded-xl hover:border-green-300 hover:bg-green-50 transition-colors">
                      <p className="text-sm font-medium text-gray-800">{t.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{t.content}</p>
                    </button>
                  ))}
                  {templates.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">등록된 템플릿이 없습니다</p>
                  )}
                </div>
              )}

              <p className="text-xs text-gray-400 mt-2">
                * 수신거부·전화번호 미입력 고객은 자동 제외됩니다
              </p>

              {sendError && <p className="text-xs text-red-500 mt-2">{sendError}</p>}

              <button
                onClick={handlePreview}
                disabled={!message.trim() || sending}
                className="w-full mt-4 py-3 bg-green-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {sending ? '확인 중...' : '발송 대상 확인'}
              </button>
            </>
          )}

          {step === 'preview' && preview && (
            <div className="space-y-4">
              <div className={`rounded-xl p-4 ${preview.isOverLimit ? 'bg-red-50' : 'bg-green-50'}`}>
                <p className="text-lg font-bold text-center">
                  {preview.willSend}명에게 발송됩니다
                </p>
                {preview.isOverLimit && (
                  <p className="text-xs text-red-600 text-center mt-1">{preview.overLimitMsg}</p>
                )}
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">발송 메시지</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{message}</p>
              </div>
              {sendError && <p className="text-xs text-red-500">{sendError}</p>}
              <div className="flex gap-2">
                <button onClick={() => setStep('write')}
                  className="flex-1 py-3 border rounded-xl text-sm text-gray-600">
                  수정
                </button>
                <button onClick={handleSend} disabled={sending}
                  className="flex-1 py-3 bg-green-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                  {sending ? '발송 중...' : '발송하기'}
                </button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-green-600 text-xl">✓</span>
              </div>
              <p className="font-semibold text-gray-900">발송 완료</p>
              <p className="text-sm text-gray-500 mt-1">&quot;{groupName}&quot; 그룹에 SMS를 발송했습니다</p>
              <button onClick={onClose}
                className="mt-4 px-6 py-2.5 bg-navy-900 text-white rounded-xl text-sm">
                닫기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TagBlastModal({
  tags, onClose
}: { tags: string[]; onClose: () => void }) {
  const [tab, setTab] = useState<'template' | 'direct'>('direct');
  const [message, setMessage] = useState('');
  const [templates, setTemplates] = useState<{ id: string; name: string; content: string }[]>([]);
  const [preview, setPreview] = useState<{ willSend: number; isOverLimit: boolean; overLimitMsg: string | null } | null>(null);
  const [step, setStep] = useState<'write' | 'preview' | 'done'>('write');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // 템플릿 로드
  useEffect(() => {
    fetch('/api/tools/sms-templates')
      .then(r => r.json())
      .then(d => { if (d.ok) setTemplates(d.templates ?? []); });
  }, []);

  const handlePreview = async () => {
    if (!message.trim()) return;
    setSending(true);
    setSendError(null);
    const res = await fetch('/api/contacts/tag-blast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags, message, dryRun: true }),
    });
    const d = await res.json();
    if (d.ok) {
      setPreview(d);
      setStep('preview');
    } else {
      setSendError(d.error ?? '오류가 발생했습니다.');
    }
    setSending(false);
  };

  const handleSend = async () => {
    setSending(true);
    setSendError(null);
    const res = await fetch('/api/contacts/tag-blast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags, message, dryRun: false }),
    });
    const d = await res.json();
    if (d.ok) {
      setStep('done');
    } else {
      setSendError(d.error ?? '발송에 실패했습니다.');
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">태그 SMS 발송</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {tags.map(t => `#${t}`).join(' · ')} 태그 보유 고객 (AND 조건)
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        <div className="p-5">
          {step === 'write' && (
            <>
              {/* 탭 */}
              <div className="flex gap-2 mb-4">
                {(['direct', 'template'] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      tab === t ? 'bg-navy-900 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                    {t === 'direct' ? '직접 입력' : '템플릿 선택'}
                  </button>
                ))}
              </div>

              {tab === 'direct' ? (
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="발송할 메시지를 입력하세요"
                  className="w-full border rounded-xl p-3 text-sm h-32 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {templates.map(t => (
                    <button key={t.id} onClick={() => { setMessage(t.content); setTab('direct'); }}
                      className="w-full text-left px-3 py-2.5 border rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-colors">
                      <p className="text-sm font-medium text-gray-800">{t.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{t.content}</p>
                    </button>
                  ))}
                  {templates.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">등록된 템플릿이 없습니다</p>
                  )}
                </div>
              )}

              <p className="text-xs text-gray-400 mt-2">
                * 선택한 태그를 모두 보유한 고객에게만 발송됩니다 (AND 조건)
              </p>

              {sendError && <p className="text-xs text-red-500 mt-2">{sendError}</p>}

              <button
                onClick={handlePreview}
                disabled={!message.trim() || sending}
                className="w-full mt-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {sending ? '확인 중...' : '발송 대상 확인'}
              </button>
            </>
          )}

          {step === 'preview' && preview && (
            <div className="space-y-4">
              <div className={`rounded-xl p-4 ${preview.isOverLimit ? 'bg-red-50' : 'bg-blue-50'}`}>
                <p className="text-lg font-bold text-center">
                  {preview.willSend}명에게 발송됩니다
                </p>
                {preview.isOverLimit && (
                  <p className="text-xs text-red-600 text-center mt-1">{preview.overLimitMsg}</p>
                )}
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">발송 메시지</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{message}</p>
              </div>
              {sendError && <p className="text-xs text-red-500">{sendError}</p>}
              <div className="flex gap-2">
                <button onClick={() => setStep('write')}
                  className="flex-1 py-3 border rounded-xl text-sm text-gray-600">
                  수정
                </button>
                <button onClick={handleSend} disabled={sending}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                  {sending ? '발송 중...' : '발송하기'}
                </button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-green-600 text-xl">✓</span>
              </div>
              <p className="font-semibold text-gray-900">발송 완료</p>
              <p className="text-sm text-gray-500 mt-1">{preview?.willSend}명에게 SMS를 발송했습니다</p>
              <button onClick={onClose}
                className="mt-4 px-6 py-2.5 bg-navy-900 text-white rounded-xl text-sm">
                닫기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
