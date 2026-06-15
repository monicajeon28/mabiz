/**
 * GET /api/contract-instances/[id]/modification-requests
 * POST /api/contract-instances/[id]/modification-requests
 *
 * GET: 계약서의 모든 수정 요청 조회
 * POST: 새 수정 요청 생성
 */

import { NextRequest, NextResponse } from "next/server";
import { getMabizSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendRequestCreatedEmail } from "@/lib/contract-modification-emails";

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET - 수정 요청 목록 조회
 */
export async function GET(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const authContext = await getMabizSession();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // 계약서 조회
    const contract = await prisma.contractInstance.findUnique({
      where: { id },
    });

    if (!contract) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 }
      );
    }

    // RBAC: 자신의 조직만 조회 가능
    const isAdmin = authContext.role === "GLOBAL_ADMIN";
    const isOrgOwner = contract.organizationId === authContext.organizationId;

    if (!isAdmin && !isOrgOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 수정 요청 조회
    const requests = await prisma.contractModificationRequest.findMany({
      where: { contractId: id },
      orderBy: { requestedAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      count: requests.length,
      requests,
    });
  } catch (error) {
    logger.error("[GET_MODIFICATION_REQUESTS_ERROR]", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST - 새 수정 요청 생성
 */
interface CreateRequestBody {
  fieldModifications: Array<{
    fieldName: string;
    oldValue: string;
    newValue: string;
    reason?: string;
    detectedLens?: string;
  }>;
  additionalNotes?: string;
  autoApprove?: boolean;
}

export async function POST(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const authContext = await getMabizSession();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // 계약서 조회
    const contract = await prisma.contractInstance.findUnique({
      where: { id },
    });

    if (!contract) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 }
      );
    }

    // RBAC: 자신의 조직만 수정 요청 생성 가능
    const isAdmin = authContext.role === "GLOBAL_ADMIN";
    const isOrgOwner = contract.organizationId === authContext.organizationId;

    if (!isAdmin && !isOrgOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 요청 본문 파싱
    const body: CreateRequestBody = await req.json().catch(() => ({
      fieldModifications: [],
    }));

    if (!Array.isArray(body.fieldModifications) || body.fieldModifications.length === 0) {
      return NextResponse.json(
        { error: "Field modifications required" },
        { status: 400 }
      );
    }

    // 수정 요청 생성
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7일
    const autoApprove = body.autoApprove ?? false;
    const clientIp = getClientIp(req);

    const modificationRequest =
      await prisma.contractModificationRequest.create({
        data: {
          contractId: id,
          fieldModifications: body.fieldModifications,
          additionalNotes: body.additionalNotes,
          status: autoApprove ? "AUTO_APPROVED" : "MANUAL_APPROVAL_PENDING",
          requestedByUserId: authContext.userId,
          requestedByType: "AGENT",
          requestedByName: authContext.member?.displayName || "시스템",
          requestedByEmail: undefined,
          expiresAt,
          lensApplied: ["L2", "L6", "L7", "L10"],
          ipAddress: clientIp,
          userAgent: req.headers.get("user-agent") || undefined,
          auditLog: [
            {
              timestamp: new Date().toISOString(),
              action: "REQUESTED",
              by: authContext.userId,
              message: "수정 요청이 생성되었습니다.",
            },
          ],
        },
      });

    logger.log("[CREATE_MODIFICATION_REQUEST] Success", {
      requestId: modificationRequest.id,
      contractId: id,
      createdBy: authContext.userId,
      fieldCount: body.fieldModifications.length,
    });

    // 이메일 발송 (비블로킹)
    // contactId로 Contact 조회
    if (contract.contactId) {
      const contact = await prisma.contact.findUnique({
        where: { id: contract.contactId },
      });

      if (contact?.email) {
        const firstMod = body.fieldModifications[0];
        sendRequestCreatedEmail(
          contact.email,
          {
            customerName: contact.name || "고객님",
            fieldName: firstMod.fieldName,
            currentValue: firstMod.oldValue,
            newValue: firstMod.newValue,
            reason: firstMod.reason,
            requestId: modificationRequest.id,
            expiresAt,
            appliedLenses: ["L2"],
          },
          contract.organizationId
        ).catch((err) => {
          logger.error("[CREATE_MODIFICATION_REQUEST] Email send failed", {
            err,
          });
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: "Modification request created",
        request: modificationRequest,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error("[CREATE_MODIFICATION_REQUEST_ERROR]", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
