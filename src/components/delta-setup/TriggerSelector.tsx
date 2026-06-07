'use client';

import { cn } from '@/lib/utils';

/**
 * Delta SMS TriggerSelector Component
 *
 * Step 1: 트리거 타입 선택
 * 구매 후 (PURCHASE) 또는 장바구니 이탈 (ABANDONED) 중 선택
 */

interface TriggerSelectorProps {
  value: 'PURCHASE' | 'ABANDONED' | null;
  onChange: (value: 'PURCHASE' | 'ABANDONED') => void;
}

export default function TriggerSelector({
  value,
  onChange,
}: TriggerSelectorProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          Step 1: 트리거 선택
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          어떤 상황에서 메시지를 보낼까요?
        </p>
      </div>

      <div className="space-y-4">
        {/* PURCHASE 옵션 */}
        <label className="block">
          <div className={cn(
            "flex items-start gap-4 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition",
            value === 'PURCHASE'
              ? "border-blue-500 bg-blue-50"
              : "border-gray-200 bg-white"
          )}>
            <input
              type="radio"
              name="trigger"
              value="PURCHASE"
              checked={value === 'PURCHASE'}
              onChange={(e) => onChange(e.target.value as 'PURCHASE' | 'ABANDONED')}
              className="w-5 h-5 mt-1"
              aria-label="구매 후 메시지 (PURCHASE)"
            />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">구매 후 (PURCHASE)</h3>
              <p className="text-sm text-gray-600 mt-1">
                고객이 렌탈을 예약한 직후 자동 메시지를 보내는 방식입니다.
                구매 당일부터 4일에 걸쳐 순차적으로 메시지가 발송됩니다.
              </p>
            </div>
          </div>
        </label>

        {/* ABANDONED 옵션 */}
        <label className="block opacity-50 pointer-events-none">
          <div className="flex items-start gap-4 p-4 border-2 border-gray-200 rounded-lg bg-gray-50">
            <input
              type="radio"
              name="trigger"
              value="ABANDONED"
              disabled
              className="w-5 h-5 mt-1"
            />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-500">장바구니 이탈 (ABANDONED)</h3>
              <p className="text-sm text-gray-500 mt-1">
                예약했으나 미완료된 고객을 대상으로 자동 메시지를 보냅니다.
                (향후 기능, 현재 비활성화)
              </p>
            </div>
          </div>
        </label>
      </div>

      {/* 미선택 시 안내 문구 */}
      {value === null && (
        <p className="text-sm text-red-500 font-medium" role="alert">
          트리거 유형을 선택해주세요.
        </p>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          💡 <strong>추천</strong>: 대부분의 렌탈 캠페인은 구매 후 메시지가 가장 효과적입니다.
        </p>
      </div>
    </div>
  );
}
