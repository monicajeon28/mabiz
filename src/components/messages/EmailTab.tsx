"use client";
import { useState, useCallback } from "react";
import {
  Clock, ImageIcon, Settings, Users, Send, X, Zap,
} from "lucide-react";
import { showError, showSuccess } from "@/components/ui/Toast";

// ─── 타입 ────────────────────────────────────────────────────────
type Group     = { id: string; name: string; color: string | null; _count: { members: number } };
type ImageItem = { id: number | string; title: string; thumbnailUrl: string | null; driveUrl: string | null };
type EmailConfig = { senderName: string; senderEmail: string; isActive: boolean } | null;

const REPLACEMENTS = [
  { label: "[이름]",       desc: "고객 이름" },
  { label: "[전화번호]",   desc: "고객 전화번호" },
  { label: "[담당자]",     desc: "나의 이름" },
  { label: "[상품명]",     desc: "관심 상품명" },
  { label: "[출발일]",     desc: "예정 출발일" },
];

// ─── Props 인터페이스 ────────────────────────────────────────────
interface EmailTabProps {
  emailConfig: EmailConfig;
  configLoading: boolean;
  senderName: string;
  onSenderNameChange: (name: string) => void;
  onSaveSenderName: () => Promise<void>;
  savingName: boolean;
  groups: Group[];
  selectedGroup: string | null;
  onGroupChange: (groupId: string) => void;
  subject: string;
  onSubjectChange: (subject: string) => void;
  body: string;
  onBodyChange: (body: string) => void;
  images: ImageItem[];
  imagesLoaded: boolean;
  showImages: boolean;
  onShowImagesChange: (show: boolean) => void;
  onLoadImages: () => void;
  sendMode: "now" | "schedule";
  onSendModeChange: (mode: "now" | "schedule") => void;
  scheduledAt: string;
  onScheduledAtChange: (time: string) => void;
  onSend: () => Promise<void>;
  sending: boolean;
  csrfToken: string;
}

