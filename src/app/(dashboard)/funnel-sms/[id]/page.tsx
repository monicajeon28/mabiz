"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { showSuccess, showError } from "@/components/ui/Toast";
import FunnelSmsHeader from "@/components/funnel-sms/FunnelSmsHeader";
import FunnelSmsMessageEditor from "@/components/funnel-sms/FunnelSmsMessageEditor";
import FunnelSmsPhonePreview from "@/components/funnel-sms/FunnelSmsPhonePreview";
import { logger } from "@/lib/logger";

// ────────────────────────────────────────────────────────────
// 타입
// ────────────────────────────────────────────────────────────
interface FunnelSmsDetail {
  id: string;
  title: string;
  senderPhone?: string | null;
  category?: string | null;
  description?: string | null;
  sendHour: number;
  sendMinute: number;
  arsNum?: string | null;
  isActive: boolean;
}

interface FunnelSmsMessage {
  id: string;
  order: number;
  daysAfter: number;
  content: string;
  msgType: "SMS" | "LMS";
}

interface SmsStats {
  pending: number;
  sent: number;
  failed: number;
  blocked: number;
}

interface HeaderState {
  title: string;
  senderPhone?: string;
  category?: string;
  description?: string;
  sendHour: number;
  sendMinute: number;
  arsNum?: string;
}

