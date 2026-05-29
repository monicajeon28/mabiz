'use client';

/**
 * ContractApproveModal
 * 관리자(GLOBAL_ADMIN)가 대리점 계약을 승인하는 모달
 *
 * 기능:
 * - 계약자 정보 표시 (이름/이메일/연락처)
 * - 가격 티어 선택 (BASIC/STANDARD/PREMIUM)
 * - 승인 후 결과 표시 (어필리에이트 코드/링크) — 비밀번호는 SMS 발송
 */

import { useState, useEffect } from 'react';
import { CONTRACT_PRICE_TIERS, type PriceTierKey } from '@/lib/affiliate/priceTiers';

interface ContractInfo {
  contractId: number;
  status: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  isApproved: boolean;
  tier: { label: string; amount: number } | null;
  approvedAt: string | null;
  links: { managerCode: string; agentCode: string } | null;
}

interface ApproveResult {
  contractId: number;
  tier: { key: string; label: string; amount: number };
  manager: { gmUserId: number; crmMemberId: string; affiliateCode: string; linkCode: string; linkUrl: string };
  agent: { gmUserId: number; affiliateCode: string; linkCode: string; linkUrl: string };
  smsSent: boolean;
}

interface Props {
  contractId: number;
  onClose: () => void;
  onApproved?: (result: ApproveResult) => void;
}

export default function ContractApproveModal({ contractId, onClose, onApproved }: Props) {
  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null);
  const [selectedTier, setSelectedTier] = useState<PriceTierKey>('SALES_330');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ApproveResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // 계약 정보 로드
  useEffect(() => {
    fetch(`/api/affiliate/contracts/${contractId}/approve`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setContractInfo(data.data);
        else setError(data.message || '계약 정보를 불러올 수 없습니다.');
      })
      .catch(() => setError('네트워크 오류가 발생했습니다.'))
      .finally(() => setIsLoading(false));
  }, [contractId]);

  const handleApprove = async () => {
    if (!contractInfo) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/affiliate/contracts/${contractId}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: CONTRACT_PRICE_TIERS[selectedTier].priceKRW }),
      });
      const data = await res.json();

      if (data.ok) {
        setResult(data.data);
        onApproved?.(data.data);
      } else {
        setError(data.message || '계약 승인에 실패했습니다.');
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const tierInfo = CONTRACT_PRICE_TIERS[selectedTier];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {result ? '계약 승인 완료' : '대리점 계약 승인'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5">
          {/* 로딩 */}
          {isLoading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          )}

          {/* 에러 */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* 승인 성공 결과 */}
          {result && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 font-medium text-sm">
                  ✓ 계약이 승인되었습니다.
                  {result.smsSent
                    ? ' 임시 비밀번호가 SMS로 발송되었습니다.'
                    : ' (SMS 미발송 — 연락처 없음)'}
                </p>
              </div>

              {/* 대리점장 정보 */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">대리점장 계정</h3>
                <div className="space-y-2">
                  <ResultRow
                    label="어필리에이트 코드"
                    value={result.manager.affiliateCode}
                    onCopy={() => copyToClipboard(result.manager.affiliateCode, 'mgr-code')}
                    copied={copied === 'mgr-code'}
                  />
                  <ResultRow
                    label="추적 링크"
                    value={result.manager.linkUrl}
                    onCopy={() => copyToClipboard(result.manager.linkUrl, 'mgr-link')}
                    copied={copied === 'mgr-link'}
                  />
                  <div className="text-xs text-gray-500">
                    CRM 멤버 ID: {result.manager.crmMemberId}
                  </div>
                </div>
              </div>

              {/* 판매원 정보 */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">판매원 계정</h3>
                <div className="space-y-2">
                  <ResultRow
                    label="어필리에이트 코드"
                    value={result.agent.affiliateCode}
                    onCopy={() => copyToClipboard(result.agent.affiliateCode, 'agt-code')}
                    copied={copied === 'agt-code'}
                  />
                  <ResultRow
                    label="추적 링크"
                    value={result.agent.linkUrl}
                    onCopy={() => copyToClipboard(result.agent.linkUrl, 'agt-link')}
                    copied={copied === 'agt-link'}
                  />
                </div>
              </div>

              <p className="text-xs text-gray-400">
                비밀번호는 보안상 여기에 표시되지 않습니다. SMS로만 전달됩니다.
              </p>

              <button
                onClick={onClose}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                닫기
              </button>
            </div>
          )}

          {/* 승인 폼 */}
          {!isLoading && !result && contractInfo && (
            <div className="space-y-5">
              {/* 계약자 정보 */}
              <div className="p-4 bg-gray-50 rounded-lg space-y-1.5">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  계약자 정보
                </h3>
                <InfoRow label="이름" value={contractInfo.name} />
                <InfoRow label="이메일" value={contractInfo.email} />
                <InfoRow label="연락처" value={contractInfo.phone} />
              </div>

              {/* 이미 승인된 경우 */}
              {contractInfo.isApproved && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  이미 승인된 계약입니다. (승인일: {contractInfo.approvedAt
                    ? new Date(contractInfo.approvedAt).toLocaleDateString('ko-KR')
                    : '-'})
                </div>
              )}

              {/* 가격 티어 선택 */}
              {!contractInfo.isApproved && (
                <>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3">계약 등급 선택</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.keys(CONTRACT_PRICE_TIERS) as PriceTierKey[]).map((key) => {
                        const tier = CONTRACT_PRICE_TIERS[key];
                        const isSelected = selectedTier === key;
                        return (
                          <button
                            key={key}
                            onClick={() => setSelectedTier(key)}
                            className={`p-3 rounded-lg border-2 text-left transition-all ${
                              isSelected
                                ? 'border-blue-600 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className={`text-xs font-semibold mb-1 ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
                              {tier.label}
                            </div>
                            <div className={`text-sm font-bold mt-1 ${isSelected ? 'text-blue-600' : 'text-gray-900'}`}>
                              {(tier.priceKRW / 10_000).toLocaleString()}만원
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 선택 요약 */}
                  <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                    <span className="font-medium">{tierInfo.label}</span> 승인 시 자동 생성됩니다:
                    <ul className="mt-1.5 space-y-0.5 text-blue-700 text-xs">
                      <li>• 대리점장 GMcruise 포털 계정 + CRM 관리 계정</li>
                      <li>• 판매원 GMcruise 포털 계정</li>
                      <li>• 어필리에이트 링크 (대리점장/판매원 각 1개)</li>
                      <li>• 임시 비밀번호 SMS 발송 ({contractInfo.phone || '연락처 없음'})</li>
                    </ul>
                  </div>

                  {/* 승인 버튼 */}
                  <button
                    onClick={handleApprove}
                    disabled={isSubmitting}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSubmitting ? '처리 중...' : `${tierInfo.label} 계약 승인`}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 내부 컴포넌트 ───────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex text-sm">
      <span className="w-16 text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900 font-medium">{value || '-'}</span>
    </div>
  );
}

function ResultRow({
  label,
  value,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-28 text-gray-500 shrink-0">{label}</span>
      <span className="flex-1 font-mono text-xs bg-gray-100 px-2 py-1 rounded truncate">
        {value}
      </span>
      <button
        onClick={onCopy}
        className="shrink-0 text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
      >
        {copied ? '✓' : '복사'}
      </button>
    </div>
  );
}
