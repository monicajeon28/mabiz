'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, CheckCircle, AlertCircle, Copy, Check } from 'lucide-react';

type PartnerRole = 'BRANCH_MANAGER' | 'SALES_AGENT' | 'PRE_SALES' | 'HQ';

const ROLE_LABELS: Record<PartnerRole, string> = {
  BRANCH_MANAGER: '지사장',
  SALES_AGENT: '대리점장',
  PRE_SALES: '마케터',
  HQ: '본사',
};

type IssuanceResult = {
  mallUserId: string;
  affiliateCode: string;
  profileId: string;
  displayName: string;
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ role?: string }>;
}

export default function PartnerRegisterPage({ params, searchParams }: PageProps) {
  const router = useRouter();
  const [orgId, setOrgId] = useState('');
  const [roleParam, setRoleParam] = useState<PartnerRole | null>(null);

  // 파라미터 로드
  useEffect(() => {
    (async () => {
      const p = await params;
      const sq = await searchParams;
      setOrgId(p.id);
      const role = sq?.role as PartnerRole | undefined;
      setRoleParam(role || 'BRANCH_MANAGER');
    })();
  }, [params, searchParams]);

  const [nickname, setNickname] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  const [guarantorName, setGuarantorName] = useState('');
  const [guarantorId, setGuarantorId] = useState('');
  const [landingSlug, setLandingSlug] = useState('');
  const [contractSignature, setContractSignature] = useState('');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IssuanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/affiliate-issuance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          type: roleParam || 'BRANCH_MANAGER',
          nickname,
          contactPhone,
          contactEmail,
          bankName,
          bankAccount,
          bankAccountHolder,
          guarantorName: guarantorName || undefined,
          guarantorId: guarantorId ? parseInt(guarantorId) : undefined,
          landingSlug: landingSlug || undefined,
          contractSignature,
          withholdingRate: 3.3,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '발급 실패');
      }

      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(null), 2000);
  };

  if (!orgId || !roleParam) return null;

  if (result) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow p-6 md:p-8">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-green-100 rounded-full mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>

            <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">
              파트너 발급 완료
            </h2>
            <p className="text-center text-gray-600 mb-6">
              {result.displayName} 파트너가 정상적으로 생성되었습니다.
            </p>

            <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-3">
              <div>
                <label className="text-sm text-gray-600">Mall User ID</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 text-sm font-mono bg-white border border-gray-300 rounded px-3 py-2">
                    {result.mallUserId}
                  </code>
                  <button
                    onClick={() => handleCopy(result.mallUserId, 'mallUserId')}
                    className="p-2 text-gray-500 hover:text-gray-700"
                  >
                    {copied === 'mallUserId' ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-600">Affiliate Code</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 text-sm font-mono bg-white border border-gray-300 rounded px-3 py-2">
                    {result.affiliateCode}
                  </code>
                  <button
                    onClick={() => handleCopy(result.affiliateCode, 'affiliateCode')}
                    className="p-2 text-gray-500 hover:text-gray-700"
                  >
                    {copied === 'affiliateCode' ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-600">Profile ID</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 text-sm font-mono bg-white border border-gray-300 rounded px-3 py-2">
                    {result.profileId}
                  </code>
                  <button
                    onClick={() => handleCopy(result.profileId, 'profileId')}
                    className="p-2 text-gray-500 hover:text-gray-700"
                  >
                    {copied === 'profileId' ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Link
                href={`/admin/organizations/${orgId}`}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition text-center"
              >
                대리점으로 돌아가기
              </Link>
              <button
                onClick={() => {
                  setResult(null);
                  setNickname('');
                  setContactPhone('');
                  setContactEmail('');
                  setBankName('');
                  setBankAccount('');
                  setBankAccountHolder('');
                  setGuarantorName('');
                  setGuarantorId('');
                  setLandingSlug('');
                  setContractSignature('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition"
              >
                다음 파트너 등록
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6">
          <Link
            href={`/admin/organizations/${orgId}`}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            대리점으로 돌아가기
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">파트너 수동 등록</h1>
          <p className="text-gray-600 mt-2">
            역할: <span className="font-semibold">{ROLE_LABELS[roleParam]}</span>
          </p>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
          {error && (
            <div className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900">{error}</p>
              </div>
            </div>
          )}

          {/* 기본 정보 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">기본 정보</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  닉네임 *
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="예: hong"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    연락처 *
                  </label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="010-0000-0000"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    이메일 *
                  </label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="example@email.com"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 정산 정보 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">정산 정보</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  은행명 *
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="예: 국민은행"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    계좌번호 *
                  </label>
                  <input
                    type="text"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    placeholder="- 없이"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    예금주 *
                  </label>
                  <input
                    type="text"
                    value={bankAccountHolder}
                    onChange={(e) => setBankAccountHolder(e.target.value)}
                    placeholder="예금주명"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 계약 정보 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">계약 정보</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    보증인 이름 (선택)
                  </label>
                  <input
                    type="text"
                    value={guarantorName}
                    onChange={(e) => setGuarantorName(e.target.value)}
                    placeholder="선택 사항"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    보증인 ID (선택)
                  </label>
                  <input
                    type="number"
                    value={guarantorId}
                    onChange={(e) => setGuarantorId(e.target.value)}
                    placeholder="숫자 ID"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  랜딩 슬러그 (선택)
                </label>
                <input
                  type="text"
                  value={landingSlug}
                  onChange={(e) => setLandingSlug(e.target.value)}
                  placeholder="예: hong-gildong (영문·숫자·하이픈)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  서명 (이름) *
                </label>
                <input
                  type="text"
                  value={contractSignature}
                  onChange={(e) => setContractSignature(e.target.value)}
                  placeholder="계약서에 서명할 이름"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </section>

          {/* 버튼 */}
          <div className="flex gap-3 pt-4">
            <Link
              href={`/admin/organizations/${orgId}`}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition text-center"
            >
              취소
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? '발급 중...' : '파트너 발급'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
