"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  MessageSquare, Mail, Send, ChevronDown, ChevronUp,
  Link2, AlertCircle, CheckCircle, Settings, Users,
  Image as ImageIcon, Clock, Zap, X, User, MessageCircle,
} from "lucide-react";
import { showError, showSuccess } from "@/components/ui/Toast";
// DOMPurify: window 없는 SSR 환경에서 window is not defined 방어
const sanitize = (html: string): string => {
  if (typeof window === "undefined") return html.replace(/<[^>]*>/g, "");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const DP = require("dompurify") as { sanitize: (h: string, o: object) => string };
  return DP.sanitize(html, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
};
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
type Product     = { id: string; name: string; departureDate: string | null; price: number | null; nights: number | null; days: number | null };

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
      <h1 className="text-2xl font-bold mb-1">📨 단체 메시지 보내기</h1>
      <p className="text-base text-gray-600 mb-3">고객 그룹에게 한 번에 문자 또는 이메일을 보냅니다.</p>
      {/* 50대 친화적 사용 순서 안내 */}
      <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5 text-sm text-blue-700 flex-wrap">
        <span className="font-semibold whitespace-nowrap">📋 사용 순서:</span>
        <span>① 수신 그룹 선택</span>
        <span className="text-blue-300">→</span>
        <span>② 메시지 작성</span>
        <span className="text-blue-300">→</span>
        <span>③ 발송 전 확인하기</span>
        <span className="text-blue-300">→</span>
        <span>④ 최종 발송</span>
      </div>

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

      {/* P2-6: 선택된 탭만 렌더링 (나머지는 lazy load) */}
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
  const [hasEmoji,       setHasEmoji]       = useState(false);
  // 상품 드롭다운
  const [products,       setProducts]       = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  // 인라인 그룹 생성
  const [showNewGroup,   setShowNewGroup]   = useState(false);
  const [newGroupName,   setNewGroupName]   = useState("");
  const [creatingGroup,  setCreatingGroup]  = useState(false);
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

  // 상품 목록 로드
  useEffect(() => {
    fetch("/api/products?isActive=true&limit=100").then(r => r.json())
      .then(d => { if (d.ok) setProducts(d.products ?? []); })
      .catch(() => { /* silently fail */ });
  }, []);

  // 메시지에 상품 치환변수가 있는지 감지
  const hasProductVars = useMemo(
    () => /\[상품명\]|\[출발일\]|\[가격\]|\[일정\]/.test(message),
    [message]
  );

  // 상품 선택 시 치환 처리
  const applyProductReplacement = useCallback((productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const schedule = product.nights != null && product.days != null
      ? `${product.nights}박 ${product.days}일`
      : product.nights != null
        ? `${product.nights}박`
        : "";
    const depDate = product.departureDate
      ? new Date(product.departureDate).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
      : "";
    const priceStr = product.price != null
      ? product.price.toLocaleString("ko-KR") + "원"
      : "";
    setMessage(prev =>
      prev
        .replaceAll("[상품명]", product.name)
        .replaceAll("[출발일]", depDate)
        .replaceAll("[가격]", priceStr)
        .replaceAll("[일정]", schedule)
    );
    setSelectedProduct(productId);
  }, [products]);

  const createGroup = useCallback(async () => {
    const name = newGroupName.trim();
    if (!name) return;
    setCreatingGroup(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const d = await res.json() as { ok: boolean; group?: Group; message?: string };
      if (!d.ok || !d.group) {
        showError(d.message ?? "그룹 생성 실패");
        return;
      }
      setGroups(prev => [...prev, d.group!]);
      setSelectedGroup(d.group!.id);
      setNewGroupName("");
      setShowNewGroup(false);
      setDryRunResult(null);
      setRateLimitStatus(null);
      showSuccess(`"${d.group!.name}" 그룹이 생성되었습니다.`);
    } catch (_err) {
      showError("그룹 생성 중 오류가 발생했습니다.");
    } finally {
      setCreatingGroup(false);
    }
  }, [newGroupName]);

  // P2-9: 템플릿 로드 캐싱 (카테고리 변경 시에만 다시 로드)
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

  // 카테고리 변경 시에만 재로드 (toggle은 기존 데이터 유지)
  useEffect(() => {
    if (showTemplates && templates.length === 0) loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateCat, showTemplates]);

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
          showError("확인 실패");
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
        showError("확인 중 오류가 발생했습니다");
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
      showError("먼저 '발송 전 확인하기' 버튼을 눌러주세요.");
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
                <span className="text-sm font-medium text-green-700">문자 서비스 연결됨</span>
              </div>
              <p className="text-sm text-green-600">발신번호: {smsConfig.senderPhone}</p>
              <p className="text-sm text-green-600">계정 ID: {smsConfig.aligoUserId} · 인증키 ****{smsConfig.aligoKeyTail}</p>
              {!smsConfig.senderVerified && (
                <p className="text-sm text-amber-600 mt-1">⚠ 발신번호 미인증 — 설정 메뉴에서 전화 인증이 필요합니다</p>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium text-amber-700">문자 서비스 미연결</span>
              </div>
              <p className="text-sm text-amber-600 mb-2">문자 서비스 계정을 연결해야 SMS를 보낼 수 있습니다.</p>
              <a href="/settings/sms" className="text-sm text-blue-600 underline flex items-center gap-1">
                <Settings className="w-3 h-3" /> 문자 서비스 연결하기
              </a>
            </div>
          )}
        </div>

        {/* 그룹 선택 */}
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-gray-500 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> 수신 그룹
            </label>
            <a href="/groups" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
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
          {groups.length === 0 && !showNewGroup && (
            <p className="text-sm text-gray-600 mt-1.5">
              그룹이 없습니다.{" "}
              <a href="/groups" className="text-blue-500 underline">그룹 관리</a>에서 먼저 만들어 주세요.
            </p>
          )}
          {currentGroup && (
            <p className="text-sm text-gray-600 mt-1">최대 {currentGroup._count.members}명에게 발송됩니다.</p>
          )}

          {/* 인라인 그룹 생성 */}
          {!showNewGroup ? (
            <button
              onClick={() => setShowNewGroup(true)}
              className="mt-2 flex items-center gap-1 text-sm px-2 py-2 text-green-600 hover:text-green-700 font-medium px-1 py-2">
              <span className="text-base leading-none">+</span> 새 그룹 만들기
            </button>
          ) : (
            <div className="mt-2 flex gap-2 items-center">
              <input
                autoFocus
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") createGroup(); if (e.key === "Escape") { setShowNewGroup(false); setNewGroupName(""); } }}
                placeholder="그룹 이름 입력..."
                className="flex-1 border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
              />
              <button
                onClick={createGroup}
                disabled={!newGroupName.trim() || creatingGroup}
                className="px-3 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg disabled:opacity-40">
                {creatingGroup ? "생성 중..." : "생성"}
              </button>
              <button
                onClick={() => { setShowNewGroup(false); setNewGroupName(""); }}
                className="px-3 py-2.5 text-sm text-gray-600 hover:text-gray-600">
                취소
              </button>
            </div>
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
                    className={`px-3 py-2 rounded-full text-sm border ${templateCat === c.value ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600"}`}>
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
                  <p className="text-sm text-gray-600 text-center py-3">
                    {templateCat ? "해당 카테고리에 템플릿이 없습니다" : "템플릿이 없습니다"}
                  </p>
                ) : templates.map(t => (
                  <button key={t.id} onClick={() => { setMessage(t.content); setShowTemplates(false); }}
                    className="w-full text-left p-2.5 rounded-lg border hover:border-blue-300 hover:bg-blue-50 transition-colors">
                    <p className="text-sm font-medium text-gray-700">{t.title}</p>
                    <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{t.content}</p>
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
            <label className="text-sm font-semibold text-gray-500">메시지 내용</label>
            {(() => {
              const byteLen = new TextEncoder().encode(message).length;
              let byteColor = "text-green-600";
              let byteLabel = "단문";
              if (byteLen > 2000) { byteColor = "text-red-500 font-bold"; byteLabel = "발송불가"; }
              else if (byteLen > 90) { byteColor = "text-orange-500 font-medium"; byteLabel = "장문 메시지 (+추가요금)"; }
              return (
                <span className={`text-sm ${byteColor}`}>
                  {byteLen}바이트 · {byteLabel}
                </span>
              );
            })()}
          </div>
          <textarea
            ref={textareaRef}
            value={message}
            onChange={e => {
              const val = e.target.value;
              setMessage(val);
              setHasEmoji(/\p{Emoji_Presentation}/u.test(val));
            }}
            placeholder="내용을 입력하거나 왼쪽에서 템플릿을 선택하세요"
            rows={6}
            className="w-full border rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          {hasEmoji && (
            <p className="mt-1.5 text-sm text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              ⚠ 이모지(그림문자)는 문자 발송 시 거절될 수 있습니다
            </p>
          )}
          {(() => {
            const byteLen = new TextEncoder().encode(message).length;
            if (byteLen > 2000) return (
              <p className="mt-1 text-sm text-red-500 font-medium">
                메시지가 너무 깁니다 ({byteLen}바이트). 2000바이트 이하로 줄여주세요.
              </p>
            );
            if (byteLen > 90) return (
              <p className="mt-1 text-sm text-orange-500">
                장문 메시지로 발송됩니다 ({byteLen}/2000바이트). 추가 요금이 발생합니다.
              </p>
            );
            return null;
          })()}

          {/* 스케줄링 옵션 */}
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-4 mb-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input type="radio" name="sms-schedule" value="now" checked={scheduleMode === "now"}
                  onChange={() => setScheduleMode("now")} className="rounded" />
                즉시 발송
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
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
                className="w-full px-2 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            )}
          </div>

          {/* 치환변수 패널 */}
          <div className="mt-2">
            <button onClick={() => setShowReplace(v => !v)}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showReplace ? "rotate-180" : ""}`} />
              자동채우기 & 개인링크
            </button>
            {showReplace && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1.5">자동채우기 항목 (클릭하면 메시지에 추가됩니다)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {REPLACEMENTS.map(r => (
                      <button key={r.label} onClick={() => insertAtCursor(r.label)}
                        className="px-2.5 py-2 bg-white border rounded text-sm text-gray-700 hover:border-blue-400 hover:text-blue-600">
                        {r.label} <span className="text-gray-600">({r.desc})</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1.5 flex items-center gap-1">
                    <Link2 className="w-3 h-3 text-blue-500" />
                    내 개인 홍보링크
                  </p>
                  {myLinks.length > 0 ? (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {myLinks.map(l => (
                          <button key={l.id}
                            onClick={() => insertAtCursor(`${APP_URL}/l/${l.code}`)}
                            className="px-2.5 py-2 bg-white border rounded text-sm text-blue-600 hover:border-blue-400">
                            🔗 {l.title ?? l.code}
                          </button>
                        ))}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        그룹 내 해당 고객의 링크가 삽입됩니다. 링크 없는 고객은 자동 제외됩니다.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-600">
                      개인 홍보링크가 없습니다.{" "}
                      <a href="/links" className="text-blue-500 underline">상담 링크</a>에서
                      고객에게 연결된 링크를 만들어주세요.
                    </p>
                  )}
                </div>

                {/* 상품 드롭다운 — 메시지에 상품 치환변수가 있을 때만 표시 */}
                {hasProductVars && products.length > 0 && (
                  <div className="pt-2 border-t border-gray-200">
                    <p className="text-sm font-medium text-gray-600 mb-1.5">상품 선택 (자동으로 내용을 채웁니다)</p>
                    <select
                      value={selectedProduct}
                      onChange={e => applyProductReplacement(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    >
                      <option value="">상품을 선택하면 [상품명]/[출발일]/[가격]/[일정]이 자동으로 입력됩니다</option>
                      {products.map(p => {
                        const depStr = p.departureDate
                          ? new Date(p.departureDate).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })
                          : "";
                        const priceStr = p.price != null ? (p.price / 10000).toFixed(0) + "만원" : "";
                        return (
                          <option key={p.id} value={p.id}>
                            {p.name}{depStr ? ` · ${depStr}` : ""}{priceStr ? ` · ${priceStr}` : ""}
                          </option>
                        );
                      })}
                    </select>
                    {selectedProduct && (
                      <p className="text-sm text-green-600 mt-1">내용이 입력되었습니다. 메시지를 확인해주세요.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 미리보기 & 발송 */}
        <div className="rounded-xl border bg-white p-4">
          <button onClick={doDryRun} disabled={!selectedGroup || !message.trim()}
            className="w-full py-2.5 border-2 border-blue-300 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed mb-3">
            발송 전 확인하기
          </button>

          {selectedGroup && rateLimitStatus && (
            <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-700">
                📊 오늘 발송 횟수: {rateLimitStatus.used}/5회
                {rateLimitStatus.remaining === 0 && (
                  <span className="block text-sm text-red-600 font-semibold mt-1">
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
                <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-700">
                  <span className="font-semibold">⚠ 아직 입력 안 된 항목:</span>{" "}
                  <strong>{unreplacedVars.join(", ")}</strong>
                  <br />
                  <span>상품 선택 또는 직접 입력 후 발송하세요. 그대로 발송하면 고객에게 괄호 문자가 그대로 보입니다.</span>
                </div>
              )}
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600 mb-2">
                  발송 예정:{" "}
                  <span className="text-blue-600 font-bold text-base">{dryRunResult.count}명</span>
                  {linkNoCount > 0 && (
                    <span className="text-amber-500 ml-2 text-sm">
                      (홍보링크 없는 고객 {linkNoCount}명 자동 제외)
                    </span>
                  )}
                </p>
                <p className="text-sm text-gray-500 font-medium mb-1">첫 번째 고객 미리보기:</p>
                <div className="text-sm bg-white border rounded p-2.5 whitespace-pre-wrap break-words">
                  {sanitize(dryRunResult.sample)}
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
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string | number>>(new Set());
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
    // P1-11: URL 검증 — http(s):// 로 시작하지 않으면 early return
    if (!url.startsWith('https://') && !url.startsWith('http://')) return;
    const imgTag = `<img src="${url}" alt="이미지" style="max-width:100%;height:auto;display:block;margin:8px 0;" />`;
    // P1-12: 스테일 클로저 수정 — ref로 커서 위치를 미리 캡처 후 functional updater 사용
    const cursorPos = emailBodyRef.current?.selectionStart ?? undefined;
    const insertPos = (typeof cursorPos === 'number') ? cursorPos : undefined;
    setBody(prev => {
      const pos = insertPos ?? prev.length;
      return prev.substring(0, pos) + '\n\n' + imgTag + prev.substring(pos);
    });
    setShowImages(false);
  };

  // 복수 이미지 일괄 삽입
  const insertMultipleImages = useCallback(() => {
    if (selectedImageIds.size === 0) {
      showError("이미지를 선택해주세요");
      return;
    }
    const selectedImages = images.filter(img => selectedImageIds.has(img.id));
    const cursorPos = emailBodyRef.current?.selectionStart ?? undefined;
    const insertPos = (typeof cursorPos === 'number') ? cursorPos : undefined;

    setBody(prev => {
      const pos = insertPos ?? prev.length;
      const imgTags = selectedImages
        .map(img => {
          const url = img.fullUrl ?? img.thumbnailUrl ?? "";
          return `<img src="${url}" alt="${img.title}" style="max-width:100%;height:auto;display:block;margin:8px 0;" />`;
        })
        .join('\n\n');

      return prev.substring(0, pos) + '\n\n' + imgTags + prev.substring(pos);
    });

    setSelectedImageIds(new Set());
    setShowImages(false);
    showSuccess(`${selectedImages.length}개 이미지가 삽입되었습니다`);
  }, [selectedImageIds, images]);

  const toggleImageSelection = (id: string | number) => {
    const newSelected = new Set(selectedImageIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedImageIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedImageIds.size === images.length) {
      setSelectedImageIds(new Set());
    } else {
      setSelectedImageIds(new Set(images.map(img => img.id)));
    }
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
          <p className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-1">
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
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
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
              <p className="text-sm text-amber-600 mb-2">이메일 설정이 필요합니다.</p>
              <a href="/settings/email" className="text-sm text-blue-600 underline flex items-center gap-1">
                <Settings className="w-3 h-3" /> 이메일 설정하기
              </a>
            </div>
          )}
        </div>

        {/* 그룹 선택 */}
        <div className="rounded-xl border bg-white p-4">
          <label className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-1 block">
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
            <p className="text-sm text-gray-600 mt-1">{currentGroup._count.members}명에게 발송됩니다.</p>
          )}
        </div>

        {/* 발송 시간 */}
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm font-semibold text-gray-500 mb-3">발송 시간</p>
          <div className="flex gap-2 mb-3">
            <button onClick={() => setSendMode("now")}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm font-medium border transition-all ${sendMode === "now" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600"}`}>
              <Zap className="w-3.5 h-3.5" /> 즉시 발송
            </button>
            <button onClick={() => setSendMode("schedule")}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm font-medium border transition-all ${sendMode === "schedule" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600"}`}>
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
          <label className="text-sm font-semibold text-gray-500 mb-2 block">이메일 제목</label>
          <input value={subject} onChange={e => setSubject(e.target.value)}
            placeholder="예: 5월 지중해 크루즈 특가 안내"
            className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>

        {/* 본문 */}
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-gray-500">본문 내용</label>
            <button onClick={loadImages}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 border border-blue-200 px-3 py-2 rounded-lg">
              <ImageIcon className="w-3.5 h-3.5" /> 이미지 라이브러리
            </button>
          </div>

          {/* 치환변수 빠른 삽입 */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {REPLACEMENTS.map(r => (
              <button key={r.label} onClick={() => insertBodyAtCursor(r.label)}
                className="px-2.5 py-2 bg-gray-100 rounded text-sm text-gray-600 hover:bg-blue-100 hover:text-blue-600">
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
            <div className="mt-3 border rounded-xl p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-700">📷 이미지 라이브러리</p>
                  {images.length > 0 && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                      {selectedImageIds.size}/{images.length} 선택됨
                    </span>
                  )}
                </div>
                <button onClick={() => { setShowImages(false); setSelectedImageIds(new Set()); }}
                  className="p-1 hover:bg-gray-200 rounded transition-colors">
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              {!imagesLoaded ? (
                <div className="grid grid-cols-4 gap-2">
                  {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="aspect-square bg-gray-200 rounded-lg animate-pulse" />)}
                </div>
              ) : imageLoadError ? (
                <div className="text-center py-4">
                  <p className="text-sm text-red-500 mb-2">이미지를 불러오지 못했습니다.</p>
                  <button onClick={loadImages}
                    className="px-3 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                    다시 시도
                  </button>
                </div>
              ) : images.length === 0 ? (
                <p className="text-sm text-gray-600 text-center py-4">이미지 라이브러리가 비어있습니다.</p>
              ) : (
                <>
                  {/* 선택 도구 */}
                  <div className="flex gap-2 mb-3">
                    <button onClick={toggleSelectAll}
                      className="px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-100 font-medium transition-colors">
                      {selectedImageIds.size === images.length ? "전체 해제" : "전체 선택"}
                    </button>
                    {selectedImageIds.size > 0 && (
                      <button onClick={() => setSelectedImageIds(new Set())}
                        className="px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-100 font-medium transition-colors">
                        선택 해제
                      </button>
                    )}
                  </div>

                  {/* 이미지 그리드 */}
                  <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto mb-3 p-1">
                    {images.map(img => (
                      <div key={img.id} className="relative group">
                        <button
                          onClick={() => toggleImageSelection(img.id)}
                          title={img.title}
                          className={`w-full aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                            selectedImageIds.has(img.id)
                              ? "border-blue-500 ring-2 ring-blue-300 ring-offset-1"
                              : "border-gray-300 hover:border-blue-400"
                          } bg-gray-200`}>
                          {img.thumbnailUrl ? (
                            <img src={img.thumbnailUrl} alt={img.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                        </button>
                        {/* 체크박스 표시 */}
                        {selectedImageIds.has(img.id) && (
                          <div className="absolute top-1 right-1 bg-blue-500 rounded-full p-0.5">
                            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* 액션 버튼 */}
                  {selectedImageIds.size > 0 && (
                    <div className="flex gap-2">
                      <button onClick={insertMultipleImages}
                        className="flex-1 px-3 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
                        ✓ 선택한 이미지 {selectedImageIds.size}개 삽입
                      </button>
                      <button onClick={() => setSelectedImageIds(new Set())}
                        className="px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                        취소
                      </button>
                    </div>
                  )}
                </>
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


// ─── 카카오톡 탭 ───────────────────────────────────────────
function KakaoTab() {
  const [phone, setPhone] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleSend() {
    if (!phone.trim() || !content.trim()) {
      setResult({ ok: false, message: '전화번호와 내용을 입력하세요' });
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const res = await fetch('/api/messages/send-kakao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, content }),
      });
      const data = await res.json() as { ok: boolean; message: string };
      setResult(data);
      if (data.ok) { setPhone(''); setContent(''); }
    } catch {
      setResult({ ok: false, message: '발송 실패' });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-4 py-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">💬</span>
        <h2 className="text-lg font-bold text-gray-800">카카오톡 알림톡 발송</h2>
      </div>
      <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
        알림톡 발송을 위해 알리고 카카오 채널 연동이 필요합니다. (ALIGO_KAKAO_SENDER_KEY 환경변수)
      </p>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
        <input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="010-0000-0000"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">메시지 내용</label>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={5}
          placeholder="발송할 메시지를 입력하세요"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
        />
        <p className="text-xs text-gray-400 mt-1 text-right">{content.length}자</p>
      </div>
      {result && (
        <div className={`text-sm px-3 py-2 rounded-lg ${result.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {result.message}
        </div>
      )}
      <div className="flex gap-3 items-center">
        <button
          onClick={handleSend}
          disabled={sending}
          className="px-5 py-2 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-black font-semibold rounded-xl text-sm transition-colors"
        >
          {sending ? '발송 중...' : '알림톡 발송'}
        </button>
        <a href="https://open.kakao.com/o/plREDDUh" target="_blank" rel="noopener noreferrer"
          className="text-sm text-gray-500 hover:text-gray-700 underline">
          오픈채팅방 바로가기
        </a>
      </div>
    </div>
  );
}


