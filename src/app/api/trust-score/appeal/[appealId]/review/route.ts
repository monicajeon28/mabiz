/**
 * API 5: PATCH /api/trust-score/appeal/{appealId}/review
 * 이의 제기 검토 (관리자만)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createAuditLog, applyAppealApproval } from '@/lib/trust-score';
import { getAuthSession } from '@/lib/auth';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { appealId: string } }
) {
  try {
    const appealId = params.appealId;
    const body = await req.json();
    const { status, adminReview, appliedAction, trustScoreAdjustment = -1 } = body;

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
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { error: '유효하지 않은 상태', code: 'INVALID_STATUS' },
        { status: 400 }
      );
    }

    // 이의 조회
    const appeal = await (prisma as any).trustAppeal?.findUnique?.({
      where: { id: appealId },
      include: { trustScore: true },
    });

    if (!appeal) {
      return NextResponse.json(
        { error: '이의를 찾을 수 없습니다', code: 'APPEAL_NOT_FOUND' },
        { status: 404 }
      );
    }

    // 이미 검토된 경우
    if (appeal.status !== 'PENDING') {
      return NextResponse.json(
        { error: '이미 검토된 이의입니다', code: 'INVALID_STATUS' },
        { status: 400 }
      );
    }

    let result = null;

    // 승인 처리
    if (status === 'APPROVED' && appliedAction === 'RESTORE') {
      result = await applyAppealApproval(appealId, trustScoreAdjustment);
    }

    // 이의 업데이트
    const updated = await (prisma as any).trustAppeal?.update?.({
      where: { id: appealId },
      data: {
        status,
        adminReview,
        appliedAction: appliedAction || null,
        reviewedAt: new Date(),
        reviewedBy: session.userId,
      },
    });

    // 감사 로그 기록
    const eventType = status === 'APPROVED' ? 'APPEAL_APPROVED' : 'APPEAL_REJECTED';
    await createAuditLog({
      userId: appeal.trustScore.userId,
      trustScoreId: appeal.trustScoreId,
      eventType,
      description: `이의 제기 ${status === 'APPROVED' ? '승인' : '거부'}됨`,
      newValue: {
        appealId: updated.id,
        status,
        adminReview,
      },
      triggeredBy: session.userId,
    });

    return NextResponse.json(
      {
        id: updated.id,
        status: updated.status,
        adminReview: updated.adminReview,
        appliedAction: updated.appliedAction,
        reviewedAt: updated.reviewedAt?.toISOString(),
        reviewedBy: updated.reviewedBy,
        result: result || {
          trustScoreUpdated: false,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] 이의 검토 실패:', error);
    return NextResponse.json(
      { error: '서버 오류', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
