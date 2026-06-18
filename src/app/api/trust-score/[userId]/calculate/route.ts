/**
 * API 2: POST /api/trust-score/{userId}/calculate
 * 신뢰도 재계산
 */

import { NextRequest, NextResponse } from 'next/server';
import { recalculateTrustScore, getStatusMessage } from '@/lib/trust-score';
import { getAuthSession } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = params.userId;
    const body = await req.json();
    const force = body?.force ?? false;

    // 권한 확인: 본인 또는 관리자만
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json(
        { error: '권한 없음', code: 'UNAUTHORIZED' },
        { status: 403 }
      );
    }

    const isOwner = session.userId === userId;
    const isAdmin = session.role === 'OWNER';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: '권한 없음', code: 'UNAUTHORIZED' },
        { status: 403 }
      );
    }

    // 신뢰도 재계산
    const result = await recalculateTrustScore(userId);

    return NextResponse.json(
      {
        ...result,
        message: getStatusMessage(result.status),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] 신뢰도 재계산 실패:', error);
    return NextResponse.json(
      { error: '서버 오류', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
