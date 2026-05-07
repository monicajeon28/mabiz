import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { ImportTarget, IMPORT_CONFIGS } from "@/lib/import-config";
import { getSampleRows, getColumnWidths } from "@/lib/import-utils";

// GET /api/import/sample?target=b2c|b2b_buyer|b2b_inquiry
export async function GET(req: Request) {
  try {
    // 인증 체크 (역할 무관)
    await getAuthContext();

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

    // IMPORT_CONFIGS[target]에서 sampleRows 추출
    const sampleRows = getSampleRows(target);

    // XLSX.utils.json_to_sheet()로 시트 생성
    const ws = XLSX.utils.json_to_sheet(sampleRows);

    // 컬럼 너비 설정 (한글 고려)
    const widths = getColumnWidths(target);
    ws["!cols"] = widths.map((w) => ({ wch: w }));

    // 워크북 생성
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "샘플");

    // XLSX.write()로 바이너리 반환
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    logger.log("[GET /api/import/sample]", { target });

    // Content-Disposition 설정
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="import_sample_${target}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (
      err instanceof Error &&
      err.message === "UNAUTHORIZED"
    ) {
      return NextResponse.json(
        { ok: false, message: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    logger.error("[GET /api/import/sample]", { err });
    return NextResponse.json(
      { ok: false, message: "샘플 생성 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
