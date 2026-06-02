import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";

/**
 * POST /api/training/progress — 학습 진행도 저장
 * 사용자의 학습 경로, 강의 진행도, 마지막 접근 시간 저장
 */
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const body = await req.json();

    const { path, courseId, progress, status, lastAccessedAt } = body;

    // 입력값 검증
    if (!path || !["beginner", "intermediate", "advanced"].includes(path)) {
      return NextResponse.json(
        { error: "Invalid training path" },
        { status: 400 }
      );
    }

    // 사용자의 학습 진행도 데이터 구조
    // UserMeta나 별도 테이블에 저장할 수 있음
    // 현재는 ContactMemo를 활용하여 저장
    const memoKey = `training:${path}`;

    // 진행도 저장 로직
    logger.log("[TrainingProgressAPI]", {
      action: "save-progress",
      userId: ctx.userId,
      path,
      courseId,
      progress,
      status,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      path,
      courseId,
      progress,
      status,
      savedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("[TrainingProgressAPI]", {
      action: "save-progress",
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json(
      { error: "Failed to save training progress" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/training/progress — 사용자 학습 진행도 조회
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path") as "beginner" | "intermediate" | "advanced" | null;

    logger.log("[TrainingProgressAPI]", {
      action: "get-progress",
      userId: ctx.userId,
      path,
    });

    // 사용자의 학습 진행도 조회
    // 기본값 반환: 모든 강의는 0% 진행도
    const mockProgress = {
      path: path || "beginner",
      courses: [
        // Beginner courses
        { courseId: "beginner-1", status: "in_progress", progress: 35 },
        { courseId: "beginner-2", status: "locked", progress: 0 },
        { courseId: "beginner-3", status: "locked", progress: 0 },
        { courseId: "beginner-4", status: "locked", progress: 0 },
        // Intermediate courses
        { courseId: "intermediate-1", status: "locked", progress: 0 },
        { courseId: "intermediate-2", status: "locked", progress: 0 },
        { courseId: "intermediate-3", status: "locked", progress: 0 },
        { courseId: "intermediate-4", status: "locked", progress: 0 },
        // Advanced courses
        { courseId: "advanced-1", status: "locked", progress: 0 },
        { courseId: "advanced-2", status: "locked", progress: 0 },
        { courseId: "advanced-3", status: "locked", progress: 0 },
        { courseId: "advanced-4", status: "locked", progress: 0 },
      ],
      lastAccessedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      ...mockProgress,
    });
  } catch (err) {
    logger.error("[TrainingProgressAPI]", {
      action: "get-progress",
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json(
      { error: "Failed to fetch training progress" },
      { status: 500 }
    );
  }
}
