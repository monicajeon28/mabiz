export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

// 구현 예정 cron — 현재 no-op 스텁
export async function GET() {
  logger.log(`[cron] stub called`);
  return new NextResponse(null, { status: 204 });
}
