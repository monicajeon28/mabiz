"use client";

/**
 * 그룹 이메일 퍼널 빌더
 * PASONA 기반 Day 0-3 자동 이메일 시퀀스 설정 UI
 * Steve Jobs 50대 친화적 UI (제목 20px, 본문 16px, 버튼 48px)
 * 2026-06-16
 */

import { useState, useEffect, useCallback } from "react";
import { showError, showSuccess } from "@/components/ui/Toast";
import { logger } from "@/lib/logger";

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface MessageData {
  id?: string;
  day: number;
  pasonaStage: string;
  subject: string;
  bodyHtml: string;
  previewText?: string;
}

interface FunnelData {
  id: string;
  title: string;
  isActive: boolean;
  messages: MessageData[];
}

interface Props {
  groupId: string;
  hasEmailConfig: boolean;
}

// ─── PASONA 단계 정보 ────────────────────────────────────────────────────────

const DAY_INFO: Record<
  number,
  { label: string; pasonaStage: string; pasonaDesc: string; color: string; bgColor: string }
> = {
  0: {
    label: "신청 당일",
    pasonaStage: "PROBLEM",
    pasonaDesc: "문제 인식 단계 — 고객의 현재 고민을 공감하세요",
    color: "#9B59B6",
    bgColor: "#F3E5F5",
  },
  1: {
    label: "다음날 (1일 후)",
    pasonaStage: "SOLUTION",
    pasonaDesc: "해결책 제시 단계 — 우리 상품이 어떻게 해결해주는지 보여주세요",
    color: "#4A90E2",
    bgColor: "#EBF4FF",
  },
  2: {
    label: "이틀 후",
    pasonaStage: "OFFER",
    pasonaDesc: "혜택 안내 단계 — 특별 혜택이나 할인을 제안하세요",
    color: "#E67E22",
    bgColor: "#FEF5EC",
  },
  3: {
    label: "3일 후",
    pasonaStage: "ACTION",
    pasonaDesc: "행동 촉구 단계 — 지금 바로 결정하도록 긴박감을 주세요",
    color: "#E74C3C",
    bgColor: "#FADBD8",
  },
};

// ─── 기본 PASONA 템플릿 ──────────────────────────────────────────────────────

