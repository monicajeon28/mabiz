import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { ImportTarget, IMPORT_CONFIGS, normalizeContactType } from "@/lib/import-config";
import {
  isValidXlsx,
  buildHeaderMap,
  chunkRows,
  normalizePhone,
} from "@/lib/import-utils";
import { backupImportFileToDrive } from "@/lib/import-backup";
import { invalidateCache } from "@/lib/redis";
import { createVercelBatchTimeoutGuard, shouldContinueProcessing } from "@/lib/timeout-guard";

export const maxDuration = 300;

// ==================== 배치 처리 함수 ====================

/**
 * B2C 고객 배치 INSERT with ON CONFLICT
 */
async function processBatchB2C(
  chunk: Array<{ lineNo: number; data: Record<string, string> }>,
  orgId: string,
  errors: string[]
): Promise<number> {
  if (chunk.length === 0) return 0;

  const values = chunk
    .map((item) => {
      const phone = normalizePhone(item.data["전화번호"]);
      if (!phone) {
        errors.push(`${item.lineNo}행: 전화번호 정규화 실패`);
        return null;
      }

      const id = crypto.randomUUID();
      const normalizedType = normalizeContactType(item.data["유형"]) ?? "LEAD";
      return {
        id,
        lineNo: item.lineNo,
        phone,
        name: item.data["이름"],
        email: item.data["이메일"] || null,
        type: normalizedType,
        cruiseInterest: item.data["관심크루즈"] || null,
        adminMemo: item.data["메모"] || null,
      };
    })
    .filter((v) => v !== null) as Array<{
    id: string;
    lineNo: number;
    phone: string;
    name: string;
    email: string | null;
    type: string;
    cruiseInterest: string | null;
    adminMemo: string | null;
  }>;

  if (values.length === 0) return 0;

  // 배치 INSERT with 파라미터 바인딩 (Prisma.sql + Prisma.join)
  // SQL Injection 방지 + 배치 성능 (1회 DB 왕복)
  try {
    const rows = values.map((v) =>
      Prisma.sql`(${v.id}, ${orgId}, ${v.phone}, ${v.name}, ${v.email}, ${v.type}, ${v.cruiseInterest}, ${v.adminMemo}, NOW(), NOW())`
    );

    await prisma.$executeRaw`
      INSERT INTO "Contact"
        (id, "organizationId", phone, name, email, type, "cruiseInterest", "adminMemo", "createdAt", "updatedAt")
      VALUES
        ${Prisma.join(rows)}
      ON CONFLICT (phone, "organizationId") DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        type = EXCLUDED.type,
        "cruiseInterest" = EXCLUDED."cruiseInterest",
        "adminMemo" = EXCLUDED."adminMemo",
        "updatedAt" = NOW()
    `;
    return values.length;
  } catch (err) {
    // 배치 실패 시 개별 재시도 (부분 성공 지원)
    let success = 0;
    for (const v of values) {
      try {
        await prisma.$executeRaw`
          INSERT INTO "Contact"
            (id, "organizationId", phone, name, email, type, "cruiseInterest", "adminMemo", "createdAt", "updatedAt")
          VALUES
            (${v.id}, ${orgId}, ${v.phone}, ${v.name}, ${v.email}, ${v.type}, ${v.cruiseInterest}, ${v.adminMemo}, NOW(), NOW())
          ON CONFLICT (phone, "organizationId") DO UPDATE SET
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            type = EXCLUDED.type,
            "cruiseInterest" = EXCLUDED."cruiseInterest",
            "adminMemo" = EXCLUDED."adminMemo",
            "updatedAt" = NOW()
        `;
        success++;
      } catch (rowErr) {
        errors.push(`DB 저장 실패 (phone: ${v.phone.slice(0, 4)}***): ${rowErr instanceof Error ? rowErr.message : '알 수 없음'}`);
      }
    }
    return success;
  }
}

/**
 * B2B 구매자/문의자 배치 INSERT with ON CONFLICT
 */
