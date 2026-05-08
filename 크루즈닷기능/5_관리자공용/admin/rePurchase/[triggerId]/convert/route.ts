export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { markAsConverted } from '@/lib/rePurchase/trigger';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      console.log('[Admin RePurchase Convert] No session cookie found');
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
      console.log('[Admin RePurchase Convert] Session not found or user not found');
      return null;
    }

    if (session.User.role !== 'admin') {  // ✅ 대문자 U로 변경
      console.log('[Admin RePurchase Convert] User is not admin:', session.User.role);  // ✅ 대문자 U로 변경
      return null;
    }

    console.log('[Admin RePurchase Convert] Admin authenticated:', session.User.id);  // ✅ 대문자 U로 변경
    return {
      id: session.User.id,  // ✅ 대문자 U로 변경
      name: session.User.name,  // ✅ 대문자 U로 변경
      role: session.User.role,  // ✅ 대문자 U로 변경
    };
  } catch (error) {
    console.error('[Admin RePurchase Convert] Auth check error:', error);
    return null;
  }
}

// PUT: 전환 처리
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ triggerId: string }> }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { triggerId: triggerIdStr } = await params; const triggerId = parseInt(triggerIdStr);
    if (isNaN(triggerId)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid triggerId' },
        { status: 400 }
      );
    }

    const trigger = await markAsConverted(triggerId);

    return NextResponse.json({
      ok: true,
      message: '전환이 처리되었습니다.',
      trigger,
    });
  } catch (error) {
    console.error('[Admin RePurchase Convert] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to convert trigger' },
      { status: 500 }
    );
  }
}
