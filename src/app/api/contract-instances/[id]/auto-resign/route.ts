import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logContractAction } from "@/lib/contract-audit-log";
import { sendReSignCompletedEmail } from "@/lib/contract-modification-emails";

interface ReSignRequest {
  signatureImage: string; // base64 PNG
  modificationRequestId: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);
    const { id: contractId } = resolvedParams;

    let body: ReSignRequest;
    try {
      body = (await req.json()) as ReSignRequest;
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    // 1️⃣ 검증: 고객이 자신의 계약서를 수정하는가?
    const contract = await prisma.contractInstance.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 }
      );
    }

    // 고객 또는 조직 관리자만 서명 가능
    const isOwner = contract.contactId === session.userId;
    const isOrgAdmin = contract.organizationId === session.organizationId &&
                      (session.role === "OWNER" || session.role === "AGENT");

    if (!isOwner && !isOrgAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 고객 정보 로드 (이메일 발송용)
    const contactInfo = contract.contactId
      ? await prisma.contact.findUnique({
          where: { id: contract.contactId },
          select: { name: true, email: true },
        })
      : null;

    // 2️⃣ 검증: 수정 요청 상태 확인
    const modRequest = await prisma.contractModificationRequest.findUnique({
      where: { id: body.modificationRequestId },
    });

    if (!modRequest || modRequest.contractId !== contractId) {
      return NextResponse.json(
        { error: "Modification request not found" },
        { status: 404 }
      );
    }

    if (modRequest.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Modification must be approved first" },
        { status: 409 }
      );
    }

    // 3️⃣ 서명 검증 (base64 PNG)
    if (!body.signatureImage || !body.signatureImage.startsWith("data:image")) {
      return NextResponse.json(
        { error: "Invalid signature format" },
        { status: 400 }
      );
    }

    // 4️⃣ 트랜잭션: 서명 저장 + 상태 업데이트 + 수정 요청 완료 + 감사 로그
    let result;
    try {
      result = await prisma.$transaction(
        async (tx) => {
          // Step 1: 새 서명 저장 (수정된 버전)
          const updatedContract = await tx.contractInstance.update({
            where: { id: contractId },
            data: {
              status: "COMPLETED", // MODIFICATION_APPROVED → SIGNED → COMPLETED
              signatureImage: body.signatureImage, // 수정된 서명
              signedAt: new Date(),
              signedByContactId: session.userId,
              updatedAt: new Date(),
            },
          });

          // Step 2: 수정 요청 상태 변경 (APPROVED → COMPLETED)
          const updatedModRequest = await tx.contractModificationRequest.update({
            where: { id: body.modificationRequestId },
            data: {
              status: "COMPLETED",
              completedAt: new Date(),
              updatedAt: new Date(),
            },
          });

          // Step 3: 감사 로그 기록
          const ipAddress = req.headers.get("x-forwarded-for") ||
                           req.headers.get("x-real-ip") ||
                           "unknown";

          await tx.contractAuditLog.create({
            data: {
              contractId: contractId,
              organizationId: contract.organizationId,
              action: "re_signed",
              timestamp: new Date(),
              userId: session.userId,
              ipAddress: ipAddress,
              userAgent: req.headers.get("user-agent") || undefined,
              details: `Re-signed with modification: ${
                typeof modRequest.fieldModifications === "object"
                  ? (modRequest.fieldModifications as any[])?.[0]?.fieldName || "unknown"
                  : "unknown"
              }`,
            },
          });

          return { contract: updatedContract, modRequest: updatedModRequest };
        },
        {
          isolationLevel: "Serializable", // ← P0-4: Race Condition 완전 방지
          timeout: 10000, // ← 10초 타임아웃
        }
      );

      // 트랜잭션 성공: 5️⃣ 비블로킹: 이메일 발송 (백그라운드)
      if (contactInfo?.email) {
        const fieldMods = modRequest.fieldModifications as any;
        const firstMod = Array.isArray(fieldMods) ? fieldMods[0] : fieldMods;

        sendReSignCompletedEmail(contactInfo.email, {
          customerName: contactInfo.name || "고객",
          fieldName: firstMod?.fieldName || "계약서",
          currentValue: firstMod?.oldValue || "이전",
          newValue: firstMod?.newValue || "수정됨",
          requestId: body.modificationRequestId,
          expiresAt: modRequest.expiresAt || new Date(),
          appliedLenses: modRequest.lensApplied || ["L2", "L6", "L7", "L10"],
        }).catch((err) => {
          // 로깅만 하고 계속 진행 (이메일 실패는 비블로킹)
          console.warn("[Re-sign Email Send Error]", err instanceof Error ? err.message : String(err));
        });
      }

      // 6️⃣ 응답
      return NextResponse.json({
        message: "✅ 재서명 완료! 계약서가 확정되었습니다.",
        contract: {
          id: result.contract.id,
          status: result.contract.status,
          signedAt: result.contract.signedAt,
          modificationApplied: firstModFieldName(modRequest.fieldModifications),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (txError) {
      // 트랜잭션 실패 = 자동 롤백
      console.error("[AUTO_RESIGN_TRANSACTION_ERROR]", {
        error: txError instanceof Error ? txError.message : String(txError),
        contractId,
        modificationRequestId: body.modificationRequestId,
      });

      // Prisma 특정 에러 처리
      if (txError instanceof Error && txError.message.includes("P2025")) {
        return NextResponse.json(
          { error: "레코드를 찾을 수 없습니다. 계약서 또는 수정 요청이 삭제되었을 수 있습니다." },
          { status: 404 }
        );
      }

      // 기타 데이터베이스 에러
      if (txError instanceof Error && (txError.message.includes("Serializable") || txError.message.includes("timeout"))) {
        return NextResponse.json(
          { error: "동시 접근으로 인한 충돌이 발생했습니다. 잠시 후 다시 시도해주세요." },
          { status: 409 }
        );
      }

      // 일반 서버 에러
      return NextResponse.json(
        { error: "재서명 처리 중 오류가 발생했습니다. 다시 시도해주세요." },
        { status: 500 }
      );
    }
  } catch (error) {
    // 트랜잭션 외부 에러 (요청 검증 단계)
    console.error("[AUTO_RESIGN_ERROR]", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: "요청 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

function firstModFieldName(mods: unknown): string {
  if (Array.isArray(mods)) {
    return mods[0]?.fieldName || "unknown";
  }
  if (typeof mods === "object" && mods) {
    return (mods as any).fieldName || "unknown";
  }
  return "unknown";
}
