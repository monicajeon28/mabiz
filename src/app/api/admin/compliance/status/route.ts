import { NextResponse } from "next/server";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import { checkGDPRCompliance, generateComplianceReport } from "@/lib/compliance-monitor";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    // GLOBAL_ADMIN만 접근 가능
    if (ctx.role !== "GLOBAL_ADMIN") {
      return NextResponse.json(
        { ok: false, message: "권한 없음" },
        { status: 403 }
      );
    }

    const [compliance, report] = await Promise.all([
      checkGDPRCompliance(orgId),
      generateComplianceReport(orgId),
    ]);

    logger.log("[Compliance Status] 조회", {
      organizationId: orgId,
      score: compliance.score,
    });

    return NextResponse.json({
      ok: true,
      data: {
        score: compliance.score,
        compliant: compliance.compliant,
        issues: compliance.issues,
        report,
        lastChecked: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error("[Compliance Status]", { err });
    return NextResponse.json(
      { ok: false, message: "규정 준수 확인 실패" },
      { status: 500 }
    );
  }
}
