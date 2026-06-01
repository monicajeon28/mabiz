'use client';

import { useState } from 'react';
import { X, Phone, CheckCircle } from 'lucide-react';
import { showError } from '@/components/ui/Toast';

interface TripleChoiceCTAProps {
  groupId: string;
  groupName: string;
  onDecline?: () => void;
  onConsult?: () => void;
  onApply?: (action: 'apply') => void;
  isLoading?: boolean;
}

/**
 * L10 렌즈 - 3중선택 CTA (즉시구매 클로징)
 *
 * 심리학 원리:
 * 1. False Choice: 3개 선택지로 거부가 불가능한 것처럼 느낌
 * 2. Action Bias: 선택하지 않는 것보다 선택하는 것이 심리적으로 편함
 * 3. Commitment & Consistency: 선택 후 일관성 유지 → 취소율 감소
 *
 * 버튼별 용도:
 * - "관심없음": 거부 옵션 (실제로는 모달 → "상담받기"로 유도)
 * - "상담받기": 준비 덜 된 고객 → 낮은 진입 장벽
 * - "지금 신청": 즉시 결정 가능 고객 → 충동 구매 심리
 */
export function TripleChoiceCTA({
  groupId,
  groupName,
  onDecline,
  onConsult,
  onApply,
  isLoading = false,
}: TripleChoiceCTAProps) {
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  const handleDeclineClick = () => {
    // L10 기법: 거부 옵션이 있다는 착각 → 실제로는 재확인 모달로 유도
    setShowDeclineModal(true);
  };

  const handleConfirmDecline = async () => {
    try {
      // CRM: 거절 기록
      await fetch(`/api/groups/${groupId}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: declineReason }),
      }).catch(() => {
        // 실패해도 계속 진행
      });

      setShowDeclineModal(false);
      onDecline?.();
    } catch (err) {
      console.error('Decline request failed:', err);
      showError('요청 처리 중 오류가 발생했습니다.');
    }
  };

  const handleConsultClick = async () => {
    try {
      // CRM: 상담 신청 기록
      const res = await fetch(`/api/groups/${groupId}/consult-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'consult' }),
      });

      const data = await res.json();
      if (data.ok) {
        onConsult?.();
      } else {
        showError(data.message || '상담 신청에 실패했습니다.');
      }
    } catch (err) {
      console.error('Consult request failed:', err);
      showError('요청 처리 중 오류가 발생했습니다.');
    }
  };

  return (
    <>
      <div className="space-y-6 my-8">
        {/* 심리학 브릿지: 모든 선택이 환영받는다는 메시지 */}
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-700 mb-4">
            어느 선택이든 우리가 100% 준비하겠습니다. 👨‍👩‍👧‍👦
          </p>
        </div>

        {/* L10 3중선택 버튼 (모바일: 스택, 데스크톱: 3열) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 버튼 1: 거부 옵션 (약한 톤) - False Choice 원리 */}
          <button
            onClick={handleDeclineClick}
            disabled={isLoading}
            className="px-4 py-3 border-2 border-gray-300 bg-white rounded-lg text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50 min-h-[120px] flex flex-col items-center justify-center"
            aria-label="관심없음 선택"
          >
            <div className="text-2xl mb-2">❌</div>
            <div className="font-semibold text-sm">관심없음</div>
            <div className="text-sm text-gray-600 mt-1">(여기서 떠나기)</div>
          </button>

          {/* 버튼 2: 중간 선택 (주의 톤) - Action Bias 원리 */}
          <button
            onClick={handleConsultClick}
            disabled={isLoading}
            className="px-4 py-3 border-2 border-blue-400 bg-blue-50 rounded-lg text-blue-700 hover:bg-blue-100 hover:border-blue-500 transition-all disabled:opacity-50 min-h-[120px] flex flex-col items-center justify-center"
            aria-label="상담받기 선택"
          >
            <div className="text-2xl mb-2">⚪</div>
            <div className="font-semibold text-sm">상담받기</div>
            <div className="text-sm text-blue-600 mt-1">(전문가 도움)</div>
          </button>

          {/* 버튼 3: 최고 선택 (강조 톤 - PRIMARY) - Commitment & Consistency */}
          <button
            onClick={() => onApply?.('apply')}
            disabled={isLoading}
            className="px-4 py-3 border-2 border-green-500 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg font-bold hover:from-green-600 hover:to-green-700 active:scale-95 transition-all disabled:opacity-50 min-h-[120px] flex flex-col items-center justify-center shadow-lg hover:shadow-xl"
            aria-label="지금 신청 선택"
          >
            <div className="text-2xl mb-2">✅</div>
            <div className="font-semibold text-sm">지금 신청</div>
            <div className="text-sm text-green-100 mt-1">(즉시 시작)</div>
          </button>
        </div>

        {/* 신뢰 브리지: 보장 메시지 */}
        <div className="text-center text-sm text-gray-500">
          <p>언제든 플랜 변경 가능 • 30일 환불 보장</p>
        </div>
      </div>

      {/* 거부 재확인 모달 */}
      {showDeclineModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <X className="w-5 h-5 text-red-500" />
              <h3 className="font-bold text-gray-900">정말 관심 없으신가요?</h3>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              {groupName}은(는) 많은 분들이 만족하고 계신 프로그램입니다.
              한 번 더 생각해보시거나 전문가와 이야기해보시는 건 어떨까요?
            </p>

            {/* 거절 사유 선택 */}
            <div className="space-y-2 mb-6">
              {[
                '가격이 너무 높아요',
                '준비가 덜 된 것 같아요',
                '일정이 맞지 않아요',
                '기타 사유',
              ].map((reason) => (
                <label key={reason} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="decline-reason"
                    value={reason}
                    checked={declineReason === reason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">{reason}</span>
                </label>
              ))}
            </div>

            {/* 액션 버튼 */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeclineModal(false);
                  setDeclineReason('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-all"
              >
                돌아가기
              </button>
              <button
                onClick={() => {
                  // 상담받기로 유도
                  setShowDeclineModal(false);
                  handleConsultClick();
                }}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4" />
                상담받기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
