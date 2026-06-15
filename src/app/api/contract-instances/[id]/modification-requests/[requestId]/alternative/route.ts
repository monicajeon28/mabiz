/**
 * PATCH /api/contract-instances/[id]/modification-requests/[requestId]/alternative
 *
 * 대안 수락/거절
 * - 수락: ALTERNATIVE_PROPOSED → ALTERNATIVE_ACCEPTED → 계약서 데이터 적용
 * - 거절: ALTERNATIVE_PROPOSED → ALTERNATIVE_DECLINED (요청 종료)
 */

import { NextRequest, NextResponse } from "next/server";
import { getMabizSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendApprovalEmail, sendClosureEmail } from "@/lib/contract-modification-emails";
import { ContractModificationStateMachine } from "@/lib/contract-modification-state-machine";

interface AlternativeRequestBody {
  action: "ACCEPT" | "DECLINE";
  responseMessage?: string;
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
      logger.warn("[MODIFICATION_ALTERNATIVE] Request not found", {
        requestId,
      });
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const contract = await prisma.contractInstance.findUnique({
      where: { id },
    });

    if (!contract) {
      logger.warn("[MODIFICATION_ALTERNATIVE] Contract not found", {
        contractId: id,
      });
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 }
      );
    }

    // 2. 요청 본문 파싱
    const body: AlternativeRequestBody = await req.json().catch(() => ({
      action: "ACCEPT",
    }));

    if (!["ACCEPT", "DECLINE"].includes(body.action)) {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
    }

    // 3. 상태 머신 검증
    const sm = new ContractModificationStateMachine();
    const targetStatus =
      body.action === "ACCEPT"
        ? "ALTERNATIVE_ACCEPTED"
        : "ALTERNATIVE_DECLINED";

    if (!sm.canTransitionTo(request.status as any, targetStatus as any)) {
      logger.warn("[MODIFICATION_ALTERNATIVE] Invalid state transition", {
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

    // 4. 데이터 적용 (수락 시) 또는 종료 (거절 시)
    const clientIp = getClientIp(req);
    const result = await prisma.$transaction(async (tx) => {
      const updateData: any = {
        status: targetStatus,
        respondedAt: new Date(),
        responseIpAddress: clientIp,
        auditLog: [
          ...(Array.isArray(request.auditLog) ? request.auditLog : []),
          {
            timestamp: new Date().toISOString(),
            action: targetStatus,
            by: authContext.userId,
            message:
              body.responseMessage ||
              (body.action === "ACCEPT"
                ? "대안이 수락되었습니다"
                : "대안이 거절되었습니다"),
          },
        ],
      };

      if (body.action === "ACCEPT") {
        // 대안 수락: 계약서 데이터 적용
        const alternatives = Array.isArray(request.alternativeProposal)
          ? request.alternativeProposal
          : JSON.parse((request.alternativeProposal as string) || "[]");

        const updatedBoundData = { ...((contract.boundData as any) || {}) };
        for (const alt of alternatives) {
          if (alt.fieldName && alt.proposedValue !== undefined) {
            updatedBoundData[alt.fieldName] = alt.proposedValue;
          }
        }

        await tx.contractInstance.update({
          where: { id },
          data: {
            boundData: updatedBoundData,
            updatedAt: new Date(),
          },
        });
      }

      const updatedRequest = await tx.contractModificationRequest.update({
        where: { id: requestId },
        data: updateData,
      });

      // 감사 로그 기록
      await tx.contractAuditLog.create({
        data: {
          contractId: id,
          organizationId: contract.organizationId,
          action:
            body.action === "ACCEPT"
              ? "modification_alternative_accepted"
              : "modification_alternative_declined",
          timestamp: new Date(),
          userId: authContext.userId,
          ipAddress: clientIp,
          userAgent: req.headers.get("user-agent") || undefined,
        },
      });

      return updatedRequest;
    });

    logger.log("[MODIFICATION_ALTERNATIVE] Success", {
      requestId,
      contractId: id,
      action: body.action,
      respondedBy: authContext.userId,
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

        const alternatives = Array.isArray(request.alternativeProposal)
          ? request.alternativeProposal
          : JSON.parse((request.alternativeProposal as string) || "[]");

        const firstMod = modifications[0];
        const firstAlt = alternatives[0];

        if (body.action === "ACCEPT" && firstAlt) {
          // 수락 이메일
          sendApprovalEmail(
            contact.email,
            {
              customerName: contact.name || "고객님",
              fieldName: firstMod?.fieldName || "계약 내용",
              currentValue: firstMod?.oldValue || "",
              newValue: firstAlt.proposedValue,
              reason: firstAlt.reason,
              requestId,
              expiresAt: request.expiresAt,
              appliedLenses: request.lensApplied || ["L7"],
            },
            false,
            contract.organizationId
          ).catch((err) => {
            logger.error(
              "[MODIFICATION_ALTERNATIVE] Approval email send failed",
              { err }
            );
          });
        } else if (body.action === "DECLINE") {
          // 거절 이메일
          sendClosureEmail(
            contact.email,
            {
              customerName: contact.name || "고객님",
              fieldName: firstMod?.fieldName || "계약 내용",
              currentValue: firstMod?.oldValue || "",
              newValue: firstMod?.newValue || "",
              reason: firstMod?.reason || "",
              requestId,
              expiresAt: request.expiresAt,
              appliedLenses: request.lensApplied || ["L6"],
              closureReason: "REJECTED" as const,
            },
            contract.organizationId
          ).catch((err) => {
            logger.error(
              "[MODIFICATION_ALTERNATIVE] Closure email send failed",
              { err }
            );
          });
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: `Alternative ${body.action === "ACCEPT" ? "accepted" : "declined"}`,
        request: result,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error("[MODIFICATION_ALTERNATIVE_ERROR]", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
