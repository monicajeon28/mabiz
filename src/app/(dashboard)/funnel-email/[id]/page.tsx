"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, Plus, ChevronDown, Mail, ToggleLeft, ToggleRight, Smartphone, Monitor } from "lucide-react";
import { showSuccess, showError } from "@/components/ui/Toast";
import { logger } from "@/lib/logger";

// ────────────────────────────────────────────────────────────
// 타입
// ────────────────────────────────────────────────────────────
interface FunnelEmailDetail {
  id: string;
  title: string;
  senderName?: string | null;
  senderEmail?: string | null;
  description?: string | null;
  sendHour: number;
  sendMinute: number;
  isActive: boolean;
}

interface FunnelEmailMessage {
  id: string;
  order: number;
  daysAfter: number;
  subject: string;
  bodyHtml: string;
  previewText?: string | null;
}

interface HeaderState {
  title: string;
  senderName: string;
  senderEmail: string;
  description: string;
  sendHour: number;
  sendMinute: number;
}

type PreviewMode = "mobile" | "pc";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 10, 20, 30, 40, 50];

function formatHour(h: number): string {
  if (h === 0) return "오전 12시";
  if (h < 12) return `오전 ${h}시`;
  if (h === 12) return "오후 12시";
  return `오후 ${h - 12}시`;
}

function daysLabel(daysAfter: number): string {
  if (daysAfter === 0) return "신청 당일 (즉시)";
  if (daysAfter < 30) return `${daysAfter}일 후`;
  if (daysAfter < 365) return `${daysAfter}일 후 (약 ${Math.round(daysAfter / 30)}개월)`;
  return `${daysAfter}일 후 (약 ${(daysAfter / 365).toFixed(1)}년)`;
}

