export const dynamic = 'force-dynamic';

// app/api/admin/users/[userId]/inquiries/route.ts
// 사용자의 상품 문의 내역 조회 (관리자 전용)

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { logger } from '@/lib/logger';

async function checkAdminAuth() {
  const session = await getSession();
  if (!session?.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: parseInt(session.userId) },
    select: { role: true }
  });

  return user?.role === 'admin' ? user : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { userId: userIdStr } = await params; const userId = parseInt(userIdStr);
    if (isNaN(userId)) {
      return NextResponse.json({ ok: false, error: 'Invalid user ID' }, { status: 400 });
    }

    const inquiries = await prisma.productInquiry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        Product: {
          select: {
            productCode: true,
            packageName: true
          }
        }
      }
    });

    return NextResponse.json({
      ok: true,
      inquiries: inquiries.map(i => ({
        id: i.id,
        productCode: i.productCode,
        productName: i.Product?.packageName || '상품 없음',
        name: i.name,
        phone: i.phone,
        passportNumber: i.passportNumber,
        message: i.message,
        status: i.status,
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString()
      }))
    });
  } catch (error: any) {
    logger.error('[Admin User Inquiries API] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch inquiries' },
      { status: 500 }
    );
  }
}
