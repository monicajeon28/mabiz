// components/admin/RefundCalculatorModal.tsx
// 환불 금액 계산기 독립 모달 — RefundPolicyEditor에서 분리

'use client';

import { useState, useMemo, useEffect } from 'react';
import { FiX, FiAlertTriangle } from 'react-icons/fi';
import { calcRefundAmount } from '@/lib/mall/refund-calculator';
import type { RefundPolicyJson } from '@/lib/mall/refund-calculator';
import {
  refundConfirmInputSchema,
  refundConfirmResultSchema,
} from '@/lib/schemas/refund-calculator-schema';

export interface RefundCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: {
    customerName?: string;
    totalAmount?: number;
    departureDate?: string; // ISO date string 'YYYY-MM-DD'
    refundPolicyJson?: RefundPolicyJson | null;
  };
  onConfirm?: (result: {
    refundAmount: number;
    penaltyAmount: number;
    penaltyRate: number;
    reason: string;
  }) => Promise<void>;
}

// 취소 기준일 입력 실시간 검증용 내부 타입
interface ValidationErrors {
  cancelDate?: string;
  reason?: string;
}

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function RefundCalculatorModal({
  isOpen,
  onClose,
  initialData,
  onConfirm,
}: RefundCalculatorModalProps) {
  const [cancelDate, setCancelDate] = useState<string>(getTodayString);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  // 모달 열릴 때마다 state 초기화
  useEffect(() => {
    if (isOpen) {
      setCancelDate(getTodayString());
      setReason('');
      setIsSubmitting(false);
      setValidationErrors({});
    }
  }, [isOpen]);

  // 환불 금액 계산 (useMemo — cancelDate 또는 initialData 변경 시 재계산)
  const calcResult = useMemo(() => {
    if (!initialData?.totalAmount || !initialData?.departureDate) return null;
    const depDate = new Date(initialData.departureDate);
    return calcRefundAmount(
      initialData.totalAmount,
      depDate,
      initialData.refundPolicyJson ?? null,
      new Date(cancelDate),
    );
  }, [initialData, cancelDate]);

  // isOpen false면 DOM에 마운트하지 않음
  if (!isOpen) return null;

  const hasOnConfirm = typeof onConfirm === 'function';

  // 취소 기준일 변경 시 실시간 Zod 검증
  const handleCancelDateChange = (value: string) => {
    setCancelDate(value);
    const result = refundConfirmInputSchema
      .pick({ cancelDate: true })
      .safeParse({ cancelDate: value });
    setValidationErrors((prev) => ({
      ...prev,
      cancelDate: result.success ? undefined : result.error.errors[0]?.message,
    }));
  };

  // 환불 사유 변경 시 실시간 Zod 검증
  const handleReasonChange = (value: string) => {
    setReason(value);
    const result = refundConfirmInputSchema
      .pick({ reason: true })
      .safeParse({ reason: value });
    setValidationErrors((prev) => ({
      ...prev,
      reason: result.success ? undefined : result.error.errors[0]?.message,
    }));
  };

  const hasInputErrors =
    !!validationErrors.cancelDate || !!validationErrors.reason;
  const canSubmit =
    hasOnConfirm &&
    reason.trim().length > 0 &&
    !hasInputErrors &&
    !isSubmitting;

  const handleConfirm = async () => {
    if (!hasOnConfirm || !calcResult) return;

    // 제출 직전 전체 입력값 Zod 검증 (최종 방어선)
    const inputValidation = refundConfirmInputSchema.safeParse({
      cancelDate,
      reason,
    });
    if (!inputValidation.success) {
      const fieldErrors: ValidationErrors = {};
      for (const err of inputValidation.error.errors) {
        const field = err.path[0] as keyof ValidationErrors;
        if (field) fieldErrors[field] = err.message;
      }
      setValidationErrors(fieldErrors);
      return;
    }

    // 콜백으로 전달할 결과값 Zod 검증
    const resultValidation = refundConfirmResultSchema.safeParse({
      refundAmount: calcResult.refundAmount,
      penaltyAmount: calcResult.penaltyAmount,
      penaltyRate: calcResult.penaltyRate,
      reason: inputValidation.data.reason,
    });
    if (!resultValidation.success) return;

    setIsSubmitting(true);
    try {
      await onConfirm!(resultValidation.data);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) onClose();
  };

  // 정책 기준 표시
  const policyBasis = calcResult?.basis ?? (
    initialData?.refundPolicyJson?.isStructured
      ? '상품별 환불정책'
      : '법정기준(관광진흥법 시행령)'
  );

  return (
    /* 오버레이 */
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="refund-calc-modal-title"
    >
      {/* 모달 박스 */}
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">

        {/* 헤더 */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 id="refund-calc-modal-title" className="text-lg font-bold text-gray-900">
            환불 금액 계산기
          </h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            aria-label="닫기"
          >
            <FiX size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* 고객 정보 (읽기 전용) */}
          {(initialData?.customerName || initialData?.totalAmount || initialData?.departureDate) && (
            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">결제 정보</p>
              {initialData.customerName && (
                <div className="flex justify-between">
                  <span className="text-gray-500">고객명</span>
                  <span className="font-medium text-gray-800">{initialData.customerName}</span>
                </div>
              )}
              {initialData.totalAmount !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-500">결제금액</span>
                  <span className="font-semibold text-gray-900">
                    {initialData.totalAmount.toLocaleString('ko-KR')}원
                  </span>
                </div>
              )}
              {initialData.departureDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">출발일</span>
                  <span className="font-medium text-gray-800">{initialData.departureDate}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">적용 정책</span>
                <span className="text-xs text-gray-600">{policyBasis}</span>
              </div>
            </div>
          )}

          {/* 취소 기준일 입력 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              취소 기준일
            </label>
            <input
              type="date"
              value={cancelDate}
              onChange={(e) => handleCancelDateChange(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                validationErrors.cancelDate
                  ? 'border-red-400 bg-red-50'
                  : 'border-gray-300'
              }`}
            />
            {validationErrors.cancelDate ? (
              <p className="text-xs text-red-500 mt-1">{validationErrors.cancelDate}</p>
            ) : (
              <p className="text-xs text-gray-400 mt-1">
                취소 요청 날짜를 선택하면 위약금이 자동으로 계산됩니다.
              </p>
            )}
          </div>

          {/* 계산 결과 카드 */}
          {calcResult ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">계산 결과</p>

              <div className="text-sm space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">출발까지 남은 일수</span>
                  <span className="font-semibold text-gray-800">
                    {calcResult.daysBeforeDep < 0
                      ? `출발 후 ${Math.abs(calcResult.daysBeforeDep)}일`
                      : `${calcResult.daysBeforeDep}일`}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">위약금율</span>
                  <span className="font-bold text-orange-600">{calcResult.penaltyRate}%</span>
                </div>
                <div className="h-px bg-blue-200" />
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">위약금</span>
                  <span className="font-bold text-red-600">
                    {calcResult.penaltyAmount.toLocaleString('ko-KR')}원
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-semibold">환불 금액</span>
                  <span className="text-xl font-bold text-green-600">
                    {calcResult.refundAmount.toLocaleString('ko-KR')}원
                  </span>
                </div>
              </div>

              {calcResult.appliedSlot.label && (
                <p className="text-xs text-blue-600">
                  적용 구간: {calcResult.appliedSlot.label}
                </p>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center gap-2 text-sm text-gray-500">
              <FiAlertTriangle size={16} className="text-yellow-500 shrink-0" />
              결제금액 또는 출발일 정보가 없어 계산할 수 없습니다.
            </div>
          )}

          {/* 환불 사유 (onConfirm 있을 때만 표시) */}
          {hasOnConfirm && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                환불 사유 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => handleReasonChange(e.target.value)}
                placeholder="환불 사유를 입력하세요 (필수)"
                rows={3}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400 resize-none ${
                  validationErrors.reason
                    ? 'border-red-400 bg-red-50'
                    : 'border-gray-300'
                }`}
                disabled={isSubmitting}
              />
              {validationErrors.reason && (
                <p className="text-xs text-red-500 mt-1">{validationErrors.reason}</p>
              )}
            </div>
          )}
        </div>

        {/* 버튼 영역 */}
        <div className="px-6 py-4 border-t bg-gray-50 flex gap-3 rounded-b-xl">
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 text-sm font-medium disabled:opacity-50 transition-colors"
          >
            닫기
          </button>

          {/* onConfirm 없으면 환불실행 버튼 숨김 — 순수 계산기 모드 */}
          {hasOnConfirm && (
            <button
              onClick={handleConfirm}
              disabled={!canSubmit || !calcResult}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? '처리 중...' : '환불 실행'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