export function EmailTab({
  emailConfig,
  configLoading,
  senderName,
  onSenderNameChange,
  onSaveSenderName,
  savingName,
  groups,
  selectedGroup,
  onGroupChange,
  subject,
  onSubjectChange,
  body,
  onBodyChange,
  images,
  imagesLoaded,
  showImages,
  onShowImagesChange,
  onLoadImages,
  sendMode,
  onSendModeChange,
  scheduledAt,
  onScheduledAtChange,
  onSend,
  sending,
  csrfToken,
}: EmailTabProps) {
  const currentGroup = groups.find(g => g.id === selectedGroup);

  const insertImage = useCallback((url: string) => {
    if (!url) return;
    onBodyChange(body + `\n\n[이미지: ${url}]`);
    onShowImagesChange(false);
  }, [body, onBodyChange, onShowImagesChange]);

  const insertReplacement = useCallback((label: string) => {
    onBodyChange(body + label);
  }, [body, onBodyChange]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 좌측 설정 패널 */}
      <div className="lg:col-span-1 space-y-4">

        {/* 발신자 이름 설정 */}
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-1">
            🧑 발신자 이름 설정
          </p>
          {configLoading ? (
            <div className="h-8 bg-gray-100 rounded animate-pulse" />
          ) : emailConfig ? (
            <div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={senderName}
                  onChange={e => onSenderNameChange(e.target.value)}
                  placeholder="크루즈닷 모니카"
                  className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  aria-label="이메일 발신자 이름"
                />
                <button
                  onClick={onSaveSenderName}
                  disabled={savingName}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors"
                  aria-label="발신자 이름 저장"
                >
                  {savingName ? "저장중" : "저장"}
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                보내는 사람:<br />
                <strong>{senderName || "크루즈닷"}</strong>{" "}
                &lt;{emailConfig.senderEmail}&gt;
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-amber-700 mb-2">이메일 설정이 필요합니다.</p>
              <a href="/settings/email" className="text-sm text-blue-600 underline flex items-center gap-1 hover:text-blue-700">
                <Settings className="w-3 h-3" /> 이메일 설정하기
              </a>
            </div>
          )}
        </div>

        {/* 그룹 선택 */}
        <div className="rounded-xl border bg-white p-4">
          <label htmlFor="email-group-select" className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-1 block">
            <Users className="w-3.5 h-3.5" aria-hidden="true" /> 수신 그룹
          </label>
          <select
            id="email-group-select"
            value={selectedGroup ?? ""}
            onChange={e => onGroupChange(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            aria-label="이메일 수신 그룹 선택"
          >
            <option value="">그룹 선택...</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name} ({g._count.members}명)</option>
            ))}
          </select>
          {currentGroup && (
            <p className="text-sm text-gray-600 mt-1">{currentGroup._count.members}명에게 발송됩니다.</p>
          )}
        </div>

        {/* 발송 시간 */}
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm font-semibold text-gray-500 mb-3">발송 시간</p>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => onSendModeChange("now")}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm font-medium border transition-all ${sendMode === "now" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              aria-pressed={sendMode === "now"}
              aria-label="즉시 발송"
            >
              <Zap className="w-3.5 h-3.5" /> 즉시 발송
            </button>
            <button
              onClick={() => onSendModeChange("schedule")}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm font-medium border transition-all ${sendMode === "schedule" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              aria-pressed={sendMode === "schedule"}
              aria-label="예약 발송"
            >
              <Clock className="w-3.5 h-3.5" /> 예약 발송
            </button>
          </div>
          {sendMode === "schedule" && (
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => onScheduledAtChange(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              aria-label="예약 발송 시간"
            />
          )}
        </div>
      </div>

      {/* 우측 작성 영역 */}
      <div className="lg:col-span-2 space-y-4">

        {/* 제목 */}
        <div className="rounded-xl border bg-white p-4">
          <label htmlFor="email-subject-input" className="text-sm font-semibold text-gray-500 mb-2 block">이메일 제목</label>
          <input
            id="email-subject-input"
            type="text"
            value={subject}
            onChange={e => onSubjectChange(e.target.value)}
            placeholder="예: 5월 지중해 크루즈 특가 안내"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            aria-label="이메일 제목"
          />
        </div>

        {/* 본문 */}
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="email-body-input" className="text-sm font-semibold text-gray-500">본문 내용</label>
            <button
              onClick={onLoadImages}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 border border-blue-200 px-2 py-1 rounded-lg transition-colors"
              aria-label="이미지 라이브러리 열기"
            >
              <ImageIcon className="w-3.5 h-3.5" /> 이미지 라이브러리
            </button>
          </div>

          {/* 치환변수 빠른 삽입 */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {REPLACEMENTS.map(r => (
              <button
                key={r.label}
                onClick={() => insertReplacement(r.label)}
                className="px-2 py-0.5 bg-gray-100 rounded text-sm text-gray-700 hover:bg-blue-100 hover:text-blue-600 transition-colors"
                aria-label={`${r.label} 삽입 - ${r.desc}`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <textarea
            id="email-body-input"
            value={body}
            onChange={e => onBodyChange(e.target.value)}
            placeholder={"안녕하세요 [이름]님,\n\n크루즈닷에서 특별한 소식을 전합니다."}
            rows={10}
            className="w-full border rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
            aria-label="이메일 본문"
          />

          {/* 이미지 라이브러리 패널 */}
          {showImages && (
            <div className="mt-3 border rounded-xl p-3 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">이미지 선택</p>
                <button
                  onClick={() => onShowImagesChange(false)}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                  aria-label="이미지 라이브러리 닫기"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>
              {!imagesLoaded ? (
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map(i => <div key={i} className="aspect-square bg-gray-300 rounded-lg animate-pulse" />)}
                </div>
              ) : images.length === 0 ? (
                <p className="text-sm text-gray-600 text-center py-4">이미지 라이브러리가 비어있습니다.</p>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                  {images.map(img => (
                    <button
                      key={img.id}
                      onClick={() => insertImage((img.driveUrl ?? img.thumbnailUrl) ?? "")}
                      title={img.title}
                      className="aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-blue-400 bg-gray-200 transition-colors"
                      aria-label={`이미지 삽입: ${img.title}`}
                    >
                      {img.thumbnailUrl ? (
                        <img src={img.thumbnailUrl} alt={img.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-gray-600" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 발송 버튼 */}
        <button
          onClick={onSend}
          disabled={sending || !selectedGroup || !subject.trim() || !body.trim()}
          className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
          aria-label={`이메일 ${sendMode === "now" ? "즉시 발송" : "예약 발송"}`}
        >
          <Send className="w-4 h-4" />
          {sending ? "발송 중..." : sendMode === "now" ? "이메일 즉시 발송" : "예약 발송 등록"}
        </button>
      </div>
    </div>
  );
}
