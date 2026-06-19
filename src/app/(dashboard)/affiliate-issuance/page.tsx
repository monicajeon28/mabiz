'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Search,
  ChevronDown,
} from 'lucide-react';

/* ─────────────── Types ─────────────── */

type AffiliateType = 'BRANCH_MANAGER' | 'SALES_AGENT' | 'PRE_SALES' | 'HQ';

const TYPE_LABELS: Record<AffiliateType, string> = {
  BRANCH_MANAGER: '대리점장',
  SALES_AGENT: '판매원',
  PRE_SALES: '프리세일즈',
  HQ: '본사',
};

const TYPE_BADGE: Record<string, string> = {
  BRANCH_MANAGER: 'bg-purple-100 text-purple-700',
  SALES_AGENT: 'bg-blue-100 text-blue-700',
  PRE_SALES: 'bg-cyan-100 text-cyan-700',
  HQ: 'bg-gray-100 text-gray-700',
};

type IssuanceResult = {
  mallUserId: string;
  affiliateCode: string;
  profileId: string;
  displayName: string;
};

type BranchManager = {
  id: number;
  displayName: string | null;
  mallUserId: string | null;
  name: string | null;
};

type AffiliateProfile = {
  id: number;
  type: string;
  status: string;
  affiliateCode: string;
  displayName: string;
  mallUserId: string | null;
  name: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  contractStatus: string | null;
  withholdingRate: number | null;
  createdAt: string;
};

/* ─────────────── Shared UI ─────────────── */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-semibold text-gray-700 mb-3 mt-6 first:mt-0">
      {children}
    </h2>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition';

/* ─────────────── Tab: 발급하기 ─────────────── */

