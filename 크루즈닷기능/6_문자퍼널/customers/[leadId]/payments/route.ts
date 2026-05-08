export const dynamic = 'force-dynamic';

// 파트너가 고객의 결제 정보 조회
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/lib/partner-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const { sessionUser: user, profile } = await requirePartnerContext();
    const leadId = parseInt(params.leadId);

    if (isNaN(leadId)) {
      return NextResponse.json(
        { ok: false, error: '잘못된 고객 ID입니다.' },
        { status: 400 }
      );
    }

    // 고객의 결제 정보 조회
    const payments = await prisma.payment.findMany({
      where: {
        status: 'paid',
        OR: [
          { userId: leadId },
          {
            buyerEmail: {
              in: await prisma.user
                .findUnique({
                  where: { id: leadId },
                  select: { email: true },
                })
                .then((u) => (u?.email ? [u.email] : [])),
            },
          },
        ],
      },
      orderBy: { paidAt: 'desc' },
      take: 10,
      select: {
        id: true,
        orderId: true,
        productCode: true,
        productName: true,
        amount: true,
        currency: true,
        status: true,
        paidAt: true,
        buyerName: true,
        buyerEmail: true,
        buyerTel: true,
      },
    });

    console.log('[Partner Customer Payments] Found:', {
      leadId,
      partnerId: user.id,
      paymentsCount: payments.length,
    });

    return NextResponse.json({
      ok: true,
      payments,
    });
  } catch (error: any) {
    console.error('[Partner Customer Payments] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '결제 정보 조회 실패' },
      { status: error.status || 500 }
    );
  }
}
