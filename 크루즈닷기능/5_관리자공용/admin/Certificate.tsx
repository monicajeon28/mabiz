'use client';

interface CertificateProps {
  type: 'purchase' | 'refund';
}

/**
 * 인증서 컴포넌트 (구매/환불 공용)
 * TODO: 실제 구현 예정
 */
export default function Certificate({ type }: CertificateProps) {
  return (
    <div className="p-6">
      <div className="text-center text-gray-500">
        {type === 'purchase' ? '구매확인증서' : '환불인증서'} 컴포넌트 (구현 예정)
      </div>
    </div>
  );
}

