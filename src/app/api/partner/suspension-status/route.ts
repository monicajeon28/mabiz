import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * GET /api/partner/suspension-status
 * 파트너 전용: 현재 계약 정지 상태 조회
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext();

    if (!ctx.organizationId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const suspension = await prisma.partnerSuspension.findUnique({
      where: { organizationId: ctx.organizationId },
      select: {
        suspensionStatus: true,
        suspensionReason: true,
        reasonDetails: true,
        appealMessage: true,
      },
    });

    // 정지 기록이 없으면 활성 상태
    if (!suspension) {
      return NextResponse.json({
        ok: true,
        data: { status: 'ACTIVE' },
      });
    }

    return NextResponse.json({
      ok: true,
      data: suspension,
    });
  } catch (err) {
    logger.error('파트너 정지 상태 조회 오류:', err);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/partner/suspension-status
 * 파트너 전용: 이의 제기
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext();

    if (!ctx.organizationId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { message } = await req.json() as { message: string };

    if (!message || message.length < 10) {
      return NextResponse.json(
        { ok: false, error: '최소 10자 이상 입력하세요' },
        { status: 400 }
      );
    }

    // 정지 기록 조회
    const suspension = await prisma.partnerSuspension.findUnique({
      where: { organizationId: ctx.organizationId },
    });

    if (!suspension) {
      return NextResponse.json(
        { ok: false, error: '정지된 계약이 없습니다' },
        { status: 400 }
      );
    }

    if (suspension.suspensionStatus === 'RESOLVED') {
      return NextResponse.json(
        { ok: false, error: '이미 해제된 계약입니다' },
        { status: 400 }
      );
    }

    // 이의 제기 업데이트
    await prisma.partnerSuspension.update({
      where: { organizationId: ctx.organizationId },
      data: {
        suspensionStatus: 'APPEALING',
        appealedAt: new Date(),
        appealMessage: message,
      },
    });

    return NextResponse.json({
      ok: true,
      message: '이의가 접수되었습니다',
    });
  } catch (err) {
    logger.error('파트너 이의 제기 오류:', err);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
