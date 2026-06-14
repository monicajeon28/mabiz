"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, ChevronDown, Trash2 } from "lucide-react";
import { showError } from "@/components/ui/Toast";
import FunnelSmsHeader from "@/components/funnel-sms/FunnelSmsHeader";
import FunnelSmsMessageEditor from "@/components/funnel-sms/FunnelSmsMessageEditor";
import FunnelSmsPhonePreview from "@/components/funnel-sms/FunnelSmsPhonePreview";
import { logger } from "@/lib/logger";

interface HeaderState {
  title: string;
  senderPhone?: string;
  category?: string;
  description?: string;
  sendHour: number;
  sendMinute: number;
  arsNum?: string;
}

interface SmsDefaultsState {
  connected: boolean;
  senderVerified: boolean;
  senderPhone: string;
  arsNum: string;
}

interface MessageState {
  order: number;
  daysAfter: number;
  content: string;
  msgType: "SMS" | "LMS";
}

export default function FunnelSmsNewPage() {
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

  const [messages, setMessages] = useState<MessageState[]>([
    { order: 1, daysAfter: 0, content: "", msgType: "SMS" },
  ]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [smsDefaults, setSmsDefaults] = useState<SmsDefaultsState>({
    connected: false,
    senderVerified: false,
    senderPhone: "",
    arsNum: "",
  });

  const handleHeaderChange = (field: keyof HeaderState, value: string | number) => {
    setSaveError(null);
    setHeader((prev) => ({ ...prev, [field]: value }));
  };

  const handleMessageChange = (
    index: number,
    field: keyof MessageState,
    value: number | string | "SMS" | "LMS"
  ) => {
    setSaveError(null);
    setMessages((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  };

  const addMessage = () => {
    if (messages.length >= 500) {
      showError("회차는 최대 500개까지 추가할 수 있습니다.");
      return;
    }
    setMessages((prev) => [
      ...prev,
      {
        order: prev.length + 1,
        daysAfter: prev[prev.length - 1].daysAfter + 1,
        content: "",
        msgType: "SMS",
      },
    ]);
  };

  const removeMessage = (index: number) => {
    if (messages.length <= 1) {
      showError("최소 1개의 회차가 필요합니다.");
      return;
    }
    setMessages((prev) =>
      prev.filter((_, i) => i !== index).map((m, i) => ({ ...m, order: i + 1 }))
    );
  };

  const handleSave = async () => {
    setSaveError(null);
    if (!header.title.trim()) {
      const message = "퍼널 제목을 입력해주세요.";
      setSaveError(message);
      showError(message);
      return;
    }
    if (messages.some((m) => !m.content.trim())) {
      const message = "모든 회차의 메시지 내용을 입력해주세요.";
      setSaveError(message);
      showError(message);
      return;
    }
    if (header.senderPhone?.trim() && smsDefaults.connected && !smsDefaults.senderVerified) {
      const message = "발신번호 인증이 완료되지 않아 퍼널문자를 저장할 수 없습니다. 설정 > SMS에서 발신번호 인증을 먼저 완료하세요.";
      setSaveError(message);
      showError(message);
      return;
    }

    setSaving(true);
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 10_000);

      const body = {
        title: header.title,
        senderPhone: header.senderPhone || null,
        category: header.category || null,
        description: header.description || null,
        sendHour: header.sendHour,
        sendMinute: header.sendMinute,
        arsNum: header.arsNum || null,
        messages: messages.map((m) => ({
          order: m.order,
          daysAfter: m.daysAfter,
          content: m.content,
          msgType: m.msgType,
        })),
      };

      const res = await fetch("/api/funnel-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
      clearTimeout(timer);

      const d = await res.json() as {
        ok: boolean;
        data?: { id: string };
        error?: string;
        message?: string;
        errors?: Record<string, string[]>;
      };

      if (d.ok && d.data) {
        router.push(`/funnel-sms/${d.data.id}`);
      } else {
        const errMsg = d.message ?? Object.values(d.errors ?? {}).flat().join(", ") ?? "저장에 실패했습니다.";
        setSaveError(errMsg);
        showError(errMsg);
      }
    } catch (err) {
      logger.error("[FunnelSmsNewPage] handleSave", { err });
      const message = "저장 중 오류가 발생했습니다.";
      setSaveError(message);
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="뒤로가기"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">새 퍼널문자</h1>
          <p className="text-sm text-gray-500">자동 SMS 시퀀스를 설정합니다.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 폼 영역 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 기본 정보 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">기본 정보</h2>
            <FunnelSmsHeader
              value={header}
              onChange={handleHeaderChange}
              onDefaultsChange={setSmsDefaults}
            />
          </div>

          {saveError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {saveError}
            </div>
          )}

          {/* 메시지 회차 타임라인 */}
          <div className="space-y-0">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">메시지 회차</h2>
            {messages.map((m, i) => (
              <div key={m.order}>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  {/* 회차 헤더 */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                        {m.order}
                      </span>
                      <span className="text-sm font-semibold text-gray-700">
                        {m.daysAfter === 0 ? "즉시 발송 (Day 0)" : `D+${m.daysAfter}`}
                      </span>
                    </div>
                    {messages.length > 1 && (
                      <button
                        onClick={() => removeMessage(i)}
                        className="text-red-400 hover:text-red-600 p-1 rounded transition-colors"
                        aria-label={`${m.order}회차 삭제`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {/* 메시지 에디터 */}
                  <FunnelSmsMessageEditor
                    message={m}
                    onChange={(field, value) => handleMessageChange(i, field, value)}
                    sendHour={header.sendHour}
                    sendMinute={header.sendMinute}
                  />
                  {/* 마지막 회차 아래 추가 버튼 */}
                  {i === messages.length - 1 && (
                    <div className="mt-4 flex justify-center">
                      <button
                        onClick={addMessage}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 border border-dashed border-blue-300 rounded-xl hover:bg-blue-50 transition-colors"
                      >
                        <Plus className="w-4 h-4" /> 다음 회차 추가
                      </button>
                    </div>
                  )}
                </div>
                {/* 회차 간 연결 화살표 */}
                {i < messages.length - 1 && (
                  <div className="flex justify-center my-2">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-px h-4 bg-gray-300" />
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 저장 버튼 */}
          <div className="flex justify-end">
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
            <p className="text-xs font-medium text-gray-500 mb-3 text-center">미리보기 (1회차)</p>
            <FunnelSmsPhonePreview content={messages[0]?.content ?? ""} />
          </div>
        </div>
      </div>
    </div>
  );
}
