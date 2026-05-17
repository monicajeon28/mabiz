import { NextResponse } from "next/server";
import { B2BError } from "./errors";
import { logger } from "@/lib/logger";

/**
 * B2B API 에러 처리 유틸 함수
 * - B2BError: 의도한 에러 (클라이언트에 메시지 전달)
 * - 그외: 예상치 못한 서버 에러 (로깅)
 */
export function handleB2BError(err: unknown, context: string) {
  if (err instanceof B2BError) {
    return NextResponse.json(
      { ok: false, error: err.code, message: err.message },
      { status: err.statusCode }
    );
  }

  logger.error(`[${context}]`, { err });
  return NextResponse.json(
    { ok: false, error: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' },
    { status: 500 }
  );
}
