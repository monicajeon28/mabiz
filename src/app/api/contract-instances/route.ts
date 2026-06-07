import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getMabizSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  createContractInstanceSchema,
  listContractInstancesQuerySchema,
} from "@/lib/validations/contract-templates";
import {
  ContractInstanceResponse,
  ApiResponse,
} from "@/lib/types/contract-templates";

/**
 * 필드 매핑: {{변수명}} → 실제 값으로 치환
 */
function renderHtmlContent(
  template: string,
  fieldMapping: Record<string, string>,
  boundData: Record<string, string>
): string {
  let html = template;

  // fieldMapping을 순회하며 HTML 내의 {{변수명}}을 boundData로 치환
  for (const [placeholder, fieldKey] of Object.entries(fieldMapping)) {
    const value = boundData[fieldKey] || "";
    const regex = new RegExp(`{{${placeholder}}}`, "g");
    html = html.replace(regex, value);
  }

  return html;
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
 * GET /api/contract-instances
 * 계약서 인스턴스 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const authContext = await getMabizSession();
    if (!authContext) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { organizationId } = authContext;

    // 쿼리 파라미터 파싱
    const searchParams = request.nextUrl.searchParams;
    const queryData = {
      status: searchParams.get("status") || undefined,
      templateId: searchParams.get("templateId") || undefined,
      contactId: searchParams.get("contactId") || undefined,
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!) : 1,
      limit: searchParams.get("limit")
        ? parseInt(searchParams.get("limit")!)
        : 20,
    };

    const validatedQuery = listContractInstancesQuerySchema.parse(queryData);
    const { status, templateId, contactId, page, limit } = validatedQuery;

    // 필터 조건 구성
    const where: any = {
      organizationId,
    };

    if (status) where.status = status;
    if (templateId) where.templateId = templateId;
    if (contactId) where.contactId = contactId;

    // 페이지네이션
    const skip = (page - 1) * limit;

    // 데이터 조회
    const [instances, totalCount] = await Promise.all([
      prisma.contractInstance.findMany({
        where,
        include: {
          template: {
            select: { name: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.contractInstance.count({ where }),
    ]);

    // 응답 포맷팅
    const responseData: ContractInstanceResponse[] = instances.map((i) => ({
      id: i.id,
      templateId: i.templateId,
      templateName: i.template.name,
      contactId: i.contactId,
      status: i.status,
      expiresAt: i.expiresAt?.toISOString() || null,
      timeRemaining: getTimeRemaining(i.expiresAt),
      smsStatus: {
        day0Sent: i.smsDay0Sent,
        day0SentAt: i.smsDay0SentAt?.toISOString() || null,
        day1Sent: i.smsDay1Sent,
        day1SentAt: i.smsDay1SentAt?.toISOString() || null,
        day2Sent: i.smsDay2Sent,
        day2SentAt: i.smsDay2SentAt?.toISOString() || null,
        day3Sent: i.smsDay3Sent,
        day3SentAt: i.smsDay3SentAt?.toISOString() || null,
      },
      createdAt: i.createdAt.toISOString(),
    }));

    const response: ApiResponse<ContractInstanceResponse[]> = {
      ok: true,
      data: responseData,
      message: `총 ${totalCount}개 계약서 조회됨 (페이지 ${page}/${Math.ceil(totalCount / limit)})`,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error("[GET /api/contract-instances]", { error: error instanceof Error ? error.message : String(error) });
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { ok: false, error: "Invalid query parameters" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/contract-instances
 * 계약서 인스턴스 생성 + SMS 자동화 연동
 */
export async function POST(request: NextRequest) {
  try {
    const authContext = await getMabizSession();
    if (!authContext) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { organizationId, userId } = authContext;

    const body = await request.json();

    // 입력 검증
    const validatedData = createContractInstanceSchema.parse(body);
    const { templateId, contactId, boundData, autoSendSms = true } =
      validatedData;

    // 템플릿 존재 확인
    const template = await prisma.contractTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return NextResponse.json(
        { ok: false, error: "템플릿을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 권한 확인
    if (template.organizationId !== organizationId) {
      return NextResponse.json(
        { ok: false, error: "접근 권한이 없습니다" },
        { status: 403 }
      );
    }

    // Contact 존재 확인 (선택사항)
    if (contactId) {
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
      });

      if (!contact || contact.organizationId !== organizationId) {
        return NextResponse.json(
          { ok: false, error: "연락처를 찾을 수 없습니다" },
          { status: 404 }
        );
      }
    }

    // HTML 렌더링
    const renderedHtml = renderHtmlContent(
      template.htmlContent || "",
      template.fieldMapping as Record<string, string>,
      boundData as Record<string, string>
    );

    // 유효기한 설정 (24시간 후, L10 렌즈)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // 계약서 인스턴스 생성
    const instance = await prisma.contractInstance.create({
      data: {
        organizationId,
        templateId,
        contactId: contactId || null,
        boundData: boundData as Prisma.InputJsonValue,
        status: "DRAFT",
        expiresAt,
        appliedLenses: template.psychologyLenses,
      },
      include: {
        template: { select: { name: true } },
      },
    });

    // 템플릿 사용 통계 업데이트
    await prisma.contractTemplate.update({
      where: { id: templateId },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });

    // SMS 자동화 큐잉 (Day 0-3)
    if (autoSendSms && contactId) {
      // ContactLensClassification 또는 ContactLensSequence 생성
      // 여러 렌즈가 있을 수 있으므로 각 렌즈별로 처리

      for (const lens of template.psychologyLenses) {
        // ContactLensClassification 조회 또는 생성
        let classification = await prisma.contactLensClassification.findUnique(
          {
            where: {
              organizationId_contactId_lensType: {
                organizationId,
                contactId,
                lensType: lens,
              },
            },
          }
        );

        if (!classification) {
          classification = await prisma.contactLensClassification.create({
            data: {
              organizationId,
              contactId,
              lensType: lens,
              status: "ACTIVE",
            },
          });
        }

        // ContactLensSequence 생성 (SMS 자동화 추적용)
        await prisma.contactLensSequence.create({
          data: {
            organizationId,
            contactId,
            classificationId: classification.id,
            sequenceType: "CONTRACTED",
            lensType: lens,
            status: "PENDING",
          },
        });
      }

      // ScheduledSms 큐잉 (Day 0-3)
      const daySchedule: Array<{ templateId: string | null; daysOffset: number }> = [
        { templateId: template.smsDay0TemplateId ?? null, daysOffset: 0 },
        { templateId: template.smsDay1TemplateId ?? null, daysOffset: 1 },
        { templateId: template.smsDay2TemplateId ?? null, daysOffset: 2 },
        { templateId: template.smsDay3TemplateId ?? null, daysOffset: 3 },
      ];

      for (const { templateId: smsTplId, daysOffset } of daySchedule) {
        if (!smsTplId) continue;
        const smsTpl = await prisma.smsTemplate.findUnique({ where: { id: smsTplId }, select: { content: true } });
        if (!smsTpl) continue;

        const scheduledAt = new Date();
        if (daysOffset > 0) {
          scheduledAt.setDate(scheduledAt.getDate() + daysOffset);
          scheduledAt.setHours(10, 0, 0, 0); // 오전 10시 발송
        }

        await prisma.scheduledSms.create({
          data: {
            organizationId,
            contactId,
            message: smsTpl.content,
            scheduledAt,
            status: 'PENDING',
            channel: 'SMS',
            createdByUserId: userId,
          },
        });

        logger.info('[ContractInstances] SMS Day 자동발송 스케줄링', {
          daysOffset,
          smsTplId,
          contactId,
          scheduledAt,
        });
      }
    }

    // 응답
    const response: ApiResponse<any> = {
      ok: true,
      data: {
        id: instance.id,
        templateId: instance.templateId,
        status: instance.status,
        renderedHtml,
        expiresAt: instance.expiresAt?.toISOString() || null,
        appliedLenses: instance.appliedLenses,
      },
      message: "계약서가 성공적으로 생성되었습니다",
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    logger.error("[POST /api/contract-instances]", { error: error instanceof Error ? error.message : String(error) });
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
