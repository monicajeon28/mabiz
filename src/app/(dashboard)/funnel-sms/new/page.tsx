"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, ChevronDown, Trash2, AlertTriangle } from "lucide-react";
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

  const [isAdvertisement, setIsAdvertisement] = useState(false);
  const AD_OPTOUT_SUFFIX = "\n무료수신거부 080-888-1003";

  // 광고성 메시지 전환 시 메시지 내용에 자동으로 수신거부 문구 추가/제거
  useEffect(() => {
    setMessages((prev) =>
      prev.map((m) => {
        if (isAdvertisement) {
          if (!m.content.includes("무료수신거부")) {
            return { ...m, content: m.content + AD_OPTOUT_SUFFIX };
          }
        } else {
          return { ...m, content: m.content.replace(AD_OPTOUT_SUFFIX, "") };
        }
        return m;
      })
    );
   
  }, [isAdvertisement]);

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
      const message = "자동문자 제목을 입력해주세요.";
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
      const message = "발신번호 인증이 완료되지 않아 자동문자를 저장할 수 없습니다. 설정 > SMS에서 발신번호 인증을 먼저 완료하세요.";
      setSaveError(message);
      showError(message);
      return;
    }

    setSaving(true);
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 10_000);
    try {
      const adPrefix = "(광고)";
      const titleWithAd = isAdvertisement && !header.title.startsWith(adPrefix)
        ? `${adPrefix}${header.title}`
        : header.title;

      const body = {
        title: titleWithAd,
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
      clearTimeout(timer);
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
          <h1 className="text-xl font-bold text-gray-900">새 자동문자 만들기</h1>
          <p className="text-sm text-gray-500">신청 후 자동으로 발송될 문자 시퀀스를 설정합니다.</p>
        </div>
      </div>

      {/* 광고 심의 준수 배너 */}
      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-900 mb-2">📋 광고성 메시지 법규 안내</p>
            <ul className="text-xs text-amber-800 space-y-1 mb-3">
              <li>• <strong>야간(오후 9시 ~ 오전 8시) 광고성 문자 발송 금지</strong> — 이 시간에는 자동으로 차단됩니다</li>
              <li>• 광고성 메시지는 제목에 <strong>"(광고)"</strong> 표기 및 <strong>무료수신거부 번호</strong> 포함 필수</li>
              <li>• 수신 동의 고객에게만 발송하세요</li>
            </ul>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isAdvertisement}
                onChange={(e) => setIsAdvertisement(e.target.checked)}
                className="w-4 h-4 rounded accent-amber-600"
              />
              <span className="text-sm font-semibold text-amber-900">
                이 메시지는 광고성 메시지입니다
              </span>
            </label>
            {isAdvertisement && (
              <div className="mt-2 p-2 bg-amber-100 rounded-lg text-xs text-amber-800">
                ✅ 제목 앞에 <strong>"(광고)"</strong> 자동 추가됨<br />
                ✅ 각 메시지 끝에 <strong>"무료수신거부 080-888-1003"</strong> 자동 추가됨
              </div>
            )}
          </div>
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
                        {m.daysAfter === 0 ? "입장 즉시" : `${m.daysAfter}일 후`}
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
