import prisma from "@/lib/prisma";
import { NextRequest } from "next/server";

export interface AuditLogParams {
  organizationId: string;
  templateId: string;
  userId?: string | null;
  action: "CREATE" | "UPDATE" | "DELETE" | "RESTORE" | "PUBLISH" | "ARCHIVE";
  previousValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  changeDescription?: string;
  reason?: string;
  request?: NextRequest;
  error?: Error | null;
}

/**
 * IP 주소 추출
 */
export function getClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") || null;
}

/**
 * User Agent 추출
 */
export function getUserAgent(request: NextRequest): string | null {
  return request.headers.get("user-agent");
}

/**
 * 감사 로그 기록
 */
export async function logContractTemplateAudit(
  params: AuditLogParams
): Promise<void> {
  try {
    const {
      organizationId,
      templateId,
      userId,
      action,
      previousValues,
      newValues,
      changeDescription,
      reason,
      request,
      error,
    } = params;

    const ipAddress = request ? getClientIp(request) : null;
    const userAgent = request ? getUserAgent(request) : null;

    await prisma.contractTemplateAuditLog.create({
      data: {
        organizationId,
        templateId,
        userId,
        action,
        ...(previousValues !== null && previousValues !== undefined ? { previousValues } : {}),
        ...(newValues !== null && newValues !== undefined ? { newValues } : {}),
        changeDescription,
        reason,
        status: error ? "FAILED" : "SUCCESS",
        errorMessage: error?.message || null,
        ipAddress,
        userAgent,
      },
    });
  } catch (logError) {
    console.error("[ContractTemplateAudit] Failed to log audit:", logError);
    // 감사 로그 실패는 주요 작업 실패로 간주하지 않음
  }
}

/**
 * 변경값 비교하여 설명 생성
 */
export function generateChangeDescription(
  previousValues: Record<string, any>,
  newValues: Record<string, any>
): string {
  const changes: string[] = [];

  for (const [key, newValue] of Object.entries(newValues)) {
    const previousValue = previousValues[key];
    if (JSON.stringify(previousValue) !== JSON.stringify(newValue)) {
      if (key === "name") {
        changes.push(`name: "${previousValue}" → "${newValue}"`);
      } else if (key === "status") {
        changes.push(`status: ${previousValue} → ${newValue}`);
      } else if (key === "description") {
        changes.push(`description updated`);
      } else if (key === "htmlContent") {
        changes.push(`htmlContent updated`);
      } else if (key === "psychologyLenses") {
        changes.push(
          `psychologyLenses: [${previousValue?.join(",")}] → [${newValue?.join(",")}]`
        );
      } else if (key === "visibility") {
        changes.push(`visibility: ${previousValue} → ${newValue}`);
      } else {
        changes.push(`${key} updated`);
      }
    }
  }

  return changes.join("; ") || "Template updated";
}

/**
 * 민감한 필드 마스킹 (감사 로그 저장 전)
 */
export function maskSensitiveFields(
  data: Record<string, any>
): Record<string, any> {
  const masked = { ...data };

  // HTML 콘텐츠는 길이만 표시
  if (masked.htmlContent && typeof masked.htmlContent === "string") {
    masked.htmlContent = `[HTML Content, ${masked.htmlContent.length} chars]`;
  }

  // fieldMapping은 키만 표시
  if (masked.fieldMapping && typeof masked.fieldMapping === "object") {
    masked.fieldMapping = {
      keys: Object.keys(masked.fieldMapping),
    };
  }

  return masked;
}

/**
 * 템플릿 사용 중인 인스턴스 확인
 */
export async function getTemplateUsageCount(
  templateId: string
): Promise<number> {
  const count = await prisma.contractInstance.count({
    where: {
      templateId,
      status: {
        in: ["DRAFT", "SENT"], // 진행 중인 상태만 카운트
      },
    },
  });
  return count;
}

/**
 * 템플릿 삭제 가능 여부 확인
 */
export async function canDeleteTemplate(templateId: string): Promise<{
  canDelete: boolean;
  activeInstanceCount: number;
  reason?: string;
}> {
  const activeCount = await getTemplateUsageCount(templateId);

  return {
    canDelete: activeCount === 0,
    activeInstanceCount: activeCount,
    reason:
      activeCount > 0
        ? `${activeCount}개의 진행 중인 계약서가 이 템플릿을 사용 중입니다`
        : undefined,
  };
}

/**
 * 감사 로그 조회
 */
export async function getAuditLogs(
  organizationId: string,
  templateId: string,
  limit: number = 50
) {
  return prisma.contractTemplateAuditLog.findMany({
    where: {
      organizationId,
      templateId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });
}
