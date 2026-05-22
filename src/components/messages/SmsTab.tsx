"use client";
import { useState, useCallback, useRef } from "react";
import {
  ChevronDown, ChevronUp, AlertCircle, CheckCircle, Settings, Users,
  Link2, Zap, Send,
} from "lucide-react";
import { showError, showSuccess } from "@/components/ui/Toast";
import DOMPurify from "dompurify";
import { ReviewTab } from "@/components/messages/ReviewTab";
import { canReview } from "@/lib/rbac";
import type { UserRole } from "@/lib/rbac";

// ─── 타입 ────────────────────────────────────────────────────────
type Group       = { id: string; name: string; color: string | null; _count: { members: number } };
type ShortLink   = { id: string; code: string; title: string | null; contactId: string | null };
type SmsTemplate = { id: string; title: string; content: string; category: string | null };
type SmsConfig   = { aligoUserId: string; senderPhone: string; senderVerified: boolean; aligoKeyTail: string } | null;

const REPLACEMENTS = [
  { label: "[이름]",       desc: "고객 이름" },
  { label: "[전화번호]",   desc: "고객 전화번호" },
  { label: "[담당자]",     desc: "나의 이름" },
  { label: "[상품명]",     desc: "관심 상품명" },
  { label: "[출발일]",     desc: "예정 출발일" },
];

const TEMPLATE_CATEGORIES = [
  { value: "",                label: "전체" },
  { value: "CARE_VIP",       label: "VIP 케어" },
  { value: "SEQUENCE",       label: "시퀀스" },
  { value: "LIVE_BROADCAST", label: "라이브 방송" },
  { value: "GENERAL",        label: "일반" },
];

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

// ─── Props 인터페이스 ────────────────────────────────────────────
interface SmsTabProps {
  smsConfig: SmsConfig;
  configLoading: boolean;
  groups: Group[];
  selectedGroup: string | null;
  onGroupChange: (groupId: string) => void;
  message: string;
  onMessageChange: (msg: string) => void;
  dryRunResult: { count: number; sample: string } | null;
  onDryRun: () => Promise<void>;
  dryRunLoading: boolean;
  confirmed: boolean;
  onConfirmChange: (checked: boolean) => void;
  onSend: () => Promise<void>;
  sending: boolean;
  userRole: UserRole | null;
  myLinks: ShortLink[];
  templates: SmsTemplate[];
  templateCat: string;
  onTemplateCatChange: (cat: string) => void;
  showTemplates: boolean;
  onShowTemplatesChange: (show: boolean) => void;
  onLoadTemplates: () => void;
  linkNoCount: number;
  rateLimitStatus: { used: number; remaining: number; resetAt: string } | null;
  csrfToken: string;
}

