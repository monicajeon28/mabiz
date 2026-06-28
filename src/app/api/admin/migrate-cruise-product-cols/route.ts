/**
 * POST /api/admin/migrate-cruise-product-cols  (일회용 운영 마이그레이션)
 *
 * 목적: cruisedot-product 웹훅이 쓰는 CruiseProduct 신규 3컬럼을 운영DB에 추가.
 *   salePrice(Int?) / isGold(Boolean default false) / roomInventory(Json?)
 *   prisma migrate가 Vercel 빌드에서 자동적용 안 되므로(수동 운영) 배포된 앱이 운영DB에 직접 적용.
 *   모든 DDL이 IF NOT EXISTS — 여러 번 호출/이미 적용돼도 무해(멱등).
 *
 * 인증: CRON_SECRET (Bearer). 미설정 503.
 *   curl -X POST https://<운영도메인>/api/admin/migrate-cruise-product-cols \
 *        -H "Authorization: Bearer $CRON_SECRET"
 *
 * ⚠️ cruisedot-product 라우트 배포와 동시(직전)에 실행할 것. 컬럼 없는 상태로 웹훅 수신 시 500.
 */
export const dynamic = 'force-dynamic';

import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

async function checkColumn(table: string, column: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = ${table} AND column_name = ${column}`;
  return rows.length > 0;
}

export async function POST(request: NextRequest) {
  try {
    const expectedToken = process.env.CRON_SECRET;
    if (!expectedToken) {
      return NextResponse.json({ ok: false, error: 'CRON_SECRET 미설정' }, { status: 503 });
    }
    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const tokenBuf = Buffer.from(token, 'utf8');
    const expectedBuf = Buffer.from(expectedToken, 'utf8');
    if (tokenBuf.byteLength !== expectedBuf.byteLength || !timingSafeEqual(tokenBuf, expectedBuf)) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const steps: string[] = [];
    await prisma.$executeRawUnsafe(`ALTER TABLE "CruiseProduct" ADD COLUMN IF NOT EXISTS "salePrice" INTEGER`);
    steps.push('salePrice');
    await prisma.$executeRawUnsafe(`ALTER TABLE "CruiseProduct" ADD COLUMN IF NOT EXISTS "isGold" BOOLEAN NOT NULL DEFAULT false`);
    steps.push('isGold');
    await prisma.$executeRawUnsafe(`ALTER TABLE "CruiseProduct" ADD COLUMN IF NOT EXISTS "roomInventory" JSONB`);
    steps.push('roomInventory');

    const ok =
      (await checkColumn('CruiseProduct', 'salePrice')) &&
      (await checkColumn('CruiseProduct', 'isGold')) &&
      (await checkColumn('CruiseProduct', 'roomInventory'));

    logger.log('[admin/migrate-cruise-product-cols] 완료', { ok });
    return NextResponse.json({ ok: true, colsOk: ok, steps });
  } catch (err) {
    logger.error('[admin/migrate-cruise-product-cols]', { err: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      { ok: false, error: (err as { code?: string })?.code ?? 'UNKNOWN', message: '마이그레이션 실패' },
      { status: 500 },
    );
  }
}
