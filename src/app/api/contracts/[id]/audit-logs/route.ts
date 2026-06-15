import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getContractAuditLog } from '@/lib/contract-audit-log';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
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
