'use client';

/**
 * TriggerSelector Component
 * Delta SMS 마법사의 Step 1 - 트리거 타입 선택
 *
 * PURCHASE: 구매 후 자동 메시지 (활성화)
 * ABANDONED: 장바구니 이탈 (미래 예약, 현재 비활성화)
 */

interface TriggerSelectorProps {
  value: 'PURCHASE' | 'ABANDONED';
  onChange: (type: 'PURCHASE' | 'ABANDONED') => void;
}

export default function TriggerSelector({ value, onChange }: TriggerSelectorProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      {/* 헤더 */}
      <div>
        <h2 className="text-xl font-semibold">Step 1: 트리거 선택</h2>
        <p className="text-sm text-gray-600 mt-1">렌탈 SMS를 발송할 조건을 선택하세요.</p>
      </div>

      {/* 트리거 옵션 */}
      <div className="space-y-3">
        {/* Option 1: PURCHASE (활성화) */}
        <label
          className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition ${
            value === 'PURCHASE'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 bg-white hover:bg-gray-50'
          }`}
        >
          <input
            type="radio"
            name="trigger"
            value="PURCHASE"
            checked={value === 'PURCHASE'}
            onChange={() => onChange('PURCHASE')}
            className="mt-1 w-4 h-4 cursor-pointer"
          />
          <div className="flex-1">
            <p className="font-medium text-gray-900">구매 후 자동 메시지</p>
            <p className="text-sm text-gray-600 mt-1">여행 상품 구매 후 렌탈 서비스를 자동으로 추천합니다.</p>
            <div className="mt-2 flex gap-2">
              <span className="inline-block bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded">
                ✓ 활성화
              </span>
              <span className="inline-block bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
                권장
              </span>
            </div>
          </div>
        </label>

        {/* Option 2: ABANDONED (비활성화) */}
        <label
          className={`flex items-start gap-4 p-4 border rounded-lg opacity-50 cursor-not-allowed transition ${
            value === 'ABANDONED'
              ? 'border-gray-300 bg-gray-50'
              : 'border-gray-200 bg-gray-50'
          }`}
        >
          <input
            type="radio"
            name="trigger"
            value="ABANDONED"
            checked={value === 'ABANDONED'}
            onChange={() => onChange('ABANDONED')}
            disabled
            className="mt-1 w-4 h-4 cursor-not-allowed"
          />
          <div className="flex-1">
            <p className="font-medium text-gray-500">포기된 예약 복구</p>
            <p className="text-sm text-gray-500 mt-1">완성되지 않은 렌탈 예약을 완료하도록 유도합니다.</p>
            <div className="mt-2 flex gap-2">
              <span className="inline-block bg-gray-200 text-gray-700 text-xs font-medium px-2 py-1 rounded">
                미지원
              </span>
            </div>
          </div>
        </label>
      </div>

      {/* 설명 박스 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-sm text-blue-900 mb-2">트리거란?</h3>
        <p className="text-sm text-blue-800">
          SMS 발송을 자동으로 시작하는 조건입니다. "구매 후 자동 메시지"를 선택하면, 고객이 여행 상품을 구매한 직후부터
          4일에 걸쳐 렌탈 권유 메시지가 자동으로 발송됩니다.
        </p>
      </div>
    </div>
  );
}
