import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMabizSession } from "@/lib/auth";
import { ApiResponse, ContractInstanceResponse } from "@/lib/types/contract-templates";
import { logger } from "@/lib/logger";
import { saveContractToDrive } from "@/lib/affiliate/document-drive-sync";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * 시간 남은 표시
 */
function getTimeRemaining(expiresAt: Date | null): string {
  if (!expiresAt) return "무제한";

  const now = new Date();
  const diff = expiresAt.getTime() - now.getTime();

  if (diff <= 0) return "시간초과";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}시간 ${minutes}분`;
  }
  return `${minutes}분`;
}

/**
 * GET /api/contract-instances/[id]
 * 계약서 인스턴스 상세 조회
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authContext = await getMabizSession();
    if (!authContext) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { organizationId } = authContext;
    const { id } = await params;

    const instance = await prisma.contractInstance.findUnique({
      where: { id },
      include: {
        template: {
          select: { name: true },
        },
      },
    });

    if (!instance) {
      return NextResponse.json(
        { ok: false, error: "계약서를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 권한 확인
    if (instance.organizationId !== organizationId) {
      return NextResponse.json(
        { ok: false, error: "접근 권한이 없습니다" },
        { status: 403 }
      );
    }

    const response: ApiResponse<ContractInstanceResponse> = {
      ok: true,
      data: {
        id: instance.id,
        templateId: instance.templateId,
        templateName: instance.template.name,
        contactId: instance.contactId,
        status: instance.status,
        boundData: instance.boundData,
        appliedLenses: instance.appliedLenses,
        expiresAt: instance.expiresAt?.toISOString() || null,
        timeRemaining: getTimeRemaining(instance.expiresAt),
        smsStatus: {
          day0Sent: instance.smsDay0Sent,
          day0SentAt: instance.smsDay0SentAt?.toISOString() || null,
          day1Sent: instance.smsDay1Sent,
          day1SentAt: instance.smsDay1SentAt?.toISOString() || null,
          day2Sent: instance.smsDay2Sent,
          day2SentAt: instance.smsDay2SentAt?.toISOString() || null,
          day3Sent: instance.smsDay3Sent,
          day3SentAt: instance.smsDay3SentAt?.toISOString() || null,
        },
        signedAt: instance.signedAt?.toISOString() || null,
        createdAt: instance.createdAt.toISOString(),
        updatedAt: instance.updatedAt.toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error("[GET /api/contract-instances/[id]]", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/contract-instances/[id]
 * 계약서 인스턴스 상태 업데이트
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authContext = await getMabizSession();
    if (!authContext) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { organizationId } = authContext;
    const { id } = await params;

    const instance = await prisma.contractInstance.findUnique({
      where: { id },
      include: {
        template: { select: { name: true } },
      },
    });

    if (!instance) {
      return NextResponse.json(
        { ok: false, error: "계약서를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 권한 확인
    if (instance.organizationId !== organizationId) {
      return NextResponse.json(
        { ok: false, error: "접근 권한이 없습니다" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status, signToken } = body;

    // 상태 유효성 확인
    const validStatuses = ["DRAFT", "SENT", "SIGNED", "COMPLETED"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { ok: false, error: "유효하지 않은 상태입니다" },
        { status: 400 }
      );
    }

    // 상태머신 전환 매트릭스: 허용된 전환만 통과
    if (status) {
      const allowedTransitions: Record<string, string[]> = {
        DRAFT:     ["SENT", "COMPLETED"],
        SENT:      ["SIGNED", "DRAFT", "COMPLETED"],
        SIGNED:    ["COMPLETED"],
        COMPLETED: [],
      };
      const currentStatus = instance.status as string;
      const allowed = allowedTransitions[currentStatus] ?? [];
      if (!allowed.includes(status)) {
        return NextResponse.json(
          {
            ok: false,
            error: `'${currentStatus}' 상태에서 '${status}'로 전환할 수 없습니다`,
          },
          { status: 422 }
        );
      }
    }

    // SIGNED 전환 시 추가 검증
    if (status === "SIGNED") {
      // 만료일 검사
      if (instance.expiresAt && instance.expiresAt.getTime() < Date.now()) {
        return NextResponse.json(
          { ok: false, error: "계약서 유효기간이 만료되었습니다" },
          { status: 410 }
        );
      }

      // signToken 검증 (boundData 또는 요청 body에 token 포함 시)
      const storedData =
        instance.boundData && typeof instance.boundData === "object"
          ? (instance.boundData as Record<string, unknown>)
          : {};
      const storedToken =
        typeof storedData.signToken === "string" ? storedData.signToken : null;

      if (storedToken) {
        if (!signToken || typeof signToken !== "string") {
          return NextResponse.json(
            { ok: false, error: "서명 토큰이 필요합니다" },
            { status: 401 }
          );
        }
        // timingSafeEqual 비교로 타이밍 공격 방지
        const { timingSafeEqual } = await import("crypto");
        const a = Buffer.from(storedToken);
        const b = Buffer.from(signToken);
        const tokenMatch =
          a.length === b.length && timingSafeEqual(a, b);
        if (!tokenMatch) {
          return NextResponse.json(
            { ok: false, error: "유효하지 않은 서명 토큰입니다" },
            { status: 403 }
          );
        }
      }
    }

    // 인스턴스 업데이트
    const updatedInstance = await prisma.contractInstance.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(status === "SIGNED" && {
          signedAt: new Date(),
        }),
      },
      include: {
        template: { select: { name: true } },
      },
    });

    // SIGNED 또는 COMPLETED 전환 시 Google Drive에 계약서 저장 (fire-and-forget)
    if (status === "SIGNED" || status === "COMPLETED") {
      void (async () => {
        try {
          // boundData에서 고객명 추출 (buyerName → signerName → customerName 순으로 시도)
          const boundDataObj =
            updatedInstance.boundData && typeof updatedInstance.boundData === "object"
              ? (updatedInstance.boundData as Record<string, unknown>)
              : {};
          const customerName =
            (typeof boundDataObj.buyerName === "string" ? boundDataObj.buyerName : "") ||
            (typeof boundDataObj.signerName === "string" ? boundDataObj.signerName : "") ||
            (typeof boundDataObj.customerName === "string" ? boundDataObj.customerName : "") ||
            "고객";

          // 계약서 HTML 생성 (boundData를 기반으로 간단한 HTML 구성)
          const signedAtStr = updatedInstance.signedAt
            ? updatedInstance.signedAt.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })
            : new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

          const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>계약서 - ${customerName}</title>
  <style>
    body { font-family: 'Malgun Gothic', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 24px; color: #222; }
    h1 { color: #1a2e4a; border-bottom: 2px solid #1a2e4a; padding-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 10px 14px; text-align: left; }
    th { background: #f0f4f8; color: #1a2e4a; width: 30%; }
    .footer { margin-top: 40px; font-size: 12px; color: #888; text-align: center; }
  </style>
</head>
<body>
  <h1>전자 계약서</h1>
  <table>
    <tr><th>계약서 ID</th><td>${updatedInstance.id}</td></tr>
    <tr><th>템플릿</th><td>${updatedInstance.template.name}</td></tr>
    <tr><th>고객명</th><td>${customerName}</td></tr>
    <tr><th>상태</th><td>${updatedInstance.status}</td></tr>
    <tr><th>서명일시</th><td>${signedAtStr}</td></tr>
  </table>
  <h2>계약 내용</h2>
  <pre style="background:#f8f9fa;padding:16px;border-radius:8px;white-space:pre-wrap;word-break:break-all;">${JSON.stringify(boundDataObj, null, 2)}</pre>
  <div class="footer">이 문서는 마비즈 CRM에서 자동 생성된 전자 계약서입니다. 생성일시: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</div>
</body>
</html>`;

          const driveResult = await saveContractToDrive(
            updatedInstance.id,
            htmlContent,
            customerName,
            updatedInstance.organizationId
          );

          if (driveResult.ok && driveResult.driveFileId) {
            // boundData에 driveFileId, driveUrl 저장
            const currentBoundData =
              updatedInstance.boundData && typeof updatedInstance.boundData === "object"
                ? (updatedInstance.boundData as Record<string, unknown>)
                : {};
            await prisma.contractInstance.update({
              where: { id: updatedInstance.id },
              data: {
                boundData: {
                  ...currentBoundData,
                  driveFileId: driveResult.driveFileId,
                  driveUrl: driveResult.driveUrl,
                },
              },
            });
            logger.log("[PATCH /api/contract-instances/[id]] Drive 저장 완료", {
              instanceId: updatedInstance.id,
              driveFileId: driveResult.driveFileId,
            });
          } else {
            logger.error("[PATCH /api/contract-instances/[id]] Drive 저장 실패", {
              instanceId: updatedInstance.id,
              error: driveResult.error,
            });
          }
        } catch (driveErr) {
          logger.error("[PATCH /api/contract-instances/[id]] Drive 저장 예외", {
            instanceId: updatedInstance.id,
            error: driveErr instanceof Error ? driveErr.message : String(driveErr),
          });
        }
      })();
    }

    const response: ApiResponse<ContractInstanceResponse> = {
      ok: true,
      data: {
        id: updatedInstance.id,
        templateId: updatedInstance.templateId,
        templateName: updatedInstance.template.name,
        contactId: updatedInstance.contactId,
        status: updatedInstance.status,
        expiresAt: updatedInstance.expiresAt?.toISOString() || null,
        timeRemaining: getTimeRemaining(updatedInstance.expiresAt),
        signedAt: updatedInstance.signedAt?.toISOString() || null,
        createdAt: updatedInstance.createdAt.toISOString(),
        updatedAt: updatedInstance.updatedAt.toISOString(),
        smsStatus: {
          day0Sent: updatedInstance.smsDay0Sent,
          day0SentAt: updatedInstance.smsDay0SentAt?.toISOString() || null,
          day1Sent: updatedInstance.smsDay1Sent,
          day1SentAt: updatedInstance.smsDay1SentAt?.toISOString() || null,
          day2Sent: updatedInstance.smsDay2Sent,
          day2SentAt: updatedInstance.smsDay2SentAt?.toISOString() || null,
          day3Sent: updatedInstance.smsDay3Sent,
          day3SentAt: updatedInstance.smsDay3SentAt?.toISOString() || null,
        },
      },
      message: "계약서 상태가 업데이트되었습니다",
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error("[PATCH /api/contract-instances/[id]]", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
