import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

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
};

// POST /api/contacts/import
export async function POST(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);

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

      // 유형 매핑
      if (data.type) {
        const typeMap: Record<string, string> = {
          "구매": "CUSTOMER", "구매고객": "CUSTOMER", "customer": "CUSTOMER",
          "잠재": "LEAD", "잠재고객": "LEAD", "lead": "LEAD",
        };
        data.type = typeMap[data.type.toLowerCase()] ?? "LEAD";
      }

      try {
        await prisma.contact.upsert({
          where: { phone_organizationId: { phone: data.phone, organizationId: orgId } },
          create: {
            organizationId: orgId,
            name:           data.name,
            phone:          data.phone,
            email:          data.email          ?? null,
            type:           data.type           ?? "LEAD",
            cruiseInterest: data.cruiseInterest ?? null,
            adminMemo:      data.adminMemo      ?? null,
          },
          update: {
            name:           data.name,
            email:          data.email          ?? undefined,
            cruiseInterest: data.cruiseInterest ?? undefined,
            adminMemo:      data.adminMemo      ?? undefined,
          },
        });
        successCount++;
      } catch {
        errors.push(`${i + 2}행: 저장 실패 (${data.name})`);
        skipCount++;
      }
    }

    logger.log("[POST /api/contacts/import] 완료", { successCount, skipCount, orgId });
    return NextResponse.json({ ok: true, successCount, skipCount, errors: errors.slice(0, 10) });
  } catch (err) {
    logger.error("[POST /api/contacts/import]", { err });
    return NextResponse.json({ ok: false, message: "파일 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
