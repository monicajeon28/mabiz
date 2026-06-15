"use client";

/**
 * ContactSlidePanel — 5탭: 콜기록/메모/퍼널/문자/제휴
 * - 캠페인/위험도 탭 제거, 그룹 탭 → 퍼널 탭
 * - 문자 탭: 즉시발송/예약발송 모달 연결 버그 수정
 * - 제휴 탭: 담당자 없을 때 DB 공유 기능
 * - savingCallLog 전달 버그 수정
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, Search, Phone, MessageSquare, FileText, GitBranch, Building2, Send, Loader, Share2,
} from "lucide-react";
import { useToast } from "@/lib/api/use-toast";
import { logger } from "@/lib/logger";
import { Contact, CallLog } from "@/types/contact";
import { CallForm } from "@/types/call-form";
import type { ObjectionData } from "@/lib/objections/validation";
import { useContactOperations, EMPTY_CALL_FORM } from "./[id]/use-contact-operations";

import ContactCallTab from "./[id]/ContactCallTab";
import ContactMemoTab from "./[id]/ContactMemoTab";
import ContactSmsTab from "./[id]/ContactSmsTab";
import FunnelEnrollSection from "./[id]/FunnelEnrollSection";

type Funnel = { id: string; name: string; funnelType: string };
type SmsLog = { id: string; phone: string; contentPreview: string; status: string; channel: string; sentAt: string };
type VipSequence = { id: string; funnelId: string; status: string; startDate: string };
type TabKey = "call" | "memo" | "funnel" | "sms" | "affiliate";
type ShareTarget = { id: string; displayName: string | null; loginId?: string | null; role: string; orgName: string };

export interface ContactSlidePanelProps {
  contact: Contact | null;
  open: boolean;
  onClose: () => void;
  onRefresh?: (updatedContact?: Partial<Contact> & { id: string }) => void;
}

const backdropVariants = { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } };
const panelDesktopVariants = {
  hidden: { x: "100%" },
  visible: { x: 0, transition: { type: "tween", duration: 0.28, ease: "easeOut" } },
  exit: { x: "100%", transition: { type: "tween", duration: 0.22, ease: "easeIn" } },
};
const panelMobileVariants = {
  hidden: { y: "100%" },
  visible: { y: 0, transition: { type: "tween", duration: 0.28, ease: "easeOut" } },
  exit: { y: "100%", transition: { type: "tween", duration: 0.22, ease: "easeIn" } },
};

const TAB_LIST: { key: TabKey; icon: React.ReactNode; label: string }[] = [
  { key: "call",      icon: <Phone className="w-4 h-4" />,         label: "콜기록" },
  { key: "memo",      icon: <FileText className="w-4 h-4" />,      label: "메모" },
  { key: "funnel",    icon: <GitBranch className="w-4 h-4" />,     label: "자동화" },
  { key: "sms",       icon: <MessageSquare className="w-4 h-4" />, label: "문자" },
  { key: "affiliate", icon: <Building2 className="w-4 h-4" />,     label: "제휴" },
];

// ── SMS 인라인 모달 ──────────────────────────────────────────────────────────
function SmsModal({
  contact, mode, onClose, onSent,
}: {
  contact: { id: string; name: string; phone: string };
  mode: "instant" | "scheduled";
  onClose: () => void;
  onSent: () => void;
}) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) { toast({ title: "메시지 내용을 입력하세요.", variant: "destructive" }); return; }
    if (mode === "scheduled" && !scheduledAt) { toast({ title: "발송 예약 시간을 선택하세요.", variant: "destructive" }); return; }
    setSending(true);
    try {
      let res: Response;
      if (mode === "instant") {
        // 즉시 발송: /api/contacts/[id]/sms
        res = await fetch(`/api/contacts/${contact.id}/sms`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        });
      } else {
        // 예약 발송: /api/scheduled-sms
        res = await fetch("/api/scheduled-sms", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId: contact.id, message, scheduledAt }),
        });
      }
      const data = await res.json();
      if (data.ok) { toast({ title: mode === "instant" ? "문자 발송 완료" : "예약 발송 등록 완료", variant: "success" }); onSent(); onClose(); }
      else {
        const isConfigError = data.message?.includes("SMS 설정");
        toast({
          title: data.message ?? "발송 실패",
          description: isConfigError ? "설정 → SMS 메뉴에서 Aligo 정보를 입력하세요." : undefined,
          variant: "destructive",
        });
      }
    } catch (err) {
      logger.error("[SmsModal send]", { err });
      toast({ title: "네트워크 오류", variant: "destructive" });
    } finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md mx-auto p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{mode === "instant" ? "즉시 발송" : "예약 발송"} — {contact.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-gray-400">{contact.phone}</p>
        <textarea placeholder="문자 내용을 입력하세요..." value={message} onChange={(e) => setMessage(e.target.value)} rows={4}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <p className="text-xs text-gray-400 text-right">{message.length}자</p>
        {mode === "scheduled" && (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">발송 예약 시간</label>
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={handleSend} disabled={sending}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            {sending ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? "발송 중..." : (mode === "instant" ? "지금 발송" : "예약 등록")}
          </button>
          <button onClick={onClose} className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm">취소</button>
        </div>
      </div>
    </div>
  );
}

// ── DB 공유 모달 ──────────────────────────────────────────────────────────────
function DbShareModal({ contact, onClose, onShared }: { contact: { id: string; name: string }; onClose: () => void; onShared?: () => void }) {
  const { toast } = useToast();
  const [targets, setTargets] = useState<ShareTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    fetch("/api/contacts/share-targets")
      .then(r => {
        if (r.status === 403) {
          setTargets([]);
          setLoading(false);
          return null;
        }
        return r.json();
      })
      .then(d => {
        if (d && d.ok) setTargets(d.targets ?? []);
        else if (d) setTargets([]);
      })
      .catch(() => setTargets([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredTargets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return targets;
    return targets.filter((target) =>
      (target.displayName ?? "").toLowerCase().includes(q) ||
      (target.loginId ?? "").toLowerCase().includes(q) ||
      target.role.toLowerCase().includes(q) ||
      target.orgName.toLowerCase().includes(q)
    );
  }, [query, targets]);

  const handleShare = async () => {
    if (!selectedId) { toast({ title: "전달 대상을 선택하세요.", variant: "destructive" }); return; }
    setSharing(true);
    try {
      const res = await fetch("/api/contacts/bulk-send-db", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: [contact.id], targetUserId: selectedId }),
      });
      const data = await res.json();
      if (data.ok && (data.succeeded ?? 1) > 0) {
        toast({ title: `${contact.name} DB 전달 완료`, variant: "success" });
        onShared?.();
        onClose();
      } else if (data.ok && data.succeeded === 0) {
        const reason = data.failedNames?.[0] ?? "전달 불가 상태입니다.";
        toast({ title: reason, variant: "destructive" });
      } else {
        toast({ title: data.message ?? "전달 실패", variant: "destructive" });
      }
    } catch (err) {
      logger.error("[DbShareModal share]", { err });
      toast({ title: "네트워크 오류", variant: "destructive" });
    } finally { setSharing(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md mx-auto p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">DB 공유 — {contact.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-gray-500">누구에게 이 고객 DB를 전달할지 선택하세요.</p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이름 / 아이디 / 조직 검색..."
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {loading ? (
          <div className="text-center text-sm text-gray-400 py-6">불러오는 중...</div>
        ) : filteredTargets.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            {query.trim()
              ? "검색 결과가 없습니다."
              : "이 권한으로는 DB 공유를 할 수 없습니다. 대리점장 또는 본사에 문의하세요."}
          </p>
        ) : (
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">대상 선택...</option>
            {filteredTargets.map(t => <option key={t.id} value={t.id}>{t.displayName ?? t.loginId ?? t.id} ({t.orgName} · {t.role})</option>)}
          </select>
        )}
        <div className="flex gap-2">
          <button onClick={handleShare} disabled={sharing || !selectedId}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {sharing ? <Loader className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
            {sharing ? "전달 중..." : "전달하기"}
          </button>
          <button onClick={onClose} className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm">취소</button>
        </div>
      </div>
    </div>
  );
}

// ── 퍼널 탭 ──────────────────────────────────────────────────────────────────
function FunnelTab({
  contact, funnels, selectedFunnelId, setSelectedFunnelId,
  enrollStartDate, setEnrollStartDate, enrollSendNow, setEnrollSendNow,
  enrolling, enrollError, funnelError, handleFunnelEnroll,
}: {
  contact: { id: string; vipSequences?: VipSequence[] };
  funnels: Funnel[];
  selectedFunnelId: string;
  setSelectedFunnelId: (id: string) => void;
  enrollStartDate: string;
  setEnrollStartDate: (d: string) => void;
  enrollSendNow: boolean;
  setEnrollSendNow: (v: boolean) => void;
  enrolling: boolean;
  enrollError: string;
  funnelError: string;
  handleFunnelEnroll: () => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <FunnelEnrollSection
        funnels={funnels}
        enrolledSequences={contact.vipSequences ?? []}
        selectedFunnelId={selectedFunnelId}
        setSelectedFunnelId={setSelectedFunnelId}
        enrollStartDate={enrollStartDate}
        setEnrollStartDate={setEnrollStartDate}
        enrollSendNow={enrollSendNow}
        setEnrollSendNow={setEnrollSendNow}
        enrolling={enrolling}
        enrollError={enrollError}
        funnelError={funnelError}
        onEnroll={handleFunnelEnroll}
      />
    </div>
  );
}

// ── 제휴 탭 ──────────────────────────────────────────────────────────────────
function AffiliateTab({
  contactId, contactName,
}: {
  contactId: string;
  contactName: string;
}) {
  const [affiliateInfo, setAffiliateInfo] = useState<{
    manager: { id: string; name: string; phone: string | null; email: string | null; org: string } | null;
    agent: { id: string; name: string; phone: string | null; email: string | null; org: string } | null;
  } | null>(null);
  const [afLoading, setAfLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setAfLoading(true);
    setAffiliateInfo(null);
    fetch(`/api/contacts/${contactId}/affiliate-info`, { signal: ctrl.signal })
      .then(r => r.json())
      .then(d => { if (d.ok) setAffiliateInfo(d.data); })
      .catch(err => {
        if (err?.name === "AbortError") return;
        logger.error("[AffiliateTab]", { err, contactId });
      })
      .finally(() => setAfLoading(false));
    return () => ctrl.abort();
  }, [contactId]);

  const hasManager = !!(affiliateInfo?.manager || affiliateInfo?.agent);

  if (afLoading) return (
    <div className="animate-pulse space-y-3 pt-2">
      <div className="h-6 bg-gray-200 rounded w-1/3" />
      <div className="h-20 bg-gray-100 rounded" />
    </div>
  );

  return (
    <div className="space-y-4">
      {hasManager ? (
        <div className="space-y-3">
          {affiliateInfo?.manager && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1 font-medium">본사 담당자</p>
              <p className="font-semibold text-gray-900">{affiliateInfo.manager.name}</p>
              <p className="text-sm text-gray-600">{affiliateInfo.manager.org}</p>
              {affiliateInfo.manager.phone && <a href={`tel:${affiliateInfo.manager.phone}`} className="text-sm text-blue-600 mt-1 block">{affiliateInfo.manager.phone}</a>}
              {affiliateInfo.manager.email && <a href={`mailto:${affiliateInfo.manager.email}`} className="text-xs text-gray-400 mt-0.5 block truncate">{affiliateInfo.manager.email}</a>}
            </div>
          )}
          {affiliateInfo?.agent && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1 font-medium">담당 판매원</p>
              <p className="font-semibold text-gray-900">{affiliateInfo.agent.name}</p>
              <p className="text-sm text-gray-600">{affiliateInfo.agent.org}</p>
              {affiliateInfo.agent.phone && <a href={`tel:${affiliateInfo.agent.phone}`} className="text-sm text-green-600 mt-1 block">{affiliateInfo.agent.phone}</a>}
              {affiliateInfo.agent.email && <a href={`mailto:${affiliateInfo.agent.email}`} className="text-xs text-gray-400 mt-0.5 block truncate">{affiliateInfo.agent.email}</a>}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500 mb-3">배정된 담당자가 없습니다.</p>
          <button onClick={() => setShowShareModal(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600">
            <Share2 className="w-4 h-4" />DB 공유 (담당자에게 전달)
          </button>
          <p className="text-xs text-gray-400 mt-2 text-center">누구에게 이 고객을 전달할지 선택합니다</p>
        </div>
      )}
      {showShareModal && (
        <DbShareModal
          contact={{ id: contactId, name: contactName }}
          onClose={() => setShowShareModal(false)}
          onShared={() => {
            setAffiliateInfo(null);
            setAfLoading(true);
            fetch(`/api/contacts/${contactId}/affiliate-info`)
              .then(r => r.json())
              .then(d => { if (d.ok) setAffiliateInfo(d.data); })
              .catch(err => logger.error("[AffiliateTab onShared]", { err, contactId }))
              .finally(() => setAfLoading(false));
          }}
        />
      )}
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function ContactSlidePanel({
  contact: propContact, open, onClose, onRefresh,
}: ContactSlidePanelProps) {
  const { toast } = useToast();
  const [contact, setContact] = useState<Contact | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("call");
  const [isMobile, setIsMobile] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const firstFocusable = panelRef.current.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as HTMLElement | null;
    firstFocusable?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusables = Array.from(panelRef.current!.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )) as HTMLElement[];
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeEl = document.activeElement as HTMLElement;
      if (e.shiftKey && activeEl === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && activeEl === last) { e.preventDefault(); first?.focus(); }
    };
    panelRef.current.addEventListener("keydown", handleKeyDown);
    return () => panelRef.current?.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (propContact) {
      setContact(propContact); setActiveTab("call");
      setSmsLogs([]); setSmsHasMore(true); setSmsPage(1);
      // 고객 변경 시 퍼널 선택 상태 초기화
      setSelectedFunnelId("");
      setEnrollStartDate("");
      setEnrollSendNow(false);
      setEnrollError("");
      setFunnelError("");
      funnelLoadedRef.current = false;
    }
  }, [propContact]);

  // 콜 기록 상태
  const [showCallForm, setShowCallForm] = useState(false);
  const [callForm, setCallForm] = useState<CallForm>({ ...EMPTY_CALL_FORM });
  const [selectedObjectionModal, setSelectedObjectionModal] = useState<ObjectionData | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);
  const [backing, setBacking] = useState(false);
  const [backupResult, setBackupResult] = useState<{ url: string; count: number } | null>(null);
  const [savingCallLog, setSavingCallLog] = useState(false);

  useEffect(() => {
    if (!copiedLogId) return;
    const t = setTimeout(() => setCopiedLogId(null), 1500);
    return () => clearTimeout(t);
  }, [copiedLogId]);

  // 메모 상태 (훅 이전에 선언 필요)
  const [showMemoForm, setShowMemoForm] = useState(false);
  const [memoText, setMemoText] = useState("");
  const [savingMemo, setSavingMemo] = useState(false);

  // useContactOperations 훅으로 공통 CRUD 위임
  const { addCallLog, deleteCallLog, deleteAllCallLogs, copyCallLog, backupCallLogs, addMemo, deleteMemo, deleteAllMemos } = useContactOperations({
    contactId: contact?.id ?? "",
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
    onCallLogAdded: (log, updatedLogs) => {
      if (!contact) return;
      const updated = { ...contact, callLogs: updatedLogs };
      setContact(updated);
      onRefresh?.({ id: contact.id, callLogs: updated.callLogs });
    },
    onCallLogDeleted: (_logId, remaining) => {
      if (!contact) return;
      const updated = { ...contact, callLogs: remaining };
      setContact(updated);
      onRefresh?.({ id: contact.id, callLogs: updated.callLogs });
    },
    onAllCallLogsDeleted: () => {
      if (!contact) return;
      const updated = { ...contact, callLogs: [] };
      setContact(updated);
      onRefresh?.({ id: contact.id, callLogs: [] });
    },
    onMemoAdded: (_memo, updatedMemos) => {
      if (!contact) return;
      const updated = { ...contact, memos: updatedMemos };
      setContact(updated);
      onRefresh?.({ id: contact.id, memos: updated.memos });
    },
    onMemoDeleted: (_memoId, remaining) => {
      if (!contact) return;
      const updated = { ...contact, memos: remaining };
      setContact(updated);
      onRefresh?.({ id: contact.id, memos: updated.memos });
    },
    onAllMemosDeleted: () => {
      if (!contact) return;
      const updated = { ...contact, memos: [] };
      setContact(updated);
      onRefresh?.({ id: contact.id, memos: [] });
    },
    autoBackupOnAdd: true,
  });

  // 퍼널 상태
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [selectedFunnelId, setSelectedFunnelId] = useState("");
  const [enrollStartDate, setEnrollStartDate] = useState("");
  const [enrollSendNow, setEnrollSendNow] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState("");
  const [funnelError, setFunnelError] = useState("");
  const funnelLoadedRef = useRef(false);

  useEffect(() => {
    if (activeTab !== "funnel" || funnelLoadedRef.current) return;
    funnelLoadedRef.current = true;
    fetch("/api/funnels")
      .then(r => r.json())
      .then(d => {
        if (d.ok) setFunnels(d.funnels ?? []);
        else setFunnelError("자동 메시지 목록을 불러오지 못했습니다.");
      })
      .catch(() => setFunnelError("자동 메시지 불러오기 실패. 다시 시도하세요."));
  }, [activeTab]);

  const handleFunnelEnroll = useCallback(async () => {
    if (!contact || !selectedFunnelId) return;
    setEnrolling(true); setEnrollError("");
    try {
      const res = await fetch(`/api/funnels/${selectedFunnelId}/enroll`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: contact.id, startDate: enrollStartDate || undefined, sendNow: enrollSendNow }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const d = await res.json();
      if (d.ok) {
        // 낙관적 업데이트: 재조회 없이 vipSequences에 직접 추가
        const newSeq: VipSequence = {
          id: d.sequence?.id ?? `temp-${Date.now()}`,
          funnelId: selectedFunnelId,
          status: "ACTIVE",
          startDate: enrollStartDate || new Date().toISOString(),
        };
        setContact(prev => prev ? {
          ...prev,
          vipSequences: [...(prev.vipSequences ?? []), newSeq],
        } : prev);
        setSelectedFunnelId(""); setEnrollStartDate(""); setEnrollSendNow(false);
        toast({ title: "자동 메시지 등록 완료", variant: "success" });
        onRefresh?.({ id: contact.id });
      } else { setEnrollError(d.message ?? "등록 실패"); }
    } catch (err) { logger.error("[handleFunnelEnroll failed]", { err }); setEnrollError(err instanceof Error ? err.message : "네트워크 오류"); }
    finally { setEnrolling(false); }
  }, [contact, selectedFunnelId, enrollStartDate, enrollSendNow, onRefresh, toast]);

  // SMS 상태
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsPage, setSmsPage] = useState(1);
  const [smsHasMore, setSmsHasMore] = useState(true);
  const [smsModalMode, setSmsModalMode] = useState<"instant" | "scheduled" | null>(null);

  const loadMoreSmsLogs = useCallback(async () => {
    if (!contact || smsLoading || !smsHasMore) return;
    const nextPage = smsPage + 1;
    setSmsLoading(true);
    try {
      const res = await fetch(`/api/contacts/${contact.id}/sms-logs?limit=20&page=${nextPage}`);
      const d = await res.json();
      if (d.ok) {
        setSmsLogs(prev => [...prev, ...(d.logs ?? [])]);
        setSmsHasMore(d.hasMore ?? false);
        setSmsPage(nextPage);
      }
    } catch (err) {
      logger.error("[loadMoreSmsLogs]", { err });
    } finally {
      setSmsLoading(false);
    }
  }, [contact, smsLoading, smsHasMore, smsPage]);

  const tabFetchAbortRef = useRef<AbortController | null>(null);
  const handleTabChange = useCallback((key: TabKey) => {
    setActiveTab(key);
    if (!contact) return;
    tabFetchAbortRef.current?.abort();
    const ctrl = new AbortController();
    tabFetchAbortRef.current = ctrl;
    if (key === "sms" && smsLogs.length === 0 && smsHasMore) {
      setSmsLoading(true);
      fetch(`/api/contacts/${contact.id}/sms-logs?limit=20&page=1`, { signal: ctrl.signal })
        .then(r => r.json())
        .then(d => { if (d.ok) { setSmsLogs(d.logs ?? []); setSmsHasMore(d.hasMore ?? false); setSmsPage(1); } setSmsLoading(false); })
        .catch(err => { if (err?.name === "AbortError") return; logger.error("[SlidePanel sms-logs]", { err }); setSmsLoading(false); });
    }
  }, [contact, smsLogs.length, smsHasMore]);

  const tabLabel = (key: TabKey, label: string): string => {
    if (!contact) return label;
    if (key === "call") return `${label} (${contact.callLogs.length})`;
    if (key === "memo") return `${label} (${contact.memos.length})`;
    return label;
  };

  return (
    <AnimatePresence>
      {open && contact && (
        <>
          <motion.div key="overlay" className="fixed inset-0 bg-black/40 z-40"
            variants={backdropVariants} initial="hidden" animate="visible" exit="exit"
            onClick={onClose} aria-hidden="true" />
          <motion.aside key="panel" ref={panelRef} role="dialog" aria-modal="true"
            aria-label={`${contact.name} 고객 상세`}
            className={["fixed z-50 bg-white shadow-2xl flex flex-col overflow-hidden",
              "bottom-0 left-0 right-0 h-[90vh] rounded-t-2xl",
              "sm:inset-y-0 sm:left-auto sm:right-0 sm:bottom-auto",
              "sm:w-[40%] sm:min-w-[480px] sm:max-w-[600px]",
              "sm:h-full sm:rounded-none sm:rounded-l-2xl",
            ].join(" ")}
            variants={isMobile ? panelMobileVariants : panelDesktopVariants}
            initial="hidden" animate="visible" exit="exit">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center text-sm font-bold shrink-0">
                  {contact.name.slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{contact.name}</p>
                  <p className="text-xs text-gray-400 truncate">{contact.phone}</p>
                </div>
                <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{contact.type}</span>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors" aria-label="패널 닫기">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Bar */}
            <div className="flex border-b border-gray-100 bg-white shrink-0 overflow-x-auto scrollbar-none">
              {TAB_LIST.map(({ key, icon, label }) => (
                <button key={key} onClick={() => handleTabChange(key)}
                  className={["flex items-center gap-1.5 px-3.5 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors shrink-0",
                    activeTab === key ? "border-amber-500 text-amber-700 bg-amber-50/40" : "border-transparent text-gray-400 hover:text-gray-600",
                  ].join(" ")}>
                  {icon}{tabLabel(key, label)}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {activeTab === "call" && (
                <ContactCallTab
                  contact={contact} contactId={contact.id}
                  callForm={callForm} setCallForm={setCallForm}
                  showCallForm={showCallForm} setShowCallForm={setShowCallForm}
                  selectedObjectionModal={selectedObjectionModal} setSelectedObjectionModal={setSelectedObjectionModal}
                  expandedLogId={expandedLogId} setExpandedLogId={setExpandedLogId}
                  copiedLogId={copiedLogId}
                  addCallLog={addCallLog} savingCallLog={savingCallLog}
                  deleteCallLog={deleteCallLog} deleteAllCallLogs={() => deleteAllCallLogs(contact.callLogs.length)}
                  copyCallLog={copyCallLog}
                />
              )}
              {activeTab === "memo" && (
                <ContactMemoTab
                  contact={contact}
                  showMemoForm={showMemoForm} setShowMemoForm={setShowMemoForm}
                  memoText={memoText} setMemoText={setMemoText}
                  addMemo={addMemo} deleteMemo={deleteMemo} deleteAllMemos={() => deleteAllMemos(contact.memos.length)}
                  savingMemo={savingMemo}
                />
              )}
              {activeTab === "funnel" && (
                <FunnelTab
                  contact={contact} funnels={funnels}
                  selectedFunnelId={selectedFunnelId} setSelectedFunnelId={setSelectedFunnelId}
                  enrollStartDate={enrollStartDate} setEnrollStartDate={setEnrollStartDate}
                  enrollSendNow={enrollSendNow} setEnrollSendNow={setEnrollSendNow}
                  enrolling={enrolling} enrollError={enrollError}
                  funnelError={funnelError}
                  handleFunnelEnroll={handleFunnelEnroll}
                />
              )}
              {activeTab === "sms" && (
                <ContactSmsTab
                  smsLogs={smsLogs} smsLoading={smsLoading}
                  onOpenSmsModal={() => setSmsModalMode("instant")}
                  onOpenSchedModal={() => setSmsModalMode("scheduled")}
                  hasMore={smsHasMore}
                  onLoadMore={loadMoreSmsLogs}
                />
              )}
              {activeTab === "affiliate" && (
                <AffiliateTab
                  contactId={contact.id} contactName={contact.name}
                />
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-100 shrink-0 bg-gray-50">
              <a href={`/contacts/${contact.id}`}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                onClick={onClose}>
                전체 상세 페이지에서 보기
              </a>
            </div>
          </motion.aside>

          {/* SMS 발송 모달 */}
          {smsModalMode && (
            <SmsModal
              contact={{ id: contact.id, name: contact.name, phone: contact.phone }}
              mode={smsModalMode}
              onClose={() => setSmsModalMode(null)}
              onSent={() => {
                setSmsLogs([]); setSmsHasMore(true); setSmsPage(1); setSmsLoading(true);
                fetch(`/api/contacts/${contact.id}/sms-logs?limit=20&page=1`)
                  .then(r => r.json())
                  .then(d => { if (d.ok) { setSmsLogs(d.logs ?? []); setSmsHasMore(d.hasMore ?? false); } setSmsLoading(false); })
                  .catch(() => setSmsLoading(false));
              }}
            />
          )}
        </>
      )}
    </AnimatePresence>
  );
}