function IssuanceForm() {
  const [type, setType] = useState<AffiliateType>('BRANCH_MANAGER');
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [nickname, setNickname] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  const [withholdingRate, setWithholdingRate] = useState('3.3');
  const [guarantorName, setGuarantorName] = useState('');
  const [guarantorId, setGuarantorId] = useState('');
  const [landingSlug, setLandingSlug] = useState('');
  const [contractSignedAt, setContractSignedAt] = useState('');
  const [contractSignature, setContractSignature] = useState('');
  const [contractVersion, setContractVersion] = useState('');
  const [managerProfileId, setManagerProfileId] = useState<number | ''>('');
  const [initialPassword, setInitialPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IssuanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // Branch manager dropdown
  const [managers, setManagers] = useState<BranchManager[]>([]);
  const [managersLoading, setManagersLoading] = useState(false);

  const needsManager = type === 'SALES_AGENT' || type === 'PRE_SALES';

  useEffect(() => {
    if (!needsManager) return;
    const controller = new AbortController();
    setManagersLoading(true);
    fetch('/api/affiliate-issuance/branch-managers', { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (data.ok) setManagers(data.managers ?? []);
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      })
      .finally(() => setManagersLoading(false));
    return () => controller.abort();
  }, [needsManager]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('이름은 필수 항목입니다.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const body: Record<string, unknown> = {
        type,
        name: name.trim(),
        displayName: displayName.trim() || undefined,
        nickname: nickname.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        bankName: bankName.trim() || undefined,
        bankAccount: bankAccount.trim() || undefined,
        bankAccountHolder: bankAccountHolder.trim() || undefined,
        withholdingRate: withholdingRate ? parseFloat(withholdingRate) : 3.3,
        guarantorName: guarantorName.trim() || undefined,
        guarantorId: guarantorId.trim() ? parseInt(guarantorId.trim(), 10) : undefined,
        landingSlug: landingSlug.trim() || undefined,
        contractSignedAt: contractSignedAt || undefined,
        contractSignature: contractSignature.trim() || undefined,
        contractVersion: contractVersion.trim() || undefined,
        managerProfileId: needsManager && managerProfileId !== '' ? managerProfileId : undefined,
        initialPassword: initialPassword.trim() || undefined,
      };

      const res = await fetch('/api/affiliate-issuance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? `오류 발생 (${res.status})`);
        return;
      }

      setResult(data);
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResult(null);
    setError(null);
    setName('');
    setDisplayName('');
    setNickname('');
    setContactPhone('');
    setContactEmail('');
    setBankName('');
    setBankAccount('');
    setBankAccountHolder('');
    setWithholdingRate('3.3');
    setGuarantorName('');
    setGuarantorId('');
    setLandingSlug('');
    setContractSignedAt('');
    setContractSignature('');
    setContractVersion('');
    setManagerProfileId('');
    setInitialPassword('');
  }

  async function handleCopy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <>
      {/* 성공 결과 카드 */}
      {result && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="text-green-600 shrink-0" size={20} />
            <span className="font-semibold text-green-800">발급 완료!</span>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-green-200">
              <span className="text-gray-500">로그인 ID</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-gray-900">{result.mallUserId}</span>
                <button
                  onClick={() => handleCopy(result.mallUserId, 'mallUserId')}
                  className="text-gray-400 hover:text-gray-700 transition"
                >
                  {copied === 'mallUserId' ? (
                    <Check size={14} className="text-green-500" />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-green-200">
              <span className="text-gray-500">어필리에이트 코드</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-gray-900">
                  {result.affiliateCode}
                </span>
                <button
                  onClick={() => handleCopy(result.affiliateCode, 'affiliateCode')}
                  className="text-gray-400 hover:text-gray-700 transition"
                >
                  {copied === 'affiliateCode' ? (
                    <Check size={14} className="text-green-500" />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-green-200">
              <span className="text-gray-500">프로필 ID</span>
              <span className="font-mono text-xs text-gray-600">{result.profileId}</span>
            </div>

            <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-green-200">
              <span className="text-gray-500">표시명</span>
              <span className="text-gray-900">{result.displayName}</span>
            </div>
          </div>

          <p className="text-xs text-green-700 mt-3">
            초기 비밀번호: {initialPassword.trim() || '1101'} — 첫 로그인 후 변경을 안내해
            주세요.
          </p>

          <button
            onClick={handleReset}
            className="mt-4 w-full text-sm text-green-700 hover:text-green-900 underline underline-offset-2"
          >
            새 계정 발급하기
          </button>
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-2">
          <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={16} />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* 폼 */}
      {!result && (
        <form onSubmit={handleSubmit} className="space-y-2">
          {/* ── 기본 정보 ── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <SectionTitle>기본 정보</SectionTitle>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="역할" required>
                <select
                  value={type}
                  onChange={e => setType(e.target.value as AffiliateType)}
                  className={inputCls + ' bg-white'}
                >
                  {(Object.keys(TYPE_LABELS) as AffiliateType[]).map(k => (
                    <option key={k} value={k}>
                      {TYPE_LABELS[k]}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="이름" required>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="홍길동"
                  className={inputCls}
                />
              </Field>

              <Field label="표시명">
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="예: 홍대리점장"
                  className={inputCls}
                />
              </Field>

              <Field label="닉네임">
                <input
                  type="text"
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  placeholder="예: hong"
                  className={inputCls}
                />
              </Field>

              <Field label="연락처">
                <input
                  type="text"
                  value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  className={inputCls}
                />
              </Field>

              <Field label="이메일">
                <input
                  type="email"
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                  placeholder="example@email.com"
                  className={inputCls}
                />
              </Field>
            </div>
          </div>

          {/* ── 정산 정보 ── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <SectionTitle>정산 정보</SectionTitle>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="은행명">
                <input
                  type="text"
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  placeholder="예: 국민은행"
                  className={inputCls}
                />
              </Field>

              <Field label="계좌번호">
                <input
                  type="text"
                  value={bankAccount}
                  onChange={e => setBankAccount(e.target.value)}
                  placeholder="계좌번호 (- 없이)"
                  className={inputCls}
                />
              </Field>

              <Field label="예금주">
                <input
                  type="text"
                  value={bankAccountHolder}
                  onChange={e => setBankAccountHolder(e.target.value)}
                  placeholder="예금주명"
                  className={inputCls}
                />
              </Field>

              <Field label="원천징수율">
                <select
                  value={withholdingRate}
                  onChange={e => setWithholdingRate(e.target.value)}
                  className={inputCls + ' bg-white'}
                >
                  <option value="3.3">3.3% (사업소득)</option>
                  <option value="8.8">8.8% (기타소득)</option>
                  <option value="0">0% (면세)</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  사업소득 3.3% 적용이 일반적입니다.
                </p>
              </Field>

              <div className="col-span-full rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
                💡 수당은 크루즈닷몰 상품별 설정에 따라 자동 적용됩니다.
              </div>
            </div>
          </div>

          {/* ── 계약 정보 ── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <SectionTitle>계약 정보</SectionTitle>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="보증인 이름">
                <input
                  type="text"
                  value={guarantorName}
                  onChange={e => setGuarantorName(e.target.value)}
                  placeholder="선택 사항"
                  className={inputCls}
                />
              </Field>

              <Field label="보증인">
                <input
                  type="number"
                  value={guarantorId}
                  onChange={e => setGuarantorId(e.target.value)}
                  placeholder="선택 사항 — 숫자 ID"
                  className={inputCls}
                />
              </Field>

              <Field label="랜딩 주소 (선택)">
                <input
                  type="text"
                  value={landingSlug}
                  onChange={e => setLandingSlug(e.target.value)}
                  placeholder="예: hong-gildong (영문·숫자·하이픈, 선택)"
                  className={inputCls}
                />
                <p className="text-xs text-gray-400 mt-1">
                  크루즈닷 랜딩페이지 슬러그 (비워두면 서버가 자동 설정)
                </p>
              </Field>

              <Field label="계약 서명일">
                <input
                  type="datetime-local"
                  value={contractSignedAt}
                  onChange={e => setContractSignedAt(e.target.value)}
                  className={inputCls}
                />
                <p className="text-xs text-gray-400 mt-1">
                  계약서에 서명한 일시를 입력하세요 (선택).
                </p>
              </Field>

              <Field label="계약 서명">
                <input
                  type="text"
                  value={contractSignature}
                  onChange={e => setContractSignature(e.target.value)}
                  placeholder="예: 홍길동 (텍스트 서명) 또는 계약서 ID"
                  className={inputCls}
                />
              </Field>

              <Field label="계약 버전">
                <input
                  type="text"
                  value={contractVersion}
                  onChange={e => setContractVersion(e.target.value)}
                  placeholder="예: v1.0"
                  className={inputCls}
                />
              </Field>

              {needsManager && (
                <Field label="소속 대리점장">
                  {managersLoading ? (
                    <div className={inputCls + ' flex items-center gap-2 text-gray-400'}>
                      <Loader2 size={14} className="animate-spin" />
                      대리점장 목록 불러오는 중...
                    </div>
                  ) : (
                    <select
                      value={managerProfileId}
                      onChange={e =>
                        setManagerProfileId(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                      }
                      className={inputCls + ' bg-white'}
                    >
                      <option value="">— 선택 안함 —</option>
                      {managers.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.displayName || m.name} ({m.mallUserId})
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    SALES_AGENT / PRE_SALES는 소속 대리점장을 지정할 수 있습니다.
                  </p>
                </Field>
              )}

              <Field label="초기 비밀번호">
                <input
                  type="text"
                  value={initialPassword}
                  onChange={e => setInitialPassword(e.target.value)}
                  placeholder="기본값: 1101"
                  className={inputCls}
                />
                <p className="text-xs text-gray-400 mt-1">
                  비워두면 &quot;1101&quot;로 설정됩니다.
                </p>
              </Field>
            </div>
          </div>

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold text-sm transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                발급 중...
              </>
            ) : (
              '어필리에이트 발급'
            )}
          </button>
        </form>
      )}
    </>
  );
}

/* ─────────────── Tab: 발급 목록 ─────────────── */

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '활성',
  INACTIVE: '비활성',
  SUSPENDED: '정지',
};

const CONTRACT_LABELS: Record<string, string> = {
  PENDING: '대기',
  SIGNED: '서명완료',
  EXPIRED: '만료',
};

function AffiliateListTab() {
  const [profiles, setProfiles] = useState<AffiliateProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('ACTIVE');
  const [q, setQ] = useState('');
  const qRef = useRef(q);
  const [resetLoadingId, setResetLoadingId] = useState<number | null>(null);
  const [resetMsg, setResetMsg] = useState<{ id: number; msg: string; ok: boolean } | null>(null);
  const resetMsgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [statusChangeLoadingId, setStatusChangeLoadingId] = useState<number | null>(null);
  const [statusChangeMsg, setStatusChangeMsg] = useState<{ id: number; msg: string; ok: boolean } | null>(null);
  const statusMsgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    qRef.current = q;
  }, [q]);

  useEffect(() => {
    return () => {
      if (resetMsgTimerRef.current !== null) clearTimeout(resetMsgTimerRef.current);
      if (statusMsgTimerRef.current !== null) clearTimeout(statusMsgTimerRef.current);
    };
  }, []);

  const fetchList = useCallback(async (signal?: AbortSignal, cursorId?: number) => {
    if (cursorId) {
      setLoadingMore(true);
    } else {
      setListLoading(true);
      setProfiles([]);
    }
    setListError(null);
    try {
      const params = new URLSearchParams({ limit: '20' });
      if (filterType) params.set('type', filterType);
      if (filterStatus) params.set('status', filterStatus);
      if (qRef.current.trim()) params.set('q', qRef.current.trim());
      if (cursorId) params.set('cursor', String(cursorId));

      const res = await fetch(`/api/affiliate-issuance?${params.toString()}`, { signal });
      const data = await res.json();
      if (!res.ok) {
        setListError(data.error ?? `오류 발생 (${res.status})`);
        return;
      }
      const newProfiles: AffiliateProfile[] = data.profiles ?? [];
      setProfiles(prev => cursorId ? [...prev, ...newProfiles] : newProfiles);
      setTotal(data.total ?? 0);
      setNextCursor(data.nextCursor ?? null);
      setHasNextPage(data.hasNextPage ?? false);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setListError('네트워크 오류가 발생했습니다.');
    } finally {
      setListLoading(false);
      setLoadingMore(false);
    }
  }, [filterType, filterStatus]);

  useEffect(() => {
    const controller = new AbortController();
    fetchList(controller.signal);
    return () => controller.abort();
  }, [fetchList]);

  const isFirstSearchRender = useRef(true);
  useEffect(() => {
    if (isFirstSearchRender.current) { isFirstSearchRender.current = false; return; }
    const timer = setTimeout(() => { fetchList(); }, 300);
    return () => clearTimeout(timer);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleResetPassword(profile: AffiliateProfile) {
    const ok = window.confirm(
      `"${profile.displayName || profile.name}" (${profile.mallUserId}) 의 비밀번호를 초기화하시겠습니까?\n초기 비밀번호: 1101`
    );
    if (!ok) return;

    setResetLoadingId(profile.id);
    setResetMsg(null);
    try {
      const res = await fetch(`/api/affiliate-issuance/${profile.id}/reset-password`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        setResetMsg({ id: profile.id, msg: data.error ?? '초기화 실패', ok: false });
      } else {
        setResetMsg({ id: profile.id, msg: '비밀번호가 초기화되었습니다 (1101)', ok: true });
      }
    } catch {
      setResetMsg({ id: profile.id, msg: '네트워크 오류', ok: false });
    } finally {
      setResetLoadingId(null);
      if (resetMsgTimerRef.current !== null) clearTimeout(resetMsgTimerRef.current);
      resetMsgTimerRef.current = setTimeout(() => setResetMsg(null), 4000);
    }
  }

  async function handleStatusChange(profile: AffiliateProfile, newStatus: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') {
    const labels: Record<string, string> = { ACTIVE: '활성', INACTIVE: '비활성', SUSPENDED: '정지' };
    const ok = window.confirm(
      `"${profile.displayName || profile.name}" 상태를 "${labels[newStatus]}"로 변경하시겠습니까?`
    );
    if (!ok) return;

    setStatusChangeLoadingId(profile.id);
    setStatusChangeMsg(null);
    try {
      const res = await fetch(`/api/affiliate-issuance/${profile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusChangeMsg({ id: profile.id, msg: data.error ?? '변경 실패', ok: false });
      } else {
        setStatusChangeMsg({ id: profile.id, msg: `"${labels[newStatus]}"으로 변경되었습니다`, ok: true });
        fetchList();
      }
    } catch {
      setStatusChangeMsg({ id: profile.id, msg: '네트워크 오류', ok: false });
    } finally {
      setStatusChangeLoadingId(null);
      if (statusMsgTimerRef.current !== null) clearTimeout(statusMsgTimerRef.current);
      statusMsgTimerRef.current = setTimeout(() => setStatusChangeMsg(null), 4000);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  return (
    <div className="space-y-4">
      {/* 필터 바 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className={inputCls + ' bg-white min-w-[160px]'}
        >
          <option value="">역할 전체</option>
          {(Object.keys(TYPE_LABELS) as AffiliateType[]).map(k => (
            <option key={k} value={k}>
              {TYPE_LABELS[k]}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className={inputCls + ' bg-white min-w-[120px]'}
        >
          <option value="">상태 전체</option>
          {Object.entries(STATUS_LABELS).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>

        {filterStatus === 'ACTIVE' && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
            활성 계정만 표시 중
          </span>
        )}

        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchList()}
            placeholder="이름, 표시명, 코드 검색…"
            className={inputCls + ' pl-8 w-full'}
          />
        </div>

        <button
          onClick={() => fetchList()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition"
        >
          <RefreshCw size={14} />
          새로고침
        </button>
      </div>

      {/* 토스트 메시지 */}
      {resetMsg && (
        <div
          className={`rounded-xl px-4 py-3 text-sm flex items-center gap-2 ${
            resetMsg.ok
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {resetMsg.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {resetMsg.msg}
        </div>
      )}

      {/* 상태변경 토스트 */}
      {statusChangeMsg && (
        <div
          className={`rounded-xl px-4 py-3 text-sm flex items-center gap-2 ${
            statusChangeMsg.ok
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {statusChangeMsg.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {statusChangeMsg.msg}
        </div>
      )}

      {/* 에러 */}
      {listError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-2">
          <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={16} />
          <p className="text-sm text-red-700">{listError}</p>
        </div>
      )}

      {/* 테이블 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {listLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">목록 불러오는 중...</span>
          </div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            조건에 맞는 어필리에이트가 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">역할</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">이름 / 표시명</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">로그인ID</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">코드</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">상태</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">계약</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">생성일</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">작업</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p, idx) => (
                  <tr
                    key={p.id}
                    className={`border-b border-gray-100 hover:bg-gray-50 transition ${
                      idx % 2 === 0 ? '' : 'bg-gray-50/50'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          TYPE_BADGE[p.type] ?? 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {TYPE_LABELS[p.type as AffiliateType] ?? p.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{p.displayName || p.name || '-'}</div>
                      {p.displayName && (
                        <div className="text-xs text-gray-400">{p.name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{p.mallUserId}</td>
                    <td className="px-4 py-3 font-mono text-xs text-blue-700">{p.affiliateCode}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-700'
                            : p.status === 'SUSPENDED'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {p.contractStatus ? (CONTRACT_LABELS[p.contractStatus] ?? p.contractStatus) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {formatDate(p.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => handleResetPassword(p)}
                          disabled={resetLoadingId === p.id}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-50 text-xs transition whitespace-nowrap"
                        >
                          {resetLoadingId === p.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <RefreshCw size={12} />
                          )}
                          비밀번호 초기화
                        </button>

                        <select
                          value={p.status}
                          disabled={statusChangeLoadingId === p.id}
                          onChange={e =>
                            handleStatusChange(p, e.target.value as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED')
                          }
                          className="text-xs border border-gray-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition"
                        >
                          <option value="ACTIVE">활성</option>
                          <option value="INACTIVE">비활성</option>
                          <option value="SUSPENDED">정지</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!listLoading && profiles.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {profiles.length}명 표시 / 전체 {total}명
            </span>
            {hasNextPage && (
              <button
                onClick={() => fetchList(undefined, nextCursor ?? undefined)}
                disabled={loadingMore}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition"
              >
                {loadingMore ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ChevronDown size={14} />
                )}
                다음 20개
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────── Page ─────────────── */

type Tab = 'issue' | 'list';

export default function AffiliateIssuancePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('issue');
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) {
          router.replace('/');
          return;
        }
        const ctx = await res.json();
        if (ctx.role !== 'GLOBAL_ADMIN') {
          router.replace('/');
          return;
        }
        setAuthChecked(true);
      } catch {
        router.replace('/');
      }
    };
    checkAuth();
  }, [router]);

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin"
          className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-500"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">어필리에이트 발급</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            어필리에이트 계정 생성 및 관리 (관리자 전용)
          </p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-gray-200 mb-5">
        {([
          { key: 'issue', label: '발급하기' },
          { key: 'list', label: '발급 목록' },
        ] as { key: Tab; label: string }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 컨텐츠 */}
      {activeTab === 'issue' ? (
        <div className="max-w-2xl">
          <IssuanceForm />
        </div>
      ) : (
        <AffiliateListTab />
      )}
    </div>
  );
}
