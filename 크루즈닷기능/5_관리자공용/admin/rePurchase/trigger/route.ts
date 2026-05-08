export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { createTripEndTrigger, createRevisitPromptTrigger, createProductRecommendationTrigger } from '@/lib/rePurchase/trigger';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      console.log('[Admin RePurchase Trigger] No session cookie found');
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
      console.log('[Admin RePurchase Trigger] Session not found or user not found');
      return null;
    }

    if (session.User.role !== 'admin') {  // ✅ 대문자 U로 변경
      console.log('[Admin RePurchase Trigger] User is not admin:', session.User.role);  // ✅ 대문자 U로 변경
      return null;
    }

    console.log('[Admin RePurchase Trigger] Admin authenticated:', session.User.id);  // ✅ 대문자 U로 변경
    return {
      id: session.User.id,  // ✅ 대문자 U로 변경
      name: session.User.name,  // ✅ 대문자 U로 변경
      role: session.User.role,  // ✅ 대문자 U로 변경
    };
  } catch (error) {
    console.error('[Admin RePurchase Trigger] Auth check error:', error);
    return null;
  }
}

// POST: 트리거 수동 생성
export async function POST(req: NextRequest) {
  try {
    console.log('[Admin RePurchase Trigger] Request received');
    
    const admin = await checkAdminAuth();
    if (!admin) {
      console.error('[Admin RePurchase Trigger] Unauthorized');
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Admin RePurchase Trigger] Admin authenticated:', admin.id);

    const body = await req.json();
    const { userId, triggerType, tripEndDate } = body;
    console.log('[Admin RePurchase Trigger] Request body:', { userId, triggerType, tripEndDate });

    if (!userId || !triggerType || !tripEndDate) {
      console.error('[Admin RePurchase Trigger] Missing required fields');
      return NextResponse.json(
        { ok: false, error: 'userId, triggerType, and tripEndDate are required' },
        { status: 400 }
      );
    }

    // 사용자 존재 확인
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    });

    if (!user) {
      console.error('[Admin RePurchase Trigger] User not found:', userId);
      return NextResponse.json(
        { ok: false, error: `사용자 ID ${userId}를 찾을 수 없습니다.` },
        { status: 404 }
      );
    }

    console.log('[Admin RePurchase Trigger] User found:', user.name);

    let trigger;
    const endDate = new Date(tripEndDate);

    console.log('[Admin RePurchase Trigger] Creating trigger:', { userId, triggerType, tripEndDate: endDate });

    switch (triggerType) {
      case 'grace_period_end':
        trigger = await createTripEndTrigger(userId, endDate);
        break;
      case 'revisit_prompt':
        trigger = await createRevisitPromptTrigger(userId, endDate);
        break;
      case 'product_recommendation':
        trigger = await createProductRecommendationTrigger(userId, endDate);
        break;
      default:
        console.error('[Admin RePurchase Trigger] Invalid triggerType:', triggerType);
        return NextResponse.json(
          { ok: false, error: `Invalid triggerType: ${triggerType}` },
          { status: 400 }
        );
    }

    console.log('[Admin RePurchase Trigger] Trigger created:', trigger.id);

    return NextResponse.json({
      ok: true,
      message: '트리거가 생성되었습니다.',
      trigger,
    });
  } catch (error) {
    console.error('[Admin RePurchase Trigger] Fatal error:', error);
    console.error('[Admin RePurchase Trigger] Error stack:', error instanceof Error ? error.stack : String(error));
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to create trigger',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    );
  }
}
