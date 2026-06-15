import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { renderSmsTemplate, validateSmsVariables } from "@/lib/sms-variables";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * POST /api/sms/preview
 *
 * SMS 메시지 템플릿에 변수를 입력하여 최종 메시지를 미리봅니다.
 *
 * 요청:
 * {
 *   "message": "안녕하세요 {{name}}님! {{destination}}으로 떠나세요.",
 *   "variables": {
 *     "name": "김철수",
 *     "destination": "부산"
 *   }
 * }
 *
 * 응답:
 * {
 *   "ok": true,
 *   "preview": "안녕하세요 김철수님! 부산으로 떠나세요.",
 *   "length": 31,
 *   "messageType": "SMS",
 *   "maxLength": 90,
 *   "missingVariables": [],
 *   "warnings": []
 * }
 */

/**
 * SMS 길이 검증 함수
 * - 한글: 90자 이내 (SMS 기본) / 450자 (LMS 장문)
 * - 영문/숫자: 160자 이내 (SMS 기본) / 450자 (LMS 장문)
 *
 * @param message SMS 메시지
 * @returns { valid, length, messageType, maxLength }
 */
function validateSmsLength(message: string): {
  valid: boolean;
  length: number;
  messageType: "SMS" | "LMS";
  maxLength: number;
} {
  const length = message.length;

  // 한글 포함 여부 확인 (한글은 유니코드 AC00-D7A3)
  const hasKorean = /[가-힣]/.test(message);

  if (hasKorean) {
    // 한글 포함: 90자 (SMS) 또는 450자 (LMS)
    if (length <= 90) {
      return { valid: true, length, messageType: "SMS", maxLength: 90 };
    } else if (length <= 450) {
      return { valid: true, length, messageType: "LMS", maxLength: 450 };
    } else {
      return { valid: false, length, messageType: "LMS", maxLength: 450 };
    }
  } else {
    // 영문/숫자만: 160자 (SMS) 또는 450자 (LMS)
    if (length <= 160) {
      return { valid: true, length, messageType: "SMS", maxLength: 160 };
    } else if (length <= 450) {
      return { valid: true, length, messageType: "LMS", maxLength: 450 };
    } else {
      return { valid: false, length, messageType: "LMS", maxLength: 450 };
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.organizationId && session?.role !== "GLOBAL_ADMIN") {
      return NextResponse.json(
        { error: "인증 필요합니다" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { message, variables = {} } = body;

    // 입력 검증
    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "메시지가 필요합니다" },
        { status: 400 }
      );
    }

    if (typeof variables !== "object" || variables === null) {
      return NextResponse.json(
        { error: "변수는 객체여야 합니다" },
        { status: 400 }
      );
    }

    // 1단계: 템플릿 렌더링
    const preview = renderSmsTemplate(message, variables);

    // 1-1단계: 렌더링된 메시지 길이 검증
    const lengthValidation = validateSmsLength(preview);
    if (!lengthValidation.valid) {
      return NextResponse.json(
        {
          ok: false,
          error: `메시지는 ${lengthValidation.maxLength}자 이하여야 합니다 (현재: ${lengthValidation.length}자)`,
          length: lengthValidation.length,
          maxLength: lengthValidation.maxLength,
        },
        { status: 400 }
      );
    }

    // 2단계: 변수 검증
    const validation = validateSmsVariables(message, Object.keys(variables));

    // 3단계: 로그 저장 (분석용)
    try {
      await prisma.smsPreviewLog.create({
        data: {
          organizationId: session.organizationId || "GLOBAL",
          userId: session.userId || "unknown",
          message,
          variables: variables as any,
          feedback: null,
          approved: false,
        },
      });
    } catch (err) {
      logger.error("[SmsPreviewLog] 로그 저장 실패", err);
      // 로그 저장 실패는 응답을 실패시키지 않음
    }

    return NextResponse.json({
      ok: true,
      preview,
      length: lengthValidation.length,
      messageType: lengthValidation.messageType,
      maxLength: lengthValidation.maxLength,
      missingVariables: validation.missing,
      warnings: validation.missing.length > 0
        ? validation.missing.map((v) => `변수 '${v}'가 없습니다`)
        : [],
    });
  } catch (err) {
    logger.error("[SmsPreviewError]", err);
    return NextResponse.json(
      { error: "미리보기 생성 실패" },
      { status: 500 }
    );
  }
}
