// Node 런타임에서 실행 (Buffer 사용 가능)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '@/lib/prisma';
import { decodePassportToken } from '@/lib/passport-utils';
import { logger } from '@/lib/logger';
import { getDriveClient, findOrCreateFolder } from '@/lib/drive-client';
import sharp from 'sharp';
import { Readable } from 'stream';
import { checkRateLimitAsync } from '@/lib/rate-limit';

const MAX_OCR_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

/** Gemini 모델명 결정 (환경변수 → 기본값) */
function resolveGeminiModelName(): string {
  return process.env.GEMINI_MODEL || 'gemini-1.5-flash';
}

/**
 * GET /api/passport/public/scan?token=...&phone=...
 * 토큰 기반 여권 제출 조회 및 본인확인
 * phone 파라미터가 있으면 사용자 phone과 비교
 * Public API — 인증 없음
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    const phone = searchParams.get('phone');

    if (!token || token.length < 10) {
      return NextResponse.json(
        { ok: false, error: '잘못된 토큰입니다.' },
        { status: 400 }
      );
    }

    // base62로 인코딩된 토큰인 경우 디코딩
    const originalToken = token;
    let decodedToken = token;
    try {
      const decoded = decodePassportToken(token);
      if (decoded && decoded !== token) {
        logger.log('[Passport Scan] Token decoded:', { original: originalToken, decoded });
        decodedToken = decoded;
      } else {
        logger.log('[Passport Scan] Token not decoded (already hex or same):', { original: originalToken, decoded });
      }
    } catch {
      logger.warn('[Passport Scan] Token decode failed, using original');
    }

    logger.log('[Passport Scan] Searching for token:', { token: decodedToken, length: decodedToken.length });

    // DB에서 토큰 조회
    const submission = await prisma.gmPassportSubmission.findFirst({
      where: { token: decodedToken },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            role: true,
            customerStatus: true,
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json(
        { ok: false, error: '토큰이 유효하지 않습니다.' },
        { status: 404 }
      );
    }

    // phone 파라미터가 있으면 사용자 phone과 비교 (정규화하여 비교)
    if (phone) {
      const userPhone = submission.user?.phone || '';
      const normalizePhone = (p: string) => p.replace(/[-\s()]/g, '');
      const userPhoneNormalized = normalizePhone(userPhone);
      const inputPhoneNormalized = normalizePhone(phone);

      if (userPhoneNormalized !== inputPhoneNormalized) {
        logger.warn('[Passport Scan] Phone mismatch:', { provided: phone, registered: userPhone });
        return NextResponse.json(
          { ok: false, error: '본인확인 실패: 등록된 전화번호가 일치하지 않습니다.' },
          { status: 404 }
        );
      }
      logger.log('[Passport Scan] Phone verification success:', { phone });
    }

    // tripId가 있으면 별도 조회
    let trip: {
      id: number;
      cruiseName: string | null;
      startDate: string | null;
      endDate: string | null;
    } | null = null;

    if (submission.tripId) {
      const tripData = await prisma.gmTrip.findUnique({
        where: { id: submission.tripId },
        select: {
          id: true,
          cruiseName: true,
          startDate: true,
          endDate: true,
        },
      });
      if (tripData) {
        trip = {
          id: tripData.id,
          cruiseName: tripData.cruiseName,
          startDate: tripData.startDate?.toISOString() ?? null,
          endDate: tripData.endDate?.toISOString() ?? null,
        };
      }
    }

    const now = new Date();
    const isExpired = submission.tokenExpiresAt.getTime() < now.getTime();
    const extraData =
      submission.extraData && typeof submission.extraData === 'object'
        ? (submission.extraData as Record<string, unknown>)
        : {};
    const passportFiles = Array.isArray(extraData?.passportFiles) ? extraData.passportFiles : [];
    const storedGroups = Array.isArray(extraData?.groups) ? extraData.groups : [];

    // guests 조회
    let guests: {
      id: number;
      groupNumber: number;
      name: string;
      phone: string | null;
      passportNumber: string | null;
      nationality: string | null;
      dateOfBirth: Date | null;
      passportExpiryDate: Date | null;
    }[] = [];
    try {
      const guestsData = await prisma.gmPassportSubmissionGuest.findMany({
        where: { submissionId: submission.id },
        orderBy: { groupNumber: 'asc' },
        select: {
          id: true,
          groupNumber: true,
          name: true,
          phone: true,
          passportNumber: true,
          nationality: true,
          dateOfBirth: true,
          passportExpiryDate: true,
        },
      });
      guests = guestsData;
    } catch (guestError) {
      logger.warn('[Passport Scan] Guests 조회 실패 (무시됨):', guestError as Record<string, unknown>);
      guests = [];
    }

    return NextResponse.json({
      ok: true,
      submission: {
        id: submission.id,
        token: submission.token,
        expiresAt: submission.tokenExpiresAt.toISOString(),
        isExpired,
        isSubmitted: submission.isSubmitted,
        submittedAt: submission.submittedAt?.toISOString() ?? null,
        driveFolderUrl: submission.driveFolderUrl,
        extraData: {
          passportFiles,
          groups: storedGroups,
          remarks: (extraData?.remarks as string) ?? '',
        },
      },
      user: submission.user,
      trip,
      guests: guests.map((guest) => ({
        id: guest.id,
        groupNumber: guest.groupNumber,
        name: guest.name,
        phone: guest.phone,
        passportNumber: guest.passportNumber,
        nationality: guest.nationality,
        dateOfBirth: guest.dateOfBirth?.toISOString() ?? null,
        passportExpiryDate: guest.passportExpiryDate?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    const err = error as Record<string, unknown>;
    logger.error('[Passport Scan] GET error:', err);
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('[Passport Scan] GET error details:', { errorMessage, errorStack });
    return NextResponse.json(
      {
        ok: false,
        error: '토큰 정보를 불러오지 못했습니다.',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/passport/public/scan
 * 여권 이미지를 받아서 Gemini Vision AI로 정보를 추출합니다.
 * Public API — 인증 없음
 */
