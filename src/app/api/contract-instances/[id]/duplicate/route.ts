import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMabizSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

interface DuplicateRequest {
  newSignerName: string;
  newSignerEmail: string;
  newSignerPhone?: string;
  contactId?: string;
}

interface DuplicateResponse {
  ok: boolean;
  newContractInstanceId?: string;
  newContactId?: string;
  error?: string;
  message?: string;
}

/**
 * POST /api/contract-instances/[id]/duplicate
 * 기존 계약서를 복제하여 새 계약서 생성
 * - 기존 ContractInstance 필드 복사
 * - 새 Contact 생성 또는 기존 Contact 선택
 * - 새 ContractInstance 생성 (DRAFT 상태)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authContext = await getMabizSession();
    if (!authContext) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { organizationId } = authContext;
    const { id: originalId } = await params;

    // 1. 입력 검증
    const body = await request.json();
    const { newSignerName, newSignerEmail, newSignerPhone, contactId: existingContactId } = body as DuplicateRequest;

    // 필수 필드 검증
    const validationErrors: Record<string, string> = {};
    if (!newSignerName || newSignerName.trim().length < 2) {
      validationErrors.newSignerName = "서명자명은 2글자 이상이어야 합니다";
    }
    if (!newSignerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newSignerEmail)) {
      validationErrors.newSignerEmail = "유효한 이메일 형식이 아닙니다";
    }
    if (Object.keys(validationErrors).length > 0) {
      return NextResponse.json(
        { ok: false, error: "Validation failed", ...validationErrors },
        { status: 400 }
      );
    }

    // 2. 기존 ContractInstance 조회
    const originalInstance = await prisma.contractInstance.findUnique({
      where: { id: originalId },
      include: {
        template: {
          select: { id: true, name: true, psychologyLenses: true },
        },
      },
    });

    if (!originalInstance) {
      return NextResponse.json(
        { ok: false, error: "계약서를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 권한 확인
    if (originalInstance.organizationId !== organizationId) {
      return NextResponse.json(
        { ok: false, error: "접근 권한이 없습니다" },
        { status: 403 }
      );
    }

    // 3. Contact 처리 (새로 생성 또는 기존 선택)
    let newContactId: string | null = null;

    if (existingContactId) {
      // 기존 Contact 사용
      const existingContact = await prisma.contact.findUnique({
        where: { id: existingContactId },
      });

      if (!existingContact || existingContact.organizationId !== organizationId) {
        return NextResponse.json(
          { ok: false, error: "연락처를 찾을 수 없습니다" },
          { status: 404 }
        );
      }

      newContactId = existingContactId;
    } else {
      // 새 Contact 생성
      const newContact = await prisma.contact.create({
        data: {
          organizationId,
          name: newSignerName,
          email: newSignerEmail,
          phone: newSignerPhone || "",
          createdAt: new Date(),
        },
      });

      newContactId = newContact.id;
    }

    // 4. 새 ContractInstance 생성 (Prisma Transaction)
    const newInstance = await prisma.$transaction(async (tx) => {
      const instance = await tx.contractInstance.create({
        data: {
          organizationId,
          templateId: originalInstance.templateId,
          contactId: newContactId,
          // 기존 boundData 복사
          boundData: originalInstance.boundData || {},
          // DRAFT 상태로 초기화
          status: "DRAFT",
          // SMS 필드 초기화
          smsDay0Sent: false,
          smsDay0SentAt: null,
          smsDay1Sent: false,
          smsDay1SentAt: null,
          smsDay2Sent: false,
          smsDay2SentAt: null,
          smsDay3Sent: false,
          smsDay3SentAt: null,
          // 유효기한 설정 (24시간)
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          // 렌즈 복사
          appliedLenses: originalInstance.appliedLenses || [],
          // 재시도 필드 초기화
          retryCount: 0,
          reminderCount: 0,
          lastReminderSentAt: null,
        },
        include: {
          template: { select: { name: true } },
        },
      });

      logger.log("[POST /api/contract-instances/[id]/duplicate] 복제 완료", {
        originalId,
        newInstanceId: instance.id,
        newContactId,
      });

      return instance;
    });

    // 5. 응답
    const response: DuplicateResponse = {
      ok: true,
      newContractInstanceId: newInstance.id,
      newContactId,
      message: "계약서가 복제되었습니다",
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    logger.error("[POST /api/contract-instances/[id]/duplicate]", {
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { ok: false, error: "Invalid input data" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
