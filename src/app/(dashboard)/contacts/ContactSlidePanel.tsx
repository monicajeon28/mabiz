"use client";

/**
 * ContactSlidePanel — 고객 상세 정보를 슬라이드 패널로 표시
 *
 * - 데스크톱: 화면 우측 40% 슬라이드 인
 * - 모바일(sm 이하): 하단 90vh Sheet
 * - Optimistic Update: 쓰기 직후 localContact 즉시 반영 → onRefresh() 콜백으로 부모 목록 갱신
 * - 7개 탭 (콜/메모/그룹/SMS/캠페인/예약/위험도) — 기존 컴포넌트 100% 재사용
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, Phone, MessageSquare, FileText, Users, Send, AlertTriangle, Building2,
} from "lucide-react";
import { useToast } from "@/lib/api/use-toast";
import { logger } from "@/lib/logger";
import { Contact, CallLog } from "@/types/contact";
import { CallForm } from "@/types/call-form";
import type { ObjectionData } from "@/lib/objections/validation";

import ContactCallTab from "./[id]/ContactCallTab";
import ContactMemoTab from "./[id]/ContactMemoTab";
import ContactGroupTab from "./[id]/ContactGroupTab";
import ContactSmsTab from "./[id]/ContactSmsTab";
import ContactAffiliateCard from "./[id]/ContactAffiliateCard";
import ContactRiskPanel from "./[id]/ContactRiskPanel";

// ─── 타입 ────────────────────────────────────────────────────────────────────

type Group = { id: string; name: string; funnelId?: string | null };
type Funnel = { id: string; name: string; funnelType: string };

type SmsLog = {
  id: string; phone: string; contentPreview: string;
  status: string; channel: string; sentAt: string;
};

type CampaignHistory = {
  id: string; channel: string; status: string; sentAt: string | null; createdAt: string;
  campaign: { id: string; title: string; sendSms: boolean; sendEmail: boolean } | null;
};

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

type TabKey = "call" | "memo" | "group" | "sms" | "campaigns" | "reservations" | "affiliate" | "risk";

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ContactSlidePanelProps {
  /** 표시할 고객 데이터. null이면 패널 닫힘 처리 */
  contact: Contact | null;
  /** 패널 열림 여부 */
  open: boolean;
  /** 패널 닫기 핸들러 */
  onClose: () => void;
  /**
   * 쓰기 작업 성공 후 부모 목록 새로고침 콜백 (선택)
   * updatedContact가 있으면 부모가 해당 항목만 교체, 없으면 전체 재조회
   */
  onRefresh?: (updatedContact?: Partial<Contact> & { id: string }) => void;
}

// ─── 애니메이션 variants ──────────────────────────────────────────────────────

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

// 데스크톱: 우측에서 슬라이드 인
const panelDesktopVariants = {
  hidden: { x: "100%" },
  visible: { x: 0, transition: { type: "tween", duration: 0.28, ease: "easeOut" } },
  exit:   { x: "100%", transition: { type: "tween", duration: 0.22, ease: "easeIn" } },
};

// 모바일: 아래에서 슬라이드 인
const panelMobileVariants = {
  hidden: { y: "100%" },
  visible: { y: 0, transition: { type: "tween", duration: 0.28, ease: "easeOut" } },
  exit:   { y: "100%", transition: { type: "tween", duration: 0.22, ease: "easeIn" } },
};

// ─── 탭 정의 ─────────────────────────────────────────────────────────────────

