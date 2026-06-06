/**
 * 여권 OCR 공용 라이브러리 (Phase 3 — T1)
 *
 * scan/route.ts에 흩어져 있던 Gemini Vision 여권 추출 로직을 단일화한다.
 * 책임 범위는 "buffer → normalizedData"로만 한정한다:
 *   - 다운로드 / SSRF 검증 / sharp 변환 / Drive 저장 / rate-limit / 응답 포맷 / 마스킹은
 *     각 라우트에 그대로 남긴다. (이 파일은 PII·UI에 비의존)
 *
 * ⚠️ 인식 회귀 0 원칙: 프롬프트 / 모델 기본값 / generationConfig / JSON 복구 / 필드추출 /
 *    날짜정규화 로직은 scan/route.ts에서 "그대로" 이식했다. 한 글자도 의미 변경 금지.
 *    경로별 차이(model / maxTokens)는 opts로만 주입한다.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '@/lib/logger';

/** 요청 시점에 환경변수를 읽어 인스턴스화 (빈 키로 모듈 초기화 방지) — scan getGenAI와 동일 */
function getGenAI(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY_MISSING');
  return new GoogleGenerativeAI(key);
}

/** scan 기본 모델명 결정 (환경변수 → 기본값) — scan resolveGeminiModelName과 동일 */
function resolveDefaultModelName(): string {
  return process.env.GEMINI_MODEL || 'gemini-1.5-flash';
}

/**
 * 원격 이미지 다운로드 — 타임아웃 + 크기 상한 적용(자원 고갈 방지).
 * SSRF 화이트리스트 검증은 호출자가 선행해야 한다(이 함수는 다운로드만 담당).
 * @throws Error 다운로드 실패/타임아웃/크기 초과
 */
export async function fetchImageWithLimit(
  url: string,
  opts: { timeoutMs?: number; maxBytes?: number } = {}
): Promise<Buffer> {
  const timeoutMs = opts.timeoutMs ?? 15000;
  const maxBytes = opts.maxBytes ?? 10 * 1024 * 1024; // 10MB
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`이미지 다운로드 실패: ${res.status}`);
  const len = res.headers.get('content-length');
  if (len && Number(len) > maxBytes) throw new Error('IMAGE_TOO_LARGE');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > maxBytes) throw new Error('IMAGE_TOO_LARGE');
  return buf;
}

/** 여권 OCR 추출 정규화 결과 (scan normalizedData와 동일 shape) */
export interface PassportNormalizedData {
  korName: string;
  engSurname: string;
  engGivenName: string;
  passportNo: string;
  sex: string;
  dateOfBirth: string;
  dateOfIssue: string;
  passportExpiryDate: string;
  nationality: string;
}

export interface PassportExtractResult {
  /** 정규화된 여권 데이터 (KST yyyy-MM-dd 날짜 문자열) */
  data: PassportNormalizedData;
  /** 누락 필드 라벨 (여권번호/영문 성/영문 이름/성별/생년월일/발급일/만료일) */
  warnings: string[];
  /** 최소 정보(여권번호 8자+ 또는 이름) 충족 여부 */
  hasMinimum: boolean;
}

export interface ExtractPassportOptions {
  /** Gemini 모델명 (미지정 시 GEMINI_MODEL || 'gemini-1.5-flash') */
  model?: string;
  /** 최대 출력 토큰 (미지정 시 2048 — scan 현 설정) */
  maxTokens?: number;
}

/** Gemini API 호출 자체가 실패 (네트워크/쿼터/키) */
export class PassportOcrApiError extends Error {
  constructor(public override readonly cause?: unknown) {
    super('PASSPORT_OCR_API_ERROR');
    this.name = 'PassportOcrApiError';
  }
}
/** AI가 빈 응답을 반환 */
export class PassportOcrEmptyResponse extends Error {
  constructor() {
    super('PASSPORT_OCR_EMPTY_RESPONSE');
    this.name = 'PassportOcrEmptyResponse';
  }
}
/** JSON 파싱 + 정규식 백업 모두 실패 (판독 불가) */
export class PassportOcrUnreadable extends Error {
  constructor() {
    super('PASSPORT_OCR_UNREADABLE');
    this.name = 'PassportOcrUnreadable';
  }
}

