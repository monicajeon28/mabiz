import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMabizSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

interface RecentContact {
  id: string;
  name: string;
  email?: string | null;
  phone: string;
}

interface ApiResponse {
  ok: boolean;
  data?: RecentContact[];
  error?: string;
  message?: string;
}

/**
 * GET /api/contract-instances/recent-contacts
 * 최근 연락처 10개 조회 (모달 드롭다운용)
 */
export async function GET(request: NextRequest) {
  try {
    const authContext = await getMabizSession();
    if (!authContext) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { organizationId } = authContext;

    // 최근 10개 Contact 조회
    const contacts = await prisma.contact.findMany({
      where: { organizationId: organizationId as string },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const response: ApiResponse = {
      ok: true,
      data: contacts.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
      })),
      message: `총 ${contacts.length}개 연락처 조회됨`,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error("[GET /api/contract-instances/recent-contacts]", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
