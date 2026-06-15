import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getContractAuditLog } from '@/lib/contract-audit-log';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface ContractAuditLogInput {
  action: string;
  details?: string;
}

/**
 * GET /api/contracts/[id]/audit-logs
 * 계약서의 모든 감사 로그를 조회합니다.
 * 권한: OWNER만 조회 가능 (향후 권한 검사 추가)
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // 계약서 존재 여부 확인
    const contract = await prisma.contractInstance.findUnique({
      where: { id },
      select: { id: true, organizationId: true },
    });

    if (!contract) {
      return NextResponse.json(
        { ok: false, message: '계약서를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 감사 로그 조회
    const auditLogs = await getContractAuditLog(id);

    logger.log('[ContractAuditLogs] 조회 완료', {
      contractId: id,
      count: auditLogs.length,
    });

    return NextResponse.json({
      ok: true,
      auditLogs: auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        timestamp: log.timestamp.toISOString(),
        userId: log.userId,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        details: log.details,
      })),
    });
  } catch (error) {
    logger.log('[ContractAuditLogs] 조회 오류', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, message: '감사 로그 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/contracts/[id]/audit-logs
 * 계약서에 감사 로그를 추가합니다.
 * Phase 7: Re-signing actions (re_signing_invited, re_signed)
 */
export async function POST(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: contractId } = await params;
    const body = (await req.json()) as ContractAuditLogInput;

    // 계약서 존재 여부 확인
    const contract = await prisma.contractInstance.findUnique({
      where: { id: contractId },
      select: { id: true, organizationId: true },
    });

    if (!contract) {
      return NextResponse.json(
        { ok: false, message: '계약서를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 유효한 액션 목록 (Phase 5, 6, 7 모든 액션 포함)
    const validActions = [
      // Basic actions
      'signed',
      'viewed',
      'downloaded',
      'emailed',
      'resent',
      // Phase 5: Modification request
      'modification_requested',
      'modification_approved',
      'modification_rejected',
      // Phase 6: Alternative proposal
      'modification_alternative_proposed',
      // Phase 7: Re-signing (새로움)
      're_signing_invited',
      're_signed',
      're_sign_completed',
    ];

    if (!validActions.includes(body.action)) {
      return NextResponse.json(
        {
          ok: false,
          message: `유효하지 않은 액션입니다. 허용된 액션: ${validActions.join(', ')}`
        },
        { status: 400 }
      );
    }

    // 감사 로그 저장
    const auditLog = await prisma.contractAuditLog.create({
      data: {
        contractId: contractId,
        action: body.action,
        timestamp: new Date(),
        userId: undefined, // 자동 시스템 로그
        ipAddress: (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || undefined,
        userAgent: req.headers.get('user-agent') || undefined,
        details: body.details,
      },
    });

    logger.log('[ContractAuditLogs] 감사 로그 생성 성공', {
      contractId,
      action: body.action,
      logId: auditLog.id,
    });

    return NextResponse.json(
      {
        ok: true,
        message: '감사 로그가 생성되었습니다',
        log: {
          id: auditLog.id,
          action: auditLog.action,
          timestamp: auditLog.timestamp.toISOString(),
          details: auditLog.details,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.log('[ContractAuditLogs] 감사 로그 생성 오류', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, message: '감사 로그 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
