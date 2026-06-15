/**
 * PATCH /api/contract-instances/[id]/modification-requests/[requestId]/reject
 *
 * 수정 요청 거절 (대안 제시 옵션)
 * - 상태 전이: MANUAL_APPROVAL_PENDING → REJECTED or ALTERNATIVE_PROPOSED
 * - 이메일 발송 (L6: Loss Aversion)
 * - 감사 로그 기록
 */

import { NextRequest, NextResponse } from "next/server";
import { getMabizSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  sendRejectionEmail,
  sendAlternativeProposalEmail,
} from "@/lib/contract-modification-emails";
import { ContractModificationStateMachine } from "@/lib/contract-modification-state-machine";

interface RejectRequestBody {
  rejectionReason: string;
  responseMessage?: string;
  alternatives?: Array<{
    fieldName?: string;
    proposedValue: string;
    reason: string;
  }>;
  proposeAlternative?: boolean;
}

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
      logger.warn("[MODIFICATION_REJECT] Request not found", {
        requestId,
      });
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const contract = await prisma.contractInstance.findUnique({
      where: { id },
    });

    if (!contract) {
      logger.warn("[MODIFICATION_REJECT] Contract not found", {
        contractId: id,
      });
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 }
      );
    }

    // 2. RBAC 검증
    const isAdmin = authContext.role === "GLOBAL_ADMIN";
    const isOrgOwner = contract.organizationId === authContext.organizationId;

    if (!isAdmin && !isOrgOwner) {
      logger.warn("[MODIFICATION_REJECT] Forbidden", {
        userId: authContext.userId,
        contractId: id,
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3. 상태 머신 검증
    const sm = new ContractModificationStateMachine();
    const body: RejectRequestBody = await req.json().catch(() => ({
      rejectionReason: "",
    }));

    const targetStatus = body.proposeAlternative
      ? "ALTERNATIVE_PROPOSED"
      : "REJECTED";

    if (!sm.canTransitionTo(request.status as any, targetStatus as any)) {
      logger.warn("[MODIFICATION_REJECT] Invalid state transition", {
        currentStatus: request.status,
        targetStatus,
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

    // 4. 거절 또는 대안 제시
    const clientIp = getClientIp(req);
    const result = await prisma.$transaction(async (tx) => {
      const updateData: any = {
        approvedByUserId: authContext.userId,
        responseMessage: body.responseMessage || body.rejectionReason,
        respondedAt: new Date(),
        responseIpAddress: clientIp,
        auditLog: [
          ...(Array.isArray(request.auditLog) ? request.auditLog : []),
          {
            timestamp: new Date().toISOString(),
            action: targetStatus,
            by: authContext.userId,
            message: body.responseMessage || body.rejectionReason,
          },
        ],
      };

      if (body.proposeAlternative && body.alternatives) {
        // 대안 제시
        updateData.status = "ALTERNATIVE_PROPOSED";
        updateData.alternativeProposal = body.alternatives;
        updateData.alternativeExpiresAt = new Date(
          Date.now() + 3 * 24 * 60 * 60 * 1000 // 3일
        );
      } else {
        // 거절
        updateData.status = "REJECTED";
      }

      const updatedRequest = await tx.contractModificationRequest.update({
        where: { id: requestId },
        data: updateData,
      });

      // 감사 로그 기록
      await tx.contractAuditLog.create({
        data: {
          contractId: id,
          action:
            targetStatus === "ALTERNATIVE_PROPOSED"
              ? "modification_alternative_proposed"
              : "modification_rejected",
          timestamp: new Date(),
          userId: authContext.userId,
          ipAddress: clientIp,
          userAgent: req.headers.get("user-agent") || undefined,
        },
      });

      return updatedRequest;
    });

    logger.log("[MODIFICATION_REJECT] Success", {
      requestId,
      contractId: id,
      status: targetStatus,
      rejectedBy: authContext.userId,
    });

    // 5. 이메일 발송 (비블로킹)
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
          if (body.proposeAlternative && body.alternatives?.length) {
            // 대안 제시 이메일
            sendAlternativeProposalEmail(
              contact.email,
              {
                customerName: contact.name || "고객님",
                fieldName: firstMod.fieldName,
                currentValue: firstMod.oldValue,
                newValue: firstMod.newValue,
                reason: firstMod.reason,
                proposedValue: body.alternatives[0].proposedValue,
                proposedReason: body.alternatives[0].reason,
                requestId,
                expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
                appliedLenses: request.lensApplied || ["L10"],
              },
              contract.organizationId
            ).catch((err) => {
              logger.error("[MODIFICATION_REJECT] Email send failed", { err });
            });
          } else {
            // 거절 이메일
            const alternatives = body.alternatives?.map(
              (alt) =>
                `${alt.fieldName || "대안"}|${alt.reason}`
            ) || [
              "현재 계약 조건 유지|기존 계약 조건이 최적화되어 있습니다.",
            ];

            sendRejectionEmail(
              contact.email,
              {
                customerName: contact.name || "고객님",
                fieldName: firstMod.fieldName,
                currentValue: firstMod.oldValue,
                newValue: firstMod.newValue,
                reason: firstMod.reason,
                requestId,
                expiresAt: request.expiresAt,
                appliedLenses: request.lensApplied || ["L6"],
                rejectionReason: body.rejectionReason,
                alternatives,
              },
              contract.organizationId
            ).catch((err) => {
              logger.error("[MODIFICATION_REJECT] Email send failed", { err });
            });
          }
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: `Request ${targetStatus === "ALTERNATIVE_PROPOSED" ? "sent alternative proposal" : "rejected"}`,
        request: result,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error("[MODIFICATION_REJECT_ERROR]", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