export async function POST(req: NextRequest) {
  try {
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: 'GEMINI_API_KEY가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const { allowed } = await checkRateLimitAsync(`passport-ocr:${ip}`, 10, 5 * 60_000);
    if (!allowed) {
      return NextResponse.json({ ok: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.' }, { status: 429 });
    }

    // query에서 token 받기
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    const formData = await req.formData();
    // 프론트엔드에서 'file' 또는 'passportImage' 둘 다 지원
    const file = (formData.get('file') || formData.get('passportImage')) as File | null;

    if (!file) {
      return NextResponse.json(
        { ok: false, error: '이미지 파일이 필요합니다.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_OCR_FILE_SIZE) {
      return NextResponse.json(
        { ok: false, error: '파일 크기는 10MB 이하여야 합니다.' },
        { status: 413 }
      );
    }

    // 파일 타입 검증 — 이미지 파일만 허용 (악성 파일 Gemini 전달 차단)
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { ok: false, error: '이미지 파일만 업로드할 수 있습니다.' },
        { status: 400 }
      );
    }

    // 파일을 Buffer로 변환
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64String = buffer.toString('base64');

    // Gemini 모델 사용 - OCR 정확도 향상을 위한 최적 설정
    const modelName = resolveGeminiModelName();
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 2048,
        topP: 0.95,
        topK: 40,
      }
    });

    // 여권 정보 추출 프롬프트 (저화질/흐린 이미지 대응)
    const prompt = `You are an expert passport OCR system. Extract information even from blurry, tilted, low-quality, or partially visible passport images.

IMPORTANT: Try your BEST to read text even if:
- Image is blurry or out of focus
- Image is dark or overexposed
- Image is tilted or rotated
- Text is partially obscured
- Image has glare or reflections

Return ONLY a JSON object (no markdown, no explanation):
{
  "korName": "Korean name (한글) or empty",
  "engSurname": "SURNAME in uppercase",
  "engGivenName": "GIVEN NAME in uppercase",
  "passportNo": "Passport number like M12345678",
  "nationality": "3-letter code like KOR",
  "sex": "M or F",
  "dateOfBirth": "YYYY-MM-DD",
  "dateOfIssue": "YYYY-MM-DD",
  "passportExpiryDate": "YYYY-MM-DD"
}

Key rules:
- Use "" for fields you cannot read
- Convert dates: 2-digit years 00-49=20XX, 50-99=19XX
- If name format is "SURNAME/GIVEN", split correctly
- Look for MRZ (Machine Readable Zone) at bottom as backup
- Infer missing characters from context when possible`;

    // Gemini Vision API 호출
    logger.info('[Passport Scan] Gemini API 호출 시작...');
    logger.info(`[Passport Scan] 모델: ${modelName}`);
    logger.info(`[Passport Scan] 이미지 크기: ${buffer.length} bytes`);
    logger.info(`[Passport Scan] 이미지 타입: ${file.type}`);

    let result;
    try {
      result = await model.generateContent([
        { text: prompt },
        {
          inlineData: {
            data: base64String,
            mimeType: file.type || 'image/jpeg'
          }
        },
      ]);
    } catch (apiError) {
      const err = apiError as Record<string, unknown>;
      logger.error('[Passport Scan] Gemini API 호출 실패:', err);

      return NextResponse.json(
        {
          ok: false,
          error: `AI 여권 인식 서비스에 오류가 발생했습니다.\n\n기술 정보: ${err.message}\n\n해결 방법:\n- 이미지 크기를 줄여보세요 (최대 5MB 권장)\n- 다른 이미지 형식으로 변환해보세요\n- 잠시 후 다시 시도해주세요`,
          technicalError: String(err.message || ''),
        },
        { status: 500 }
      );
    }

    let response;
    let text;
    try {
      response = await result.response;
      text = response.text();
    } catch (responseError) {
      const err = responseError as Record<string, unknown>;
      logger.error('[Passport Scan] Gemini 응답 처리 실패:', err);

      return NextResponse.json(
        {
          ok: false,
          error: 'AI 응답을 처리할 수 없습니다.\n\n잠시 후 다시 시도해주세요.',
          technicalError: String(err.message || ''),
        },
        { status: 500 }
      );
    }

    logger.info(`[Passport Scan] Gemini 응답 길이: ${text.length}`);

    if (!text || text.trim() === '') {
      logger.error('[Passport Scan] 빈 응답 수신');
      return NextResponse.json(
        {
          ok: false,
          error: 'AI가 빈 응답을 반환했습니다.\n\n가능한 원인:\n- 이미지가 너무 흐릿합니다\n- 이미지가 여권이 아닙니다\n- 이미지가 손상되었습니다\n\n더 선명한 여권 사진을 업로드해주세요.',
          rawResponse: text,
          technicalError: 'Empty response from AI'
        },
        { status: 400 }
      );
    }

    // JSON 파싱 (개선된 에러 처리 + 잘린 JSON 복구)
    let passportData;
    try {
      // 1. 마크다운 코드 블록 제거
      let cleanedText = text.trim();
      cleanedText = cleanedText.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');

      // 2. JSON 객체 추출
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      let jsonStr = jsonMatch ? jsonMatch[0] : cleanedText;

      // 3. 잘린 JSON 복구 시도
      try {
        passportData = JSON.parse(jsonStr);
      } catch (_firstParseError) {
        logger.info('[Passport Scan] 첫 번째 파싱 실패, JSON 복구 시도...');
        jsonStr = repairTruncatedJson(jsonStr);
        passportData = JSON.parse(jsonStr);
        logger.info('[Passport Scan] JSON 복구 성공');
      }

      // 4. 필수 필드 검증
      if (typeof passportData !== 'object' || passportData === null) {
        throw new Error('Invalid JSON structure');
      }

      logger.info('[Passport Scan] 파싱 성공');
    } catch (parseError) {
      const err = parseError as Record<string, unknown>;
      logger.error('[Passport Scan] JSON 파싱 실패:', err);

      // 마지막 수단: 정규식으로 개별 필드 추출 시도
      const extractedData = extractPassportFieldsManually(text);
      if (extractedData && (extractedData.passportNo || extractedData.engSurname)) {
        logger.info('[Passport Scan] 정규식 추출 성공');
        passportData = extractedData;
      } else {
        return NextResponse.json(
          {
            ok: false,
            error: '여권 정보를 읽을 수 없습니다. 여권의 정보면(사진이 있는 면)을 더 선명하게 촬영해주세요.',
            rawResponse: text,
            technicalError: String(err.message || ''),
          },
          { status: 400 }
        );
      }
    }

    // 데이터 검증 및 정규화
    const normalizedData = {
      korName: passportData.korName || '',
      engSurname: passportData.engSurname || '',
      engGivenName: passportData.engGivenName || '',
      passportNo: (passportData.passportNo || '').replace(/\s+/g, '').toUpperCase(),
      sex: (passportData.sex || '').toUpperCase().substring(0, 1),
      dateOfBirth: normalizeDate(passportData.dateOfBirth),
      dateOfIssue: normalizeDate(passportData.dateOfIssue),
      passportExpiryDate: normalizeDate(passportData.passportExpiryDate),
      nationality: (passportData.nationality || '').toUpperCase().substring(0, 3),
    };

    // 최소한 여권번호나 이름 중 하나는 있어야 함
    const hasPassportNo = normalizedData.passportNo && normalizedData.passportNo.length >= 8;
    const hasName = normalizedData.korName || normalizedData.engSurname;

    if (!hasPassportNo && !hasName) {
      logger.error('[Passport Scan] 필수 정보 부족:', normalizedData);
      return NextResponse.json(
        {
          ok: false,
          error: '여권 정보를 읽을 수 없습니다.\n\n다음을 확인해주세요:\n- 여권의 정보면(사진이 있는 면)을 촬영했는지\n- 모든 텍스트가 선명하게 보이는지\n- 사진이 너무 어둡거나 밝지 않은지\n- 반사광이 텍스트를 가리지 않는지',
          rawResponse: text,
          extractedData: normalizedData
        },
        { status: 400 }
      );
    }

    // 경고: 일부 정보만 추출된 경우
    const warnings = [];
    if (!normalizedData.passportNo) warnings.push('여권번호');
    if (!normalizedData.engSurname) warnings.push('영문 성');
    if (!normalizedData.engGivenName) warnings.push('영문 이름');
    if (!normalizedData.sex) warnings.push('성별');
    if (!normalizedData.dateOfBirth) warnings.push('생년월일');
    if (!normalizedData.dateOfIssue) warnings.push('발급일');
    if (!normalizedData.passportExpiryDate) warnings.push('만료일');

    if (warnings.length > 0) {
      logger.warn(`[Passport Scan] 일부 정보 누락: ${warnings.join(', ')}`);
    }

    // Google Drive에 webp로 변환하여 저장 (비동기, 실패해도 스캔 결과는 반환)
    let uploadedFileInfo: { fileId: string; url: string; fileName: string } | null = null;

    if (token) {
      try {
        // token으로 GmPassportSubmission 조회 (만료/제출완료 토큰 차단)
        const submission = await prisma.gmPassportSubmission.findFirst({
          where: {
            token,
            isSubmitted: false,
            tokenExpiresAt: { gt: new Date() },
          },
          select: { id: true },
        });

        if (submission) {
          const bytes = await file.arrayBuffer();
          const buffer = Buffer.from(bytes);

          // 이미지를 webp로 변환
          logger.info('[Passport Scan] 이미지 webp 변환 시작...');
          const webpBuffer = await sharp(buffer)
            .webp({ quality: 85 })
            .toBuffer();

          logger.info(`[Passport Scan] webp 변환 완료 (${webpBuffer.length} bytes)`);

          // Google Drive에 업로드
          const drive = getDriveClient();
          const passportFolderId = process.env.PASSPORT_DRIVE_FOLDER_ID || '';

          if (passportFolderId) {
            const submissionFolderName = `passport_submission_${submission.id}`;
            const submissionFolderId = await findOrCreateFolder(submissionFolderName, passportFolderId);

            const readable = Readable.from([webpBuffer]);
            const safeFileName = `${Date.now()}_passport.webp`;

            const driveResponse = await drive.files.create({
              requestBody: {
                name: safeFileName,
                parents: [submissionFolderId],
                mimeType: 'image/webp',
              },
              media: {
                mimeType: 'image/webp',
                body: readable,
              },
              fields: 'id,webViewLink',
            });

            const uploadedFileId = driveResponse.data.id;
            const uploadedUrl = driveResponse.data.webViewLink || `https://drive.google.com/file/d/${uploadedFileId}/view`;

            if (uploadedFileId) {
              // extraData에 저장된 이미지 목록에 추가
              const existing = await prisma.gmPassportSubmission.findUnique({
                where: { id: submission.id },
                select: { extraData: true },
              });

              const existingExtra =
                existing?.extraData && typeof existing.extraData === 'object'
                  ? (existing.extraData as Record<string, unknown>)
                  : {};

              const passportFiles = Array.isArray(existingExtra.passportFiles)
                ? (existingExtra.passportFiles as any[])
                : [];

              passportFiles.push({
                fileName: safeFileName,
                url: uploadedUrl,
                fileId: uploadedFileId,
                uploadedAt: new Date().toISOString(),
                source: 'scan',
              });

              await prisma.gmPassportSubmission.update({
                where: { id: submission.id },
                data: {
                  extraData: {
                    ...(existingExtra ?? {}),
                    passportFiles,
                  } as any,
                },
              });

              uploadedFileInfo = {
                fileId: uploadedFileId,
                url: uploadedUrl,
                fileName: safeFileName,
              };

              logger.info('[Passport Scan] Google Drive 저장 성공:', uploadedFileInfo);
            }
          }
        }
      } catch (uploadError) {
        const err = uploadError as Record<string, unknown>;
        logger.warn('[Passport Scan] Google Drive 저장 실패 (무시됨):', err);
        // 이미지 저장 실패는 로그만 기록하고 계속 진행
      }
    }

    return NextResponse.json({
      ok: true,
      data: normalizedData,
      warnings: warnings.length > 0 ? `일부 정보를 읽지 못했습니다: ${warnings.join(', ')}. 수동으로 입력해주세요.` : null,
      // rawText 제거 — 여권 전체 텍스트(MRZ 등)를 클라이언트에 노출하지 않음
      uploadedFile: uploadedFileInfo,
    });
  } catch (error) {
    const err = error as Record<string, unknown>;
    logger.error('[Passport Scan] Error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: String(err.message || '여권 스캔 중 오류가 발생했습니다.')
      },
      { status: 500 }
    );
  }
}

