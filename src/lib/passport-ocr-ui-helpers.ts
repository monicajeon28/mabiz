/**
 * 여권 OCR UI 헬퍼 함수
 * OCR 결과를 입력 필드에 매핑하거나 폼에 적용하는 유틸리티
 */

export interface PassportFormData {
  korName?: string;
  engSurname?: string;
  engGivenName?: string;
  passportNumber?: string;
  nationality?: string;
  sex?: string;
  dateOfBirth?: string;
  dateOfIssue?: string;
  passportExpiryDate?: string;
}

/**
 * OCR 결과를 입력 필드명과 매핑
 * 폼의 입력 필드가 어떤 이름인지에 따라 OCR 데이터를 적절히 연결
 */
export function mapOCRToFormFields(ocrData: PassportFormData): Record<string, string> {
  return {
    korName: ocrData.korName || '',
    engSurname: ocrData.engSurname || '',
    engGivenName: ocrData.engGivenName || '',
    passportNumber: ocrData.passportNumber || '',
    nationality: ocrData.nationality || '',
    sex: ocrData.sex || '',
    dateOfBirth: ocrData.dateOfBirth || '',
    dateOfIssue: ocrData.dateOfIssue || '',
    passportExpiryDate: ocrData.passportExpiryDate || '',
  };
}

/**
 * 여권번호 포맷팅 (예: M12345678)
 * 입력값 정규화
 */
export function formatPassportNumber(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * 국가 코드를 한글명으로 변환 (주요 국가만)
 */
export function countryCodeToKorean(code?: string): string {
  if (!code) return '';
  const map: Record<string, string> = {
    KOR: '대한민국',
    USA: '미국',
    CHN: '중국',
    JPN: '일본',
    GBR: '영국',
    FRA: '프랑스',
    DEU: '독일',
    AUS: '호주',
    CAN: '캐나다',
    SGP: '싱가포르',
  };
  return map[code] || code;
}

/**
 * 성별 코드를 한글로 변환
 */
export function sexToKorean(sex?: string): string {
  if (sex === 'M') return '남';
  if (sex === 'F') return '여';
  return '';
}

/**
 * 날짜 형식 검증 및 정규화 (YYYY-MM-DD)
 */
export function isValidDateString(date?: string): boolean {
  if (!date) return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(date)) return false;
  try {
    const d = new Date(date + 'T00:00:00Z');
    return !isNaN(d.getTime());
  } catch {
    return false;
  }
}

/**
 * 여권 만료 여부 체크
 */
export function isPassportExpired(expiryDate?: string): boolean {
  if (!isValidDateString(expiryDate)) return false;
  const expiry = new Date(expiryDate + 'T23:59:59Z');
  return expiry < new Date();
}

/**
 * 여권 유효기간까지의 남은 일수
 */
export function daysUntilExpiry(expiryDate?: string): number | null {
  if (!isValidDateString(expiryDate)) return null;
  const expiry = new Date(expiryDate + 'T23:59:59Z');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
