"use client";

/**
 * useContactOperations — 콜기록/메모 CRUD 공통 훅
 *
 * page.tsx 와 ContactSlidePanel.tsx 양쪽에서 공유.
 * 각 소비자는 자신의 상태 업데이터를 콜백으로 전달한다.
 */

import { useCallback } from "react";
import { useToast } from "@/lib/api/use-toast";
import { logger } from "@/lib/logger";
import { CallLog, Memo } from "@/types/contact";
import { CallForm } from "@/types/call-form";

const EMPTY_CALL_FORM: CallForm = {
  content: "",
  result: "INTERESTED",
  convictionScore: "5",
  nextAction: "",
  scheduledAt: "",
  objectionId: "",
  customerReaction: "neutral",
  recovered: false,
  recoveryTime: "",
};

export { EMPTY_CALL_FORM };

export interface UseContactOperationsOptions {
  contactId: string;

  // 콜 기록 상태 제어
  savingCallLog: boolean;
  setSavingCallLog: (v: boolean) => void;
  callForm: CallForm;
  setCallForm: (form: CallForm) => void;
  setShowCallForm: (v: boolean) => void;
  setSelectedObjectionModal: (v: null) => void;
  expandedLogId: string | null;
  setExpandedLogId: (id: string | null) => void;
  setCopiedLogId: (id: string | null) => void;

  // 메모 상태 제어
  savingMemo: boolean;
  setSavingMemo: (v: boolean) => void;
  memoText: string;
  setMemoText: (v: string) => void;
  setShowMemoForm: (v: boolean) => void;

  // 드라이브 백업 상태 (선택)
  setBacking?: (v: boolean) => void;
  setBackupResult?: (v: { url: string; count: number } | null) => void;

  /**
   * 콜기록 목록이 바뀔 때 호출.
   * page.tsx: setContact(c => ...) 방식으로 처리하므로 선택.
   */
  onCallLogsChange?: (logs: CallLog[]) => void;

  /**
   * 메모 목록이 바뀔 때 호출.
   */
  onMemosChange?: (memos: Memo[]) => void;

  /**
   * 공통 상태 업데이트 (page.tsx: setContact 래퍼, SlidePanel: onRefresh).
   * addCallLog / deleteCallLog / addMemo / deleteMemo 성공 후 호출.
   */
  onCallLogAdded?: (log: CallLog, allLogs: CallLog[]) => void;
  onCallLogDeleted?: (logId: string, remainingLogs: CallLog[]) => void;
  onAllCallLogsDeleted?: () => void;
  onMemoAdded?: (memo: Memo, allMemos: Memo[]) => void;
  onMemoDeleted?: (memoId: string, remainingMemos: Memo[]) => void;
  onAllMemosDeleted?: () => void;

  /**
   * 현재 콜기록/메모 목록 참조 (삭제 시 필터링에 사용).
   * page.tsx 는 함수형 업데이트를 쓰므로 불필요하지만 SlidePanel은 필요.
   */
  getCurrentCallLogs?: () => CallLog[];
  getCurrentMemos?: () => Memo[];

  /** addCallLog 성공 후 Drive 백업 자동 실행 여부 (SlidePanel 전용) */
  autoBackupOnAdd?: boolean;
}