/** 여권 정보 추출 프롬프트 — scan/route.ts L329-356 그대로 */
const PASSPORT_OCR_PROMPT = `You are an expert passport OCR system. Extract information even from blurry, tilted, low-quality, or partially visible passport images.

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

/**
 * 여권 이미지 buffer를 받아 Gemini Vision으로 정규화 데이터를 추출한다.
 * (scan/route.ts POST 본문 L312-506의 인식 로직과 동일 — 다운로드/Drive/rate-limit 제외)
 *
 * @throws {PassportOcrApiError}     Gemini 호출/응답 처리 실패 (라우트는 500 매핑)
 * @throws {PassportOcrEmptyResponse} 빈 응답 (라우트는 400 매핑)
 * @throws {PassportOcrUnreadable}   판독 불가 (라우트는 400 매핑)
 */
export async function extractPassportFromBuffer(
  buffer: Buffer,
  mimeType: string,
  opts: ExtractPassportOptions = {}
): Promise<PassportExtractResult> {
  const genAI = getGenAI();
  const modelName = opts.model || resolveDefaultModelName();
  const maxOutputTokens = opts.maxTokens ?? 2048;

  const base64String = buffer.toString('base64');

  // Gemini 모델 사용 - OCR 정확도 향상을 위한 최적 설정 (scan과 동일, maxTokens만 opts)
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0,
      maxOutputTokens,
      topP: 0.95,
      topK: 40,
    },
  });

  logger.info('[Passport OCR] Gemini API 호출 시작...');
  logger.info(`[Passport OCR] 모델: ${modelName}`);
  logger.info(`[Passport OCR] 이미지 크기: ${buffer.length} bytes`);
  logger.info(`[Passport OCR] 이미지 타입: ${mimeType}`);

  let result;
  try {
    result = await model.generateContent([
      { text: PASSPORT_OCR_PROMPT },
      {
        inlineData: {
          data: base64String,
          mimeType: mimeType || 'image/jpeg',
        },
      },
    ]);
  } catch (apiError) {
    logger.error('[Passport OCR] Gemini API 호출 실패:', apiError as Record<string, unknown>);
    throw new PassportOcrApiError(apiError);
  }

  let text: string;
  try {
    const response = await result.response;
    text = response.text();
  } catch (responseError) {
    logger.error('[Passport OCR] Gemini 응답 처리 실패:', responseError as Record<string, unknown>);
    throw new PassportOcrApiError(responseError);
  }

  logger.info(`[Passport OCR] Gemini 응답 길이: ${text.length}`);

  if (!text || text.trim() === '') {
    logger.error('[Passport OCR] 빈 응답 수신');
    throw new PassportOcrEmptyResponse();
  }

  // JSON 파싱 (개선된 에러 처리 + 잘린 JSON 복구) — scan L420-464 그대로
  let passportData: Record<string, unknown> | null = null;
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
      logger.info('[Passport OCR] 첫 번째 파싱 실패, JSON 복구 시도...');
      jsonStr = repairTruncatedJson(jsonStr);
      passportData = JSON.parse(jsonStr);
      logger.info('[Passport OCR] JSON 복구 성공');
    }

    // 4. 필수 필드 검증
    if (typeof passportData !== 'object' || passportData === null) {
      throw new Error('Invalid JSON structure');
    }

    logger.info('[Passport OCR] 파싱 성공');
  } catch (parseError) {
    logger.error('[Passport OCR] JSON 파싱 실패:', parseError as Record<string, unknown>);

    // 마지막 수단: 정규식으로 개별 필드 추출 시도
    const extractedData = extractPassportFieldsManually(text);
    if (extractedData && (extractedData.passportNo || extractedData.engSurname)) {
      logger.info('[Passport OCR] 정규식 추출 성공');
      passportData = extractedData;
    } else {
      throw new PassportOcrUnreadable();
    }
  }

  // 데이터 검증 및 정규화 — scan L467-477 그대로
  const pd = passportData as Record<string, string | undefined>;
  const normalizedData: PassportNormalizedData = {
    korName: pd.korName || '',
    engSurname: pd.engSurname || '',
    engGivenName: pd.engGivenName || '',
    passportNo: (pd.passportNo || '').replace(/\s+/g, '').toUpperCase(),
    sex: (pd.sex || '').toUpperCase().substring(0, 1),
    dateOfBirth: normalizeDate(pd.dateOfBirth),
    dateOfIssue: normalizeDate(pd.dateOfIssue),
    passportExpiryDate: normalizeDate(pd.passportExpiryDate),
    nationality: (pd.nationality || '').toUpperCase().substring(0, 3),
  };

  // 최소한 여권번호나 이름 중 하나는 있어야 함 — scan L480-481
  const hasPassportNo = !!normalizedData.passportNo && normalizedData.passportNo.length >= 8;
  const hasName = !!(normalizedData.korName || normalizedData.engSurname);
  const hasMinimum = hasPassportNo || hasName;

  // 경고: 일부 정보만 추출된 경우 — scan L495-502
  const warnings: string[] = [];
  if (!normalizedData.passportNo) warnings.push('여권번호');
  if (!normalizedData.engSurname) warnings.push('영문 성');
  if (!normalizedData.engGivenName) warnings.push('영문 이름');
  if (!normalizedData.sex) warnings.push('성별');
  if (!normalizedData.dateOfBirth) warnings.push('생년월일');
  if (!normalizedData.dateOfIssue) warnings.push('발급일');
  if (!normalizedData.passportExpiryDate) warnings.push('만료일');

  if (warnings.length > 0) {
    logger.warn(`[Passport OCR] 일부 정보 누락: ${warnings.join(', ')}`);
  }

  return { data: normalizedData, warnings, hasMinimum };
}

// ── 추가(부가) 신뢰도 헬퍼 — 4경로 공통, 인식 로직과 무관(순수 함수) ─────────────
//    UI(T10)에서 칸 강조/배지에 사용. normalizedData를 변형하지 않음.

export type PassportExpiryFlag = 'EXPIRED' | 'SOON' | 'OK' | 'UNKNOWN';

/** KST 기준 오늘 yyyy-MM-dd */
function kstTodayString(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/**
 * 여권 만료 플래그 — KST 오늘 기준.
 *  EXPIRED: 이미 만료 / SOON: 6개월 이내 / OK: 여유 / UNKNOWN: 날짜 없음·형식오류
 */
export function evaluateExpiryFlag(expiryDate: string | null | undefined, now: Date = new Date()): PassportExpiryFlag {
  if (!expiryDate || !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) return 'UNKNOWN';
  const today = kstTodayString(now);
  if (expiryDate < today) return 'EXPIRED';
  // 오늘+6개월 (KST)
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const sixMonths = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth() + 6, kst.getUTCDate()));
  const threshold = sixMonths.toISOString().slice(0, 10);
  return expiryDate <= threshold ? 'SOON' : 'OK';
}

/** 한국 여권번호 형식(경고 수준) — 1~2 영문 대문자 + 7~8 숫자 */
const KOR_PASSPORT_NO_RE = /^[A-Z]{1,2}[0-9]{7,8}$/;
export function isLikelyKorPassportNo(passportNo: string | null | undefined): boolean {
  if (!passportNo) return false;
  return KOR_PASSPORT_NO_RE.test(passportNo.trim().toUpperCase());
}

// ── 내부 헬퍼 (scan/route.ts에서 그대로 이식 — 의미 변경 금지) ──────────────────

/** 날짜 정규화 — scan/route.ts normalizeDate L620-641 그대로 (date-only, KST 영향 없음) */
export function normalizeDate(dateStr: string | null | undefined): string {
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

/** 잘린 JSON 복구 — scan/route.ts repairTruncatedJson L644-667 그대로 */
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

/** 정규식 필드 추출 (JSON 파싱 실패 시 백업) — scan/route.ts extractPassportFieldsManually L670-687 그대로 */
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
