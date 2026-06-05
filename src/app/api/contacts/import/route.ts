import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { type Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { normalizeContactType } from "@/lib/import-config";

// 엑셀 컬럼 매핑 (한글 헤더 → 필드명)
const COLUMN_MAP: Record<string, string> = {
  "이름":        "name",
  "name":        "name",
  "성명":        "name",
  "전화번호":    "phone",
  "연락처":      "phone",
  "phone":       "phone",
  "휴대폰":      "phone",
  "이메일":      "email",
  "email":       "email",
  "관심크루즈":  "cruiseInterest",
  "크루즈":      "cruiseInterest",
  "예산":        "budgetRange",
  "메모":        "adminMemo",
  "비고":        "adminMemo",
  "유형":        "type",
  "구분":        "type",
  // 유입날짜
  "유입날짜":    "inflowDate",
  "유입일":      "inflowDate",
  "등록일":      "inflowDate",
  "입수일":      "inflowDate",
  "inflow":      "inflowDate",
  // 설문
  "설문1":       "survey1",
  "설문2":       "survey2",
  "설문3":       "survey3",
  "질문1":       "survey1",
  "질문2":       "survey2",
  "질문3":       "survey3",
  "survey1":     "survey1",
  "survey2":     "survey2",
  "survey3":     "survey3",
  "q1":          "survey1",
  "q2":          "survey2",
  "q3":          "survey3",
};

function parseInflowDate(value: string): Date | null {
  if (!value?.trim()) return null;
  const s = value.trim();
  // Excel 날짜 시리얼 숫자 (5자리, 40000~60000 범위 = 2009~2064년)
  if (/^\d{5}$/.test(s)) {
    const serial = parseInt(s, 10);
    if (serial >= 40000 && serial <= 60000) {
      const d = new Date((serial - 25569) * 86400000); // Excel serial → Unix ms
      return isNaN(d.getTime()) ? null : d;
    }
  }
  // YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
  const iso = s.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  // 2023년 1월 5일 / 2023.1.5
  const kor = s.match(/(\d{4})[년]?\s*(\d{1,2})[월]?\s*(\d{1,2})/);
  if (kor) {
    const d = new Date(Number(kor[1]), Number(kor[2]) - 1, Number(kor[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// POST /api/contacts/import
export async function POST(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    const formData = await req.formData();
    const file     = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, message: "파일을 첨부하세요." }, { status: 400 });
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { ok: false, message: "파일 크기는 10MB 이하여야 합니다" },
        { status: 400 }
      );
    }

    const buffer  = Buffer.from(await file.arrayBuffer());
    const wb      = XLSX.read(buffer, { type: "buffer" });
    const sheet   = wb.Sheets[wb.SheetNames[0]];
    const rows    = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });

    if (rows.length === 0) {
      return NextResponse.json({ ok: false, message: "데이터가 없습니다." }, { status: 400 });
    }

    // 헤더 매핑
    const firstRow = rows[0];
    const headerMap: Record<string, string> = {};
    for (const col of Object.keys(firstRow)) {
      const mapped = COLUMN_MAP[col.trim()] ?? COLUMN_MAP[col.trim().toLowerCase()];
      if (mapped) headerMap[col] = mapped;
    }

    let successCount = 0;
    let skipCount    = 0;
    const errors: string[] = [];

    // P1-23: 배열 기반 전처리 (유효성 검증 + 정규화)
    const validRows: Array<{ index: number; data: Record<string, string>; inflowDate: Date | null }> = [];
    for (let i = 0; i < rows.length; i++) {
      const row  = rows[i];
      const data: Record<string, string> = {};

      for (const [col, field] of Object.entries(headerMap)) {
        if (row[col]) data[field] = String(row[col]).trim();
      }

      if (!data.name || !data.phone) {
        errors.push(`${i + 2}행: 이름 또는 전화번호 없음`);
        skipCount++;
        continue;
      }

      // 전화번호 정규화 (하이픈 통일)
      data.phone = data.phone.replace(/[^0-9]/g, "").replace(/^(\d{3})(\d{4})(\d{4})$/, "$1-$2-$3");

      // 유형 정규화
      if (data.type) {
        const normalized = normalizeContactType(data.type);
        data.type = normalized ?? "LEAD";
      }

      validRows.push({ index: i, data, inflowDate: data.inflowDate ? parseInflowDate(data.inflowDate) : null });
    }

    // 50건 단위 청크 처리 (수천건 동시 upsert → DB 과부하 방지)
    const CHUNK_SIZE = 50;
    const allResults: Array<{ status: "fulfilled" | "rejected"; rowIndex: number; name: string }> = [];

    for (let chunkStart = 0; chunkStart < validRows.length; chunkStart += CHUNK_SIZE) {
      const chunk = validRows.slice(chunkStart, chunkStart + CHUNK_SIZE);
      const chunkResults = await Promise.allSettled(
        chunk.map((row) =>
          prisma.contact.upsert({
            where: { phone_organizationId: { phone: row.data.phone, organizationId: orgId } },
            create: {
              organizationId: orgId,
              name:           row.data.name,
              phone:          row.data.phone,
              email:          row.data.email          ?? null,
              type:           row.data.type           ?? "LEAD",
              cruiseInterest: row.data.cruiseInterest ?? null,
              budgetRange:    row.data.budgetRange    ?? null,
              adminMemo:      row.data.adminMemo      ?? null,
              inflowDate:     row.inflowDate          ?? null,
              ...(row.data.survey1 || row.data.survey2 || row.data.survey3 ? {
                surveyData: { q1: row.data.survey1 ?? null, q2: row.data.survey2 ?? null, q3: row.data.survey3 ?? null },
              } : {}),
            } satisfies Prisma.ContactUncheckedCreateInput,
            update: {
              name:           row.data.name,
              email:          row.data.email          ?? undefined,
              cruiseInterest: row.data.cruiseInterest ?? undefined,
              budgetRange:    row.data.budgetRange    ?? undefined,
              adminMemo:      row.data.adminMemo      ?? undefined,
              ...(row.inflowDate ? { inflowDate: row.inflowDate } : {}),
              ...(row.data.survey1 || row.data.survey2 || row.data.survey3 ? {
                surveyData: { q1: row.data.survey1 ?? null, q2: row.data.survey2 ?? null, q3: row.data.survey3 ?? null },
              } : {}),
            },
          })
        )
      );
      chunkResults.forEach((result, idx) => {
        const row = chunk[idx];
        allResults.push({
          status: result.status,
          rowIndex: row.index,
          name: row.data.name,
        });
      });
    }

    // 결과 집계
    allResults.forEach((result) => {
      if (result.status === "fulfilled") {
        successCount++;
      } else {
        errors.push(`${result.rowIndex + 2}행: 저장 실패 (${result.name})`);
        skipCount++;
      }
    });

    logger.log("[POST /api/contacts/import] 완료", { successCount, skipCount, orgId });
    return NextResponse.json({ ok: true, successCount, skipCount, errors: errors.slice(0, 10) });
  } catch (err) {
    logger.error("[POST /api/contacts/import]", { err });
    return NextResponse.json({ ok: false, message: "파일 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
