'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, CheckCircle, RefreshCw, Search, Send,
  UserCheck, Copy, Check, X, Phone, PhoneOff, FileText,
  ChevronDown, ChevronUp, Download,
} from 'lucide-react';
import { showError, showSuccess } from '@/components/ui/Toast';
import { fillTemplate, LINK_ONLY_PASSPORT_MESSAGE } from '@/lib/passport-utils';

// ─── 타입 ─────────────────────────────────────────────────────────

interface PassportCustomer {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  role: string;
  customerStatus: string | null;
  createdAt: string;
  tripCount: number;
  latestTrip: {
    id: number;
    cruiseName: string | null;
    reservationCode: string | null;
    productId: number | null;
    startDate: string | null;
    endDate: string | null;
  } | null;
  submission: {
    id: number; tripId: number | null; token: string;
    tokenExpiresAt: string; isSubmitted: boolean;
    submittedAt: string | null; createdAt: string; updatedAt: string;
  } | null;
  lastRequest: {
    id: number; status: string; messageChannel: string; sentAt: string;
    admin: { id: number; name: string | null } | null;
  } | null;
  submissionStatus: 'submitted' | 'pending' | 'not_requested';
}

interface Template {
  id: number; title: string; body: string;
  variables: Record<string, unknown> | null; isDefault: boolean; updatedAt: string;
}

interface SendResultItem {
  userId: number; success: boolean;
  link?: string; token?: string; submissionId?: number;
  message?: string; error?: string; messageId?: string | null;
}

type StatusFilter = 'all' | 'submitted' | 'pending' | 'not_requested';
type SendTarget = 'passport' | 'pnr';

// ─── 유틸 ─────────────────────────────────────────────────────────

