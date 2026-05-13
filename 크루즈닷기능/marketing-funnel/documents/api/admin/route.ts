import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import {
  sendPurchaseCertificateWithImage,
  sendCertificateForSale,
  sendCertificateOnPaymentComplete,
} from '@/lib/purchase-certificate';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인 헬퍼
async function checkAdminAuth(): Promise<{ ok: boolean; userId?: number; error?: string }> {
  const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sid) {
    return { ok: false, error: '로그인이 필요합니다.' };
  }

  const session = await prisma.session.findUnique({
    where: { id: sid },
    include: {
      User: {
        select: { id: true, role: true },
      },
    },
  });

  if (!session?.User) {
    return { ok: false, error: '세션이 만료되었습니다.' };
  }

  if (session.User.role !== 'admin') {
    return { ok: false, error: '관리자 권한이 필요합니다.' };
  }

  return { ok: true, userId: session.User.id };
}

/**
 * 관리자용 구매확인서 발송 API
 * - POST: 구매확인서 발송 (이미지 첨부 또는 판매ID/결제ID 기준)
 * - GET: 구매확인서 발송 내역 조회
 */

// POST: 구매확인서 발송
export async function POST(request: NextRequest) {
  try {
    const auth = await checkAdminAuth();
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.error === '관리자 권한이 필요합니다.' ? 403 : 401 });
    }

    // Content-Type 확인
    const contentType = request.headers.get('content-type') || '';

    // FormData로 이미지와 함께 전송된 경우 (클라이언트에서 html2canvas로 생성)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const imageFile = formData.get('image') as File | null;
      const customerName = formData.get('customerName') as string;
      const customerEmail = formData.get('customerEmail') as string;
      const productName = formData.get('productName') as string;
      const orderId = formData.get('orderId') as string;
      const paymentAmount = parseInt(formData.get('paymentAmount') as string) || 0;
      const saleId = formData.get('saleId') ? parseInt(formData.get('saleId') as string) : undefined;
      const reservationId = formData.get('reservationId') ? parseInt(formData.get('reservationId') as string) : undefined;

      if (!imageFile) {
        return NextResponse.json({ ok: false, error: '이미지 파일이 필요합니다.' }, { status: 400 });
      }

      if (!customerName || !customerEmail || !productName || !orderId) {
        return NextResponse.json({
          ok: false,
          error: '필수 정보가 누락되었습니다. (customerName, customerEmail, productName, orderId)',
        }, { status: 400 });
      }

      // File을 Buffer로 변환
      const arrayBuffer = await imageFile.arrayBuffer();
      const imageBuffer = Buffer.from(arrayBuffer);

      const result = await sendPurchaseCertificateWithImage(imageBuffer, {
        customerName,
        customerEmail,
        productName,
        orderId,
        paymentAmount,
        saleId,
        reservationId,
      });

      return NextResponse.json(result);
    }

    // JSON으로 전송된 경우 (기존 방식 - saleId/paymentId 기준)
    const body = await request.json();
    const { saleId, paymentId } = body;

    // 방법 1: 판매(AffiliateSale) ID로 발송
    if (saleId) {
      const result = await sendCertificateForSale(saleId);
      return NextResponse.json(result);
    }

    // 방법 2: 결제(Payment) ID로 발송
    if (paymentId) {
      const result = await sendCertificateOnPaymentComplete(paymentId);
      return NextResponse.json(result);
    }

    return NextResponse.json({
      ok: false,
      error: '이미지(FormData) 또는 saleId/paymentId 중 하나는 필수입니다.',
    }, { status: 400 });

  } catch (error: any) {
    console.error('[Purchase Certificate API] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// GET: 구매확인서 발송 내역 조회
export async function GET(request: NextRequest) {
  try {
    const auth = await checkAdminAuth();
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.error === '관리자 권한이 필요합니다.' ? 403 : 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // 구매확인서 발송 로그 조회
    const [logs, total] = await Promise.all([
      prisma.adminActionLog.findMany({
        where: {
          action: 'PURCHASE_CERTIFICATE_SENT',
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.adminActionLog.count({
        where: {
          action: 'PURCHASE_CERTIFICATE_SENT',
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      logs: logs.map((log) => ({
        id: log.id,
        details: log.details,
        createdAt: log.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error: any) {
    console.error('[Purchase Certificate API GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
