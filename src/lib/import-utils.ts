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
        회사명: "ABC 여행사",
        대표명: "박대표",
        전화번호: "02-1234-5678",
        이메일: "info@abctravel.com",
        담당자: "이담당",
      },
      {
        회사명: "XYZ 투어",
        대표명: "정대표",
        전화번호: "02-9876-5432",
        이메일: "contact@xyztour.com",
        담당자: "김담당",
      },
    ],
    b2b_inquiry: [
      {
        회사명: "DEF 에이전시",
        문의자명: "최문의",
        전화번호: "031-111-2222",
        이메일: "inquiry@defagency.com",
        문의내용: "그룹 투어 가격 문의",
      },
      {
        회사명: "GHI 랜드",
        문의자명: "이문의",
        전화번호: "031-333-4444",
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
 * Normalize phone number
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.match(/^(\d{3})(\d{4})(\d{4})$/)) {
    return digits.replace(/^(\d{3})(\d{4})(\d{4})$/, "$1-$2-$3");
  }
  return digits;
}
