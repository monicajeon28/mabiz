export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext, canAccessLead } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';
import {
  extractPassportFromBuffer,
  fetchImageWithLimit,
  PassportOcrApiError,
  PassportOcrEmptyResponse,
  PassportOcrUnreadable,
} from '@/lib/passport-ocr';
import { normalizeDateOnlyString } from '@/lib/passport-date';
import { normalizePassportNo, isPassportDupViolation } from '@/lib/passport-match';

const apiKey = process.env.GEMINI_API_KEY || '';

function maskPassportNo(pno: string): string {
  if (!pno || pno.length <= 4) return '****';
  return pno.slice(0, 2) + '****' + pno.slice(-2);
}

function maskPhone(phone: string | null): string {
  if (!phone) return '(null)';
  if (phone.length <= 4) return '****';
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

interface OCRToAPISRequestBody {
  submissionId: number;
  imageUrl: string;
  userId: number;
}

/**
 * 여권 이미지 URL을 받아서 OCR 처리 후 APIS 데이터로 변환 (파트너용)
 */
export async function POST(req: NextRequest) {
  try {
    const partnerCtx = await requirePartnerContext();
    if (!partnerCtx) {
      return NextResponse.json(
        { ok: false, message: '인증이 필요합니다. 다시 로그인해 주세요.' },
        { status: 403 },
      );
    }

    const { profile } = partnerCtx;

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, message: 'GEMINI_API_KEY가 설정되지 않았습니다.' },
        { status: 500 },
      );
    }

    const body: OCRToAPISRequestBody = await req.json();

    if (!body.submissionId || !body.imageUrl || !body.userId) {
      return NextResponse.json(
        { ok: false, message: '필수 정보가 누락되었습니다.' },
        { status: 400 },
      );
    }

    // Submission 확인
    const submission = await prisma.gmPassportSubmission.findUnique({
      where: { id: body.submissionId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json(
        { ok: false, message: '여권 제출 정보를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    if (submission.userId !== body.userId) {
      return NextResponse.json(
        { ok: false, message: '고객 정보가 일치하지 않습니다.' },
        { status: 403 },
      );
    }

    // 파트너 권한 확인: 이 고객 전화번호의 리드를 본인이 담당하는지 확인 (IDOR 방지)
    const customerPhone = submission.user?.phone;
    if (!customerPhone) {
      return NextResponse.json(
        { ok: false, message: '고객 연락처 정보가 없습니다.' },
        { status: 403 },
      );
    }
    const lead = await prisma.gmAffiliateLead.findFirst({
      where: {
        OR: [{ managerId: profile.id }, { agentId: profile.id }],
        customerPhone, // 고객 전화번호 일치 필수
      },
    });

    if (!lead) {
      return NextResponse.json(
        { ok: false, message: '이 고객에 대한 권한이 없습니다.' },
        { status: 403 },
      );
    }

    // SSRF 방어: 허용된 도메인만 허용
    const ALLOWED_IMAGE_HOSTS = [
      'drive.google.com',
      'storage.googleapis.com',
      'lh3.googleusercontent.com',
      'lh4.googleusercontent.com',
      'lh5.googleusercontent.com',
      'lh6.googleusercontent.com',
    ];
    let parsedImageUrl: URL;
    try {
      parsedImageUrl = new URL(body.imageUrl);
    } catch {
      return NextResponse.json(
        { ok: false, message: '유효하지 않은 이미지 URL입니다.' },
        { status: 400 },
      );
    }
    if (!ALLOWED_IMAGE_HOSTS.includes(parsedImageUrl.hostname)) {
      return NextResponse.json(
        { ok: false, message: '허용되지 않은 이미지 도메인입니다.' },
        { status: 400 },
      );
    }

    // 이미지 다운로드
    logger.log('[Partner OCR to APIS] 이미지 다운로드 시작');
    let imageBuffer: Buffer;
    try {
      imageBuffer = await fetchImageWithLimit(body.imageUrl); // 타임아웃 15s + 10MB 상한
    } catch (error) {
      const err = error as Record<string, unknown>;
      logger.error('[Partner OCR to APIS] 이미지 다운로드 오류:', { err });
      return NextResponse.json(
        {
          ok: false,
          message: '이미지를 가져올 수 없습니다.',
        },
        { status: 400 },
      );
    }

    // 공용 OCR lib 호출 (경로 현 설정 보존: GEMINI_MODEL_NAME||2.0-flash / 800)
    let normalizedData;
    let hasMinimum: boolean;
    try {
      const extracted = await extractPassportFromBuffer(imageBuffer, 'image/jpeg', {
        model: process.env.GEMINI_MODEL_NAME || 'gemini-2.0-flash',
        maxTokens: 800,
      });
      normalizedData = extracted.data;
      hasMinimum = extracted.hasMinimum;
    } catch (ocrError) {
      if (ocrError instanceof PassportOcrEmptyResponse || ocrError instanceof PassportOcrUnreadable) {
        logger.error('[Partner OCR to APIS] OCR 판독 실패:', { message: ocrError.message });
        return NextResponse.json(
          { ok: false, message: '여권 정보를 읽을 수 없습니다. 더 선명한 이미지를 사용해주세요.' },
          { status: 400 },
        );
      }
      if (ocrError instanceof PassportOcrApiError) {
        logger.error('[Partner OCR to APIS] Gemini 호출 실패:', { message: ocrError.message });
        return NextResponse.json(
          { ok: false, message: 'OCR 처리 중 오류가 발생했습니다.' },
          { status: 500 },
        );
      }
      throw ocrError;
    }

    // 최소한 여권번호나 이름 중 하나는 있어야 함
    if (!hasMinimum) {
      return NextResponse.json(
        {
          ok: false,
          message:
            '여권 정보를 읽을 수 없습니다. 더 선명한 이미지를 사용해주세요.',
        },
        { status: 400 },
      );
    }

    // Trip 확인 (APIS에 저장하기 위해 필요)
    if (!submission.tripId) {
      return NextResponse.json(
        { ok: false, message: '여행 정보가 없어 APIS에 저장할 수 없습니다.' },
        { status: 400 },
      );
    }

    // tripId로 reservation 조회 (Traveler는 reservationId 기반)
    const reservation = await prisma.gmReservation.findFirst({
      where: {
        tripId: submission.tripId,
        mainUserId: body.userId,
      },
      orderBy: { id: 'desc' },
    });

    if (!reservation) {
      return NextResponse.json(
        { ok: false, message: '예약 정보를 찾을 수 없어 APIS에 저장할 수 없습니다.' },
        { status: 400 },
      );
    }

    // Traveler 테이블에 저장 (APIS 데이터)
    try {
      // 매칭 키·날짜·여권번호 정규화 (SSoT 통일)
      const passportNo = normalizePassportNo(normalizedData.passportNo) || '';
      const guestName = normalizedData.korName || submission.user.name || '';

      // 기존 Traveler: userId 우선, 없으면 (reservationId,passportNo)로 보강 매칭
      let existingTraveler = await prisma.gmTraveler.findFirst({
        where: { reservationId: reservation.id, userId: body.userId },
        select: { id: true },
      });
      if (!existingTraveler && passportNo) {
        existingTraveler = await prisma.gmTraveler.findFirst({
          where: { reservationId: reservation.id, passportNo },
          select: { id: true },
        });
      }

      const travelerData = {
        reservationId: reservation.id,
        userId: body.userId,
        roomNumber: 1,
        korName: guestName,
        engSurname: normalizedData.engSurname || '',
        engGivenName: normalizedData.engGivenName || '',
        residentNum: '',
        passportNo,
        birthDate: normalizeDateOnlyString(normalizedData.dateOfBirth) ?? '',
        issueDate: normalizeDateOnlyString(normalizedData.dateOfIssue) ?? '',
        expiryDate: normalizeDateOnlyString(normalizedData.passportExpiryDate) ?? '',
        nationality: normalizedData.nationality || 'KOR',
        gender: normalizedData.sex || 'M',
      };

      if (existingTraveler) {
        await prisma.gmTraveler.updateMany({
          where: { id: existingTraveler.id, reservationId: reservation.id },
          data: travelerData,
        });
      } else {
        try {
          await prisma.gmTraveler.create({ data: travelerData });
        } catch (e) {
          // 동시 생성/사전조회 누락으로 부분 UNIQUE 충돌 → 재조회 update 폴백
          if (isPassportDupViolation(e) && passportNo) {
            const dup = await prisma.gmTraveler.findFirst({
              where: { reservationId: reservation.id, passportNo },
              select: { id: true },
            });
            if (dup) await prisma.gmTraveler.updateMany({ where: { id: dup.id, reservationId: reservation.id }, data: travelerData });
            else throw e;
          } else {
            throw e;
          }
        }
      }

      // PassportSubmissionGuest 동기화: 여권번호 기준 매칭(이름 매칭 금지 — 동명이인 교차오염 방지)
      const guestUpdate = {
        passportNumber: passportNo || null,
        nationality: normalizedData.nationality,
        dateOfBirth: travelerData.birthDate ? new Date(travelerData.birthDate) : null,
        passportExpiryDate: travelerData.expiryDate ? new Date(travelerData.expiryDate) : null,
        ocrRawData: {
          ...normalizedData,
          processedAt: new Date().toISOString(),
          processedBy: profile.id,
        },
        // 감사: 서버측 도출값 (클라이언트 신뢰값 금지)
        submittedBy: profile.id,
        source: 'partner_ocr',
        submittedAt: new Date(),
      };
      const existingGuest = passportNo
        ? await prisma.gmPassportSubmissionGuest.findFirst({
            where: { submissionId: body.submissionId, passportNumber: passportNo },
            select: { id: true },
          })
        : null;

      if (existingGuest) {
        await prisma.gmPassportSubmissionGuest.update({
          where: { id: existingGuest.id },
          data: guestUpdate,
        });
      } else {
        await prisma.gmPassportSubmissionGuest.create({
          data: {
            submissionId: body.submissionId,
            groupNumber: 1,
            name: guestName,
            phone: submission.user.phone,
            ...guestUpdate,
          },
        });
      }

      logger.log('[Partner OCR to APIS] APIS 데이터 저장 완료:', {
        submissionId: body.submissionId,
        userId: body.userId,
        tripId: submission.tripId,
        partnerId: profile.id,
        passportNo: maskPassportNo(normalizedData.passportNo),
      });

      return NextResponse.json({
        ok: true,
        message: 'OCR 처리 완료! APIS 데이터가 저장되었습니다.',
        data: normalizedData,
      });
    } catch (dbError) {
      const dbErr = dbError as Record<string, unknown>;
      logger.error('[Partner OCR to APIS] DB 저장 오류:', dbErr);
      return NextResponse.json(
        {
          ok: false,
          message: 'APIS 데이터 저장 중 오류가 발생했습니다.',
        },
        { status: 500 },
      );
    }
  } catch (error) {
    const err = error as Record<string, unknown>;
    logger.error('[Partner OCR to APIS] POST error:', { err });
    return NextResponse.json(
      {
        ok: false,
        message: 'OCR 처리 중 오류가 발생했습니다.',
      },
      { status: 500 },
    );
  }
}
