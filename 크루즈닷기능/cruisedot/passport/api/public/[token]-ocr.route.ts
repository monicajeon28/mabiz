import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { resolveGeminiModelName } from '@/lib/ai/geminiModel';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

interface RouteParams {
    params: {
        token: string;
    };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
    try {
        const token = params.token;
        if (!token || token.length < 10) {
            return NextResponse.json({ ok: false, error: '잘못된 토큰입니다.' }, { status: 400 });
        }

        // 토큰 검증
        const submission = await prisma.passportSubmission.findUnique({
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

        const buffer = Buffer.from(await file.arrayBuffer());
        const base64String = buffer.toString('base64');

        // OCR 처리
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

        const result = await model.generateContent([
            { text: prompt },
            {
                inlineData: {
                    data: base64String,
                    mimeType: file.type || 'image/jpeg',
                },
            },
        ]);

        const text = result.response.text();
        let cleanedText = text.trim().replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');
        let ocrResult;

        try {
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                ocrResult = JSON.parse(jsonMatch[0]);
            } else {
                ocrResult = JSON.parse(cleanedText);
            }
        } catch (e) {
            console.error('JSON Parse Error:', e);
            return NextResponse.json({ ok: false, error: 'OCR 결과를 분석할 수 없습니다.' }, { status: 500 });
        }

        // 날짜 정규화 함수
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

        return NextResponse.json({
            ok: true,
            data: normalizedData
        });

    } catch (error: any) {
        console.error('[Public OCR] Error:', error);
        return NextResponse.json({ ok: false, error: error.message || 'OCR 처리 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
