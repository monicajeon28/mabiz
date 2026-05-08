import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface PaymentCompletePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ orderId?: string }>;
}

export default async function PaymentCompletePage({ params, searchParams }: PaymentCompletePageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const { slug } = resolvedParams;
  const { orderId } = resolvedSearchParams;

  if (!orderId) {
    notFound();
  }

  // 결제 정보 조회
  const payment = await prisma.payAppPayment.findUnique({
    where: { orderId },
    include: {
      LandingPage: {
        select: { id: true, title: true, slug: true },
      },
    },
  });

  if (!payment) {
    notFound();
  }

  // 결제 상태에 따른 메시지
  const isPaid = payment.status === 'paid';
  const isWaiting = payment.status === 'waiting';
  const isFailed = payment.status === 'failed' || payment.status === 'cancelled';

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        {/* 헤더 */}
        <div className={`p-6 text-center ${
          isPaid ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
          isWaiting ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
          isFailed ? 'bg-gradient-to-r from-red-500 to-rose-500' :
          'bg-gradient-to-r from-blue-500 to-indigo-500'
        }`}>
          <div className="text-white">
            {isPaid && (
              <>
                <div className="text-5xl mb-3">&#10003;</div>
                <h1 className="text-2xl font-bold">결제 완료</h1>
                <p className="text-white/80 mt-1">결제가 성공적으로 완료되었습니다</p>
              </>
            )}
            {isWaiting && (
              <>
                <div className="text-5xl mb-3">&#8987;</div>
                <h1 className="text-2xl font-bold">입금 대기중</h1>
                <p className="text-white/80 mt-1">가상계좌 입금을 기다리고 있습니다</p>
              </>
            )}
            {isFailed && (
              <>
                <div className="text-5xl mb-3">&#10007;</div>
                <h1 className="text-2xl font-bold">결제 실패</h1>
                <p className="text-white/80 mt-1">결제가 취소되었거나 실패했습니다</p>
              </>
            )}
            {!isPaid && !isWaiting && !isFailed && (
              <>
                <div className="text-5xl mb-3">&#128260;</div>
                <h1 className="text-2xl font-bold">결제 처리중</h1>
                <p className="text-white/80 mt-1">결제가 처리되고 있습니다</p>
              </>
            )}
          </div>
        </div>

        {/* 결제 정보 */}
        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">주문번호</span>
              <span className="font-mono text-sm text-gray-700">{payment.orderId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">상품명</span>
              <span className="font-medium text-gray-900">{payment.productName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">결제금액</span>
              <span className="font-bold text-blue-600">{payment.amount.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">결제자</span>
              <span className="text-gray-900">{payment.customerName}</span>
            </div>
            {payment.paidAt && (
              <div className="flex justify-between">
                <span className="text-gray-500">결제일시</span>
                <span className="text-gray-700">
                  {new Date(payment.paidAt).toLocaleString('ko-KR')}
                </span>
              </div>
            )}
          </div>

          {/* 안내 메시지 */}
          {isPaid && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-green-700 text-sm">
                결제가 완료되었습니다. 담당자가 곧 연락드리겠습니다.
              </p>
            </div>
          )}

          {isWaiting && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
              <p className="text-yellow-700 text-sm">
                가상계좌로 입금해주시면 결제가 완료됩니다.
              </p>
            </div>
          )}

          {isFailed && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-red-700 text-sm">
                결제가 취소되었습니다. 다시 시도해주세요.
              </p>
            </div>
          )}

          {/* 버튼 */}
          <div className="pt-4">
            <Link
              href={`/landing/${slug}`}
              className="block w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl text-center transition-colors"
            >
              랜딩페이지로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
