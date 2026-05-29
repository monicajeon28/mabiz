import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// schema.prisma SmsTemplate.category와 동기화 유지
const VALID_CATEGORIES = new Set([
  'DAY_0', 'DAY_1', 'DAY_2', 'DAY_3',
  'CARE_VIP', 'SEQUENCE', 'LIVE_BROADCAST', 'GENERAL',
]);

// GET /api/tools/sms-templates?category=CARE_VIP&skip=0&take=100
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const skip = parseInt(searchParams.get('skip') ?? '0', 10);
    const take = Math.min(parseInt(searchParams.get('take') ?? '100', 10), 200);

    if (category && !VALID_CATEGORIES.has(category)) {
      return NextResponse.json(
        { ok: false, message: `유효하지 않은 category: ${category}` },
        { status: 400 }
      );
    }

    const orConditions: object[] = [{ isSystem: true }];
    if (ctx.organizationId) orConditions.push({ organizationId: ctx.organizationId });

    const templates = await prisma.smsTemplate.findMany({
      where: {
        OR: orConditions,
        ...(category ? { category } : {}),
      },
      orderBy: [{ isSystem: 'desc' }, { triggerOffset: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true, category: true, title: true, content: true,
        triggerType: true, triggerOffset: true, isSystem: true, usageCount: true,
      },
      skip,
      take,
    });

    return NextResponse.json({ ok: true, templates });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ ok: false }, { status: 401 });
    logger.error('[GET /api/tools/sms-templates]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