export function useContactOperations(opts: UseContactOperationsOptions) {
  const { toast } = useToast();
  const {
    contactId,
    savingCallLog, setSavingCallLog, callForm, setCallForm,
    setShowCallForm, setSelectedObjectionModal,
    expandedLogId, setExpandedLogId, setCopiedLogId,
    savingMemo, setSavingMemo, memoText, setMemoText, setShowMemoForm,
    setBacking, setBackupResult,
    onCallLogAdded, onCallLogDeleted, onAllCallLogsDeleted,
    onMemoAdded, onMemoDeleted, onAllMemosDeleted,
    getCurrentCallLogs, getCurrentMemos,
    autoBackupOnAdd,
  } = opts;

  // ── 콜기록 추가 ────────────────────────────────────────────────────────────
  const addCallLog = useCallback(async () => {
    if (savingCallLog) return;
    if (!callForm.content.trim()) {
      toast({ title: "입력 오류", description: "콜 기록 내용을 입력하세요.", variant: "destructive" });
      return;
    }
    setSavingCallLog(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}/call-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(callForm),
      });
      const data = await res.json();
      if (data.ok) {
        const newLog: CallLog = data.log;
        const currentLogs = getCurrentCallLogs?.() ?? [];
        const updatedLogs = [newLog, ...currentLogs];
        onCallLogAdded?.(newLog, updatedLogs);
        setShowCallForm(false);
        setCallForm({ ...EMPTY_CALL_FORM });
        setSelectedObjectionModal(null);
        toast({ title: "콜 기록 저장", description: "콜 기록이 저장되었습니다.", variant: "success" });
        logger.log("[useContactOperations]", { action: "add-call-log", contactId, result: callForm.result, status: "success" });
        // SlidePanel: 저장 즉시 Drive 백업 (백그라운드, 실패 무시)
        if (autoBackupOnAdd) {
          fetch(`/api/contacts/${contactId}/call-logs/backup`, { method: "POST" }).catch(() => {});
        }
      } else {
        toast({ title: "저장 실패", description: data.message || "콜 기록 저장에 실패했습니다.", variant: "destructive" });
        logger.log("[useContactOperations]", { action: "add-call-log", contactId, status: "error", error: data.message });
      }
    } catch (err) {
      toast({ title: "네트워크 오류", description: err instanceof Error ? err.message : "콜 기록 저장에 실패했습니다.", variant: "destructive" });
      logger.error("[addCallLog error]", { err, contactId });
    } finally {
      setSavingCallLog(false);
    }
  }, [savingCallLog, callForm, contactId, setSavingCallLog, setShowCallForm, setCallForm, setSelectedObjectionModal, onCallLogAdded, getCurrentCallLogs, autoBackupOnAdd, toast]);

  // ── 콜기록 삭제 ────────────────────────────────────────────────────────────
  const deleteCallLog = useCallback(async (logId: string) => {
    if (!confirm("이 콜 기록을 삭제할까요?")) return;
    try {
      const res = await fetch(`/api/contacts/${contactId}/call-logs?logId=${logId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        const currentLogs = getCurrentCallLogs?.() ?? [];
        const remaining = currentLogs.filter(l => l.id !== logId);
        onCallLogDeleted?.(logId, remaining);
        if (expandedLogId === logId) setExpandedLogId(null);
      } else {
        toast({ title: "삭제 실패", description: data.message, variant: "destructive" });
      }
    } catch (err) {
      logger.error("[deleteCallLog failed]", { err, contactId });
      toast({ title: "네트워크 오류", variant: "destructive" });
    }
  }, [contactId, expandedLogId, setExpandedLogId, onCallLogDeleted, getCurrentCallLogs, toast]);

  // ── 콜기록 전체 삭제 ───────────────────────────────────────────────────────
  const deleteAllCallLogs = useCallback(async (count?: number) => {
    const label = count !== undefined ? `콜 기록 ${count}건을 전체 삭제할까요? 되돌릴 수 없습니다.` : "콜 기록을 전체 삭제할까요?";
    if (!confirm(label)) return;
    try {
      const res = await fetch(`/api/contacts/${contactId}/call-logs`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        onAllCallLogsDeleted?.();
        setExpandedLogId(null);
      } else {
        toast({ title: "삭제 실패", description: data.message, variant: "destructive" });
      }
    } catch (err) {
      logger.error("[deleteAllCallLogs failed]", { err, contactId });
      toast({ title: "네트워크 오류", variant: "destructive" });
    }
  }, [contactId, setExpandedLogId, onAllCallLogsDeleted, toast]);

  // ── 콜기록 클립보드 복사 ───────────────────────────────────────────────────
  const copyCallLog = useCallback((log: CallLog) => {
    const RESULT_KO: Record<string, string> = {
      INTERESTED: "관심있음", PENDING: "보류", REJECTED: "거절", RESCHEDULED: "재콜예약",
    };
    const dt = new Date(log.createdAt).toLocaleString("ko-KR");
    const parts = [
      `[${dt}]`,
      log.result ? RESULT_KO[log.result] ?? log.result : "",
      log.convictionScore ? `확신도 ${log.convictionScore}점` : "",
      log.content ?? "",
      log.nextAction ? `→ ${log.nextAction}` : "",
    ].filter(Boolean);
    navigator.clipboard.writeText(parts.join(" | ")).then(() => setCopiedLogId(log.id));
  }, [setCopiedLogId]);

  // ── 드라이브 백업 ──────────────────────────────────────────────────────────
  const backupCallLogs = useCallback(async () => {
    if (!setBacking || !setBackupResult) return;
    setBacking(true);
    setBackupResult(null);
    try {
      const res = await fetch(`/api/contacts/${contactId}/call-logs/backup`, { method: "POST" });
      const data = await res.json();
      if (data.ok) setBackupResult({ url: data.viewUrl, count: data.count });
      else toast({ title: "백업 실패", description: data.message ?? "다시 시도해주세요.", variant: "destructive" });
    } finally {
      setBacking(false);
    }
  }, [contactId, setBacking, setBackupResult, toast]);

  // ── 메모 추가 ──────────────────────────────────────────────────────────────
  const addMemo = useCallback(async () => {
    if (!memoText.trim() || savingMemo) return;
    setSavingMemo(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}/memos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: memoText }),
      });
      const data = await res.json();
      if (data.ok) {
        const newMemo: Memo = data.memo;
        const currentMemos = getCurrentMemos?.() ?? [];
        const updatedMemos = [newMemo, ...currentMemos];
        onMemoAdded?.(newMemo, updatedMemos);
        setShowMemoForm(false);
        setMemoText("");
        toast({ title: "메모 저장", description: "메모가 저장되었습니다.", variant: "success" });
        logger.log("[useContactOperations]", { action: "add-memo", contactId, status: "success" });
      } else {
        toast({ title: "저장 실패", description: data.message || "메모 저장에 실패했습니다.", variant: "destructive" });
        logger.log("[useContactOperations]", { action: "add-memo", contactId, status: "error", error: data.message });
      }
    } catch (err) {
      toast({ title: "네트워크 오류", description: err instanceof Error ? err.message : "메모 저장에 실패했습니다.", variant: "destructive" });
      logger.error("[addMemo error]", { err, contactId });
    } finally {
      setSavingMemo(false);
    }
  }, [memoText, savingMemo, contactId, setSavingMemo, setShowMemoForm, setMemoText, onMemoAdded, getCurrentMemos, toast]);

  // ── 메모 삭제 ──────────────────────────────────────────────────────────────
  const deleteMemo = useCallback(async (memoId: string) => {
    if (!confirm("이 메모를 삭제할까요?")) return;
    try {
      const res = await fetch(`/api/contacts/${contactId}/memos?memoId=${memoId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        const currentMemos = getCurrentMemos?.() ?? [];
        const remaining = currentMemos.filter(m => m.id !== memoId);
        onMemoDeleted?.(memoId, remaining);
      } else {
        toast({ title: "삭제 실패", description: data.message, variant: "destructive" });
      }
    } catch (err) {
      logger.error("[deleteMemo failed]", { err, contactId });
      toast({ title: "네트워크 오류", variant: "destructive" });
    }
  }, [contactId, onMemoDeleted, getCurrentMemos, toast]);

  // ── 메모 전체 삭제 ─────────────────────────────────────────────────────────
  const deleteAllMemos = useCallback(async (count?: number) => {
    const label = count !== undefined ? `메모 ${count}건을 전체 삭제할까요?` : "메모를 전체 삭제할까요?";
    if (!confirm(label)) return;
    try {
      const res = await fetch(`/api/contacts/${contactId}/memos`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        onAllMemosDeleted?.();
      } else {
        toast({ title: "삭제 실패", description: data.message, variant: "destructive" });
      }
    } catch (err) {
      logger.error("[deleteAllMemos failed]", { err, contactId });
      toast({ title: "네트워크 오류", variant: "destructive" });
    }
  }, [contactId, onAllMemosDeleted, toast]);

  return {
    addCallLog,
    deleteCallLog,
    deleteAllCallLogs,
    copyCallLog,
    backupCallLogs,
    addMemo,
    deleteMemo,
    deleteAllMemos,
  };
}