// 날짜 정규화 헬퍼 함수
function normalizeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  const cleaned = dateStr.replace(/[^0-9]/g, '');
  if (cleaned.length === 6) {
    const year = parseInt(cleaned.substring(0, 2));
    const month = cleaned.substring(2, 4);
    const day = cleaned.substring(4, 6);
    const fullYear = year < 50 ? `20${year.toString().padStart(2, '0')}` : `19${year.toString().padStart(2, '0')}`;
    return `${fullYear}-${month}-${day}`;
  }

  if (cleaned.length === 8) {
    return `${cleaned.substring(0, 4)}-${cleaned.substring(4, 6)}-${cleaned.substring(6, 8)}`;
  }

  return dateStr;
}

// 잘린 JSON 복구 함수
function repairTruncatedJson(jsonStr: string): string {
  let repaired = jsonStr.trim();

  const quoteCount = (repaired.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    repaired = repaired.replace(/:\s*"[^"]*$/, ': ""');
  }

  repaired = repaired.replace(/,\s*$/, '');

  const openBraces = (repaired.match(/\{/g) || []).length;
  const closeBraces = (repaired.match(/\}/g) || []).length;
  for (let i = 0; i < openBraces - closeBraces; i++) {
    repaired += '}';
  }

  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/\]/g) || []).length;
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    repaired += ']';
  }

  return repaired;
}

// 정규식으로 여권 필드 직접 추출 (JSON 파싱 실패 시 백업)
function extractPassportFieldsManually(text: string) {
  const extractField = (pattern: RegExp): string => {
    const match = text.match(pattern);
    return match ? match[1].trim() : '';
  };

  return {
    korName: extractField(/"korName"\s*:\s*"([^"]*)"/),
    engSurname: extractField(/"engSurname"\s*:\s*"([^"]*)"/),
    engGivenName: extractField(/"engGivenName"\s*:\s*"([^"]*)"/),
    passportNo: extractField(/"passportNo"\s*:\s*"([^"]*)"/),
    nationality: extractField(/"nationality"\s*:\s*"([^"]*)"/),
    sex: extractField(/"sex"\s*:\s*"([^"]*)"/),
    dateOfBirth: extractField(/"dateOfBirth"\s*:\s*"([^"]*)"/),
    dateOfIssue: extractField(/"dateOfIssue"\s*:\s*"([^"]*)"/),
    passportExpiryDate: extractField(/"passportExpiryDate"\s*:\s*"([^"]*)"/),
  };
}