async function processBatchB2B(
  chunk: Array<{
    lineNo: number;
    data: Record<string, string>;
    eduType: "BUYER" | "INQUIRER";
  }>,
  orgId: string,
  errors: string[]
): Promise<number> {
  if (chunk.length === 0) return 0;

  const values = chunk
    .map((item) => {
      const phone = normalizePhone(item.data["전화번호"]);
      if (!phone) {
        errors.push(`${item.lineNo}행: 전화번호 정규화 실패`);
        return null;
      }

      const id = crypto.randomUUID();
      return {
        id,
        lineNo: item.lineNo,
        phone,
        companyName: item.data["회사명"],
        name: item.data["대표명"] || item.data["문의자명"],
        email: item.data["이메일"] || null,
        position: item.data["담당자"] || null,
        notes: item.data["문의내용"] || null,
        eduType: item.eduType,
      };
    })
    .filter((v) => v !== null) as Array<{
    id: string;
    lineNo: number;
    phone: string;
    companyName: string;
    name: string;
    email: string | null;
    position: string | null;
    notes: string | null;
    eduType: "BUYER" | "INQUIRER";
  }>;

  if (values.length === 0) return 0;

  // 배치 INSERT with 파라미터 바인딩 (Prisma.sql + Prisma.join)
  try {
    const rows = values.map((v) =>
      Prisma.sql`(${v.id}, ${orgId}, ${v.phone}, ${v.companyName}, ${v.name}, ${v.email}, ${v.position}, ${v.notes}, ${v.eduType}, 'NEW', NOW(), NOW())`
    );

    await prisma.$executeRaw`
      INSERT INTO "CrmB2BProspect"
        (id, "organizationId", phone, "companyName", name, email, position, notes, "eduType", status, "createdAt", "updatedAt")
      VALUES
        ${Prisma.join(rows)}
      ON CONFLICT (phone, "organizationId") DO UPDATE SET
        "companyName" = EXCLUDED."companyName",
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        position = EXCLUDED.position,
        notes = EXCLUDED.notes,
        "eduType" = EXCLUDED."eduType",
        "updatedAt" = NOW()
    `;
    return values.length;
  } catch {
    // 배치 실패 시 개별 재시도
    let success = 0;
    for (const v of values) {
      try {
        await prisma.$executeRaw`
          INSERT INTO "CrmB2BProspect"
            (id, "organizationId", phone, "companyName", name, email, position, notes, "eduType", status, "createdAt", "updatedAt")
          VALUES
            (${v.id}, ${orgId}, ${v.phone}, ${v.companyName}, ${v.name}, ${v.email}, ${v.position}, ${v.notes}, ${v.eduType}, 'NEW', NOW(), NOW())
          ON CONFLICT (phone, "organizationId") DO UPDATE SET
            "companyName" = EXCLUDED."companyName",
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            position = EXCLUDED.position,
            notes = EXCLUDED.notes,
            "eduType" = EXCLUDED."eduType",
            "updatedAt" = NOW()
        `;
        success++;
      } catch (rowErr) {
        errors.push(`B2B DB 저장 실패 (phone: ${v.phone.slice(0, 4)}***): ${rowErr instanceof Error ? rowErr.message : '알 수 없음'}`);
      }
    }
    return success;
  }
}

// ==================== POST 핸들러 ====================

