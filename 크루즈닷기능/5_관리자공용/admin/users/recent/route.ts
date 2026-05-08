export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  if (!sid) return false;

  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {  // ✅ 대문자 U로 변경
          select: { role: true },
        },
      },
    });

    return session?.User.role === 'admin';  // ✅ 대문자 U로 변경
  } catch (error) {
    logger.error('[Admin Recent Users] Auth check error:', error);
    return false;
  }
}

export async function GET() {
  try {
    // 관리자 권한 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    const isAdmin = await checkAdminAuth(sid);

    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });
    }

    // 최근 가입 고객 (삭제된 고객 제외, 최대 10명)
    // role이 'admin'이 아닌 고객만 조회
    const recentCustomers = await prisma.user.findMany({
      where: {
        role: { not: 'admin' },
      },
      take: 25,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        phone: true,
        createdAt: true,
        isHibernated: true,
        isLocked: true,
        customerStatus: true,
        UserTrip: {
          select: {
            companionType: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const deletedStatusKeywords = new Set([
      'deleted',
      'removed',
      'archived',
      'inactive',
      'deactivated',
      'hidden',
    ]);

    const customers: Array<{
      id: number;
      name: string | null;
      phone: string | null;
      createdAt: string;
      status: 'active' | 'package' | 'dormant' | 'locked';
    }> = [];
    for (const customer of recentCustomers) {
      const name = customer.name?.trim() ?? '';
      const phone = customer.phone?.trim() ?? '';
      const statusLabel = customer.customerStatus?.toLowerCase() ?? '';

      const hasDeletedStatus = deletedStatusKeywords.has(statusLabel);
      const nameIndicatesDeletion =
        name.length === 0 ||
        name === '-' ||
        name.toLowerCase() === 'deleted user' ||
        name.toLowerCase() === 'removed user' ||
        name.toLowerCase().includes('삭제');
      const phoneIndicatesDeletion =
        phone.length === 0 || phone === '-' || phone === '000-0000-0000';

      if (hasDeletedStatus || (nameIndicatesDeletion && phoneIndicatesDeletion)) {
        continue;
      }

      const isDormant = customer.name === customer.phone;

      let status: 'active' | 'package' | 'dormant' | 'locked' = 'active';
      if (customer.isLocked) {
        status = 'locked';
      } else if (isDormant) {
        status = 'dormant';
      } else {
        const latestTrip = customer.UserTrip && customer.UserTrip.length > 0 ? customer.UserTrip[0] : null;
        if (latestTrip?.companionType && latestTrip.companionType.toLowerCase().includes('package')) {
          status = 'package';
        } else {
          status = 'active';
        }
      }

      customers.push({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        createdAt: customer.createdAt.toISOString(),
        status,
      });

      if (customers.length >= 10) {
        break;
      }
    }

    return NextResponse.json({
      ok: true,
      customers,
    });
  } catch (error: any) {
    logger.error('[Admin Recent Users API] Error:', error);
    return NextResponse.json(
      { 
        ok: false, 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
