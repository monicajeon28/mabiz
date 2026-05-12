import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import { logger } from '@/lib/logger';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { resolveGeminiModelName } from '@/lib/ai/geminiModel';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

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
    const { profile } = await requirePartnerContext();
    if (!profile) {
      return NextResponse.json(
        { ok: false, message: '인증이 필요합니다. 다시 로그인해 주세요.' },
        { status: 403 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, message: 'GEMINI_API_KEY가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const body: OCRToAPISRequestBody = await req.json();

    if (!body.submissionId || !body.imageUrl || !body.userId) {
      return NextResponse.json(
        { ok: false, message: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // Submission 확인
    const submission = await prisma.passportSubmission.findUnique({
      where: { id: body.submissionId },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        UserTrip: {
          select: {
            id: true,
            productCode: true,
            cruiseName: true,
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json(
        { ok: false, message: '여권 제출 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (submission.userId !== body.userId) {
      return NextResponse.json(
        { ok: false, message: '고객 정보가 일치하지 않습니다.' },
        { status: 403 }
      );
    }

    // 파트너 권한 확인: 자신의 고객인지 확인
    const lead = await prisma.affiliateLead.findFirst({
      where: {
        userId: body.userId,
        OR: [
          { managerId: profile.id },
          { agentId: profile.id },
        ],
      },
    });

    if (!lead) {
      return NextResponse.json(
        { ok: false, message: '이 고객에 대한 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 이미지 다운로드
    logger.log('[Partner OCR to APIS] 이미지 다운로드 시작:', body.imageUrl);
    let imageBuffer: Buffer;
    try {
      const imageResponse = await fetch(body.imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`이미지 다운로드 실패: ${imageResponse.status}`);
      }
      const arrayBuffer = await imageResponse.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    } catch (error: any) {
      logger.error('[Partner OCR to APIS] 이미지 다운로드 오류:', error);
      return NextResponse.json(
        { ok: false, message: `이미지를 가져올 수 없습니다: ${error.message}` },
        { status: 400 }
      );
    }

    // OCR 처리
    const base64String = imageBuffer.toString('base64');
    const modelName = resolveGeminiModelName();
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 800,
        topP: 0.95,
        topK: 40,
      },
    });

    const prompt = `This is a passport image. Please extract the information accurately even if the photo is blurry, tilted, or low quality.

IMPORTANT: You MUST return ONLY a JSON object. No other text, explanation, or markdown.

Extract the following information in this EXACT JSON format:
{
  "korName": "Korean name if visible (e.g., 홍길동), or empty string if not found",
  "engSurname": "English surname/family name in CAPITAL LETTERS (e.g., HONG)",
  "engGivenName": "English given name in CAPITAL LETTERS (e.g., GILDONG)",
  "passportNo": "Passport number (e.g., M12345678)",
  "nationality": "3-letter nationality code (e.g., KOR, USA, JPN)",
  "sex": "Gender: M for male, F for female (single letter only)",
  "dateOfBirth": "Date of birth in YYYY-MM-DD format (e.g., 1990-01-15)",
  "dateOfIssue": "Passport issue date in YYYY-MM-DD format (e.g., 2020-01-15)",
  "passportExpiryDate": "Passport expiry date in YYYY-MM-DD format (e.g., 2030-01-15)"
}

CRITICAL RULES:
1. Return ONLY the JSON object above. No markdown code blocks, no explanations.
2. If a field cannot be found, use empty string "".
3. Dates MUST be in YYYY-MM-DD format. Convert from YYMMDD or DDMMMYY if needed.
4. Passport number: Remove all spaces and special characters.
5. English names: If format is "SURNAME/GIVEN NAME", split them correctly into surname and givenName.
6. Korean name: Look for Hangul characters (한글), usually at the bottom of passport.
7. Nationality: Must be exactly 3 uppercase letters (KOR, USA, CHN, JPN, etc).

Return ONLY the JSON object now:`;

    let ocrResult;
    try {
      const result = await model.generateContent([
        { text: prompt },
        {
          inlineData: {
            data: base64String,
            mimeType: 'image/jpeg',
          },
        },
      ]);

      const text = result.response.text();
      let cleanedText = text.trim().replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        ocrResult = JSON.parse(jsonMatch[0]);
      } else {
        ocrResult = JSON.parse(cleanedText);
      }
    } catch (ocrError: any) {
      logger.error('[Partner OCR to APIS] OCR 처리 오류:', ocrError);
      return NextResponse.json(
        { ok: false, message: `OCR 처리 중 오류가 발생했습니다: ${ocrError.message}` },
        { status: 500 }
      );
    }

    // 날짜 정규화
    const normalizeDate = (dateStr: string | null | undefined): string => {
      if (!dateStr) return '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
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
    };

    const normalizedData = {
      korName: ocrResult.korName || '',
      engSurname: ocrResult.engSurname || '',
      engGivenName: ocrResult.engGivenName || '',
      passportNo: (ocrResult.passportNo || '').replace(/\s+/g, '').toUpperCase(),
      sex: (ocrResult.sex || '').toUpperCase().substring(0, 1),
      dateOfBirth: normalizeDate(ocrResult.dateOfBirth),
      dateOfIssue: normalizeDate(ocrResult.dateOfIssue),
      passportExpiryDate: normalizeDate(ocrResult.passportExpiryDate),
      nationality: (ocrResult.nationality || '').toUpperCase().substring(0, 3),
    };

    // 최소한 여권번호나 이름 중 하나는 있어야 함
    const hasPassportNo = normalizedData.passportNo && normalizedData.passportNo.length >= 8;
    const hasName = normalizedData.korName || normalizedData.engSurname;

    if (!hasPassportNo && !hasName) {
      return NextResponse.json(
        { ok: false, message: '여권 정보를 읽을 수 없습니다. 더 선명한 이미지를 사용해주세요.' },
        { status: 400 }
      );
    }

    // UserTrip 확인 (APIS에 저장하기 위해 필요)
    if (!submission.UserTrip) {
      return NextResponse.json(
        { ok: false, message: '여행 정보가 없어 APIS에 저장할 수 없습니다.' },
        { status: 400 }
      );
    }

    // Traveler 테이블에 저장 (APIS 데이터)
    try {
      // 기존 Traveler 확인
      const existingTraveler = await prisma.traveler.findFirst({
        where: {
          tripId: submission.UserTrip.id,
          userId: body.userId,
        },
      });

      const travelerData = {
        tripId: submission.UserTrip.id,
        userId: body.userId,
        roomNumber: 1, // 기본값, 나중에 수정 가능
        korName: normalizedData.korName || submission.User.name || '',
        engSurname: normalizedData.engSurname || '',
        engGivenName: normalizedData.engGivenName || '',
        residentNum: '', // 주민등록번호는 OCR로 추출하지 않음
        passportNo: normalizedData.passportNo || '',
        birthDate: normalizedData.dateOfBirth || '',
        issueDate: normalizedData.dateOfIssue || '',
        expiryDate: normalizedData.passportExpiryDate || '',
        nationality: normalizedData.nationality || 'KOR',
        gender: normalizedData.sex || 'M',
      };

      if (existingTraveler) {
        await prisma.traveler.update({
          where: { id: existingTraveler.id },
          data: travelerData,
        });
      } else {
        await prisma.traveler.create({
          data: travelerData,
        });
      }

      // PassportSubmissionGuest에도 저장
      const existingGuest = await prisma.passportSubmissionGuest.findFirst({
        where: {
          submissionId: body.submissionId,
          name: normalizedData.korName || submission.User.name || '',
        },
      });

      if (existingGuest) {
        await prisma.passportSubmissionGuest.update({
          where: { id: existingGuest.id },
          data: {
            passportNumber: normalizedData.passportNo,
            nationality: normalizedData.nationality,
            dateOfBirth: normalizedData.dateOfBirth ? new Date(normalizedData.dateOfBirth) : null,
            passportExpiryDate: normalizedData.passportExpiryDate ? new Date(normalizedData.passportExpiryDate) : null,
            ocrRawData: {
              ...normalizedData,
              processedAt: new Date().toISOString(),
              processedBy: profile.id,
            },
          },
        });
      } else {
        await prisma.passportSubmissionGuest.create({
          data: {
            submissionId: body.submissionId,
            groupNumber: 1,
            name: normalizedData.korName || submission.User.name || '',
            phone: submission.User.phone,
            passportNumber: normalizedData.passportNo,
            nationality: normalizedData.nationality,
            dateOfBirth: normalizedData.dateOfBirth ? new Date(normalizedData.dateOfBirth) : null,
            passportExpiryDate: normalizedData.passportExpiryDate ? new Date(normalizedData.passportExpiryDate) : null,
            ocrRawData: {
              ...normalizedData,
              processedAt: new Date().toISOString(),
              processedBy: profile.id,
            },
          },
        });
      }

      logger.log('[Partner OCR to APIS] APIS 데이터 저장 완료:', {
        submissionId: body.submissionId,
        userId: body.userId,
        tripId: submission.UserTrip.id,
        partnerId: profile.id,
      });

      return NextResponse.json({
        ok: true,
        message: 'OCR 처리 완료! APIS 데이터가 저장되었습니다.',
        data: normalizedData,
      });
    } catch (dbError: any) {
      logger.error('[Partner OCR to APIS] DB 저장 오류:', dbError);
      return NextResponse.json(
        { ok: false, message: `APIS 데이터 저장 중 오류가 발생했습니다: ${dbError.message}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    logger.error('[Partner OCR to APIS] POST error:', error);
    return NextResponse.json(
      {
        ok: false,
        message: 'OCR 처리 중 오류가 발생했습니다.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}


