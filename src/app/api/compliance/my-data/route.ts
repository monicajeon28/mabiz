/**
 * 📤 GDPR 데이터 접근 권리 API
 * GET /api/compliance/my-data
 *
 * 사용자가 자신의 모든 데이터를 JSON으로 다운로드할 수 있는 엔드포인트
 * 규정: GDPR Article 15 (Right of Access)
 *
 * 2026-05-27 Compliance Monitor Agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { dataDeletionManager } from '@/lib/compliance/data-deletion';
import { auditLogger } from '@/lib/compliance/audit-logger';
import { logger } from '@/lib/logger';
import { getAuthContext } from '@/lib/rbac';

export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const contactId = req.nextUrl.searchParams.get('contactId');

    if (!contactId) {
      return NextResponse.json(
        { error: 'contactId query parameter is required' },
        { status: 400 }
      );
    }

    // 테넌트 격리: 요청한 contactId가 자기 조직 소속인지 검증
    if (ctx.organizationId) {
      const contact = await (await import('@/lib/prisma')).default.contact.findFirst({
        where: { id: contactId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!contact) {
        return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
    }

    // 데이터 내보내기
    const userData = await dataDeletionManager.exportUserData(contactId);

    // 감시 로그 기록
    await auditLogger.record({
      organizationId: ctx.organizationId ?? undefined,
      userId: ctx.userId,
      action: 'EXPORT',
      resourceType: 'Contact',
      resourceId: contactId,
      status: 'SUCCESS',
      purpose: 'Compliance',
      reasonDescription: 'GDPR 데이터 접근 요청',
    });

    logger.info('✅ User Data Export Request', {
      contactId,
      organizationId: ctx.organizationId,
      requestedBy: ctx.userId,
      exportedAt: new Date().toISOString(),
    });

    // JSON 파일로 다운로드
    const filename = `user-data-${contactId}-${new Date().toISOString().split('T')[0]}.json`;

    return new NextResponse(JSON.stringify(userData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    logger.error('❌ User Data Export Failed', {
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
