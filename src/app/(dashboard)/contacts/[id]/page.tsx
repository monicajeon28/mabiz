"use client";

import { useState, useEffect, useMemo, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft, Phone, MessageSquare,
  Plus, Clock, FileText, Star, GitBranch, Calendar, Send, AlarmClock,
  Share2, Users, Building2, X, ChevronDown, Trash2, Copy, Check, CloudUpload, Search, FileDown
} from "lucide-react";
import { logger } from "@/lib/logger";
import { useToast } from "@/lib/api/use-toast";
import { RecommendBanner } from "./recommend-banner";
import CallScriptPanel from "./CallScriptPanel";
import { getAllObjectionIds, getObjectionData } from "@/lib/objections/validation";
import objectionsData from "@/../../TRACK_A_OBJECTIONS.json";

type CallLog = {
  id: string; content: string | null; result: string | null;
  duration: number | null; convictionScore: number | null;
  nextAction: string | null; scheduledAt: string | null; createdAt: string;
  _sharedFrom?: string;   // 다른 조직 공유 콜 기록
  _authorName?: string | null; // 작성자 이름
};
type Memo = { id: string; content: string; createdAt: string; _authorName?: string | null };
type Group = { id: string; name: string; funnelId?: string | null };
type Contact = {
  id: string; name: string; phone: string; email: string | null;
  type: string; cruiseInterest: string | null; budgetRange: string | null;
  adminMemo: string | null; assignedUserId: string | null;
  lastContactedAt: string | null; purchasedAt: string | null;
  departureDate: string | null; productName: string | null; bookingRef: string | null;
  tags: string[];
  leadScore: number;
  sourceOrgId: string | null; // 공유받은 복사본 여부 (null이 아니면 재공유 불가)
  age?: number | null;
  maritalStatus?: string | null;
  childrenCount?: number | null;
  segmentOverride?: string | null;
  groups: { group: { id: string; name: string } }[];
  callLogs: CallLog[]; memos: Memo[];
  sharedCallLogs: (CallLog & { _sharedFrom: string })[];
  vipSequences: { id: string; funnelId: string; status: string; startDate: string }[];
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
  const [tab,           setTab]           = useState<"call" | "memo" | "group" | "sms">("call");
  const [loading,       setLoading]       = useState(true);
  const [smsLogs,       setSmsLogs]       = useState<{ id: string; phone: string; contentPreview: string; status: string; channel: string; sentAt: string }[]>([]);
  const [smsLoading,    setSmsLoading]    = useState(false);

  // WO-22: 즉시 SMS 발송 모달
  const [showSmsModal,  setShowSmsModal]  = useState(false);
  const [smsMsg,        setSmsMsg]        = useState("");
  const [sending,       setSending]       = useState(false);
  const [sendResult,    setSendResult]    = useState("");

  // WO-23: 예약 발송 모달
  const [showSchedModal, setShowSchedModal] = useState(false);

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
  const [callForm, setCallForm]           = useState({
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
  const [selectedObjectionModal, setSelectedObjectionModal] = useState<any>(null);

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
      setTimeout(() => setCopiedLogId(null), 1500);
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
    Promise.all([
      fetch(`/api/contacts/${id}`).then((r) => r.json()),
      fetch("/api/groups").then((r) => r.json()),
      fetch("/api/funnels").then((r) => r.json()),
    ]).then(([c, g, f]) => {
      if (c.ok) {
        setContact(c.contact);
        setTags(c.contact.tags ?? []);
        if (c.contact.departureDate) {
          setDeptForm({
            departureDate: c.contact.departureDate.split("T")[0],
            productName:   c.contact.productName ?? "",
            bookingRef:    c.contact.bookingRef  ?? "",
          });
        }
      }
      if (g.ok) setAllGroups(g.groups);
      if (f.ok) setFunnels(f.funnels ?? []);
    }).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!contact?.id) return;
    setLoadingTransfer(true);
    fetch(`/api/contacts/${contact.id}/transfer-logs`)
      .then(r => r.json())
      .then(d => { if (d.ok) setTransferLogs(d.logs ?? []); })
      .finally(() => setLoadingTransfer(false));
  }, [contact?.id]);

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
  }, [id, memoText, toast]);

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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: sendDbTarget }),
    });
    const data = await res.json();
    setSendingDb(false);
    if (data.ok) {
      setSendDbResult(`✅ ${data.agentName ?? "대상"}에게 전달 완료`);
      setSendDbTarget("");
      // 전달 이력 새로고침 (뱃지 반영)
      fetch(`/api/contacts/${id}/transfer-logs`)
        .then(r => r.json())
        .then(d => { if (d.ok) setTransferLogs(d.logs ?? []); });
      setTimeout(() => { setShowSendDb(false); setSendDbResult(""); }, 2000);
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
        setTimeout(() => setContactBackupMsg(""), 3000);
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

  // WO-25C: 태그 저장
  const saveTag = async (newTags: string[]) => {
    setSavingTags(true);
    await fetch(`/api/contacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: newTags }),
    });
    setSavingTags(false);
  };

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (!t || tags.includes(t)) return;
    const next = [...tags, t];
    setTags(next);
    saveTag(next);
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    const next = tags.filter((tt) => tt !== tag);
    setTags(next);
    saveTag(next);
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
      setTimeout(() => { setShowSmsModal(false); setSendResult(""); }, 1500);
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
      setTimeout(() => { setShowSchedModal(false); setSchedResult(""); }, 1500);
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
              <button onClick={() => { setShowSmsModal(false); setSendResult(""); }} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>
            <p className="text-xs text-gray-500">수신: <strong>{contact?.name}</strong> ({contact?.phone})</p>
            <textarea
              value={smsMsg}
              onChange={(e) => setSmsMsg(e.target.value)}
              placeholder="[고객명], [이름] 치환 사용 가능&#10;예: [고객명]님, 안녕하세요! 크루즈닷입니다."
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-gold-500"
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
              <button onClick={() => { setShowSchedModal(false); setSchedResult(""); }} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>
            <p className="text-xs text-gray-500">수신: <strong>{contact?.name}</strong> ({contact?.phone})</p>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">발송 예정 시각</label>
              <input
                type="datetime-local"
                value={schedAt}
                onChange={(e) => setSchedAt(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
              />
            </div>
            <textarea
              value={schedMsg}
              onChange={(e) => setSchedMsg(e.target.value)}
              placeholder="[고객명], [이름] 치환 사용 가능"
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-gold-500"
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

      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        {editingName ? (
          <input
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
            className="text-xl font-bold text-navy-900 flex-1 border-b-2 border-purple-400 outline-none bg-transparent"
          />
        ) : (
          <h1
            className="text-xl font-bold text-navy-900 flex-1 cursor-pointer hover:text-purple-700 transition-colors"
            onClick={() => { setNameInput(contact.name); setEditingName(true); }}
            title="클릭하여 이름 수정"
          >
            {contact.name}
          </h1>
        )}
        <a href={`tel:${contact.phone}`} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
          <Phone className="w-5 h-5" />
        </a>
        <button
          onClick={handleContactBackup}
          disabled={backingContact}
          className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 disabled:opacity-50"
          title="이 고객 Drive 백업"
        >
          {backingContact
            ? <span className="text-xs px-1">...</span>
            : <FileDown className="w-5 h-5" />
          }
        </button>
        <button
          onClick={contact.sourceOrgId ? undefined : openSendDb}
          disabled={!!contact.sourceOrgId}
          className={`p-2 rounded-lg ${contact.sourceOrgId ? "bg-gray-100 text-gray-300 cursor-not-allowed" : "bg-purple-50 text-purple-600 hover:bg-purple-100"}`}
          title={contact.sourceOrgId ? "공유받은 DB는 재공유할 수 없습니다" : "DB 전달"}
        >
          <Share2 className="w-5 h-5" />
        </button>
        <button
          onClick={() => setShowSmsModal(true)}
          className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100"
          title="SMS 즉시 발송"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
        <button
          onClick={() => setShowSchedModal(true)}
          className="p-2 bg-orange-50 text-orange-500 rounded-lg hover:bg-orange-100"
          title="SMS 예약 발송"
        >
          <AlarmClock className="w-5 h-5" />
        </button>
      </div>

      {/* 백업 결과 토스트 */}
      {contactBackupMsg && (
        <div className={`mb-3 px-4 py-2 rounded-xl text-sm font-medium ${contactBackupMsg.startsWith("✅") ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
          {contactBackupMsg}
        </div>
      )}

      {/* 전달됨 뱃지 (최신 이력) */}
      {transferLogs.length > 0 && (() => {
        const latest = transferLogs[0];
        const targetName = latest.toUserName ?? latest.toUserOrgName ?? "알 수 없음";
        return (
          <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-xl px-4 py-2.5 mb-4">
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-purple-500 shrink-0" />
              <div>
                <span className="text-sm font-semibold text-purple-700">→ {targetName}</span>
                <span className="text-xs text-purple-400 ml-2">({latest.toUserOrgName ?? latest.toOrg?.name ?? "본사"})</span>
                <p className="text-xs text-purple-400 mt-0.5">
                  {new Date(latest.createdAt).toLocaleDateString("ko-KR")} 전달
                  {latest.transferType === "ORG_COPY" && " · 복사본 공유"}
                </p>
              </div>
            </div>
            {latest.canRecall && (
              <button
                onClick={() => handleRecall(latest)}
                disabled={recalling}
                className="text-xs text-red-500 hover:text-red-700 hover:underline font-medium disabled:opacity-50 shrink-0 ml-2"
              >
                {recalling ? "회수 중..." : "회수하기"}
              </button>
            )}
          </div>
        );
      })()}

      {/* 상품 추천 배너 */}
      <RecommendBanner
        age={contact.age}
        maritalStatus={contact.maritalStatus}
        childrenCount={contact.childrenCount}
      />

      {/* 기본 정보 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-400">전화번호</span><p className="font-medium mt-0.5">{contact.phone}</p></div>

          {/* 상태 — 인라인 드롭다운 */}
          <div>
            <span className="text-gray-400">상태</span>
            <div className="mt-0.5 relative">
              <select
                value={contact.type}
                disabled={savingField === "type"}
                onChange={(e) => saveField("type", e.target.value)}
                className="w-full font-medium bg-transparent border-0 border-b border-dashed border-gray-300 focus:outline-none focus:border-navy-500 pr-5 py-0 cursor-pointer text-sm appearance-none"
              >
                <option value="잠재고객">🔵 잠재고객</option>
                <option value="문자">💬 문자</option>
                <option value="부재">📵 부재</option>
                <option value="3일부재">⏰ 3일부재</option>
                <option value="소통">🤝 소통</option>
                <option value="구매완료">✅ 구매완료</option>
                <option value="VIP">⭐ VIP</option>
                <option value="수신거부">🚫 수신거부</option>
              </select>
              <ChevronDown className="absolute right-0 top-0.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              {savingField === "type" && <span className="text-xs text-gray-400 absolute -bottom-4 left-0">저장 중...</span>}
            </div>
          </div>

          {/* 관심 크루즈 — 인라인 드롭다운 */}
          <div>
            <span className="text-gray-400">관심 크루즈</span>
            <div className="mt-0.5 relative">
              <select
                value={contact.cruiseInterest ?? ""}
                disabled={savingField === "cruiseInterest"}
                onChange={(e) => saveField("cruiseInterest", e.target.value || null)}
                className="w-full font-medium text-gold-600 bg-transparent border-0 border-b border-dashed border-gray-300 focus:outline-none focus:border-navy-500 pr-5 py-0 cursor-pointer text-sm appearance-none"
              >
                <option value="">선택 안함</option>
                <option value="지중해">🌊 지중해</option>
                <option value="카리브해">🏝️ 카리브해</option>
                <option value="알래스카">🏔️ 알래스카</option>
                <option value="북유럽">❄️ 북유럽</option>
                <option value="동남아">🌴 동남아</option>
                <option value="발틱해">🚢 발틱해</option>
                <option value="국내출발">🇰🇷 국내출발</option>
                <option value="국내근처">🗺️ 국내근처</option>
                <option value="기타">기타</option>
              </select>
              <ChevronDown className="absolute right-0 top-0.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              {savingField === "cruiseInterest" && <span className="text-xs text-gray-400 absolute -bottom-4 left-0">저장 중...</span>}
            </div>
          </div>
        </div>

        {/* ★ 출발일 + 상품 정보 (VIP 케어 핵심) */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-gold-500" />
              VIP 케어 출발 정보
            </p>
            <button
              onClick={() => setShowDeptForm(!showDeptForm)}
              className="text-xs text-blue-600 hover:underline"
            >
              {contact.departureDate ? "수정" : "입력"}
            </button>
          </div>

          {contact.departureDate ? (
            <div className="bg-gold-100 rounded-lg p-3 space-y-1">
              <p className="text-sm font-bold text-navy-900">
                🗓 출발일: {new Date(contact.departureDate).toLocaleDateString("ko-KR")}
              </p>
              {contact.productName && (
                <p className="text-sm text-gray-700">🚢 상품: {contact.productName}</p>
              )}
              {contact.bookingRef && (
                <p className="text-sm text-gray-700">📋 예약번호: {contact.bookingRef}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400">출발일 미입력 — 입력하면 D-150~D+2 자동 계산</p>
          )}

          {showDeptForm && (
            <div className="mt-3 space-y-2 bg-gray-50 rounded-xl p-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">출발일 *</label>
                <input
                  type="date"
                  value={deptForm.departureDate}
                  onChange={(e) => setDeptForm({ ...deptForm, departureDate: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">크루즈 상품명</label>
                <select
                  value={deptForm.productName}
                  onChange={(e) => setDeptForm({ ...deptForm, productName: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold-500 bg-white"
                >
                  <option value="">상품 선택...</option>
                  <optgroup label="지중해">
                    <option value="지중해 7박 MSC 크루즈">지중해 7박 MSC</option>
                    <option value="지중해 14박 MSC 크루즈">지중해 14박 MSC</option>
                    <option value="지중해 7박 코스타 크루즈">지중해 7박 코스타</option>
                  </optgroup>
                  <optgroup label="북유럽·발틱">
                    <option value="북유럽 12박 크루즈">북유럽 12박</option>
                    <option value="발틱해 10박 크루즈">발틱해 10박</option>
                  </optgroup>
                  <optgroup label="알래스카">
                    <option value="알래스카 7박 크루즈">알래스카 7박</option>
                  </optgroup>
                  <optgroup label="카리브해">
                    <option value="카리브해 7박 크루즈">카리브해 7박</option>
                    <option value="카리브해 14박 크루즈">카리브해 14박</option>
                  </optgroup>
                  <optgroup label="동남아">
                    <option value="동남아 5박 크루즈">동남아 5박</option>
                    <option value="동남아 7박 크루즈">동남아 7박</option>
                  </optgroup>
                  <optgroup label="국내">
                    <option value="국내출발 크루즈">국내출발</option>
                    <option value="국내근처 크루즈">국내근처</option>
                  </optgroup>
                  <option value="직접입력">직접입력 (하단 메모 활용)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">예약 번호</label>
                <input
                  type="text"
                  value={deptForm.bookingRef}
                  onChange={(e) => setDeptForm({ ...deptForm, bookingRef: e.target.value })}
                  placeholder="PNR 또는 예약 번호"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveDeparture}
                  disabled={savingDept || !deptForm.departureDate}
                  className="flex-1 bg-navy-900 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {savingDept ? "저장 중..." : "저장"}
                </button>
                <button
                  onClick={() => setShowDeptForm(false)}
                  className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm"
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 현재 그룹 태그 */}
        {currentGroups.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-3">
            {currentGroups.map((g) => (
              <span key={g.id} className="text-xs px-2 py-1 bg-navy-100 text-navy-900 rounded-full">
                {g.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* WO-25C: 고객 태그 카드 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">🏷️ 태그</p>
          {savingTags && <span className="text-xs text-gray-400">저장 중...</span>}
        </div>

        {/* 현재 태그 */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full"
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="text-blue-400 hover:text-blue-700 ml-0.5 font-bold"
              >×</button>
            </span>
          ))}
          {tags.length === 0 && (
            <p className="text-xs text-gray-400">태그 없음 — 아래에서 추가하세요</p>
          )}
        </div>

        {/* 태그 입력 */}
        <div className="flex gap-2 mb-2">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); } }}
            placeholder="태그 직접 입력 후 Enter"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-400"
          />
          <button
            onClick={() => addTag(tagInput)}
            disabled={!tagInput.trim()}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-40"
          >추가</button>
        </div>

        {/* 추천 태그 */}
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED_TAGS.filter((t) => !tags.includes(t)).slice(0, 12).map((tag) => (
            <button
              key={tag}
              onClick={() => addTag(tag)}
              className="text-xs bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600 px-2 py-0.5 rounded-full transition-colors"
            >
              + {tag}
            </button>
          ))}
        </div>
      </div>

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
              if (t.key === "sms" && smsLogs.length === 0) {
                setSmsLoading(true);
                fetch(`/api/sms-logs?contactId=${contact.id}&days=90`)
                  .then(r => r.json())
                  .then(d => { if (d.ok) setSmsLogs(d.logs ?? []); setSmsLoading(false); })
                  .catch(() => { logger.error("[ContactDetail] SMS 로그 fetch 실패", { contactId: contact.id }); setSmsLoading(false); });
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

      {/* 콜기록 탭 */}
      {tab === "call" && (
        <div>
          <CallScriptPanel
            contact={{
              age: contact.age,
              maritalStatus: contact.maritalStatus,
              childrenCount: contact.childrenCount,
            }}
            isExpanded={true}
          />

          <div className="flex gap-2 mb-3 flex-wrap">
            <button
              onClick={() => setShowCallForm(true)}
              className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-3 text-sm text-gray-500 hover:border-gold-300 hover:text-gold-600 transition-colors"
            >
              <Plus className="w-4 h-4" /> 콜 기록 추가
            </button>
            {contact.callLogs.length > 0 && (
              <>
                <button
                  onClick={backupCallLogs}
                  disabled={backing}
                  className="flex items-center gap-1.5 px-3 py-2 border border-blue-200 text-blue-600 rounded-xl text-xs hover:bg-blue-50 transition-colors disabled:opacity-50"
                >
                  <CloudUpload className="w-3.5 h-3.5" />
                  {backing ? "백업 중..." : "Drive 백업"}
                </button>
                <button
                  onClick={deleteAllCallLogs}
                  className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-500 rounded-xl text-xs hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> 전체 삭제
                </button>
              </>
            )}
          </div>
          {backupResult && (
            <div className="mb-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm flex items-center justify-between">
              <span className="text-blue-700">✅ {backupResult.count}건 Drive 백업 완료</span>
              <a href={backupResult.url} target="_blank" rel="noreferrer" className="text-blue-600 underline text-xs">파일 열기 →</a>
            </div>
          )}

          {showCallForm && (
            <div className="bg-white border border-gold-300 rounded-xl p-4 mb-3 space-y-3">
              <textarea
                placeholder="통화 내용을 입력하세요..."
                value={callForm.content}
                onChange={(e) => setCallForm({ ...callForm, content: e.target.value })}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-gold-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">결과</label>
                  <select
                    value={callForm.result}
                    onChange={(e) => setCallForm({ ...callForm, result: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                  >
                    {Object.entries(RESULT_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">확신척도 (1~10)</label>
                  <select
                    value={callForm.convictionScore}
                    onChange={(e) => setCallForm({ ...callForm, convictionScore: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                  >
                    {[...Array(10)].map((_, i) => (
                      <option key={i + 1} value={String(i + 1)}>{i + 1}점</option>
                    ))}
                  </select>
                </div>
              </div>
              <input
                placeholder="다음 액션"
                value={callForm.nextAction}
                onChange={(e) => setCallForm({ ...callForm, nextAction: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
              />
              <input
                type="datetime-local"
                placeholder="다음 콜 날짜"
                value={callForm.scheduledAt}
                onChange={(e) => setCallForm({ ...callForm, scheduledAt: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
              />

              {/* Track A 이의처리 섹션 */}
              <div className="border-t border-gray-200 pt-3 mt-3">
                <label className="text-xs text-gray-500 mb-2 block font-semibold">📞 이의처리 기록 (선택)</label>
                <select
                  value={callForm.objectionId}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    setCallForm({ ...callForm, objectionId: selectedId });
                    if (selectedId) {
                      const objData = getObjectionData(selectedId);
                      setSelectedObjectionModal(objData);
                    }
                  }}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white mb-2"
                >
                  <option value="">이의 없음</option>
                  {objectionsData.objections.map((obj: any) => (
                    <option key={obj.id} value={obj.id}>
                      {obj.id} - {obj.categoryName}: {obj.subcategoryName}
                    </option>
                  ))}
                </select>

                {callForm.objectionId && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">고객 반응</label>
                      <select
                        value={callForm.customerReaction}
                        onChange={(e) => setCallForm({ ...callForm, customerReaction: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                      >
                        <option value="positive">긍정 (해결됨)</option>
                        <option value="neutral">중립</option>
                        <option value="negative">부정 (악화됨)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">해결 여부</label>
                      <label className="flex items-center gap-2 border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                        <input
                          type="checkbox"
                          checked={callForm.recovered}
                          onChange={(e) => setCallForm({ ...callForm, recovered: e.target.checked })}
                        />
                        <span className="text-sm">성공 처리</span>
                      </label>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 mb-1 block">해결 소요 시간 (초)</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="30초"
                        value={callForm.recoveryTime}
                        onChange={(e) => setCallForm({ ...callForm, recoveryTime: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-gold-500"
                      />
                    </div>
                  </div>
                )}

                {selectedObjectionModal && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="font-semibold text-yellow-900 text-xs mb-2">💡 즉각 대응 스크립트</div>
                    <div className="text-sm text-yellow-800 whitespace-pre-wrap font-mono">
                      {selectedObjectionModal.immediateResponse}
                    </div>
                    <div className="text-xs text-yellow-700 mt-2">
                      {selectedObjectionModal.responseMetrics.wordCount}단어 / {selectedObjectionModal.responseMetrics.estimatedSeconds}초
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={addCallLog} className="flex-1 bg-navy-900 text-white py-2 rounded-lg text-sm font-medium">저장</button>
                <button onClick={() => setShowCallForm(false)} className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm">취소</button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {contact.callLogs.map((log) => {
              const isOpen = expandedLogId === log.id;
              return (
                <div key={log.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  {/* 요약 행 — 클릭으로 열기/닫기 */}
                  <button
                    type="button"
                    onClick={() => setExpandedLogId(isOpen ? null : log.id)}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <Clock className="w-3 h-3 text-gray-400 shrink-0" />
                    <span className="text-xs text-gray-400 shrink-0">
                      {new Date(log.createdAt).toLocaleString("ko-KR")}
                    </span>
                    {log.result && (
                      <span className="text-xs text-gray-600 shrink-0">{RESULT_LABELS[log.result] ?? log.result}</span>
                    )}
                    {log.convictionScore && (
                      <span className="flex items-center gap-0.5 text-xs text-gold-500 shrink-0">
                        <Star className="w-3 h-3 fill-gold-500" />{log.convictionScore}점
                      </span>
                    )}
                    {/* 내용 첫 줄 미리보기 */}
                    {log.content && !isOpen && (
                      <span className="text-xs text-gray-500 truncate flex-1 ml-1">{log.content}</span>
                    )}
                    {/* 작성자 딱지 */}
                    {log._authorName && (
                      <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full shrink-0 font-medium">
                        {log._authorName}
                      </span>
                    )}
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-400 shrink-0 ml-auto transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>

                  {/* 확장 영역 */}
                  {isOpen && (
                    <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-2">
                      {log.content && (
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{log.content}</p>
                      )}
                      {log.nextAction && (
                        <p className="text-xs text-blue-600">→ {log.nextAction}</p>
                      )}
                      {/* 액션 버튼 */}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => copyCallLog(log)}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          {copiedLogId === log.id
                            ? <><Check className="w-3 h-3 text-green-500" /> 복사됨</>
                            : <><Copy className="w-3 h-3" /> 복사</>
                          }
                        </button>
                        {log.scheduledAt && (
                          <a
                            href={`/api/contacts/${id}/call-logs/${log.id}/ics`}
                            download={`call-${log.id}.ics`}
                            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                          >
                            <FileDown className="w-3 h-3" /> 캘린더
                          </a>
                        )}
                        <button
                          onClick={() => deleteCallLog(log.id)}
                          className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors ml-auto"
                        >
                          <Trash2 className="w-3 h-3" /> 삭제
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {contact.callLogs.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-8">콜 기록이 없습니다.</p>
            )}
          </div>

          {/* 공유된 콜 기록 (DB 전달 연결 고객) */}
          {(contact.sharedCallLogs?.length ?? 0) > 0 && (
            <div className="mt-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px flex-1 bg-purple-100" />
                <span className="text-xs font-semibold text-purple-500 flex items-center gap-1">
                  <Share2 className="w-3 h-3" /> 공유된 콜 기록
                </span>
                <div className="h-px flex-1 bg-purple-100" />
              </div>
              <div className="space-y-2">
                {contact.sharedCallLogs.map((log) => (
                  <div key={log.id} className="bg-purple-50 border border-purple-200 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3">
                      <Clock className="w-3 h-3 text-purple-300 shrink-0" />
                      <span className="text-xs text-purple-400 shrink-0">
                        {new Date(log.createdAt).toLocaleString("ko-KR")}
                      </span>
                      {log.result && (
                        <span className="text-xs text-purple-600 shrink-0">{RESULT_LABELS[log.result] ?? log.result}</span>
                      )}
                      {log.convictionScore && (
                        <span className="text-xs text-gold-500 shrink-0">
                          <Star className="w-3 h-3 fill-gold-400 inline" />{log.convictionScore}점
                        </span>
                      )}
                      {log.content && (
                        <span className="text-xs text-purple-500 truncate flex-1">{log.content}</span>
                      )}
                      {/* 작성자 이름 딱지 */}
                      {log._authorName && (
                        <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full shrink-0 font-medium">
                          {log._authorName}
                        </span>
                      )}
                      {/* 공유 조직 딱지 */}
                      <span className="text-[10px] bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded-full shrink-0">
                        {log._sharedFrom}
                      </span>
                    </div>
                    {log.nextAction && (
                      <div className="px-4 pb-3 text-xs text-blue-500">→ {log.nextAction}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 메모 탭 */}
      {tab === "memo" && (
        <div>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setShowMemoForm(true)}
              className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-3 text-sm text-gray-500 hover:border-gold-300 hover:text-gold-600 transition-colors"
            >
              <Plus className="w-4 h-4" /> 메모 추가
            </button>
            {contact.memos.length > 0 && (
              <button
                onClick={deleteAllMemos}
                className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-500 rounded-xl text-xs hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> 전체 삭제
              </button>
            )}
          </div>
          {showMemoForm && (
            <div className="bg-white border border-gold-300 rounded-xl p-4 mb-3 space-y-2">
              <textarea
                placeholder="메모 내용..."
                value={memoText}
                onChange={(e) => setMemoText(e.target.value)}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-gold-500"
              />
              <div className="flex gap-2">
                <button onClick={addMemo} className="flex-1 bg-navy-900 text-white py-2 rounded-lg text-sm font-medium">저장</button>
                <button onClick={() => setShowMemoForm(false)} className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm">취소</button>
              </div>
            </div>
          )}
          <div className="space-y-2">
            {contact.memos.map((m) => (
              <div key={m.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <FileText className="w-3 h-3" />
                    <span>{new Date(m.createdAt).toLocaleString("ko-KR")}</span>
                    {m._authorName && (
                      <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-medium text-[10px]">
                        {m._authorName}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => deleteMemo(m.id)}
                    className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}
            {contact.memos.length === 0 && <p className="text-center text-sm text-gray-400 py-8">메모가 없습니다.</p>}
          </div>
        </div>
      )}

      {/* 그룹 배정 탭 */}
      {tab === "group" && (
        <div className="space-y-4">
          {/* 그룹 배정 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-gold-500" />
              그룹 배정 → 퍼널 자동 시작
            </h3>
            <p className="text-xs text-gray-400 mb-3">그룹에 퍼널이 연결되어 있으면 배정 즉시 자동 문자 발송 시작</p>

            <div className="flex gap-2">
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-gold-500"
              >
                <option value="">그룹 선택...</option>
                {availableGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} {g.funnelId ? "🔄" : ""}
                  </option>
                ))}
              </select>
              <button
                onClick={assignGroup}
                disabled={assigning || !selectedGroup}
                className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-700 disabled:opacity-50"
              >
                {assigning ? "배정 중..." : "배정"}
              </button>
            </div>

            {assignMsg && (
              <p className="mt-2 text-sm text-green-600 font-medium">{assignMsg}</p>
            )}

            <p className="text-xs text-gray-400 mt-2">
              🔄 = 퍼널 연결됨 (배정 즉시 자동 문자 발송)
            </p>
          </div>

          {/* 현재 소속 그룹 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold text-gray-900 mb-3">현재 소속 그룹</h3>
            {currentGroups.length === 0 ? (
              <p className="text-sm text-gray-400">아직 그룹에 속하지 않았습니다.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {currentGroups.map((g) => (
                  <span key={g.id} className="flex items-center gap-1.5 bg-navy-100 text-navy-900 px-3 py-1.5 rounded-full text-sm font-medium">
                    {g.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 퍼널 직접 등록 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-blue-500" />
              퍼널 직접 등록
            </h3>
            <p className="text-xs text-gray-400 mb-3">그룹 없이 퍼널에 바로 등록합니다</p>

            <div className="space-y-3">
              <select
                value={selectedFunnelId}
                onChange={(e) => setSelectedFunnelId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">퍼널 선택</option>
                {funnels.map((f) => (
                  <option
                    key={f.id}
                    value={f.id}
                    disabled={enrolledFunnelIds.has(f.id)}
                  >
                    {f.name}{enrolledFunnelIds.has(f.id) ? ' (이미 등록됨)' : ''}
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={enrollStartDate}
                onChange={(e) => setEnrollStartDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="시작일 (비우면 오늘)"
              />

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enrollSendNow}
                  onChange={(e) => setEnrollSendNow(e.target.checked)}
                  className="w-4 h-4 rounded accent-blue-600"
                />
                <span className="text-sm text-gray-700">즉시 첫 메시지 발송</span>
              </label>

              {enrollError && <p className="text-xs text-red-500">{enrollError}</p>}

              <button
                onClick={async () => {
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
                disabled={!selectedFunnelId || enrolling}
                className="w-full py-2.5 bg-navy-900 text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-navy-800"
              >
                {enrolling ? '등록 중...' : '퍼널 등록'}
              </button>
            </div>

            {/* 등록된 퍼널 목록 */}
            {(contact.vipSequences ?? []).length > 0 && (
              <div className="mt-4 border-t pt-3">
                <p className="text-xs font-medium text-gray-500 mb-2">등록된 퍼널</p>
                <div className="space-y-1.5">
                  {(contact.vipSequences ?? []).map((seq) => {
                    const funnel = funnels.find((f) => f.id === seq.funnelId);
                    return (
                      <div key={seq.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-xs font-medium text-gray-700">{funnel?.name ?? seq.funnelId}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          seq.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {seq.status === 'ACTIVE' ? '진행중' : seq.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 이관 이력 */}
          {(transferLogs.length > 0 || loadingTransfer) && (
            <div className="mt-6 border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">DB 이관 이력</h3>
              {loadingTransfer ? (
                <div className="space-y-2">
                  {[1,2].map(i => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
                </div>
              ) : (
                <div className="space-y-2">
                  {transferLogs.map(log => (
                    <div key={log.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2.5 text-sm">
                      <span className="text-gray-500 shrink-0">
                        {new Date(log.createdAt).toLocaleDateString('ko-KR')}
                      </span>
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-700 truncate">
                        {log.fromOrg?.name ?? '외부'} → {log.toOrg?.name ?? '외부'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SMS 발송 내역 탭 */}
      {tab === "sms" && (
        <div className="space-y-2">
          {smsLoading ? (
            <div className="text-center text-sm text-gray-400 py-8">불러오는 중...</div>
          ) : smsLogs.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">발송 내역이 없습니다.</p>
          ) : (
            smsLogs.map((log) => (
              <div key={log.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    log.status === "SENT"    ? "bg-green-100 text-green-700" :
                    log.status === "BLOCKED" ? "bg-yellow-100 text-yellow-700" :
                                              "bg-red-100 text-red-700"
                  }`}>
                    {log.status === "SENT" ? "✅ 발송완료" : log.status === "BLOCKED" ? "🚫 차단" : "❌ 실패"}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(log.sentAt).toLocaleString("ko-KR")}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{log.contentPreview}</p>
                <p className="text-xs text-gray-400 mt-1">{log.phone} · {log.channel}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