// ────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────
export default function FunnelSmsEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [header, setHeader] = useState<HeaderState>({
    title: "",
    senderPhone: "",
    category: "",
    description: "",
    sendHour: 10,
    sendMinute: 0,
    arsNum: "",
  });
  const [messages, setMessages] = useState<FunnelSmsMessage[]>([]);
  const [smsStats, setSmsStats] = useState<SmsStats>({
    pending: 0,
    sent: 0,
    failed: 0,
    blocked: 0,
  });
  const [activeTab, setActiveTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // ──────────────────────────────
  // 발송 상태 통계 로드
  // ──────────────────────────────
  const loadStats = async () => {
    try {
      const res = await fetch(`/api/funnel-sms/${id}/stats`);
      const data = (await res.json()) as Partial<SmsStats> & { ok?: boolean };
      if (data.ok) {
        setSmsStats({
          pending: data.pending ?? 0,
          sent: data.sent ?? 0,
          failed: data.failed ?? 0,
          blocked: data.blocked ?? 0,
        });
      }
    } catch (err) {
      logger.error("[FunnelSmsEditPage] loadStats", { err });
    }
  };

  // ──────────────────────────────
  // 초기 데이터 로드
  // ──────────────────────────────
  useEffect(() => {
    if (!id) return;

    loadStats();

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 10_000);

    fetch(`/api/funnel-sms/${id}`, { signal: ac.signal })
      .then((r) => r.json())
      .then(
        (d: {
          ok: boolean;
          data?: FunnelSmsDetail & { messages: FunnelSmsMessage[] };
          message?: string;
        }) => {
          if (d.ok && d.data) {
            const { messages: msgs, ...rest } = d.data;
            setHeader({
              title: rest.title,
              senderPhone: rest.senderPhone ?? "",
              category: rest.category ?? "",
              description: rest.description ?? "",
              sendHour: rest.sendHour,
              sendMinute: rest.sendMinute,
              arsNum: rest.arsNum ?? "",
            });
            setMessages(msgs);
            setActiveTab(0);
          } else {
            setNotFound(true);
            showError(d.message ?? "퍼널문자를 불러올 수 없습니다.");
          }
        }
      )
      .catch((err) => {
        if ((err as Error).name !== "AbortError") {
          logger.error("[FunnelSmsEditPage] load", { err });
          setNotFound(true);
          showError("데이터를 불러올 수 없습니다.");
        }
      })
      .finally(() => {
        clearTimeout(timer);
        setLoading(false);
      });

    return () => ac.abort();
  }, [id]);

  // ──────────────────────────────
  // 핸들러
  // ──────────────────────────────
  const handleHeaderChange = (field: keyof HeaderState, value: string | number) => {
    setHeader((prev) => ({ ...prev, [field]: value }));
  };

  const handleMessageChange = (
    index: number,
    field: keyof FunnelSmsMessage,
    value: number | string | "SMS" | "LMS"
  ) => {
    setMessages((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  };

  const handleAddTab = () => {
    if (messages.length >= 500) {
      showError("회차는 최대 500개까지 추가할 수 있습니다.");
      return;
    }
    const maxOrder = messages.reduce((acc, m) => Math.max(acc, m.order), 0);
    const newMsg: FunnelSmsMessage = {
      id: "", // 새 메시지는 id 없음 — 서버 저장 시 생성
      order: maxOrder + 1,
      daysAfter: 0,
      content: "",
      msgType: "SMS",
    };
    setMessages((prev) => [...prev, newMsg]);
    setActiveTab(messages.length);
  };

  const handleRemoveTab = (index: number) => {
    if (messages.length <= 1) {
      showError("최소 1개의 회차가 필요합니다.");
      return;
    }
    if (!confirm(`${messages[index].order}회차를 삭제하시겠습니까?`)) return;

    const updated = messages
      .filter((_, i) => i !== index)
      .map((m, i) => ({ ...m, order: i + 1 })); // order 재정렬
    setMessages(updated);
    setActiveTab(Math.min(activeTab, updated.length - 1));
  };

  const handleSave = async () => {
    if (!header.title.trim()) {
      showError("퍼널 제목을 입력해주세요.");
      return;
    }
    if (messages.some((m) => !m.content.trim())) {
      showError("모든 회차의 메시지 내용을 입력해주세요.");
      return;
    }

    setSaving(true);
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 10_000);

      // PATCH: 기본 정보 수정
      const patchBody = {
        title: header.title,
        senderPhone: header.senderPhone || null,
        category: header.category || null,
        description: header.description || null,
        sendHour: header.sendHour,
        sendMinute: header.sendMinute,
        arsNum: header.arsNum || null,
      };

      // PUT: 메시지 전체 교체
      const putBody = {
        messages: messages.map((m) => ({
          order: m.order,
          daysAfter: m.daysAfter,
          content: m.content,
          msgType: m.msgType,
        })),
      };

      const [patchRes, putRes] = await Promise.all([
        fetch(`/api/funnel-sms/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody),
          signal: ac.signal,
        }),
        fetch(`/api/funnel-sms/${id}/messages`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(putBody),
          signal: ac.signal,
        }),
      ]);

      clearTimeout(timer);

      const [patchData, putData] = await Promise.all([
        patchRes.json() as Promise<{ ok: boolean; message?: string }>,
        putRes.json() as Promise<{
          ok: boolean;
          data?: FunnelSmsMessage[];
          message?: string;
          pendingSmsCount?: number;
          warningMessage?: string | null;
        }>,
      ]);

      if (patchData.ok && putData.ok) {
        // 저장된 메시지로 상태 업데이트 (id 반영)
        if (putData.data) {
          setMessages(putData.data);
        }
        showSuccess("저장되었습니다.");

        // 이미 예약된(미발송) 문자가 있으면 경고 + 예약분 교체 여부 확인
        const pendingCount = putData.pendingSmsCount ?? 0;
        if (pendingCount > 0) {
          showError(
            `${pendingCount}건의 이미 예약된 문자는 기존 내용으로 발송됩니다.`
          );
          const replace = confirm(
            `이미 예약된 미발송 문자 ${pendingCount}건이 있습니다.\n\n` +
              `이 문자들은 기존 내용으로 발송됩니다.\n` +
              `미발송 예약분을 삭제하고, 앞으로 추가되는 고객부터 새 내용으로 발송하시겠습니까?`
          );
          if (replace) {
            await handleSyncPending();
          }
        }
        // 발송 상태 카드 갱신
        await loadStats();
      } else {
        const errMsg =
          (!patchData.ok ? patchData.message : null) ??
          (!putData.ok ? putData.message : null) ??
          "저장에 실패했습니다.";
        showError(errMsg);
      }
    } catch (err) {
      logger.error("[FunnelSmsEditPage] handleSave", { err });
      showError("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  // 예약분(미발송 PENDING) 동기화 — 옛 content로 발송될 예약 문자 삭제
  const handleSyncPending = async () => {
    try {
      const res = await fetch(`/api/funnel-sms/${id}/messages/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const d = (await res.json()) as {
        ok: boolean;
        deletedCount?: number;
        message?: string;
      };
      if (d.ok) {
        showSuccess(d.message ?? "예약분이 동기화되었습니다.");
      } else {
        showError(d.message ?? "예약분 동기화에 실패했습니다.");
      }
    } catch (err) {
      logger.error("[FunnelSmsEditPage] handleSyncPending", { err });
      showError("예약분 동기화 중 오류가 발생했습니다.");
    } finally {
      await loadStats();
    }
  };

  const handleDelete = async () => {
    if (!confirm("퍼널문자를 삭제하시겠습니까? 연결된 그룹에서도 해제됩니다.")) return;
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 10_000);
      const res = await fetch(`/api/funnel-sms/${id}`, {
        method: "DELETE",
        signal: ac.signal,
      });
      clearTimeout(timer);
      const d = await res.json() as { ok: boolean; message?: string };
      if (d.ok) {
        router.push("/funnel-sms");
      } else {
        showError(d.message ?? "삭제에 실패했습니다.");
      }
    } catch (err) {
      logger.error("[FunnelSmsEditPage] handleDelete", { err });
      showError("삭제 중 오류가 발생했습니다.");
    }
  };

  // ──────────────────────────────
  // 렌더
  // ──────────────────────────────
  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <div className="space-y-4">
          <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
          <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <p className="text-lg font-medium text-gray-600">퍼널문자를 찾을 수 없습니다.</p>
          <button
            onClick={() => router.push("/funnel-sms")}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const activeMessage = activeTab < messages.length ? messages[activeTab] : undefined;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/funnel-sms")}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="목록으로 돌아가기"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">퍼널문자 편집</h1>
            <p className="text-sm text-gray-500 truncate max-w-xs">{header.title}</p>
          </div>
        </div>
        <button
          onClick={handleDelete}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          삭제
        </button>
      </div>

      {/* 발송 상태 대시보드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-600">예약 중</p>
          <p className="text-2xl font-bold text-blue-600">{smsStats.pending}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-600">발송 완료</p>
          <p className="text-2xl font-bold text-green-600">{smsStats.sent}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-600">발송 실패</p>
          <p className="text-2xl font-bold text-red-600">{smsStats.failed}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-600">수신거부 차단</p>
          <p className="text-2xl font-bold text-yellow-600">{smsStats.blocked}</p>
        </div>
      </div>

      {/* 예약분 경고 배너 — 미발송 예약이 있으면 표시 */}
      {smsStats.pending > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-start justify-between gap-3">
          <p className="text-sm text-yellow-800">
            현재 <strong>{smsStats.pending}건</strong>의 미발송 예약 문자가 있습니다.
            메시지를 편집해도 이미 예약된 문자는 <strong>기존 내용</strong>으로 발송됩니다.
            새 내용으로 교체하려면 예약분을 동기화하세요.
          </p>
          <button
            onClick={() => {
              if (
                confirm(
                  `미발송 예약 문자 ${smsStats.pending}건을 삭제하고, 앞으로 추가되는 고객부터 새 내용으로 발송하시겠습니까?`
                )
              ) {
                handleSyncPending();
              }
            }}
            className="shrink-0 px-3 py-1.5 text-sm font-medium text-yellow-800 bg-yellow-100 hover:bg-yellow-200 border border-yellow-300 rounded-lg transition-colors"
          >
            예약분 동기화
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 폼 영역 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 기본 정보 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">기본 정보</h2>
            <FunnelSmsHeader value={header} onChange={handleHeaderChange} />
          </div>

          {/* 메시지 회차 탭 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">메시지 회차</h2>

            {/* 탭 버튼 */}
            <div className="flex items-center gap-1 flex-wrap mb-5 border-b border-gray-200 pb-3">
              {messages.map((m, i) => (
                <div key={`tab-${m.order}-${i}`} className="relative group">
                  <button
                    onClick={() => setActiveTab(i)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors pr-6 ${
                      activeTab === i
                        ? "bg-blue-600 text-white font-medium"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {m.order}회차
                  </button>
                  {/* 회차 삭제 버튼 (탭 오버 시 표시) */}
                  {messages.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveTab(i);
                      }}
                      className={`absolute right-0.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center text-xs transition-opacity ${
                        activeTab === i
                          ? "text-white/70 hover:text-white opacity-0 group-hover:opacity-100"
                          : "text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100"
                      }`}
                      aria-label={`${m.order}회차 삭제`}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={handleAddTab}
                className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 border border-dashed border-blue-300 rounded-lg transition-colors ml-1"
              >
                + 회차추가
              </button>
            </div>

            {/* 활성 메시지 에디터 */}
            {activeMessage ? (
              <FunnelSmsMessageEditor
                message={activeMessage}
                onChange={(field, value) => handleMessageChange(activeTab, field, value)}
                sendHour={header.sendHour}
                sendMinute={header.sendMinute}
              />
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">
                회차를 선택하거나 추가하세요.
              </p>
            )}
          </div>

          {/* 하단 버튼 */}
          <div className="flex items-center justify-end gap-3 pb-6">
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              삭제
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>

        {/* 오른쪽: 폰 미리보기 */}
        <div className="hidden lg:block">
          <div className="sticky top-6">
            <p className="text-xs font-medium text-gray-500 mb-3 text-center">
              {activeMessage ? `${activeMessage.order}회차 미리보기` : "미리보기"}
            </p>
            <FunnelSmsPhonePreview content={activeMessage?.content ?? ""} />
          </div>
        </div>
      </div>
    </div>
  );
}
