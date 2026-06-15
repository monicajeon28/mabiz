"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, ChevronDown, AlertTriangle, Mail } from "lucide-react";
import { showError } from "@/components/ui/Toast";
import { logger } from "@/lib/logger";

interface EmailMessageState {
  order: number;
  daysAfter: number;
  subject: string;
  bodyHtml: string;
  previewText: string;
}

interface HeaderState {
  title: string;
  senderName: string;
  senderEmail: string;
  description: string;
  sendHour: number;
  sendMinute: number;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 10, 20, 30, 40, 50];

function formatHour(h: number): string {
  if (h === 0) return "오전 12시";
  if (h < 12) return `오전 ${h}시`;
  if (h === 12) return "오후 12시";
  return `오후 ${h - 12}시`;
}

function daysLabel(daysAfter: number): string {
  if (daysAfter === 0) return "신청 당일";
  return `${daysAfter}일 후`;
}

export default function FunnelEmailNewPage() {
  const router = useRouter();

  const [header, setHeader] = useState<HeaderState>({
    title: "",
    senderName: "",
    senderEmail: "",
    description: "",
    sendHour: 10,
    sendMinute: 0,
  });

  const [messages, setMessages] = useState<EmailMessageState[]>([
    { order: 1, daysAfter: 0, subject: "", bodyHtml: "", previewText: "" },
  ]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleHeaderChange = (field: keyof HeaderState, value: string | number) => {
    setSaveError(null);
    setHeader((prev) => ({ ...prev, [field]: value }));
  };

  const handleMessageChange = (
    index: number,
    field: keyof EmailMessageState,
    value: string | number
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
        subject: "",
        bodyHtml: "",
        previewText: "",
      },
    ]);
  };

  const removeMessage = (index: number) => {
    if (messages.length <= 1) {
      showError("최소 1개의 이메일이 필요합니다.");
      return;
    }
    setMessages((prev) =>
      prev.filter((_, i) => i !== index).map((m, i) => ({ ...m, order: i + 1 }))
    );
  };

  const handleSave = async () => {
    setSaveError(null);

    if (!header.title.trim()) {
      const msg = "자동이메일 이름을 입력해주세요.";
      setSaveError(msg);
      showError(msg);
      return;
    }
    if (messages.some((m) => !m.subject.trim())) {
      const msg = "모든 이메일의 제목을 입력해주세요.";
      setSaveError(msg);
      showError(msg);
      return;
    }
    if (messages.some((m) => !m.bodyHtml.trim())) {
      const msg = "모든 이메일의 내용을 입력해주세요.";
      setSaveError(msg);
      showError(msg);
      return;
    }

    setSaving(true);
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 10_000);

      const body = {
        title: header.title.trim(),
        senderName: header.senderName.trim() || null,
        senderEmail: header.senderEmail.trim() || null,
        description: header.description.trim() || null,
        sendHour: header.sendHour,
        sendMinute: header.sendMinute,
        messages: messages.map((m) => ({
          order: m.order,
          daysAfter: m.daysAfter,
          subject: m.subject.trim(),
          bodyHtml: m.bodyHtml.trim(),
          previewText: m.previewText.trim() || null,
        })),
      };

      const res = await fetch("/api/funnel-email", {
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
        router.push(`/funnel-email/${d.data.id}`);
      } else {
        const errMsg =
          d.message ??
          Object.values(d.errors ?? {}).flat().join(", ") ??
          "저장에 실패했습니다.";
        setSaveError(errMsg);
        showError(errMsg);
      }
    } catch (err) {
      logger.error("[FunnelEmailNewPage] handleSave", { err });
      const msg = "저장 중 오류가 발생했습니다.";
      setSaveError(msg);
      showError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
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
          <h1 className="text-xl font-bold text-gray-900">새 자동이메일 만들기</h1>
          <p className="text-sm text-gray-500">신청 후 자동으로 발송될 이메일 시퀀스를 설정합니다.</p>
        </div>
      </div>

      {/* 광고성 이메일 법규 안내 배너 */}
      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-900 mb-2">
              광고성 이메일 법규 안내
            </p>
            <ul className="text-sm text-amber-800 space-y-1">
              <li>• 수신 동의 고객에게만 발송하세요.</li>
              <li>• 광고성 이메일은 수신거부 방법을 명시해야 합니다.</li>
              <li>• 야간(오후 9시 ~ 오전 8시) 광고성 이메일 발송을 자제하세요.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* 기본 정보 섹션 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">기본 정보</h2>
          <div className="space-y-4">
            {/* 이름 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                자동이메일 이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={header.title}
                onChange={(e) => handleHeaderChange("title", e.target.value)}
                placeholder="예: 크루즈 관심 고객 환영 이메일"
                className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
              />
            </div>

            {/* 보내는 사람 이름 + 이메일 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  보내는 사람 이름
                </label>
                <input
                  type="text"
                  value={header.senderName}
                  onChange={(e) => handleHeaderChange("senderName", e.target.value)}
                  placeholder="예: 마비즈 크루즈"
                  className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
                />
                <p className="text-sm text-gray-400 mt-1">비워두면 조직 기본값 사용</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  보내는 이메일 주소
                </label>
                <input
                  type="email"
                  value={header.senderEmail}
                  onChange={(e) => handleHeaderChange("senderEmail", e.target.value)}
                  placeholder="예: info@example.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
                />
                <p className="text-sm text-gray-400 mt-1">비워두면 조직 기본값 사용</p>
              </div>
            </div>

            {/* 발송 시각 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                발송 시각
              </label>
              <div className="flex items-center gap-3">
                <select
                  value={header.sendHour}
                  onChange={(e) => handleHeaderChange("sendHour", Number(e.target.value))}
                  className="border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {formatHour(h)}
                    </option>
                  ))}
                </select>
                <select
                  value={header.sendMinute}
                  onChange={(e) => handleHeaderChange("sendMinute", Number(e.target.value))}
                  className="border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
                >
                  {MINUTES.map((m) => (
                    <option key={m} value={m}>
                      {String(m).padStart(2, "0")}분
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 설명 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                설명 (선택)
              </label>
              <textarea
                value={header.description}
                onChange={(e) => handleHeaderChange("description", e.target.value)}
                placeholder="이 자동이메일의 목적이나 설명을 입력하세요."
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
        </div>

        {/* 오류 메시지 */}
        {saveError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base text-red-700">
            {saveError}
          </div>
        )}

        {/* 이메일 목록 섹션 */}
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-3">이메일 목록</h2>
          <div className="space-y-0">
            {messages.map((m, i) => (
              <div key={m.order}>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  {/* 회차 헤더 */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">
                        {m.order}
                      </span>
                      <span className="text-base font-semibold text-gray-700">
                        {daysLabel(m.daysAfter)}
                      </span>
                    </div>
                    {messages.length > 1 && (
                      <button
                        onClick={() => removeMessage(i)}
                        className="text-red-400 hover:text-red-600 p-2 rounded-lg transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                        aria-label={`${m.order}회차 삭제`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    {/* 발송 시점 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        발송 시점 (신청 후 며칠 뒤)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={499}
                          value={m.daysAfter}
                          onChange={(e) =>
                            handleMessageChange(i, "daysAfter", Math.max(0, Number(e.target.value)))
                          }
                          className="w-24 border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
                        />
                        <span className="text-base text-gray-600">일 후</span>
                        <span className="text-sm text-gray-400">
                          ({daysLabel(m.daysAfter)})
                        </span>
                      </div>
                    </div>

                    {/* 이메일 제목 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        이메일 제목 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={m.subject}
                        onChange={(e) => handleMessageChange(i, "subject", e.target.value)}
                        placeholder="예: 크루즈 여행 특별 혜택 안내"
                        className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
                      />
                    </div>

                    {/* 미리보기 문구 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        미리보기 문구 (선택)
                      </label>
                      <input
                        type="text"
                        value={m.previewText}
                        onChange={(e) => handleMessageChange(i, "previewText", e.target.value)}
                        placeholder="받은편지함에서 제목 옆에 짧게 보이는 문구"
                        className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
                      />
                      <p className="text-sm text-gray-400 mt-1">
                        받은편지함에서 이메일 제목 옆에 보이는 짧은 설명입니다.
                      </p>
                    </div>

                    {/* 이메일 내용 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        이메일 내용 <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={m.bodyHtml}
                        onChange={(e) => handleMessageChange(i, "bodyHtml", e.target.value)}
                        placeholder={"<p>안녕하세요, {{이름}}님!</p>\n<p>...</p>"}
                        rows={8}
                        className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                      />
                      <p className="text-sm text-gray-400 mt-1">
                        HTML 형식으로 입력하세요. {"{{이름}}"}, {"{{전화번호}}"} 등 변수를 사용할 수 있습니다.
                      </p>
                    </div>
                  </div>

                  {/* 마지막 회차 아래 추가 버튼 */}
                  {i === messages.length - 1 && (
                    <div className="mt-5 flex justify-center">
                      <button
                        onClick={addMessage}
                        className="flex items-center gap-2 px-4 py-2.5 text-base text-blue-600 border border-dashed border-blue-300 rounded-xl hover:bg-blue-50 transition-colors"
                      >
                        <Plus className="w-4 h-4" /> 다음 이메일 추가
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
        </div>

        {/* 저장 버튼 */}
        <div className="flex items-center justify-between pb-6">
          <button
            onClick={() => router.back()}
            className="px-5 py-3 border border-gray-300 text-gray-700 rounded-lg text-base font-medium hover:bg-gray-50 transition-colors min-h-[48px]"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg text-base font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[48px]"
          >
            <Mail className="w-4 h-4" />
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
