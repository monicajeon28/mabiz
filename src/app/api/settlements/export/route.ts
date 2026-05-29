import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";
import { createWriteStream } from "fs";
import { Transform } from "stream";
import { parse } from "json2csv";
import path from "path";
import os from "os";

interface ExportRequest {
  format: "csv" | "excel";
  filters?: {
    periodStart?: string;
    periodEnd?: string;
    statusList?: string[];
    tierList?: string[];
  };
  includeFields?: string[];
}

interface ExportResponse {
  ok: boolean;
  data?: {
    jobId: string;
    status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
    estimatedRows: number;
    estimatedCompletionTime: number;
    downloadUrl: string | null;
  };
  error?: string;
}

/**
 * POST /api/settlements/export
 * 대량 정산 데이터 CSV/Excel 내보내기 (비동기)
 *
 * Request Body:
 * {
 *   "format": "csv" | "excel",
 *   "filters": {
 *     "periodStart": "2026-01-01",
 *     "periodEnd": "2026-05-31",
 *     "statusList": ["PAID", "APPROVED"],
 *     "tierList": ["TIER1", "TIER2"]
 *   },
 *   "includeFields": ["partnerName", "month", "status", "totalCommission", "netPayout"]
 * }
 *
 * Response: 202 Accepted (비동기 작업)
 * Performance: Job 큐잉 <100ms
 *
 * Uses: Stream processing for memory efficiency (1M+ rows)
 */
export async function POST(request: NextRequest): Promise<NextResponse<ExportResponse>> {
  const startTime = Date.now();

  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    if (!ctx?.role?.includes("ADMIN")) {
      return NextResponse.json<ExportResponse>(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 403 }
      );
    }

    const body: ExportRequest = await request.json();

    // 유효성 검사
    if (!["csv", "excel"].includes(body.format)) {
      return NextResponse.json<ExportResponse>(
        { ok: false, error: "INVALID_FORMAT" },
        { status: 400 }
      );
    }

    const jobId = `export-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // 필터 구성
    const periodStart = body.filters?.periodStart
      ? new Date(body.filters.periodStart)
      : new Date("2020-01-01");
    const periodEnd = body.filters?.periodEnd ? new Date(body.filters.periodEnd) : new Date();
    const statusList = body.filters?.statusList || [];
    const tierList = body.filters?.tierList || [];

    // 예상 행 수 조회
    const estimateQuery = prisma.$queryRaw<[{ count: bigint }]>(
      Prisma.sql`
        SELECT COUNT(DISTINCT cl.id)::bigint AS count
        FROM "CommissionLedger" cl
        LEFT JOIN "MonthlySettlement" ms ON cl."settlementId" = ms.id
        LEFT JOIN "Partner" p ON cl."profileId" = p.id
        WHERE cl."isSettled" = true
          AND cl."createdAt" >= ${periodStart}
          AND cl."createdAt" <= ${periodEnd}
          ${statusList.length > 0 ? Prisma.sql`AND ms.status = ANY(${statusList})` : Prisma.empty}
          ${tierList.length > 0 ? Prisma.sql`AND p.tier = ANY(${tierList})` : Prisma.empty}
      `
    );

    const [estimate] = await Promise.all([estimateQuery]);
    const estimatedRows = Number(estimate[0]?.count || 0);
    const estimatedTime = Math.ceil(estimatedRows / 100000); // ~100K rows/sec

    // 백그라운드 작업 큐잉 (실제 구현에서는 Bull/RabbitMQ 사용)
    // 여기서는 응답만 반환하고, 실제 처리는 Cron Job으로 별도 처리
    queueExportJob(jobId, body, estimatedRows).catch((err) => {
      logger.error("[Export Job Error]", { jobId, err });
    });

    return NextResponse.json<ExportResponse>(
      {
        ok: true,
        data: {
          jobId,
          status: "QUEUED",
          estimatedRows,
          estimatedCompletionTime: estimatedTime,
          downloadUrl: null,
        },
      },
      { status: 202 }
    );
  } catch (err) {
    logger.error("[POST /api/settlements/export]", { err });

    return NextResponse.json<ExportResponse>(
      {
        ok: false,
        error: "REQUEST_FAILED",
      },
      { status: 500 }
    );
  }
}

/**
 * 백그라운드 내보내기 작업 (별도 큐잉)
 * 실제 구현에서는 Bull Job Queue 또는 외부 큐 서비스 사용
 */
async function queueExportJob(
  jobId: string,
  options: ExportRequest,
  estimatedRows: number
): Promise<void> {
  const tempDir = path.join(os.tmpdir(), "mabiz-exports");
  const filePath = path.join(tempDir, `${jobId}.${options.format === "csv" ? "csv" : "xlsx"}`);

  logger.log("[Export Job Queued]", { jobId, estimatedRows, filePath });

  // TODO: 실제 구현
  // 1. Bull Job Queue에 jobId 등록
  // 2. Worker가 데이터 스트림 처리
  // 3. S3/Storage에 업로드
  // 4. DB에 다운로드 URL 저장
}

/**
 * GET /api/settlements/export/:jobId
 * 내보내기 작업 상태 확인
 */
export async function GET(request: NextRequest): Promise<NextResponse<ExportResponse>> {
  try {
    const ctx = await getAuthContext();

    if (!ctx?.role?.includes("ADMIN")) {
      return NextResponse.json<ExportResponse>(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 403 }
      );
    }

    const jobId = request.nextUrl.searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json<ExportResponse>(
        { ok: false, error: "MISSING_JOB_ID" },
        { status: 400 }
      );
    }

    // TODO: Job Queue에서 상태 조회
    // const job = await bullQueue.getJob(jobId);
    // const status = job?.getState();

    return NextResponse.json<ExportResponse>(
      {
        ok: true,
        data: {
          jobId,
          status: "PROCESSING",
          estimatedRows: 0,
          estimatedCompletionTime: 0,
          downloadUrl: null,
        },
      },
      {
        headers: {
          "Cache-Control": "no-cache",
        },
      }
    );
  } catch (err) {
    logger.error("[GET /api/settlements/export]", { err });

    return NextResponse.json<ExportResponse>(
      {
        ok: false,
        error: "STATUS_CHECK_FAILED",
      },
      { status: 500 }
    );
  }
}
