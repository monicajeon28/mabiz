'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, CheckCircle, RefreshCw, Search, Send,
  UserCheck, Copy, Check, X, Phone, PhoneOff, FileText,
  ChevronDown, ChevronUp, ArrowRight, Info,
} from 'lucide-react';
import { showError, showSuccess } from '@/components/ui/Toast';
import { fillTemplate } from '@/lib/passport-utils';

// ─── 타입 (API 응답에 맞게 정확히 정의) ────────────────────────────

interface SubmissionGuestItem {
  id: number;
  groupNumber: number;
  name: string;
  nationality: string | null;
  passportNumber: string | null;
  dateOfBirth: string | null;
  passportExpiryDate: string | null;
}

interface PassportCustomer {
  id: number;
  name: string | null;
  phone: string | null;
  hasPhone: boolean;
  email: string | null;
  role: string;
  customerStatus: string | null;
  createdAt: string;
  tripCount: number;
  latestTrip: {
    id: number;
    reservationId: number | null;
    cruiseName: string | null;
    productCode: string | null;
    shipName: string;
    departureDate: string | null;  // API가 departureDate로 반환
  } | null;
  submission: {
    id: number;
    tripId: number | null;
    tokenExpiresAt: string | null;
    isSubmitted: boolean;
    submittedAt: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  lastRequest: {
    id: number;
    status: string;
    messageChannel: string;
    sentAt: string | null;
    admin: { id: number; name: string | null } | null;
  } | null;
  submissionStatus: 'submitted' | 'pending' | 'not_requested';
}

interface Template {
  id: number; title: string; body: string;
  variables: Record<string, unknown> | null; isDefault: boolean; updatedAt: string;
}

interface SendResultItem {
  userId: number;
  success: boolean;
  link?: string;
  submissionId?: number;
  message?: string;
  error?: string;
  messageId?: string | null;
  noPhone?: boolean;
}

type StatusFilter = 'all' | 'submitted' | 'pending' | 'not_requested';
type SendTarget = 'passport' | 'pnr';

// ─── 유틸 ─────────────────────────────────────────────────────────

function calcDday(departureDate: string | null): { label: string; urgent: boolean } | null {
  if (!departureDate) return null;
  // 날짜만 비교 (시간 성분 제거) — KST 기준으로 통일
  const depDate = new Date(departureDate.split('T')[0] + 'T00:00:00+09:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((depDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return null;
  if (diff === 0) return { label: 'D-day', urgent: true };
  return { label: `D-${diff}`, urgent: diff <= 7 };
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <button
      onClick={() =>
        navigator.clipboard.writeText(text)
          .then(() => {
            setCopied(true);
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => setCopied(false), 2000);
          })
          .catch(() => showError('클립보드에 복사하지 못했습니다.'))
      }
      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-600 transition-colors shrink-0"
    >
      {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
      {label ?? (copied ? '복사됨' : '복사')}
    </button>
  );
}

// ─── 발송 확인 모달 (50대 안전장치) ─────────────────────────────────

function ConfirmSendModal({
  selectedCount,
  withPhoneCount,
  withoutPhoneCount,
  onConfirm,
  onCancel,
  sending,
}: {
  selectedCount: number;
  withPhoneCount: number;
  withoutPhoneCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  sending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={sending ? undefined : onCancel} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <Send className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">여권 요청 발송 확인</h2>
            <p className="text-sm text-gray-500 mt-0.5">발송 후에는 취소할 수 없습니다</p>
          </div>
        </div>

        <div className="bg-blue-50 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">선택한 고객</span>
            <span className="font-bold text-gray-900">{selectedCount}명</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-green-500" />문자(SMS) 발송</span>
            <span className="font-bold text-green-700">{withPhoneCount}명</span>
          </div>
          {withoutPhoneCount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 flex items-center gap-1"><PhoneOff className="w-3.5 h-3.5 text-amber-500" />링크만 생성 (직접 전달)</span>
              <span className="font-bold text-amber-700">{withoutPhoneCount}명</span>
            </div>
          )}
          <div className="flex justify-between text-sm border-t border-blue-100 pt-2">
            <span className="text-gray-600">예상 비용 (SMS)</span>
            <span className="font-bold text-gray-900">약 {(withPhoneCount * 20).toLocaleString()}원</span>
          </div>
        </div>

        {withoutPhoneCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
            📌 전화번호 없는 {withoutPhoneCount}명은 문자를 보내지 못합니다.<br />
            발송 후 결과 화면에서 링크를 복사해 카카오톡으로 직접 전달하세요.
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onCancel} disabled={sending}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            취소
          </button>
          <button onClick={onConfirm} disabled={sending}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
            {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? '발송 중...' : '발송 시작'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────

export default function PassportPage() {
  const [customers, setCustomers] = useState<PassportCustomer[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [productCodes, setProductCodes] = useState<{ code: string; cruiseName: string | null; customerCount: number }[]>([]);
  const [aligoBalance, setAligoBalance] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [productFilter, setProductFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [sendTarget, setSendTarget] = useState<SendTarget>('passport');
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [expiresInHours, setExpiresInHours] = useState(72);

  const [result, setResult] = useState<{
    ok: Array<{ userId: number; name: string | null; link: string; message: string; smsSent: boolean }>;
    noPhone: Array<{ userId: number; name: string | null; link: string; message: string }>;
    failed: Array<{ userId: number; name: string | null; error: string }>;
    expiresInHours: number;
  } | null>(null);

  const [refreshTick, setRefreshTick] = useState(0);
  // 페이지네이션: "더 보기" 방식
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const searchRef = useRef(search);

  // ── 데이터 로드 ─────────────────────────────────────────────────

  // in-flight 요청 취소용 ref (race condition 방지)
  const fetchAbortRef = useRef<AbortController | null>(null);

  const loadCustomers = useCallback(async (page = 1, append = false) => {
    if (!append) {
      fetchAbortRef.current?.abort();
      fetchAbortRef.current = new AbortController();
    }
    const signal = !append ? fetchAbortRef.current?.signal : undefined;

    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const p = new URLSearchParams();
      if (searchRef.current.trim()) p.set('search', searchRef.current.trim());
      if (statusFilter !== 'all') p.set('status', statusFilter);
      if (productFilter !== 'all') p.set('productCode', productFilter);
      p.set('page', String(page));
      p.set('limit', '100');
      const res = await fetch(`/api/passport/admin/customers?${p}`, { credentials: 'include', signal });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          showError('세션이 만료됐습니다. 다시 로그인해 주세요.');
        } else {
          showError(`고객 목록 로드 실패 (${res.status})`);
        }
        if (!append) setCustomers([]);
        return;
      }
      const data = await res.json();
      if (data.ok && Array.isArray(data.data)) {
        const newItems: PassportCustomer[] = data.data;
        const meta: { page: number; limit: number; count: number; total: number } = data.meta ?? {};
        const loadedSoFar = (page - 1) * (meta.limit ?? 100) + newItems.length;
        setHasNextPage(loadedSoFar < (meta.total ?? 0));
        setCurrentPage(page);

        if (append) {
          setCustomers(prev => {
            const existing = new Set(prev.map(c => c.id));
            const deduped = newItems.filter(c => !existing.has(c.id));
            return [...prev, ...deduped];
          });
        } else {
          setCustomers(newItems);
          setSelectedIds(prev => {
            const ids = new Set(newItems.map(c => c.id));
            return new Set([...prev].filter(id => ids.has(id)));
          });
        }
      } else {
        showError(data.message ?? '고객 목록을 불러오지 못했습니다.');
        if (!append) setCustomers([]);
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') showError('고객 목록을 불러오지 못했습니다.');
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, [statusFilter, productFilter]);

  const loadTemplates = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/passport/admin/templates', { credentials: 'include', signal });
      if (!res.ok) return;
      const data = await res.json();
      if (data.ok && Array.isArray(data.templates)) {
        setTemplates(data.templates);
        const def = data.templates.find((t: Template) => t.isDefault) ?? data.templates[0];
        if (def) setTemplateId(def.id);
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError')
        showError('메시지 템플릿을 불러오지 못했습니다. 기본 템플릿으로 발송됩니다.');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const ac1 = new AbortController();
    const ac2 = new AbortController();
    const ac3 = new AbortController();
    loadTemplates(ac3.signal);
    fetch('/api/passport/admin/aligo-status', { credentials: 'include', signal: ac1.signal })
      .then(r => r.json())
      .then(d => { if (!cancelled && d.ok) setAligoBalance(d.balance); })
      .catch(() => {});
    fetch('/api/passport/admin/product-codes', { credentials: 'include', signal: ac2.signal })
      .then(r => r.json())
      .then(d => { if (!cancelled && d.ok) setProductCodes(d.productCodes ?? []); })
      .catch(() => {});
    return () => { cancelled = true; ac1.abort(); ac2.abort(); ac3.abort(); };
  }, [loadTemplates]);

  useEffect(() => {
    // 필터·새로고침 변경 시 재조회
    const t = setTimeout(() => loadCustomers(1, false), 350);
    return () => clearTimeout(t);
  }, [loadCustomers, refreshTick]);

  // 검색어 변경 시 디바운스 재조회 (search → loadCustomers 의존성 분리 패턴)
  useEffect(() => {
    const t = setTimeout(() => {
      setRefreshTick(prev => prev + 1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  // 필터 변경 시 이전 선택 + 페이지 클리어
  useEffect(() => {
    setSelectedIds(new Set());
    setHasNextPage(false);
    setCurrentPage(1);
  }, [statusFilter, productFilter]);

  // ── 파생값 ──────────────────────────────────────────────────────

  const stats = useMemo(() => {
    let submitted = 0, pending = 0, notRequested = 0;
    customers.forEach(c => {
      if (c.submissionStatus === 'submitted') submitted++;
      else if (c.submissionStatus === 'pending') pending++;
      else notRequested++;
    });
    return { submitted, pending, notRequested, total: customers.length };
  }, [customers]);

  const selectedCustomers = useMemo(
    () => customers.filter(c => selectedIds.has(c.id)),
    [customers, selectedIds],
  );
  // 미제출 고객만 선택 가능 (submitted 제외)
  const selectableCustomers = useMemo(
    () => customers.filter(c => c.submissionStatus !== 'submitted'),
    [customers],
  );
  // 전화번호 유무는 API hasPhone 필드 기준 (마스킹된 phone 문자열이 아님)
  const withPhone = useMemo(() => selectedCustomers.filter(c => c.hasPhone), [selectedCustomers]);
  const withoutPhone = useMemo(() => selectedCustomers.filter(c => !c.hasPhone), [selectedCustomers]);

  const selectedTemplate = useMemo(
    () => templates.find(t => t.id === templateId) ?? templates.find(t => t.isDefault) ?? templates[0] ?? null,
    [templates, templateId],
  );

  // 발송 버튼 문구 (withPhone/withoutPhone이 파생값이므로 selectedIds.size 의존성 제거)
  const sendBtnLabel = useMemo(() => {
    const total = withPhone.length + withoutPhone.length;
    if (total === 0) return '고객을 먼저 선택하세요';
    if (withPhone.length === 0) return `여권 링크 생성 (${total}명) — 직접 전달 필요`;
    if (withoutPhone.length === 0) return `여권 요청 문자 발송 (${total}명)`;
    return `여권 요청 발송 — 문자 ${withPhone.length}명 · 링크만 ${withoutPhone.length}명`;
  }, [withPhone.length, withoutPhone.length]);

  // 출발 7일 이내 미제출 긴급 고객 수
  const urgentCount = useMemo(() =>
    customers.filter(c => {
      if (c.submissionStatus === 'submitted') return false;
      const d = calcDday(c.latestTrip?.departureDate ?? null);
      return d !== null && d.urgent;
    }).length,
  [customers]);

  // ── 선택 ────────────────────────────────────────────────────────

  const toggle = (id: number) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  // submitted 고객 제외, 미제출 고객만 전체 선택 (prev 사용으로 stale closure 방지)
  const toggleAll = () => setSelectedIds((prev) => {
    const allSelected = selectableCustomers.length > 0 &&
      selectableCustomers.every(c => prev.has(c.id));
    return allSelected ? new Set() : new Set(selectableCustomers.map(c => c.id));
  });

  // ── 발송 ────────────────────────────────────────────────────────

  const doSend = async () => {
    setShowConfirm(false);
    setSending(true);
    setResult(null);
    try {
      const res = await fetch('/api/passport/admin/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userIds: [...selectedIds],
          templateId: templateId ?? undefined,
          channel: 'SMS',
          expiresInHours,
          sendTarget,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || '발송 실패');

      const items: (SendResultItem & { noPhone?: boolean })[] = data.results ?? [];

      const ok: NonNullable<typeof result>['ok'] = [];
      const noPhone: NonNullable<typeof result>['noPhone'] = [];
      const failed: NonNullable<typeof result>['failed'] = [];

      // O(n²) find → O(1) Map 조회
      const customersMap = new Map(customers.map(c => [c.id, c]));

      for (const item of items) {
        const c = customersMap.get(item.userId);
        const name = c?.name ?? null;

        if (item.link && item.noPhone) {
          // 명시적 플래그: 전화번호 없음 → 링크만 생성됨
          noPhone.push({ userId: item.userId, name, link: item.link, message: item.message ?? '' });
        } else if (item.link && item.success) {
          ok.push({ userId: item.userId, name, link: item.link, message: item.message ?? '', smsSent: true });
        } else if (item.link && !item.success) {
          // SMS 실패했지만 링크는 있음
          ok.push({ userId: item.userId, name, link: item.link, message: item.message ?? '', smsSent: false });
        } else {
          failed.push({ userId: item.userId, name, error: item.error ?? '알 수 없는 오류' });
        }
      }

      setResult({ ok, noPhone, failed, expiresInHours });
      setSelectedIds(new Set()); // 발송 완료 후 선택 초기화 (재발송 방지)
      setRefreshTick(t => t + 1);

      // 발송 후 잔액 UI 갱신
      if (typeof data.remainingCash === 'number') {
        setAligoBalance(data.remainingCash);
      }
      if (data.lowBalance) {
        const cashStr = typeof data.remainingCash === 'number' ? data.remainingCash.toLocaleString() : '알 수 없음';
        showError(`⚠ 문자 잔액이 ${cashStr}원으로 부족합니다. 충전이 필요합니다.`);
      }

      // 찾지 못한 고객 안내
      const missing = (data.missingUserIds ?? []) as number[];
      if (missing.length > 0) {
        showError(`${missing.length}명의 고객 정보를 찾지 못해 발송되지 않았습니다.`);
      }

      const smsSent = ok.filter(x => x.smsSent).length;
      const linkOnly = noPhone.length + ok.filter(x => !x.smsSent).length;
      if (failed.length === 0) {
        showSuccess(`완료: 문자 ${smsSent}명 발송, 링크만 생성 ${linkOnly}명`);
      } else {
        showSuccess(`완료: ${smsSent}명 문자, ${linkOnly}명 링크 생성 (${failed.length}명 실패)`);
      }
    } catch (e) {
      showError(e instanceof Error ? e.message : '발송 중 오류가 발생했습니다.');
    } finally {
      setSending(false);
    }
  };

  // ── 렌더 ────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">여권 요청 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">고객에게 여권 제출 링크를 문자로 보냅니다</p>
        </div>
        <div className="flex items-center gap-2">
          {aligoBalance !== null && (
            <span className={`text-sm px-3 py-1.5 rounded-full font-medium ${
              aligoBalance <= 5000 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
            }`}>
              문자 잔액: {aligoBalance.toLocaleString()}원{aligoBalance <= 5000 ? ' ⚠ 충전 필요' : ''}
            </span>
          )}
          <button
            onClick={() => setRefreshTick(t => t + 1)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>
      </div>

      {/* 긴급 처리 배너 */}
      {urgentCount > 0 && (statusFilter === 'all' || statusFilter === 'pending') && (
        <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-red-800">🚨 출발 7일 이내 미제출 {urgentCount}명</p>
            <p className="text-sm text-red-600">지금 바로 연락해야 합니다 — 여권 미제출 시 탑승 불가</p>
          </div>
          <button
            onClick={() => setStatusFilter('pending')}
            className="px-3 py-1.5 bg-red-600 text-white text-sm font-semibold rounded-lg shrink-0 hover:bg-red-700"
          >
            바로 보기
          </button>
        </div>
      )}

      {/* 3단계 안내 (50대 기준) */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <div className="flex items-center gap-1 text-sm text-blue-600 font-medium mb-2">
          <Info className="w-3.5 h-3.5" /> 사용 방법
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center shrink-0">1</span>
            <span className="text-sm text-blue-800">왼쪽 목록에서 고객 체크박스 선택</span>
          </div>
          <ArrowRight className="w-4 h-4 text-blue-300 shrink-0 hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center shrink-0">2</span>
            <span className="text-sm text-blue-800">오른쪽에서 발송 방식 선택</span>
          </div>
          <ArrowRight className="w-4 h-4 text-blue-300 shrink-0 hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center shrink-0">3</span>
            <span className="text-sm text-blue-800">발송 버튼 클릭</span>
          </div>
        </div>
      </div>

      {/* 통계 — Tailwind 클래스 하드코딩 (동적 클래스는 Vercel 빌드에서 사라짐) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={() => setStatusFilter(f => f === 'submitted' ? 'all' : 'submitted')}
          className={`bg-green-50 border-2 rounded-xl p-3 text-left transition-all ${
            statusFilter === 'submitted' ? 'border-green-500 shadow-md' : 'border-green-200 hover:border-green-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">제출 완료</p>
              <p className="text-2xl font-bold text-green-900 mt-0.5">{stats.submitted}</p>
            </div>
            <CheckCircle className="w-7 h-7 text-green-400" />
          </div>
        </button>
        <button
          onClick={() => setStatusFilter(f => f === 'pending' ? 'all' : 'pending')}
          className={`bg-amber-50 border-2 rounded-xl p-3 text-left transition-all ${
            statusFilter === 'pending' ? 'border-amber-500 shadow-md' : 'border-amber-200 hover:border-amber-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-600">요청 전송됨 (미제출)</p>
              <p className="text-2xl font-bold text-amber-900 mt-0.5">{stats.pending}</p>
            </div>
            <AlertCircle className="w-7 h-7 text-amber-400" />
          </div>
        </button>
        <button
          onClick={() => setStatusFilter(f => f === 'not_requested' ? 'all' : 'not_requested')}
          className={`bg-gray-50 border-2 rounded-xl p-3 text-left transition-all ${
            statusFilter === 'not_requested' ? 'border-gray-500 shadow-md' : 'border-gray-200 hover:border-gray-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">아직 요청 안 함</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{stats.notRequested}</p>
            </div>
            <FileText className="w-7 h-7 text-gray-600" />
          </div>
        </button>
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">전체 고객</p>
              <p className="text-2xl font-bold text-blue-900 mt-0.5">{stats.total}</p>
            </div>
            <UserCheck className="w-7 h-7 text-blue-400" />
          </div>
        </div>
      </div>
      {statusFilter !== 'all' && (
        <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <span>필터 적용 중: <strong>{{submitted:'제출 완료',pending:'요청 전송됨',not_requested:'아직 요청 안 함'}[statusFilter]}</strong></span>
          <button onClick={() => setStatusFilter('all')} className="ml-auto flex items-center gap-1 hover:text-blue-900">
            <X className="w-3.5 h-3.5" /> 필터 해제
          </button>
        </div>
      )}

      {/* 메인 2컬럼 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        {/* 왼쪽: 고객 목록 */}
        <div className="lg:col-span-2 space-y-3">
          {/* 검색/필터 */}
          <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-wrap gap-2">
            <div className="flex-1 min-w-[140px] flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <Search className="w-3.5 h-3.5 text-gray-600 shrink-0" />
              <input
                value={search}
                onChange={e => { searchRef.current = e.target.value; setSearch(e.target.value); }}
                placeholder="이름·전화번호·이메일 검색"
                className="bg-transparent text-sm flex-1 focus:outline-none"
              />
              {search && (
                <button onClick={() => { searchRef.current = ''; setSearch(''); setRefreshTick(t => t + 1); }} className="text-gray-600 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <select
              value={productFilter}
              onChange={e => setProductFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
            >
              <option value="all">전체 상품</option>
              {productCodes.map(p => (
                <option key={p.code} value={p.code}>
                  {p.cruiseName || p.code} ({p.customerCount}명)
                </option>
              ))}
            </select>
            {selectedIds.size > 0 && (
              <button
                onClick={() => setSelectedIds(new Set())}
                className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100"
              >
                <X className="w-3.5 h-3.5" /> 선택 해제 ({selectedIds.size})
              </button>
            )}
          </div>

          {/* 테이블 */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b bg-gray-50">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectableCustomers.length > 0 && selectableCustomers.every(c => selectedIds.has(c.id))}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded"
                />
                미제출 전체 선택 ({selectableCustomers.length}명)
                {stats.submitted > 0 && (
                  <span className="text-green-600 font-normal">· 제출완료 {stats.submitted}명 제외</span>
                )}
              </label>
              <span className="text-sm text-gray-600">
                {selectedIds.size > 0 ? `✓ ${selectedIds.size}명 선택됨` : '체크박스로 선택하세요'}
              </span>
            </div>

            {loading ? (
              <div className="py-12 flex justify-center">
                <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
              </div>
            ) : customers.length === 0 ? (
              <div className="py-12 text-center text-gray-600">
                <UserCheck className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">표시할 고객이 없습니다</p>
                {statusFilter !== 'all' && (
                  <button onClick={() => setStatusFilter('all')} className="mt-2 text-sm text-blue-600 hover:underline">
                    필터 해제하기
                  </button>
                )}
              </div>
            ) : (
              <>
                <ul className="divide-y divide-gray-100 max-h-[55vh] overflow-y-auto">
                  {customers.map(c => (
                    <CustomerRow
                      key={c.id}
                      customer={c}
                      selected={selectedIds.has(c.id)}
                      onToggle={() => toggle(c.id)}
                    />
                  ))}
                </ul>
                {/* 더 보기 버튼 */}
                {hasNextPage && (
                  <div className="px-4 py-2 border-t border-gray-100 bg-white">
                    <button
                      onClick={() => loadCustomers(currentPage + 1, true)}
                      disabled={loadingMore}
                      className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {loadingMore
                        ? <><RefreshCw className="w-3 h-3 animate-spin" /> 불러오는 중...</>
                        : `다음 100명 더 보기 (현재 ${customers.length}명 표시)`}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* 오른쪽: 발송 패널 */}
        <div className="space-y-3 relative">

          {/* 선택 안 된 경우 안내 오버레이 */}
          {selectedIds.size === 0 && (
            <div className="absolute inset-0 bg-white/90 rounded-xl z-10 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-blue-200">
              <div className="text-4xl">←</div>
              <p className="text-sm font-medium text-blue-700 text-center px-4">
                왼쪽 목록에서<br />고객을 먼저 선택하세요
              </p>
              <p className="text-sm text-gray-600 text-center px-4">체크박스를 클릭하면<br />발송 설정이 나타납니다</p>
            </div>
          )}

          {/* 선택 요약 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">선택한 고객 요약</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-blue-50 rounded-lg p-2.5 text-center">
                <p className="text-xl font-bold text-blue-700">{selectedIds.size}</p>
                <p className="text-sm text-blue-500 mt-0.5">선택</p>
              </div>
              <div className="bg-green-50 rounded-lg p-2.5 text-center">
                <p className="text-xl font-bold text-green-700">{withPhone.length}</p>
                <p className="text-sm text-green-500 mt-0.5">📱 문자 가능</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-2.5 text-center">
                <p className="text-xl font-bold text-amber-700">{withoutPhone.length}</p>
                <p className="text-sm text-amber-500 mt-0.5">🔗 링크만</p>
              </div>
            </div>
            {withoutPhone.length > 0 && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                전화번호 없는 {withoutPhone.length}명은 문자를 보내지 못합니다.<br />
                발송 후 링크를 복사해 카카오톡으로 직접 보내세요.
              </p>
            )}
          </div>

          {/* 발송 대상 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">무엇을 요청하시나요?</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSendTarget('passport')}
                disabled={sending}
                className={`py-2.5 rounded-xl text-sm font-medium border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  sendTarget === 'passport'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                }`}
              >
                🛂 여권 정보 제출
              </button>
              <button
                onClick={() => setSendTarget('pnr')}
                disabled={sending}
                className={`py-2.5 rounded-xl text-sm font-medium border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  sendTarget === 'pnr'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                }`}
              >
                ✈️ 항공 정보 입력
              </button>
            </div>
          </div>

          {/* 메시지 템플릿 */}
          {sendTarget === 'passport' && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700">메시지 내용</p>
              {templates.length > 0 && (
                <select
                  value={templateId ?? ''}
                  onChange={e => setTemplateId(e.target.value ? Number(e.target.value) : null)}
                  disabled={sending}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.title}{t.isDefault ? ' (기본)' : ''}
                    </option>
                  ))}
                </select>
              )}
              {selectedTemplate && selectedCustomers.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-600 mb-1.5">📱 미리보기 (첫 번째 선택 고객 기준)</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-white border border-gray-100 rounded p-2">
                    {fillTemplate(selectedTemplate.body, {
                      고객명: selectedCustomers[0]?.name ? `${selectedCustomers[0].name}님` : '고객님',
                      링크: 'https://크루즈닷.com/p/xxxxx',
                      상품명: selectedCustomers[0]?.latestTrip?.cruiseName ?? '크루즈 여행',
                      출발일: selectedCustomers[0]?.latestTrip?.departureDate?.split('T')[0] ?? '',
                    })}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 링크 유효기간 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">링크 유효 기간</p>
              <span className="text-sm font-bold text-blue-600">{expiresInHours}시간</span>
            </div>
            <input
              type="range" min={24} max={168} step={24}
              value={expiresInHours}
              onChange={e => setExpiresInHours(Number(e.target.value))}
              disabled={sending}
              className="w-full accent-blue-600 disabled:opacity-50"
            />
            <div className="flex justify-between text-sm text-gray-600">
              <span>1일</span><span>3일 (권장)</span><span>1주일</span>
            </div>
          </div>

          {/* 발송 버튼 */}
          <button
            onClick={() => {
              if (selectedIds.size === 0) { showError('고객을 먼저 선택하세요.'); return; }
              setShowConfirm(true);
            }}
            disabled={sending || selectedIds.size === 0}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <Send className="w-4 h-4" />
            {sendBtnLabel}
          </button>
        </div>
      </div>

      {/* 결과 패널 */}
      {result && <ResultPanel result={result} onClose={() => setResult(null)} />}

      {/* 발송 확인 모달 */}
      {showConfirm && (
        <ConfirmSendModal
          selectedCount={selectedIds.size}
          withPhoneCount={withPhone.length}
          withoutPhoneCount={withoutPhone.length}
          onConfirm={doSend}
          onCancel={() => setShowConfirm(false)}
          sending={sending}
        />
      )}
    </div>
  );
}

// ─── 고객 행 ──────────────────────────────────────────────────────

function CustomerRow({
  customer: c, selected, onToggle,
}: {
  customer: PassportCustomer;
  selected: boolean;
  onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);

  // ── 탑승자 데이터 (lazy load) ──────────────────────────────────
  const [guests, setGuests] = useState<SubmissionGuestItem[] | null>(null);
  const [guestsLoading, setGuestsLoading] = useState(false);
  const [guestsError, setGuestsError] = useState(false);
  const guestsFetchedRef = useRef(false);

  const isSubmitted = c.submissionStatus === 'submitted';
  const hasPhone = c.hasPhone;
  const dday = calcDday(c.latestTrip?.departureDate ?? null);

  // open=true & isSubmitted=true 일 때 한 번만 fetch (AbortController로 언마운트 정리)
  useEffect(() => {
    if (!open || !isSubmitted || guestsFetchedRef.current) return;
    guestsFetchedRef.current = true;
    let cancelled = false;
    const controller = new AbortController();
    setGuestsLoading(true);
    setGuestsError(false);
    fetch(`/api/passport/admin/submission-guests?userId=${c.id}`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then(r => r.json())
      .then((data: { ok: boolean; guests?: SubmissionGuestItem[] }) => {
        if (cancelled) return;
        if (data.ok && Array.isArray(data.guests)) setGuests(data.guests);
        else setGuestsError(true);
      })
      .catch(() => { if (!cancelled) setGuestsError(true); })
      .finally(() => { if (!cancelled) setGuestsLoading(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [open, isSubmitted, c.id]);

  const statusBadge = {
    submitted: { cls: 'bg-green-100 text-green-700', label: '✓ 제출 완료' },
    pending: { cls: 'bg-amber-100 text-amber-700', label: '⏳ 요청 전송됨' },
    not_requested: { cls: 'bg-gray-100 text-gray-500', label: '— 아직 요청 안 함' },
  }[c.submissionStatus];

  const lastSentDate = c.lastRequest?.sentAt
    ? new Date(c.lastRequest.sentAt).toLocaleDateString('ko-KR')
    : null;

  // 그룹별로 게스트 묶기
  const guestsByGroup = guests
    ? guests.reduce<Record<number, SubmissionGuestItem[]>>((acc, g) => {
        (acc[g.groupNumber] ??= []).push(g);
        return acc;
      }, {})
    : null;

  return (
    <li className={`transition-colors ${selected ? 'bg-blue-50' : isSubmitted ? 'bg-green-50/30' : 'hover:bg-gray-50'}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <input
          type="checkbox" checked={selected} onChange={isSubmitted ? undefined : onToggle}
          disabled={isSubmitted}
          title={isSubmitted ? '이미 여권을 제출한 고객입니다' : undefined}
          className={`w-4 h-4 rounded border-gray-300 shrink-0 ${isSubmitted ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{c.name ?? '이름 없음'}</span>
            <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${statusBadge.cls}`}>
              {statusBadge.label}
            </span>
            {dday && !isSubmitted && (
              <span className={`text-sm px-1.5 py-0.5 rounded font-bold ${
                dday.urgent ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-gray-100 text-gray-500'
              }`}>
                {dday.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {hasPhone ? (
              <span className="flex items-center gap-1 text-sm text-gray-500">
                <Phone className="w-3 h-3 text-green-500" />
                {c.phone}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-sm text-red-400 font-medium">
                <PhoneOff className="w-3 h-3" />
                전화번호 없음 (링크만 생성됩니다)
              </span>
            )}
            {c.latestTrip?.cruiseName && (
              <span className="text-sm text-gray-600 truncate">
                {c.latestTrip.cruiseName}
                {c.latestTrip.departureDate && ` · ${c.latestTrip.departureDate.split('T')[0]}`}
              </span>
            )}
            {lastSentDate && c.submissionStatus === 'pending' && (
              <span className="text-sm text-amber-600">{lastSentDate} 발송됨</span>
            )}
          </div>
        </div>
        <button
          onClick={() => setOpen(v => !v)}
          title="상세 정보 보기"
          className="p-1.5 rounded-lg text-gray-600 hover:text-gray-600 hover:bg-gray-100 shrink-0"
        >
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {open && (
        <div className="px-4 pb-3 pl-11 space-y-2 bg-gray-50 border-t border-gray-100">
          {c.email && <p className="text-sm text-gray-500">이메일: {c.email}</p>}

          {c.submission?.isSubmitted && c.submission.submittedAt && (
            <p className="text-sm text-green-600">
              ✓ 여권 제출 완료: {new Date(c.submission.submittedAt).toLocaleDateString('ko-KR')}
            </p>
          )}

          {/* ── 탑승자 여권 데이터 (isSubmitted=true 일 때만) ─────── */}
          {isSubmitted && (
            <div className="pt-1">
              {guestsLoading && (
                <div className="flex items-center gap-1.5 text-sm text-gray-600 py-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  탑승자 정보 불러오는 중...
                </div>
              )}

              {guestsError && (
                <p className="text-sm text-red-400 py-1">상세 정보를 불러오지 못했습니다.</p>
              )}

              {!guestsLoading && !guestsError && guestsByGroup && (
                Object.keys(guestsByGroup).length === 0 ? (
                  <p className="text-sm text-gray-600 py-1">등록된 탑승자 정보가 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-600">
                        탑승자 정보 ({guests?.length ?? 0}명)
                      </p>
                    </div>
                    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                      {/* 헤더 */}
                      <div className="grid grid-cols-4 gap-2 px-3 py-1.5 bg-gray-100 text-sm font-medium text-gray-500">
                        <span>이름</span>
                        <span>국적</span>
                        <span>여권번호</span>
                        <span>만료일</span>
                      </div>
                      {/* 그룹별 행 */}
                      {Object.entries(guestsByGroup).map(([groupNum, members]) => (
                        <div key={groupNum}>
                          {Object.keys(guestsByGroup).length > 1 && (
                            <div className="px-3 py-1 bg-blue-50 border-t border-gray-100">
                              <span className="text-sm font-semibold text-blue-600">
                                그룹 {groupNum}
                              </span>
                            </div>
                          )}
                          {members.map((g, idx) => (
                            <div
                              key={g.id}
                              className="grid grid-cols-4 gap-2 px-3 py-1.5 border-t border-gray-100 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <span className="font-medium truncate">
                                <span className="text-gray-600 mr-1">{(['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩'][idx] ?? `${idx + 1}.`)}</span>
                                {g.name}
                              </span>
                              <span className="text-gray-500">{g.nationality ?? '—'}</span>
                              <span className="font-mono tracking-wide">
                                {g.passportNumber ?? '—'}
                              </span>
                              <span className={g.passportExpiryDate ? '' : 'text-gray-600'}>
                                {g.passportExpiryDate ? `${g.passportExpiryDate} 까지` : '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {/* ── 발송 이력 (lazy load: 미제출 고객) ─────────────────── */}
          {!isSubmitted && (
            <HistorySection userId={c.id} open={open} lastRequest={c.lastRequest} lastSentDate={lastSentDate} />
          )}
          {!c.latestTrip && (
            <p className="text-sm text-gray-600">여행 정보 없음</p>
          )}
        </div>
      )}
    </li>
  );
}

// ─── 발송 이력 섹션 (분리 컴포넌트 — CustomerRow가 너무 길어지지 않도록) ──

interface HistoryLog {
  id: number;
  status: string;
  messageChannel: string;
  sentAt: string;
  errorReason: string | null;
}

function HistorySection({
  userId,
  open,
  lastRequest,
  lastSentDate,
}: {
  userId: number;
  open: boolean;
  lastRequest: PassportCustomer['lastRequest'];
  lastSentDate: string | null;
}) {
  // null = 미조회, [] = 없음, HistoryLog[] = 결과
  const [history, setHistory] = useState<HistoryLog[] | null>(null);
  const [loading, setLoading] = useState(false);

  // 드롭다운이 열릴 때 최초 1회만 조회 (AbortController로 언마운트 정리)
  useEffect(() => {
    if (!open || history !== null) return;
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/passport/admin/history?userId=${userId}&limit=5`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!cancelled)
          setHistory(d?.ok && Array.isArray(d.data) ? (d.data as HistoryLog[]) : []);
      })
      .catch(() => { if (!cancelled) setHistory([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [open, history, userId]);

  const channelLabel: Record<string, string> = {
    SMS: 'SMS', KAKAO: '카카오', ALIMTALK: '알림톡',
    MANUAL_COPY: '수동복사', MANUAL: '수동',
  };

  return (
    <div>
      {/* 최근 1건은 기존 방식 그대로 (이미 가져온 데이터 재활용) */}
      {lastRequest && (
        <p className="text-sm text-gray-600">
          마지막 발송: {lastSentDate} ({lastRequest.messageChannel})
          {lastRequest.status === 'FAILED' && <span className="text-red-400 ml-1">— 발송 실패</span>}
        </p>
      )}

      {/* 전체 이력 (lazy) */}
      <div className="mt-1">
        {loading && (
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <RefreshCw className="w-3 h-3 animate-spin" /> 이력 불러오는 중...
          </div>
        )}
        {!loading && history !== null && history.length === 0 && !lastRequest && (
          <p className="text-sm text-gray-600">발송 이력 없음</p>
        )}
        {!loading && history !== null && history.length > 1 && (
          <details className="mt-1">
            <summary className="text-sm text-blue-600 cursor-pointer hover:underline select-none">
              발송 이력 전체 보기 ({history.length}건)
            </summary>
            <ul className="mt-1 space-y-0.5 pl-1">
              {history.map(log => (
                <li key={log.id} className="flex items-center gap-2 text-sm">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    log.status === 'SUCCESS' ? 'bg-green-500' :
                    log.status === 'FAILED' ? 'bg-red-400' : 'bg-gray-400'
                  }`} />
                  <span className="text-gray-500 shrink-0">
                    {new Date(log.sentAt).toLocaleDateString('ko-KR')}{' '}
                    {new Date(log.sentAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-gray-600 shrink-0">
                    {channelLabel[log.messageChannel] ?? log.messageChannel}
                  </span>
                  {log.status === 'FAILED' && log.errorReason && (
                    <span className="text-red-400 truncate">— {log.errorReason}</span>
                  )}
                  {log.status === 'SUCCESS' && <span className="text-green-600">완료</span>}
                  {log.status === 'MANUAL' && <span className="text-blue-500">수동</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}

// ─── 결과 패널 ────────────────────────────────────────────────────

function ResultPanel({
  result,
  onClose,
}: {
  result: {
    ok: Array<{ userId: number; name: string | null; link: string; message: string; smsSent: boolean }>;
    noPhone: Array<{ userId: number; name: string | null; link: string; message: string }>;
    failed: Array<{ userId: number; name: string | null; error: string }>;
    expiresInHours: number;
  };
  onClose: () => void;
}) {
  const smsSent = result.ok.filter(x => x.smsSent).length;
  const smsFailed = result.ok.filter(x => !x.smsSent).length;
  const totalIssues = result.noPhone.length + smsFailed + result.failed.length;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <div>
          <p className="text-sm font-bold text-gray-900">📋 발송 결과</p>
          <p className="text-sm text-gray-500 mt-0.5">
            문자 발송 {smsSent}명 · 링크만 생성 {result.noPhone.length + smsFailed}명 · 실패 {result.failed.length}명 ·
            링크 유효기간 {result.expiresInHours}시간
          </p>
        </div>
        <button onClick={onClose} className="p-1.5 text-gray-600 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">

        {/* 다음 할 일 안내 */}
        {totalIssues > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 space-y-1">
            <p className="text-sm font-bold text-blue-800">📌 지금 해야 할 일</p>
            {result.noPhone.length > 0 && (
              <p className="text-sm text-blue-700">
                ① 아래 "{result.noPhone.length}명" 항목에서 링크를 복사해 카카오톡으로 직접 보내세요
              </p>
            )}
            {smsFailed > 0 && (
              <p className="text-sm text-blue-700">
                ② 문자 발송에 실패한 {smsFailed}명도 링크를 복사해 직접 전달하세요
              </p>
            )}
            <p className="text-sm text-blue-600 mt-1">
              ✓ 고객이 링크를 클릭해 여권을 제출하면 상태가 자동으로 "제출 완료"로 바뀝니다
            </p>
          </div>
        )}
        {totalIssues === 0 && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <p className="text-sm font-bold text-green-800">✅ 모두 정상 발송됐습니다</p>
            <p className="text-sm text-green-700 mt-1">
              고객이 링크를 클릭해 여권을 제출하면 상태가 자동으로 "제출 완료"로 바뀝니다
            </p>
          </div>
        )}

        {/* 문자 발송 성공 */}
        {result.ok.filter(x => x.smsSent).length > 0 && (
          <ResultSection
            title={`📱 문자(SMS) 발송 완료 — ${result.ok.filter(x => x.smsSent).length}명`}
            bgClass="bg-green-50 border-green-200"
            titleClass="text-green-800"
            items={result.ok.filter(x => x.smsSent)}
          />
        )}

        {/* 문자 실패 (링크는 있음) */}
        {smsFailed > 0 && (
          <ResultSection
            title={`⚠️ 문자 실패 — ${smsFailed}명 (링크 복사 후 직접 전달하세요)`}
            bgClass="bg-orange-50 border-orange-200"
            titleClass="text-orange-800"
            items={result.ok.filter(x => !x.smsSent)}
          />
        )}

        {/* 전화번호 없음 */}
        {result.noPhone.length > 0 && (
          <ResultSection
            title={`📵 전화번호 없음 — ${result.noPhone.length}명 (링크 복사 후 카카오톡으로 보내세요)`}
            bgClass="bg-amber-50 border-amber-200"
            titleClass="text-amber-800"
            items={result.noPhone}
          />
        )}

        {/* 완전 실패 */}
        {result.failed.length > 0 && (
          <div>
            <p className="text-sm font-bold text-red-700 mb-2">❌ 처리 실패 — {result.failed.length}명</p>
            <div className="space-y-1.5">
              {result.failed.map(f => (
                <div key={f.userId} className="flex items-center justify-between bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <span className="text-sm text-gray-900 font-medium">{f.name ?? `고객 ID:${f.userId}`}</span>
                  <span className="text-sm text-red-600 ml-2">{f.error}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultSection({
  title, bgClass, titleClass, items,
}: {
  title: string;
  bgClass: string;
  titleClass: string;
  items: Array<{ userId: number; name: string | null; link: string; message: string }>;
}) {
  return (
    <div>
      <p className={`text-sm font-bold ${titleClass} mb-2`}>{title}</p>
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.userId} className={`border rounded-xl p-3 space-y-2 ${bgClass}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-gray-900">{item.name ?? `고객 ID:${item.userId}`}</span>
              <CopyButton text={item.link} label="링크 복사" />
            </div>
            {item.message && (
              <div className="flex items-start gap-2">
                <p className="text-sm text-gray-700 bg-white border border-gray-100 rounded-lg px-3 py-2 flex-1 whitespace-pre-wrap leading-relaxed">
                  {item.message}
                </p>
                <CopyButton text={item.message} label="메시지 복사" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
