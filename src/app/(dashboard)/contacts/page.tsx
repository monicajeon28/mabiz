"use client";

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import Link from "next/link";
import { Search, Plus, Filter, Phone, MessageSquare, CheckCircle, Clock, XCircle, Upload, X, FileSpreadsheet, Loader2, Share2, FolderDown, Trash2 } from "lucide-react";
import { logger } from "@/lib/logger";
import { useToast } from "@/lib/api/use-toast";
import { useSession } from "@/hooks/useSession";
import type { Contact as FullContact, InquiryTracking } from "@/types/contact";
import { formatInquiryTrackingSummary } from "@/lib/contact-inquiry-tracking";

// P1-21: Code-split large components for TTI optimization
const GroupBlastModal = lazy(() => import('./GroupBlastModal'));
const TagBlastModal = lazy(() => import('./TagBlastModal'));
// 고객 상세 슬라이드 패널 (행 클릭 시 표시) — 코드 스플릿
const ContactSlidePanel = lazy(() => import('./ContactSlidePanel'));

type Contact = {
  id: string;
  name: string;
  phone: string;
  type: string;
  cruiseInterest?: string | null;
  lastContactedAt?: string | null;
  departureDate?: string | null;
  leadScore?: number;
  tags?: string[] | null;
  groups?: { id?: string; groupId: string; addedAt?: string; group: { id: string; name: string; color: string | null } }[];
  _count?: { callLogs: number };
  createdAt?: string;
  sourceType?: string;
  sourceId?: string;
  signupMethod?: string;
  affiliateLinkId?: string;
  affiliateManagerId?: string;
  affiliateAgentId?: string;
  inquiryProductCode?: string;
  surveyData?: { inquiryTracking?: InquiryTracking | null } | null;
  affiliateManagerName?: string;
  affiliateAgentName?: string;
  lastTransferredTo?: {
    name: string;
    orgName: string;
    logId: string;
    transferType: string;
    canRecall: boolean;
  } | null;
  visibility?: string;
  sharedWith?: Array<{
    sharedBy: string;
    createdAt: string;
  }>;
  sharedByName?: string;
};

type ContactTab = 'SHARED' | 'ADMIN_ONLY' | 'TEAM';
type AssignStat = { userId: string; displayName: string; role: string; count: number };

// P0-6: 출처별 라벨 및 색상
const SOURCE_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  user: { label: "구매고객", icon: "🟢", color: "bg-green-50 text-green-700" },
  inquiry: { label: "상품문의", icon: "📋", color: "bg-blue-50 text-blue-700" },
  affiliate: { label: "파트너채널", icon: "🟡", color: "bg-yellow-50 text-yellow-700" },
  landing_page: { label: "랜딩페이지", icon: "🔵", color: "bg-cyan-50 text-cyan-700" },
  education: { label: "교육", icon: "🎓", color: "bg-purple-50 text-purple-700" },
  gold_member: { label: "골드회원", icon: "👑", color: "bg-amber-50 text-amber-700" },
};

