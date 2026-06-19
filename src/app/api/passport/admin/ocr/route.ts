export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireCrmManager } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';
import { extractPassportFromBuffer, PassportOcrApiError, PassportOcrEmptyResponse, PassportOcrUnreadable } from '@/lib/passport-ocr';

/**
 * 여권 이미지 OCR 처리 엔드포인트
 * POST /api/passport/admin/ocr
 *
 * 요청:
 *   FormData
 *   - file: File (여권 사진)
 *
 * 응답:
 *   {
 *     ok: boolean,
 *     data?: {
 *       korName: string,
 *       engSurname: string,
 *       engGivenName: string,
 *       passportNumber: string,
 *       nationality: string,
 *       sex: string,
 *       dateOfBirth: string,
 *       dateOfIssue: string,
 *       passportExpiryDate: string,
 *       confidence: number (0-100),
 *       warnings: string[]
 *     },
 *     message?: string,
 *     error?: string
 *   }
 */
export async function POST(req: NextRequest) {
  try {
    const manager = await requireCrmManager();
    if (!manager) {
      return NextResponse.json(
        { ok: false, error: '권한이 없습니다. (CRM 관리자 이상)' },
        { status: 403 }
      );
    }

    // FormData 파싱
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: '파일을 선택하세요' },
        { status: 400 }
      );
    }

    // 파일 타입 검증
    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validMimeTypes.includes(file.type)) {
      return NextResponse.json(
        { ok: false, error: '이미지 파일을 선택하세요 (JPG, PNG, WebP)' },
        { status: 400 }
      );
    }

    // 파일 크기 검증 (5MB 이상 X)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { ok: false, error: '파일 크기는 5MB 이하여야 합니다' },
        { status: 400 }
      );
    }

    // Buffer로 변환
    const buffer = Buffer.from(await file.arrayBuffer());

    logger.info(`[Passport OCR] 파일 처리 시작: ${file.name} (${file.size} bytes)`);

    // Gemini Vision API로 OCR 처리
    const result = await extractPassportFromBuffer(buffer, file.type, {
      model: undefined, // GEMINI_MODEL 환경변수 사용
      maxTokens: 2048,
    });

    // 신뢰도 계산 (warning이 적을수록 높음: 0개=100%, 2개=80%, 4개=60%, 5개+=${40%)
    const confidence = Math.max(40, 100 - result.warnings.length * 10);

    logger.info(`[Passport OCR] 처리 완료: confidence=${confidence}%, warnings=${result.warnings.length}`);

    return NextResponse.json(
      {
        ok: true,
        message: `OCR 처리 완료 (신뢰도: ${confidence}%)`,
        data: {
          korName: result.data.korName,
          engSurname: result.data.engSurname,
          engGivenName: result.data.engGivenName,
          passportNumber: result.data.passportNo,
          nationality: result.data.nationality,
          sex: result.data.sex,
          dateOfBirth: result.data.dateOfBirth,
          dateOfIssue: result.data.dateOfIssue,
          passportExpiryDate: result.data.passportExpiryDate,
          confidence,
          warnings: result.warnings,
          hasMinimum: result.hasMinimum,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof PassportOcrUnreadable) {
      logger.warn('[Passport OCR] 판독 불가:', { message: error.message });
      return NextResponse.json(
        {
          ok: false,
          error: '이미지에서 여권 정보를 읽을 수 없습니다. 다른 사진을 시도하세요.',
          details: 'PASSPORT_OCR_UNREADABLE',
        },
        { status: 400 }
      );
    }

    if (error instanceof PassportOcrEmptyResponse) {
      logger.warn('[Passport OCR] 빈 응답:', { message: error.message });
      return NextResponse.json(
        {
          ok: false,
          error: 'OCR 처리 실패 (AI 응답 없음). 다시 시도하세요.',
          details: 'PASSPORT_OCR_EMPTY_RESPONSE',
        },
        { status: 400 }
      );
    }

    if (error instanceof PassportOcrApiError) {
      logger.error('[Passport OCR] API 오류:', error.cause as Record<string, unknown>);
      return NextResponse.json(
        {
          ok: false,
          error: 'OCR 서비스 일시 오류. 잠시 후 다시 시도하세요.',
          details: 'PASSPORT_OCR_API_ERROR',
        },
        { status: 500 }
      );
    }

    if (error instanceof Error) {
      logger.error('[Passport OCR] 예기치 않은 오류:', error.message);
      return NextResponse.json(
        {
          ok: false,
          error: error.message || '알 수 없는 오류가 발생했습니다.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: false, error: '알 수 없는 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
