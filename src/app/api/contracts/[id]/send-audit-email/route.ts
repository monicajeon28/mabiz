/**
 * POST /api/contracts/[id]/send-audit-email
 * Team B: 계약 완료 이메일 발송 API
 * - ContractInstance COMPLETED 상태 확인
 * - Contact.email 조회
 * - sendAuditEmail() 호출
 * - 응답: { ok, message }
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { sendAuditEmail } from '@/lib/contract-email-sender';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/contracts/[id]/send-audit-email
 * 계약 완료 시 감사 인증서 다운로드 링크를 포함한 이메일 발송
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // 1. 인증 확인
    const authContext = await getMabizSession();
    if (!authContext) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { organizationId } = authContext;
    const { id: contractId } = await params;

    // 2. ContractInstance 조회
    const contract = await prisma.contractInstance.findUnique({
      where: { id: contractId },
      include: {
        template: {
          select: { name: true },
        },
        // Contact 관계가 없으면 boundData에서 이메일을 얻어야 함
      },
    });

    if (!contract) {
      logger.warn('[POST /api/contracts/[id]/send-audit-email] 계약서를 찾을 수 없음', {
        contractId,
        organizationId,
      });
      return NextResponse.json(
        { ok: false, error: '계약서를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 3. 접근 권한 확인 (같은 조직)
    if (contract.organizationId !== organizationId) {
      logger.warn('[POST /api/contracts/[id]/send-audit-email] 접근 권한 없음', {
        contractId,
        organizationId,
        contractOrgId: contract.organizationId,
      });
      return NextResponse.json(
        { ok: false, error: '접근 권한이 없습니다' },
        { status: 403 }
      );
    }

    // 4. 상태 확인: COMPLETED만 이메일 발송 가능
    if (contract.status !== 'COMPLETED') {
      logger.warn('[POST /api/contracts/[id]/send-audit-email] 상태 확인 실패', {
        contractId,
        currentStatus: contract.status,
        requiredStatus: 'COMPLETED',
      });
      return NextResponse.json(
        {
          ok: false,
          error: `계약서 상태가 '${contract.status}'입니다. COMPLETED 상태에서만 이메일을 발송할 수 있습니다.`,
        },
        { status: 422 }
      );
    }

    // 5. 수신자 이메일 주소 결정 (Contact → boundData 순서)
    let recipientEmail: string | null = null;
    let recipientName = '고객';

    // 5-1. Contact 조회 시도 (contactId가 있으면)
    if (contract.contactId) {
      const contact = await prisma.contact.findUnique({
        where: { id: contract.contactId },
        select: { email: true, name: true },
      });

      if (contact && contact.email) {
        recipientEmail = contact.email;
        recipientName = contact.name || '고객';
      }
    }

    // 5-2. boundData에서 이메일 추출 (Contact 없거나 이메일 없으면)
    if (!recipientEmail && contract.boundData) {
      const boundData =
        typeof contract.boundData === 'object' ? contract.boundData : {};
      const data = boundData as Record<string, unknown>;

      recipientEmail =
        typeof data.email === 'string'
          ? data.email
          : typeof data.buyerEmail === 'string'
            ? data.buyerEmail
            : null;

      recipientName =
        typeof data.buyerName === 'string'
          ? data.buyerName
          : typeof data.name === 'string'
            ? data.name
            : '고객';
    }

    // 5-3. 이메일 주소 필수 확인
    if (!recipientEmail) {
      logger.error('[POST /api/contracts/[id]/send-audit-email] 수신자 이메일 없음', {
        contractId,
        contactId: contract.contactId,
        hasContactEmail: false,
        hasBoundDataEmail: false,
      });
      return NextResponse.json(
        {
          ok: false,
          error:
            '계약서에 이메일 주소가 없습니다. Contact.email 또는 boundData.email/buyerEmail 필드가 필요합니다.',
        },
        { status: 422 }
      );
    }

    // 5-4. 이메일 형식 검증
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      logger.error('[POST /api/contracts/[id]/send-audit-email] 유효하지 않은 이메일 형식', {
        contractId,
        email: recipientEmail.slice(0, 5) + '***',
      });
      return NextResponse.json(
        { ok: false, error: '이메일 주소 형식이 올바르지 않습니다.' },
        { status: 422 }
      );
    }

    // 6. 감사 이메일 발송
    const sent = await sendAuditEmail({
      contract: {
        id: contract.id,
        status: contract.status,
        signedAt: contract.signedAt,
        template: contract.template,
      },
      recipientEmail,
      recipientName,
    });

    if (!sent) {
      logger.error('[POST /api/contracts/[id]/send-audit-email] 이메일 발송 실패', {
        contractId,
        recipientEmail: recipientEmail.slice(0, 5) + '***',
      });
      return NextResponse.json(
        {
          ok: false,
          error:
            '이메일 발송에 실패했습니다. SMTP 설정을 확인해주세요.',
        },
        { status: 500 }
      );
    }

    // 7. 성공 응답
    logger.log('[POST /api/contracts/[id]/send-audit-email] 성공', {
      contractId,
      recipientEmail: recipientEmail.slice(0, 5) + '***',
      sentAt: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      message: `${recipientEmail}로 감사 인증서 이메일이 발송되었습니다.`,
      recipientEmail: recipientEmail.slice(0, 5) + '***',
      contractId,
    });
  } catch (error) {
    logger.error('[POST /api/contracts/[id]/send-audit-email] 예외 발생', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