function getPreviewDate(daysAfter: number, sendHour: number, sendMinute: number): string {
  const d = new Date(Date.now() + daysAfter * 86_400_000);
  const h = String(sendHour).padStart(2, "0");
  const m = String(sendMinute).padStart(2, "0");
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${h}:${m} 발송`;
}

// ────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────
export default function FunnelEmailEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [header, setHeader] = useState<HeaderState>({
    title: "",
    senderName: "",
    senderEmail: "",
    description: "",
    sendHour: 10,
    sendMinute: 0,
  });
  const [isActive, setIsActive] = useState(true);
  const [messages, setMessages] = useState<FunnelEmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("mobile");
  const [selectedMessageIndex, setSelectedMessageIndex] = useState(0);

  // ──────────────────────────────
  // 초기 데이터 로드
  // ──────────────────────────────
  useEffect(() => {
    if (!id) return;

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 10_000);

    fetch(`/api/funnel-email/${id}`, { signal: ac.signal })
      .then((r) => r.json())
      .then(
        (d: {
          ok: boolean;
          data?: FunnelEmailDetail & { messages: FunnelEmailMessage[] };
          message?: string;
        }) => {
          if (d.ok && d.data) {
            const { messages: msgs, ...rest } = d.data;
            setHeader({
              title: rest.title,
              senderName: rest.senderName ?? "",
              senderEmail: rest.senderEmail ?? "",
              description: rest.description ?? "",
              sendHour: rest.sendHour,
              sendMinute: rest.sendMinute,
            });
            setIsActive(rest.isActive);
            setMessages(msgs);
          } else {
            setNotFound(true);
            showError(d.message ?? "자동이메일을 불러올 수 없습니다.");
          }
        }
      )
      .catch((err) => {
        if ((err as Error).name !== "AbortError") {
          logger.error("[FunnelEmailEditPage] load", { err });
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
    field: keyof FunnelEmailMessage,
    value: string | number
  ) => {
    setMessages((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  };

  const addMessage = () => {
    if (messages.length >= 500) {
      showError("회차는 최대 500개까지 추가할 수 있습니다.");
      return;
    }
    const lastDays = messages.length > 0 ? messages[messages.length - 1].daysAfter : 0;
    const newMsg: FunnelEmailMessage = {
      id: "",
      order: messages.length + 1,
      daysAfter: lastDays + 1,
      subject: "",
      bodyHtml: "",
      previewText: "",
    };
    setMessages((prev) => [...prev, newMsg]);
  };

  const removeMessage = (index: number) => {
    if (messages.length <= 1) {
      showError("최소 1개의 이메일이 필요합니다.");
      return;
    }
    if (!confirm(`${messages[index].order}번째 이메일을 삭제하시겠습니까?`)) return;
    setMessages((prev) =>
      prev.filter((_, i) => i !== index).map((m, i) => ({ ...m, order: i + 1 }))
    );
  };

  const handleToggleActive = async () => {
    setTogglingActive(true);
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 10_000);
      const res = await fetch(`/api/funnel-email/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
        signal: ac.signal,
      });
      clearTimeout(timer);
      const d = await res.json() as { ok: boolean; data?: { isActive: boolean }; message?: string };
      if (d.ok && d.data) {
        setIsActive(d.data.isActive);
        showSuccess(d.data.isActive ? "활성화되었습니다." : "비활성화되었습니다.");
      } else {
        showError(d.message ?? "상태 변경에 실패했습니다.");
      }
    } catch (err) {
      logger.error("[FunnelEmailEditPage] handleToggleActive", { err });
      showError("상태 변경 중 오류가 발생했습니다.");
    } finally {
      setTogglingActive(false);
    }
  };

  const handleSave = async () => {
    if (!header.title.trim()) {
      showError("자동이메일 이름을 입력해주세요.");
      return;
    }
    if (messages.some((m) => !m.subject.trim())) {
      showError("모든 이메일의 제목을 입력해주세요.");
      return;
    }
    if (messages.some((m) => !m.bodyHtml.trim())) {
      showError("모든 이메일의 내용을 입력해주세요.");
      return;
    }

    setSaving(true);
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 10_000);

      const patchBody = {
        title: header.title.trim(),
        senderName: header.senderName.trim() || null,
        senderEmail: header.senderEmail.trim() || null,
        description: header.description.trim() || null,
        sendHour: header.sendHour,
        sendMinute: header.sendMinute,
      };

      const putBody = {
        messages: messages.map((m) => ({
          order: m.order,
          daysAfter: m.daysAfter,
          subject: m.subject.trim(),
          bodyHtml: m.bodyHtml.trim(),
          previewText: m.previewText?.trim() || null,
        })),
      };

      const [patchRes, putRes] = await Promise.all([
        fetch(`/api/funnel-email/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody),
          signal: ac.signal,
        }),
        fetch(`/api/funnel-email/${id}/messages`, {
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
          data?: FunnelEmailMessage[];
          message?: string;
        }>,
      ]);

      if (patchData.ok && putData.ok) {
        if (putData.data) {
          setMessages(putData.data);
        }
        showSuccess("저장되었습니다.");
      } else {
        const errMsg =
          (!patchData.ok ? patchData.message : null) ??
          (!putData.ok ? putData.message : null) ??
          "저장에 실패했습니다.";
        showError(errMsg);
      }
    } catch (err) {
      logger.error("[FunnelEmailEditPage] handleSave", { err });
      showError("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("자동이메일을 삭제하시겠습니까? 연결된 그룹에서도 해제됩니다.")) return;
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 10_000);
      const res = await fetch(`/api/funnel-email/${id}`, {
        method: "DELETE",
        signal: ac.signal,
      });
      clearTimeout(timer);
      const d = await res.json() as { ok: boolean; message?: string };
      if (d.ok) {
        showSuccess("삭제되었습니다.");
        router.push("/funnel-email");
      } else {
        showError(d.message ?? "삭제에 실패했습니다.");
      }
    } catch (err) {
      logger.error("[FunnelEmailEditPage] handleDelete", { err });
      showError("삭제 중 오류가 발생했습니다.");
    }
  };

  // ──────────────────────────────
  // 로딩 / 없음
  // ──────────────────────────────
  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
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
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Mail className="w-12 h-12 text-gray-300 mb-4" />
          <p className="text-lg font-medium text-gray-600 mb-2">
            자동이메일을 찾을 수 없습니다.
          </p>
          <button
            onClick={() => router.push("/funnel-email")}
            className="mt-4 px-5 py-3 bg-blue-600 text-white rounded-lg text-base font-medium hover:bg-blue-700 transition-colors min-h-[48px]"
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // ──────────────────────────────
  // 렌더
  // ──────────────────────────────
  const currentMessage = messages.length > 0 ? messages[selectedMessageIndex] : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 헤더 바 */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/funnel-email")}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="목록으로 돌아가기"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">자동이메일 편집</h1>
              <p className="text-sm text-gray-500 truncate max-w-xs">{header.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleActive}
              disabled={togglingActive}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors min-h-[44px] ${
                isActive
                  ? "text-green-700 bg-green-50 border-green-200 hover:bg-green-100"
                  : "text-gray-600 bg-gray-50 border-gray-200 hover:bg-gray-100"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              aria-label={isActive ? "비활성화" : "활성화"}
            >
              {isActive ? (
                <ToggleRight className="w-5 h-5" />
              ) : (
                <ToggleLeft className="w-5 h-5" />
              )}
              {isActive ? "활성" : "비활성"}
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition-colors min-h-[44px]"
            >
              <Trash2 className="w-4 h-4" />
              삭제
            </button>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠: 2열 레이아웃 */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* 좌측 패널 (40%) - 편집 폼 */}
        <div className="w-2/5 border-r border-gray-200 bg-white overflow-y-auto">
          <div className="p-4 md:p-6 space-y-6">
            {/* 기본 정보 섹션 */}
            <div className="rounded-xl border border-gray-200 p-5 bg-gray-50">
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
                  />
                </div>

                {/* 보내는 사람 이름 + 이메일 */}
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      보내는 사람 이름
                    </label>
                    <input
                      type="text"
                      value={header.senderName}
                      onChange={(e) => handleHeaderChange("senderName", e.target.value)}
                      placeholder="비워두면 조직 기본값 사용"
                      className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      보내는 이메일 주소
                    </label>
                    <input
                      type="email"
                      value={header.senderEmail}
                      onChange={(e) => handleHeaderChange("senderEmail", e.target.value)}
                      placeholder="비워두면 조직 기본값 사용"
                      className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
                    />
                  </div>
                </div>

                {/* 발송 시각 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    발송 시각
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={header.sendHour}
                      onChange={(e) => handleHeaderChange("sendHour", Number(e.target.value))}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
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
                      className="w-20 border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
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
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* 이메일 선택 탭 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-gray-800">
                  이메일 목록 ({messages.length}개)
                </h2>
                {messages.length > 0 && (
                  <button
                    onClick={addMessage}
                    className="flex items-center gap-1 px-2 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    aria-label="이메일 추가"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>

              {messages.length === 0 ? (
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 flex justify-center">
                  <button
                    onClick={addMessage}
                    className="flex items-center gap-2 px-4 py-2.5 text-base text-blue-600 border border-dashed border-blue-300 rounded-xl hover:bg-blue-50 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> 이메일 추가
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {messages.map((m, i) => (
                    <button
                      key={m.id || `new-${i}`}
                      onClick={() => setSelectedMessageIndex(i)}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-colors min-h-[48px] flex items-center justify-between ${
                        selectedMessageIndex === i
                          ? "bg-blue-50 border-blue-500 text-blue-900"
                          : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                          {m.order}
                        </span>
                        <span className="text-sm font-medium">{daysLabel(m.daysAfter)}</span>
                      </div>
                      {messages.length > 1 && selectedMessageIndex === i && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeMessage(i);
                            if (i > 0) setSelectedMessageIndex(i - 1);
                          }}
                          className="text-red-400 hover:text-red-600 p-1"
                          aria-label={`${m.order}번째 이메일 삭제`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 현재 메시지 편집 */}
            {currentMessage && (
              <div className="rounded-xl border border-gray-200 p-5 bg-gray-50 space-y-4">
                <h3 className="text-base font-semibold text-gray-800">
                  {daysLabel(currentMessage.daysAfter)} 이메일
                </h3>

                {/* 발송 시점 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    발송 시점 (신청 후 며칠 뒤)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={3650}
                      value={currentMessage.daysAfter}
                      onChange={(e) =>
                        handleMessageChange(
                          selectedMessageIndex,
                          "daysAfter",
                          Math.max(0, Math.min(3650, Number(e.target.value)))
                        )
                      }
                      className="w-24 border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
                    />
                    <span className="text-base text-gray-600">일 후</span>
                  </div>
                  <div className="mt-1 text-sm text-gray-500 bg-white rounded-lg px-3 py-2 border border-gray-200">
                    {currentMessage.daysAfter === 0 ? (
                      <span>신청 즉시 발송</span>
                    ) : (
                      <span>{daysLabel(currentMessage.daysAfter)}</span>
                    )}
                  </div>
                </div>

                {/* 이메일 제목 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    이메일 제목 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={currentMessage.subject}
                    onChange={(e) => handleMessageChange(selectedMessageIndex, "subject", e.target.value)}
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
                    value={currentMessage.previewText ?? ""}
                    onChange={(e) => handleMessageChange(selectedMessageIndex, "previewText", e.target.value)}
                    placeholder="받은편지함에서 제목 옆에 짧게 보이는 문구"
                    className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
                  />
                </div>

                {/* 이메일 내용 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    이메일 내용 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={currentMessage.bodyHtml}
                    onChange={(e) => handleMessageChange(selectedMessageIndex, "bodyHtml", e.target.value)}
                    rows={6}
                    className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    HTML 형식으로 입력하세요.
                  </p>
                </div>
              </div>
            )}

            {/* 저장 버튼 */}
            <div className="flex gap-3 pb-6">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg text-base font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[48px]"
              >
                <Mail className="w-4 h-4" />
                {saving ? "저장 중..." : "전체 저장"}
              </button>
            </div>
          </div>
        </div>

        {/* 우측 패널 (60%) - 미리보기 */}
        <div className="w-3/5 bg-gray-100 flex flex-col">
          {/* 미리보기 탭 */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-800">미리보기</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewMode("mobile")}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors min-h-[44px] ${
                  previewMode === "mobile"
                    ? "bg-blue-50 border-blue-500 text-blue-700"
                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                <Smartphone className="w-4 h-4" />
                모바일 (375px)
              </button>
              <button
                onClick={() => setPreviewMode("pc")}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors min-h-[44px] ${
                  previewMode === "pc"
                    ? "bg-blue-50 border-blue-500 text-blue-700"
                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                <Monitor className="w-4 h-4" />
                PC (800px)
              </button>
            </div>
          </div>

          {/* 미리보기 콘텐츠 */}
          <div className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
            {currentMessage ? (
              <div
                className={`bg-white rounded-lg shadow-lg overflow-hidden ${
                  previewMode === "mobile" ? "w-full max-w-sm" : "w-full max-w-2xl"
                }`}
              >
                {/* 받은편지함 헤더 */}
                <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {header.senderName || "발신자"}
                      </p>
                      <p className="text-sm text-gray-600 truncate">
                        {currentMessage.subject}
                      </p>
                      {currentMessage.previewText && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {currentMessage.previewText}
                        </p>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 ml-2 whitespace-nowrap">
                      {getPreviewDate(currentMessage.daysAfter, header.sendHour, header.sendMinute)}
                    </div>
                  </div>
                </div>

                {/* 이메일 내용 */}
                <div className="px-6 py-4 text-base leading-relaxed text-gray-700">
                  <div
                    dangerouslySetInnerHTML={{ __html: currentMessage.bodyHtml }}
                    className="prose prose-sm max-w-none"
                  />
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-400">
                <p className="text-base">이메일을 선택하면 미리보기가 표시됩니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