export function SmsTab({
  smsConfig,
  configLoading,
  groups,
  selectedGroup,
  onGroupChange,
  message,
  onMessageChange,
  dryRunResult,
  onDryRun,
  dryRunLoading,
  confirmed,
  onConfirmChange,
  onSend,
  sending,
  userRole,
  myLinks,
  templates,
  templateCat,
  onTemplateCatChange,
  showTemplates,
  onShowTemplatesChange,
  onLoadTemplates,
  linkNoCount,
  rateLimitStatus,
  csrfToken,
}: SmsTabProps) {
  const [showReplace, setShowReplace] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentGroup = groups.find(g => g.id === selectedGroup);

  const insertAtCursor = useCallback((token: string) => {
    const el = textareaRef.current;
    if (!el) { onMessageChange(message + token); return; }
    const start = el.selectionStart ?? message.length;
    const end   = el.selectionEnd   ?? message.length;
    const next  = message.substring(0, start) + token + message.substring(end);
    onMessageChange(next);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + token.length;
      el.focus();
    });
  }, [message, onMessageChange]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 좌측 설정 패널 */}
      <div className="lg:col-span-1 space-y-4">

        {/* 알리고 연결 상태 */}
        <div className={`rounded-xl p-4 border ${smsConfig ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
          {configLoading ? (
            <div className="h-5 bg-gray-200 rounded animate-pulse" />
          ) : smsConfig ? (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-green-700">알리고 연결됨</span>
              </div>
              <p className="text-xs text-green-600">발신번호: {smsConfig.senderPhone}</p>
              <p className="text-xs text-green-600">ID: {smsConfig.aligoUserId} · 키 ****{smsConfig.aligoKeyTail}</p>
              {!smsConfig.senderVerified && (
                <p className="text-xs text-amber-600 mt-1">⚠ 발신번호 미인증 — Aligo 콘솔에서 ARS 인증 필요</p>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium text-amber-700">알리고 미연결</span>
              </div>
              <p className="text-xs text-amber-600 mb-2">내 알리고 계정을 연결해야 SMS를 보낼 수 있습니다.</p>
              <a href="/settings/sms" className="text-xs text-blue-600 underline flex items-center gap-1">
                <Settings className="w-3 h-3" /> 알리고 계정 연결하기
              </a>
            </div>
          )}
        </div>

        {/* 그룹 선택 */}
        <div className="rounded-xl border bg-white p-4">
          <label htmlFor="sms-group-select" className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1 block">
            <Users className="w-3.5 h-3.5" aria-hidden="true" /> 수신 그룹
          </label>
          <select
            id="sms-group-select"
            value={selectedGroup ?? ""}
            onChange={e => onGroupChange(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            aria-label="SMS 수신 그룹 선택"
          >
            <option value="">그룹 선택...</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name} ({g._count.members}명)</option>
            ))}
          </select>
          {currentGroup && (
            <p className="text-xs text-gray-600 mt-1">최대 {currentGroup._count.members}명에게 발송됩니다.</p>
          )}
        </div>

        {/* 템플릿 추천 */}
        <div className="rounded-xl border bg-white overflow-hidden">
          <button
            onClick={() => onShowTemplatesChange(!showTemplates)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            aria-label="SMS 템플릿 추천 패널 열기"
            aria-expanded={showTemplates}
          >
            <span className="flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-500" aria-hidden="true" />템플릿 추천</span>
            {showTemplates ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
          </button>
          {showTemplates && (
            <div className="border-t px-4 py-3">
              <div className="flex gap-1 flex-wrap mb-3">
                {TEMPLATE_CATEGORIES.map(c => (
                  <button
                    key={c.value}
                    onClick={() => {
                      onTemplateCatChange(c.value);
                      onLoadTemplates();
                    }}
                    className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${templateCat === c.value ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 hover:border-blue-300"}`}
                    aria-pressed={templateCat === c.value}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {templates.length === 0
                  ? <p className="text-xs text-gray-600 text-center py-3">템플릿 없음</p>
                  : templates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        onMessageChange(t.content);
                        onShowTemplatesChange(false);
                      }}
                      className="w-full text-left p-2.5 rounded-lg border hover:border-blue-300 hover:bg-blue-50 transition-colors"
                      aria-label={`템플릿: ${t.title}`}
                    >
                      <p className="text-xs font-medium text-gray-700">{t.title}</p>
                      <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{t.content}</p>
                    </button>
                  ))
                }
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 우측 작성 영역 */}
      <div className="lg:col-span-2 space-y-4">

        {/* 메시지 작성 */}
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="sms-message-input" className="text-xs font-semibold text-gray-600">메시지 내용</label>
            <span className={`text-xs ${message.length > 80 ? "text-red-700 font-medium" : "text-gray-600"}`}>
              {message.length}/90자
            </span>
          </div>
          <textarea
            id="sms-message-input"
            ref={textareaRef}
            value={message}
            onChange={e => onMessageChange(e.target.value)}
            placeholder="내용을 입력하거나 왼쪽에서 템플릿을 선택하세요"
            rows={6}
            className="w-full border rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
            aria-label="SMS 메시지 내용"
          />

          {/* 치환변수 패널 */}
          <div className="mt-2">
            <button
              onClick={() => setShowReplace(v => !v)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
              aria-expanded={showReplace}
              aria-label="치환변수 및 어필리에이트 링크 패널"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showReplace ? "rotate-180" : ""}`} aria-hidden="true" />
              치환변수 & 어필리에이트 링크
            </button>
            {showReplace && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-1.5">기본 치환변수 (클릭 시 삽입)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {REPLACEMENTS.map(r => (
                      <button
                        key={r.label}
                        onClick={() => insertAtCursor(r.label)}
                        className="px-2 py-1 bg-white border rounded text-xs text-gray-700 hover:border-blue-400 hover:text-blue-600 transition-colors"
                        aria-label={`${r.label} 삽입 - ${r.desc}`}
                      >
                        {r.label} <span className="text-gray-600">({r.desc})</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1">
                    <Link2 className="w-3 h-3 text-blue-500" />
                    내 어필리에이트 추적링크
                  </p>
                  {myLinks.length > 0 ? (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {myLinks.map(l => (
                          <button
                            key={l.id}
                            onClick={() => insertAtCursor(`${APP_URL}/l/${l.code}`)}
                            className="px-2 py-1 bg-white border rounded text-xs text-blue-600 hover:border-blue-400 transition-colors"
                            aria-label={`추적링크 삽입: ${l.title ?? l.code}`}
                          >
                            🔗 {l.title ?? l.code}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        그룹 내 해당 고객의 링크가 삽입됩니다. 링크 없는 고객은 자동 제외됩니다.
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-600">
                      개인 추적링크가 없습니다.{" "}
                      <a href="/links" className="text-blue-500 underline">상담 링크</a>에서
                      고객에게 연결된 링크를 만들어주세요.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 미리보기 & 발송 */}
        <div className="rounded-xl border bg-white p-4">
          <button
            onClick={onDryRun}
            disabled={!selectedGroup || !message.trim() || dryRunLoading}
            className="w-full py-2.5 border-2 border-blue-300 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed mb-3"
            aria-label={`${dryRunLoading ? '로딩 중' : '발송 대상 미리보기'}`}
          >
            {dryRunLoading ? '미리보기 중...' : '발송 대상 미리보기'}
          </button>

          {selectedGroup && rateLimitStatus && (
            <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-700">
                📊 발송 횟수: {rateLimitStatus.used}/5회
                {rateLimitStatus.remaining === 0 && (
                  <span className="block text-xs text-red-700 font-semibold mt-1">
                    ⏰ 내일 {rateLimitStatus.resetAt}부터 가능
                  </span>
                )}
              </p>
            </div>
          )}

          {dryRunResult && (
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-700 mb-2">
                  발송 예정:{" "}
                  <span className="text-blue-600 font-bold text-base">{dryRunResult.count}명</span>
                  {linkNoCount > 0 && (
                    <span className="text-amber-600 ml-2 text-xs">
                      (추적링크 없는 고객 {linkNoCount}명 자동 제외)
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-600 font-medium mb-1">첫 번째 고객 미리보기:</p>
                <div className="text-sm bg-white border rounded p-2.5 whitespace-pre-wrap break-words">
                  {DOMPurify.sanitize(dryRunResult.sample, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })}
                </div>
              </div>

              {/* 검수 탭 (관리자/대리점장용) */}
              {userRole && canReview(userRole) && (
                <ReviewTab
                  groupId={selectedGroup ?? ""}
                  message={message}
                  dryRunResult={dryRunResult}
                  onApprove={onSend}
                  onReject={() => {
                    // 기존 로직 유지
                    showError("검수가 거절되었습니다.");
                  }}
                  approving={sending}
                />
              )}

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={e => onConfirmChange(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded"
                  aria-label={`${dryRunResult.count}명에게 SMS 발송 확인`}
                />
                <span className="text-sm text-gray-700">
                  위 내용을 확인했으며,{" "}
                  <strong className="text-blue-600">{dryRunResult.count}명</strong>에게 SMS를 발송합니다.
                </span>
              </label>

              <button
                onClick={onSend}
                disabled={!dryRunResult || !confirmed || sending}
                className={`w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                  !dryRunResult || !confirmed || sending
                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
                aria-label={`${dryRunResult?.count || 0}명에게 SMS 발송`}
              >
                <Send className="w-4 h-4" />
                {sending ? "발송 중..." : `✓ 발송 (${dryRunResult?.count || 0}명)`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
