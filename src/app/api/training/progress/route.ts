import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";

const CONFIG_KEY_PREFIX = "training:progress:";

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const body = await req.json();
    const { path, courseId, progress, status } = body;

    if (!path || !["beginner", "intermediate", "advanced"].includes(path)) {
      return NextResponse.json({ error: "Invalid training path" }, { status: 400 });
    }

    const configKey = `${CONFIG_KEY_PREFIX}${ctx.userId}`;

    const existing = await prisma.systemConfig.findUnique({
      where: { configKey },
      select: { metadata: true },
    });

    const currentData =
      existing?.metadata && typeof existing.metadata === "object"
        ? (existing.metadata as Record<string, unknown>)
        : { courses: {} };

    const courses = (currentData.courses as Record<string, unknown>) ?? {};
    courses[courseId] = { path, progress, status, updatedAt: new Date().toISOString() };

    const newMetadata = JSON.parse(JSON.stringify({ ...currentData, courses, lastPath: path }));

    await prisma.systemConfig.upsert({
      where: { configKey },
      update: {
        metadata: newMetadata,
        updatedAt: new Date(),
      },
      create: {
        configKey,
        category: "training",
        description: `Training progress for user ${ctx.userId}`,
        metadata: newMetadata,
      },
    });

    logger.log("[TrainingProgressAPI] saved", { userId: ctx.userId, path, courseId, progress, status });

    return NextResponse.json({ success: true, path, courseId, progress, status, savedAt: new Date().toISOString() });
  } catch (err) {
    logger.error("[TrainingProgressAPI] save-progress", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to save training progress" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path") as "beginner" | "intermediate" | "advanced" | null;

    const configKey = `${CONFIG_KEY_PREFIX}${ctx.userId}`;
    const record = await prisma.systemConfig.findUnique({
      where: { configKey },
      select: { metadata: true },
    });

    const data =
      record?.metadata && typeof record.metadata === "object"
        ? (record.metadata as Record<string, unknown>)
        : null;

    const savedCourses = (data?.courses as Record<string, { path: string; progress: number; status: string }>) ?? {};

    const allCourseIds = [
      "beginner-1", "beginner-2", "beginner-3", "beginner-4",
      "intermediate-1", "intermediate-2", "intermediate-3", "intermediate-4",
      "advanced-1", "advanced-2", "advanced-3", "advanced-4",
    ];

    const courses = allCourseIds.map((courseId) => {
      const saved = savedCourses[courseId];
      if (saved) {
        return { courseId, status: saved.status, progress: saved.progress };
      }
      const [coursePath] = courseId.split("-");
      return {
        courseId,
        status: coursePath === "beginner" ? "in_progress" : "locked",
        progress: 0,
      };
    });

    return NextResponse.json({
      success: true,
      path: path || (data?.lastPath as string) || "beginner",
      courses,
      lastAccessedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("[TrainingProgressAPI] get-progress", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to fetch training progress" }, { status: 500 });
  }
}
