'use client';

import { designSystem, typoClasses, colorClasses } from '@/lib/design/design-system';

interface PaymentProgressProps {
  status: 'pending' | 'processing' | 'success' | 'failed';
  orderId: string;
  amount: number;
}

export function PaymentProgress({ status, orderId, amount }: PaymentProgressProps) {
  const steps = [
    { key: 'pending', label: '결제 대기', icon: '🔄' },
    { key: 'processing', label: '처리 중', icon: '⏳' },
    { key: 'success', label: '완료', icon: '✓' },
  ];

  const getStatusConfig = () => {
    switch (status) {
      case 'success':
        return {
          bg: 'bg-emerald-50',
          border: 'border-emerald-200',
          icon: '✓',
          color: 'text-emerald-700',
          message: '결제가 완료되었습니다',
        };
      case 'failed':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          icon: '✕',
          color: 'text-red-700',
          message: '결제에 실패했습니다',
        };
      default:
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          icon: '⏳',
          color: 'text-blue-700',
          message: '결제를 진행 중입니다',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="w-full">
      {/* 진행 상태 표시 */}
      <div className="mb-8 px-4 sm:px-0">
        <div className="flex items-center justify-between">
          {steps.map((step, idx) => (
            <div key={step.key} className="flex flex-col items-center flex-1">
              {/* 동그라미 */}
              <div
                className={`
                  w-12 h-12 rounded-full flex items-center justify-center
                  transition-all ${designSystem.transition.base}
                  ${
                    status === 'success' || (status === 'processing' && idx < 2)
                      ? 'bg-yellow-600 text-white'
                      : status === 'failed' && idx === 2
                        ? 'bg-red-600 text-white'
                        : idx === steps.findIndex(s => s.key === status)
                          ? 'bg-yellow-600 text-white'
                          : 'bg-neutral-200 text-neutral-600'
                  }
                `}
              >
                <span className="text-lg font-bold">{step.icon}</span>
              </div>

              {/* 라벨 */}
              <p
                className={`
                  mt-2 text-xs font-medium tracking-wide
                  ${
                    status === 'success' || (status === 'processing' && idx < 2)
                      ? 'text-yellow-700'
                      : status === 'failed' && idx === 2
                        ? 'text-red-700'
                        : 'text-neutral-600'
                  }
                `}
              >
                {step.label}
              </p>

              {/* 연결선 */}
              {idx < steps.length - 1 && (
                <div
                  className={`
                    absolute w-12 h-1 mt-6
                    ${status === 'success' || (status === 'processing' && idx < 1) ? 'bg-yellow-600' : 'bg-neutral-200'}
                    transition-all ${designSystem.transition.base}
                  `}
                  style={{
                    left: `${(idx + 1) * 25}%`,
                    top: '24px',
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 상태 메시지 */}
      <div className={`rounded-lg border ${config.bg} ${config.border} px-4 sm:px-6 py-4 mb-6`}>
        <div className="flex items-center gap-3 mb-2">
          <span className={`text-2xl ${config.color}`}>{config.icon}</span>
          <p className={`${typoClasses.h4} ${config.color}`}>{config.message}</p>
        </div>
        <p className={`${typoClasses.bodySmall} ${colorClasses.textSecondary}`}>
          주문번호: <strong>{orderId}</strong>
        </p>
      </div>

      {/* 결제 금액 카드 */}
      <div className={`
        bg-gradient-to-br from-neutral-900 to-neutral-800
        rounded-xl ${designSystem.shadow.lg}
        px-6 py-8 text-white
      `}>
        <p className={`${colorClasses.textMuted} mb-3`}>결제 금액</p>
        <div className="flex items-baseline gap-1">
          <p className="text-4xl font-bold">{(amount / 1000).toLocaleString()}</p>
          <span className="text-xl font-semibold">원</span>
        </div>
      </div>
    </div>
  );
}
