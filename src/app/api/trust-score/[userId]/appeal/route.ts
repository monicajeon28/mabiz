/**
 * API 4: POST /api/trust-score/{userId}/appeal
 * 이의 제기 (본인만)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createAuditLog } from '@/lib/trust-score';
import { getAuthSession } from '@/lib/auth';

const VALID_REASONS = [
  'PRODUCT_DEFECT',
  'CUSTOMER_REQUESTED',
  'LOGISTICS_ERROR',
  'MISUNDERSTANDING',
  'SPECIAL_REQUEST',
];

export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = params.userId;
    const body = await req.json();
    const { reason, evidenceUrls = [], requestedAction = 'RESTORE' } = body;

    // 권한 확인: 본인만
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json(
        { error: '권한 없음', code: 'UNAUTHORIZED' },
        { status: 403 }
      );
    }

    if (session.userId !== userId) {
      return NextResponse.json(
        { error: '권한 없음', code: 'UNAUTHORIZED' },
        { status: 403 }
      );
    }

    // 이유 유효성 확인
    if (!reason || (typeof reason === 'string' && reason.length === 0)) {
      return NextResponse.json(
        { error: '이유를 선택해주세요', code: 'INVALID_REASON' },
        { status: 400 }
      );
    }

    // 증거 확인
    if (!Array.isArray(evidenceUrls) || evidenceUrls.length === 0) {
      return NextResponse.json(
        { error: '증거 자료가 필요합니다', code: 'INSUFFICIENT_EVIDENCE' },
        { status: 400 }
      );
    }

    // 신뢰도 조회
    const trustScore = await (prisma as any).trustScore?.findUnique?.({
      where: { userId },
    });

    if (!trustScore) {
      return NextResponse.json(
        { error: '신뢰도를 찾을 수 없습니다', code: 'TRUST_SCORE_NOT_FOUND' },
        { status: 404 }
      );
    }

    // 이의 제기 생성
    const appeal = await (prisma as any).trustAppeal?.create?.({
      data: {
        trustScoreId: trustScore.id,
        reason: String(reason),
        evidenceUrls: Array.isArray(evidenceUrls) ? evidenceUrls : [],
        requestedAction,
        status: 'PENDING',
      },
    });

    // 감사 로그 기록
    await createAuditLog({
      userId,
      trustScoreId: trustScore.id,
      eventType: 'APPEAL',
      description: `이의 제기 접수됨: ${reason}`,
      newValue: {
        appealId: appeal.id,
        reason,
        evidenceCount: evidenceUrls.length,
      },
      triggeredBy: session.userId,
    });

    return NextResponse.json(
      {
        id: appeal.id,
        userId: trustScore.userId,
        trustScoreId: appeal.trustScoreId,
        status: appeal.status,
        reason: appeal.reason,
        evidenceCount: appeal.evidenceUrls.length,
        requestedAction: appeal.requestedAction,
        createdAt: appeal.createdAt.toISOString(),
        message: '이의 제기가 접수되었습니다. 관리자가 검토 후 연락드리겠습니다.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API] 이의 제기 실패:', error);
    return NextResponse.json(
      { error: '서버 오류', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
