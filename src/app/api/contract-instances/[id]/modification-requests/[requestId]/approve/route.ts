/**
 * PATCH /api/contract-instances/[id]/modification-requests/[requestId]/approve
 *
 * 수정 요청 승인
 * - 상태 전이: MANUAL_APPROVAL_PENDING → APPROVED
 * - 계약서 데이터 적용 (원자적)
 * - 이메일 발송 (L7: Companion)
 * - 감사 로그 기록
 */

import { NextRequest, NextResponse } from "next/server";
import { getMabizSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  sendApprovalEmail,
} from "@/lib/contract-modification-emails";
import { ContractModificationStateMachine } from "@/lib/contract-modification-state-machine";

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

interface RouteParams {
  params: Promise<{ id: string; requestId: string }>;
}

export async function PATCH(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const authContext = await getMabizSession();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, requestId } = await params;

    // 1. 요청 및 계약서 로드
    const request = await prisma.contractModificationRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      logger.warn("[MODIFICATION_APPROVE] Request not found", {
        requestId,
      });
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const contract = await prisma.contractInstance.findUnique({
      where: { id },
    });

    if (!contract) {
      logger.warn("[MODIFICATION_APPROVE] Contract not found", {
        contractId: id,
      });
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 }
      );
    }

    // 2. RBAC 검증
    // 관리자 또는 조직 소유자만 승인 가능
    const isAdmin = authContext.role === "GLOBAL_ADMIN";
    const isOrgOwner = contract.organizationId === authContext.organizationId;

    if (!isAdmin && !isOrgOwner) {
      logger.warn("[MODIFICATION_APPROVE] Forbidden", {
        userId: authContext.userId,
        contractId: id,
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3. 상태 머신 검증
    const sm = new ContractModificationStateMachine();
    if (!sm.canTransitionTo(request.status as any, "APPROVED")) {
      logger.warn("[MODIFICATION_APPROVE] Invalid state transition", {
        currentStatus: request.status,
        targetStatus: "APPROVED",
      });
      return NextResponse.json(
        {
          error: "Invalid state transition",
          current: request.status,
          available: sm.getNextExpectedStates(request.status as any),
        },
        { status: 409 }
      );
    }

    // 4. 요청 본문 파싱
    const body = await req.json().catch(() => ({}));
    const { responseMessage = "요청사항이 승인되었습니다." } = body;

    // 5. 원자적 업데이트: 요청 상태 변경 + 계약서 데이터 적용
    const clientIp = getClientIp(req);
    const result = await prisma.$transaction(async (tx) => {
      // 5a. 수정 요청 상태 업데이트
      const updatedRequest = await tx.contractModificationRequest.update({
        where: { id: requestId },
        data: {
          status: "APPROVED",
          approvedByUserId: authContext.userId,
          responseMessage,
          respondedAt: new Date(),
          responseIpAddress: clientIp,
          auditLog: [
            ...(Array.isArray(request.auditLog) ? request.auditLog : []),
            {
              timestamp: new Date().toISOString(),
              action: "APPROVED",
              by: authContext.userId,
              message: responseMessage,
            },
          ],
        },
      });

      // 5b. 계약서 데이터 적용
      // fieldModifications는 JSON 배열
      const modifications = Array.isArray(request.fieldModifications)
        ? request.fieldModifications
        : JSON.parse(request.fieldModifications as string);

      const updatedBoundData = { ...((contract.boundData as any) || {}) };
      for (const mod of modifications) {
        if (mod.fieldName && mod.newValue !== undefined) {
          updatedBoundData[mod.fieldName] = mod.newValue;
        }
      }

      const updatedContract = await tx.contractInstance.update({
        where: { id },
        data: {
          boundData: updatedBoundData,
          updatedAt: new Date(),
        },
      });

      // 5c. 감사 로그 기록
      await tx.contractAuditLog.create({
        data: {
          contractId: id,
          organizationId: contract.organizationId,
          action: "modification_approved",
          timestamp: new Date(),
          userId: authContext.userId,
          ipAddress: clientIp,
          userAgent: req.headers.get("user-agent") || undefined,
        },
      });

      return { request: updatedRequest, contract: updatedContract };
    });

    logger.log("[MODIFICATION_APPROVE] Success", {
      requestId,
      contractId: id,
      approvedBy: authContext.userId,
    });

    // 6. 이메일 발송 (비블로킹)
    if (contract.contactId) {
      const contact = await prisma.contact.findUnique({
        where: { id: contract.contactId },
      });

      if (contact?.email) {
        const modifications = Array.isArray(request.fieldModifications)
          ? request.fieldModifications
          : JSON.parse(request.fieldModifications as string);

        const firstMod = modifications[0];
        if (firstMod) {
          sendApprovalEmail(
            contact.email,
            {
              customerName: contact.name || "고객님",
              fieldName: firstMod.fieldName,
              currentValue: firstMod.oldValue,
              newValue: firstMod.newValue,
              reason: firstMod.reason,
              requestId,
              expiresAt: request.expiresAt,
              appliedLenses: request.lensApplied || ["L7"],
            },
            false,
            contract.organizationId
          ).catch((err) => {
            logger.error("[MODIFICATION_APPROVE] Email send failed", { err });
          });
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: "Request approved",
        request: result.request,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error("[MODIFICATION_APPROVE_ERROR]", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
