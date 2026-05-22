"use client";

import { useState, useEffect, useMemo, useCallback, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft, Phone, MessageSquare,
  Plus, Clock, FileText, Star, GitBranch, Calendar, Send, AlarmClock,
  Share2, Users, Building2, X, ChevronDown, Trash2, Copy, Check, CloudUpload, Search, FileDown
} from "lucide-react";
import { logger } from "@/lib/logger";
import { useToast } from "@/lib/api/use-toast";
import ContactInfoPanel from "./ContactInfoPanel";
import ContactCallTab from "./ContactCallTab";
import ContactMemoTab from "./ContactMemoTab";
import ContactGroupTab from "./ContactGroupTab";
import ContactSmsTab from "./ContactSmsTab";
import { getAllObjectionIds, getObjectionData } from "@/lib/objections/validation";
import objectionsData from "@/../../TRACK_A_OBJECTIONS.json";
import { Contact, CallLog, Memo } from "@/types/contact";
import { CallForm } from "@/types/call-form";
import { ObjectionData } from "@/types/objection";
import { SendDbResponse } from "@/types/api";

type Group = { id: string; name: string; funnelId?: string | null };

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
  const [tab,           setTab]           = useState<"call" | "memo" | "group" | "sms">("call");
  const [loading,       setLoading]       = useState(true);
  const [smsLogs,       setSmsLogs]       = useState<{ id: string; phone: string; contentPreview: string; status: string; channel: string; sentAt: string }[]>([]);
  const [smsLoading,    setSmsLoading]    = useState(false);
  const [smsPage,       setSmsPage]       = useState(1);
  const [smsHasMore,    setSmsHasMore]    = useState(true);

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
  const [callForm, setCallForm]           = useState<CallForm>({
    content: "",
    result: "INTERESTED",
    convictionScore: "5",
    nextAction: "",
    scheduledAt: "",
    objectionId: "",
    customerReaction: "neutral",
    recovered: false,
    recoveryTime: "",
  });
  const [selectedObjectionModal, setSelectedObjectionModal] = useState<ObjectionData | null>(null);

  // 메모 폼
  const [showMemoForm, setShowMemoForm]   = useState(false);
  const [memoText, setMemoText]           = useState("");

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

  // 콜 기록 삭제
  const deleteCallLog = async (logId: string) => {
    if (!confirm("이 콜 기록을 삭제할까요?")) return;
    const res = await fetch(`/api/contacts/${id}/call-logs?logId=${logId}`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) {
      setContact(c => c ? { ...c, callLogs: c.callLogs.filter(l => l.id !== logId) } : c);
      if (expandedLogId === logId) setExpandedLogId(null);
    }
  };

  const deleteAllCallLogs = async () => {
    if (!confirm(`콜 기록 ${contact?.callLogs.length}건을 전체 삭제할까요? 되돌릴 수 없습니다.`)) return;
    const res = await fetch(`/api/contacts/${id}/call-logs`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) { setContact(c => c ? { ...c, callLogs: [] } : c); setExpandedLogId(null); }
  };

  // 콜 기록 구글 드라이브 백업
  const [backing, setBacking] = useState(false);
  const [backupResult, setBackupResult] = useState<{ url: string; count: number } | null>(null);

  const backupCallLogs = async () => {
    setBacking(true);
    setBackupResult(null);
    try {
      const res = await fetch(`/api/contacts/${id}/call-logs/backup`, { method: "POST" });
      const data = await res.json();
      if (data.ok) setBackupResult({ url: data.viewUrl, count: data.count });
      else alert(data.message ?? "백업 실패");
    } finally {
      setBacking(false);
    }
  };

  // 메모 삭제
  const deleteMemo = async (memoId: string) => {
    if (!confirm("이 메모를 삭제할까요?")) return;
    const res = await fetch(`/api/contacts/${id}/memos?memoId=${memoId}`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) setContact(c => c ? { ...c, memos: c.memos.filter(m => m.id !== memoId) } : c);
  };

  const deleteAllMemos = async () => {
    if (!confirm(`메모 ${contact?.memos.length}건을 전체 삭제할까요?`)) return;
    const res = await fetch(`/api/contacts/${id}/memos`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) setContact(c => c ? { ...c, memos: [] } : c);
  };

  const copyCallLog = (log: CallLog) => {
    const RESULT_KO: Record<string, string> = {
      INTERESTED: '관심있음', PENDING: '보류', REJECTED: '거절', RESCHEDULED: '재콜예약',
    };
    const dt = new Date(log.createdAt).toLocaleString('ko-KR');
    const parts = [
      `[${dt}]`,
      log.result ? RESULT_KO[log.result] ?? log.result : '',
      log.convictionScore ? `확신도 ${log.convictionScore}점` : '',
      log.content ?? '',
      log.nextAction ? `→ ${log.nextAction}` : '',
    ].filter(Boolean);
    navigator.clipboard.writeText(parts.join(' | ')).then(() => {
      setCopiedLogId(log.id);
    });
  };

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

  const fetchContact = () => {
    fetch(`/api/contacts/${id}`)
      .then((r) => r.json())
      .then((c) => {
        if (c.ok) {
          setContact({ ...c.contact, sharedCallLogs: c.contact.sharedCallLogs ?? [] });
          setTags(c.contact.tags ?? []);
          if (c.contact.departureDate) {
            setDeptForm({
              departureDate: c.contact.departureDate.split("T")[0],
              productName:   c.contact.productName ?? "",
              bookingRef:    c.contact.bookingRef  ?? "",
            });
          }
        }
      });
  };

  useEffect(() => {
    const fetchContact = fetch(`/api/contacts/${id}`).catch(err => {
      logger.error('[fetchContact failed]', { err });
      return { ok: false };
    });
    const fetchGroups = fetch("/api/groups").catch(err => {
      logger.error('[fetchGroups failed]', { err });
      return { ok: false };
    });
    const fetchFunnels = fetch("/api/funnels").catch(err => {
      logger.error('[fetchFunnels failed]', { err });
      return { ok: false };
    });
    Promise.allSettled([fetchContact, fetchGroups, fetchFunnels])
      .then((results) => {
        // Contact 필수, Funnels/Groups는 선택적
        const [c, g, f] = results;

        if (c.status === 'fulfilled') {
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
        } else {
          logger.error('[fetchContact failed]', { err: c.reason });
        }

        // Groups는 실패해도 UI 계속 표시
        if (g.status === 'fulfilled') {
          g.value.json().then(groupsData => {
            if (groupsData.ok) setAllGroups(groupsData.groups);
          }).catch(err => {
            logger.error('[groupsData.json failed]', { err });
          });
        }

        // Funnels도 실패해도 UI 계속 표시
        if (f.status === 'fulfilled') {
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
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!contact?.id) return;
    setLoadingTransfer(true);
    fetch(`/api/contacts/${contact.id}/transfer-logs`)
      .then(r => r.json())
      .then(d => { if (d.ok) setTransferLogs(d.logs ?? []); })
      .catch(err => logger.error('[transfer-logs]', { err }))
      .finally(() => setLoadingTransfer(false));
  }, [contact?.id]);

  useEffect(() => {
    if (!copiedLogId) return;
    const timer = setTimeout(() => setCopiedLogId(null), 1500);
    return () => clearTimeout(timer);
  }, [copiedLogId]);

  // [S-002] CSRF 토큰 초기화 (페이지 로드 시 한 번)
  useEffect(() => {
    fetch('/api/csrf-token')
      .then(r => r.json())
      .then(d => {
        if (d.ok) setCsrfToken(d.token);
      })
      .catch(err => {
        logger.error('[csrf-token fetch failed]', { err });
      });
  }, []);

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

  const addCallLog = useCallback(async () => {
    const res  = await fetch(`/api/contacts/${id}/call-logs`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(callForm),
    });
    const data = await res.json();
    if (data.ok) {
      setContact((c) => c ? { ...c, callLogs: [data.log, ...c.callLogs] } : c);
      setShowCallForm(false);
      setCallForm({
        content: "",
        result: "INTERESTED",
        convictionScore: "5",
        nextAction: "",
        scheduledAt: "",
        objectionId: "",
        customerReaction: "neutral",
        recovered: false,
        recoveryTime: "",
      });
      setSelectedObjectionModal(null);

      toast({
        title: "콜 기록 저장",
        description: "콜 기록이 저장되었습니다.",
        variant: "success",
      });

      logger.log("[ContactDetail]", {
        action: "add-call-log",
        contactId: id,
        result: callForm.result,
        status: "success",
      });
    } else {
      toast({
        title: "저장 실패",
        description: data.message || "콜 기록 저장에 실패했습니다.",
        variant: "destructive",
      });

      logger.log("[ContactDetail]", {
        action: "add-call-log",
        contactId: id,
        status: "error",
        error: data.message,
      });
    }
  }, [id, callForm, toast]);

  const addMemo = useCallback(async () => {
    if (!memoText.trim()) return;

    // [E-002] 동시성 제어: 이미 저장 중이면 무시
    if (savingMemo) return;

    setSavingMemo(true);
    try {
      const res  = await fetch(`/api/contacts/${id}/memos`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: memoText }),
      });
      const data = await res.json();
      if (data.ok) {
        setContact((c) => c ? { ...c, memos: [data.memo, ...c.memos] } : c);
        setShowMemoForm(false);
        setMemoText("");

        toast({
          title: "메모 저장",
          description: "메모가 저장되었습니다.",
          variant: "success",
        });

        logger.log("[ContactDetail]", {
          action: "add-memo",
          contactId: id,
          status: "success",
        });
      } else {
        toast({
          title: "저장 실패",
          description: data.message || "메모 저장에 실패했습니다.",
          variant: "destructive",
        });

        logger.log("[ContactDetail]", {
          action: "add-memo",
          contactId: id,
          status: "error",
          error: data.message,
        });
      }
    } catch (err) {
      // [E-003] Promise 에러 전파
      toast({
        title: "네트워크 오류",
        description: err instanceof Error ? err.message : "메모 저장에 실패했습니다.",
        variant: "destructive",
      });
      logger.error("[addMemo error]", { err, contactId: id });
    } finally {
      setSavingMemo(false);
    }
  }, [id, memoText, toast, savingMemo]);

  // 그룹 배정 → 퍼널 자동 시작
  const assignGroup = async () => {
    if (!selectedGroup) return;
    setAssigning(true);
    setAssignMsg("");
    const res  = await fetch(`/api/groups/${selectedGroup}/members`, {
      method: "POST", headers: { "Content-Type": "application/json" },
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
    }
    setAssigning(false);
  };

  // WO-28: DB 전달 모달 열기 (대상 목록 로드)
  const openSendDb = async () => {
    setShowSendDb(true);
    setSendDbResult("");
    setSendDbTarget("");
    setDbSearch("");
    const [orgRes, agentRes] = await Promise.all([
      fetch("/api/org/list").then((r) => r.json()),
      fetch("/api/org/agents").then((r) => r.json()),
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
      fetch(`/api/contacts/${id}/transfer-logs`)
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

  // 이 고객 Drive 백업
  const [backingContact, setBackingContact] = useState(false);
  const [contactBackupMsg, setContactBackupMsg] = useState("");

  const handleContactBackup = async () => {
    setBackingContact(true);
    setContactBackupMsg("");
    try {
      const res  = await fetch(`/api/backup/contact/${id}`, { method: "POST" });
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId: log.id }),
      });
      const data = await res.json();
      if (data.ok) {
        setTransferLogs(prev => prev.filter(l => l.id !== log.id));
      } else {
        alert(data.message ?? "회수에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
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

  // A-001: 모달 포커스 관리
  const openSmsModal = () => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    setShowSmsModal(true);
  };

  const closeSmsModal = () => {
    setShowSmsModal(false);
    setSendResult("");
    previousFocusRef.current?.focus();
  };

  const openSchedModal = () => {
    previousFocusRef.current = document.activeElement as HTMLElement;
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: smsMsg }),
    });
    const data = await res.json();
    setSending(false);
    if (data.ok) {
      setSendResult("✅ 발송 완료!");
      setSmsMsg("");
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
      method: "PATCH", headers: { "Content-Type": "application/json" },
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

  const currentGroups = contact.groups.map((g) => g.group);
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

      {/* 탭 */}
      <div className="flex border-b border-gray-200 mb-4">
        {[
          { key: "call",  label: `📞 콜기록 (${contact.callLogs.length})` },
          { key: "memo",  label: `📝 메모 (${contact.memos.length})` },
          { key: "group", label: "👥 그룹 배정" },
          { key: "sms",   label: "💬 발송내역" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key as typeof tab);
              if (t.key === "sms" && smsLogs.length === 0 && smsHasMore) {
                setSmsLoading(true);
                fetch(`/api/contacts/${contact.id}/sms-logs?limit=20&page=1`)
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
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
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
          backing={backing}
          backupResult={backupResult}
          addCallLog={addCallLog}
          deleteCallLog={deleteCallLog}
          deleteAllCallLogs={deleteAllCallLogs}
          backupCallLogs={backupCallLogs}
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
          deleteMemo={deleteMemo}
          deleteAllMemos={deleteAllMemos}
        />
      )}

      {/* Group Tab */}
      {tab === "group" && (
        <ContactGroupTab
          contact={contact}
          allGroups={allGroups}
          selectedGroup={selectedGroup}
          setSelectedGroup={setSelectedGroup}
          assigning={assigning}
          assignMsg={assignMsg}
          assignGroup={assignGroup}
          funnels={funnels}
          selectedFunnelId={selectedFunnelId}
          setSelectedFunnelId={setSelectedFunnelId}
          enrollStartDate={enrollStartDate}
          setEnrollStartDate={setEnrollStartDate}
          enrollSendNow={enrollSendNow}
          setEnrollSendNow={setEnrollSendNow}
          enrolling={enrolling}
          setEnrolling={setEnrolling}
          enrollError={enrollError}
          setEnrollError={setEnrollError}
          handleFunnelEnroll={async () => {
            if (!selectedFunnelId) return;
            setEnrolling(true);
            setEnrollError('');
            const res = await fetch(`/api/funnels/${selectedFunnelId}/enroll`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contactId: contact.id,
                startDate: enrollStartDate || undefined,
                sendNow: enrollSendNow,
              }),
            });
            const d = await res.json();
            if (d.ok) {
              setSelectedFunnelId('');
              setEnrollStartDate('');
              setEnrollSendNow(false);
              fetchContact();
            } else {
              setEnrollError(d.message ?? '등록 실패');
            }
            setEnrolling(false);
          }}
          transferLogs={transferLogs}
          loadingTransfer={loadingTransfer}
        />
      )}

      {/* SMS Tab */}
      {tab === "sms" && (
        <ContactSmsTab
          smsLogs={smsLogs}
          smsLoading={smsLoading}
        />
      )}
    </div>
  );
}
