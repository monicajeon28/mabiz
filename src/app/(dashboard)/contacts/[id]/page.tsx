"use client";

import { useState, useEffect, useMemo, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft, Phone, MessageSquare,
  Plus, Clock, FileText, Star, GitBranch, Calendar, Send, AlarmClock,
  Share2, Building2, X, ChevronDown, Trash2, Copy, Check, CloudUpload, Search, FileDown
} from "lucide-react";
import { logger } from "@/lib/logger";
import { useToast } from "@/lib/api/use-toast";
import ContactInfoPanel from "./ContactInfoPanel";
import ContactCallTab from "./ContactCallTab";
import ContactMemoTab from "./ContactMemoTab";
import ContactGroupTab from "./ContactGroupTab";
import ContactSmsTab from "./ContactSmsTab";
import ContactAffiliateCard from "./ContactAffiliateCard";
import ContactRiskPanel from "./ContactRiskPanel";
import { SignupHistoryTab } from "./SignupHistoryTab";
import { FunnelSetupPanel } from "./FunnelSetupPanel";
import { getAllObjectionIds, getObjectionData } from "@/lib/objections/validation";
import objectionsData from "@/../TRACK_A_OBJECTIONS.json";
import { Contact, CallLog, Memo } from "@/types/contact";
import { CallForm } from "@/types/call-form";
import type { ObjectionData } from "@/lib/objections/validation";
import { SendDbResponse } from "@/types/api";
import { useContactOperations, EMPTY_CALL_FORM } from "./use-contact-operations";

type Group = {
  id: string;
  name: string;
  funnelId?: string | null;
};

// 크루즈 여행사 특화 추천 태그
const SUGGESTED_TAGS = [
  "지중해", "알래스카", "카리브해", "북유럽", "동남아", "발틱해", "국내출발", "국내근처",
  "커플", "가족", "부모님", "친구여행", "혼자",
  "100만이하", "200만대", "300만이상", "VIP",
  "봄출발", "여름출발", "가을출발", "겨울출발",
  "재구매가능", "지인추천", "고민중", "계약완료",
];

const RESULT_LABELS: Record<string, string> = {
  INTERESTED: "✅ 관심있음", PENDING: "⏳ 보류",
  REJECTED: "❌ 거절", RESCHEDULED: "📅 재콜예약",
};

type TimelineItem = {
  id: string;
  type: "call" | "memo" | "sms";
  createdAt: string;
  summary: string;
  badge?: string;
};

