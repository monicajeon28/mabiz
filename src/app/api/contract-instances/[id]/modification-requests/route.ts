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
import { makeAutoApprovalDecision } from "@/lib/contract-modification-auto-approval";
import type { MediationQuestion, PsychologyLensDetection } from "@/lib/contract-modification-auto-approval";

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
 * POST - 새 수정 요청 생성 (자동 승인 판정 통합)
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

    // 수정 요청 생성 (트랜잭션 적용)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7일
    const clientIp = getClientIp(req);
    const requestId = crypto.randomUUID();
    const userAgent = req.headers.get("user-agent");

    // 첫 번째 필드 수정 (주요 항목) 기반으로 자동 승인 판정
    const firstMod = body.fieldModifications[0];
    const boundData = (contract.boundData || {}) as Record<string, any>;

    // 자동 승인 판정 엔진 실행
    const decision = await makeAutoApprovalDecision(
      {
        id: requestId,
        contractId: id,
        fieldName: firstMod.fieldName,
        newValue: firstMod.newValue,
        currentValue: firstMod.oldValue || "",
        requestedByUserId: authContext.userId || "",
        requestedAt: new Date(),
      },
      {
        organizationId: contract.organizationId,
        contactId: contract.contactId || undefined,
      }
    );

    // JSON 타입 호환성을 위해 객체 변환
    const mediationJson = JSON.parse(JSON.stringify(decision.mediation5Steps));
    const lensDetectionJson = JSON.parse(JSON.stringify(decision.lensDetectionDetails));

    // 트랜잭션으로 DB 저장
    const modificationRequest = await prisma.$transaction(async (tx) => {
      const modRequest = await tx.contractModificationRequest.create({
        data: {
          id: requestId,
          contractId: id,
          fieldModifications: body.fieldModifications,
          additionalNotes: body.additionalNotes,
          status: decision.status === "AUTO_APPROVED" ? "APPROVED" : "REQUESTED",
          requestedByUserId: authContext.userId,
          requestedByType: "AGENT",
          requestedByName: authContext.member?.displayName || "시스템",
          requestedByEmail: undefined,
          expiresAt,

          // 자동 승인 정보 저장
          mediation5Steps: mediationJson,
          lensDetectionDetails: lensDetectionJson,
          dealRiskFlag: decision.evaluation.dealRiskFlag,
          complexityScore: decision.evaluation.complexity || 0,
          lensApplied: decision.lensDetectionDetails.detectedLenses,

          // 자동 승인된 경우 즉시 처리 정보 저장
          ...(decision.status === "AUTO_APPROVED" && {
            approvedByUserId: "SYSTEM",
            approvedAt: new Date(),
          }),

          ipAddress: clientIp,
          userAgent: userAgent || undefined,
          auditLog: [
            {
              timestamp: new Date().toISOString(),
              action: decision.status === "AUTO_APPROVED" ? "AUTO_APPROVED" : "REQUESTED",
              by: authContext.userId || "SYSTEM",
              message: decision.status === "AUTO_APPROVED"
                ? `자동 승인됨 (복잡도: ${decision.evaluation.complexity})`
                : "수정 요청이 생성되었습니다.",
            },
          ],
        },
      });

      // AUTO_APPROVED 상태일 경우 계약서 데이터 즉시 적용
      if (decision.status === "AUTO_APPROVED") {
        await tx.contractInstance.update({
          where: { id },
          data: {
            boundData: {
              ...boundData,
              [firstMod.fieldName]: firstMod.newValue,
            },
          },
        });

        // 감사 로그 생성
        await tx.contractAuditLog.create({
          data: {
            contractId: id,
            action: "modification_approved",
            timestamp: new Date(),
            userId: "SYSTEM",
            ipAddress: clientIp,
            userAgent: userAgent || undefined,
            details: `Field: ${firstMod.fieldName}, Auto-approved by system (Complexity: ${decision.evaluation.complexity})`,
          },
        });
      }

      return modRequest;
    });

    logger.log("[CREATE_MODIFICATION_REQUEST] Success", {
      requestId: modificationRequest.id,
      contractId: id,
      createdBy: authContext.userId,
      fieldCount: body.fieldModifications.length,
      autoApproved: decision.status === "AUTO_APPROVED",
      complexity: decision.evaluation.complexity,
    });

    // 이메일 발송 (비블로킹)
    if (contract.contactId) {
      const contact = await prisma.contact.findUnique({
        where: { id: contract.contactId },
      });

      if (contact?.email) {
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
            appliedLenses: decision.lensDetectionDetails.detectedLenses,
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
        message: decision.status === "AUTO_APPROVED"
          ? "✅ 자동 승인되었습니다. 계약서가 업데이트되었습니다."
          : "📋 검토 중입니다. 24시간 내에 처리해드리겠습니다.",
        request: {
          id: modificationRequest.id,
          status: modificationRequest.status,
          fieldName: firstMod.fieldName,
          newValue: firstMod.newValue,
          expiresAt: modificationRequest.expiresAt,
        },
        autoApprovalInfo: {
          isAutoApproved: decision.status === "AUTO_APPROVED",
          complexity: decision.evaluation.complexity,
          appliedLenses: decision.lensDetectionDetails.detectedLenses,
          dealRiskFlag: decision.evaluation.dealRiskFlag,
          estimatedApprovalTime: decision.summary.estimatedApprovalTime,
          recommendation: decision.summary.recommendation,
        },
        mediationQuestions: decision.mediation5Steps,
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
