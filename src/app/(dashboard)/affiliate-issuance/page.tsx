'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, CheckCircle, AlertCircle, Copy, Check } from 'lucide-react';

type AffiliateType = 'BRANCH_MANAGER' | 'SALES_AGENT' | 'PRE_SALES' | 'HQ';

const TYPE_LABELS: Record<AffiliateType, string> = {
  BRANCH_MANAGER: '대리점장 (BRANCH_MANAGER)',
  SALES_AGENT: '판매원 (SALES_AGENT)',
  PRE_SALES: '프리세일즈 (PRE_SALES)',
  HQ: '본사 (HQ)',
};

type IssuanceResult = {
  mallUserId: string;
  affiliateCode: string;
  profileId: string;
  displayName: string;
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 mt-6 first:mt-0">
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

export default function AffiliateIssuancePage() {
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
  const [agentCommissionRate, setAgentCommissionRate] = useState('');
  const [guarantorName, setGuarantorName] = useState('');
  const [managerProfileId, setManagerProfileId] = useState('');
  const [initialPassword, setInitialPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IssuanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const needsManager = type === 'SALES_AGENT' || type === 'PRE_SALES';

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
        agentCommissionRate: agentCommissionRate
          ? parseInt(agentCommissionRate, 10)
          : undefined,
        guarantorName: guarantorName.trim() || undefined,
        managerProfileId:
          needsManager && managerProfileId.trim()
            ? parseInt(managerProfileId.trim(), 10)
            : undefined,
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
    setAgentCommissionRate('');
    setGuarantorName('');
    setManagerProfileId('');
    setInitialPassword('');
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6">
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
            새 어필리에이트 계정을 생성합니다 (GLOBAL_ADMIN 전용)
          </p>
        </div>
      </div>

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
                <span className="font-mono font-semibold text-gray-900">
                  {result.mallUserId}
                </span>
                <button
                  onClick={() => handleCopy(result.mallUserId)}
                  className="text-gray-400 hover:text-gray-700 transition"
                >
                  {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
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
                  onClick={() => handleCopy(result.affiliateCode)}
                  className="text-gray-400 hover:text-gray-700 transition"
                >
                  {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-green-200">
              <span className="text-gray-500">Profile ID</span>
              <span className="font-mono text-xs text-gray-600">{result.profileId}</span>
            </div>

            <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-green-200">
              <span className="text-gray-500">표시명</span>
              <span className="text-gray-900">{result.displayName}</span>
            </div>
          </div>

          <p className="text-xs text-green-700 mt-3">
            초기 비밀번호: {initialPassword.trim() || '1101'} — 첫 로그인 후 변경을 안내해 주세요.
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
              <Field label="역할 (type)" required>
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

              <Field label="이름 (name)" required>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="홍길동"
                  className={inputCls}
                />
              </Field>

              <Field label="표시명 (displayName)">
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="예: 홍대리점장"
                  className={inputCls}
                />
              </Field>

              <Field label="닉네임 (nickname)">
                <input
                  type="text"
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  placeholder="예: hong"
                  className={inputCls}
                />
              </Field>

              <Field label="연락처 (contactPhone)">
                <input
                  type="text"
                  value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  className={inputCls}
                />
              </Field>

              <Field label="이메일 (contactEmail)">
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
              <Field label="은행명 (bankName)">
                <input
                  type="text"
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  placeholder="예: 국민은행"
                  className={inputCls}
                />
              </Field>

              <Field label="계좌번호 (bankAccount)">
                <input
                  type="text"
                  value={bankAccount}
                  onChange={e => setBankAccount(e.target.value)}
                  placeholder="계좌번호 (- 없이)"
                  className={inputCls}
                />
              </Field>

              <Field label="예금주 (bankAccountHolder)">
                <input
                  type="text"
                  value={bankAccountHolder}
                  onChange={e => setBankAccountHolder(e.target.value)}
                  placeholder="예금주명"
                  className={inputCls}
                />
              </Field>

              <Field label="원천징수율 % (withholdingRate)">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={withholdingRate}
                  onChange={e => setWithholdingRate(e.target.value)}
                  placeholder="3.3"
                  className={inputCls}
                />
              </Field>

              <Field label="수당율 % (agentCommissionRate)">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={agentCommissionRate}
                  onChange={e => setAgentCommissionRate(e.target.value)}
                  placeholder="선택 — 비워두면 기본값 적용"
                  className={inputCls}
                />
              </Field>
            </div>
          </div>

          {/* ── 계약 정보 ── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <SectionTitle>계약 정보</SectionTitle>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="보증인 이름 (guarantorName)">
                <input
                  type="text"
                  value={guarantorName}
                  onChange={e => setGuarantorName(e.target.value)}
                  placeholder="선택 사항"
                  className={inputCls}
                />
              </Field>

              {needsManager && (
                <Field label="소속 대리점장 Profile ID (managerProfileId)">
                  <input
                    type="text"
                    value={managerProfileId}
                    onChange={e => setManagerProfileId(e.target.value)}
                    placeholder="대리점장 Profile ID 입력"
                    className={inputCls}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    SALES_AGENT / PRE_SALES는 소속 대리점장 지정 가능 (추후 검색 기능 추가 예정)
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
    </div>
  );
}
