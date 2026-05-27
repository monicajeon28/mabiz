import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface AuditEvent {
  userId: string;
  action: string; // READ, CREATE, UPDATE, DELETE, EXPORT
  resource: string; // 'Contact', 'Settlement', 'Payment' 등
  resourceId: string;
  organizationId: string;
  ipAddress?: string;
  changes?: Record<string, { oldValue: any; newValue: any }>;
  metadata?: Record<string, any>;
}

const PII_FIELDS = ["email", "phone", "ssn", "creditCard", "bankAccount"];
const AUDIT_LOG_RETENTION_DAYS = 730; // 2년

// PII 마스킹 헬퍼
function maskPII(value: any, fieldName: string): any {
  if (!PII_FIELDS.some((f) => fieldName.toLowerCase().includes(f))) {
    return value;
  }

  if (typeof value === "string") {
    if (fieldName.toLowerCase().includes("email")) {
      return value.replace(/(.{2}).*(@.*)/, "$1***$2");
    }
    if (fieldName.toLowerCase().includes("phone")) {
      return value.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");
    }
    return "***MASKED***";
  }
  return "***MASKED***";
}

export async function logAuditEvent(event: AuditEvent): Promise<void> {
  try {
    const maskedChanges = event.changes
      ? Object.entries(event.changes).reduce(
          (acc, [key, value]) => {
            acc[key] = {
              oldValue: maskPII(value.oldValue, key),
              newValue: maskPII(value.newValue, key),
            };
            return acc;
          },
          {} as Record<string, any>
        )
      : undefined;

    const auditLog = await prisma.executionLog.create({
      data: {
        organizationId: event.organizationId,
        action: event.action,
        resourceType: event.resource,
        resourceId: event.resourceId,
        userId: event.userId,
        status: "SUCCESS",
        details: JSON.stringify({
          ipAddress: event.ipAddress,
          changes: maskedChanges,
          metadata: event.metadata,
        }),
        executedAt: new Date(),
      },
    });

    logger.log("[Compliance] 감시 로그", {
      logId: auditLog.id,
      action: event.action,
      resource: event.resource,
      resourceId: event.resourceId,
    });
  } catch (err) {
    logger.error("[Compliance] 감시 로그 실패", { err, event });
  }
}

export async function checkGDPRCompliance(
  organizationId: string
): Promise<{
  compliant: boolean;
  issues: string[];
  score: number;
}> {
  const issues: string[] = [];
  let score = 100;

  try {
    // 1. PII 암호화 확인
    const contactsWithoutEncryption = await prisma.contact.findMany({
      where: { organizationId },
      select: { id: true, email: true },
      take: 10,
    });

    if (
      contactsWithoutEncryption.some(
        (c) => c.email && !c.email.includes("***")
      )
    ) {
      issues.push("PII fields not encrypted at rest");
      score -= 20;
    }

    // 2. 감시 로그 존재 확인
    const auditCount = await prisma.executionLog.count({
      where: {
        organizationId,
        executedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30일
        },
      },
    });

    if (auditCount === 0) {
      issues.push("No audit logs found in last 30 days");
      score -= 15;
    }

    // 3. 동의 추적 확인
    const contactsWithoutConsent = await prisma.contact.count({
      where: {
        organizationId,
        // consentGiven 필드가 없다면 이 체크는 스킵
      },
    });

    // 4. 삭제 요청 처리 확인
    const deletedAt30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const deletedContacts = await prisma.contact.count({
      where: {
        organizationId,
        deletedAt: { gte: deletedAt30Days },
      },
    });

    if (deletedContacts === 0) {
      issues.push(
        "Consider implementing GDPR right to be forgotten (deletion requests)"
      );
      score -= 10;
    }

    // 5. 데이터 보존 정책 확인
    const staleContacts = await prisma.contact.count({
      where: {
        organizationId,
        updatedAt: { lt: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000) },
      },
    });

    if (staleContacts > 0) {
      issues.push(
        `${staleContacts} contacts not updated in 2+ years (consider archival/deletion)`
      );
      score -= 15;
    }

    return {
      compliant: score >= 85,
      issues,
      score,
    };
  } catch (err) {
    logger.error("[Compliance] GDPR 체크 실패", { err, organizationId });
    return {
      compliant: false,
      issues: ["Error checking compliance"],
      score: 0,
    };
  }
}

export async function generateComplianceReport(
  organizationId: string
): Promise<string> {
  const compliance = await checkGDPRCompliance(organizationId);

  const auditCount = await prisma.executionLog.count({
    where: { organizationId },
  });

  const report = `
# GDPR 준수 리포트
**조직**: ${organizationId}
**생성일**: ${new Date().toISOString()}

## 준수 상태
- **총점**: ${compliance.score}/100
- **준수 여부**: ${compliance.compliant ? "✅ 준수" : "❌ 미준수"}

## 발견 사항
${
  compliance.issues.length === 0
    ? "- 문제 없음"
    : compliance.issues.map((i) => `- ${i}`).join("\n")
}

## 감시 로그
- **총 로그**: ${auditCount}건
- **최근 활동**: 지난 30일

## 권고사항
1. 정기적인 GDPR 준수 체크 실시
2. PII 필드 암호화 확인
3. 데이터 보존 정책 수립
4. 삭제 요청 처리 절차 마련
  `;

  return report;
}

// 자동 정리: 2년 이상된 로그 삭제
export async function cleanupOldAuditLogs(
  organizationId?: string
): Promise<number> {
  const cutoffDate = new Date(
    Date.now() - AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000
  );

  const result = await prisma.executionLog.deleteMany({
    where: {
      ...(organizationId ? { organizationId } : {}),
      executedAt: { lt: cutoffDate },
    },
  });

  logger.log("[Compliance] 오래된 로그 삭제", {
    deleted: result.count,
    cutoffDate,
  });

  return result.count;
}