function hasValidPhone(phone: string | null): boolean {
  if (!phone) return false;
  const digits = phone.replace(/[^0-9]/g, '');
  return digits.length >= 10;
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <button
      onClick={() => navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), 2000);
      })}
      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs text-gray-600 transition-colors shrink-0"
    >
      {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
      {label ?? (copied ? '복사됨' : '복사')}
    </button>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────

export default function PassportPage() {
  // 데이터
  const [customers, setCustomers] = useState<PassportCustomer[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [productCodes, setProductCodes] = useState<{ code: string; cruiseName: string | null; customerCount: number }[]>([]);
  const [aligoBalance, setAligoBalance] = useState<number | null>(null);

  // 로딩
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // 필터
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [productFilter, setProductFilter] = useState('all');

  // 선택
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // 발송 설정
  const [sendTarget, setSendTarget] = useState<SendTarget>('passport');
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [expiresInHours, setExpiresInHours] = useState(72);

  // 결과
  const [result, setResult] = useState<{
    ok: Array<{ userId: number; name: string | null; link: string; message: string; smsSent: boolean }>;
    noPhone: Array<{ userId: number; name: string | null; link: string; message: string }>;
    failed: Array<{ userId: number; name: string | null; error: string }>;
    expiresAt: string;
  } | null>(null);

  const [refreshTick, setRefreshTick] = useState(0);
  const searchRef = useRef(search);
  useEffect(() => { searchRef.current = search; }, [search]);

  // ── 데이터 로드 ─────────────────────────────────────────────────

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (search.trim()) p.set('search', search.trim());
      if (statusFilter !== 'all') p.set('status', statusFilter);
      if (productFilter !== 'all') p.set('productCode', productFilter);
      const res = await fetch(`/api/passport/admin/customers?${p}`, { credentials: 'include' });
      const data = await res.json();
      if (data.ok && Array.isArray(data.data)) setCustomers(data.data);
    } catch { showError('고객 목록을 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  }, [search, statusFilter, productFilter]);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/passport/admin/templates', { credentials: 'include' });
      const data = await res.json();
      if (data.ok && Array.isArray(data.templates)) {
        setTemplates(data.templates);
        const def = data.templates.find((t: Template) => t.isDefault) ?? data.templates[0];
        if (def) setTemplateId(def.id);
      }
    } catch { /* silently fail */ }
  }, []);

  useEffect(() => {
    loadTemplates();
    fetch('/api/passport/admin/aligo-status', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.ok) setAligoBalance(d.balance); })
      .catch(() => {});
    fetch('/api/passport/admin/product-codes', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.ok) setProductCodes(d.productCodes ?? []); })
      .catch(() => {});
  }, [loadTemplates]);

  useEffect(() => {
    const t = setTimeout(loadCustomers, 350);
    return () => clearTimeout(t);
  }, [loadCustomers, refreshTick]);

  // ── 파생 데이터 ─────────────────────────────────────────────────

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

  const withPhone = useMemo(() => selectedCustomers.filter(c => hasValidPhone(c.phone)), [selectedCustomers]);
  const withoutPhone = useMemo(() => selectedCustomers.filter(c => !hasValidPhone(c.phone)), [selectedCustomers]);

  const selectedTemplate = useMemo(
    () => templates.find(t => t.id === templateId) ?? templates.find(t => t.isDefault) ?? templates[0] ?? null,
    [templates, templateId],
  );

  // ── 선택 액션 ───────────────────────────────────────────────────

  const toggle = (id: number) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => setSelectedIds(prev =>
    prev.size === customers.length ? new Set() : new Set(customers.map(c => c.id))
  );

  // ── 발송 ────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (selectedIds.size === 0) { showError('발송할 고객을 선택하세요.'); return; }

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

      const items: SendResultItem[] = data.results ?? [];
      const expiresAt = new Date(Date.now() + expiresInHours * 3600_000).toISOString();

      const ok: typeof result['ok'] = [];
      const noPhone: typeof result['noPhone'] = [];
      const failed: typeof result['failed'] = [];

      for (const item of items) {
        const c = customers.find(x => x.id === item.userId);
        const name = c?.name ?? null;

        if (item.link && item.error?.includes('전화번호 없음')) {
          noPhone.push({ userId: item.userId, name, link: item.link, message: item.message ?? '' });
        } else if (item.link && item.success) {
          ok.push({ userId: item.userId, name, link: item.link, message: item.message ?? '', smsSent: true });
        } else if (item.link && !item.success) {
          // SMS 실패했지만 링크는 생성됨
          ok.push({ userId: item.userId, name, link: item.link, message: item.message ?? '', smsSent: false });
        } else {
          failed.push({ userId: item.userId, name, error: item.error ?? '알 수 없는 오류' });
        }
      }

      setResult({ ok, noPhone, failed, expiresAt });
      setRefreshTick(t => t + 1);

      const smsSent = ok.filter(x => x.smsSent).length;
      const linkOnly = noPhone.length + ok.filter(x => !x.smsSent).length;
      if (failed.length === 0) {
        showSuccess(`완료: SMS ${smsSent}명 발송, 링크만 생성 ${linkOnly}명`);
      } else {
        showSuccess(`완료: ${smsSent}명 SMS, ${linkOnly}명 링크 생성 (${failed.length}명 실패)`);
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
          <p className="text-sm text-gray-500 mt-0.5">고객에게 여권 제출 링크를 발송합니다</p>
        </div>
        <div className="flex items-center gap-2">
          {aligoBalance !== null && (
            <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${
              aligoBalance <= 5000 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
            }`}>
              알리고 {aligoBalance.toLocaleString()}원
              {aligoBalance <= 5000 && ' ⚠ 저잔액'}
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

      {/* 통계 */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: '제출 완료', value: stats.submitted, color: 'green', icon: CheckCircle },
          { label: '발송 대기', value: stats.pending, color: 'amber', icon: AlertCircle },
          { label: '미발송', value: stats.notRequested, color: 'gray', icon: FileText },
          { label: '전체', value: stats.total, color: 'blue', icon: UserCheck },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className={`bg-${color}-50 border border-${color}-200 rounded-xl p-3`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs font-medium text-${color}-600`}>{label}</p>
                <p className={`text-2xl font-bold text-${color}-900 mt-0.5`}>{value}</p>
              </div>
              <Icon className={`w-7 h-7 text-${color}-400`} />
            </div>
          </div>
        ))}
      </div>

      {/* 메인 2컬럼 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* 왼쪽: 고객 목록 */}
        <div className="lg:col-span-2 space-y-3">

          {/* 필터 */}
          <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-wrap gap-2">
            <div className="flex-1 min-w-[140px] flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input
                value={search}
                onChange={e => { searchRef.current = e.target.value; setSearch(e.target.value); }}
                placeholder="이름·전화번호·이메일"
                className="bg-transparent text-sm flex-1 focus:outline-none"
              />
              {search && <button onClick={() => { searchRef.current = ''; setSearch(''); }} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>}
            </div>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
            >
              <option value="all">전체 상태</option>
              <option value="submitted">제출 완료</option>
              <option value="pending">발송 대기</option>
              <option value="not_requested">미발송</option>
            </select>

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
                <X className="w-3.5 h-3.5" />
                선택 해제 ({selectedIds.size})
              </button>
            )}
          </div>

          {/* 테이블 */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b bg-gray-50">
              <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={customers.length > 0 && selectedIds.size === customers.length}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded"
                />
                전체 선택 ({customers.length}명)
              </label>
              <span className="text-xs text-gray-400">선택: {selectedIds.size}명</span>
            </div>

            {loading ? (
              <div className="py-12 flex justify-center">
                <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
              </div>
            ) : customers.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <UserCheck className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">표시할 고객이 없습니다</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
                {customers.map(c => (
                  <CustomerRow
                    key={c.id}
                    customer={c}
                    selected={selectedIds.has(c.id)}
                    onToggle={() => toggle(c.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 오른쪽: 발송 패널 */}
        <div className="space-y-3">

          {/* 선택 요약 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">발송 대상</p>
            <div className="flex gap-2">
              <div className="flex-1 bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-700">{selectedIds.size}</p>
                <p className="text-xs text-blue-500">선택</p>
              </div>
              <div className="flex-1 bg-green-50 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-green-600" />
                  <p className="text-2xl font-bold text-green-700">{withPhone.length}</p>
                </div>
                <p className="text-xs text-green-500">SMS 가능</p>
              </div>
              {withoutPhone.length > 0 && (
                <div className="flex-1 bg-amber-50 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <PhoneOff className="w-3.5 h-3.5 text-amber-600" />
                    <p className="text-2xl font-bold text-amber-700">{withoutPhone.length}</p>
                  </div>
                  <p className="text-xs text-amber-500">링크만</p>
                </div>
              )}
            </div>
            {withoutPhone.length > 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                전화번호 없는 {withoutPhone.length}명은 링크만 생성됩니다. 직접 전달이 필요합니다.
              </p>
            )}
          </div>

          {/* 발송 유형 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">발송 유형</p>
            <div className="flex gap-2">
              {(['passport', 'pnr'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setSendTarget(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                    sendTarget === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {t === 'passport' ? '여권 제출' : 'PNR 입력'}
                </button>
              ))}
            </div>
          </div>

          {/* 템플릿 */}
          {sendTarget === 'passport' && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700">메시지 템플릿</p>
              {templates.length === 0 ? (
                <p className="text-xs text-gray-400">기본 템플릿을 사용합니다</p>
              ) : (
                <select
                  value={templateId ?? ''}
                  onChange={e => setTemplateId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.title}{t.isDefault ? ' (기본)' : ''}
                    </option>
                  ))}
                </select>
              )}
              {selectedTemplate && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">미리보기</p>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {fillTemplate(selectedTemplate.body, {
                      고객명: selectedCustomers[0]?.name ? `${selectedCustomers[0].name}님` : '고객님',
                      링크: 'https://example.com/p/xxxxx',
                      상품명: selectedCustomers[0]?.latestTrip?.cruiseName ?? '크루즈 여행',
                      출발일: selectedCustomers[0]?.latestTrip?.startDate?.split('T')[0] ?? '2026-01-01',
                    })}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 만료 기간 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">링크 유효 기간</p>
              <span className="text-sm font-medium text-blue-600">{expiresInHours}시간</span>
            </div>
            <input
              type="range" min={24} max={168} step={24}
              value={expiresInHours}
              onChange={e => setExpiresInHours(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>24시간</span><span>72시간</span><span>1주일</span>
            </div>
          </div>

          {/* 발송 버튼 */}
          <button
            onClick={handleSend}
            disabled={sending || selectedIds.size === 0}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"
          >
            {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? '발송 중...' : `링크 생성 + SMS 발송 (${selectedIds.size}명)`}
          </button>
          {selectedIds.size > 0 && withPhone.length < selectedIds.size && (
            <p className="text-xs text-center text-amber-600">
              * 전화번호 없는 {withoutPhone.length}명은 링크만 생성 → 직접 전달 필요
            </p>
          )}
        </div>
      </div>

      {/* 결과 */}
      {result && <ResultPanel result={result} onClose={() => setResult(null)} />}
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
  const hasPhone = hasValidPhone(c.phone);

  const statusColor = {
    submitted: 'bg-green-100 text-green-700',
    pending: 'bg-amber-100 text-amber-700',
    not_requested: 'bg-gray-100 text-gray-500',
  }[c.submissionStatus];

  const statusLabel = {
    submitted: '제출 완료',
    pending: '발송됨',
    not_requested: '미발송',
  }[c.submissionStatus];

  return (
    <li className={`transition-colors ${selected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <input
          type="checkbox" checked={selected} onChange={onToggle}
          className="w-4 h-4 rounded shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900 truncate">
              {c.name ?? '이름 없음'}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
              {statusLabel}
            </span>
            {hasPhone
              ? <span className="flex items-center gap-0.5 text-xs text-green-600"><Phone className="w-3 h-3" />{c.phone}</span>
              : <span className="flex items-center gap-0.5 text-xs text-red-400"><PhoneOff className="w-3 h-3" />전화번호 없음</span>
            }
          </div>
          {c.latestTrip?.cruiseName && (
            <p className="text-xs text-gray-400 mt-0.5">
              {c.latestTrip.cruiseName}
              {c.latestTrip.startDate && ` · ${c.latestTrip.startDate.split('T')[0]}`}
            </p>
          )}
        </div>
        <button
          onClick={() => setOpen(v => !v)}
          className="p-1 text-gray-400 hover:text-gray-600 shrink-0"
        >
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {open && (
        <div className="px-4 pb-3 pl-11 space-y-1.5">
          {c.email && <p className="text-xs text-gray-500">이메일: {c.email}</p>}
          {c.submission?.isSubmitted && c.submission.submittedAt && (
            <p className="text-xs text-green-600">
              ✓ 제출됨: {new Date(c.submission.submittedAt).toLocaleDateString('ko-KR')}
            </p>
          )}
          {c.lastRequest && (
            <p className="text-xs text-gray-400">
              마지막 발송: {new Date(c.lastRequest.sentAt).toLocaleDateString('ko-KR')} ({c.lastRequest.messageChannel})
            </p>
          )}
        </div>
      )}
    </li>
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
    expiresAt: string;
  };
  onClose: () => void;
}) {
  const expiresStr = new Date(result.expiresAt).toLocaleString('ko-KR');
  const smsSent = result.ok.filter(x => x.smsSent).length;
  const linkOnly = result.noPhone.length + result.ok.filter(x => !x.smsSent).length;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <div>
          <p className="text-sm font-semibold text-gray-900">발송 결과</p>
          <p className="text-xs text-gray-500 mt-0.5">
            SMS {smsSent}명 발송 · 링크만 {linkOnly}명 · 실패 {result.failed.length}명 · 만료 {expiresStr}
          </p>
        </div>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">

        {/* SMS 발송 성공 */}
        {result.ok.filter(x => x.smsSent).length > 0 && (
          <ResultSection
            title={`SMS 발송 완료 (${result.ok.filter(x => x.smsSent).length}명)`}
            color="green"
            items={result.ok.filter(x => x.smsSent).map(x => ({ name: x.name, link: x.link, message: x.message }))}
          />
        )}

        {/* 링크만 생성 (전화번호 없음) */}
        {result.noPhone.length > 0 && (
          <ResultSection
            title={`링크만 생성 — 직접 전달 필요 (${result.noPhone.length}명)`}
            color="amber"
            items={result.noPhone.map(x => ({ name: x.name, link: x.link, message: x.message }))}
            warning="전화번호가 없어 SMS를 보내지 못했습니다. 아래 링크를 복사해 직접 전달하세요."
          />
        )}

        {/* SMS 실패 (링크는 있음) */}
        {result.ok.filter(x => !x.smsSent).length > 0 && (
          <ResultSection
            title={`SMS 실패 — 링크 복사 필요 (${result.ok.filter(x => !x.smsSent).length}명)`}
            color="orange"
            items={result.ok.filter(x => !x.smsSent).map(x => ({ name: x.name, link: x.link, message: x.message }))}
            warning="SMS 발송에 실패했지만 링크는 생성되었습니다."
          />
        )}

        {/* 완전 실패 */}
        {result.failed.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-red-600 mb-2 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              실패 ({result.failed.length}명)
            </p>
            <div className="space-y-1">
              {result.failed.map(f => (
                <div key={f.userId} className="flex items-center justify-between bg-red-50 rounded-lg px-3 py-2">
                  <span className="text-sm text-gray-900">{f.name ?? `ID:${f.userId}`}</span>
                  <span className="text-xs text-red-600">{f.error}</span>
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
  title, color, items, warning,
}: {
  title: string;
  color: 'green' | 'amber' | 'orange';
  items: Array<{ name: string | null; link: string; message: string }>;
  warning?: string;
}) {
  const colorMap = {
    green: { badge: 'text-green-700', bg: 'bg-green-50', row: 'bg-green-50 border-green-100' },
    amber: { badge: 'text-amber-700', bg: 'bg-amber-50', row: 'bg-amber-50 border-amber-100' },
    orange: { badge: 'text-orange-700', bg: 'bg-orange-50', row: 'bg-orange-50 border-orange-100' },
  }[color];

  return (
    <div>
      <p className={`text-xs font-semibold ${colorMap.badge} mb-2 flex items-center gap-1`}>
        <CheckCircle className="w-3.5 h-3.5" />
        {title}
      </p>
      {warning && (
        <p className={`text-xs ${colorMap.badge} ${colorMap.bg} rounded-lg px-3 py-2 mb-2`}>{warning}</p>
      )}
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className={`border rounded-lg p-3 space-y-2 ${colorMap.row}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-900">{item.name ?? `고객 ${i + 1}`}</span>
              <CopyButton text={item.link} label="링크 복사" />
            </div>
            {item.message && (
              <div className="flex items-start gap-2">
                <p className="text-xs text-gray-600 bg-white border border-gray-100 rounded px-2 py-1.5 flex-1 whitespace-pre-wrap">
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
