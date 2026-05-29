"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  MessageSquare, Mail, Send, ChevronDown, ChevronUp,
  Link2, AlertCircle, CheckCircle, Settings, Users,
  Image as ImageIcon, Clock, Zap, X, User, MessageCircle,
} from "lucide-react";
import { showError, showSuccess } from "@/components/ui/Toast";
import DOMPurify from "dompurify";
import { ReviewTab } from "@/components/messages/ReviewTab";
import { canReview } from "@/lib/rbac-client";
import type { UserRole } from "@/lib/rbac-client";

// ─── 타입 ────────────────────────────────────────────────────────
type Group       = { id: string; name: string; color: string | null; _count: { members: number } };
type ShortLink   = { id: string; code: string; title: string | null; contactId: string | null };
type SmsTemplate = { id: string; title: string; content: string; category: string | null };
type ImageItem   = { id: number | string; title: string; thumbnailUrl: string | null; fullUrl: string | null };
type SmsConfig   = { aligoUserId: string; senderPhone: string; senderVerified: boolean; aligoKeyTail: string } | null;
type EmailConfig = { senderName: string; senderEmail: string; isActive: boolean } | null;

const REPLACEMENTS = [
  { label: "[이름]",       desc: "고객 이름" },
  { label: "[전화번호]",   desc: "고객 전화번호" },
  { label: "[담당자]",     desc: "나의 이름" },
  { label: "[상품명]",     desc: "관심 상품명" },
  { label: "[출발일]",     desc: "예정 출발일" },
  { label: "[가격]",       desc: "상품 가격" },
  { label: "[출발지]",     desc: "출발 도시" },
  { label: "[목적지]",     desc: "목적지 도시" },
  { label: "[일정]",       desc: "여행 일정 (박수)" },
  { label: "[객실유형]",   desc: "선호 객실 유형" },
];

const TEMPLATE_CATEGORIES = [
  { value: "",                label: "전체" },
  // 심리학 렌즈 기반 Day 0-3 시퀀스
  { value: "DAY_0",          label: "🔔 Day 0 (초대/문제)" },
  { value: "DAY_1",          label: "📢 Day 1 (자극/솔루션)" },
  { value: "DAY_2",          label: "💰 Day 2 (오퍼)" },
  { value: "DAY_3",          label: "⚡ Day 3 (긴박/액션)" },
  // 기타 카테고리
  { value: "CARE_VIP",       label: "👑 VIP 케어" },
  { value: "SEQUENCE",       label: "🔗 시퀀스" },
  { value: "LIVE_BROADCAST", label: "📺 라이브 방송" },
  { value: "GENERAL",        label: "📝 일반" },
];

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

// ─── 유틸리티 ────────────────────────────────────────────────────
/**
 * datetime-local input 타입 지원 확인
 * Safari, IE에서는 지원하지 않으므로 fallback UI 사용
 */
function supportsDatetimeLocal(): boolean {
  if (typeof document === "undefined") return true;  // SSR 환경
  const input = document.createElement("input");
  input.type = "datetime-local";
  return input.type === "datetime-local";
}

// ─── 메인 컴포넌트 ───────────────────────────────────────────────
export default function MessagesPage() {
  const [tab, setTab] = useState<"sms" | "email" | "kakao">("sms");

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">📨 문자 CRM</h1>
      <p className="text-sm text-gray-500 mb-6">SMS · 이메일 · 카카오 — 그룹 대상 마케팅 발송</p>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        <button onClick={() => setTab("sms")}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === "sms" ? "bg-white shadow text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
          <MessageSquare className="w-4 h-4" /> SMS
        </button>
        <button onClick={() => setTab("email")}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === "email" ? "bg-white shadow text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
          <Mail className="w-4 h-4" /> 이메일
        </button>
        <button onClick={() => setTab("kakao")}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === "kakao" ? "bg-white shadow text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
          <MessageCircle className="w-4 h-4" /> 카카오
        </button>
      </div>

      {tab === "sms"   && <SmsTab />}
      {tab === "email" && <EmailTab />}
      {tab === "kakao" && <KakaoTab />}
    </div>
  );
}

