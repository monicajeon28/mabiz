/**
 * API 1: GET /api/trust-score/{userId}
 * 신뢰도 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTrustScore } from '@/lib/trust-score';
import { getAuthSession } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = params.userId;

    // 권한 확인: 본인 또는 관리자만 조회 가능
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json(
        { error: '권한 없음', code: 'UNAUTHORIZED' },
        { status: 403 }
      );
    }

    // 본인 또는 관리자 확인
    const isOwner = session.userId === userId;
    const isAdmin = session.role === 'OWNER'; // 조직 소유자

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: '권한 없음', code: 'UNAUTHORIZED' },
        { status: 403 }
      );
    }

    // 신뢰도 조회
    const trustScore = await getTrustScore(userId);

    if (!trustScore) {
      return NextResponse.json(
        { error: '신뢰도를 찾을 수 없습니다', code: 'TRUST_SCORE_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json(trustScore, { status: 200 });
  } catch (error) {
    console.error('[API] 신뢰도 조회 실패:', error);
    return NextResponse.json(
      { error: '서버 오류', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
