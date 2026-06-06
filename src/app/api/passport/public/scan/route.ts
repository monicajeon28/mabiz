// Node 런타임에서 실행 (Buffer 사용 가능)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { decodePassportToken } from '@/lib/passport-utils';
import { logger } from '@/lib/logger';
import { getDriveClient, findOrCreateFolder } from '@/lib/drive-client';
import sharp from 'sharp';
import { Readable } from 'stream';
import { checkRateLimitAsync } from '@/lib/rate-limit';
import {
  extractPassportFromBuffer,
  PassportOcrApiError,
  PassportOcrEmptyResponse,
  PassportOcrUnreadable,
} from '@/lib/passport-ocr';
import { toKstDateString } from '@/lib/passport-date';

const MAX_OCR_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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

    if (!token || token.length < 10 || token.length > 512) {
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

    // 민감 정보 마스킹 헬퍼
    const maskPhone = (p: string | null | undefined) => {
      if (!p) return null;
      const n = p.replace(/[-\s()]/g, '');
      if (n.length >= 7) return n.slice(0, 3) + '****' + n.slice(-4);
      return '****';
    };
    const maskEmail = (e: string | null | undefined) => {
      if (!e) return null;
      const [local, domain] = e.split('@');
      if (!domain) return '****';
      return local.slice(0, 2) + '****@' + domain;
    };
    const maskPassportNo = (pn: string | null | undefined) => {
      if (!pn) return null;
      if (pn.length <= 4) return '****';
      return pn.slice(0, 2) + '****' + pn.slice(-2);
    };

    return NextResponse.json({
      ok: true,
      submission: {
        id: submission.id,
        // token은 클라이언트가 이미 보유 중 — 재전송 불필요, 생략
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
      user: submission.user
        ? {
            id: submission.user.id,
            name: submission.user.name,
            phone: maskPhone(submission.user.phone),
            email: maskEmail(submission.user.email),
            role: submission.user.role,
            customerStatus: submission.user.customerStatus,
          }
        : null,
      trip,
      guests: guests.map((guest) => ({
        id: guest.id,
        groupNumber: guest.groupNumber,
        name: guest.name,
        phone: maskPhone(guest.phone),
        passportNumber: maskPassportNo(guest.passportNumber),
        nationality: guest.nationality,
        // 날짜-only는 KST yyyy-MM-dd 문자열로 통일 (시각 제거, 표시 계약 일치)
        dateOfBirth: toKstDateString(guest.dateOfBirth),
        passportExpiryDate: toKstDateString(guest.passportExpiryDate),
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
    // AI 서비스 구성 확인 (키 없으면 즉시 500)
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { ok: false, error: 'AI 서비스가 구성되지 않았습니다.' },
        { status: 500 }
      );
    }

    // 신뢰할 수 있는 IP 추출: 클라이언트 조작 불가 헤더 우선 사용
    // cf-connecting-ip (Cloudflare) > x-real-ip (Vercel/Nginx) > x-forwarded-for 마지막 값(프록시 추가분)
    const rawForwarded = req.headers.get('x-forwarded-for') || '';
    const ip =
      req.headers.get('cf-connecting-ip')?.trim() ||
      req.headers.get('x-real-ip')?.trim() ||
      rawForwarded.split(',').pop()?.trim() ||
      'unknown';
    const { allowed } = await checkRateLimitAsync(`passport-ocr:${ip}`, 10, 5 * 60_000);
    if (!allowed) {
      return NextResponse.json({ ok: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.' }, { status: 429 });
    }

    // query에서 token 받기
    const { searchParams } = new URL(req.url);
    const rawToken = searchParams.get('token');
    // 토큰 길이 검증 (최소 10, 최대 512자)
    const token = rawToken && rawToken.length >= 10 && rawToken.length <= 512 ? rawToken : null;

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

    // 공용 OCR lib 호출 (scan 현 설정 고정: GEMINI_MODEL||1.5-flash / 2048 — opts 없음)
    let normalizedData;
    let warnings: string[];
    let hasMinimum: boolean;
    try {
      const extracted = await extractPassportFromBuffer(buffer, file.type);
      normalizedData = extracted.data;
      warnings = extracted.warnings;
      hasMinimum = extracted.hasMinimum;
    } catch (ocrError) {
      if (ocrError instanceof PassportOcrApiError) {
        return NextResponse.json(
          {
            ok: false,
            error: 'AI 여권 인식 서비스에 오류가 발생했습니다.\n\n해결 방법:\n- 이미지 크기를 줄여보세요 (최대 5MB 권장)\n- 다른 이미지 형식으로 변환해보세요\n- 잠시 후 다시 시도해주세요',
          },
          { status: 500 }
        );
      }
      if (ocrError instanceof PassportOcrEmptyResponse) {
        return NextResponse.json(
          {
            ok: false,
            error: 'AI가 빈 응답을 반환했습니다.\n\n가능한 원인:\n- 이미지가 너무 흐릿합니다\n- 이미지가 여권이 아닙니다\n- 이미지가 손상되었습니다\n\n더 선명한 여권 사진을 업로드해주세요.',
          },
          { status: 400 }
        );
      }
      if (ocrError instanceof PassportOcrUnreadable) {
        return NextResponse.json(
          {
            ok: false,
            error: '여권 정보를 읽을 수 없습니다. 여권의 정보면(사진이 있는 면)을 더 선명하게 촬영해주세요.',
          },
          { status: 400 }
        );
      }
      throw ocrError; // 그 외(키 누락 등)는 외부 catch로 위임
    }

    // 최소한 여권번호나 이름 중 하나는 있어야 함
    if (!hasMinimum) {
      logger.error('[Passport Scan] 필수 정보 부족:', normalizedData);
      return NextResponse.json(
        {
          ok: false,
          error: '여권 정보를 읽을 수 없습니다.\n\n다음을 확인해주세요:\n- 여권의 정보면(사진이 있는 면)을 촬영했는지\n- 모든 텍스트가 선명하게 보이는지\n- 사진이 너무 어둡거나 밝지 않은지\n- 반사광이 텍스트를 가리지 않는지',
        },
        { status: 400 }
      );
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
          // 이미지를 webp로 변환 (위에서 만든 buffer 재사용)
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
              // 경쟁 상태 방지: PostgreSQL jsonb 원자 연산으로 배열에 직접 append
              // read-modify-write 패턴 대신 DB 레벨 원자적 업데이트 사용
              const newEntry = JSON.stringify({
                fileName: safeFileName,
                url: uploadedUrl,
                fileId: uploadedFileId,
                uploadedAt: new Date().toISOString(),
                source: 'scan',
              });
              await prisma.$executeRaw`
                UPDATE "GmPassportSubmission"
                SET "extraData" = jsonb_set(
                  COALESCE("extraData", '{}'::jsonb),
                  '{passportFiles}',
                  COALESCE("extraData"->'passportFiles', '[]'::jsonb) || ${newEntry}::jsonb
                )
                WHERE id = ${submission.id}
              `;

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
        error: '여권 스캔 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