export async function POST(req: Request) {
  const startTime = Date.now();
  let ctx;
  let orgId;
  let orgName;
  let buffer;
  const timeoutGuard = createVercelBatchTimeoutGuard();
  timeoutGuard.start();

  try {
    // 인증 체크
    ctx = await getAuthContext();
    orgId = requireOrgId(ctx);

    // 조직 이름 조회
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });
    orgName = org?.name || "unknown";

    // target 파라미터 검증
    const url = new URL(req.url);
    const targetParam = url.searchParams.get("target");

    if (!targetParam) {
      return NextResponse.json(
        { ok: false, message: "target 파라미터가 필수입니다" },
        { status: 400 }
      );
    }

    // target을 정규화 (b2b-buyer → b2b_buyer)
    const target = targetParam
      .toLowerCase()
      .replace(/-/g, "_") as ImportTarget;

    if (!IMPORT_CONFIGS[target]) {
      return NextResponse.json(
        { ok: false, message: "유효하지 않은 target입니다" },
        { status: 400 }
      );
    }

    // 권한 체크 (AGENT, FREE_SALES 차단)
    if (ctx.role === "AGENT" || ctx.role === "FREE_SALES") {
      return NextResponse.json(
        { ok: false, message: "권한이 없습니다" },
        { status: 403 }
      );
    }

    // formData.get("file") 검증
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { ok: false, message: "파일을 첨부하세요" },
        { status: 400 }
      );
    }

    // file.size > 10MB 체크
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { ok: false, message: "파일 크기는 10MB 이하여야 합니다" },
        { status: 400 }
      );
    }

    // 1단계: 처음 4바이트만 읽어서 magic bytes 검증
    const headerBuffer = Buffer.alloc(Math.min(4, file.size));
    const reader = file.slice(0, 4).stream().getReader();
    const { value } = await reader.read();
    if (value) {
      headerBuffer.set(value);
    }
    if (!isValidXlsx(headerBuffer)) {
      return NextResponse.json(
        { ok: false, message: "유효한 Excel 파일이 아닙니다" },
        { status: 400 }
      );
    }

    // 2단계: 실제 파일은 전체 읽기
    buffer = Buffer.from(await file.arrayBuffer());

    // 3단계: XLSX.read() 파싱
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
      defval: "",
    });

    // rows.length === 0 체크
    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, message: "데이터가 없습니다" },
        { status: 400 }
      );
    }

    // buildHeaderMap() 실행
    const firstRow = rows[0];
    const headerMap = buildHeaderMap(firstRow, target);

    if (Object.keys(headerMap).length === 0) {
      return NextResponse.json(
        { ok: false, message: "유효한 컬럼이 없습니다" },
        { status: 400 }
      );
    }

    let successCount = 0;
    let validationSkipCount = 0;
    let processErrorCount = 0;
    const errors: string[] = [];

    // 청크 단위 배치 처리
    const chunks = chunkRows(rows, 100);

    for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
      // 타임아웃 체크
      if (timeoutGuard.hasExceeded()) {
        logger.warn("[import] Timeout 임박, 안전 중단", { chunkIdx });
        break;
      }

      // 메모리 체크
      if (!shouldContinueProcessing(85)) {
        logger.warn("[import] 메모리 85% 도달, 안전 중단", { chunkIdx });
        break;
      }

      const chunk = chunks[chunkIdx];
      const batchData: Array<{
        lineNo: number;
        data: Record<string, string>;
        eduType?: "BUYER" | "INQUIRER";
      }> = [];

      // 각 행 검증 및 데이터 준비
      for (let i = 0; i < chunk.length; i++) {
        const row = chunk[i];
        const chunkStartIdx = chunkIdx * 100;
        const lineNo = chunkStartIdx + i + 2; // 엑셀 행 번호 (헤더 제외)
        const data: Record<string, string> = {};

        // 헤더 매핑 적용
        for (const [col, field] of Object.entries(headerMap)) {
          const cellValue = (row as Record<string, string>)[col];
          if (cellValue) {
            data[field as string] = String(cellValue).trim();
          }
        }

        // B2C 검증
        if (target === "b2c") {
          if (!data["이름"] || !data["전화번호"]) {
            errors.push(`${lineNo}행: 이름 또는 전화번호 없음`);
            validationSkipCount++;
            continue;
          }
          batchData.push({ lineNo, data });
        }

        // B2B_BUYER 검증
        if (target === "b2b_buyer") {
          if (!data["회사명"] || !data["대표명"] || !data["전화번호"]) {
            errors.push(`${lineNo}행: 회사명, 대표명, 전화번호 필수`);
            validationSkipCount++;
            continue;
          }
          batchData.push({ lineNo, data, eduType: "BUYER" });
        }

        // B2B_INQUIRY 검증
        if (target === "b2b_inquiry") {
          if (!data["회사명"] || !data["문의자명"] || !data["전화번호"]) {
            errors.push(`${lineNo}행: 회사명, 문의자명, 전화번호 필수`);
            validationSkipCount++;
            continue;
          }
          batchData.push({ lineNo, data, eduType: "INQUIRER" });
        }
      }

      // 배치 INSERT 실행 (반환값으로 정확한 성공/실패 카운트)
      try {
        let inserted = 0;
        if (target === "b2c") {
          inserted = await processBatchB2C(
            batchData as Parameters<typeof processBatchB2C>[0],
            orgId,
            errors
          );
        } else if (target === "b2b_buyer" || target === "b2b_inquiry") {
          inserted = await processBatchB2B(
            batchData as Parameters<typeof processBatchB2B>[0],
            orgId,
            errors
          );
        }
        successCount += inserted;
        processErrorCount += batchData.length - inserted;
      } catch (err) {
        processErrorCount += batchData.length;
        if (errors.length < 20) {
          errors.push(
            `배치 처리 오류: ${err instanceof Error ? err.message : "알 수 없음"}`
          );
        }
      }
    }

    // 로깅
    const duration = Date.now() - startTime;
    logger.log("[POST /api/import] 완료", {
      target,
      rows: rows.length,
      successCount,
      validationSkipCount,
      processErrorCount,
      duration,
      orgId,
    });

    // ImportLog 기록 (응답 전 확실히 저장)
    try {
      await prisma.importLog.create({
        data: {
          organizationId: orgId,
          target,
          totalRows: rows.length,
          successfulRows: successCount,
          failedRows: validationSkipCount + processErrorCount,
          errors: errors.slice(0, 5).join(" | ") || null,
        },
      });
    } catch (err) {
      logger.error("[POST /api/import] ImportLog 저장 실패", { err });
    }

    // Fire-and-forget: Drive 백업
    (async () => {
      try {
        await backupImportFileToDrive({
          orgName,
          buffer,
          target,
        });
      } catch (err) {
        logger.error("[POST /api/import] Drive 백업 실패", { err });
      }
    })();

    // 캐시 무효화 (import 성공 시)
    if (successCount > 0) {
      await invalidateCache(`crm-stats:${orgId}:*`);
    }

    return NextResponse.json({
      ok: true,
      successCount,
      validationSkipCount,
      processErrorCount,
      errors: errors.slice(0, 20),
    });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { ok: false, message: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    logger.error("[POST /api/import] 오류", { err });
    return NextResponse.json(
      { ok: false, message: "파일 처리 중 오류가 발생했습니다" },
      { status: 500 }
    );
  } finally {
    timeoutGuard.stop();
  }
}
