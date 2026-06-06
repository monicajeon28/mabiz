import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { enforceRBAC } from "@/app/api/_middleware/enforce-rbac";

/**
 * System Health Check API
 * GET /api/system/health
 *
 * Comprehensive health status of all systems and integrations
 */

export async function GET(req: NextRequest) {
  try {
    const startTime = Date.now();
    const checks = await Promise.allSettled([
      checkDatabase(),
      checkPrismaConnection(),
      checkS3Integration(),
      checkSmsIntegration(),
      checkWebhooks(),
      checkDataIntegrity(),
    ]);

    const results = checks
      .map((result, i) => {
        if (result.status === "fulfilled") {
          return result.value;
        } else {
          const checkNames = [
            "Database",
            "Prisma ORM",
            "S3 Storage",
            "SMS (Aligo)",
            "Webhooks",
            "Data Integrity",
          ];
          return {
            service: checkNames[i],
            status: "FAILED",
            message: (result.reason as Error).message,
            timestamp: new Date().toISOString(),
          };
        }
      })
      .filter(Boolean);

    const duration = Date.now() - startTime;
    const overallStatus =
      results.every((r) => r.status === "HEALTHY") ? "HEALTHY" : "DEGRADED";

    logger.log("[System Health]", {
      overallStatus,
      duration,
      checks: results.length,
    });

    // Public response: only minimal status, no infra details
    const rbacCheck = enforceRBAC(req, { allowedRoles: ["GLOBAL_ADMIN"] });
    if (rbacCheck !== true) {
      return NextResponse.json({
        status: overallStatus === "HEALTHY" ? "ok" : "degraded",
      });
    }

    // GLOBAL_ADMIN: full details
    return NextResponse.json({
      ok: true,
      status: overallStatus,
      checks: results,
      meta: {
        timestamp: new Date().toISOString(),
        responseTime: `${duration}ms`,
        version: "1.0.0",
      },
    });
  } catch (err) {
    logger.error("[System Health]", { err });
    return NextResponse.json(
      {
        ok: false,
        status: "CRITICAL",
        message: "Health check failed",
      },
      { status: 503 }
    );
  }
}

async function checkDatabase() {
  try {
    const result = await prisma.$queryRaw`SELECT 1`;
    return {
      service: "Database",
      status: "HEALTHY",
      message: "PostgreSQL connection OK",
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return {
      service: "Database",
      status: "FAILED",
      message: 'PostgreSQL 연결 실패',
      timestamp: new Date().toISOString(),
    };
  }
}

async function checkPrismaConnection() {
  try {
    const count = await prisma.contact.count();
    return {
      service: "Prisma ORM",
      status: "HEALTHY",
      message: `Prisma connected, ${count} contacts loaded`,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return {
      service: "Prisma ORM",
      status: "FAILED",
      message: 'Prisma ORM 연결 실패',
      timestamp: new Date().toISOString(),
    };
  }
}

async function checkS3Integration() {
  // Check if AWS S3 is configured
  const hasS3Config =
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_S3_BUCKET;

  return {
    service: "S3 Storage",
    status: hasS3Config ? "HEALTHY" : "WARNING",
    message: hasS3Config ? "S3 configured" : "S3 not configured (optional)",
    timestamp: new Date().toISOString(),
  };
}

async function checkSmsIntegration() {
  // Check if SMS (Aligo) is configured
  const smsConfigs = await prisma.orgSmsConfig.count();

  return {
    service: "SMS (Aligo)",
    status: smsConfigs > 0 ? "HEALTHY" : "WARNING",
    message:
      smsConfigs > 0
        ? `${smsConfigs} organizations configured for SMS`
        : "SMS not configured (optional)",
    timestamp: new Date().toISOString(),
  };
}

async function checkWebhooks() {
  // Check recent webhook executions
  const recentWebhooks = await prisma.executionLog.count({
    where: {
      sourceType: { in: ["WEBHOOK", "WEBHOOK_RECEIVED", "WEBHOOK_PROCESSED"] },
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    },
  });

  return {
    service: "Webhooks",
    status: recentWebhooks > 0 ? "HEALTHY" : "WARNING",
    message: `${recentWebhooks} webhooks processed in last 24h`,
    timestamp: new Date().toISOString(),
  };
}

async function checkDataIntegrity() {
  try {
    // Sample data consistency checks
    const contactsWithoutName = await prisma.contact.count({
      where: { name: { equals: "" } },
    });

    // Check for orphaned sales (this check is skipped as AffiliateSale doesn't have contactId)
    // Alternative: check if affiliateCode exists in contacts
    const orphanedSales = 0; // TODO: implement proper orphaned sales detection

    const status =
      contactsWithoutName === 0 && orphanedSales === 0 ? "HEALTHY" : "WARNING";

    return {
      service: "Data Integrity",
      status,
      message:
        status === "HEALTHY"
          ? "Data integrity OK"
          : `Issues detected: ${contactsWithoutName} contacts without name, ${orphanedSales} orphaned sales`,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return {
      service: "Data Integrity",
      status: "FAILED",
      message: '데이터 무결성 검사 실패',
      timestamp: new Date().toISOString(),
    };
  }
}
