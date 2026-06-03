import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

const PAGE_SIZE = 20;

// [SEC-005] Rate Limiting: 공개 API 보호
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1분
const RATE_LIMIT_MAX_REQUESTS = 10; // 1분당 10회
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimitPublic(clientIp: string): { allowed: boolean; resetAt?: number } {
  const now = Date.now();
  const key = `api:bot-guide:${clientIp}`;
  const entry = rateLimitMap.get(key);

  if (!entry || now >= entry.resetAt) {
    // 새로운 윈도우 시작
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true };
}

/**
 * GET /api/tools/bot-guide-answers
 * 검색 API: category, keyword, tone 필터로 Q&A 조회
 *
 * 쿼리 파라미터:
 * - q?: string (질문/답변 검색)
 * - category?: string (예: "기타", "정책&수수료")
 * - tone?: string (예: "neutral", "friendly", "professional")
 * - page?: number (기본값 1)
 * - limit?: number (기본값 20)
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("q")?.toLowerCase().trim() || "";
    const category = searchParams.get("category") || "";
    const tone = searchParams.get("tone") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || PAGE_SIZE.toString());

    // where 조건 구성
    const where: any = { isActive: true };

    // 키워드 검색
    if (query) {
      where.OR = [
        { question: { contains: query, mode: "insensitive" } },
        { answer: { contains: query, mode: "insensitive" } },
        { keywords: { has: query } },
      ];
    }

    // 카테고리 필터
    if (category && category !== "all") {
      where.category = category;
    }

    // 판매톤 필터
    if (tone && tone !== "all") {
      where.OR = [
        ...(where.OR || []),
        {
          salesTone: {
            path: ["primary"],
            equals: tone,
          },
        },
      ];
    }

    // 페이지네이션
    const skip = (page - 1) * limit;

    const [total, data] = await Promise.all([
      prisma.botGuideAnswer.count({ where }),
      prisma.botGuideAnswer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          key: true,
          question: true,
          answer: true,
          category: true,
          type: true,
          source: true,
          salesTone: true,
          keywords: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      ok: true,
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    logger.error("[bot-guide-answers GET]", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { ok: false, message: "검색 실패" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tools/bot-guide-answers
 * 일괄 업로드 API: JSON 파일에서 Q&A 데이터 로드
 *
 * Body:
 * - data?: Array<{id, key, question, answer, category, type, source, salesTone, keywords}>
 *   (생략시 questions_rag_memory_with_tone.json 데이터 사용)
 * - mode?: "upsert" | "replace" (기본값: "upsert")
 * - confirm?: boolean (replace 모드 확인용)
 */
export async function POST(req: NextRequest) {
  try {
    // [SEC-005] Rate Limiting: 공개 API 스팸 방지
    const clientIp = req.headers.get("x-forwarded-for") ||
                     req.headers.get("x-real-ip") ||
                     "unknown";
    const rateLimit = checkRateLimitPublic(clientIp);

    if (!rateLimit.allowed) {
      logger.warn("[BotGuideAnswers] Rate limit exceeded", {
        clientIp,
        resetAt: new Date(rateLimit.resetAt!).toISOString(),
      });
      return NextResponse.json(
        {
          ok: false,
          message: `요청이 너무 많습니다. ${Math.ceil((rateLimit.resetAt! - Date.now()) / 1000)}초 후 다시 시도하세요.`,
          resetAt: rateLimit.resetAt,
        },
        { status: 429 }
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // JSON 파싱 실패시 기본값 사용
    }

    const { data, mode = "upsert", confirm = false } = body;

    // data가 없으면 기본 JSON 파일에서 로드
    let itemsToLoad = data;
    if (!data) {
      try {
        const qaData = await import("@/lib/data/questions_rag_memory_with_tone.json");
        itemsToLoad = qaData.default.questions || [];
      } catch (error) {
        logger.error("[bot-guide-answers POST] Failed to load default JSON", { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json(
          {
            ok: false,
            message:
              "기본 데이터 파일을 찾을 수 없습니다. 요청 본문에 data를 포함해주세요.",
          },
          { status: 400 }
        );
      }
    }

    if (!Array.isArray(itemsToLoad) || itemsToLoad.length === 0) {
      return NextResponse.json(
        { ok: false, message: "유효한 데이터 배열이 필요합니다." },
        { status: 400 }
      );
    }

    // replace 모드 확인
    if (mode === "replace" && !confirm) {
      return NextResponse.json(
        {
          ok: false,
          message: "replace 모드는 confirm: true가 필요합니다.",
        },
        { status: 400 }
      );
    }

    // 트랜잭션으로 처리
    const result = await prisma.$transaction(async (tx) => {
      // replace 모드: 기존 데이터 모두 삭제
      let deleteCount = 0;
      if (mode === "replace") {
        const deleted = await tx.botGuideAnswer.deleteMany({});
        deleteCount = deleted.count;
      }

      const upsertResults: any[] = [];
      const errors: any[] = [];

      for (const item of itemsToLoad) {
        try {
          // key 생성 (id 또는 key 사용)
          const key = item.key || item.id;

          // 데이터 검증
          if (!key || !item.question || !item.answer) {
            errors.push({
              key: key || "unknown",
              error: "필수 필드 누락 (key/id, question, answer)",
            });
            continue;
          }

          const record = await tx.botGuideAnswer.upsert({
            where: { key },
            update: {
              question: item.question,
              answer: item.answer,
              category: item.category || "기타",
              type: item.type || "상담기록",
              source: item.source || "ai-generated",
              salesTone: item.sales_tone || item.salesTone || {
                primary: "neutral",
                secondary: [],
                confidence: 0,
              },
              keywords: item.keywords || [],
              isActive: true,
              updatedAt: new Date(),
            },
            create: {
              key,
              question: item.question,
              answer: item.answer,
              category: item.category || "기타",
              type: item.type || "상담기록",
              source: item.source || "ai-generated",
              salesTone: item.sales_tone || item.salesTone || {
                primary: "neutral",
                secondary: [],
                confidence: 0,
              },
              keywords: item.keywords || [],
              isActive: true,
            },
          });

          upsertResults.push({
            key,
            id: record.id,
            action: "upserted",
          });
        } catch (itemError) {
          const errorMsg = itemError instanceof Error
            ? itemError.message
            : String(itemError);
          logger.error(`[bot-guide-answers] Item error for ${item.key || item.id}`, { error: errorMsg });
          errors.push({
            key: item.key || item.id,
            error: errorMsg,
          });
        }
      }

      return {
        total: itemsToLoad.length,
        succeeded: upsertResults.length,
        failed: errors.length,
        deletedCount: deleteCount,
        results: upsertResults.slice(0, 5), // 처음 5개만 반환
        errors: errors.slice(0, 5),
      };
    });

    return NextResponse.json(
      {
        ok: true,
        message: `${result.succeeded}개 데이터 처리 완료 (실패: ${result.failed}${
          result.deletedCount > 0 ? `, 삭제: ${result.deletedCount}` : ""
        })`,
        ...result,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error("[bot-guide-answers POST] Error", { error: errorMsg, stack: error instanceof Error ? error.stack : undefined });
    return NextResponse.json(
      { ok: false, message: "업로드 중 오류가 발생했습니다.", error: errorMsg },
      { status: 500 }
    );
  }
}