const DEFAULT_MESSAGES: Omit<MessageData, "id">[] = [
  {
    day: 0,
    pasonaStage: "PROBLEM",
    subject: "안녕하세요 {{name}}님! 신청이 완료됐습니다",
    bodyHtml:
      "<p>{{name}}님, 신청해주셔서 감사합니다!<br><br>담당자가 곧 연락드릴 예정입니다.<br><br>궁금하신 점이 있으시면 언제든지 연락주세요.</p>",
    previewText: "신청이 완료됐습니다. 담당자가 곧 연락드릴게요.",
  },
  {
    day: 1,
    pasonaStage: "SOLUTION",
    subject: "{{name}}님을 위한 특별한 정보가 있어요",
    bodyHtml:
      "<p>{{name}}님,<br><br>어제 신청해주신 내용을 검토해보니 딱 맞는 상품이 있습니다.<br><br>많은 분들이 비슷한 고민을 하셨는데, 저희와 함께하신 후 크게 만족하셨어요.<br><br>더 자세한 안내를 드리고 싶습니다. 편하신 시간에 연락 주세요!</p>",
    previewText: "{{name}}님께 딱 맞는 해결책이 있어요.",
  },
  {
    day: 2,
    pasonaStage: "OFFER",
    subject: "{{name}}님, 이번 주까지만 특별 혜택이 있어요",
    bodyHtml:
      "<p>{{name}}님,<br><br>이번 주까지만 특별 할인 혜택을 드립니다.<br><br>지금 바로 결정하시면 더 좋은 조건으로 모셔드릴 수 있어요.<br><br>놓치지 마세요!</p>",
    previewText: "이번 주까지만 특별 혜택! 놓치지 마세요.",
  },
  {
    day: 3,
    pasonaStage: "ACTION",
    subject: "{{name}}님, 마지막 기회입니다",
    bodyHtml:
      "<p>{{name}}님,<br><br>오늘이 특별 혜택의 마지막 날입니다.<br><br>지금 바로 연락 주시면 최우선으로 도와드리겠습니다.<br><br>오늘 하루만 기다리고 있겠습니다!</p>",
    previewText: "오늘이 마지막입니다. 지금 바로 연락 주세요!",
  },
];

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export function GroupEmailFunnelBuilder({ groupId, hasEmailConfig }: Props) {
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isActive, setIsActive] = useState(true);

  // Day별 메시지 상태
  const [messages, setMessages] = useState<Omit<MessageData, "id">[]>(
    DEFAULT_MESSAGES
  );

  // ─── 퍼널 조회 ────────────────────────────────────────────────────────────

  const loadFunnel = useCallback(async () => {
    try {
      const res = await fetch(`/api/groups/${groupId}/email-funnel`);
      const data = await res.json() as { ok: boolean; funnel?: FunnelData };
      if (data.ok && data.funnel) {
        setFunnel(data.funnel);
        setIsActive(data.funnel.isActive);
        // 기존 메시지로 폼 채우기
        const existingMessages: Omit<MessageData, "id">[] = [0, 1, 2, 3].map((day) => {
          const found = data.funnel!.messages.find((m) => m.day === day);
          return {
            day,
            pasonaStage: found?.pasonaStage ?? DAY_INFO[day].pasonaStage,
            subject: found?.subject ?? DEFAULT_MESSAGES[day].subject,
            bodyHtml: found?.bodyHtml ?? DEFAULT_MESSAGES[day].bodyHtml,
            previewText: found?.previewText ?? DEFAULT_MESSAGES[day].previewText,
          };
        });
        setMessages(existingMessages);
      }
    } catch (err) {
      logger.error("[GroupEmailFunnelBuilder] loadFunnel", { err });
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadFunnel();
  }, [loadFunnel]);

  // ─── 메시지 수정 ──────────────────────────────────────────────────────────

  const updateMessage = (
    day: number,
    field: "subject" | "bodyHtml" | "previewText",
    value: string
  ) => {
    setMessages((prev) =>
      prev.map((m) => (m.day === day ? { ...m, [field]: value } : m))
    );
  };

  // ─── 저장 ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    // 빈 필드 검증
    for (const msg of messages) {
      if (!msg.subject.trim()) {
        showError(`${DAY_INFO[msg.day].label} 이메일 제목을 입력해주세요.`);
        return;
      }
      if (!msg.bodyHtml.trim()) {
        showError(`${DAY_INFO[msg.day].label} 이메일 내용을 입력해주세요.`);
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/email-funnel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "이메일 퍼널",
          isActive,
          messages,
        }),
      });

      const data = await res.json() as { ok: boolean; funnel?: FunnelData; error?: string };

      if (data.ok) {
        showSuccess("이메일 퍼널이 저장됐습니다! 자동 발송이 시작됩니다.");
        await loadFunnel();
      } else {
        showError(data.error || "저장에 실패했습니다.");
      }
    } catch (err) {
      logger.error("[GroupEmailFunnelBuilder] handleSave", { err });
      showError("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  // ─── 기본값으로 초기화 ────────────────────────────────────────────────────

  const handleReset = () => {
    setMessages(DEFAULT_MESSAGES);
    showSuccess("기본 템플릿으로 초기화됐습니다.");
  };

  // ─── 공통 스타일 ──────────────────────────────────────────────────────────

  const inputClass =
    "w-full border border-gray-300 rounded-lg px-4 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition";

  // ─── 로딩 ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <div className="h-8 bg-gray-100 rounded-lg animate-pulse w-1/2" />
        <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  // ─── 이메일 설정 없으면 안내 ──────────────────────────────────────────────

  if (!hasEmailConfig) {
    return (
      <div className="max-w-2xl">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <h3 className="text-lg font-bold text-yellow-900 mb-2">
            📧 이메일 계정 연결이 필요해요
          </h3>
          <p className="text-base text-yellow-800">
            이메일 퍼널을 설정하려면 먼저 이메일 설정 탭에서 이메일 계정을 연결하세요.
          </p>
          <p className="text-sm text-yellow-700 mt-3">
            연결 방법: 이메일 설정 탭 → 이메일 서버 정보 입력 → 테스트 → 저장
          </p>
        </div>
      </div>
    );
  }

  // ─── 렌더 ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── 섹션 제목 ─────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">📧 이메일 자동 발송 설정</h2>
        <p className="mt-2 text-base text-gray-600">
          신청하신 분들에게 자동으로 이메일을 보내요. 모니카가 설계한 단계별 방식으로 발송됩니다.
        </p>
      </div>

      {/* ── 현재 상태 배지 ────────────────────────────────────────────── */}
      {funnel && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50">
          <span
            className={`inline-block w-3 h-3 rounded-full shrink-0 ${
              funnel.isActive ? "bg-green-500" : "bg-gray-400"
            }`}
          />
          <div>
            <span className="text-base font-semibold text-gray-800">
              {funnel.isActive ? "자동 발송 중" : "발송 중지됨"}
            </span>
            <p className="text-sm text-gray-500 mt-0.5">
              {funnel.messages.length}개 메시지 설정됨 (신청 당일~{funnel.messages.length - 1}일 후)
            </p>
          </div>
        </div>
      )}

      {/* ── Day별 메시지 카드 ─────────────────────────────────────────── */}
      {messages.map((msg) => {
        const info = DAY_INFO[msg.day];
        return (
          <div
            key={msg.day}
            className="bg-white border border-gray-200 rounded-xl overflow-hidden"
          >
            {/* 카드 헤더 */}
            <div
              className="flex items-center gap-3 px-6 py-4"
              style={{ backgroundColor: info.bgColor }}
            >
              <span
                className="text-2xl shrink-0"
              >
                {msg.day === 0 ? "📩" : msg.day === 1 ? "📬" : msg.day === 2 ? "🎁" : "⏰"}
              </span>
              <div>
                <p className="text-base font-semibold text-gray-900">
                  {info.label}
                </p>
                <p className="text-sm text-gray-600">{info.pasonaDesc}</p>
              </div>
            </div>

            {/* 카드 폼 */}
            <div className="px-6 py-5 space-y-4">
              {/* 제목 */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">
                  이메일 제목
                </label>
                <input
                  type="text"
                  value={msg.subject}
                  onChange={(e) => updateMessage(msg.day, "subject", e.target.value)}
                  placeholder="예: 안녕하세요 {{name}}님!"
                  className={inputClass}
                  style={{ height: "48px" }}
                />
              </div>

              {/* 본문 */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">
                  이메일 내용
                </label>
                <textarea
                  value={msg.bodyHtml}
                  onChange={(e) => updateMessage(msg.day, "bodyHtml", e.target.value)}
                  placeholder="이메일 내용을 입력하세요. HTML 태그 사용 가능합니다."
                  className={`${inputClass} resize-y`}
                  style={{ minHeight: "120px", paddingTop: "12px", paddingBottom: "12px" }}
                />
                <p className="mt-1 text-sm text-gray-500">
                  HTML 태그 사용 가능 (예: &lt;p&gt;, &lt;br&gt;, &lt;strong&gt;)
                </p>
              </div>

              {/* 미리보기 텍스트 (선택) */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">
                  미리보기 문구{" "}
                  <span className="font-normal text-gray-500">(선택 — 받은편지함에서 보이는 한줄 설명)</span>
                </label>
                <input
                  type="text"
                  value={msg.previewText ?? ""}
                  onChange={(e) => updateMessage(msg.day, "previewText", e.target.value)}
                  placeholder="예: 신청 완료! 담당자가 곧 연락드립니다."
                  className={inputClass}
                  style={{ height: "48px" }}
                />
              </div>
            </div>
          </div>
        );
      })}

      {/* ── 자동 발송 켜기/끄기 ───────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <label
          className="flex items-center gap-4 cursor-pointer"
          style={{ minHeight: "48px" }}
        >
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-6 h-6 accent-green-500 shrink-0"
          />
          <div>
            <p className="text-base font-semibold text-gray-900">
              ✅ 지금부터 자동 발송 시작
            </p>
            <p className="text-sm text-gray-600 mt-0.5">
              체크하면 저장과 동시에 새로운 신청자에게 자동으로 이메일이 발송됩니다.
            </p>
          </div>
        </label>
      </div>

      {/* ── 변수 안내 ─────────────────────────────────────────────────── */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <p className="text-base font-semibold text-blue-900 mb-3">
          💡 사용 가능한 변수
        </p>
        <div className="grid grid-cols-2 gap-2 text-sm text-blue-800">
          {[
            { var: "{{name}}", desc: "고객 이름" },
            { var: "{{email}}", desc: "이메일 주소" },
            { var: "{{phone}}", desc: "전화번호" },
            { var: "{{groupName}}", desc: "그룹 이름" },
            { var: "{{product}}", desc: "상품명" },
            { var: "{{price}}", desc: "가격" },
          ].map(({ var: v, desc }) => (
            <div key={v} className="flex items-center gap-2">
              <code className="bg-blue-100 px-2 py-0.5 rounded text-blue-900 font-mono text-xs">
                {v}
              </code>
              <span>{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 버튼 영역 ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* 저장 버튼 */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl transition"
          style={{ height: "52px", fontSize: "16px" }}
        >
          {saving ? (
            <>
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              저장 중...
            </>
          ) : (
            "💾 저장하기"
          )}
        </button>

        {/* 초기화 버튼 */}
        <button
          onClick={handleReset}
          disabled={saving}
          className="sm:w-36 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 font-semibold rounded-xl transition border border-gray-300"
          style={{ height: "52px", fontSize: "16px" }}
        >
          🔄 기본값으로
        </button>
      </div>

    </div>
  );
}
