export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCrmManager } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  const manager = await requireCrmManager();
  if (!manager) return NextResponse.json({ ok: false }, { status: 401 });

  const phone = req.nextUrl.searchParams.get('phone')?.replace(/[^0-9]/g, '') ?? '';
  if (phone.length < 4) return NextResponse.json({ ok: true, users: [] });

  try {
    // GmUser → @@map("User") 테이블
    const users = await prisma.gmUser.findMany({
      where: {
        role: { not: 'admin' },
        phone: { contains: phone },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        tripCount: true,
        role: true,
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ ok: true, users });
  } catch (err) {
    logger.error('[GET /api/passport/admin/user-search]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
