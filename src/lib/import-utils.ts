/**
 * Import utility functions for XLSX file processing
 */

import * as XLSX from "xlsx";
import { ImportTarget, IMPORT_CONFIGS } from "./import-config";

/**
 * Validate XLSX file by checking magic bytes
 */
export function isValidXlsx(buffer: Buffer): boolean {
  // XLSX files start with PK (50 4B) signature
  if (buffer.length < 4) return false;
  const signature = buffer.toString("hex", 0, 4);
  return signature.startsWith("504b"); // "PK" in hex
}

/**
 * Build header mapping from XLSX columns to field names
 */
export function buildHeaderMap(
  firstRow: Record<string, string>,
  target: ImportTarget
): Record<string, string> {
  const config = IMPORT_CONFIGS[target];
  const validColumns = new Set(config.columns.map((c) => c.name));
  const headerMap: Record<string, string> = {};

  for (const col of Object.keys(firstRow)) {
    const trimmed = col.trim();
    if (validColumns.has(trimmed)) {
      headerMap[col] = trimmed;
    }
  }

  return headerMap;
}

/**
 * Split rows into chunks for batch processing
 */
export function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}

/**
 * Create sample rows based on import config
 */
export function getSampleRows(
  target: ImportTarget
): Record<string, string>[] {
  const samples: Record<ImportTarget, Record<string, string>[]> = {
    b2c: [
      {
        이름: "홍길동",
        전화번호: "010-1234-5678",
        이메일: "hong@example.com",
        관심크루즈: "일본 크루즈",
        예산: "100만원대",
        메모: "지인 소개",
        유형: "잠재고객",
      },
      {
        이름: "김영희",
        전화번호: "010-9876-5432",
        이메일: "",
        관심크루즈: "지중해 크루즈",
        예산: "200만원대",
        메모: "",
        유형: "잠재고객",
      },
    ],
    b2b_buyer: [
      {
        이름: "박대표",
        전화번호: "010-1234-5678",
        회사명: "ABC 여행사",
        이메일: "info@abctravel.com",
        메모: "",
      },
      {
        이름: "정대표",
        전화번호: "010-9876-5432",
        회사명: "XYZ 투어",
        이메일: "contact@xyztour.com",
        메모: "",
      },
    ],
    b2b_inquiry: [
      {
        이름: "최문의",
        전화번호: "010-1112-2222",
        회사명: "DEF 에이전시",
        이메일: "inquiry@defagency.com",
        문의내용: "그룹 투어 가격 문의",
      },
      {
        이름: "이문의",
        전화번호: "010-3334-4444",
        회사명: "GHI 랜드",
        이메일: "info@ghiland.com",
        문의내용: "커스텀 패키지 상담",
      },
    ],
  };

  return samples[target] || [];
}

/**
 * Get column widths for XLSX export (한글 고려)
 */
export function getColumnWidths(target: ImportTarget): number[] {
  const widths: Record<ImportTarget, number[]> = {
    b2c: [14, 16, 22, 18, 12, 16, 12],
    b2b_buyer: [18, 14, 16, 22, 16],
    b2b_inquiry: [18, 14, 16, 22, 24],
  };

  return widths[target] || [];
}

/**
 * 전화번호 정규화 (국제번호 처리 포함)
 * - 숫자만 추출
 * - 010-1234-5678 형식으로 변환
 * - +82 형식 처리
 */
export function normalizePhone(value: unknown): string | null {
  if (!value) return null;
  const str = String(value).trim();
  const digits = str.replace(/\D/g, '');
  if (!digits || digits.length < 10) return null;

  // +82 형식 처리
  if (digits.startsWith('82')) {
    const withoutCountry = digits.slice(2);
    if (withoutCountry.startsWith('10')) {
      return `010-${withoutCountry.slice(2, 5)}-${withoutCountry.slice(5)}`;
    }
    return `0${withoutCountry.slice(1, 3)}-${withoutCountry.slice(3, 6 + (withoutCountry.length > 9 ? 1 : 0))}-${withoutCountry.slice(6 + (withoutCountry.length > 9 ? 1 : 0))}`;
  }

  // 01로 시작하면 010으로 정규화
  if (digits.startsWith('1')) {
    return `010-${digits.slice(1, 4)}-${digits.slice(4)}`;
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}
