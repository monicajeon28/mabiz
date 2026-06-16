import { Suspense } from 'react';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ orderId?: string }>;
}

async function PaymentStatus({ orderId }: { orderId: string }) {
  const payment = await prisma.payAppPayment.findFirst({
    where: { orderId },
    select: {
      status: true,
      customerName: true,
      productName: true,
      amount: true,
    },
  });

  if (!payment) {
    return (
      <div className="text-center">
        <XCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-700 mb-2">결제 정보를 찾을 수 없습니다</h1>
        <p className="text-sm text-gray-400">주문번호: {orderId}</p>
      </div>
    );
  }

  if (payment.status === 'paid') {
    return (
      <div className="text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">결제 완료!</h1>
        <p className="text-gray-600 mb-4">{payment.customerName}님, 결제가 성공적으로 완료되었습니다.</p>
        <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2">
          {payment.productName && (
            <p className="text-sm text-gray-700">
              <span className="font-medium">상품명:</span> {payment.productName}
            </p>
          )}
          {payment.amount != null && (
            <p className="text-sm text-gray-700">
              <span className="font-medium">결제금액:</span> {payment.amount.toLocaleString()}원
            </p>
          )}
          <p className="text-xs text-gray-400">주문번호: {orderId}</p>
        </div>
        <div className="mt-6 p-3 bg-blue-50 rounded-xl">
          <p className="text-sm text-blue-700 font-medium">담당자가 확인 후 빠르게 연락드립니다.</p>
        </div>
      </div>
    );
  }

  if (payment.status === 'failed') {
    return (
      <div className="text-center">
        <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-800 mb-2">결제가 실패했습니다</h1>
        <p className="text-gray-500 text-sm mb-4">다시 시도하거나 고객센터로 문의해 주세요.</p>
        <p className="text-xs text-gray-400">주문번호: {orderId}</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <Clock className="w-16 h-16 text-blue-400 mx-auto mb-4 animate-pulse" />
      <h1 className="text-xl font-bold text-gray-800 mb-2">결제를 확인하는 중입니다</h1>
      <p className="text-gray-500 text-sm mb-4">잠시만 기다려 주세요. 결제 확인 후 담당자가 연락드립니다.</p>
      <p className="text-xs text-gray-400">주문번호: {orderId}</p>
    </div>
  );
}

export default async function PaymentCompletePage({ searchParams }: Props) {
  const { orderId } = await searchParams;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
        {orderId ? (
          <Suspense fallback={<div className="text-center text-gray-400 py-8">확인 중...</div>}>
            <PaymentStatus orderId={orderId} />
          </Suspense>
        ) : (
          <div className="text-center">
            <XCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-700 mb-2">잘못된 접근입니다</h1>
            <p className="text-gray-500 text-sm">주문 정보가 없습니다.</p>
          </div>
        )}
        {process.env.NEXT_PUBLIC_B2B_PHONE && (
          <p className="mt-8 text-xs text-gray-400 text-center">
            문의: {process.env.NEXT_PUBLIC_B2B_PHONE}
          </p>
        )}
      </div>
    </div>
  );
}
