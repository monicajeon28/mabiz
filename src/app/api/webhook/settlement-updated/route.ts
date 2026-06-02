import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

// 이 경로는 폐기되었습니다.
// 크루즈닷몰은 /api/webhooks/cruisedot-settlement 를 사용해야 합니다.
// 멱등성 없는 중복 처리 위험으로 인해 HTTP 410 Gone 처리.
export async function POST(request: NextRequest) {
  const callerIp = request.headers.get("x-forwarded-for") ?? "unknown";

  logger.warn("[Webhook][DEPRECATED] settlement-updated 레거시 경로 호출 감지", {
    callerIp,
    userAgent: request.headers.get("user-agent"),
    migrateToUrl: "/api/webhooks/cruisedot-settlement",
  });

  return NextResponse.json(
    {
      ok: false,
      code: "ENDPOINT_DEPRECATED",
      message:
        "이 엔드포인트는 폐기되었습니다. /api/webhooks/cruisedot-settlement 를 사용하세요.",
      migrateToUrl: "https://crm.mabiz.kr/api/webhooks/cruisedot-settlement",
      docsUrl:
        "https://crm.mabiz.kr/docs/webhooks#cruisedot-settlement",
    },
    { status: 410 }
  );
}
