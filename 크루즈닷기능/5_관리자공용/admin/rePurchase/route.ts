export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { calculateConversionRate } from '@/lib/rePurchase/trigger';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      console.log('[Admin RePurchase] No session cookie found');
      return null;
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {  // ✅ 대문자 U로 변경
          select: { id: true, role: true, name: true },
        },
      },
    });

    if (!session || !session.User) {  // ✅ 대문자 U로 변경
      console.log('[Admin RePurchase] Session not found or user not found');
      return null;
    }

    if (session.User.role !== 'admin') {  // ✅ 대문자 U로 변경
      console.log('[Admin RePurchase] User is not admin:', session.User.role);  // ✅ 대문자 U로 변경
      return null;
    }

    console.log('[Admin RePurchase] Admin authenticated:', session.User.id);  // ✅ 대문자 U로 변경
    return {
      id: session.User.id,  // ✅ 대문자 U로 변경
      name: session.User.name,  // ✅ 대문자 U로 변경
      role: session.User.role,  // ✅ 대문자 U로 변경
    };
  } catch (error) {
    console.error('[Admin RePurchase] Auth check error:', error);
    return null;
  }
}

// GET: 재구매 트리거 목록 조회
export async function GET(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const converted = searchParams.get('converted');
    const triggerType = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '100');

    const where: any = {};
    if (converted !== null) {
      where.converted = converted === 'true';
    }
    if (triggerType) {
      where.triggerType = triggerType;
    }

    const triggers = await prisma.rePurchaseTrigger.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, phone: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      ok: true,
      triggers,
    });
  } catch (error) {
    console.error('[Admin RePurchase GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch triggers' },
      { status: 500 }
    );
  }
}