// ─── SMS 탭 ─────────────────────────────────────────────────────
function SmsTab() {
  const [smsConfig,      setSmsConfig]      = useState<SmsConfig>(null);
  const [configLoading,  setConfigLoading]  = useState(true);
  const [groups,         setGroups]         = useState<Group[]>([]);
  const [selectedGroup,  setSelectedGroup]  = useState("");
  const [message,        setMessage]        = useState("");
  const [showReplace,    setShowReplace]    = useState(false);
  const [myLinks,        setMyLinks]        = useState<ShortLink[]>([]);
  const [templates,        setTemplates]        = useState<SmsTemplate[]>([]);
  const [templateCat,      setTemplateCat]      = useState("");
  const [showTemplates,    setShowTemplates]    = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [dryRunResult,   setDryRunResult]   = useState<{ count: number; sample: string } | null>(null);
  const [linkNoCount,    setLinkNoCount]    = useState(0);
  const [unreplacedVars, setUnreplacedVars] = useState<string[]>([]);
  const [confirmed,      setConfirmed]      = useState(false);
  const [sending,        setSending]        = useState(false);
  const [csrfToken,      setCsrfToken]      = useState("");
  const [rateLimitStatus, setRateLimitStatus] = useState<{ used: number; remaining: number; resetAt: string } | null>(null);
  const [userRole,       setUserRole]       = useState<UserRole | null>(null);
  // 스케줄링 기능
  const [scheduleMode,   setScheduleMode]   = useState<"now" | "scheduled">("now");
  const [scheduledTime,  setScheduledTime]  = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // CSRF 토큰 획득
  useEffect(() => {
    fetch("/api/csrf-token").then(r => r.json())
      .then(d => { if (d.ok && d.token) setCsrfToken(d.token); })
      .catch(() => { /* silently fail */ });
  }, []);

  // 사용자 역할 조회
  useEffect(() => {
    fetch("/api/user/role").then(r => r.json())
      .then(d => { if (d.ok && d.role) setUserRole(d.role as UserRole); })
      .catch(() => { /* silently fail */ });
  }, []);

  useEffect(() => {
    fetch("/api/settings/sms-config").then(r => r.json())
      .then(d => { if (d.ok) setSmsConfig(d.config); })
      .finally(() => setConfigLoading(false));
    fetch("/api/groups").then(r => r.json()).then(d => { if (d.ok) setGroups(d.groups ?? []); });
    fetch("/api/links").then(r => r.json())
      .then(d => { if (d.ok) setMyLinks((d.links ?? []).filter((l: ShortLink) => l.contactId)); });
  }, []);

  const loadTemplates = useCallback(() => {
    const url = templateCat
      ? `/api/tools/sms-templates?category=${templateCat}`
      : "/api/tools/sms-templates";
    setTemplatesLoading(true);
    setTemplates([]);
    fetch(url)
      .then(r => r.json())
      .then(d => { if (d.ok) setTemplates(d.templates ?? []); })
      .catch(() => showError("템플릿 로드 실패"))
      .finally(() => setTemplatesLoading(false));
  }, [templateCat]);

  useEffect(() => { if (showTemplates) loadTemplates(); }, [showTemplates, loadTemplates]);

  const insertAtCursor = (token: string) => {
    const el = textareaRef.current;
    if (!el) { setMessage(prev => prev + token); return; }
    const start = el.selectionStart ?? message.length;
    const end   = el.selectionEnd   ?? message.length;
    const next  = message.substring(0, start) + token + message.substring(end);
    setMessage(next);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + token.length;
      el.focus();
    });
  };

  // useMemo: currentGroup 메모이제이션 (필터링 결과 캐싱)
  const currentGroup = useMemo(
    () => groups.find(g => g.id === selectedGroup),
    [groups, selectedGroup]
  );

  // useCallback: dry-run 메모이제이션 (반복 호출 방지)
  const doDryRun = useCallback(async () => {
    if (!selectedGroup || !message.trim()) { showError("그룹과 메시지를 입력하세요"); return; }
    if (scheduleMode === "scheduled" && !scheduledTime) { showError("발송 시간을 선택해주세요"); return; }

    // [P0-4] 미치환 변수 감지 — [이름] 형태 중 남은 것 경고
    const found = message.match(/\[[^\]]{2,10}\]/g);
    setUnreplacedVars(found ? [...new Set(found)] : []);

    // AbortController로 fetch 취소 관리
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃

    try {
      const res = await fetch(`/api/groups/${selectedGroup}/blast`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({
          message,
          dryRun: true,
          ...(scheduleMode === "scheduled" && { scheduledTime })
        }),
      });
      const d = await res.json() as {
        ok: boolean; count?: number; willSend?: number; sampleMessages?: string[]; linkNoCount?: number; rateLimitStatus?: any;
      };
      if (!d.ok) {
        // Rate Limit 거절 시 명확한 메시지
        if (d.rateLimitStatus?.remaining === 0) {
          showError("일일 발송 한도를 모두 사용했습니다. 내일 초기화됩니다.");
        } else {
          showError("미리보기 실패");
        }
        setDryRunResult(null);
        setConfirmed(false);
        // Rate Limit 상태 업데이트
        if (d.rateLimitStatus) {
          const resetDate = new Date(d.rateLimitStatus.resetAt);
          setRateLimitStatus({
            used: d.rateLimitStatus.used,
            remaining: d.rateLimitStatus.remaining,
            resetAt: resetDate.toLocaleTimeString('ko-KR'),
          });
        }
        return;
      }
      const sampleMsg = d.sampleMessages?.[0] ?? message;
      setDryRunResult({ count: d.willSend ?? d.count ?? 0, sample: sampleMsg });
      setLinkNoCount(d.linkNoCount ?? 0);
      setConfirmed(false);
      if (d.rateLimitStatus) {
        const resetDate = new Date(d.rateLimitStatus.resetAt);
        setRateLimitStatus({
          used: d.rateLimitStatus.used,
          remaining: d.rateLimitStatus.remaining,
          resetAt: resetDate.toLocaleTimeString('ko-KR'),
        });
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        showError("요청 시간 초과 - 다시 시도해주세요");
      } else {
        showError("미리보기 중 오류 발생");
      }
      setDryRunResult(null);
      setConfirmed(false);
    } finally {
      clearTimeout(timeoutId);
    }
  }, [selectedGroup, message, csrfToken, scheduleMode, scheduledTime]);

  // useCallback: 발송 메모이제이션 (반복 호출 방지)
  const doSend = useCallback(async () => {
    // Step A: 미리보기 확인
    if (!dryRunResult) {
      showError("먼저 발송 대상을 확인해주세요.");
      return;
    }

    // Step B: 체크박스 확인
    if (!confirmed) {
      showError("발송 확인 체크박스를 선택해주세요.");
      return;
    }

    // Step C: 최종 확인 다이얼로그 (SSR 안전성 개선)
    const willSend = dryRunResult.count || 0;
    const confirmMsg = `정말 ${willSend}명에게 SMS를 발송하시겠습니까?\n\n메시지: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`;

    if (typeof window === "undefined" || !window.confirm(confirmMsg)) {
      return;  // 사용자가 취소함 또는 SSR 환경
    }

    // Step D: 발송 (AbortController로 취소 관리)
    setSending(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃

    try {
      const res = await fetch(`/api/groups/${selectedGroup}/blast`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({
          message,
          dryRun: false,
          ...(scheduleMode === "scheduled" && { scheduledTime })
        }),
      });
      const d = await res.json() as { ok: boolean; sentCount?: number; failedCount?: number; message?: string };
      if (!d.ok) {
        showError(d.message ?? "발송 실패");
        return;
      }
      showSuccess(`발송 완료: ${d.sentCount ?? 0}명 성공, ${d.failedCount ?? 0}명 실패`);
      setMessage(""); setDryRunResult(null); setConfirmed(false); setRateLimitStatus(null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        showError("발송 요청 시간 초과 - 다시 시도해주세요");
      } else {
        showError("발송 중 오류가 발생했습니다");
      }
    } finally {
      clearTimeout(timeoutId);
      setSending(false);
    }
  }, [selectedGroup, message, csrfToken, dryRunResult, confirmed, scheduleMode, scheduledTime]);

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
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-500 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> 수신 그룹
            </label>
            <a href="/groups" className="text-xs text-blue-600 hover:text-blue-800 font-medium">
              그룹 관리 →
            </a>
          </div>
          <select value={selectedGroup}
            onChange={e => { setSelectedGroup(e.target.value); setDryRunResult(null); setRateLimitStatus(null); }}
            className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">그룹 선택...</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name} ({g._count.members}명)</option>
            ))}
          </select>
          {groups.length === 0 && (
            <p className="text-xs text-gray-400 mt-1.5">
              그룹이 없습니다.{" "}
              <a href="/groups" className="text-blue-500 underline">그룹 관리</a>에서 먼저 만들어 주세요.
            </p>
          )}
          {currentGroup && (
            <p className="text-xs text-gray-400 mt-1">최대 {currentGroup._count.members}명에게 발송됩니다.</p>
          )}
        </div>

        {/* 템플릿 추천 */}
        <div className="rounded-xl border bg-white overflow-hidden">
          <button onClick={() => setShowTemplates(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <span className="flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-500" />템플릿 추천</span>
            {showTemplates ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showTemplates && (
            <div className="border-t px-4 py-3">
              <div className="flex gap-1 flex-wrap mb-3">
                {TEMPLATE_CATEGORIES.map(c => (
                  <button key={c.value} onClick={() => setTemplateCat(c.value)}
                    className={`px-2 py-0.5 rounded-full text-xs border ${templateCat === c.value ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600"}`}>
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {templatesLoading ? (
                  <div className="space-y-2 py-1">
                    {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
                  </div>
                ) : templates.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3">
                    {templateCat ? "해당 카테고리에 템플릿이 없습니다" : "템플릿이 없습니다"}
                  </p>
                ) : templates.map(t => (
                  <button key={t.id} onClick={() => { setMessage(t.content); setShowTemplates(false); }}
                    className="w-full text-left p-2.5 rounded-lg border hover:border-blue-300 hover:bg-blue-50 transition-colors">
                    <p className="text-xs font-medium text-gray-700">{t.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{t.content}</p>
                  </button>
                ))}
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
            <label className="text-xs font-semibold text-gray-500">메시지 내용</label>
            <span className={`text-xs ${message.length > 80 ? "text-red-500 font-medium" : "text-gray-400"}`}>
              {message.length}/90자
            </span>
          </div>
          <textarea
            ref={textareaRef}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="내용을 입력하거나 왼쪽에서 템플릿을 선택하세요"
            rows={6}
            className="w-full border rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
          />

          {/* 스케줄링 옵션 */}
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-4 mb-3">
              <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                <input type="radio" name="sms-schedule" value="now" checked={scheduleMode === "now"}
                  onChange={() => setScheduleMode("now")} className="rounded" />
                즉시 발송
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                <input type="radio" name="sms-schedule" value="scheduled" checked={scheduleMode === "scheduled"}
                  onChange={() => setScheduleMode("scheduled")} className="rounded" />
                예약 발송
              </label>
            </div>
            {scheduleMode === "scheduled" && (
              <input
                type={supportsDatetimeLocal() ? "datetime-local" : "text"}
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                placeholder="2026-05-28 14:00"
                className="w-full px-2 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            )}
          </div>

          {/* 치환변수 패널 */}
          <div className="mt-2">
            <button onClick={() => setShowReplace(v => !v)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showReplace ? "rotate-180" : ""}`} />
              치환변수 & 어필리에이트 링크
            </button>
            {showReplace && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1.5">기본 치환변수 (클릭 시 삽입)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {REPLACEMENTS.map(r => (
                      <button key={r.label} onClick={() => insertAtCursor(r.label)}
                        className="px-2 py-1 bg-white border rounded text-xs text-gray-700 hover:border-blue-400 hover:text-blue-600">
                        {r.label} <span className="text-gray-400">({r.desc})</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1">
                    <Link2 className="w-3 h-3 text-blue-500" />
                    내 어필리에이트 추적링크
                  </p>
                  {myLinks.length > 0 ? (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {myLinks.map(l => (
                          <button key={l.id}
                            onClick={() => insertAtCursor(`${APP_URL}/l/${l.code}`)}
                            className="px-2 py-1 bg-white border rounded text-xs text-blue-600 hover:border-blue-400">
                            🔗 {l.title ?? l.code}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        그룹 내 해당 고객의 링크가 삽입됩니다. 링크 없는 고객은 자동 제외됩니다.
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400">
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
          <button onClick={doDryRun} disabled={!selectedGroup || !message.trim()}
            className="w-full py-2.5 border-2 border-blue-300 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed mb-3">
            발송 대상 미리보기
          </button>

          {selectedGroup && rateLimitStatus && (
            <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-700">
                📊 발송 횟수: {rateLimitStatus.used}/5회
                {rateLimitStatus.remaining === 0 && (
                  <span className="block text-xs text-red-600 font-semibold mt-1">
                    ⏰ 내일 {rateLimitStatus.resetAt}부터 가능
                  </span>
                )}
              </p>
            </div>
          )}

          {dryRunResult && (
            <div className="space-y-3">
              {/* [P0-4] 미치환 변수 경고 */}
              {unreplacedVars.length > 0 && (
                <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-700">
                  <span className="font-semibold">⚠ 치환 안 된 변수:</span>{" "}
                  <strong>{unreplacedVars.join(", ")}</strong>
                  <br />
                  <span>상품 선택 또는 직접 입력 후 발송하세요. 그대로 발송 시 고객에게 변수명이 노출됩니다.</span>
                </div>
              )}
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-600 mb-2">
                  발송 예정:{" "}
                  <span className="text-blue-600 font-bold text-base">{dryRunResult.count}명</span>
                  {linkNoCount > 0 && (
                    <span className="text-amber-500 ml-2 text-xs">
                      (추적링크 없는 고객 {linkNoCount}명 자동 제외)
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500 font-medium mb-1">첫 번째 고객 미리보기:</p>
                <div className="text-sm bg-white border rounded p-2.5 whitespace-pre-wrap break-words">
                  {DOMPurify.sanitize(dryRunResult.sample, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })}
                </div>
              </div>

              {/* 검수 탭 (관리자/대리점장용) */}
              {userRole && canReview(userRole) && (
                <ReviewTab
                  groupId={selectedGroup}
                  message={message}
                  dryRunResult={dryRunResult}
                  onApprove={doSend}
                  onReject={() => {
                    setDryRunResult(null);
                    setConfirmed(false);
                    showError("검수가 거절되었습니다.");
                  }}
                  approving={sending}
                />
              )}

              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded" />
                <span className="text-sm text-gray-700">
                  위 내용을 확인했으며,{" "}
                  <strong className="text-blue-600">{dryRunResult.count}명</strong>에게 SMS를 발송합니다.
                </span>
              </label>

              <button onClick={doSend} disabled={!dryRunResult || !confirmed || sending}
                className={`w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                  !dryRunResult || !confirmed || sending
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}>
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

// ─── 이메일 탭 ───────────────────────────────────────────────────
function EmailTab() {
  const [emailConfig,   setEmailConfig]   = useState<EmailConfig>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [senderName,    setSenderName]    = useState("");
  const [groups,        setGroups]        = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [subject,       setSubject]       = useState("");
  const [body,          setBody]          = useState("");
  const [images,         setImages]         = useState<ImageItem[]>([]);
  const [showImages,     setShowImages]     = useState(false);
  const [imagesLoaded,   setImagesLoaded]   = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [sendMode,       setSendMode]       = useState<"now" | "schedule">("now");
  const [scheduledAt,    setScheduledAt]    = useState("");
  const [sending,        setSending]        = useState(false);
  const [savingName,     setSavingName]     = useState(false);
  const [csrfToken,      setCsrfToken]      = useState("");
  const emailBodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/csrf-token").then(r => r.json())
      .then(d => { if (d.ok && d.token) setCsrfToken(d.token); })
      .catch(() => { /* silently fail */ });
    fetch("/api/settings/email").then(r => r.json())
      .then(d => {
        if (d.ok && d.config) setEmailConfig(d.config);
        if (d.memberSenderName) setSenderName(d.memberSenderName);
      })
      .finally(() => setConfigLoading(false));
    fetch("/api/groups").then(r => r.json()).then(d => { if (d.ok) setGroups(d.groups ?? []); });
  }, []);

  const loadImages = useCallback(() => {
    setShowImages(true);
    if (imagesLoaded && !imageLoadError) return;

    setImageLoadError(false);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8초 타임아웃

    fetch("/api/image-library", { signal: controller.signal })
      .then(r => r.json())
      .then(d => {
        if (d.ok) setImages(d.images ?? []);
        setImagesLoaded(true);
      })
      .catch((err) => {
        setImagesLoaded(true);
        if (!(err instanceof Error && err.name === 'AbortError')) {
          setImageLoadError(true);
        }
      })
      .finally(() => clearTimeout(timeoutId));
  }, [imagesLoaded, imageLoadError]);

  const insertImage = (url: string) => {
    if (!url) return;
    const imgTag = `<img src="${url}" alt="이미지" style="max-width:100%;height:auto;display:block;margin:8px 0;" />`;
    const el = emailBodyRef.current;
    if (!el) {
      setBody(prev => prev + '\n\n' + imgTag);
    } else {
      const start = el.selectionStart ?? body.length;
      const end   = el.selectionEnd   ?? body.length;
      setBody(body.substring(0, start) + '\n\n' + imgTag + body.substring(end));
    }
    setShowImages(false);
  };

  const insertBodyAtCursor = (token: string) => {
    const el = emailBodyRef.current;
    if (!el) { setBody(prev => prev + token); return; }
    const start = el.selectionStart ?? body.length;
    const end   = el.selectionEnd   ?? body.length;
    const next  = body.substring(0, start) + token + body.substring(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + token.length;
      el.focus();
    });
  };

  // useCallback: 발신자 이름 저장 메모이제이션
  const saveSenderName = useCallback(async () => {
    setSavingName(true);

    // AbortController로 fetch 취소 관리
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5초 타임아웃

    try {
      const res = await fetch("/api/settings/email-sender", {
        method: "PATCH",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({ senderName }),
      });
      const d = await res.json() as { ok: boolean };
      if (d.ok) showSuccess("발신자 이름 저장됨");
      else showError("저장 실패");
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        showError("요청 시간 초과 - 다시 시도해주세요");
      } else {
        showError("저장 실패");
      }
    } finally {
      clearTimeout(timeoutId);
      setSavingName(false);
    }
  }, [senderName, csrfToken]);

  // useCallback: 이메일 발송 메모이제이션
  const doSend = useCallback(async () => {
    if (!selectedGroup || !subject.trim() || !body.trim()) {
      showError("그룹, 제목, 내용을 모두 입력하세요"); return;
    }
    if (sendMode === "schedule" && !scheduledAt) {
      showError("예약 발송 시간을 입력하세요"); return;
    }
    setSending(true);

    // AbortController로 fetch 취소 관리
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃

    try {
      const res = await fetch("/api/email/schedule", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({
          groupId: selectedGroup,
          subject,
          content: body,
          sendNow: sendMode === "now",
          scheduledAt: sendMode === "schedule" ? scheduledAt : undefined,
        }),
      });
      const d = await res.json() as { ok: boolean; sentCount?: number };
      if (!d.ok) throw new Error();
      showSuccess(sendMode === "now" ? `${d.sentCount ?? 0}명에게 발송 완료` : "예약 발송 등록됨");
      setSubject(""); setBody(""); setSelectedGroup(""); setSendMode("now"); setScheduledAt("");
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        showError("요청 시간 초과 - 다시 시도해주세요");
      } else {
        showError("이메일 발송 실패");
      }
    } finally {
      clearTimeout(timeoutId);
      setSending(false);
    }
  }, [selectedGroup, subject, body, sendMode, scheduledAt, csrfToken]);

  // useMemo: 이메일 탭의 currentGroup 메모이제이션
  const currentGroup = useMemo(
    () => groups.find(g => g.id === selectedGroup),
    [groups, selectedGroup]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 좌측 설정 패널 */}
      <div className="lg:col-span-1 space-y-4">

        {/* 발신자 이름 설정 */}
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-semibold text-gray-500 mb-3 flex items-center gap-1">
            <User className="w-3.5 h-3.5" /> 발신자 이름 설정
          </p>
          {configLoading ? (
            <div className="h-8 bg-gray-100 rounded animate-pulse" />
          ) : emailConfig ? (
            <div>
              <div className="flex gap-2">
                <input value={senderName} onChange={e => setSenderName(e.target.value)}
                  placeholder="크루즈닷 모니카"
                  className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                <button onClick={saveSenderName} disabled={savingName}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium disabled:opacity-50">
                  {savingName ? "저장중" : "저장"}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                보내는 사람:<br />
                <strong>{senderName || "크루즈닷"}</strong>{" "}
                &lt;{emailConfig.senderEmail}&gt;
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-amber-600 mb-2">이메일 설정이 필요합니다.</p>
              <a href="/settings/email" className="text-xs text-blue-600 underline flex items-center gap-1">
                <Settings className="w-3 h-3" /> 이메일 설정하기
              </a>
            </div>
          )}
        </div>

        {/* 그룹 선택 */}
        <div className="rounded-xl border bg-white p-4">
          <label className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1 block">
            <Users className="w-3.5 h-3.5" /> 수신 그룹
          </label>
          <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">그룹 선택...</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name} ({g._count.members}명)</option>
            ))}
          </select>
          {currentGroup && (
            <p className="text-xs text-gray-400 mt-1">{currentGroup._count.members}명에게 발송됩니다.</p>
          )}
        </div>

        {/* 발송 시간 */}
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">발송 시간</p>
          <div className="flex gap-2 mb-3">
            <button onClick={() => setSendMode("now")}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-medium border transition-all ${sendMode === "now" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600"}`}>
              <Zap className="w-3.5 h-3.5" /> 즉시 발송
            </button>
            <button onClick={() => setSendMode("schedule")}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-medium border transition-all ${sendMode === "schedule" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600"}`}>
              <Clock className="w-3.5 h-3.5" /> 예약 발송
            </button>
          </div>
          {sendMode === "schedule" && (
            supportsDatetimeLocal() ? (
              <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            ) : (
              // Fallback UI for Safari/IE
              <div className="space-y-2">
                <input type="date" value={scheduledAt.split("T")?.[0] ?? ""}
                  onChange={e => {
                    const date = e.target.value;
                    const time = scheduledAt.split("T")?.[1] ?? "00:00";
                    setScheduledAt(date ? `${date}T${time}` : "");
                  }}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="날짜" />
                <input type="time" value={scheduledAt.split("T")?.[1] ?? ""}
                  onChange={e => {
                    const date = scheduledAt.split("T")?.[0] ?? new Date().toISOString().split("T")[0];
                    setScheduledAt(`${date}T${e.target.value}`);
                  }}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="시간" />
              </div>
            )
          )}
        </div>
      </div>

      {/* 우측 작성 영역 */}
      <div className="lg:col-span-2 space-y-4">

        {/* 제목 */}
        <div className="rounded-xl border bg-white p-4">
          <label className="text-xs font-semibold text-gray-500 mb-2 block">이메일 제목</label>
          <input value={subject} onChange={e => setSubject(e.target.value)}
            placeholder="예: 5월 지중해 크루즈 특가 안내"
            className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>

        {/* 본문 */}
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-500">본문 내용</label>
            <button onClick={loadImages}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 border border-blue-200 px-2 py-1 rounded-lg">
              <ImageIcon className="w-3.5 h-3.5" /> 이미지 라이브러리
            </button>
          </div>

          {/* 치환변수 빠른 삽입 */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {REPLACEMENTS.map(r => (
              <button key={r.label} onClick={() => insertBodyAtCursor(r.label)}
                className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600 hover:bg-blue-100 hover:text-blue-600">
                {r.label}
              </button>
            ))}
          </div>

          <textarea ref={emailBodyRef} value={body} onChange={e => setBody(e.target.value)}
            placeholder={"안녕하세요 [이름]님,\n\n크루즈닷에서 특별한 소식을 전합니다."}
            rows={10}
            className="w-full border rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300" />

          {/* 이미지 라이브러리 패널 */}
          {showImages && (
            <div className="mt-3 border rounded-xl p-3 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-600">이미지 선택</p>
                <button onClick={() => setShowImages(false)}>
                  <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                </button>
              </div>
              {!imagesLoaded ? (
                <div className="grid grid-cols-4 gap-2">
                  {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="aspect-square bg-gray-200 rounded-lg animate-pulse" />)}
                </div>
              ) : imageLoadError ? (
                <div className="text-center py-4">
                  <p className="text-xs text-red-500 mb-2">이미지를 불러오지 못했습니다.</p>
                  <button onClick={loadImages}
                    className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    다시 시도
                  </button>
                </div>
              ) : images.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">이미지 라이브러리가 비어있습니다.</p>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                  {images.map(img => (
                    <button key={img.id}
                      onClick={() => insertImage((img.fullUrl ?? img.thumbnailUrl) ?? "")}
                      title={img.title}
                      className="aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-blue-400 bg-gray-200 transition-colors">
                      {img.thumbnailUrl ? (
                        <img src={img.thumbnailUrl} alt={img.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-gray-400" />
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
        <button onClick={doSend}
          disabled={sending || !selectedGroup || !subject.trim() || !body.trim()}
          className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors">
          <Send className="w-4 h-4" />
          {sending ? "발송 중..." : sendMode === "now" ? "이메일 즉시 발송" : "예약 발송 등록"}
        </button>
      </div>
    </div>
  );
}

// ─── 카카오톡 탭 ─────────────────────────────────────────────
function KakaoTab() {
  const [kakaoConfig,    setKakaoConfig]    = useState<{ senderKey: string; isActive: boolean } | null>(null);
  const [configLoading,  setConfigLoading]  = useState(true);
  const [groups,         setGroups]         = useState<Group[]>([]);
  const [selectedGroup,  setSelectedGroup]  = useState("");
  const [title,          setTitle]          = useState("");
  const [message,        setMessage]        = useState("");
  const [showReplace,    setShowReplace]    = useState(false);
  const [myLinks,        setMyLinks]        = useState<ShortLink[]>([]);
  const [dryRunResult,   setDryRunResult]   = useState<{ count: number; sample: string } | null>(null);
  const [confirmed,      setConfirmed]      = useState(false);
  const [sending,        setSending]        = useState(false);
  const [csrfToken,      setCsrfToken]      = useState("");
  const [rateLimitStatus, setRateLimitStatus] = useState<{ used: number; remaining: number; resetAt: string } | null>(null);
  const [userRole,       setUserRole]       = useState<UserRole | null>(null);
  // 스케줄링 기능
  const [scheduleMode,   setScheduleMode]   = useState<"now" | "scheduled">("now");
  const [scheduledTime,  setScheduledTime]  = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // CSRF 토큰 획득
  useEffect(() => {
    fetch("/api/csrf-token").then(r => r.json())
      .then(d => { if (d.ok && d.token) setCsrfToken(d.token); })
      .catch(() => { /* silently fail */ });
  }, []);

  // 사용자 역할 조회
  useEffect(() => {
    fetch("/api/user/role").then(r => r.json())
      .then(d => { if (d.ok && d.role) setUserRole(d.role as UserRole); })
      .catch(() => { /* silently fail */ });
  }, []);

  // 초기 데이터 로드
  useEffect(() => {
    fetch("/api/settings/kakao-config").then(r => r.json())
      .then(d => { if (d.ok) setKakaoConfig(d.config); })
      .finally(() => setConfigLoading(false));
    fetch("/api/groups").then(r => r.json()).then(d => { if (d.ok) setGroups(d.groups ?? []); });
    fetch("/api/links").then(r => r.json())
      .then(d => { if (d.ok) setMyLinks((d.links ?? []).filter((l: ShortLink) => l.contactId)); });
  }, []);

  const insertAtCursor = (token: string) => {
    const el = textareaRef.current;
    if (!el) { setMessage(prev => prev + token); return; }
    const start = el.selectionStart ?? message.length;
    const end   = el.selectionEnd   ?? message.length;
    const next  = message.substring(0, start) + token + message.substring(end);
    setMessage(next);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + token.length;
      el.focus();
    });
  };

  // currentGroup 메모이제이션
  const currentGroup = useMemo(
    () => groups.find(g => g.id === selectedGroup),
    [groups, selectedGroup]
  );

  // Dry-run 콜백
  const doDryRun = useCallback(async () => {
    if (!selectedGroup || !title.trim() || !message.trim()) {
      showError("그룹, 제목, 메시지를 모두 입력하세요");
      return;
    }
    if (scheduleMode === "scheduled" && !scheduledTime) { showError("발송 시간을 선택해주세요"); return; }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(`/api/groups/${selectedGroup}/blast-kakao`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({
          title,
          message,
          dryRun: true,
          ...(scheduleMode === "scheduled" && { scheduledTime })
        }),
      });
      const d = await res.json() as {
        ok: boolean; willSend?: number; sample?: string; rateLimitStatus?: any;
      };
      if (!d.ok) {
        if (d.rateLimitStatus?.remaining === 0) {
          showError("일일 발송 한도를 모두 사용했습니다. 내일 초기화됩니다.");
        } else {
          showError("미리보기 실패");
        }
        setDryRunResult(null);
        setConfirmed(false);
        if (d.rateLimitStatus) {
          const resetDate = new Date(d.rateLimitStatus.resetAt);
          setRateLimitStatus({
            used: d.rateLimitStatus.used,
            remaining: d.rateLimitStatus.remaining,
            resetAt: resetDate.toLocaleTimeString('ko-KR'),
          });
        }
        return;
      }
      const sampleMsg = d.sample ?? `${title}\n${message}`;
      setDryRunResult({ count: d.willSend ?? 0, sample: sampleMsg });
      setConfirmed(false);
      if (d.rateLimitStatus) {
        const resetDate = new Date(d.rateLimitStatus.resetAt);
        setRateLimitStatus({
          used: d.rateLimitStatus.used,
          remaining: d.rateLimitStatus.remaining,
          resetAt: resetDate.toLocaleTimeString('ko-KR'),
        });
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        showError("요청 시간 초과 - 다시 시도해주세요");
      } else {
        showError("미리보기 중 오류 발생");
      }
      setDryRunResult(null);
      setConfirmed(false);
    } finally {
      clearTimeout(timeoutId);
    }
  }, [selectedGroup, title, message, csrfToken, scheduleMode, scheduledTime]);

  // 발송 콜백
  const doSend = useCallback(async () => {
    if (!dryRunResult) {
      showError("먼저 발송 대상을 확인해주세요.");
      return;
    }

    if (!confirmed) {
      showError("발송 확인 체크박스를 선택해주세요.");
      return;
    }

    const willSend = dryRunResult.count || 0;
    const confirmMsg = `정말 ${willSend}명에게 카카오톡을 발송하시겠습니까?\n\n제목: ${title}\n내용: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`;

    if (typeof window === "undefined" || !window.confirm(confirmMsg)) {
      return;
    }

    setSending(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(`/api/groups/${selectedGroup}/blast-kakao`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({
          title,
          message,
          dryRun: false,
          ...(scheduleMode === "scheduled" && { scheduledTime })
        }),
      });
      const d = await res.json() as { ok: boolean; sentCount?: number; failedCount?: number; message?: string };
      if (!d.ok) {
        showError(d.message ?? "발송 실패");
        return;
      }
      showSuccess(`발송 완료: ${d.sentCount ?? 0}명 성공, ${d.failedCount ?? 0}명 실패`);
      setTitle(""); setMessage(""); setDryRunResult(null); setConfirmed(false); setRateLimitStatus(null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        showError("발송 요청 시간 초과 - 다시 시도해주세요");
      } else {
        showError("발송 중 오류가 발생했습니다");
      }
    } finally {
      clearTimeout(timeoutId);
      setSending(false);
    }
  }, [selectedGroup, title, message, csrfToken, dryRunResult, confirmed, scheduleMode, scheduledTime]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 좌측 설정 패널 */}
      <div className="lg:col-span-1 space-y-4">

        {/* 카카오 연결 상태 */}
        <div className={`rounded-xl p-4 border ${kakaoConfig ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
          {configLoading ? (
            <div className="h-5 bg-gray-200 rounded animate-pulse" />
          ) : kakaoConfig ? (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-green-700">카카오톡 연결됨</span>
              </div>
              <p className="text-xs text-green-600">발신키: {kakaoConfig.senderKey.substring(0, 10)}***</p>
              {!kakaoConfig.isActive && (
                <p className="text-xs text-amber-600 mt-1">⚠ 카카오톡 알림톡이 비활성화되어 있습니다.</p>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium text-amber-700">카카오톡 미연결</span>
              </div>
              <p className="text-xs text-amber-600 mb-2">카카오톡 알림톡을 사용하려면 설정이 필요합니다.</p>
              <a href="/settings/kakao" className="text-xs text-blue-600 underline flex items-center gap-1">
                <Settings className="w-3 h-3" /> 카카오톡 설정하기
              </a>
            </div>
          )}
        </div>

        {/* 그룹 선택 */}
        <div className="rounded-xl border bg-white p-4">
          <label className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1 block">
            <Users className="w-3.5 h-3.5" /> 수신 그룹
          </label>
          <select value={selectedGroup}
            onChange={e => { setSelectedGroup(e.target.value); setDryRunResult(null); setRateLimitStatus(null); }}
            className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">그룹 선택...</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name} ({g._count.members}명)</option>
            ))}
          </select>
          {currentGroup && (
            <p className="text-xs text-gray-400 mt-1">최대 {currentGroup._count.members}명에게 발송됩니다.</p>
          )}
        </div>
      </div>

      {/* 우측 작성 영역 */}
      <div className="lg:col-span-2 space-y-4">

        {/* 제목 입력 */}
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-500">제목 (알림톡 헤더)</label>
            <span className={`text-xs ${title.length > 25 ? "text-red-500 font-medium" : "text-gray-400"}`}>
              {title.length}/30자
            </span>
          </div>
          <input
            value={title}
            onChange={e => setTitle(e.target.value.slice(0, 30))}
            placeholder="예: 크루즈닷 예약 확인"
            maxLength={30}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        {/* 메시지 작성 */}
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-500">메시지 내용</label>
            <span className={`text-xs ${message.length > 900 ? "text-red-500 font-medium" : "text-gray-400"}`}>
              {message.length}/1000자
            </span>
          </div>
          <textarea
            ref={textareaRef}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="카카오톡 알림톡 내용을 입력하세요"
            rows={8}
            className="w-full border rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
          />

          {/* 스케줄링 옵션 */}
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-4 mb-3">
              <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                <input type="radio" name="kakao-schedule" value="now" checked={scheduleMode === "now"}
                  onChange={() => setScheduleMode("now")} className="rounded" />
                즉시 발송
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                <input type="radio" name="kakao-schedule" value="scheduled" checked={scheduleMode === "scheduled"}
                  onChange={() => setScheduleMode("scheduled")} className="rounded" />
                예약 발송
              </label>
            </div>
            {scheduleMode === "scheduled" && (
              <input
                type={supportsDatetimeLocal() ? "datetime-local" : "text"}
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                placeholder="2026-05-28 14:00"
                className="w-full px-2 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            )}
          </div>

          {/* 치환변수 패널 */}
          <div className="mt-2">
            <button onClick={() => setShowReplace(v => !v)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showReplace ? "rotate-180" : ""}`} />
              치환변수 & 어필리에이트 링크
            </button>
            {showReplace && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1.5">기본 치환변수 (클릭 시 삽입)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {REPLACEMENTS.map(r => (
                      <button key={r.label} onClick={() => insertAtCursor(r.label)}
                        className="px-2 py-1 bg-white border rounded text-xs text-gray-700 hover:border-blue-400 hover:text-blue-600">
                        {r.label} <span className="text-gray-400">({r.desc})</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1">
                    <Link2 className="w-3 h-3 text-blue-500" />
                    내 어필리에이트 추적링크
                  </p>
                  {myLinks.length > 0 ? (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {myLinks.map(l => (
                          <button key={l.id}
                            onClick={() => insertAtCursor(`${APP_URL}/l/${l.code}`)}
                            className="px-2 py-1 bg-white border rounded text-xs text-blue-600 hover:border-blue-400">
                            🔗 {l.title ?? l.code}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400">
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
          <button onClick={doDryRun} disabled={!selectedGroup || !title.trim() || !message.trim()}
            className="w-full py-2.5 border-2 border-blue-300 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed mb-3">
            발송 대상 미리보기
          </button>

          {selectedGroup && rateLimitStatus && (
            <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-700">
                📊 발송 횟수: {rateLimitStatus.used}/5회
                {rateLimitStatus.remaining === 0 && (
                  <span className="block text-xs text-red-600 font-semibold mt-1">
                    ⏰ 내일 {rateLimitStatus.resetAt}부터 가능
                  </span>
                )}
              </p>
            </div>
          )}

          {dryRunResult && (
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-600 mb-2">
                  발송 예정:{" "}
                  <span className="text-blue-600 font-bold text-base">{dryRunResult.count}명</span>
                </p>
                <p className="text-xs text-gray-500 font-medium mb-1">미리보기:</p>
                <div className="text-sm bg-white border rounded p-2.5">
                  <strong className="block mb-1">{title}</strong>
                  <div className="whitespace-pre-wrap break-words">
                    {DOMPurify.sanitize(dryRunResult.sample, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })}
                  </div>
                </div>
              </div>

              {/* 검수 탭 */}
              {userRole && canReview(userRole) && (
                <ReviewTab
                  groupId={selectedGroup}
                  message={`${title}\n${message}`}
                  dryRunResult={dryRunResult}
                  onApprove={doSend}
                  onReject={() => {
                    setDryRunResult(null);
                    setConfirmed(false);
                    showError("검수가 거절되었습니다.");
                  }}
                  approving={sending}
                />
              )}

              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded" />
                <span className="text-sm text-gray-700">
                  위 내용을 확인했으며,{" "}
                  <strong className="text-blue-600">{dryRunResult.count}명</strong>에게 카카오톡을 발송합니다.
                </span>
              </label>

              <button onClick={doSend} disabled={!dryRunResult || !confirmed || sending}
                className={`w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                  !dryRunResult || !confirmed || sending
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}>
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

