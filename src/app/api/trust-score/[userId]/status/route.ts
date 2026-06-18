/**
 * API 3: PATCH /api/trust-score/{userId}/status
 * 상태 변경 (관리자만)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createAuditLog } from '@/lib/trust-score';
import { getAuthSession } from '@/lib/auth';

const VALID_STATUSES = ['GOOD', 'WARNING', 'RESTRICTED', 'SUSPENDED'];

export async function PATCH(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = params.userId;
    const body = await req.json();
    const { status, reason, note } = body;

    // 권한 확인: 관리자만
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json(
        { error: '권한 없음', code: 'UNAUTHORIZED' },
        { status: 403 }
      );
    }

    const isAdmin = session.role === 'OWNER';
    if (!isAdmin) {
      return NextResponse.json(
        { error: '권한 없음', code: 'UNAUTHORIZED' },
        { status: 403 }
      );
    }

    // 상태 유효성 확인
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: '유효하지 않은 상태', code: 'INVALID_STATUS' },
        { status: 400 }
      );
    }

    // 신뢰도 조회 (임시: Prisma 타입 미정의)
    const existing = await (prisma as any).trustScore?.findUnique?.({
      where: { userId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '신뢰도를 찾을 수 없습니다', code: 'TRUST_SCORE_NOT_FOUND' },
        { status: 404 }
      );
    }

    // 상태 업데이트
    const updated = await (prisma as any).trustScore?.update?.({
      where: { userId },
      data: {
        status,
        statusChangedAt: new Date(),
      },
    });

    // 감사 로그 기록
    await createAuditLog({
      userId,
      trustScoreId: updated.id,
      eventType: 'ADMIN_ACTION',
      description: `관리자가 상태 변경: ${existing.status} → ${status}${reason ? ` (사유: ${reason})` : ''}`,
      previousValue: {
        status: existing.status,
      },
      newValue: {
        status: updated.status,
      },
      triggeredBy: session.userId,
    });

    return NextResponse.json(
      {
        id: updated.id,
        userId: updated.userId,
        status: updated.status,
        reason,
        changedAt: updated.statusChangedAt?.toISOString(),
        changedBy: session.userId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] 상태 변경 실패:', error);
    return NextResponse.json(
      { error: '서버 오류', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
