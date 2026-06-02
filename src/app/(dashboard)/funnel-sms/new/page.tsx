"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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

  const [activeTab, setActiveTab] = useState(0);
  const [saving, setSaving] = useState(false);

  const handleHeaderChange = (field: keyof HeaderState, value: string | number) => {
    setHeader((prev) => ({ ...prev, [field]: value }));
  };

  const handleMessageChange = (
    index: number,
    field: keyof MessageState,
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
    setMessages((prev) => [
      ...prev,
      { order: maxOrder + 1, daysAfter: 0, content: "", msgType: "SMS" },
    ]);
    setActiveTab(messages.length); // 새 탭으로 이동
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
        message?: string;
        errors?: Record<string, string[]>;
      };

      if (d.ok && d.data) {
        router.push(`/funnel-sms/${d.data.id}`);
      } else {
        const errMsg = d.message ?? Object.values(d.errors ?? {}).flat().join(", ") ?? "저장에 실패했습니다.";
        showError(errMsg);
      }
    } catch (err) {
      logger.error("[FunnelSmsNewPage] handleSave", { err });
      showError("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const activeMessage = messages[activeTab];

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
            <FunnelSmsHeader value={header} onChange={handleHeaderChange} />
          </div>

          {/* 메시지 탭 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">메시지 회차</h2>

            {/* 탭 버튼 */}
            <div className="flex items-center gap-1 flex-wrap mb-5 border-b border-gray-200 pb-3">
              {messages.map((m, i) => (
                <button
                  key={m.order}
                  onClick={() => setActiveTab(i)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    activeTab === i
                      ? "bg-blue-600 text-white font-medium"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {m.order}회차
                </button>
              ))}
              <button
                onClick={handleAddTab}
                className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 border border-dashed border-blue-300 rounded-lg transition-colors ml-1"
              >
                + 회차추가
              </button>
            </div>

            {/* 활성 메시지 에디터 */}
            {activeMessage && (
              <FunnelSmsMessageEditor
                message={activeMessage}
                onChange={(field, value) => handleMessageChange(activeTab, field, value)}
                sendHour={header.sendHour}
                sendMinute={header.sendMinute}
              />
            )}
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
            <p className="text-xs font-medium text-gray-500 mb-3 text-center">미리보기</p>
            <FunnelSmsPhonePreview content={activeMessage?.content ?? ""} />
          </div>
        </div>
      </div>
    </div>
  );
}
