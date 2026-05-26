/**
 * 📋 GDPR 데이터 삭제 요청 API
 * POST /api/compliance/data-deletion-request
 *
 * 사용자가 자신의 데이터 삭제를 요청할 수 있는 엔드포인트
 * 30일 유예기간 후 영구 삭제
 *
 * 2026-05-27 Compliance Monitor Agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { dataDeletionManager } from '@/lib/compliance/data-deletion';
import { auditLogger } from '@/lib/compliance/audit-logger';
import { logger } from '@/lib/logger';
import { getAuthContext } from '@/lib/rbac';

export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const { contactId, reason } = await req.json();

    // 입력 검증
    if (!contactId || !reason) {
      return NextResponse.json(
        { error: 'contactId and reason are required' },
        { status: 400 }
      );
    }

    if (reason.length < 10) {
      return NextResponse.json(
        { error: 'reason must be at least 10 characters' },
        { status: 400 }
      );
    }

    // 삭제 요청 생성
    const deletionRequest = await dataDeletionManager.scheduleContactDeletion({
      contactId,
      organizationId: ctx.organizationId,
      requestedBy: ctx.userId,
      reason,
      gracePeriodDays: 30,
    });

    // 감시 로그 기록
    await auditLogger.record({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: 'DELETE',
      resourceType: 'Contact',
      resourceId: contactId,
      status: 'SUCCESS',
      purpose: 'Compliance',
      reasonDescription: `GDPR 삭제 요청: ${reason}`,
    });

    logger.info('✅ Data Deletion Request Created', {
      contactId,
      organizationId: ctx.organizationId,
      requestedBy: ctx.userId,
      scheduledDeleteAt: deletionRequest.scheduledDeleteAt,
    });

    return NextResponse.json({
      success: true,
      message: '30일 유예기간으로 삭제 요청이 등록되었습니다',
      deletionRequest: {
        id: deletionRequest.id,
        contactId: deletionRequest.contactId,
        requestedAt: deletionRequest.requestedAt,
        scheduledDeleteAt: deletionRequest.scheduledDeleteAt,
        gracePeriodDays: deletionRequest.gracePeriodDays,
        status: deletionRequest.status,
      },
    });
  } catch (error) {
    logger.error('❌ Data Deletion Request Failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
