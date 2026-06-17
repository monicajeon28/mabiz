export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { checkRateLimitAsync } from '@/lib/rate-limit';

/** 전화번호 마스킹: 뒷 4자리 유지, 나머지 * 처리 */
function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  if (phone.length <= 4) return phone;
  return phone.slice(0, -4).replace(/./g, '*') + phone.slice(-4);
}

/**
 * GET /api/affiliate/contacts
 * OWNER / FREE_SALES 전용 — 어필리에이트 코드 기준 유입 고객 조회
 * AGENT / GLOBAL_ADMIN → 403
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext();

    // AGENT / GLOBAL_ADMIN 차단
    if (ctx.role === 'AGENT' || ctx.role === 'GLOBAL_ADMIN') {
      return NextResponse.json(
        { ok: false, error: '접근 권한이 없습니다' },
        { status: 403 }
      );
    }

    // 레이트 리밋: 30초에 30건
    const rl = await checkRateLimitAsync(
      `affiliate-contacts:${ctx.userId}`,
      30,
      30_000
    );
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(req.url);
    const affiliateCode = searchParams.get('affiliateCode');
    if (!affiliateCode || affiliateCode.trim() === '') {
      return NextResponse.json(
        { ok: false, error: 'affiliateCode 파라미터가 필요합니다' },
        { status: 400 }
      );
    }

    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const skip = (page - 1) * limit;

    // OWNER: 본인 조직 + 코드 조건 / FREE_SALES: 코드 조건만
    const where = {
      affiliateCode: affiliateCode.trim(),
      deletedAt: null,
      ...(ctx.role === 'OWNER' && ctx.organizationId
        ? { organizationId: ctx.organizationId }
        : {}),
    };

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone: true,
          type: true,
          createdAt: true,
          purchasedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.contact.count({ where }),
    ]);

    // 전화번호 마스킹 (OWNER / FREE_SALES 모두 동일하게 적용)
    const masked = contacts.map((c) => ({
      ...c,
      phone: maskPhone(c.phone),
      createdAt: c.createdAt.toISOString(),
      purchasedAt: c.purchasedAt ? c.purchasedAt.toISOString() : null,
    }));

    return NextResponse.json({
      ok: true,
      contacts: masked,
      total,
      page,
      limit,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNAUTHORIZED')) {
      return NextResponse.json({ ok: false, error: '로그인이 필요합니다' }, { status: 401 });
    }
    logger.error('[GET /api/affiliate/contacts]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