type TransferLog = {
  id: string;
  createdAt: string;
  transferType: string;
  newContactId: string | null;
  transferredBy: string;
  fromOrg: { name: string } | null;
  toOrg:   { name: string } | null;
  toUserName:    string | null;
  toUserOrgName: string | null;
  canRecall: boolean;
};

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router  = useRouter();
  const { toast } = useToast();

  const [contact,       setContact]       = useState<Contact | null>(null);
  const [tab,           setTab]           = useState<"call" | "memo" | "sms">("call");
  const [openSections,  setOpenSections]  = useState<Set<string>>(new Set());
  const [loading,       setLoading]       = useState(true);
  const [smsLogs,       setSmsLogs]       = useState<{ id: string; phone: string; contentPreview: string; status: string; channel: string; sentAt: string }[]>([]);
  const [smsLoading,    setSmsLoading]    = useState(false);
  const [smsPage,       setSmsPage]       = useState(1);
  const [smsHasMore,    setSmsHasMore]    = useState(true);
  // 예약 탭
  type ReservationItem = {
    id: number; status: string; totalPeople: number; cabinType: string | null;
    paymentDate: string | null; paymentMethod: string | null; paymentAmount: number | null;
    agentName: string | null; remarks: string | null; passportStatus: string; pnrStatus: string;
    createdAt: string;
    trip: {
      id: number; cruiseName: string | null; shipName: string; productCode: string;
      startDate: string | null; endDate: string | null; nights: number; status: string;
      departureDate: string; reservationCode: string | null;
    };
  };
  const [reservations, setReservations] = useState<ReservationItem[]>([]);
  const [reservationLoading, setReservationLoading] = useState(false);
  const [reservationLoaded, setReservationLoaded] = useState(false);

  // WO-22: 즉시 SMS 발송 모달
  const [showSmsModal,  setShowSmsModal]  = useState(false);
  const [smsMsg,        setSmsMsg]        = useState("");
  const [sending,       setSending]       = useState(false);
  const [sendResult,    setSendResult]    = useState("");
  const smsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // WO-23: 예약 발송 모달
  const [showSchedModal, setShowSchedModal] = useState(false);
  const schedTextareaRef = useRef<HTMLTextAreaElement>(null);

  // WO-28: DB 전달 모달
  const [showSendDb,    setShowSendDb]    = useState(false);
  const [sendDbMode,    setSendDbMode]    = useState<"org" | "agent">("agent");
  const [orgs,          setOrgs]          = useState<{ id: string; name: string }[]>([]);
  const [dbSections,    setDbSections]    = useState<{ label: string; members: { id: string; displayName: string | null; loginId: string; orgName: string }[] }[]>([]);
  const [myDbRole,      setMyDbRole]      = useState<string>("");
  const [dbSearch,      setDbSearch]      = useState("");
  const [sendDbTarget,  setSendDbTarget]  = useState("");
  const [sendingDb,     setSendingDb]     = useState(false);
  const [sendDbResult,  setSendDbResult]  = useState("");
  const [schedMsg,       setSchedMsg]       = useState("");
  const [schedAt,        setSchedAt]        = useState("");
  const [scheduling,     setScheduling]     = useState(false);
  const [schedResult,    setSchedResult]    = useState("");

  // 콜 기록 폼
  const [showCallForm, setShowCallForm]   = useState(false);
  const [callForm, setCallForm]           = useState<CallForm>({ ...EMPTY_CALL_FORM });
  const [selectedObjectionModal, setSelectedObjectionModal] = useState<ObjectionData | null>(null);
  const [savingCallLog, setSavingCallLog] = useState(false);

  // 메모 폼
  const [showMemoForm, setShowMemoForm]   = useState(false);
  const [memoText, setMemoText]           = useState("");
  const [savingMemo,    setSavingMemo]    = useState(false);

  // 그룹 배정
  const [allGroups,     setAllGroups]     = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [assigning,     setAssigning]     = useState(false);
  const [assignMsg,     setAssignMsg]     = useState("");

  // WO-25C: 태그
  const [tags,          setTags]          = useState<string[]>([]);
  const [tagInput,      setTagInput]      = useState("");
  const [savingTags,    setSavingTags]    = useState(false);

  // 퍼널 직접 등록
  const [funnels,          setFunnels]          = useState<{ id: string; name: string; funnelType: string }[]>([]);
  const [selectedFunnelId, setSelectedFunnelId] = useState('');
  const [enrollStartDate,  setEnrollStartDate]  = useState('');
  const [enrollSendNow,    setEnrollSendNow]    = useState(false);
  const [enrolling,        setEnrolling]        = useState(false);
  const [enrollError,      setEnrollError]      = useState('');

  // 이관 이력
  const [transferLogs,    setTransferLogs]    = useState<TransferLog[]>([]);
  const [loadingTransfer, setLoadingTransfer] = useState(false);

  // 콜 기록 accordion
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // 콜 기록 복사 피드백
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);

  // 이름 인라인 편집
  const [editingName, setEditingName] = useState(false);
  const [nameInput,   setNameInput]   = useState("");

  // [S-002] CSRF 토큰 (DB 전달 보안)
  const [csrfToken, setCsrfToken] = useState<string>("");

  // 이 고객 Drive 백업
  const [backingContact, setBackingContact] = useState(false);
  const [contactBackupMsg, setContactBackupMsg] = useState("");

  // 콜 기록 구글 드라이브 백업
  const [backing, setBacking] = useState(false);
  const [backupResult, setBackupResult] = useState<{ url: string; count: number } | null>(null);

  // 출발일 + 상품명
  const [showDeptForm,  setShowDeptForm]  = useState(false);
  const [deptForm, setDeptForm]           = useState({ departureDate: "", productName: "", bookingRef: "" });
  const [savingDept,    setSavingDept]    = useState(false);

  // 인라인 필드 편집 (상태, 관심 크루즈)
  const [savingField, setSavingField]     = useState<string | null>(null);

  const saveField = async (field: string, value: string | null) => {
    setSavingField(field);
    const res = await fetch(`/api/contacts/${id}`, {
      method: "PATCH",
      credentials: 'include',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    const data = await res.json();
    if (data.ok) setContact((c) => c ? { ...c, [field]: value } : c);
    setSavingField(null);
  };

  const saveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === contact?.name) { setEditingName(false); return; }
    await saveField("name", trimmed);
    setEditingName(false);
  };

  useEffect(() => {
    const ctrl = new AbortController();
    const { signal } = ctrl;
    const fetchContact = fetch(`/api/contacts/${id}`, { signal, credentials: 'include' }).catch(() => null);
    const fetchGroups = fetch("/api/groups", { signal, credentials: 'include' }).catch(() => null);
    const fetchFunnels = fetch("/api/funnels", { signal, credentials: 'include' }).catch(() => null);
    Promise.allSettled([fetchContact, fetchGroups, fetchFunnels])
      .then((results) => {
        if (signal.aborted) return;
        // Contact 필수, Funnels/Groups는 선택적
        const [c, g, f] = results;

        if (c.status === 'fulfilled' && c.value instanceof Response) {
          c.value.json().then(contactData => {
            if (contactData.ok) {
              setContact(contactData.contact);
              setTags(contactData.contact.tags ?? []);
              if (contactData.contact.departureDate) {
                setDeptForm({
                  departureDate: contactData.contact.departureDate.split("T")[0],
                  productName:   contactData.contact.productName ?? "",
                  bookingRef:    contactData.contact.bookingRef  ?? "",
                });
              }
            }
          }).catch(err => {
            logger.error('[contactData.json failed]', { err });
          });
        } else if (c.status === 'rejected') {
          logger.error('[fetchContact failed]', { err: c.reason });
        }

        // Groups는 실패해도 UI 계속 표시
        if (g.status === 'fulfilled' && g.value instanceof Response) {
          g.value.json().then(groupsData => {
            if (groupsData.ok) setAllGroups(groupsData.groups);
          }).catch(err => {
            logger.error('[groupsData.json failed]', { err });
          });
        }

        // Funnels도 실패해도 UI 계속 표시
        if (f.status === 'fulfilled' && f.value instanceof Response) {
          f.value.json().then(funnelsData => {
            if (funnelsData.ok) setFunnels(funnelsData.funnels ?? []);
          }).catch(err => {
            logger.error('[funnelsData.json failed]', { err });
          });
        }
      })
      .catch(err => {
        logger.error('[Promise.allSettled failed]', { err });
      })
      .finally(() => { if (!signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [id]);

  useEffect(() => {
    if (!contact?.id) return;
    const ctrl = new AbortController();
    setLoadingTransfer(true);
    fetch(`/api/contacts/${contact.id}/transfer-logs`, { signal: ctrl.signal, credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.ok) setTransferLogs(d.logs ?? []); })
      .catch(err => {
        if (err instanceof Error && err.name === 'AbortError') return;
        logger.error('[transfer-logs]', { err });
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoadingTransfer(false); });
    return () => ctrl.abort();
  }, [contact?.id]);

  useEffect(() => {
    if (!copiedLogId) return;
    const timer = setTimeout(() => setCopiedLogId(null), 1500);
    return () => clearTimeout(timer);
  }, [copiedLogId]);

  // [S-002] CSRF 토큰 초기화 (페이지 로드 시 한 번)
  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/csrf-token', { signal: ctrl.signal, credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.ok) setCsrfToken(d.token);
      })
      .catch(err => {
        if (err instanceof Error && err.name === 'AbortError') return;
        logger.error('[csrf-token fetch failed]', { err });
      });
    return () => ctrl.abort();
  }, []);

  // [L6] setTimeout cleanup 통합 (메시지 자동 숨김)
  useEffect(() => {
    if (!contactBackupMsg) return;
    const timer = setTimeout(() => setContactBackupMsg(""), 3000);
    return () => clearTimeout(timer);
  }, [contactBackupMsg]);

  useEffect(() => {
    if (!sendResult) return;
    const timer = setTimeout(() => setSendResult(""), 3000);
    return () => clearTimeout(timer);
  }, [sendResult]);

  useEffect(() => {
    if (!schedResult) return;
    const timer = setTimeout(() => setSchedResult(""), 3000);
    return () => clearTimeout(timer);
  }, [schedResult]);

  useEffect(() => {
    if (!assignMsg) return;
    const timer = setTimeout(() => setAssignMsg(""), 3000);
    return () => clearTimeout(timer);
  }, [assignMsg]);

  // useContactOperations 훅으로 공통 CRUD 위임
  const { addCallLog, deleteCallLog, deleteAllCallLogs, copyCallLog, backupCallLogs, addMemo, deleteMemo, deleteAllMemos } = useContactOperations({
    contactId: id,
    savingCallLog, setSavingCallLog,
    callForm, setCallForm,
    setShowCallForm,
    setSelectedObjectionModal,
    expandedLogId, setExpandedLogId,
    setCopiedLogId,
    savingMemo, setSavingMemo,
    memoText, setMemoText,
    setShowMemoForm,
    setBacking,
    setBackupResult,
    getCurrentCallLogs: () => contact?.callLogs ?? [],
    getCurrentMemos: () => contact?.memos ?? [],
    onCallLogAdded: (log) => setContact(c => c ? { ...c, callLogs: [log, ...c.callLogs] } : c),
    onCallLogDeleted: (logId) => setContact(c => c ? { ...c, callLogs: c.callLogs.filter(l => l.id !== logId) } : c),
    onAllCallLogsDeleted: () => setContact(c => c ? { ...c, callLogs: [] } : c),
    onMemoAdded: (memo) => setContact(c => c ? { ...c, memos: [memo, ...c.memos] } : c),
    onMemoDeleted: (memoId) => setContact(c => c ? { ...c, memos: c.memos.filter(m => m.id !== memoId) } : c),
    onAllMemosDeleted: () => setContact(c => c ? { ...c, memos: [] } : c),
    autoBackupOnAdd: false,
  });

  // 그룹 배정 → 퍼널 자동 시작
  const assignGroup = async () => {
    if (!selectedGroup) return;
    setAssigning(true);
    setAssignMsg("");
    try {
      const res  = await fetch(`/api/groups/${selectedGroup}/members`, {
        method: "POST",
        credentials: 'include',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: [id] }),
      });
      const data = await res.json();
      if (data.ok) {
        const g    = allGroups.find((g) => g.id === selectedGroup);
        const msg  = g?.funnelId
          ? `✅ "${g.name}" 그룹 배정 + 퍼널 자동 시작!`
          : `✅ "${g?.name}" 그룹 배정 완료`;
        setAssignMsg(msg);
        setContact((c) => c ? { ...c, groups: [...c.groups, { group: { id: g!.id, name: g!.name } }] } : c);
        setSelectedGroup("");
      } else {
        toast({
          title: "그룹 배정 실패",
          description: data.message ?? "그룹 배정에 실패했습니다.",
          variant: "destructive",
        });
        logger.error("[assignGroup] API error", { message: data.message, groupId: selectedGroup });
      }
    } catch (err) {
      toast({
        title: "네트워크 오류",
        description: "그룹 배정 중 오류가 발생했습니다.",
        variant: "destructive",
      });
      logger.error("[assignGroup] fetch error", { err, groupId: selectedGroup });
    } finally {
      setAssigning(false);
    }
  };

  // WO-28: DB 전달 모달 열기 (대상 목록 로드)
  const openSendDb = async () => {
    setShowSendDb(true);
    setSendDbResult("");
    setSendDbTarget("");
    setDbSearch("");
    const [orgRes, agentRes] = await Promise.all([
      fetch("/api/org/list", { credentials: 'include' }).then((r) => r.json()),
      fetch("/api/org/agents", { credentials: 'include' }).then((r) => r.json()),
    ]);
    if (orgRes.ok)   setOrgs(orgRes.orgs ?? []);
    if (agentRes.ok) {
      setDbSections(agentRes.sections ?? []);
      setMyDbRole(agentRes.myRole ?? "");
    }
  };

  const sendDb = async () => {
    if (!sendDbTarget) return;
    setSendingDb(true);
    const res = await fetch(`/api/contacts/${id}/send-db`, {
      method: "POST",
      credentials: 'include',
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken || "",
      },
      body: JSON.stringify({ targetUserId: sendDbTarget }),
    });
    const data = await res.json();
    setSendingDb(false);
    if (data.ok) {
      setSendDbResult(`✅ ${data.agentName ?? "대상"}에게 전달 완료`);
      setSendDbTarget("");
      fetch(`/api/contacts/${id}/transfer-logs`, { credentials: 'include' })
        .then(r => r.json())
        .then(d => {
          if (d.ok) setTransferLogs(d.logs ?? []);
          else {
            toast({ title: '오류', description: '전달 이력 새로고침 실패', variant: 'destructive' });
          }
        })
        .catch(err => {
          logger.error('[sendDb transfer-logs refresh]', { err });
          toast({ title: '오류', description: '전달 이력 새로고침 실패', variant: 'destructive' });
        });
      setShowSendDb(false);
    } else {
      setSendDbResult(`❌ ${data.message ?? "전달 실패"}`);
    }
  };

  const handleContactBackup = async () => {
    setBackingContact(true);
    setContactBackupMsg("");
    try {
      const res  = await fetch(`/api/backup/contact/${id}`, { method: "POST", credentials: 'include' });
      const data = await res.json();
      if (data.ok) {
        setContactBackupMsg("✅ Drive에 백업 완료");
      } else {
        setContactBackupMsg("❌ 백업 실패");
      }
    } catch {
      setContactBackupMsg("❌ 오류");
    } finally {
      setBackingContact(false);
    }
  };

  // DB 회수
  const [recalling, setRecalling] = useState(false);
  const handleRecall = async (log: TransferLog) => {
    if (!confirm(`"${log.toUserName ?? log.toUserOrgName ?? "대상"}"에게 전달한 DB를 회수할까요? 상대방이 해당 고객을 볼 수 없게 됩니다.`)) return;
    setRecalling(true);
    try {
      const res = await fetch(`/api/contacts/${id}/recall-db`, {
        method: "POST",
        credentials: 'include',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId: log.id }),
      });
      const data = await res.json();
      if (data.ok) {
        setTransferLogs(prev => prev.filter(l => l.id !== log.id));
      } else {
        toast({ title: '회수 실패', description: data.message ?? '다시 시도해주세요.', variant: 'destructive' });
      }
    } catch {
      toast({ title: '네트워크 오류', description: '잠시 후 다시 시도해주세요.', variant: 'destructive' });
    } finally {
      setRecalling(false);
    }
  };

  // WO-25C: 태그 저장 (낙관적 업데이트 + 롤백)
  const addTag = async (tag: string) => {
    const t = tag.trim();
    if (!t || tags.includes(t)) return;
    const prevTags = tags;
    const newTags = [...tags, t];
    setTags(newTags); // 낙관적 업데이트
    setTagInput("");
    setSavingTags(true);

    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: "PATCH",
        credentials: 'include',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: newTags }),
      });
      const data = await res.json();
      if (!data.ok) {
        setTags(prevTags); // 롤백
        toast({
          title: "오류",
          description: "태그 저장에 실패했습니다.",
          variant: "destructive",
        });
      }
    } catch (err) {
      setTags(prevTags); // 롤백
      logger.error("[addTag] 네트워크 오류", { err });
      toast({
        title: "오류",
        description: "네트워크 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setSavingTags(false);
    }
  };

  const removeTag = async (tag: string) => {
    const prevTags = tags;
    const newTags = tags.filter((tt) => tt !== tag);
    setTags(newTags); // 낙관적 업데이트
    setSavingTags(true);

    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: "PATCH",
        credentials: 'include',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: newTags }),
      });
      const data = await res.json();
      if (!data.ok) {
        setTags(prevTags); // 롤백
        toast({
          title: "오류",
          description: "태그 삭제에 실패했습니다.",
          variant: "destructive",
        });
      }
    } catch (err) {
      setTags(prevTags); // 롤백
      logger.error("[removeTag] 네트워크 오류", { err });
      toast({
        title: "오류",
        description: "네트워크 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setSavingTags(false);
    }
  };

  // A-001: 모달 포커스 관리 (L9 호환성: SSR 안전)
  const openSmsModal = () => {
    if (typeof document !== 'undefined') {
      previousFocusRef.current = document.activeElement as HTMLElement;
    }
    setShowSmsModal(true);
  };

  const closeSmsModal = () => {
    setShowSmsModal(false);
    setSendResult("");
    previousFocusRef.current?.focus();
  };

  const openSchedModal = () => {
    if (typeof document !== 'undefined') {
      previousFocusRef.current = document.activeElement as HTMLElement;
    }
    setShowSchedModal(true);
  };

  const closeSchedModal = () => {
    setShowSchedModal(false);
    setSchedResult("");
    previousFocusRef.current?.focus();
  };

  // WO-22: 즉시 SMS 발송
  const sendSmsNow = async () => {
    if (!smsMsg.trim()) return;
    setSending(true);
    setSendResult("");
    const res  = await fetch(`/api/contacts/${id}/sms`, {
      method: "POST",
      credentials: 'include',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: smsMsg }),
    });
    const data = await res.json();
    setSending(false);
    if (data.ok) {
      setSendResult("✅ 발송 완료!");
      setSmsMsg("");
      // SMS 탭 로그 목록 새로고침 (최신 발송 내역 즉시 반영)
      fetch(`/api/contacts/${id}/sms-logs?limit=20&page=1`, { credentials: 'include' })
        .then(r => r.json())
        .then(d => {
          if (d.ok) {
            setSmsLogs(d.logs ?? []);
            setSmsHasMore(d.hasMore ?? false);
            setSmsPage(1);
          }
        })
        .catch(() => {});
      closeSmsModal();
    } else {
      setSendResult(`❌ ${data.message ?? "발송 실패"}`);
    }
  };

  // WO-23: 예약 발송 등록
  const scheduleSmsSend = async () => {
    if (!schedMsg.trim() || !schedAt) return;
    setScheduling(true);
    setSchedResult("");
    const res  = await fetch("/api/scheduled-sms", {
      method: "POST",
      credentials: 'include',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: id, message: schedMsg, scheduledAt: schedAt }),
    });
    const data = await res.json();
    setScheduling(false);
    if (data.ok) {
      setSchedResult("✅ 예약 완료!");
      setSchedMsg("");
      setSchedAt("");
      closeSchedModal();
    } else {
      setSchedResult(`❌ ${data.message ?? "예약 실패"}`);
    }
  };

  // 출발일 저장
  const saveDeparture = async () => {
    setSavingDept(true);
    const res  = await fetch(`/api/contacts/${id}`, {
      method: "PATCH",
      credentials: 'include',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        departureDate: deptForm.departureDate ? new Date(deptForm.departureDate).toISOString() : null,
        productName:   deptForm.productName   || null,
        bookingRef:    deptForm.bookingRef     || null,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setContact((c) => c ? {
        ...c,
        departureDate: data.contact.departureDate,
        productName:   data.contact.productName,
        bookingRef:    data.contact.bookingRef,
      } : c);
      setShowDeptForm(false);
    }
    setSavingDept(false);
  };

  const enrolledFunnelIds = useMemo(() => {
    return new Set((contact?.vipSequences ?? []).map((s) => s.funnelId));
  }, [contact]);

  if (loading) return (
    <div className="p-6 space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
    </div>
  );
  if (!contact) return <div className="p-6 text-gray-500">고객을 찾을 수 없습니다.</div>;

  const currentGroups: Group[] = contact.groups.map((g) => g.group);
  const availableGroups = allGroups.filter((g) => !currentGroups.some((cg) => cg.id === g.id));

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6">

      {/* WO-28: DB 전달 모달 */}
      {showSendDb && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-purple-500" /> DB 전달
              </h3>
              <button onClick={() => setShowSendDb(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 연관 검색 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                autoFocus
                value={dbSearch}
                onChange={(e) => { setDbSearch(e.target.value); setSendDbTarget(""); }}
                placeholder="이름 / 닉네임 / 아이디 검색..."
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-purple-400"
              />
            </div>

            {/* 선택된 대상 표시 */}
            {sendDbTarget && (() => {
              const sel = dbSections.flatMap(s => s.members).find(m => m.id === sendDbTarget);
              if (!sel) return null;
              return (
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
                  <button onClick={() => setSendDbTarget("")} className="text-purple-400 hover:text-purple-600 text-xl leading-none">×</button>
                </div>
              );
            })()}

            {/* 섹션별 드롭다운 목록 (검색 중이거나 미선택 시 표시) */}
            {(!sendDbTarget || dbSearch) && (() => {
              const q = dbSearch.trim().toLowerCase();
              const filtered = dbSections.map(sec => ({
                ...sec,
                members: sec.members.filter(m =>
                  !q ||
                  (m.displayName ?? "").toLowerCase().includes(q) ||
                  m.loginId.toLowerCase().includes(q) ||
                  m.orgName.toLowerCase().includes(q)
                ),
              })).filter(sec => sec.members.length > 0);
              return (
                <div className="space-y-1 max-h-60 overflow-y-auto">
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
                            onClick={() => { setSendDbTarget(m.id); setDbSearch(""); }}
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
              );
            })()}

            {sendDbResult && (
              <p className={`text-sm font-medium ${sendDbResult.startsWith("✅") ? "text-green-600" : "text-red-500"}`}>
                {sendDbResult}
              </p>
            )}

            <button
              onClick={sendDb}
              disabled={sendingDb || !sendDbTarget}
              className="w-full bg-purple-600 text-white py-2.5 rounded-xl font-medium hover:bg-purple-700 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {sendingDb ? "전달 중..." : <><Share2 className="w-4 h-4" /> 전달하기</>}
            </button>
          </div>
        </div>
      )}

      {/* WO-22: 즉시 SMS 발송 모달 */}
      {showSmsModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Send className="w-4 h-4 text-green-500" /> SMS 즉시 발송
              </h3>
              <button
                onClick={closeSmsModal}
                className="text-gray-400 hover:text-gray-600 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                aria-label="SMS 모달 닫기"
              >×</button>
            </div>
            <p className="text-xs text-gray-500">수신: <strong>{contact?.name}</strong> ({contact?.phone})</p>
            <textarea
              ref={smsTextareaRef}
              value={smsMsg}
              onChange={(e) => setSmsMsg(e.target.value)}
              placeholder="[고객명], [이름] 치환 사용 가능&#10;예: [고객명]님, 안녕하세요! 크루즈닷입니다."
              rows={4}
              autoFocus
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-gold-500 focus:ring-2 focus:ring-green-500"
              aria-label="SMS 메시지 내용"
            />
            <p className="text-xs text-gray-400 text-right">{smsMsg.length}자</p>
            {sendResult && (
              <div className={`rounded-xl p-3 text-sm font-medium ${sendResult.startsWith("✅") ? "text-green-600 bg-green-50" : "text-red-500 bg-red-50"}`}>
                {sendResult}
                {sendResult.includes("SMS 설정") && (
                  <div className="mt-2">
                    <a
                      href="/settings/sms"
                      className="inline-flex items-center gap-1 text-blue-600 underline text-xs font-normal"
                      onClick={() => setShowSmsModal(false)}
                    >
                      → Aligo SMS 설정하러 가기
                    </a>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={sendSmsNow}
              disabled={sending || !smsMsg.trim()}
              className="w-full bg-green-600 text-white py-2.5 rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sending ? "발송 중..." : <><Send className="w-4 h-4" /> 지금 바로 발송</>}
            </button>
          </div>
        </div>
      )}

      {/* WO-23: 예약 발송 모달 */}
      {showSchedModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <AlarmClock className="w-4 h-4 text-orange-500" /> SMS 예약 발송
              </h3>
              <button
                onClick={closeSchedModal}
                className="text-gray-400 hover:text-gray-600 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                aria-label="SMS 예약 모달 닫기"
              >×</button>
            </div>
            <p className="text-xs text-gray-500">수신: <strong>{contact?.name}</strong> ({contact?.phone})</p>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">발송 예정 시각</label>
              <input
                type="datetime-local"
                value={schedAt}
                onChange={(e) => setSchedAt(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-500 focus:ring-2 focus:ring-orange-500"
                aria-label="발송 예정 시각"
              />
            </div>
            <textarea
              ref={schedTextareaRef}
              value={schedMsg}
              onChange={(e) => setSchedMsg(e.target.value)}
              placeholder="[고객명], [이름] 치환 사용 가능"
              rows={4}
              autoFocus
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-gold-500 focus:ring-2 focus:ring-orange-500"
              aria-label="SMS 예약 메시지 내용"
            />
            {schedResult && (
              <p className={`text-sm font-medium ${schedResult.startsWith("✅") ? "text-green-600" : "text-red-500"}`}>
                {schedResult}
              </p>
            )}
            <button
              onClick={scheduleSmsSend}
              disabled={scheduling || !schedMsg.trim() || !schedAt}
              className="w-full bg-orange-500 text-white py-2.5 rounded-xl font-medium hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {scheduling ? "예약 중..." : <><AlarmClock className="w-4 h-4" /> 예약 등록</>}
            </button>
          </div>
        </div>
      )}

      {/* Contact Info Panel */}
      <ContactInfoPanel
        contact={contact}
        editingName={editingName}
        setEditingName={setEditingName}
        nameInput={nameInput}
        setNameInput={setNameInput}
        saveName={saveName}
        backingContact={backingContact}
        handleContactBackup={handleContactBackup}
        openSendDb={openSendDb}
        showSchedModal={showSchedModal}
        openSchedModal={openSchedModal}
        closeSchedModal={closeSchedModal}
        showSmsModal={showSmsModal}
        openSmsModal={openSmsModal}
        transferLogs={transferLogs}
        recalling={recalling}
        handleRecall={handleRecall}
        showDeptForm={showDeptForm}
        setShowDeptForm={setShowDeptForm}
        deptForm={deptForm}
        setDeptForm={setDeptForm}
        savingDept={savingDept}
        saveDeparture={saveDeparture}
        savingField={savingField}
        saveField={saveField}
        tags={tags}
        tagInput={tagInput}
        setTagInput={setTagInput}
        addTag={addTag}
        removeTag={removeTag}
        savingTags={savingTags}
        currentGroups={currentGroups}
        SUGGESTED_TAGS={SUGGESTED_TAGS}
      />

      {/* Phase 3.4: 제휴 담당자 정보 (L9 신뢰도 + L10 클로징) */}
      <ContactAffiliateCard contactId={id} />

      {/* Phase 4D: 거래 위험도 (10개 신호 자동 감지) */}
      <ContactRiskPanel contactId={id} />

      {/* 최근 활동 타임라인 */}
      {(() => {
        const items: TimelineItem[] = [
          ...contact.callLogs.map((log): TimelineItem => ({
            id: log.id,
            type: "call",
            createdAt: log.createdAt,
            summary: ((log.result ? (RESULT_LABELS[log.result] ?? log.result) + " " : "") + (log.content ?? "")).slice(0, 30),
            badge: log.result ? (RESULT_LABELS[log.result] ?? log.result) : undefined,
          })),
          ...contact.memos.map((m): TimelineItem => ({
            id: m.id,
            type: "memo",
            createdAt: m.createdAt,
            summary: m.content.slice(0, 30),
          })),
          ...smsLogs.map((s): TimelineItem => ({
            id: s.id,
            type: "sms",
            createdAt: s.sentAt,
            summary: s.contentPreview.slice(0, 30),
            badge: s.status === "SENT" ? "발송완료" : s.status === "BLOCKED" ? "차단" : "실패",
          })),
        ]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5);

        if (items.length === 0) return null;

        return (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-gold-500" />
              최근 활동
            </h3>
            <div className="space-y-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setTab(item.type === "sms" ? "sms" : item.type === "memo" ? "memo" : "call")}
                  className="w-full flex items-start gap-3 text-left hover:bg-gray-50 rounded-lg p-2 transition-colors"
                >
                  <span className="mt-0.5 text-gray-400 shrink-0">
                    {item.type === "call" && <Phone className="w-4 h-4" />}
                    {item.type === "memo" && <FileText className="w-4 h-4" />}
                    {item.type === "sms" && <MessageSquare className="w-4 h-4" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{item.summary || "—"}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(item.createdAt).toLocaleString("ko-KR")}
                    </p>
                  </div>
                  {item.badge && (
                    <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* 3-Tab Navigation */}
      <div className="flex gap-3 border-b border-gray-200 mb-6 overflow-x-auto">
        {[
          { key: "call",  label: `📞 콜기록 (${contact.callLogs.length})` },
          { key: "memo",  label: `📝 메모 (${contact.memos.length})` },
          { key: "sms",   label: "💬 발송내역" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key as typeof tab);
              if (t.key === "sms" && smsLogs.length === 0 && smsHasMore) {
                setSmsLoading(true);
                fetch(`/api/contacts/${contact.id}/sms-logs?limit=20&page=1`, { credentials: 'include' })
                  .then(r => r.json())
                  .then(d => {
                    if (d.ok) {
                      setSmsLogs(d.logs ?? []);
                      setSmsHasMore(d.hasMore ?? false);
                      setSmsPage(1);
                    }
                    setSmsLoading(false);
                  })
                  .catch(err => {
                    logger.error("[ContactDetail] SMS 로그 fetch 실패", { contactId: contact.id, err });
                    setSmsLoading(false);
                  });
              }
            }}
            className={`px-5 py-3 text-base font-bold border-b-2 whitespace-nowrap transition-colors min-h-12 ${
              tab === t.key
                ? "border-gold-500 text-navy-900"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Call Tab */}
      {tab === "call" && (
        <ContactCallTab
          contact={contact}
          contactId={id}
          callForm={callForm}
          setCallForm={setCallForm}
          showCallForm={showCallForm}
          setShowCallForm={setShowCallForm}
          selectedObjectionModal={selectedObjectionModal}
          setSelectedObjectionModal={setSelectedObjectionModal}
          expandedLogId={expandedLogId}
          setExpandedLogId={setExpandedLogId}
          copiedLogId={copiedLogId}
          addCallLog={addCallLog}
          savingCallLog={savingCallLog}
          deleteCallLog={deleteCallLog}
          deleteAllCallLogs={() => deleteAllCallLogs(contact.callLogs.length)}
          copyCallLog={copyCallLog}
        />
      )}

      {/* Memo Tab */}
      {tab === "memo" && (
        <ContactMemoTab
          contact={contact}
          showMemoForm={showMemoForm}
          setShowMemoForm={setShowMemoForm}
          memoText={memoText}
          setMemoText={setMemoText}
          addMemo={addMemo}
          savingMemo={savingMemo}
          deleteMemo={deleteMemo}
          deleteAllMemos={() => deleteAllMemos(contact.memos.length)}
        />
      )}


      {/* SMS Tab */}
      {tab === "sms" && (
        <ContactSmsTab
          smsLogs={smsLogs}
          smsLoading={smsLoading}
          onOpenSmsModal={openSmsModal}
          onOpenSchedModal={openSchedModal}
        />
      )}

      {/* Accordion Sections (그룹/분석/주의신호/신청이력/예약) */}
      <div className="space-y-2">
        {/* Funnel Setup Panel (Russell Brunson) */}
        <FunnelSetupPanel contactId={id} contactName={contact.name} />

        {/* Accordion: 그룹 관리 */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => {
              setOpenSections(prev => {
                const next = new Set(prev);
                if (next.has('groups')) next.delete('groups');
                else next.add('groups');
                return next;
              });
            }}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-purple-500" />
              그룹 관리 ({currentGroups.length})
            </span>
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform ${
                openSections.has('groups') ? 'rotate-180' : ''
              }`}
            />
          </button>
          {openSections.has('groups') && (
            <div className="px-4 py-3 border-t border-gray-100 space-y-2">
              {currentGroups.length === 0 ? (
                <p className="text-xs text-gray-400">배정된 그룹이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {currentGroups.map((g) => (
                    <div key={g.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                      <span className="text-sm text-gray-700">{g.name}</span>
                      {g.funnelId && (
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-600">
                          퍼널 연동
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="pt-2 border-t border-gray-100 space-y-2">
                {availableGroups.length > 0 ? (
                  <>
                    <select
                      value={selectedGroup}
                      onChange={(e) => setSelectedGroup(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-purple-400"
                    >
                      <option value="">+ 그룹 추가</option>
                      {availableGroups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    {assignMsg && (
                      <p className={`text-xs font-medium ${assignMsg.startsWith("✅") ? "text-green-600" : "text-red-500"}`}>
                        {assignMsg}
                      </p>
                    )}
                    <button
                      onClick={assignGroup}
                      disabled={!selectedGroup || assigning}
                      className="w-full px-3 py-2 text-xs font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                    >
                      {assigning ? "배정 중..." : "그룹 배정"}
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-2">추가 가능한 그룹이 없습니다.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Accordion: 심리 분석 (렌즈) */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => {
              setOpenSections(prev => {
                const next = new Set(prev);
                if (next.has('analysis')) next.delete('analysis');
                else next.add('analysis');
                return next;
              });
            }}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-blue-500" />
              심리 분석 (L0-L10)
            </span>
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform ${
                openSections.has('analysis') ? 'rotate-180' : ''
              }`}
            />
          </button>
          {openSections.has('analysis') && (
            <div className="px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">
                Grant Cardone 10가지 심리 렌즈로 고객 성향 분석
              </p>
              <div className="text-xs text-gray-600 space-y-1">
                <p>L0: 부재중 고객 (3-6/6-12/1년+)</p>
                <p>L1: 가격 민감도</p>
                <p>L2: 준비 복잡도</p>
                <p>L3: 경쟁사 언급</p>
                <p>L4-L10: 추가 렌즈 분석 (확장 중)</p>
              </div>
            </div>
          )}
        </div>

        {/* Accordion: 주의 신호 */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => {
              setOpenSections(prev => {
                const next = new Set(prev);
                if (next.has('alerts')) next.delete('alerts');
                else next.add('alerts');
                return next;
              });
            }}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <AlarmClock className="w-4 h-4 text-red-500" />
              주의 신호 (위험도)
            </span>
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform ${
                openSections.has('alerts') ? 'rotate-180' : ''
              }`}
            />
          </button>
          {openSections.has('alerts') && (
            <div className="px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                실시간 위험도 감지 시스템이 자동으로 신호를 추적합니다.
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Risk Score: 아래 📊 위험도 섹션에서 확인하세요.
              </p>
            </div>
          )}
        </div>

        {/* Accordion: 신청 이력 */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => {
              setOpenSections(prev => {
                const next = new Set(prev);
                if (next.has('signup')) next.delete('signup');
                else next.add('signup');
                return next;
              });
            }}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              신청 이력 ({contact.signupCount || 0})
            </span>
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform ${
                openSections.has('signup') ? 'rotate-180' : ''
              }`}
            />
          </button>
          {openSections.has('signup') && (
            <div className="px-4 py-3 border-t border-gray-100">
              <SignupHistoryTab contactId={id} />
            </div>
          )}
        </div>

        {/* Accordion: 예약 정보 */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => {
              setOpenSections(prev => {
                const next = new Set(prev);
                if (next.has('reservations')) next.delete('reservations');
                else next.add('reservations');
                return next;
              });
              if (!reservationLoaded) {
                setReservationLoading(true);
                fetch(`/api/contacts/${contact.id}/reservations`, { credentials: 'include' })
                  .then(r => r.json())
                  .then(d => {
                    if (d.ok) setReservations(d.reservations ?? []);
                    setReservationLoaded(true);
                    setReservationLoading(false);
                  })
                  .catch(err => {
                    logger.error("[ContactDetail] 예약 fetch 실패", { contactId: contact.id, err });
                    setReservationLoading(false);
                  });
              }
            }}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-green-500" />
              예약 정보 ({reservations.length})
            </span>
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform ${
                openSections.has('reservations') ? 'rotate-180' : ''
              }`}
            />
          </button>
          {openSections.has('reservations') && (
            <div className="px-4 py-3 border-t border-gray-100 space-y-3">
              {reservationLoading ? (
                <div className="text-center text-sm text-gray-400 py-4">불러오는 중...</div>
              ) : reservations.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-4">연결된 예약 정보가 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {reservations.map((r) => (
                    <div key={r.id} className="bg-gray-50 rounded-lg p-3 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full font-medium ${
                            r.status === "CONFIRMED"  ? "bg-green-100 text-green-700"  :
                            r.status === "CANCELLED"  ? "bg-red-100 text-red-700"     :
                            r.status === "PENDING"    ? "bg-yellow-100 text-yellow-700" :
                                                        "bg-gray-100 text-gray-500"
                          }`}>
                            {r.status === "CONFIRMED" ? "✅ 예약확정" : r.status === "CANCELLED" ? "❌ 취소됨" : r.status === "PENDING" ? "⏳ 확인중" : r.status}
                          </span>
                          <span className="text-gray-400">예약 #{r.id}</span>
                        </div>
                        <span className="text-gray-400">
                          {new Date(r.createdAt).toLocaleDateString("ko-KR")}
                        </span>
                      </div>
                      <p className="font-semibold text-gray-900">
                        {r.trip.cruiseName ?? r.trip.shipName ?? "크루즈 정보 없음"}
                      </p>
                      {r.trip.reservationCode && (
                        <p className="text-gray-500">예약코드: {r.trip.reservationCode}</p>
                      )}
                      <div className="grid grid-cols-2 gap-2 text-gray-600 border-t border-gray-200 pt-2">
                        {r.trip.startDate && (
                          <div><span className="text-gray-400">출발: </span>
                            {new Date(r.trip.startDate).toLocaleDateString("ko-KR")}
                          </div>
                        )}
                        {r.trip.endDate && (
                          <div><span className="text-gray-400">귀국: </span>
                            {new Date(r.trip.endDate).toLocaleDateString("ko-KR")}
                          </div>
                        )}
                        {r.trip.nights > 0 && (
                          <div><span className="text-gray-400">기간: </span>{r.trip.nights}박</div>
                        )}
                        {r.totalPeople > 0 && (
                          <div><span className="text-gray-400">인원: </span>{r.totalPeople}명</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