const TAB_LIST: { key: TabKey; icon: React.ReactNode; label: string }[] = [
  { key: "call",         icon: <Phone className="w-4 h-4" />,         label: "콜기록" },
  { key: "memo",         icon: <FileText className="w-4 h-4" />,      label: "메모" },
  { key: "group",        icon: <Users className="w-4 h-4" />,         label: "그룹" },
  { key: "sms",          icon: <MessageSquare className="w-4 h-4" />, label: "문자" },
  { key: "campaigns",    icon: <Send className="w-4 h-4" />,          label: "캠페인" },
  { key: "affiliate",    icon: <Building2 className="w-4 h-4" />,     label: "제휴" },
  { key: "risk",         icon: <AlertTriangle className="w-4 h-4" />, label: "위험도" },
];

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function ContactSlidePanel({
  contact: propContact,
  open,
  onClose,
  onRefresh,
}: ContactSlidePanelProps) {
  const { toast } = useToast();

  // Panel 내부 독립 Contact state (Optimistic Update용)
  const [contact, setContact] = useState<Contact | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("call");

  // ESC 키로 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // propContact 변경 시 내부 상태 동기화
  useEffect(() => {
    if (propContact) {
      setContact(propContact);
      setActiveTab("call");
      // SMS/캠페인/예약 상태 초기화
      setSmsLogs([]); setSmsHasMore(true); setSmsPage(1);
      setCampaignHistories([]); setCampaignLoading(false);
      setReservations([]); setReservationLoaded(false);
    }
  }, [propContact]);

  // ── 콜 기록 상태 ──────────────────────────────────────────────────────────
  const [showCallForm, setShowCallForm] = useState(false);
  const [callForm, setCallForm] = useState<CallForm>({
    content: "", result: "INTERESTED", convictionScore: "5",
    nextAction: "", scheduledAt: "", objectionId: "",
    customerReaction: "neutral", recovered: false, recoveryTime: "",
  });
  const [selectedObjectionModal, setSelectedObjectionModal] = useState<ObjectionData | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);
  const [backing, setBacking] = useState(false);
  const [backupResult, setBackupResult] = useState<{ url: string; count: number } | null>(null);

  useEffect(() => {
    if (!copiedLogId) return;
    const t = setTimeout(() => setCopiedLogId(null), 1500);
    return () => clearTimeout(t);
  }, [copiedLogId]);

  const addCallLog = useCallback(async () => {
    if (!contact) return;
    const res = await fetch(`/api/contacts/${contact.id}/call-logs`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(callForm),
    });
    const data = await res.json();
    if (data.ok) {
      const updated = { ...contact, callLogs: [data.log, ...contact.callLogs] };
      setContact(updated);
      setShowCallForm(false);
      setCallForm({ content: "", result: "INTERESTED", convictionScore: "5", nextAction: "", scheduledAt: "", objectionId: "", customerReaction: "neutral", recovered: false, recoveryTime: "" });
      setSelectedObjectionModal(null);
      onRefresh?.({ id: contact.id, callLogs: updated.callLogs });
      toast({ title: "콜 기록 저장", variant: "success" });
    } else {
      toast({ title: "저장 실패", description: data.message, variant: "destructive" });
    }
  }, [contact, callForm, toast, onRefresh]);

  const deleteCallLog = useCallback(async (logId: string) => {
    if (!contact) return;
    if (!confirm("이 콜 기록을 삭제할까요?")) return;
    const res = await fetch(`/api/contacts/${contact.id}/call-logs?logId=${logId}`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) {
      const updated = { ...contact, callLogs: contact.callLogs.filter(l => l.id !== logId) };
      setContact(updated);
      if (expandedLogId === logId) setExpandedLogId(null);
      onRefresh?.({ id: contact.id, callLogs: updated.callLogs });
    }
  }, [contact, expandedLogId, onRefresh]);

  const deleteAllCallLogs = useCallback(async () => {
    if (!contact) return;
    if (!confirm(`콜 기록 ${contact.callLogs.length}건을 전체 삭제할까요?`)) return;
    const res = await fetch(`/api/contacts/${contact.id}/call-logs`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) {
      const updated = { ...contact, callLogs: [] };
      setContact(updated);
      setExpandedLogId(null);
      onRefresh?.({ id: contact.id, callLogs: [] });
    }
  }, [contact, onRefresh]);

  const backupCallLogs = useCallback(async () => {
    if (!contact) return;
    setBacking(true); setBackupResult(null);
    try {
      const res = await fetch(`/api/contacts/${contact.id}/call-logs/backup`, { method: "POST" });
      const data = await res.json();
      if (data.ok) setBackupResult({ url: data.viewUrl, count: data.count });
      else toast({ title: "백업 실패", description: data.message, variant: "destructive" });
    } finally { setBacking(false); }
  }, [contact, toast]);

  const copyCallLog = useCallback((log: CallLog) => {
    const RESULT_KO: Record<string, string> = {
      INTERESTED: "관심있음", PENDING: "보류", REJECTED: "거절", RESCHEDULED: "재콜예약",
    };
    const dt = new Date(log.createdAt).toLocaleString("ko-KR");
    const parts = [
      `[${dt}]`,
      log.result ? (RESULT_KO[log.result] ?? log.result) : "",
      log.convictionScore ? `확신도 ${log.convictionScore}점` : "",
      log.content ?? "",
      log.nextAction ? `→ ${log.nextAction}` : "",
    ].filter(Boolean);
    navigator.clipboard.writeText(parts.join(" | ")).then(() => setCopiedLogId(log.id));
  }, []);

  // ── 메모 상태 ─────────────────────────────────────────────────────────────
  const [showMemoForm, setShowMemoForm] = useState(false);
  const [memoText, setMemoText] = useState("");
  const [savingMemo, setSavingMemo] = useState(false);

  const addMemo = useCallback(async () => {
    if (!contact || !memoText.trim() || savingMemo) return;
    setSavingMemo(true);
    try {
      const res = await fetch(`/api/contacts/${contact.id}/memos`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: memoText }),
      });
      const data = await res.json();
      if (data.ok) {
        const updated = { ...contact, memos: [data.memo, ...contact.memos] };
        setContact(updated);
        setShowMemoForm(false); setMemoText("");
        onRefresh?.({ id: contact.id, memos: updated.memos });
        toast({ title: "메모 저장", variant: "success" });
      } else {
        toast({ title: "저장 실패", description: data.message, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "네트워크 오류", description: err instanceof Error ? err.message : "실패", variant: "destructive" });
      logger.error("[SlidePanel addMemo]", { err });
    } finally { setSavingMemo(false); }
  }, [contact, memoText, savingMemo, toast, onRefresh]);

  const deleteMemo = useCallback(async (memoId: string) => {
    if (!contact) return;
    if (!confirm("이 메모를 삭제할까요?")) return;
    const res = await fetch(`/api/contacts/${contact.id}/memos?memoId=${memoId}`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) {
      const updated = { ...contact, memos: contact.memos.filter(m => m.id !== memoId) };
      setContact(updated);
      onRefresh?.({ id: contact.id, memos: updated.memos });
    }
  }, [contact, onRefresh]);

  const deleteAllMemos = useCallback(async () => {
    if (!contact) return;
    if (!confirm(`메모 ${contact.memos.length}건을 전체 삭제할까요?`)) return;
    const res = await fetch(`/api/contacts/${contact.id}/memos`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) {
      const updated = { ...contact, memos: [] };
      setContact(updated);
      onRefresh?.({ id: contact.id, memos: [] });
    }
  }, [contact, onRefresh]);

  // ── 그룹 상태 ─────────────────────────────────────────────────────────────
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState("");
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [selectedFunnelId, setSelectedFunnelId] = useState("");
  const [enrollStartDate, setEnrollStartDate] = useState("");
  const [enrollSendNow, setEnrollSendNow] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState("");
  const [transferLogs, setTransferLogs] = useState<Array<{
    id: string; createdAt: string; transferType: string; newContactId: string | null;
    transferredBy: string; fromOrg: { name: string } | null; toOrg: { name: string } | null;
    toUserName: string | null; toUserOrgName: string | null; canRecall: boolean;
  }>>([]);
  const [loadingTransfer, setLoadingTransfer] = useState(false);
  const groupsLoadedRef = useRef(false);

  // 그룹 탭 클릭 시 데이터 로드
  useEffect(() => {
    if (activeTab !== "group" || groupsLoadedRef.current) return;
    groupsLoadedRef.current = true;
    Promise.allSettled([
      fetch("/api/groups").then(r => r.json()),
      fetch("/api/funnels").then(r => r.json()),
    ]).then(([g, f]) => {
      if (g.status === "fulfilled" && g.value?.ok) setAllGroups(g.value.groups ?? []);
      if (f.status === "fulfilled" && f.value?.ok) setFunnels(f.value.funnels ?? []);
    }).catch(err => logger.error("[SlidePanel groups]", { err }));

    if (contact?.id) {
      setLoadingTransfer(true);
      fetch(`/api/contacts/${contact.id}/transfer-logs`)
        .then(r => r.json())
        .then(d => { if (d.ok) setTransferLogs(d.logs ?? []); })
        .catch(err => logger.error("[SlidePanel transfer-logs]", { err }))
        .finally(() => setLoadingTransfer(false));
    }
  }, [activeTab, contact?.id]);

  // 패널이 닫히면 그룹 로드 플래그 리셋 (다음 번 열릴 때 재로드)
  useEffect(() => { if (!open) groupsLoadedRef.current = false; }, [open]);

  const assignGroup = useCallback(async () => {
    if (!contact || !selectedGroup) return;
    setAssigning(true); setAssignMsg("");
    const res = await fetch(`/api/groups/${selectedGroup}/members`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactIds: [contact.id] }),
    });
    const data = await res.json();
    if (data.ok) {
      const g = allGroups.find(g => g.id === selectedGroup);
      setAssignMsg(g?.funnelId ? `✅ "${g.name}" 그룹 배정 + 퍼널 자동 시작!` : `✅ "${g?.name}" 그룹 배정 완료`);
      const updated = { ...contact, groups: [...contact.groups, { group: { id: g!.id, name: g!.name } }] };
      setContact(updated);
      setSelectedGroup("");
      onRefresh?.({ id: contact.id, groups: updated.groups });
    }
    setAssigning(false);
  }, [contact, selectedGroup, allGroups, onRefresh]);

  const handleFunnelEnroll = useCallback(async () => {
    if (!contact || !selectedFunnelId) return;
    setEnrolling(true); setEnrollError("");
    const res = await fetch(`/api/funnels/${selectedFunnelId}/enroll`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: contact.id, startDate: enrollStartDate || undefined, sendNow: enrollSendNow }),
    });
    const d = await res.json();
    if (d.ok) {
      setSelectedFunnelId(""); setEnrollStartDate(""); setEnrollSendNow(false);
      // 갱신된 contact 재조회
      fetch(`/api/contacts/${contact.id}`).then(r => r.json()).then(cd => {
        if (cd.ok) { setContact(cd.contact); onRefresh?.({ id: contact.id }); }
      }).catch(err => logger.error("[SlidePanel funnelEnroll refresh]", { err }));
    } else {
      setEnrollError(d.message ?? "등록 실패");
    }
    setEnrolling(false);
  }, [contact, selectedFunnelId, enrollStartDate, enrollSendNow, onRefresh]);

  // ── SMS 상태 ──────────────────────────────────────────────────────────────
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsPage, setSmsPage] = useState(1);
  const [smsHasMore, setSmsHasMore] = useState(true);

  // ── 캠페인 상태 ───────────────────────────────────────────────────────────
  const [campaignHistories, setCampaignHistories] = useState<CampaignHistory[]>([]);
  const [campaignLoading, setCampaignLoading] = useState(false);

  // ── 예약 상태 ─────────────────────────────────────────────────────────────
  const [reservations, setReservations] = useState<ReservationItem[]>([]);
  const [reservationLoaded, setReservationLoaded] = useState(false);
  const [reservationLoading, setReservationLoading] = useState(false);

  // ── Day 0-3 시퀀스 ────────────────────────────────────────────────────────
  const [sequenceLoading, setSequenceLoading] = useState(false);

  const startDay0_3Sequence = useCallback(async (contactId: string) => {
    if (!confirm("Day 0-3 SMS 자동화 시퀀스를 시작하시겠어요?")) return;
    setSequenceLoading(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}/start-day0-3-sequence`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendNow: true }),
      });
      const data = await res.json();
      if (data.ok) toast({ title: "✅ Day 0-3 시퀀스가 시작되었습니다!", variant: "success" });
      else toast({ title: data.message ?? "시퀀스 시작 실패", variant: "destructive" });
    } catch (err) {
      logger.error("[SlidePanel Day0-3]", { err, contactId });
      toast({ title: "오류 발생", variant: "destructive" });
    } finally { setSequenceLoading(false); }
  }, [toast]);

  // ── 탭 전환 핸들러 (lazy load) ─────────────────────────────────────────────
  const handleTabChange = useCallback((key: TabKey) => {
    setActiveTab(key);
    if (!contact) return;

    if (key === "sms" && smsLogs.length === 0 && smsHasMore) {
      setSmsLoading(true);
      fetch(`/api/contacts/${contact.id}/sms-logs?limit=20&page=1`)
        .then(r => r.json())
        .then(d => {
          if (d.ok) { setSmsLogs(d.logs ?? []); setSmsHasMore(d.hasMore ?? false); setSmsPage(1); }
          setSmsLoading(false);
        })
        .catch(err => { logger.error("[SlidePanel sms-logs]", { err }); setSmsLoading(false); });
    }

    if (key === "campaigns" && campaignHistories.length === 0) {
      setCampaignLoading(true);
      fetch(`/api/contacts/${contact.id}/campaigns?limit=20&page=1`)
        .then(r => r.json())
        .then(d => { if (d.ok) setCampaignHistories(d.histories ?? []); setCampaignLoading(false); })
        .catch(err => { logger.error("[SlidePanel campaigns]", { err }); setCampaignLoading(false); });
    }

    if (key === "reservations" && !reservationLoaded) {
      setReservationLoading(true);
      fetch(`/api/contacts/${contact.id}/reservations`)
        .then(r => r.json())
        .then(d => { if (d.ok) setReservations(d.reservations ?? []); setReservationLoaded(true); setReservationLoading(false); })
        .catch(err => { logger.error("[SlidePanel reservations]", { err }); setReservationLoading(false); });
    }
  }, [contact, smsLogs.length, smsHasMore, campaignHistories.length, reservationLoaded]);

  // ── 탭 카운트 라벨 ────────────────────────────────────────────────────────
  const tabLabel = (key: TabKey, label: string): string => {
    if (!contact) return label;
    if (key === "call") return `${label} (${contact.callLogs.length})`;
    if (key === "memo") return `${label} (${contact.memos.length})`;
    return label;
  };

  // ─── 렌더 ─────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {open && contact && (
        <>
          {/* Overlay */}
          <motion.div
            key="overlay"
            className="fixed inset-0 bg-black/40 z-40"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel — 데스크톱: 우측 슬라이드 / 모바일: 하단 Sheet */}
          <motion.aside
            key="panel"
            role="dialog"
            aria-modal="true"
            aria-label={`${contact.name} 고객 상세`}
            className={[
              // 공통
              "fixed z-50 bg-white shadow-2xl flex flex-col overflow-hidden",
              // 모바일: 하단 Sheet
              "bottom-0 left-0 right-0 h-[90vh] rounded-t-2xl",
              // 데스크톱: 우측 패널
              "sm:inset-y-0 sm:left-auto sm:right-0 sm:bottom-auto",
              "sm:w-[40%] sm:min-w-[480px] sm:max-w-[600px]",
              "sm:h-full sm:rounded-none sm:rounded-l-2xl",
            ].join(" ")}
            variants={
              typeof window !== "undefined" && window.innerWidth < 640
                ? panelMobileVariants
                : panelDesktopVariants
            }
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {/* 아바타 */}
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center text-sm font-bold shrink-0">
                  {contact.name.slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{contact.name}</p>
                  <p className="text-xs text-gray-400 truncate">{contact.phone}</p>
                </div>
                {/* 상태 배지 */}
                <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                  {contact.type}
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                aria-label="패널 닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ── Tab Bar ── */}
            <div className="flex border-b border-gray-100 bg-white shrink-0 overflow-x-auto scrollbar-none">
              {TAB_LIST.map(({ key, icon, label }) => (
                <button
                  key={key}
                  onClick={() => handleTabChange(key)}
                  className={[
                    "flex items-center gap-1.5 px-3.5 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors shrink-0",
                    activeTab === key
                      ? "border-amber-500 text-amber-700 bg-amber-50/40"
                      : "border-transparent text-gray-400 hover:text-gray-600",
                  ].join(" ")}
                >
                  {icon}
                  {tabLabel(key, label)}
                </button>
              ))}
            </div>

            {/* ── Tab Content ── */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {/* 콜기록 */}
              {activeTab === "call" && (
                <ContactCallTab
                  contact={contact}
                  contactId={contact.id}
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

              {/* 메모 */}
              {activeTab === "memo" && (
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

              {/* 그룹 */}
              {activeTab === "group" && (
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
                  handleFunnelEnroll={handleFunnelEnroll}
                  transferLogs={transferLogs}
                  loadingTransfer={loadingTransfer}
                />
              )}

              {/* 문자(SMS) 발송 내역 */}
              {activeTab === "sms" && (
                <ContactSmsTab
                  smsLogs={smsLogs}
                  smsLoading={smsLoading}
                />
              )}

              {/* 캠페인 이력 */}
              {activeTab === "campaigns" && (
                <div className="space-y-2">
                  {campaignLoading ? (
                    <div className="text-center text-sm text-gray-400 py-8">불러오는 중...</div>
                  ) : campaignHistories.length === 0 ? (
                    <p className="text-center text-sm text-gray-400 py-8">캠페인 이력이 없습니다.</p>
                  ) : (
                    campaignHistories.map((h) => (
                      <div key={h.id} className="bg-white border border-gray-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-800 truncate">
                            {h.campaign?.title ?? "—"}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            h.status === "SENT" ? "bg-green-100 text-green-700" :
                            h.status === "FAILED" ? "bg-red-100 text-red-700" :
                            "bg-yellow-100 text-yellow-700"
                          }`}>
                            {h.status === "SENT" ? "발송완료" : h.status === "FAILED" ? "실패" : h.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">
                          {h.sentAt ? new Date(h.sentAt).toLocaleString("ko-KR") : "—"}
                          {" · "}
                          {[h.campaign?.sendSms && "SMS", h.campaign?.sendEmail && "이메일"].filter(Boolean).join("+")}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* 제휴 정보 */}
              {activeTab === "affiliate" && (
                <ContactAffiliateCard
                  contactId={contact.id}
                  onStartSequence={startDay0_3Sequence}
                  sequenceLoading={sequenceLoading}
                />
              )}

              {/* 위험도 */}
              {activeTab === "risk" && (
                <ContactRiskPanel contactId={contact.id} />
              )}
            </div>

            {/* ── Footer: 상세 페이지 바로가기 ── */}
            <div className="px-4 py-3 border-t border-gray-100 shrink-0 bg-gray-50">
              <a
                href={`/contacts/${contact.id}`}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                onClick={onClose}
              >
                전체 상세 페이지에서 보기
              </a>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
