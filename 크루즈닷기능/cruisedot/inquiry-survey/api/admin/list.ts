export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'cg.sid.v2';

/**
 * 관리자가 ProductInquiry 목록 조회
 */
async function checkAdminAuth() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    return null;
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        User: {
          select: {
            id: true,
            role: true,
            name: true,
          },
        },
      },
    });

    if (session && session.User && session.User.role === 'admin') {
      return session.User;
    }
  } catch (error) {
    console.error('[Admin Auth] Error:', error);
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // 'pending', 'contacted', 'confirmed', 'cancelled'

    const where: any = {};
    if (status) {
      where.status = status;
    }

    let inquiries;
    try {
      inquiries = await prisma.productInquiry.findMany({
        where,
        include: {
          Product: {
            select: {
              productCode: true,
              packageName: true,
              cruiseLine: true,
              shipName: true,
              nights: true,
              days: true,
            },
          },
          User: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (queryError: any) {
      console.error('[Admin Inquiries] Database query error:', queryError);
      console.error('[Admin Inquiries] Error details:', {
        message: queryError?.message,
        code: queryError?.code,
        meta: queryError?.meta,
      });
      
      // 테이블이 없는 경우
      if (queryError?.code === 'P2021' || queryError?.message?.includes('does not exist')) {
        return NextResponse.json({
          ok: true,
          inquiries: [],
          message: 'ProductInquiry 테이블이 아직 생성되지 않았습니다.',
        });
      }
      
      return NextResponse.json(
        { 
          ok: false, 
          error: queryError?.message || '조회 실패',
          details: process.env.NODE_ENV === 'development' ? queryError?.message : undefined
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      inquiries: inquiries.map(inquiry => ({
        id: inquiry.id,
        productCode: inquiry.productCode,
        productName: inquiry.Product.packageName,
        cruiseLine: inquiry.Product.cruiseLine,
        shipName: inquiry.Product.shipName,
        nights: inquiry.Product.nights,
        days: inquiry.Product.days,
        name: inquiry.name,
        phone: inquiry.phone,
        passportNumber: inquiry.passportNumber,
        message: inquiry.message,
        status: inquiry.status,
        userId: inquiry.userId,
        userName: inquiry.User?.name || null,
        userPhone: inquiry.User?.phone || null,
        createdAt: inquiry.createdAt,
        updatedAt: inquiry.updatedAt,
      })),
    });
  } catch (error: any) {
    console.error('[Admin Inquiries] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '조회 실패' },
      { status: 500 }
    );
  }
}
