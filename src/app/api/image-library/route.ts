import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// GET /api/image-library?q=검색어&folder=폴더
export async function GET(req: Request) {
  try {
    await getAuthContext(); // 인증 체크
    const { searchParams } = new URL(req.url);
    const q      = searchParams.get("q");
    const folder = searchParams.get("folder");

    const images = await prisma.imageCache.findMany({
      where: {
        ...(q
          ? {
              OR: [
                { title:    { contains: q, mode: "insensitive" as const } },
                { fileName: { contains: q, mode: "insensitive" as const } },
                { tags:     { has: q } },
              ],
            }
          : {}),
        ...(folder ? { folder: { contains: folder, mode: "insensitive" } } : {}),
      },
      orderBy: { syncedAt: "desc" },
      take: 60,
      select: {
        id:           true,
        title:        true,
        thumbnailUrl: true,
        driveUrl:     true,
        folder:       true,
        tags:         true,
        fileName:     true,
      },
    });

    type ImageRow = {
      id: number; title: string; thumbnailUrl: string | null;
      driveUrl: string | null; folder: string; tags: string[];
      fileName: string;
    };

    const result = (images as ImageRow[]).map((img) => ({
      id:           img.id,
      title:        img.title ?? img.fileName,
      thumbnailUrl: img.thumbnailUrl ?? img.driveUrl ?? "",
      fullUrl:      img.driveUrl ?? img.thumbnailUrl ?? "",
      folder:       img.folder ?? "기타",
      tags:         img.tags,
      isGif:        img.fileName?.toLowerCase().endsWith(".gif") ?? false,
      isVideo:      false,
    }));

    return NextResponse.json({ ok: true, images: result });
  } catch (err) {
    logger.error("[GET /api/image-library]", { err });
    return NextResponse.json({ ok: false, images: [] }, { status: 500 });
  }
}
