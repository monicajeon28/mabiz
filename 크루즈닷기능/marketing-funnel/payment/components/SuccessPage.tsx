'use client';

import Link from 'next/link';
import { designSystem, typoClasses, colorClasses } from '@/lib/design/design-system';

interface SuccessPageProps {
  orderId: string;
  productName: string;
  amount: number;
  paidAt: string;
}

export function SuccessPage({ orderId, productName, amount, paidAt }: SuccessPageProps) {
  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-0 py-12">
      {/* 성공 애니메이션 */}
      <div className="mb-8 text-center">
        <div className={`
          inline-flex items-center justify-center
          w-20 h-20 rounded-full bg-emerald-50 mb-6
          animate-bounce
        `}>
          <span className="text-5xl">✓</span>
        </div>
        <h1 className={`${typoClasses.h1} text-emerald-700 mb-3`}>
          결제가 완료되었습니다
        </h1>
        <p className={`${typoClasses.body} ${colorClasses.textSecondary}`}>
          주문이 정상적으로 처리되었습니다
        </p>
      </div>

      {/* 영수증 카드 */}
      <div className={`
        bg-white border-2 border-emerald-200 rounded-2xl
        px-6 sm:px-8 py-8 mb-8 ${designSystem.shadow.lg}
      `}>
        {/* 상단: 상품 정보 */}
        <div className="mb-6 pb-6 border-b border-neutral-200">
          <p className={`${colorClasses.textMuted} text-xs font-medium mb-2 uppercase`}>
            구매 상품
          </p>
          <h2 className={`${typoClasses.h3} text-neutral-900 mb-4`}>
            {productName}
          </h2>
          <p className={`${typoClasses.bodySmall} ${colorClasses.textSecondary}`}>
            주문번호: <code className="bg-neutral-100 px-2 py-1 rounded font-mono">{orderId}</code>
          </p>
        </div>

        {/* 결제 정보 */}
        <div className="mb-6 space-y-3">
          <div className="flex justify-between items-center">
            <span className={colorClasses.textSecondary}>결제 금액</span>
            <span className={`${typoClasses.h4} text-neutral-900`}>
              {(amount / 1000).toLocaleString()}원
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className={colorClasses.textSecondary}>결제 수단</span>
            <span className={`${typoClasses.bodySmall} font-semibold`}>신용카드</span>
          </div>
          <div className="flex justify-between items-center">
            <span className={colorClasses.textSecondary}>결제 시간</span>
            <span className={`${typoClasses.bodySmall} text-neutral-700`}>
              {new Date(paidAt).toLocaleString('ko-KR')}
            </span>
          </div>
        </div>

        {/* 상태 배지 */}
        <div className="flex items-center gap-2 bg-emerald-50 rounded-lg px-4 py-3">
          <span className="text-2xl">✓</span>
          <span className={`${typoClasses.bodySmall} font-semibold text-emerald-700`}>
            결제 완료
          </span>
        </div>
      </div>

      {/* 다음 단계 정보 */}
      <div className="bg-neutral-50 rounded-lg border border-neutral-200 px-4 sm:px-6 py-4 mb-8">
        <h3 className={`${typoClasses.h4} text-neutral-900 mb-3`}>다음 단계</h3>
        <ul className="space-y-2">
          <li className={`${typoClasses.bodySmall} ${colorClasses.textSecondary} flex gap-3`}>
            <span className="text-lg">📧</span>
            <span>확인 이메일이 발송되었습니다</span>
          </li>
          <li className={`${typoClasses.bodySmall} ${colorClasses.textSecondary} flex gap-3`}>
            <span className="text-lg">📱</span>
            <span>마이페이지에서 주문 내역을 확인하세요</span>
          </li>
          <li className={`${typoClasses.bodySmall} ${colorClasses.textSecondary} flex gap-3`}>
            <span className="text-lg">🎟️</span>
            <span>여행 이용권은 출발 7일 전에 발송됩니다</span>
          </li>
        </ul>
      </div>

      {/* CTA 버튼 */}
      <div className="grid grid-cols-2 gap-4 sm:gap-3">
        <Link
          href="/orders"
          className={`
            h-14 rounded-lg font-semibold text-center
            flex items-center justify-center
            bg-yellow-600 text-white hover:bg-yellow-700
            transition-all ${designSystem.transition.base}
            ${designSystem.shadow.md} hover:${designSystem.shadow.lg}
          `}
        >
          주문 상세
        </Link>
        <Link
          href="/products"
          className={`
            h-14 rounded-lg font-semibold text-center
            flex items-center justify-center
            bg-white border-2 border-yellow-600 text-yellow-600 hover:bg-yellow-50
            transition-all ${designSystem.transition.base}
          `}
        >
          계속 쇼핑
        </Link>
      </div>

      {/* 하단 도움말 */}
      <div className="mt-8 p-4 text-center">
        <p className={`${typoClasses.label} ${colorClasses.textMuted} mb-2`}>
          궁금한 점이 있으신가요?
        </p>
        <Link
          href="/help"
          className={`
            ${typoClasses.bodySmall} text-yellow-600 font-semibold
            hover:text-yellow-700 transition-colors
          `}
        >
          고객 지원 센터 →
        </Link>
      </div>
    </div>
  );
}
