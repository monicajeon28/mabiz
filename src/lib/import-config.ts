/**
 * 엑셀 가져오기 설정 및 공통 변환 함수
 */
import { normalizePhone } from '@/lib/import-utils';

export interface ColumnDef {
  name: string;
  label: string;
  required?: boolean;
  field?: string;
  aliases?: string[];
  transform?: (value: unknown) => unknown;
}

export interface ImportConfig {
  label: string;
  name?: string;
  description?: string;
  columns: ColumnDef[];
  validate?: (row: Record<string, unknown>, rowIndex: number) => string[];
}


/**
 * 금액 파싱
 * - 콤마 제거
 * - 숫자로 변환
 */
export function parseAmount(value: unknown): number | null {
  if (!value) return null;
  const str = String(value).trim().replace(/,/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/**
 * 날짜 정규화
 * - 다양한 형식 지원: YYYY-MM-DD, YYYY/MM/DD, YYYYMMDD, 엑셀 시리얼 등
 */
export function parseDate(value: unknown): string | null {
  if (!value) return null;
  const str = String(value).trim();

  // 이미 YYYY-MM-DD 형식
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // YYYY/MM/DD
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(str)) {
    return str.replace(/\//g, '-');
  }

  // YYYYMMDD
  if (/^\d{8}$/.test(str)) {
    return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
  }

  // 엑셀 시리얼 (숫자)
  const num = parseFloat(str);
  if (!isNaN(num) && num > 0 && num < 100000) {
    // 엑셀의 1900년 1월 1일 = 1
    const date = new Date(1900, 0, num);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return null;
}

/**
 * 상태 정규화
 * - 다양한 한글 표현을 통일된 상태로 변환
 */
export function normalizeStatus(value: unknown): string | null {
  if (!value) return null;
  const str = String(value).trim().toLowerCase();

  const statusMap: Record<string, string> = {
    '신청': 'pending',
    '대기': 'pending',
    'pending': 'pending',
    '진행': 'in_progress',
    '진행중': 'in_progress',
    'in_progress': 'in_progress',
    '완료': 'completed',
    'completed': 'completed',
    '취소': 'cancelled',
    'cancelled': 'cancelled',
    '거절': 'rejected',
    'rejected': 'rejected',
  };

  return statusMap[str] || null;
}

/**
 * 연락처 타입 정규화
 * - 한글/영문 매핑 → Prisma Contact.type Enum (LEAD | CUSTOMER)
 */
export function normalizeContactType(value: unknown): string | null {
  if (!value) return null;
  const str = String(value).trim().toLowerCase();

  const typeMap: Record<string, string> = {
    // 잠재고객
    '잠재': 'LEAD',
    '잠재고객': 'LEAD',
    'lead': 'LEAD',
    '개인': 'LEAD',
    'personal': 'LEAD',

    // 구매 고객
    '구매': 'CUSTOMER',
    '구매고객': 'CUSTOMER',
    '구매완료': 'CUSTOMER',
    'customer': 'CUSTOMER',
    '법인': 'CUSTOMER',
    'corporate': 'CUSTOMER',
  };

  return typeMap[str] || 'LEAD'; // 기본값: LEAD
}

/**
 * 셀 값 정제
 * - 공백 제거
 * - 빈 문자열 → null
 */
export function sanitizeCell(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
  return value;
}

/**
 * 배열을 N개 청크로 분할
 */
export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * 행을 파싱하고 변환
 * - 헤더 매핑 적용
 * - 컬럼 변환 함수 실행
 */
export function parseRow(
  rawRow: Record<string, unknown>,
  headerMap: Record<string, string>,
  columns: ColumnDef[]
): Record<string, unknown> {
  const parsed: Record<string, unknown> = {};
  const columnMap = new Map(columns.map((c) => [c.field, c]));

  for (const [excelCol, fieldName] of Object.entries(headerMap)) {
    const value = sanitizeCell(rawRow[excelCol]);
    const columnDef = columnMap.get(fieldName);

    if (columnDef && columnDef.transform && value !== null) {
      parsed[fieldName] = columnDef.transform(value);
    } else {
      parsed[fieldName] = value;
    }
  }

  return parsed;
}

/**
 * ImportTarget 타입 정의
 */
export type ImportTarget = 'b2c' | 'b2c_purchased' | 'b2b_buyer' | 'b2b_inquiry';

/**
 * B2C 고객 가져오기 설정
 */
export const B2C_IMPORT_CONFIG: ImportConfig = {
  label: '문의 고객',
  name: '문의 고객',
  description: '크루즈 상담 문의 고객 정보 가져오기',
  columns: [
    {
      name: '이름',
      label: '이름(필수)',
      required: true,
      field: 'name',
      aliases: ['이름', '성명', 'name'],
    },
    {
      name: '전화번호',
      label: '전화번호(필수)',
      required: true,
      field: 'phone',
      aliases: ['전화', '휴대폰', '핸드폰', 'phone', 'tel'],
      transform: normalizePhone,
    },
    {
      name: '이메일',
      label: '이메일',
      field: 'email',
      aliases: ['이메일', 'email', 'e-mail'],
    },
    {
      name: '관심크루즈',
      label: '관심크루즈',
      field: 'cruiseInterest',
      aliases: ['선호 크루즈', '크루즈 관심도', 'cruise_interest', 'interest'],
    },
    {
      name: '예산',
      label: '예산',
      field: 'budgetRange',
      aliases: ['예산', '예산범위', 'budget_range', 'budget'],
    },
    {
      name: '메모',
      label: '메모',
      field: 'adminMemo',
      aliases: ['메모', '관리자메모', 'admin_memo', 'memo', 'notes'],
    },
    {
      name: '유형',
      label: '유형',
      field: 'type',
      aliases: ['타입', '고객타입', 'type', 'customer_type'],
      transform: normalizeContactType,
    },
  ],
};

/**
 * B2C 구매고객 가져오기 설정 (크루즈 구매 완료)
 */
export const B2C_PURCHASED_IMPORT_CONFIG: ImportConfig = {
  label: '구매 고객',
  name: '구매 고객',
  description: '크루즈 구매 완료 고객 정보 가져오기',
  columns: [
    {
      name: '이름',
      label: '이름(필수)',
      required: true,
      field: 'name',
      aliases: ['이름', '성명', 'name'],
    },
    {
      name: '전화번호',
      label: '전화번호(필수)',
      required: true,
      field: 'phone',
      aliases: ['전화번호', '연락처', '핸드폰', 'phone', 'mobile'],
    },
    {
      name: '예약번호',
      label: '예약번호',
      field: 'bookingRef',
      aliases: ['예약번호', '예약ID', 'booking_ref', 'bookingRef'],
    },
    {
      name: '이메일',
      label: '이메일',
      field: 'email',
      aliases: ['이메일', 'email', 'e-mail'],
    },
    {
      name: '관심크루즈',
      label: '관심크루즈',
      field: 'cruiseInterest',
      aliases: ['선호 크루즈', '크루즈 관심도', 'cruise_interest', 'interest'],
    },
    {
      name: '메모',
      label: '메모',
      field: 'adminMemo',
      aliases: ['메모', '관리자메모', 'admin_memo', 'memo', 'notes'],
    },
  ],
};

/**
 * B2B 구매자 가져오기 설정
 */
export const B2B_BUYER_IMPORT_CONFIG: ImportConfig = {
  label: '교육 구매자',
  name: '교육 구매자',
  description: '교육 상품 구매자 정보 가져오기',
  columns: [
    {
      name: '이름',
      label: '이름(필수)',
      required: true,
      field: 'name',
      aliases: ['이름', '성명', '대표명', '담당자명', 'name'],
    },
    {
      name: '전화번호',
      label: '전화번호(필수)',
      required: true,
      field: 'phone',
      aliases: ['전화', '휴대폰', '핸드폰', 'phone', 'tel'],
      transform: normalizePhone,
    },
    {
      name: '회사명',
      label: '회사명',
      field: 'companyName',
      aliases: ['회사명', '회사', 'company_name', 'company'],
    },
    {
      name: '이메일',
      label: '이메일',
      field: 'email',
      aliases: ['이메일', 'email', 'e-mail'],
    },
    {
      name: '메모',
      label: '메모',
      field: 'notes',
      aliases: ['메모', '비고', '노트', 'notes', 'memo'],
    },
  ],
};

/**
 * B2B 문의자 가져오기 설정
 */
export const B2B_INQUIRY_IMPORT_CONFIG: ImportConfig = {
  label: '교육 문의자',
  name: '교육 문의자',
  description: 'B2B 문의자 정보 가져오기',
  columns: [
    {
      name: '이름',
      label: '이름(필수)',
      required: true,
      field: 'name',
      aliases: ['이름', '성명', '문의자명', '담당자명', 'name'],
    },
    {
      name: '전화번호',
      label: '전화번호(필수)',
      required: true,
      field: 'phone',
      aliases: ['전화', '휴대폰', '핸드폰', 'phone', 'tel'],
      transform: normalizePhone,
    },
    {
      name: '회사명',
      label: '회사명',
      field: 'companyName',
      aliases: ['회사명', '회사', 'company_name', 'company'],
    },
    {
      name: '이메일',
      label: '이메일',
      field: 'email',
      aliases: ['이메일', 'email', 'e-mail'],
    },
    {
      name: '문의내용',
      label: '문의내용',
      field: 'notes',
      aliases: ['문의내용', '내용', '메모', 'notes', 'inquiry_content', 'content'],
    },
  ],
};

/**
 * 모든 가져오기 설정 (ImportTarget 키로 접근)
 */
export const IMPORT_CONFIGS: Record<ImportTarget, ImportConfig> = {
  b2c: B2C_IMPORT_CONFIG,
  b2c_purchased: B2C_PURCHASED_IMPORT_CONFIG,
  b2b_buyer: B2B_BUYER_IMPORT_CONFIG,
  b2b_inquiry: B2B_INQUIRY_IMPORT_CONFIG,
};
