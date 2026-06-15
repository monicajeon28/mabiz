import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateRiskAlerts } from "@/lib/risk-score-engine";

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.organizationId) {
      return NextResponse.json({ error: "인증 실패" }, { status: 401 });
    }

    const alerts = await generateRiskAlerts(session.organizationId);
    return NextResponse.json(alerts);
  } catch (err) {
    console.error("[RiskAlertsError]", err);
    return NextResponse.json(
      { error: "위험도 데이터를 불러올 수 없습니다" },
      { status: 500 }
    );
  }
}
