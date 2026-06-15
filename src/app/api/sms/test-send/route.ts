import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { renderSmsTemplate } from "@/lib/sms-variables";
import { sendSmsViaAligo } from "@/lib/sms-service";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * POST /api/sms/test-send
 *
 * SMS 메시지를 본인 번호로 테스트 발송합니다.
 * (일일 10회 제한)
 *
 * 요청:
 * {
 *   "message": "안녕하세요 {{name}}님!",
 *   "variables": { "name": "김철수" },
 *   "testPhoneNumber": "010-1234-5678"
 * }
 *
 * 응답:
 * {
 *   "ok": true,
 *   "testLogId": "testlog_abc123",
 *   "message": "본인 번호로 테스트 SMS 발송됨. 1분 이내 수신됩니다.",
 *   "sentAt": "2026-06-15T15:30:00Z",
 *   "status": "SENT",
 *   "dailyUsage": "5/10"
 * }
 */

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    // 인증 검증
    if (!session?.organizationId || !session.userId) {
      return NextResponse.json(
        { error: "인증 필요합니다" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { message, variables = {}, testPhoneNumber } = body;

    // 입력 검증
    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "메시지가 필요합니다" },
        { status: 400 }
      );
    }

    if (!testPhoneNumber || typeof testPhoneNumber !== "string") {
      return NextResponse.json(
        { error: "테스트 번호가 필요합니다" },
        { status: 400 }
      );
    }

    // 본인 번호 검증
    const userMember = await prisma.organizationMember.findUnique({
      where: { id: session.userId },
      select: { phone: true, role: true },
    });

    // 관리자가 아니면 본인 번호만 허용
    const isAdmin = userMember?.role === "OWNER" || session.role === "GLOBAL_ADMIN";
    const userPhone = userMember?.phone || "";

    if (!isAdmin && testPhoneNumber !== userPhone) {
      return NextResponse.json(
        {
          error:
            "본인 번호로만 테스트 발송 가능합니다. 관리자는 모든 번호로 발송할 수 있습니다.",
        },
        { status: 403 }
      );
    }

    // 일일 제한 확인 (24시간 이내)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const todayCount = await prisma.smsTestLog.count({
      where: {
        userId: session.userId,
        organizationId: session.organizationId,
        createdAt: { gte: twentyFourHoursAgo },
      },
    });

    const DAILY_LIMIT = 10;
    if (todayCount >= DAILY_LIMIT) {
      return NextResponse.json(
        {
          error: `일일 테스트 발송 ${DAILY_LIMIT}회 제한 도달. 내일 다시 시도해주세요.`,
          dailyUsage: `${todayCount}/${DAILY_LIMIT}`,
        },
        { status: 429 }
      );
    }

    // 메시지 렌더링
    const finalMessage = renderSmsTemplate(message, variables);

    // SMS 배열 처리 (문자 수 제한 확인)
    const smsLength = Buffer.byteLength(finalMessage, "utf-8");
    if (smsLength > 900) {
      return NextResponse.json(
        {
          error: `메시지가 너무 깁니다 (${smsLength}자). 900자 이내로 입력해주세요.`,
        },
        { status: 400 }
      );
    }

    // 테스트 로그 생성 (발송 전 미리 저장)
    const testLog = await prisma.smsTestLog.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        phoneNumber: testPhoneNumber,
        message,
        variables: variables as any,
        status: "PENDING",
        createdAt: new Date(),
      },
    });

    // 비동기로 SMS 발송 (응답에 포함되지 않음)
    // 실제 발송 로직은 별도로 처리
    const smsSendPromise = (async () => {
      try {
        const result = await sendSmsViaAligo(testPhoneNumber, finalMessage);

        // 결과에 따라 로그 업데이트
        await prisma.smsTestLog.update({
          where: { id: testLog.id },
          data: {
            status: result.success ? "SENT" : "FAILED",
            sentAt: result.success ? new Date() : null,
            errorMessage: result.error || null,
          },
        });

        logger.info("[TestSms] 발송 완료", {
          logId: testLog.id,
          success: result.success,
          phone: testPhoneNumber,
        });
      } catch (err) {
        logger.error("[TestSms] 발송 오류", {
          logId: testLog.id,
          error: err,
        });

        await prisma.smsTestLog.update({
          where: { id: testLog.id },
          data: {
            status: "FAILED",
            errorMessage: String(err),
          },
        });
      }
    })();

    // 응답: 로그 생성 완료 (발송은 백그라운드에서 진행)
    return NextResponse.json({
      ok: true,
      testLogId: testLog.id,
      message: "테스트 SMS 발송 요청이 접수되었습니다. 1분 이내 수신됩니다.",
      sentAt: new Date().toISOString(),
      status: "PENDING",
      dailyUsage: `${todayCount + 1}/${DAILY_LIMIT}`,
    });
  } catch (err) {
    logger.error("[TestSendError]", err);
    return NextResponse.json(
      { error: "테스트 발송 실패" },
      { status: 500 }
    );
  }
}
