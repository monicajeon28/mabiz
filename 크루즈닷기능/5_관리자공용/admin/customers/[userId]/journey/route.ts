export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { SESSION_COOKIE } from '@/lib/session';

async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  try {
    if (!sid) return false;

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: { User: true },
    });

    if (!session || !session.User) return false;
    return session.User.role === 'admin';
  } catch (error) {
    console.error('[Customer Journey API] Auth check error:', error);
    return false;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다.' },
        { status: 403 }
      );
    }

    const isAdmin = await checkAdminAuth(sid);
    if (!isAdmin) {
      return NextResponse.json(
        { ok: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { userId: userIdStr } = await params; const userId = parseInt(userIdStr);
    if (isNaN(userId)) {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 사용자 ID입니다.' },
        { status: 400 }
      );
    }

    // 고객 여정 히스토리 조회
    const journeyHistory = await prisma.customerJourney.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // 그룹 이름 매핑
    const groupLabels: Record<string, string> = {
      'landing-page': '마케팅 랜딩페이지',
      'trial': '3일 체험',
      'mall': '크루즈몰',
      'purchase': '구매고객',
      'refund': '환불고객',
    };

    // 트리거 타입 이름 매핑
    const triggerLabels: Record<string, string> = {
      'reservation_created': '예약 생성',
      'certificate_issued': '인증서 발급',
      'refund_processed': '환불 처리',
      'manual': '관리자 수동',
      'auto': '자동 전환',
    };

    const formattedHistory = journeyHistory.map((journey) => ({
      id: journey.id,
      fromGroup: journey.fromGroup ? groupLabels[journey.fromGroup] || journey.fromGroup : '초기 상태',
      toGroup: groupLabels[journey.toGroup] || journey.toGroup,
      triggerType: triggerLabels[journey.triggerType] || journey.triggerType,
      triggerDescription: journey.triggerDescription,
      metadata: journey.metadata,
      createdAt: journey.createdAt.toISOString(),
    }));

    return NextResponse.json({
      ok: true,
      journeyHistory: formattedHistory,
    });
  } catch (error: any) {
    console.error('[Customer Journey API] Error:', error);
    return NextResponse.json(
      { ok: false, error: '여정 히스토리를 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
}
