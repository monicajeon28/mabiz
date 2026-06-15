/**
 * POST /api/contracts/[id]/generate-audit-pdf
 *
 * 계약서의 감사추적 로그를 포함한 PDF 생성 및 다운로드
 * - 요청: ContractInstance ID + 선택적 필터 (startDate, endDate)
 * - 응답: PDF 바이너리 파일 (application/pdf)
 * - 권한: 계약서 소유 조직의 멤버만 가능
 * - 상태: COMPLETED 계약서만 가능
 */

import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { generateContractPdf } from '@/lib/contract-pdf-generator';
import { logger } from '@/lib/logger';

interface RouteParams {
  id: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  let contractInstance = null;
  let loggedAction = 'DOWNLOAD_PDF';

  try {
    // 1. 권한 검증
    const ctx = await getMabizSession();
    if (!ctx) {
      return NextResponse.json(
        { ok: false, error: '인증 정보가 없습니다' },
        { status: 401 }
      );
    }

    const { id: contractId } = params;

    // 2. ContractInstance 조회
    contractInstance = await prisma.contractInstance.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        organizationId: true,
        status: true,
        createdAt: true,
        signedAt: true,
        boundData: true,
        template: {
          select: {
            name: true,
            description: true,
          },
        },
      },
    });

    if (!contractInstance) {
      logger.warn('[ContractAuditPDF] 계약서를 찾을 수 없음', {
        contractId,
        userId: ctx.userId,
        organizationId: ctx.organizationId,
      });
      return NextResponse.json(
        { ok: false, error: '계약서를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 3. 권한 검증: 같은 조직에 속해야 함
    if (contractInstance.organizationId !== ctx.organizationId) {
      logger.warn('[ContractAuditPDF] 권한 없음 (조직 불일치)', {
        contractId,
        userId: ctx.userId,
        ownerOrgId: contractInstance.organizationId,
        requestOrgId: ctx.organizationId,
      });
      return NextResponse.json(
        { ok: false, error: '이 계약서에 접근할 권한이 없습니다' },
        { status: 403 }
      );
    }

    // 4. 상태 검증: COMPLETED 상태만 허용
    if (contractInstance.status !== 'COMPLETED') {
      logger.warn('[ContractAuditPDF] 계약서 상태 확인 필요', {
        contractId,
        status: contractInstance.status,
        userId: ctx.userId,
      });
      return NextResponse.json(
        {
          ok: false,
          error: `체결이 완료된 계약서만 다운로드 가능합니다 (현재 상태: ${contractInstance.status})`,
        },
        { status: 400 }
      );
    }

    // 5. 요청 본문에서 날짜 필터 추출 (선택사항)
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    try {
      const body = await request.json().catch(() => ({}));
      if (body.startDate) {
        startDate = new Date(body.startDate);
        if (isNaN(startDate.getTime())) startDate = undefined;
      }
      if (body.endDate) {
        endDate = new Date(body.endDate);
        if (isNaN(endDate.getTime())) endDate = undefined;
      }
    } catch {
      // 본문 파싱 실패 시 필터 없이 진행
    }

    // 6. 감사 로그 조회 (계약서 관련)
    const auditLogsWhere: any = {
      organizationId: ctx.organizationId,
      resourceType: 'ContractInstance',
      resourceId: contractId,
    };

    if (startDate || endDate) {
      auditLogsWhere.createdAt = {};
      if (startDate) auditLogsWhere.createdAt.gte = startDate;
      if (endDate) auditLogsWhere.createdAt.lte = endDate;
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: auditLogsWhere,
      select: {
        id: true,
        action: true,
        userId: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        status: true,
        errorMessage: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 1000, // 최대 1000개 로그
    });

    // 7. 추가 감사 로그 (ContractTemplate 변경)
    const templateAuditLogs = await prisma.contractTemplateAuditLog.findMany({
      where: {
        organizationId: ctx.organizationId,
        templateId: (contractInstance as any).template?.id || '',
      },
      select: {
        id: true,
        action: true,
        userId: true,
        ipAddress: true,
        createdAt: true,
        status: true,
        errorMessage: true,
        changeDescription: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });

    // 8. 연락처 정보 추출 (boundData에서)
    const boundData = contractInstance.boundData as Record<string, any>;
    const contactName = boundData?.contactName || boundData?.name || '미지정';
    const contactEmail = boundData?.email || '-';

    // 9. 감사 로그 데이터 정규화
    const combinedLogs: Parameters<typeof generateContractPdf>[0]['auditLogs'] = [
      ...auditLogs.map((log) => ({
        id: log.id.toString(),
        action: log.action,
        userId: log.userId,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
        status: log.status,
        errorMessage: log.errorMessage,
        changeDescription: undefined,
      })),
      ...templateAuditLogs.map((log) => ({
        id: log.id,
        action: `TEMPLATE_${log.action}`,
        userId: log.userId,
        ipAddress: log.ipAddress,
        userAgent: undefined,
        createdAt: log.createdAt,
        status: log.status,
        errorMessage: log.errorMessage,
        changeDescription: log.changeDescription,
      })),
    ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    // 10. PDF 생성
    loggedAction = 'GENERATE_PDF';
    const pdfBuffer = await generateContractPdf({
      contractId,
      templateName: contractInstance.template?.name || '계약서',
      issueDate: new Date(contractInstance.createdAt),
      contactName,
      contactEmail,
      contractStatus: contractInstance.status,
      signedAt: contractInstance.signedAt ? new Date(contractInstance.signedAt) : undefined,
      auditLogs: combinedLogs,
    });

    // 11. 감사 로그 기록 (PDF 생성)
    await prisma.auditLog.create({
      data: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: 'EXPORT',
        resourceType: 'ContractInstance',
        resourceId: contractId,
        status: 'SUCCESS',
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'UNKNOWN',
        userAgent: request.headers.get('user-agent'),
        purpose: 'Compliance',
        reasonDescription: 'Audit PDF 생성 및 다운로드',
      },
    });

    // 12. PDF 응답 생성
    const filename = `contract_${contractId}_${new Date().toISOString().split('T')[0]}.pdf`;

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': pdfBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    // 에러 로깅
    const ctxError = await getMabizSession();
    logger.error('[ContractAuditPDF] PDF 생성 실패', {
      contractId: (params?.id) || 'UNKNOWN',
      userId: ctxError?.userId || 'UNKNOWN',
      action: loggedAction,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // 감사 로그 기록 (실패)
    try {
      const ctx2 = await getMabizSession();
      if (contractInstance && ctx2 !== null) {
        await prisma.auditLog.create({
          data: {
            organizationId: contractInstance.organizationId,
            userId: ctx2.userId || undefined,
            action: 'EXPORT',
            resourceType: 'ContractInstance',
            resourceId: params.id,
            status: 'FAILED',
            errorMessage: error instanceof Error ? error.message : String(error),
            ipAddress: 'UNKNOWN',
          },
        }).catch(() => {
          // 감사 로그 기록 실패는 무시
        });
      }
    } catch {
      // 에러 처리 무시
    }

    return NextResponse.json(
      {
        ok: false,
        error: 'PDF 생성 중 오류가 발생했습니다',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/contracts/[id]/generate-audit-pdf
 * 가능한 조회 파라미터 정보 제공 (테스트용)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  const ctx = await getMabizSession();
  if (!ctx) {
    return NextResponse.json(
      { ok: false, error: '인증 정보가 없습니다' },
      { status: 401 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      message: 'PDF 생성 엔드포인트',
      endpoint: `/api/contracts/${params.id}/generate-audit-pdf`,
      method: 'POST',
      description: '계약서의 감사추적 로그를 포함한 PDF 생성',
      requestBody: {
        startDate: 'ISO 8601 형식 (선택)',
        endDate: 'ISO 8601 형식 (선택)',
      },
      example: {
        startDate: '2026-06-01T00:00:00Z',
        endDate: '2026-06-15T23:59:59Z',
      },
    },
    { status: 200 }
  );
}
