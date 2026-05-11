import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

/**
 * 결제 완료 페이지
 * PayApp returnurl → /p/[slug]/payment/complete?orderId=xxx
 */
export default async function PaymentCompletePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { slug } = await params;
  const { orderId } = await searchParams;

  // 랜딩페이지 확인
  const page = await prisma.crmLandingPage.findFirst({
    where: { slug, isActive: true },
    select: { title: true, productName: true, organizationId: true },
  });

  if (!page) notFound();

  // 결제 정보 조회 (organizationId 검증 — IDOR 방지)
  let payment: {
    productName: string | null;
    amount: number;
    status: string;
    customerName: string;
    paidAt: Date | null;
    cardName: string | null;
    payType: string | null;
  } | null = null;

  if (orderId) {
    payment = await prisma.payAppPayment.findFirst({
      where: { orderId, organizationId: page.organizationId },
      select: {
        productName: true,
        amount: true,
        status: true,
        customerName: true,
        paidAt: true,
        cardName: true,
        payType: true,
      },
    });
  }

  const isPaid = payment?.status === "paid";
  const payTypeLabel: Record<string, string> = {
    card: "신용카드", phone: "휴대폰", bank_transfer: "계좌이체",
    virtual_account: "가상계좌", kakaopay: "카카오페이", naverpay: "네이버페이",
    smilepay: "스마일페이", applepay: "애플페이",
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-navy-900 to-navy-800 px-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
        {isPaid ? (
          <>
            <div className="text-5xl mb-4">{"✅"}</div>
            <h1 className="text-xl font-bold text-navy-900 mb-2">결제가 완료되었습니다!</h1>
            <p className="text-gray-500 text-sm mb-6">감사합니다. 담당자가 곧 연락드리겠습니다.</p>

            {/* 결제 정보 */}
            <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">상품</span>
                <span className="font-medium text-gray-900">{payment?.productName ?? page.productName ?? page.title}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">결제 금액</span>
                <span className="font-bold text-navy-900 text-lg">{payment?.amount.toLocaleString()}원</span>
              </div>
              {payment?.cardName && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">결제 수단</span>
                  <span className="text-gray-700">{payment.cardName}</span>
                </div>
              )}
              {!payment?.cardName && payment?.payType && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">결제 수단</span>
                  <span className="text-gray-700">{payTypeLabel[payment.payType] ?? payment.payType}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">결제 일시</span>
                <span className="text-gray-700">
                  {payment?.paidAt
                    ? new Date(payment.paidAt).toLocaleString("ko-KR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "-"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">고객명</span>
                <span className="text-gray-700">{payment?.customerName}</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="text-5xl mb-4">{"⏳"}</div>
            <h1 className="text-xl font-bold text-navy-900 mb-2">
              {payment ? "결제 처리 중입니다" : "결제 정보를 확인 중입니다"}
            </h1>
            <p className="text-gray-500 text-sm mb-6">
              잠시 후 결제가 확인되면 담당자가 연락드리겠습니다.
            </p>
          </>
        )}

        {/* CTA 버튼 */}
        <div className="space-y-3">
          <a
            href="https://pf.kakao.com/_cruisedot"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full bg-yellow-400 text-gray-900 min-h-[44px] flex items-center justify-center rounded-xl text-sm font-bold hover:bg-yellow-300 transition-colors"
          >
            카카오톡 상담하기
          </a>
          <a
            href="tel:1899-4798"
            className="block w-full bg-navy-900 text-white min-h-[44px] flex items-center justify-center rounded-xl text-sm font-bold hover:bg-navy-700 transition-colors"
          >
            전화 상담 (1899-4798)
          </a>
          <Link
            href={`/p/${slug}`}
            className="block text-xs text-gray-400 mt-2 hover:text-gray-600"
          >
            랜딩페이지로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return {
    title: "결제 완료 - 크루즈닷",
    description: "결제가 완료되었습니다. 감사합니다.",
    robots: { index: false, follow: false },
  };
}
