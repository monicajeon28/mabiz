'use client';

import React, { useState } from 'react';
import { CONTRACT_PRICE_TIERS } from '@/lib/affiliate/contract-automation';

interface ContractFormProps {
  contractId?: number;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

export function ContractForm({ contractId, onSuccess, onError }: ContractFormProps) {
  const [selectedTier, setSelectedTier] = useState<keyof typeof CONTRACT_PRICE_TIERS>('BASIC');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const currentTier = CONTRACT_PRICE_TIERS[selectedTier];

  const handleApprove = async () => {
    if (!contractId) {
      onError?.('계약 ID가 없습니다.');
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch(
        `/api/affiliate/contracts/${contractId}/approve`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: currentTier.priceKRW,
          }),
        },
      );

      const result = await res.json();

      if (!result.ok) {
        setMessage(result.message || '오류가 발생했습니다.');
        onError?.(result.message);
        return;
      }

      setMessage('✓ 계약이 승인되었습니다!');
      onSuccess?.(result.data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '네트워크 오류';
      setMessage('✗ ' + errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-6">계약 가격 선택</h2>

      {/* 가격 선택 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {Object.entries(CONTRACT_PRICE_TIERS).map(([key, tier]) => (
          <button
            key={key}
            onClick={() => setSelectedTier(key as keyof typeof CONTRACT_PRICE_TIERS)}
            className={`p-6 rounded-lg border-2 transition-all ${
              selectedTier === key
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-300 bg-white hover:border-gray-400'
            }`}
          >
            <div className="font-bold text-lg mb-2">{tier.label}</div>
            <div className="text-2xl font-bold text-blue-600 mb-1">
              ₩{(tier.priceKRW / 1000000).toFixed(1)}M
            </div>
            <div className="text-sm text-gray-600">{tier.description}</div>
            <div className="text-xs text-gray-500 mt-2">
              수수료율: {tier.commissionRate}%
            </div>
          </button>
        ))}
      </div>

      {/* 선택된 가격 정보 */}
      <div className="bg-blue-50 p-6 rounded-lg mb-8 border border-blue-200">
        <h3 className="font-bold mb-3">선택한 계약 정보</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>계약 유형:</span>
            <span className="font-bold">{currentTier.label}</span>
          </div>
          <div className="flex justify-between">
            <span>계약금:</span>
            <span className="font-bold text-lg text-blue-600">
              ₩{(currentTier.priceKRW / 1000000).toFixed(1)}M
            </span>
          </div>
          <div className="flex justify-between">
            <span>기본 수수료율:</span>
            <span className="font-bold">{currentTier.commissionRate}%</span>
          </div>
          <div className="text-xs text-gray-600 mt-3 pt-3 border-t border-blue-200">
            자동으로 생성되는 항목:
            <ul className="list-disc list-inside mt-2">
              <li>대리점장 계정 및 프로필</li>
              <li>판매원 계정 및 프로필</li>
              <li>어필리에이트 링크</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 메시지 */}
      {message && (
        <div
          className={`p-4 rounded-lg mb-6 ${
            message.startsWith('✓')
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message}
        </div>
      )}

      {/* 버튼 */}
      <div className="flex gap-4">
        <button
          onClick={handleApprove}
          disabled={isSubmitting}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isSubmitting ? '처리 중...' : '계약 승인'}
        </button>
      </div>

      <div className="text-xs text-gray-500 mt-4 p-4 bg-gray-50 rounded-lg">
        <strong>주의:</strong> 계약을 승인하면 자동으로 대리점장, 판매원 계정이
        생성되고 어필리에이트 링크가 발급됩니다. 생성된 계정의 임시 비밀번호는
        이메일로 발송됩니다.
      </div>
    </div>
  );
}
