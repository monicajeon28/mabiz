/**
 * GET/POST /api/funnel/email-preview
 *
 * Email Day 0-3 미리보기 + SMS 병렬 비교
 *
 * 용도:
 *   - Contact 상세 페이지에서 SMS/Email 미리보기
 *   - 관리자의 렌즈별 메시지 비교
 *   - 발송 전 최종 확인
 *
 * Query Parameters:
 *   ?lens=L0&day=0
 *   &name=김철수&destination=발리 크루즈
 *   &price=1,490,000&managerName=박미정&managerPhone=1800-0222-2299
 *
 * Response:
 *   {
 *     success: boolean,
 *     data: {
 *       day, lens, subject, body, charCount, psychology, tone,
 *       sms: { text, charCount, sendCount },
 *       email: { subject, body, charCount }
 *     },
 *     error?: string
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { renderEmailPreview, prepareMultiChannelSequence, getLensMetadata } from "@/lib/funnel-email-preview";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Required parameters
    const lens = searchParams.get("lens") || "L0";
    const dayStr = searchParams.get("day");

    if (!dayStr || !["0", "1", "2", "3"].includes(dayStr)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid day parameter. Must be 0, 1, 2, or 3",
        },
        { status: 400 }
      );
    }

    const day = parseInt(dayStr) as 0 | 1 | 2 | 3;

    // Extract variables from query params
    const variables: Record<string, string> = {};

    // Contact-related
    if (searchParams.has("name")) variables.name = searchParams.get("name") || "고객님";
    if (searchParams.has("phone")) variables.phone = searchParams.get("phone") || "";

    // Product-related
    if (searchParams.has("destination")) variables.destination = searchParams.get("destination") || "여행지";
    if (searchParams.has("price")) variables.price = searchParams.get("price") || "정상가";
    if (searchParams.has("monthlyPrice")) variables.monthlyPrice = searchParams.get("monthlyPrice") || "월 정상가";
    if (searchParams.has("discount")) variables.discount = searchParams.get("discount") || "할인액";
    if (searchParams.has("daysLeft")) variables.daysLeft = searchParams.get("daysLeft") || "3일";
    if (searchParams.has("remainingSeats")) variables.remainingSeats = searchParams.get("remainingSeats") || "10";

    // Manager-related
    if (searchParams.has("managerName")) variables.managerName = searchParams.get("managerName") || "매니저";
    if (searchParams.has("managerPhone")) variables.managerPhone = searchParams.get("managerPhone") || "1800-XXXX";
    if (searchParams.has("managerTitle")) variables.managerTitle = searchParams.get("managerTitle") || "컨설턴트";

    // Booking-related
    if (searchParams.has("bookingRef")) variables.bookingRef = searchParams.get("bookingRef") || "BOOKING-001";
    if (searchParams.has("daysUntilDeparture")) variables.daysUntilDeparture = searchParams.get("daysUntilDeparture") || "45";

    // Generate preview
    const emailPreview = renderEmailPreview(lens, day, variables);
    const multiChannel = prepareMultiChannelSequence(lens, day, variables);
    const lensInfo = getLensMetadata(lens);

    return NextResponse.json(
      {
        success: true,
        data: {
          ...emailPreview,
          sms: multiChannel.sms,
          lensInfo,
          variables, // Echo back variables for client-side debugging
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[email-preview API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { lens = "L0", day, variables = {} } = body;

    if (!day || ![0, 1, 2, 3].includes(day)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid day. Must be 0, 1, 2, or 3",
        },
        { status: 400 }
      );
    }

    // Generate preview
    const emailPreview = renderEmailPreview(lens, day, variables);
    const multiChannel = prepareMultiChannelSequence(lens, day, variables);
    const lensInfo = getLensMetadata(lens);

    return NextResponse.json(
      {
        success: true,
        data: {
          ...emailPreview,
          sms: multiChannel.sms,
          lensInfo,
          multiChannel,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[email-preview API] POST error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
