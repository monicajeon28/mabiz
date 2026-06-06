export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  extractPassportFromBuffer,
  PassportOcrApiError,
  PassportOcrEmptyResponse,
  PassportOcrUnreadable,
} from '@/lib/passport-ocr';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const token = (await params).token;
    if (!token || token.length < 10) {
      return NextResponse.json({ ok: false, error: '잘못된 토큰입니다.' }, { status: 400 });
    }

    // 토큰 검증
    const submission = await prisma.gmPassportSubmission.findFirst({
      where: { token },
    });

    if (!submission) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 토큰입니다.' }, { status: 404 });
    }

    if (submission.tokenExpiresAt.getTime() < Date.now()) {
      return NextResponse.json({ ok: false, error: '만료된 링크입니다.' }, { status: 410 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ ok: false, error: '파일이 없습니다.' }, { status: 400 });
    }

    // 파일 크기 제한 (10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ ok: false, error: '파일 크기는 10MB 이하여야 합니다.' }, { status: 413 });
    }

    // 이미지 파일 타입 검증
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ ok: false, error: '이미지 파일만 업로드할 수 있습니다.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 공용 OCR lib 호출 (경로 현 설정 보존: GEMINI_MODEL_NAME||2.0-flash / 800)
    let normalizedData;
    try {
      const extracted = await extractPassportFromBuffer(buffer, file.type, {
        model: process.env.GEMINI_MODEL_NAME || 'gemini-2.0-flash',
        maxTokens: 800,
      });
      normalizedData = extracted.data;
    } catch (ocrError) {
      if (ocrError instanceof PassportOcrEmptyResponse || ocrError instanceof PassportOcrUnreadable) {
        logger.error('[Public OCR] OCR 판독 실패:', { message: ocrError.message });
        return NextResponse.json(
          { ok: false, error: 'OCR 결과를 분석할 수 없습니다.' },
          { status: 500 }
        );
      }
      if (ocrError instanceof PassportOcrApiError) {
        logger.error('[Public OCR] Gemini 호출 실패:', { message: ocrError.message });
        return NextResponse.json(
          { ok: false, error: 'OCR 처리 중 오류가 발생했습니다.' },
          { status: 500 }
        );
      }
      throw ocrError;
    }

    return NextResponse.json({
      ok: true,
      data: normalizedData,
    });
  } catch (error) {
    const err = error as Record<string, unknown>;
    logger.error('[Public OCR] Error:', { err });
    return NextResponse.json({ ok: false, error: 'OCR 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