const getLeadTier = (score: number) => {
  if (score >= 70) return { label: "🔥 뜨거움",  color: "bg-red-100 text-red-700" };
  if (score >= 30) return { label: "☀️ 따뜻함", color: "bg-orange-100 text-orange-600" };
  if (score >= 0)  return { label: "❄️ 차가움", color: "bg-blue-50 text-blue-500" };
  return               { label: "💤 못찾음", color: "bg-gray-100 text-gray-600" };
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
  "VIP":       { label: "👑 특별한 고객",       color: "bg-gold-100 text-gold-700 font-bold" },
  "수신거부":  { label: "수신거부",  color: "bg-gray-100 text-gray-500" },
  // 기존 영문 코드 → 한국어 (하위 호환)
  LEAD:         { label: "잠재고객",  color: "bg-blue-100 text-blue-700" },
  PROSPECT:     { label: "잠재고객",  color: "bg-blue-100 text-blue-700" },
  INQUIRY:      { label: "문의고객",  color: "bg-sky-100 text-sky-700" },
  CUSTOMER:     { label: "구매완료",  color: "bg-green-100 text-green-700" },
  PURCHASED:    { label: "구매완료",  color: "bg-green-100 text-green-700" },
  GOLD:         { label: "👑 골드회원", color: "bg-amber-100 text-amber-700" },
  ACTIVE:       { label: "활성",      color: "bg-green-100 text-green-700" },
  INACTIVE:     { label: "비활성",    color: "bg-gray-100 text-gray-500" },
  UNSUBSCRIBED: { label: "수신거부",  color: "bg-gray-100 text-gray-500" },
  BLOCKED:      { label: "차단됨",    color: "bg-red-100 text-red-600" },
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

function formatCreatedAt(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}`;
}

function getSourceLabel(contact: Contact): string {
  return SOURCE_TYPE_LABELS[contact.sourceType || ""]?.label ?? "기타";
}

export default function ContactsPage() {
  const { toast } = useToast();
  const { role } = useSession();

  const canDelete = role === 'OWNER' || role === 'GLOBAL_ADMIN';
  const isAdmin = role === 'GLOBAL_ADMIN';
  const [activeTab, setActiveTab] = useState<ContactTab>('SHARED');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [sharedCount, setSharedCount] = useState(0);
  const [adminOnlyCount, setAdminOnlyCount] = useState(0);
  const [teamCount, setTeamCount] = useState(0);
  const [typeStats, setTypeStats] = useState<{ total: number; inquiry: number; purchased: number; gold: number }>({ total: 0, inquiry: 0, purchased: 0, gold: 0 });
  const [adminOnlyStats, setAdminOnlyStats] = useState<{ b2c: number; b2b: number; admin: number }>({ b2c: 0, b2b: 0, admin: 0 });
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [groups, setGroups] = useState<{ id: string; name: string; color: string | null; funnelId: string | null }[]>([]);
  const [bulkGroupId, setBulkGroupId] = useState<string>("");
  const [assigning, setAssigning] = useState<string | null>(null);

  // 태그 필터 상태
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagBlast, setShowTagBlast] = useState(false);

  // 전체 백업
  const [backingUp,     setBackingUp]     = useState(false);
  const [backupMsg,     setBackupMsg]     = useState("");

  const handleOrgBackup = async () => {
    setBackingUp(true);
    setBackupMsg("");
    try {
      const res  = await fetch("/api/backup/org", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setBackupMsg(`✅ ${data.count}명 저장했어요`);
        // backupMsg 상태 변경 → useEffect(line 522-526)가 4000ms 후 자동 초기화
      } else {
        setBackupMsg("❌ 저장에 실패했어요");
      }
    } catch {
      setBackupMsg("❌ 인터넷 안 터져요");
    } finally {
      setBackingUp(false);
    }
  };

  // 그룹 필터
  const [filterGroupId,  setFilterGroupId]  = useState("");
  const [showGroupBlast, setShowGroupBlast] = useState(false);

  // P0-6: 출처 필터
  const [filterSourceType, setFilterSourceType] = useState("");

  // 담당자 할당
  const [assignStats, setAssignStats] = useState<AssignStat[]>([]);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [filterAssignedTo, setFilterAssignedTo] = useState("");
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [bulkAssignTarget, setBulkAssignTarget] = useState("");
  const [bulkAssigning, setBulkAssigning] = useState(false);

  // P2-7: Store only contact IDs (string) not objects — reduces memory from ~1MB to ~10KB
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set());
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareSections,  setShareSections]  = useState<{ label: string; members: { id: string; displayName: string | null; loginId: string; orgName: string }[] }[]>([]);
  const [shareTarget,    setShareTarget]    = useState("");
  const [shareSearch,    setShareSearch]    = useState("");
  const [sharing,        setSharing]        = useState(false);
  const [shareResult,    setShareResult]    = useState("");

  // 복수 선택 삭제
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 그룹 추가 모달 (목록에서)
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupAddForContact, setGroupAddForContact] = useState<string | null>(null); // 배정할 contactId
  const [newGroupName, setNewGroupName] = useState("");
  const [groupAdding, setGroupAdding] = useState(false);
  const [groupAddError, setGroupAddError] = useState("");

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === contacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contacts.map(c => c.id)));
    }
  };

  const openShareModal = async () => {
    if (selectedIds.size === 0) return;
    setShareResult("");
    setShareTarget("");
    setShareSearch("");
    shareAbortRef.current?.abort();
    const ctrl = new AbortController();
    shareAbortRef.current = ctrl;
    try {
      const res = await fetch("/api/org/agents", { signal: ctrl.signal });
      const data = await res.json();
      if (data.ok) setShareSections(data.sections ?? []);
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      toast({ title: '팀원 목록 로딩 실패', variant: 'destructive' });
      return;
    }
    setShowShareModal(true);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/contacts/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (data.ok) {
        toast({ title: '삭제 완료', description: `${data.deleted}명의 고객이 삭제되었습니다` });
        setSelectedIds(new Set());
        setShowDeleteConfirm(false);
        // page가 이미 1이면 setPage(1)은 no-op → 직접 호출
        if (page === 1) {
          fetchContacts();
        } else {
          setPage(1);
        }
      } else {
        toast({ title: '삭제 실패', description: data.message ?? '다시 시도해주세요.', variant: 'destructive' });
      }
    } catch (err) {
      logger.error("[ContactsPage] Bulk delete error:", err as object);
      toast({ title: '네트워크 오류', description: '삭제 중 오류가 발생했습니다. 다시 시도해주세요.', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkShare = async () => {
    if (!shareTarget || selectedIds.size === 0) return;
    setSharing(true);
    try {
      const res = await fetch("/api/contacts/bulk-send-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: Array.from(selectedIds), targetUserId: shareTarget }),
      });
      const data = await res.json();
      if (data.ok) {
        const failMsg = data.failed > 0 ? ` / ❌ ${data.failed}건 실패` : "";
        setShareResult(`✅ ${data.succeeded}건 전달 완료${failMsg}`);
      } else {
        setShareResult(`❌ ${data.message ?? "공유 실패"}`);
        logger.error('[bulkShare failed]', { data });
      }
    } catch (err) {
      logger.error('[bulkShare error]', { err });
      setShareResult("❌ 네트워크 오류");
    } finally {
      setSharing(false);
    }
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
      const newGroup = { id: data.group.id, name: data.group.name, color: data.group.color ?? null, funnelId: data.group.funnelId ?? null };
      setGroups((prev) => [...prev, newGroup]);

      // 그룹 생성 즉시 해당 고객에게 배정
      if (groupAddForContact) {
        const assignRes = await fetch(`/api/groups/${newGroup.id}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactIds: [groupAddForContact] }),
        });
        const assignData = await assignRes.json();
        if (!assignRes.ok || !assignData.ok) {
          setGroupAddError(assignData.message ?? '그룹 배정 실패');
          return;
        }
        setContacts(prev => prev.map(c =>
          c.id === groupAddForContact && !(c.groups ?? []).some(g => g.groupId === newGroup.id)
            ? { ...c, groups: [...(c.groups ?? []), { groupId: newGroup.id, addedAt: new Date().toISOString(), group: { id: newGroup.id, name: newGroup.name, color: newGroup.color ?? null } }] }
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
        toast({ title: '회수 실패', description: data.message ?? '다시 시도해주세요.', variant: 'destructive' });
      }
    } catch {
      toast({ title: '네트워크 오류', description: '잠시 후 다시 시도해주세요.', variant: 'destructive' });
    } finally {
      setRecalling(null);
    }
  };

  // 슬라이드 패널 상태 (행 클릭 → router.push 대신 패널 표시)
  const [slidePanelContact, setSlidePanelContact] = useState<FullContact | null>(null);
  const [slidePanelOpen,    setSlidePanelOpen]    = useState(false);
  const [slidePanelLoadingId, setSlidePanelLoadingId] = useState<string | null>(null);
  const slidePanelAbortRef = useRef<AbortController | null>(null);
  const closePanelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shareAbortRef = useRef<AbortController | null>(null);

  // closePanelTimerRef cleanup (언마운트 시 메모리 누수 방지)
  useEffect(() => {
    return () => {
      if (closePanelTimerRef.current) clearTimeout(closePanelTimerRef.current);
      shareAbortRef.current?.abort();
    };
  }, []);

  // 행 클릭 시 전체 고객 정보를 받아와 패널 열기
  const openSlidePanel = useCallback(async (contactId: string) => {
    // 이전 요청 취소 (연속 클릭 race condition 방지)
    slidePanelAbortRef.current?.abort();
    const controller = new AbortController();
    slidePanelAbortRef.current = controller;

    setSlidePanelLoadingId(contactId);
    try {
      const res = await fetch(`/api/contacts/${contactId}`, { signal: controller.signal });
      const data = await res.json();
      if (data.ok && data.contact) {
        setSlidePanelContact(data.contact as FullContact);
        setSlidePanelOpen(true);
      } else {
        toast({ title: '불러오기 실패', description: '고객 정보를 불러오지 못했습니다.', variant: 'destructive' });
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      logger.error('[openSlidePanel failed]', { err });
      toast({ title: '네트워크 오류', description: '잠시 후 다시 시도해주세요.', variant: 'destructive' });
    } finally {
      setSlidePanelLoadingId(null);
    }
  }, [toast]);

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
    if (role === undefined) return; // 세션 로드 전 fetch 방지 — loading=true 유지로 깜박임 방지
    if (role === 'FREE_SALES') { setLoading(false); return; } // FREE_SALES 클라이언트 guard
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "30" });
    if (q)                        params.set("q",          q);
    if (type)                     params.set("type",       type);
    if (filterSourceType)         params.set("sourceType", filterSourceType); // P0-6
    if (filterGroupId)            params.set("groupId",    filterGroupId);
    if (filterAssignedTo)         params.set("assignedTo", filterAssignedTo);
    if (selectedTags.length > 0)  params.set("tags",       selectedTags.join(","));
    // P1-C: 탭별 가시성 스코프
    //   SHARED  → 내 고객만 (scope=own)        : 모든 역할 기본
    //   TEAM    → 지사 전체/전체 (scope=org/all): 지사장(OWNER)=org, 관리자(GLOBAL_ADMIN)=all
    //   ADMIN_ONLY → 관리자 전용 보관함         : 관리자만
    if (activeTab === 'ADMIN_ONLY') {
      params.set("visibility", "ADMIN_ONLY");
    } else if (activeTab === 'TEAM') {
      params.set("scope", role === 'GLOBAL_ADMIN' ? "all" : "org");
    } else {
      params.set("scope", "own");
    }

    try {
      const res = await fetch(`/api/contacts?${params}`, { signal });
      if (!res.ok) {
        if (res.status === 401) toast({ title: '로그인이 필요합니다.', variant: 'destructive' });
        else if (res.status === 403) toast({ title: '접근 권한이 없습니다.', variant: 'destructive' });
        else toast({ title: '고객 목록을 불러오지 못했습니다.', variant: 'destructive' });
        return;
      }
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
  }, [q, type, page, filterGroupId, filterSourceType, filterAssignedTo, selectedTags, activeTab, role, toast]); // P0-6 + role

  // P2-8: refs persist across renders — prevents debounce timer reset and premature AbortController abort
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // 검색어(q)만 입력 중 → 300ms debounce (사용자 타이핑 대기)
    // 필터 변경 → 즉시 호출 (필터는 드롭다운이라 안정적)
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    const doFetch = () => {
      // AbortController를 fetch 직전에 생성해야 debounce 대기 중 abort가 일어나지 않음
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      fetchContacts(controller.signal);
    };

    if (q) {
      debounceTimerRef.current = setTimeout(doFetch, 300);
    } else {
      doFetch();
    }

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      abortControllerRef.current?.abort();
    };
  }, [q, type, page, filterGroupId, filterSourceType, filterAssignedTo, selectedTags, fetchContacts]);

  // Team-B: 탭 변경 시 필터 리셋 (혼동 방지)
  useEffect(() => {
    setPage(1);
    // 탭 변경 시 검색어는 유지하되, 필터는 리셋하지 않음 (사용자 의도 존중)
  }, [filterGroupId, filterSourceType, filterAssignedTo, selectedTags, activeTab]); // P0-6 + activeTab

  // [L6] setTimeout cleanup (백업 메시지 자동 숨김)
  useEffect(() => {
    if (!backupMsg) return;
    const timer = setTimeout(() => setBackupMsg(""), 4000);
    return () => clearTimeout(timer);
  }, [backupMsg]);

  // 담당자 할당 통계와 그룹 로드 (의존성: 없음 - 마운트 시 1회만)
  // 그룹/담당자 정보는 자주 변경되지 않으므로, 필요시 수동으로 갱신

  // 할당 통계 + 그룹 목록 + 탭 카운트 + 타입별 통계 로드
  useEffect(() => {
    if (role === undefined) return; // 세션 로드 전 fetch 방지
    const ctrl = new AbortController();
    const hasTeamTab = role === 'OWNER' || role === 'GLOBAL_ADMIN';
    const teamScope = role === 'GLOBAL_ADMIN' ? 'all' : 'org';

    // P1-C: 현재 탭의 스코프로 카운트/타입통계 조회
    //   ADMIN_ONLY → visibility=ADMIN_ONLY / TEAM → scope=org|all / SHARED → scope=own
    const statsQuery =
      activeTab === 'ADMIN_ONLY' ? 'visibility=ADMIN_ONLY'
      : activeTab === 'TEAM'     ? `scope=${teamScope}`
      :                            'scope=own';

    Promise.all([
      fetch("/api/groups", { signal: ctrl.signal }).then(r => r.json()),
      fetch("/api/contacts/assign-stats", { signal: ctrl.signal }).then(r => r.json()),
      // 현재 탭의 타입별(문의/구매/골드) 카운트
      fetch(`/api/contacts/stats?${statsQuery}`, { signal: ctrl.signal }).then(r => r.json()),
      // "내 고객" 탭 배지 카운트 (항상 own)
      fetch("/api/contacts?scope=own&limit=1", { signal: ctrl.signal }).then(r => r.json()),
      // 관리자 전용 보관함 배지 + 출처통계
      isAdmin ? fetch("/api/contacts?visibility=ADMIN_ONLY&limit=1&includeStats=true", { signal: ctrl.signal }).then(r => r.json()) : Promise.resolve(null),
      // 지사 전체/전체 탭 배지 카운트
      hasTeamTab ? fetch(`/api/contacts?scope=${teamScope}&limit=1`, { signal: ctrl.signal }).then(r => r.json()) : Promise.resolve(null),
    ]).then(([g, a, typeStats, mine, adminOnly, team]) => {
      if (g.ok) setGroups(g.groups ?? []);
      if (a.ok) { setAssignStats(a.stats ?? []); setUnassignedCount(a.unassigned ?? 0); }
      if (mine.ok) setSharedCount(mine.total ?? 0);
      if (typeStats.ok) setTypeStats(typeStats.stats ?? { total: 0, inquiry: 0, purchased: 0, gold: 0 });
      if (adminOnly?.ok) {
        setAdminOnlyCount(adminOnly.total ?? 0);
        if (adminOnly.sourceStats) {
          setAdminOnlyStats(adminOnly.sourceStats);
        }
      }
      if (team?.ok) setTeamCount(team.total ?? 0);
    }).catch(err => {
      if (err instanceof Error && err.name !== 'AbortError') logger.error('[stats failed]', { err });
    });
    return () => ctrl.abort();
  }, [isAdmin, role, activeTab]);

  // [L6] setTimeout cleanup (공유 결과 메시지 자동 숨김)
  useEffect(() => {
    if (!shareResult) return;
    const timer = setTimeout(() => { setShowShareModal(false); setShareResult(""); }, 2000);
    return () => clearTimeout(timer);
  }, [shareResult]);

  const doBulkAssign = async () => {
    if (selectedIds.size === 0) return;
    setBulkAssigning(true);
    try {
      const res = await fetch("/api/contacts/bulk-assign", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: Array.from(selectedIds), assignToUserId: bulkAssignTarget || null }),
      });
      const data = await res.json();
      if (data.ok) {
        setShowBulkAssign(false);
        setSelectedIds(new Set());
        // T-018: assign-stats 별도 fire-and-forget 대신 fetchContacts로 통합 — UI 상태 일관성 확보
        await fetchContacts();
        // 통계 갱신 (await로 완료 보장)
        fetch("/api/contacts/assign-stats").then(r => r.json()).then(d => {
          if (d.ok) { setAssignStats(d.stats); setUnassignedCount(d.unassigned); }
        }).catch(err => logger.warn('[assign-stats]', { err }));
      } else {
        toast({ title: '할당 실패', description: data.message ?? '다시 시도해주세요.', variant: 'destructive' });
      }
    } catch {
      toast({ title: '네트워크 오류', description: '잠시 후 다시 시도해주세요.', variant: 'destructive' });
    } finally {
      setBulkAssigning(false);
    }
  };

  const runImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const form = new FormData();
      form.append("file", importFile);
      const res  = await fetch("/api/contacts/import", { method: "POST", body: form });
      const data = await res.json();
      if (data.ok) {
        setImportResult({ successCount: data.successCount, skipCount: data.skipCount, errors: data.errors ?? [] });
        fetchContacts();
      } else {
        toast({ title: '가져오기 실패', description: data.message ?? '다시 시도해주세요.', variant: 'destructive' });
      }
    } catch {
      toast({ title: '네트워크 오류', description: '잠시 후 다시 시도해주세요.', variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const quickAssign = async (contactId: string, groupId: string) => {
    if (!groupId) return;
    setAssigning(contactId);

    try {
      // 기존 그룹 제거 후 새 그룹 배정 (그룹은 1개만) — 병렬 처리
      const contact = contacts.find(c => c.id === contactId);
      if (contact && (contact.groups ?? []).length > 0) {
        const removeResults = await Promise.all(
          (contact.groups ?? []).map((g) =>
            fetch(`/api/groups/${g.group.id}/members`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ contactIds: [contactId] }),
            })
          )
        );
        for (const r of removeResults) {
          if (!r.ok) throw new Error('기존 그룹 제거 실패 (HTTP ' + r.status + ')');
        }
      }

      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: [contactId] }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json() as unknown as { ok?: boolean; message?: string };
      if (!data.ok) throw new Error(data.message ?? '배정 실패');

      // 로컬 상태 업데이트 (새 그룹만 표시)
      const grp = groups.find(g => g.id === groupId);
      if (grp) {
        setContacts(prev => prev.map(c =>
          c.id === contactId
            ? { ...c, groups: [{ groupId: groupId, addedAt: new Date().toISOString(), group: { id: grp.id, name: grp.name, color: grp.color ?? null } }] }
            : c
        ));
      }
      toast({ title: `"${grp?.name ?? '그룹'}" 배정 완료`, variant: 'success' });
      fetchContacts().catch(() => {});
    } catch (err) {
      logger.error('[quickAssign failed]', { err });
      toast({
        title: '그룹 배정 실패',
        description: err instanceof Error ? err.message : '다시 시도해주세요.',
        variant: 'destructive',
      });
    } finally {
      setAssigning(null);
    }
  };

  const bulkAssignUnassigned = async () => {
    if (!bulkGroupId) return;
    const unassigned = contacts.filter((c) => (c.groups ?? []).length === 0);
    if (unassigned.length === 0) return;
    try {
      // 단일 배치 API 호출 (그룹 없는 고객이므로 기존 그룹 제거 불필요)
      const res = await fetch(`/api/groups/${bulkGroupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: unassigned.map((c) => c.id) }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast({ title: '일괄 배정 실패', description: data.message ?? '다시 시도해주세요.', variant: 'destructive' });
        return;
      }
      toast({ title: `${data.successCount ?? unassigned.length}명 배정 완료`, variant: 'success' });
    } catch {
      toast({ title: '네트워크 오류', description: '다시 시도해주세요.', variant: 'destructive' });
    }
    fetchContacts().catch((err: unknown) => {
      logger.warn('[bulkAssignUnassigned refetch 실패]', { err });
    });
  };

  const handleQuickCall = async (contactId: string, result: QuickCallResult) => {
    setQuickCallLoading(true);
    setQuickCallError(null);
    const resultLabel = result === "INTERESTED" ? "관심" : result === "PENDING" ? "보류" : "거절";
    const convictionScore = result === "INTERESTED" ? "8" : result === "PENDING" ? "5" : "2";

    // 낙관적 업데이트: 로컬 상태 즉시 변경
    const originalContacts = contacts;
    setContacts(prev =>
      prev.map(c =>
        c.id === contactId
          ? {
              ...c,
              lastContactedAt: new Date().toISOString(),
              _count: { ...c._count, callLogs: (c._count?.callLogs ?? 0) + 1 },
            }
          : c
      )
    );

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
        // 실패: 롤백
        setContacts(originalContacts);
        setQuickCallError("콜 기록 저장에 실패했습니다.");
      } else {
        setQuickCallId(null);
        // 폴백: 백그라운드에서 전체 리페치 (낙관적 업데이트된 상태 유지)
        fetchContacts().catch(() => {
          // 리페치 실패 시 롤백
          setContacts(originalContacts);
          setQuickCallError("데이터 동기화 실패");
        });
      }
    } catch {
      // 네트워크 오류: 롤백
      setContacts(originalContacts);
      setQuickCallError("네트워크 오류가 발생했습니다.");
    } finally {
      setQuickCallLoading(false);
    }
  };

  // P2-11: Fetch tags from server API instead of client-side deduplication
  const [allTags, setAllTags] = useState<string[]>([]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/contacts/tags?limit=1000', { signal: ctrl.signal })
      .then(r => r.json())
      .then(data => { if (data.ok) setAllTags(data.tags ?? []); })
      .catch(err => { if (err instanceof Error && err.name !== 'AbortError') logger.error('[loadTags failed]', { err }); })
    return () => ctrl.abort();
    // Load tags once on mount (cache in Redis server-side)
  }, []);

  // 태그/채널/담당자 필터는 fetchContacts() API 파라미터로 DB 레벨에서 처리됨
  // (클라이언트 사이드 contacts 변수 제거, contacts 직접 사용)

  // 오늘 콜할 사람: LEAD + (연락 없음 OR 3일 이상 연락 없음) → 리드 스코어 높은 순
  const todayCallList = contacts
    .filter((c) => {
      if (c.type !== "잠재고객" && c.type !== "LEAD") return false;
      const days = getDaysSince(c.lastContactedAt ?? null);
      if (days === null) return true;
      return days >= 3;
    })
    .sort((a, b) => (b.leadScore ?? 0) - (a.leadScore ?? 0))  // HOT 먼저
    .slice(0, 5);

  if (role === 'FREE_SALES') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-3xl">🔒</div>
        <h2 className="text-xl font-bold text-gray-900">고객 목록 접근 권한이 없습니다</h2>
        <p className="text-base text-gray-600 max-w-sm">
          마케터 역할은 고객 목록을 볼 수 없습니다.<br />지사장에게 문의하세요.
        </p>
      </div>
    );
  }

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
              {groupAddError && <p className="text-sm text-red-500">{groupAddError}</p>}
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
                <FileSpreadsheet className="w-5 h-5 text-green-600" /> 엑셀에서 고객 추가
              </h3>
              <button onClick={() => setShowImport(false)} className="text-gray-600 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 형식 안내 + 샘플 다운로드 */}
            <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600 space-y-1">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold">📋 엑셀 파일은 이렇게 만들어요</p>
                <a
                  href="/api/contacts/sample"
                  download="cruisedot_import_sample.xlsx"
                  className="flex items-center gap-1 text-green-700 font-semibold bg-green-100 hover:bg-green-200 px-2 py-1 rounded-lg text-sm transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> 샘플 다운로드
                </a>
              </div>
              <p>• <strong className="text-red-600">필수:</strong> 이름, 전화번호 (이 두 열은 꼭 있어야 해요)</p>
              <p>• <strong>선택:</strong> 이메일, 관심크루즈, 예산, 메모, 유형, 유입날짜, 설문1~3</p>
              <div className="bg-white rounded-lg p-2 mt-1 border border-gray-200 text-xs space-y-0.5">
                <p className="font-medium text-gray-700 mb-1">열 이름 (한국어·영어 모두 인식해요)</p>
                <p>이름 / name / 성명</p>
                <p>전화번호 / 👥 고객 / phone / 휴대폰</p>
                <p>이메일 / email &nbsp;|&nbsp; 관심크루즈 / 크루즈</p>
                <p>예산 / budget &nbsp;|&nbsp; 메모 / 비고</p>
                <p>유형 / 구분 &nbsp;|&nbsp; 유입날짜 / 유입일 / 등록일</p>
                <p>설문1 / 질문1 / q1 &nbsp;|&nbsp; 설문2 / 질문2 / q2 &nbsp;|&nbsp; 설문3 / 질문3 / q3</p>
              </div>
              <p>• 유형 값: <strong>잠재고객</strong> 또는 <strong>구매완료</strong> (입력 없으면 잠재고객)</p>
              <p>• 같은 전화번호면 기존 정보가 새 내용으로 업데이트돼요</p>
              <p className="text-orange-600 font-medium">• 최대 <strong>10MB</strong> / .xlsx · .xls만 가능</p>
            </div>

            {/* 파일 선택 */}
            <label className="block">
              <div className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                importFile ? "border-green-400 bg-green-50" : "border-gray-200 hover:border-navy-300"
              }`}>
                <Upload className={`w-8 h-8 mx-auto mb-2 ${importFile ? "text-green-500" : "text-gray-600"}`} />
                {importFile
                  ? <p className="text-sm font-medium text-green-700">{importFile.name}</p>
                  : <p className="text-sm text-gray-600">여기다 파일을 끌어오거나 클릭해요<br />.xlsx, .xls 가능</p>
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
                  ✅ {importResult.successCount}명 추가했어요
                  {importResult.skipCount > 0 && ` / ⚠️ ${importResult.skipCount}건 건너뛰었어요`}
                </p>
                {importResult.errors.slice(0, 3).map((e, i) => (
                  <p key={`import-err-${i}`} className="text-sm opacity-80">{e}</p>
                ))}
              </div>
            )}

            <button
              onClick={runImport}
              disabled={importing || !importFile}
              className="w-full bg-green-600 text-white py-2.5 rounded-xl font-medium hover:bg-green-700 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {importing ? <><Upload className="w-4 h-4 animate-bounce" /> 추가하는 중...</> : "지금 추가"}
            </button>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">👥 고객</h1>
          <p className="text-sm text-gray-500 mt-0.5">총 {total.toLocaleString()}명</p>
        </div>
        <div className="flex gap-2">
          {/* 삭제 DB(휴지통) 진입 — 지사장/관리자만 */}
          {canDelete && (
            <Link
              href="/contacts/trash"
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              title="삭제된 고객을 보고 복구합니다 (지사장/관리자 전용)"
            >
              <Trash2 className="w-4 h-4" />
              삭제 DB
            </Link>
          )}
          {/* L7: 팀 공유 기능 강화 */}
          {selectedIds.size > 0 && (
            <>
              <button
                onClick={openShareModal}
                className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors shadow-sm"
                title="팀원들과 이 고객들의 정보를 함께 봐요"
              >
                <Share2 className="w-4 h-4" />
                팀에 알려주기 ({selectedIds.size}명)
              </button>
              {canDelete && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-sm"
                  title="선택된 고객을 삭제합니다 (지사장/관리자 전용)"
                >
                  <X className="w-4 h-4" />
                  삭제 ({selectedIds.size}명)
                </button>
              )}
            </>
          )}
          {selectedTags.length > 0 && (
            <button
              onClick={() => setShowTagBlast(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              태그 메시지 ({contacts.length}명)
            </button>
          )}
          {filterGroupId && (
            <button
              onClick={() => setShowGroupBlast(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              그룹 메시지 ({total}명)
            </button>
          )}
          <button
            onClick={handleOrgBackup}
            disabled={backingUp}
            className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            title="모든 고객을 폴더에 저장해요"
          >
            {backingUp
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <FolderDown className="w-4 h-4" />
            }
            모든 고객 저장하기
          </button>
          {(role === 'OWNER' || role === 'GLOBAL_ADMIN') && (
            <button
              onClick={() => { setShowImport(true); setImportResult(null); setImportFile(null); }}
              className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              <Upload className="w-4 h-4" /> 엑셀에서 가져오기
            </button>
          )}
          <Link
            href="/contacts/new"
            className="flex items-center gap-1.5 bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> 고객 추가
          </Link>
        </div>
      </div>

      {/* Contact 탭 (Team-B UI) - 50대 친화 UX */}
      <div className="mb-6">
        {/* AGENT 안내 메시지 */}
        {role === 'AGENT' && (
          <div className="mb-4 px-4 py-3 bg-blue-50 rounded-xl border border-blue-200 flex items-center gap-2">
            <span className="text-blue-500 text-lg">ℹ️</span>
            <p className="text-base font-medium text-blue-800">내가 담당하는 고객만 표시됩니다</p>
          </div>
        )}

        {/* 탭 버튼 (크고 명확한 텍스트) + 설명 */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <button
              onClick={() => { setActiveTab('SHARED'); setPage(1); }}
              className={`px-8 py-4 rounded-xl font-bold text-base md:text-lg transition-all transform text-left ${
                activeTab === 'SHARED'
                  ? 'bg-blue-600 text-white shadow-lg scale-105'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📋 내 고객 <br className="md:hidden" />
              <span className="text-sm md:text-base font-semibold">({sharedCount}명)</span>
            </button>
            {activeTab === 'SHARED' && (
              <p className="text-sm text-gray-600 px-1">내가 담당하거나 등록한 고객 목록</p>
            )}
          </div>
          {(role === 'OWNER' || role === 'GLOBAL_ADMIN') && (
            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <button
                onClick={() => { setActiveTab('TEAM'); setPage(1); }}
                className={`px-8 py-4 rounded-xl font-bold text-base md:text-lg transition-all transform text-left ${
                  activeTab === 'TEAM'
                    ? 'bg-amber-600 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {role === 'GLOBAL_ADMIN' ? '🌐 전체 고객' : '👥 지사 전체 고객'} <br className="md:hidden" />
                <span className="text-sm md:text-base font-semibold">({teamCount}명)</span>
              </button>
              {activeTab === 'TEAM' && (
                <p className="text-sm text-gray-600 px-1">
                  {role === 'GLOBAL_ADMIN'
                    ? '모든 지사의 고객을 한눈에 봅니다 (담당자 표시)'
                    : '우리 지사 전체 고객 목록입니다 (담당자 표시)'}
                </p>
              )}
            </div>
          )}
          {isAdmin && (
            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <button
                onClick={() => { setActiveTab('ADMIN_ONLY'); setPage(1); }}
                className={`px-8 py-4 rounded-xl font-bold text-base md:text-lg transition-all transform text-left ${
                  activeTab === 'ADMIN_ONLY'
                    ? 'bg-blue-600 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🔒 관리자 전용 <br className="md:hidden" />
                <span className="text-sm md:text-base font-semibold">({adminOnlyCount}명)</span>
              </button>
              {activeTab === 'ADMIN_ONLY' && (
                <p className="text-sm text-gray-600 px-1">오직 당신만 볼 수 있는 고객 목록</p>
              )}
            </div>
          )}
        </div>

        {/* 고객 타입별 필터 (라디오 버튼) */}
        <div className="mb-6 px-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              { value: "", label: "전체", emoji: "👥", count: typeStats.total, color: "blue" },
              { value: "잠재고객", label: "문의고객", emoji: "💬", count: typeStats.inquiry, color: "amber" },
              { value: "구매완료", label: "구매완료", emoji: "📦", count: typeStats.purchased, color: "green", disabledForRole: "FREE_SALES" },
              { value: "금회원", label: "골드회원", emoji: "👑", count: typeStats.gold, color: "yellow", disabledForRole: "FREE_SALES" },
            ].map(option => {
              const isDisabled = Boolean(option.disabledForRole && role === option.disabledForRole);
              const isSelected = type === option.value;
              const colorMap = {
                blue: { border: "border-blue-400", bg: "bg-blue-100", hover: "hover:bg-blue-50" },
                amber: { border: "border-amber-400", bg: "bg-amber-100", hover: "hover:bg-amber-50" },
                green: { border: "border-green-400", bg: "bg-green-100", hover: "hover:bg-green-50" },
                yellow: { border: "border-yellow-400", bg: "bg-yellow-100", hover: "hover:bg-yellow-50" },
              } as const satisfies Record<string, { border: string; bg: string; hover: string }>;
              const colors = colorMap[option.color as keyof typeof colorMap];
              return (
                <label
                  key={option.value}
                  className={`flex items-center gap-3 p-4 rounded-lg cursor-pointer border-2 transition ${
                    isDisabled
                      ? "border-gray-300 bg-gray-100 opacity-40 cursor-not-allowed"
                      : isSelected
                      ? `${colors.border} ${colors.bg}`
                      : `border-gray-300 ${colors.hover}`
                  }`}
                >
                  <input
                    type="radio"
                    value={option.value}
                    checked={isSelected}
                    onChange={(e) => {
                      setType(e.target.value);
                      setPage(1);
                    }}
                    disabled={isDisabled ?? false}
                    className="w-6 h-6 cursor-pointer accent-gray-800"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-base truncate">
                      {option.emoji} {option.label}
                    </div>
                    <div className="text-sm text-gray-600 font-semibold">
                      {option.count.toLocaleString()}명
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* 설명문 (크고 명확) */}
        <div className="px-4 py-3 bg-blue-50 rounded-xl border-l-4 border-blue-400">
          <p className="text-base font-medium text-gray-800 leading-relaxed">
            ⓘ {activeTab === 'SHARED'
              ? '내가 담당하거나 직접 등록한 고객들입니다. 선택해서 팀에 공유할 수 있어요.'
              : activeTab === 'TEAM'
              ? (role === 'GLOBAL_ADMIN'
                  ? '🌐 모든 지사의 고객을 한눈에 볼 수 있습니다. 담당자가 함께 표시돼요.'
                  : '👥 우리 지사의 모든 고객을 한눈에 볼 수 있습니다. 담당자가 함께 표시돼요.')
              : '👔 관리자만 따로 보관하는 특별한 고객 정보입니다. 다른 직원들에게 공유되지 않습니다.'}
          </p>
          {/* Team-A: 관리자 전용 탭 통계 */}
          {activeTab === 'ADMIN_ONLY' && adminOnlyCount > 0 && (
            <div className="mt-3 pt-3 border-t border-blue-200 text-sm text-gray-700 space-y-1">
              <div className="font-semibold text-gray-800 mb-2">📊 출처별 현황</div>
              <div className="flex gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-base">🌐</span>
                  <span>B2C 유입: <span className="font-bold text-blue-700">{adminOnlyStats.b2c}명</span></span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-base">🏢</span>
                  <span>B2B 유입: <span className="font-bold text-blue-700">{adminOnlyStats.b2b}명</span></span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-base">👤</span>
                  <span>관리자 직입: <span className="font-bold text-blue-700">{adminOnlyStats.admin}명</span></span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 백업 결과 토스트 */}
      {backupMsg && (
        <div className={`mb-3 px-4 py-2.5 rounded-xl text-sm font-medium ${backupMsg.startsWith("✅") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
          {backupMsg}
        </div>
      )}

      {/* 검색 + 필터 (50대 친화 - 큰 텍스트) */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
          <input
            type="text"
            placeholder={filterGroupId ? "🔍 그룹 멤버 이름이나 번호 검색" : "🔍 이름 또는 전화번호 검색"}
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-lg text-base font-medium focus:outline-none focus:border-gold-500"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
          <select
            value={type}
            onChange={(e) => { setType(e.target.value); setPage(1); }}
            className="pl-11 pr-8 py-3 border border-gray-200 rounded-lg text-base font-medium appearance-none bg-white focus:outline-none focus:border-gold-500"
          >
            <option value="">📊 유형 전체</option>
            <option value="잠재고객">잠재고객</option>
            <option value="문자">문자</option>
            <option value="부재">부재</option>
            <option value="3일부재">3일부재</option>
            <option value="소통">소통</option>
            <option value="구매완료">구매완료</option>
            <option value="VIP">👑 특별한 고객</option>
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
        {/* P0-6: 출처 필터 */}
        <div className="relative">
          <select
            value={filterSourceType}
            onChange={(e) => setFilterSourceType(e.target.value)}
            className={`pl-3 pr-8 py-2 border rounded-lg text-sm appearance-none bg-white focus:outline-none ${filterSourceType ? "border-blue-400 text-blue-700 font-medium" : "border-gray-200 focus:border-gold-500"}`}
          >
            <option value="">출처 전체</option>
            {Object.entries(SOURCE_TYPE_LABELS).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

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

      {/* P0-6: 출처별 필터 칩 (50대 친화 - 큰 폰트) */}
      <div className="flex gap-2 flex-wrap px-0 pb-3">
        {Object.entries(SOURCE_TYPE_LABELS).map(([key, { icon, label, color }]) => (
          <button
            key={key}
            onClick={() => setFilterSourceType(filterSourceType === key ? "" : key)}
            className={`text-sm font-medium px-3.5 py-2 rounded-full transition-all ${
              filterSourceType === key
                ? `${color} font-bold shadow-md ring-2 ring-offset-1`
                : `${color} hover:shadow-sm`
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* 담당자별 통계 바 (50대 친화) */}
      {assignStats.length > 0 && (
        <div className="flex gap-2 flex-wrap px-0 pb-3">
          {assignStats.filter(s => s.count > 0).map((s) => (
            <button key={s.userId} onClick={() => setFilterAssignedTo(s.userId === filterAssignedTo ? "" : s.userId)}
              className={`text-sm font-medium px-3.5 py-2 rounded-full transition-all ${filterAssignedTo === s.userId ? "bg-purple-600 text-white shadow-md ring-2 ring-purple-200" : "bg-gray-100 text-gray-700 hover:bg-purple-100"}`}>
              {s.displayName} <span className="font-bold text-base">{s.count}</span>
            </button>
          ))}
          {unassignedCount > 0 && (
            <button onClick={() => setFilterAssignedTo(filterAssignedTo === "unassigned" ? "" : "unassigned")}
              className={`text-sm font-medium px-3.5 py-2 rounded-full transition-all ${filterAssignedTo === "unassigned" ? "bg-red-600 text-white shadow-md ring-2 ring-red-200" : "bg-red-50 text-red-700 hover:bg-red-100"}`}>
              미배정 <span className="font-bold text-base">{unassignedCount}</span>
            </button>
          )}
        </div>
      )}

      {/* 태그 칩 필터 (50대 친화) */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 px-0 pb-3">
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTags(prev =>
                prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
              )}
              className={`px-3.5 py-2 rounded-full text-sm font-medium transition-all ${
                selectedTags.includes(tag)
                  ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-blue-100'
              }`}
            >
              #{tag}
            </button>
          ))}
          {selectedTags.length > 0 && (
            <button
              onClick={() => setSelectedTags([])}
              className="px-3 py-2 rounded-full text-sm text-gray-600 font-medium hover:text-gray-800 hover:bg-gray-50"
            >
              🔄 초기화
            </button>
          )}
        </div>
      )}

      {/* L5: Self-projection — 성공 고객 사례 카드 */}
      {total > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 mb-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold text-green-800 mb-1">
                ✅ 성공한 고객들의 패턴
              </p>
              <p className="text-sm text-green-700 mb-2.5">
                구매 완료로 이어진 검증된 프로세스
              </p>
              <div className="flex gap-3 flex-wrap">
                <div className="text-sm bg-white rounded-lg px-2.5 py-1.5 border border-green-200">
                  <span className="text-green-700 font-bold">72시간</span>
                  <span className="text-green-600"> 내 접근</span>
                </div>
                <div className="text-sm bg-white rounded-lg px-2.5 py-1.5 border border-green-200">
                  <span className="text-green-700 font-bold">3회 이상</span>
                  <span className="text-green-600"> 콜</span>
                </div>
                <div className="text-sm bg-white rounded-lg px-2.5 py-1.5 border border-green-200">
                  <span className="text-green-700 font-bold">개인화</span>
                  <span className="text-green-600"> 메시지</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-green-600">+45%</p>
              <p className="text-sm text-green-600">전환율 향상</p>
            </div>
          </div>
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
                onClick={() => openSlidePanel(c.id)}
                disabled={slidePanelLoadingId === c.id}
                className="w-full text-left flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-amber-100 hover:border-amber-300 hover:shadow-sm transition-all text-sm disabled:opacity-60"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{c.name}</span>
                  {(c.leadScore ?? 0) >= 70 && (
                    <span className="text-sm bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold">🔥 HOT</span>
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
                  <span className="text-sm text-amber-600">{formatDaysSince(c.lastContactedAt ?? null)}</span>
                  <span className="text-sm text-gray-600">{c.leadScore ?? 0}점</span>
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
            배정 ({contacts.filter((c) => (c.groups ?? []).length === 0).length}명)
          </button>
        </div>
      )}

      {/* 고객 목록 */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={`skeleton-${i}`} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <p className="text-4xl mb-3">👥</p>
          <p className="font-medium">{selectedTags.length > 0 ? '해당 태그를 보유한 고객이 없습니다' : '고객이 없습니다'}</p>
          <p className="text-sm mt-1">{selectedTags.length > 0 ? '다른 태그를 선택해보세요.' : '위 버튼으로 고객을 추가해보세요.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* 전체선택 행 */}
          {contacts.length > 0 && (
            <div className="flex items-center gap-2 px-2 pb-1">
              <input
                type="checkbox"
                checked={selectedIds.size === contacts.length && contacts.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded cursor-pointer accent-purple-600"
              />
              <span className="text-sm text-gray-600">
                {selectedIds.size > 0 ? `${selectedIds.size}명 선택됨` : "전체 선택"}
              </span>
            </div>
          )}
          {contacts.map((c) => {
            const typeInfo = TYPE_LABELS[c.type] ?? { label: c.type, color: "bg-gray-100 text-gray-600" };
            const tierInfo = getLeadTier(c.leadScore ?? 0);
            const isQuickCallOpen = quickCallId === c.id;
            const isSelected = selectedIds.has(c.id);
                    const inquiryTrackingSummary = formatInquiryTrackingSummary(c.surveyData?.inquiryTracking);
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
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => openSlidePanel(c.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openSlidePanel(c.id); } }}
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                  aria-label={`${c.name} 고객 상세 보기`}
                >
                  {/* 아바타 */}
                  <div className="w-10 h-10 rounded-full bg-navy-900 text-white flex items-center justify-center text-sm font-bold shrink-0">
                    {c.name?.[0] || '?'}
                  </div>

                  {/* 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-base text-gray-900">{c.name}</span>
                      {/* 리드 스코어 뱃지 — HOT만 강조, WARM/COLD는 서브로 */}
                      {c.type === "LEAD" && (
                        <span className={`text-base px-2 py-1 rounded-full font-bold ${tierInfo.color}`}>
                          {tierInfo.label}
                        </span>
                      )}
                      <span className={`text-base px-2.5 py-1 rounded-full font-bold ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                      {(c.groups ?? []).slice(0, 2).map((g) => (
                        <span
                          key={g.group.id}
                          className="text-sm px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 font-medium"
                        >
                          {g.group.name}
                        </span>
                      ))}
                    </div>
                    {/* 그룹 유입일 + 일차 (filterGroupId 활성화 시) */}
                    {filterGroupId && (
                      (() => {
                        const filtered = (c.groups ?? []).find(g => g.groupId === filterGroupId);
                        if (!filtered || !filtered.addedAt) return null;
                        const addedDate = new Date(filtered.addedAt);
                        const now = new Date();
                        const daysSince = Math.floor((now.getTime() - addedDate.getTime()) / (24 * 60 * 60 * 1000));
                        return (
                          <div className="text-sm text-gray-600 mt-1.5 flex items-center gap-3">
                            <span>그룹유입일: {addedDate.getFullYear()}. {String(addedDate.getMonth() + 1).padStart(2, '0')}. {String(addedDate.getDate()).padStart(2, '0')}.</span>
                            <span className="font-semibold text-navy-700">일차: {daysSince}</span>
                          </div>
                        );
                      })()
                    )}
                    <div className="text-base text-gray-600 mt-1 flex items-center gap-4 flex-wrap font-medium">
                      <span>{c.phone}</span>
                      {c.cruiseInterest && <span className="text-gold-600 font-bold">{c.cruiseInterest}</span>}
                      {(c._count?.callLogs ?? 0) > 0 && (
                        <span className="flex items-center gap-1 font-bold">
                          <Phone className="w-4 h-4" /> {c._count?.callLogs ?? 0}회
                        </span>
                      )}
                      {/* D-day 뱃지 */}
                      {(() => {
                        const dday = getDDay(c.departureDate ?? null);
                        if (!dday) return null;
                        return (
                          <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${dday.urgent ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                            ✈️ {dday.label}
                          </span>
                        );
                      })()}
                    </div>

                    {/* 출처 정보 */}
                    {(c.sourceType || c.createdAt || c.sharedByName) && (
                      <div className="text-sm text-gray-600 mt-2 flex items-center gap-2 flex-wrap">
                        {c.createdAt && <span className="text-gray-600">신청: {formatCreatedAt(c.createdAt)}</span>}
                        {activeTab === 'ADMIN_ONLY' && (
                          // 관리자전용 탭: 출처 강조 표시
                          (() => {
                            let label = '기타 유입';
                            let icon = '❓';
                            if (c.sourceType === 'user') {
                              label = 'B2C 유입';
                              icon = '🌐';
                            } else if (c.sourceType === 'inquiry') {
                              label = 'B2B 유입';
                              icon = '🏢';
                            } else if (!c.sourceType || c.sourceType === 'UNKNOWN') {
                              label = '관리자 직입';
                              icon = '👤';
                            }
                            return (
                              <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">
                                {icon} {label}
                              </span>
                            );
                          })()
                        )}
                        {activeTab === 'SHARED' && c.sourceType && (
                          <>
                            <span className={`px-2 py-0.5 rounded-full ${SOURCE_TYPE_LABELS[c.sourceType]?.color || "bg-gray-100 text-gray-600"}`}>
                              {SOURCE_TYPE_LABELS[c.sourceType]?.icon} {getSourceLabel(c)}
                            </span>
                            {c.affiliateManagerName && <span className="text-gray-600">본사: {c.affiliateManagerName}</span>}
                            {c.affiliateAgentName && <span className="text-gray-600">대리점장: {c.affiliateAgentName}</span>}
                            {c.inquiryProductCode && <span className="text-gray-600">상품: {c.inquiryProductCode}</span>}
                          </>
                        )}
                        {/* Team-A: 공유 출처 표시 (공유 탭에서만) */}
                        {activeTab === 'SHARED' && c.sharedByName && (
                          <span className="px-2.5 py-0.5 rounded-lg bg-purple-100 text-purple-700 font-medium text-sm border border-purple-200">
                            👥 {c.sharedByName}가 공유
                          </span>
                        )}
                      </div>
                    )}
                    {inquiryTrackingSummary && (
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">추적</span>
                        <span>{inquiryTrackingSummary}</span>
                      </div>
                    )}
                    {/* 태그 칩 */}
                    {(c.tags ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {(c.tags ?? []).slice(0, 5).map((tag) => (
                          <span key={tag} className="text-sm bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">#{tag}</span>
                        ))}
                        {(c.tags ?? []).length > 5 && (
                          <span className="text-sm text-gray-600">+{(c.tags ?? []).length - 5}</span>
                        )}
                      </div>
                    )}
                    {/* L5: Self-projection — 유사 고객 지표 */}
                    {c.type === "CUSTOMER" && (
                      <div className="flex items-center gap-1 mt-1.5 text-sm text-green-700 font-medium">
                        <span className="text-green-600">👥</span>
                        <span>성공 사례 보유</span>
                      </div>
                    )}
                    {/* 빠른 그룹 배정 */}
                    <div className="flex items-center gap-2 mt-2" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                      {groups.length > 0 && (
                        <select
                          className="text-sm border border-gray-200 rounded px-1.5 py-1 max-w-[180px] bg-white focus:outline-none"
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
                        className="flex items-center gap-0.5 text-sm text-navy-700 hover:text-navy-900 font-medium"
                      >
                        <Plus className="w-3 h-3" /> 그룹 추가
                      </button>
                      {assigning === c.id && <span className="text-sm text-gray-600">배정 중...</span>}
                    </div>
                  </div>

                  {/* 전달됨 뱃지 + 회수 버튼 */}
                  {c.lastTransferredTo && (
                    <div className="flex flex-col items-end gap-1 shrink-0 ml-1">
                      <div className="flex items-center gap-1 bg-purple-50 border border-purple-200 rounded-lg px-2 py-1">
                        <span className="text-sm text-purple-500">→</span>
                        <div className="text-right">
                          <p className="text-sm font-medium text-purple-700 leading-tight">{c.lastTransferredTo.name}</p>
                          <p className="text-[10px] text-purple-400 leading-tight">{c.lastTransferredTo.orgName}</p>
                        </div>
                      </div>
                      {c.lastTransferredTo.canRecall && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRecall(c.id, c.lastTransferredTo?.logId ?? '');
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
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.location.href = `tel:${c.phone}`;
                      }}
                      className="p-2 rounded-lg hover:bg-blue-50 text-blue-600"
                      aria-label={`전화 걸기: ${c.name}`}
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
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
                </div>{/* end role=button (행 클릭 → 슬라이드 패널) */}
                </div>{/* end flex items-center gap-3 */}

                {/* 퀵 콜 기록 인라인 폼 */}
                {isQuickCallOpen && (
                  <div className="px-4 pb-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <span className="text-sm text-gray-500 shrink-0">콜 결과:</span>
                    {QUICK_CALL_OPTIONS.map((opt) => (
                      <button
                        key={opt.result}
                        type="button"
                        disabled={quickCallLoading}
                        onClick={() => handleQuickCall(c.id, opt.result)}
                        className={`flex items-center gap-1 text-sm px-2.5 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${opt.color}`}
                      >
                        {opt.icon}
                        {opt.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => { setQuickCallId(null); setQuickCallError(null); }}
                      className="text-sm text-gray-600 hover:text-gray-600 ml-1"
                    >
                      취소
                    </button>
                    {quickCallLoading && <span className="text-sm text-gray-600">저장 중...</span>}
                    {quickCallError && <span className="text-sm text-red-500">{quickCallError}</span>}
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
              <button onClick={() => setShowShareModal(false)} className="text-gray-600 hover:text-gray-600">×</button>
            </div>

            {/* 연관 검색 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
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
              const searchQ = shareSearch.trim().toLowerCase();
              const filtered = shareSections.map(sec => ({
                ...sec,
                members: sec.members.filter(m =>
                  !searchQ ||
                  (m.displayName ?? "").toLowerCase().includes(searchQ) ||
                  m.loginId.toLowerCase().includes(searchQ) ||
                  m.orgName.toLowerCase().includes(searchQ)
                ),
              })).filter(sec => sec.members.length > 0);
              return (
                <>
                  {sel && (
                    <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-xl px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-purple-200 text-purple-800 flex items-center justify-center text-sm font-bold shrink-0">
                          {(sel.displayName ?? sel.loginId)[0]}
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-purple-800">{sel.displayName ?? sel.loginId}</span>
                          <span className="text-sm text-purple-400 ml-1.5">{sel.loginId}</span>
                          <span className="text-sm text-purple-400 ml-1.5">· {sel.orgName}</span>
                        </div>
                      </div>
                      <button onClick={() => setShareTarget("")} className="text-purple-400 hover:text-purple-600 text-xl leading-none">×</button>
                    </div>
                  )}
                  {(!shareTarget || shareSearch) && (
                    <div className="space-y-1 max-h-56 overflow-y-auto">
                      {filtered.length === 0 ? (
                        <p className="text-sm text-gray-600 text-center py-6">검색 결과 없음</p>
                      ) : filtered.map((section) => (
                        <details key={section.label} open>
                          <summary className="flex items-center justify-between px-2 py-1.5 cursor-pointer text-sm font-semibold text-gray-500 hover:text-gray-700 select-none list-none">
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
                                <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold shrink-0">
                                  {(m.displayName ?? m.loginId)[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{m.displayName ?? m.loginId}</p>
                                  <p className="text-sm text-gray-600 truncate">{m.loginId} · {m.orgName}</p>
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
        <Suspense fallback={<div className="fixed inset-0 bg-black/50 z-50" />}>
          <TagBlastModal
            tags={selectedTags}
            onClose={() => setShowTagBlast(false)}
          />
        </Suspense>
      )}

      {/* GroupBlast 모달 */}
      {showGroupBlast && filterGroupId && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/50 z-50" />}>
          <GroupBlastModal
            groupId={filterGroupId}
            groupName={groups.find(g => g.id === filterGroupId)?.name ?? ""}
            onClose={() => setShowGroupBlast(false)}
          />
        </Suspense>
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

      {/* 삭제 확인 다이얼로그 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <X className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-navy-900">고객 삭제</h2>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              선택한 <span className="font-bold text-red-600">{selectedIds.size}명</span>의 고객을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
                취소
              </button>
              <button onClick={handleDeleteSelected} disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 disabled:opacity-50">
                {deleting ? "삭제 중..." : "삭제하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 고객 상세 슬라이드 패널 (행 클릭 시) */}
      {slidePanelOpen && (
        <Suspense fallback={null}>
          <ContactSlidePanel
            contact={slidePanelContact}
            open={slidePanelOpen}
            onClose={() => {
              setSlidePanelOpen(false);
              if (closePanelTimerRef.current) clearTimeout(closePanelTimerRef.current);
              closePanelTimerRef.current = setTimeout(() => setSlidePanelContact(null), 400);
            }}
            onRefresh={(updated) => {
              if (updated) {
                // 패널의 FullContact 일부 → 목록 행(Contact)에 맞는 필드만 병합
                setContacts(prev => prev.map(c => {
                  if (c.id !== updated.id) return c;
                  const patch: Partial<Contact> = {};
                  if (updated.type !== undefined) patch.type = updated.type;
                  if (updated.tags !== undefined) patch.tags = updated.tags;
                  if (updated.leadScore !== undefined) patch.leadScore = updated.leadScore;
                  if (updated.lastContactedAt !== undefined) patch.lastContactedAt = updated.lastContactedAt;
                  if (updated.cruiseInterest !== undefined) patch.cruiseInterest = updated.cruiseInterest;
                  if (updated.departureDate !== undefined) patch.departureDate = updated.departureDate;
                  if (updated.groups !== undefined) {
                    // Groups updated — fetch fresh data instead of local state update
                    fetchContacts();
                  }
                  if (updated.callLogs !== undefined) {
                    patch._count = { ...c._count, callLogs: updated.callLogs.length };
                  }
                  return { ...c, ...patch };
                }));
              } else {
                fetchContacts(); // 목록 전체 새로고침
              }
            }}
          />
        </Suspense>
      )}
    </div>
  );
}


